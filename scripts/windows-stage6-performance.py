"""Stage 6 opt-in Windows FlexiKit performance measurements.

Nothing runs in the background, no persistent telemetry or file output.
CPU/memory reads use process counters only: never window text, user data,
browser arguments, URLs, clipboard, documents or raw file paths.

--pid attaches read-only to an allowed running FlexiKit process. Startup mode
only launches the isolated com.flexikit.resize-test application and exits it;
NEVER starts, restarts or kills the regular desktop or installed release.
"""
from __future__ import annotations

import argparse
import ctypes
import json
import os
import pathlib
import socket
import statistics
import subprocess
import sys
import time
from ctypes import wintypes as w
from urllib.request import urlopen

import psutil

ALLOWED = {"flexikit-desktop.exe", "flexikit-resize-test.exe"}
TEST_EXE = pathlib.Path(r"D:\AI_Cache\flexikit-resize-isolated\debug\flexikit-resize-test.exe")
LOGICAL_CORES = psutil.cpu_count(logical=True) or 1

def percentile(values: list[float], percent: float) -> float | None:
    if not values:
        return None
    data = sorted(values)
    pos = (len(data) - 1) * percent / 100
    lo = int(pos)
    hi = min(lo + 1, len(data) - 1)
    return data[lo] + (data[hi] - data[lo]) * (pos - lo)

def named_group(name: str) -> str:
    low = name.lower()
    if low in ALLOWED:
        return "host"
    if low == "msedgewebview2.exe":
        return "webview2"
    return "other_child"

def validate_root(pid: int) -> psutil.Process:
    root = psutil.Process(pid)
    if root.name().lower() not in ALLOWED:
        raise ValueError("PID is not a FlexiKit desktop/test host; no metrics collected")
    # Require exact basename, including path, without exposing its value in output.
    if pathlib.Path(root.exe()).name.lower() not in ALLOWED:
        raise ValueError("PID executable does not match the allowlist")
    return root

def snapshot(root: psutil.Process) -> dict:
    try:
        processes = [root] + root.children(recursive=True)
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        raise RuntimeError("The target host exited or could not be read")
    entries = {}
    for proc in processes:
        try:
            with proc.oneshot():
                name = proc.name()
                group = named_group(name)
                cpu = proc.cpu_times()
                mem = proc.memory_info()
                try:
                    unique = int(proc.memory_full_info().uss)
                except (AttributeError, psutil.AccessDenied, OSError):
                    unique = None
                entries[proc.pid] = {
                    "group": group,
                    "cpu_s": cpu.user + cpu.system,
                    "rss": int(mem.rss),
                    "private": unique,
                    "threads": proc.num_threads(),
                }
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    if root.pid not in entries:
        raise RuntimeError("Target host exited while sampling")
    return entries

