"""Side-by-side-process Windows WebView2 live resize experiment (not a final visual test).

Runs ONLY an opt-in isolated flexikit-resize-test.exe. Does not attach to the
user's real desktop build, capture screenshots, access user data, or inject
mouse clicks unless --mouse is explicitly provided. The test window is briefly
brought to the front; foreground/geometry/cursor are restored after each trial.
"""
from __future__ import annotations

import argparse
import ctypes
import importlib.util
import os
import pathlib
import statistics
import subprocess
import threading
import time

import psutil

source = pathlib.Path(__file__).with_name("windows-resize-diagnostics.py")
spec = importlib.util.spec_from_file_location("resize_geometry", source)
if spec is None or spec.loader is None:
    raise RuntimeError("Missing resize geometry helper")
geom = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geom)
u = geom.user32
gdi = ctypes.WinDLL("gdi32", use_last_error=True)
u.GetForegroundWindow.restype = ctypes.c_void_p
gdi.GetPixel.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int]
gdi.GetPixel.restype = ctypes.c_uint32
u.GetDC.argtypes = [ctypes.c_void_p]
u.GetDC.restype = ctypes.c_void_p
u.ReleaseDC.argtypes = [ctypes.c_void_p, ctypes.c_void_p]

def rgb(color: int) -> tuple[int, int, int]:
    return color & 255, (color >> 8) & 255, (color >> 16) & 255

def extreme_difference(outside: int, inside: int) -> bool:
    if outside == 0xFFFFFFFF or inside == 0xFFFFFFFF:
        return False
    a, b = rgb(outside), rgb(inside)
    extreme = max(a) <= 20 or min(a) >= 238
    return extreme and max(abs(x - y) for x, y in zip(a, b)) >= 75

def sample_pixel_borders(hwnd: int, dc: int) -> tuple[bool, bool]:
    r = geom.rect(hwnd)
    w, h = r.right - r.left, r.bottom - r.top
    if w < 80 or h < 80:
        return False, False
    row_hits = 0
    col_hits = 0
    for ratio in (0.22, 0.38, 0.62, 0.78):
        y = r.top + int(h * ratio)
        x = r.left + int(w * ratio)
        row_hits += extreme_difference(
            gdi.GetPixel(dc, r.right - 2, y), gdi.GetPixel(dc, r.right - 22, y))
        col_hits += extreme_difference(
            gdi.GetPixel(dc, x, r.bottom - 2), gdi.GetPixel(dc, x, r.bottom - 22))
    return row_hits >= 3, col_hits >= 3

def wait_for_window(pid: int, timeout: float = 12.0) -> tuple[int, int]:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            handles = geom.find_main(pid)
            if not u.IsIconic(handles[0]) and u.IsWindowVisible(handles[0]):
                return handles
        except RuntimeError:
            pass
        time.sleep(0.2)
    raise RuntimeError("Isolated test main window did not become visible")