def collect(pid: int, seconds: float, interval: float) -> dict:
    root = validate_root(pid)
    samples = []
    elapsed = 0.
    current = snapshot(root)
    count = max(2, int(round(seconds / interval)))
    for _ in range(count):
        before = time.monotonic()
        time.sleep(interval)
        later = snapshot(root)
        dt = time.monotonic() - before
        elapsed += dt
        groups = {}
        for pid_now, entry in later.items():
            category = entry["group"]
            group = groups.setdefault(category, {"n": 0, "rss": 0, "private": 0,
                                                    "private_available": True, "threads": 0,
                                                    "cpu_delta": 0.})
            group["n"] += 1
            group["rss"] += entry["rss"]
            group["threads"] += entry["threads"]
            if entry["private"] is None:
                group["private_available"] = False
            else:
                group["private"] += entry["private"]
            prev = current.get(pid_now)
            if prev and prev["group"] == category:
                group["cpu_delta"] += max(0, entry["cpu_s"] - prev["cpu_s"])
        for val in groups.values():
            val["cpu_pct_total_system"] = val["cpu_delta"] * 100 / (dt * LOGICAL_CORES)
        sample = {
            "cpu_system_pct": sum(entry["cpu_delta"] for entry in groups.values()) * 100 / (dt * LOGICAL_CORES),
            "rss_mb_sum": sum(entry["rss"] for entry in groups.values()) / 1048576,
            "private_mb_sum": sum(entry["private"] for entry in groups.values()) / 1048576
               if all(g["private_available"] for g in groups.values()) else None,
            "host_rss_mb": groups.get("host", {}).get("rss", 0) / 1048576,
            "webview_rss_mb_sum": groups.get("webview2", {}).get("rss", 0) / 1048576,
            "webview_count": groups.get("webview2", {}).get("n", 0),
            "thread_count_sum": sum(entry["threads"] for entry in groups.values()),
        }
        samples.append(sample)
        current = later

    def summary(key: str) -> dict:
        values = [float(x[key]) for x in samples if x[key] is not None]
        return {"median": round(statistics.median(values), 2) if values else None,
                "p95": round(percentile(values, 95), 2) if values else None,
                "max": round(max(values), 2) if values else None}
    return {
        "kind": "opt_in_existing_process", "target": root.name().lower(),
        "pid": root.pid, "samples": len(samples), "elapsed_s": round(elapsed, 2),
        "logical_processors": LOGICAL_CORES,
        "cpu_percent_of_total_machine": summary("cpu_system_pct"),
        "host_working_set_mb": summary("host_rss_mb"),
        "webview2_working_sets_mb_sum": summary("webview_rss_mb_sum"),
        "process_tree_working_sets_mb_sum": summary("rss_mb_sum"),
        "process_tree_private_unique_mb_sum": summary("private_mb_sum"),
        "webview2_process_count": summary("webview_count"),
        "thread_count_sum": summary("thread_count_sum"),
        "limitations": [
            "Idle results are valid only if the application was not being used during sampling.",
            "Summed process working sets double-count shared pages; private USS is preferred when accessible.",
            "This is one host and its descendants, not all machine RAM or other Tauri windows.",
            "No paths, window contents, prompt text, commands, clipboard or browser state were read.",
        ],
    }

def runtime_window(pid: int) -> tuple[bool, bool]:
    found_parent = False
    found_child = False
    u = ctypes.windll.user32
    EnumProc = ctypes.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)
    u.GetWindowThreadProcessId.argtypes = [w.HWND, ctypes.POINTER(w.DWORD)]
    u.GetWindowThreadProcessId.restype = w.DWORD
    u.GetClassNameW.argtypes = [w.HWND, w.LPWSTR, ctypes.c_int]
    u.IsWindowVisible.argtypes = [w.HWND]
    def cb(hwnd: int, unused: int) -> bool:
        nonlocal found_parent, found_child
        owner = w.DWORD()
        u.GetWindowThreadProcessId(hwnd, ctypes.byref(owner))
        if owner.value != pid or not u.IsWindowVisible(hwnd):
            return True
        cls = ctypes.create_unicode_buffer(64)
        u.GetClassNameW(hwnd, cls, 64)
        if cls.value != "Tauri Window":
            return True
        found_parent = True
        ChildProc = ctypes.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)
        u.EnumChildWindows.argtypes = [w.HWND, ChildProc, w.LPARAM]
        def child_callback(child: int, unused2: int) -> bool:
            nonlocal found_child
            cname = ctypes.create_unicode_buffer(64)
            u.GetClassNameW(child, cname, 64)
            if cname.value == "WRY_WEBVIEW":
                found_child = True
            return True
        u.EnumChildWindows(hwnd, ChildProc(child_callback), 0)
        return True
    u.EnumWindows(EnumProc(cb), 0)
    return found_parent, found_child

def startup_once() -> dict:
    if not TEST_EXE.is_file():
        raise RuntimeError("Isolated test EXE is not built")
    # An existing isolated copy can share its WebView2 profile / app identity.
    if any(p.info["name"] and p.info["name"].lower() == TEST_EXE.name.lower()
           for p in psutil.process_iter(["name"])):
        raise RuntimeError("Close the existing isolated resize test before a startup measurement")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    env = os.environ.copy()
    env["FLEXIKIT_RESIZE_TRANSPARENT"] = "0"
    env["FLEXIKIT_RESIZE_TEST_FRAME"] = "standard"
    env["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = f"--remote-debugging-port={port}"
    t0 = time.perf_counter()
    proc = subprocess.Popen([str(TEST_EXE), "--fk-resize-standard"], cwd=TEST_EXE.parent,
                            env=env, stdin=subprocess.DEVNULL,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    vis = None
    child = None
    dom = None
    last = None
    try:
        deadline = time.perf_counter() + 22
        while time.perf_counter() < deadline and (vis is None or child is None or dom is None):
            if proc.poll() is not None:
                raise RuntimeError("Isolated test process exited during startup")
            if vis is None or child is None:
                win, web = runtime_window(proc.pid)
                if win and vis is None:
                    vis = time.perf_counter() - t0
                if web and child is None:
                    child = time.perf_counter() - t0
            if dom is None:
                try:
                    with urlopen(f"http://127.0.0.1:{port}/json/list", timeout=.25) as stream:
                        targets = json.loads(stream.read())
                    if any(x.get("type") == "page" and
                           str(x.get("url", "")).startswith("http://tauri.localhost")
                           for x in targets):
                        # CDP target available; renderer ready is a stronger
                        # signal than HWND, but not the actual desktop paint.
                        dom = time.perf_counter() - t0
                except (OSError, ValueError, TimeoutError):
                    pass
            time.sleep(.04)
        if vis is None or child is None or dom is None:
            raise RuntimeError("Timed out measuring isolated startup checkpoints")
        return {"window_visible_ms": round(vis*1000),
                "webview_child_hwnd_ms": round(child*1000),
                "chromium_page_target_ms": round(dom*1000)}
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)

def startup(repetitions: int) -> dict:
    results = [startup_once() for _ in range(repetitions)]
    return {
        "kind": "isolated_app_warm_startup", "runs": repetitions,
        "checks": {key: {"median_ms": round(statistics.median(r[key] for r in results)),
                         "values_ms": [r[key] for r in results]}
                   for key in results[0]},
        "limitations": [
            "Only the isolated test binary (without Pet, Canvas or global indexing) is measured.",
            "Repeated runs use the warm OS file cache; not a true cold reboot or production launch.",
            "Chrome DevTools target availability and HWND visibility are NOT first meaningful paint.",
            "Actual FlexiKit startup must be separately measured with human-visible first frame.",
        ],
    }

def self_test() -> None:
    assert percentile([1, 2, 3], 50) == 2
    assert percentile([1, 2, 3], 95) == 2.9
    assert named_group("msedgewebview2.exe") == "webview2"
    assert named_group("flexikit-resize-test.exe") == "host"
    assert named_group("other.exe") == "other_child"
    print(json.dumps({"self_test": "PASS", "checks": 5}))

def main() -> None:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--pid", type=int, help="Read-only performance sampling for an allowed FlexiKit host")
    mode.add_argument("--startup", type=int, metavar="RUNS", help="Opt-in warm-start runs of isolated EXE only")
    mode.add_argument("--self-test", action="store_true")
    parser.add_argument("--seconds", type=float, default=12)
    parser.add_argument("--interval", type=float, default=1)
    args = parser.parse_args()
    if args.self_test:
        self_test()
    elif args.pid is not None:
        if args.seconds < 2 or args.seconds > 120 or args.interval < .25 or args.interval > 5:
            raise ValueError("Sampling limits: seconds 2..120, interval .25..5")
        print(json.dumps(collect(args.pid, args.seconds, args.interval), ensure_ascii=False))
    else:
        if args.startup < 1 or args.startup > 5:
            raise ValueError("Startup repetitions must be 1..5")
        print(json.dumps(startup(args.startup), ensure_ascii=False))

if __name__ == "__main__":
    try:
        main()
    except (psutil.Error, OSError, RuntimeError, ValueError) as error:
        print(json.dumps({"failed": type(error).__name__, "reason": str(error)[:160]}), file=sys.stderr)
        sys.exit(1)