def mouse_drag_trials(parent: int) -> dict[str, dict]:
    if u.GetAsyncKeyState(1) & 0x8000 or u.GetAsyncKeyState(2) & 0x8000:
        raise RuntimeError("A mouse button is already held; refusing automated input")
    results: dict[str, dict] = {}
    for direction in ("east", "south", "southeast"):
        original = geom.rect(parent)
        w, h = original.right - original.left, original.bottom - original.top
        if direction == "east":
            start_x, start_y, dx, dy = original.right - 3, original.top + h // 2, 120, 0
        elif direction == "south":
            start_x, start_y, dx, dy = original.left + w // 2, original.bottom - 3, 0, 90
        else:
            start_x, start_y, dx, dy = original.right - 4, original.bottom - 4, 90, 70
        u.SetCursorPos(start_x, start_y)
        time.sleep(0.09)
        win_at_pointer = u.WindowFromPoint(geom.Point(start_x, start_y))
        cursor_target = geom.class_name(win_at_pointer) if win_at_pointer else "none"
        foreground = u.GetForegroundWindow()
        class_at_foreground = geom.class_name(foreground) if foreground else "none"
        u.mouse_event(0x0002, 0, 0, 0, 0)
        try:
            time.sleep(0.24)
            for i in range(1, 25):
                u.SetCursorPos(start_x + dx * i // 24, start_y + dy * i // 24)
                time.sleep(0.014)
        finally:
            u.mouse_event(0x0004, 0, 0, 0, 0)
        time.sleep(0.18)
        after = geom.rect(parent)
        moved_x = (after.right - after.left) - w
        moved_y = (after.bottom - after.top) - h
        results[direction] = {
            "resize_px": max(abs(moved_x), abs(moved_y)),
            "target": cursor_target,
            "foreground": class_at_foreground,
            "foreground_is_test": foreground == parent,
        }
    return results


def run_variant(exe: pathlib.Path, transparent: bool, mouse_mode: bool = False, sample_pixels: bool = False, render_mode: str = 'Default') -> dict:
    env = os.environ.copy()
    env["FLEXIKIT_RESIZE_TRANSPARENT"] = "1" if transparent else "0"
    flags = {
        "Default": "",
        "DisableDirectComposition": "--disable-direct-composition",
        "DisableGpuCompositing": "--disable-gpu-compositing",
    }
    if render_mode not in flags:
        raise ValueError("Unsupported isolated WebView2 rendering mode")
    # Each subprocess gets exactly one diagnostic flag; do not change process
    # or machine environment and never pass the switch to the desktop EXE.
    if flags[render_mode]:
        env["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = flags[render_mode]
    else:
        env.pop("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", None)
    proc = subprocess.Popen([str(exe)], cwd=exe.parent, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    prev_foreground = u.GetForegroundWindow()
    parent = 0
    original = None
    readings = []
    changed_during_sample = [0]
    post_setwindowpos_gaps = []
    thread_ids = (0, 0)
    verified_switch = False
    child_webviews = 0
    child_inspection_error = None
    stop = threading.Event()
    thread = None
    cursor = geom.Point()
    u.GetCursorPos(ctypes.byref(cursor))
    try:
        parent, web = wait_for_window(proc.pid)
        thread_ids = geom.window_threads(parent, web)
        original = geom.rect(parent)
        desktop_w, desktop_h = u.GetSystemMetrics(0), u.GetSystemMetrics(1)
        window_w = min(1130, desktop_w - 120)
        window_h = min(700, desktop_h - 120)
        x, y = 40, 40
        # Controlled isolated probe only: visible composition has to be measured
        # on the desktop, not in an offscreen/minimized swapchain.
        if not u.SetWindowPos(parent, -1, x, y, window_w, window_h, 0x0010):
            raise RuntimeError("Cannot position isolated window")
        time.sleep(1.1)
        try:
            descendants = psutil.Process(proc.pid).children(recursive=True)
            webviews = [child for child in descendants if child.name().lower() == "msedgewebview2.exe"]
            child_webviews = len(webviews)
            if flags[render_mode]:
                verified_switch = any(
                    flags[render_mode] in child.cmdline() for child in webviews
                )
            else:
                verified_switch = child_webviews > 0 and all(
                    not any(arg.startswith("--disable-direct-composition")
                            or arg.startswith("--disable-gpu-compositing")
                            for arg in child.cmdline())
                    for child in webviews
                )
        except (psutil.Error, OSError) as error:
            # Do not log process command lines (which may contain personal paths).
            child_inspection_error = type(error).__name__
        def observer() -> None:
            dc = u.GetDC(None) if sample_pixels else None
            try:
                while not stop.is_set():
                    offsets, host_changed = geom.guarded_alignment(parent, web)
                    if host_changed:
                        changed_during_sample[0] += 1
                    if offsets is not None:
                        edge, bottom = sample_pixel_borders(parent, dc) if dc else (False, False)
                        readings.append((max(map(abs, offsets)), edge, bottom))
                    time.sleep(0.010)
            finally:
                if dc:
                    u.ReleaseDC(None, dc)
        thread = threading.Thread(target=observer, daemon=True)
        thread.start()
        if mouse_mode:
            u.SetForegroundWindow(parent)
            time.sleep(0.18)
            if u.GetForegroundWindow() != parent:
                # On headless/remote Windows desktops synthetic input can be
                # blocked by the foreground lock. Never report false zero-size
                # drags as failures, and don't send mouse input to another app.
                moves = {"skipped": "isolated test window could not acquire foreground"}
            else:
                moves = mouse_drag_trials(parent)
        else:
            moves = None
            flags = 0x0004 | 0x0010
            for _ in range(3):
                for step in list(range(1, 33)) + list(range(32, -1, -1)):
                    u.SetWindowPos(parent, -1, x, y, window_w + step * 6,
                                   window_h + step * 3, flags)
                    post_offsets, post_changed = geom.guarded_alignment(parent, web)
                    if post_offsets is not None and not post_changed:
                        post_setwindowpos_gaps.append(max(map(abs, post_offsets)))
                    time.sleep(0.014)
        time.sleep(0.35)
        gap = [d for d, _, _ in readings]
        return {
            "variant": "transparent" if transparent else "opaque",
            "render_mode": render_mode,
            "webview_child_processes": child_webviews,
            "render_switch_verified": verified_switch,
            "render_switch_inspection_error": child_inspection_error,
            "samples": len(readings),
            "discarded_host_moved_between_reads": changed_during_sample[0],
            "same_win32_thread": thread_ids[0] == thread_ids[1],
            "max_gap_px": max(gap) if gap else None,
            "mismatch_ge2": sum(d >= 2 for d in gap),
            "post_SetWindowPos_samples": len(post_setwindowpos_gaps),
            "post_SetWindowPos_gap_ge2": sum(d >= 2 for d in post_setwindowpos_gaps),
            "post_SetWindowPos_max_gap": max(post_setwindowpos_gaps) if post_setwindowpos_gaps else None,
            "median_gap_px": statistics.median(gap) if gap else None,
            "right_edge_outlier": sum(edge for _, edge, _ in readings),
            "bottom_edge_outlier": sum(bottom for _, _, bottom in readings),
            "mouse_resize_delta_px": moves,
        }
    finally:
        stop.set()
        if thread:
            thread.join(timeout=4.0)
        if parent and original:
            u.SetWindowPos(parent, -2, original.left, original.top,
                           original.right - original.left, original.bottom - original.top,
                           0x0004 | 0x0010)
        u.SetCursorPos(cursor.x, cursor.y)
        if prev_foreground:
            u.SetForegroundWindow(prev_foreground)
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--exe", required=True, type=pathlib.Path)
    parser.add_argument("--mouse", action="store_true", help="Real pointer input to isolated test only")
    parser.add_argument("--pixels", action="store_true", help="Use slow GDI pixel probes in addition to geometry")
    parser.add_argument("--compare-renderers", action="store_true", help="Run opaque Default/DirectComposition/GPU diagnostics sequentially")
    args = parser.parse_args()
    exe = args.exe.resolve()
    if exe.name.lower() != "flexikit-resize-test.exe" or not exe.is_file():
        raise ValueError("Only a built isolated FlexiKit resize test exe is allowed")
    if args.compare_renderers:
        if args.mouse:
            raise ValueError("The rendering comparison requires deterministic synthetic window resizing")
        for mode in ("Default", "DisableDirectComposition", "DisableGpuCompositing"):
            print(run_variant(exe, False, sample_pixels=args.pixels, render_mode=mode), flush=True)
    else:
        for transparent in (False, True):
            print(run_variant(exe, transparent, mouse_mode=args.mouse, sample_pixels=args.pixels), flush=True)
    print("Geometry is an HWND proxy, not WebView2 frame-presentation/visual acceptance. Pixel probes optional.")

if __name__ == "__main__":
    main()
