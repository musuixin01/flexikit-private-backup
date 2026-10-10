"""Measure Win32 host/client/WebView2 alignment while a FlexiKit window changes size.

No screenshots, user content, telemetry, mouse clicks, or application data are read.
Run with --pid PID. --sweep changes window size only and is restricted to the
isolated flexikit-resize-test process; the starting geometry is restored.
"""
from __future__ import annotations

import argparse
import ctypes
import statistics
import threading
import time
from ctypes import wintypes as win

user32 = ctypes.WinDLL("user32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
EnumProc = ctypes.WINFUNCTYPE(win.BOOL, win.HWND, win.LPARAM)

class Rect(ctypes.Structure):
    _fields_ = [("left", win.LONG), ("top", win.LONG),
                ("right", win.LONG), ("bottom", win.LONG)]

class Point(ctypes.Structure):
    _fields_ = [("x", win.LONG), ("y", win.LONG)]

user32.GetWindowThreadProcessId.argtypes = [win.HWND, ctypes.POINTER(win.DWORD)]
user32.GetClassNameW.argtypes = [win.HWND, win.LPWSTR, ctypes.c_int]
user32.GetWindowRect.argtypes = [win.HWND, ctypes.POINTER(Rect)]
user32.GetClientRect.argtypes = [win.HWND, ctypes.POINTER(Rect)]
user32.ClientToScreen.argtypes = [win.HWND, ctypes.POINTER(Point)]
user32.SetWindowPos.argtypes = [win.HWND, win.HWND, ctypes.c_int, ctypes.c_int,
                               ctypes.c_int, ctypes.c_int, win.UINT]
kernel32.OpenProcess.argtypes = [win.DWORD, win.BOOL, win.DWORD]
kernel32.OpenProcess.restype = win.HANDLE
kernel32.QueryFullProcessImageNameW.argtypes = [win.HANDLE, win.DWORD, win.LPWSTR, ctypes.POINTER(win.DWORD)]
kernel32.CloseHandle.argtypes = [win.HANDLE]

def class_name(handle: int) -> str:
    name = ctypes.create_unicode_buffer(128)
    user32.GetClassNameW(handle, name, len(name))
    return name.value

def process_image(pid: int) -> str:
    handle = kernel32.OpenProcess(0x1000, False, pid)
    if not handle:
        return ""
    try:
        value = ctypes.create_unicode_buffer(1024)
        length = win.DWORD(len(value))
        return value.value if kernel32.QueryFullProcessImageNameW(handle, 0, value, ctypes.byref(length)) else ""
    finally:
        kernel32.CloseHandle(handle)

def find_main(pid: int) -> tuple[int, int]:
    candidates = []
    def find_parent(hwnd, _):
        process = win.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(process))
        if process.value == pid and class_name(hwnd) == "Tauri Window":
            children = []
            def child(wh, _):
                if class_name(wh) == "WRY_WEBVIEW":
                    children.append(int(wh))
                return True
            user32.EnumChildWindows(hwnd, EnumProc(child), 0)
            if children:
                candidates.append((int(hwnd), children[0]))
        return True
    user32.EnumWindows(EnumProc(find_parent), 0)
    if not candidates:
        raise RuntimeError("No Tauri Window containing WRY_WEBVIEW for this PID")
    return max(candidates, key=lambda pair: width(pair[0]))  # Main is wider than Pet

def rect(handle: int, client: bool = False) -> Rect:
    result = Rect()
    getter = user32.GetClientRect if client else user32.GetWindowRect
    if not getter(handle, ctypes.byref(result)):
        raise ctypes.WinError(ctypes.get_last_error())
    return result

def width(handle: int) -> int:
    r = rect(handle)
    return r.right - r.left

def alignment(parent: int, webview: int) -> tuple[int, int, int, int] | None:
    if user32.IsIconic(parent):
        return None
    region = rect(parent, client=True)
    web = rect(webview)
    origin = Point()
    if not user32.ClientToScreen(parent, ctypes.byref(origin)):
        return None
    expected_right = origin.x + region.right
    expected_bottom = origin.y + region.bottom
    return (web.left - origin.x, web.top - origin.y,
            expected_right - web.right, expected_bottom - web.bottom)

def guarded_alignment(parent: int, webview: int) -> tuple[tuple[int, int, int, int] | None, bool]:
    """Return stable host/client comparison, rejecting cross-resize sample races.

    The two host reads bracket the child HWND query. If a host size/move
    arrives between the reads, the apparent child gap is not conclusive.
    """
    if user32.IsIconic(parent):
        return None, False

    host_before = rect(parent, client=True)
    pos_before = Point()
    user32.ClientToScreen(parent, ctypes.byref(pos_before))
    web = rect(webview)
    host_after = rect(parent, client=True)
    pos_after = Point()
    user32.ClientToScreen(parent, ctypes.byref(pos_after))
    if (host_before.right != host_after.right or host_before.bottom != host_after.bottom
            or pos_before.x != pos_after.x or pos_before.y != pos_after.y):
        return None, True

    return (
        (web.left - pos_before.x, web.top - pos_before.y,
         pos_before.x + host_before.right - web.right,
         pos_before.y + host_before.bottom - web.bottom),
        False,
    )


def window_threads(parent: int, webview: int) -> tuple[int, int]:
    host_process, child_process = win.DWORD(), win.DWORD()
    host_thread = user32.GetWindowThreadProcessId(parent, ctypes.byref(host_process))
    child_thread = user32.GetWindowThreadProcessId(webview, ctypes.byref(child_process))
    return host_thread, child_thread


def capture(parent: int, webview: int, seconds: float, samples: list, stop: threading.Event) -> None:
    until = time.monotonic() + seconds
    while time.monotonic() < until and not stop.is_set():
        sample = alignment(parent, webview)
        if sample is not None:
            samples.append((time.monotonic(), sample))
        time.sleep(0.008)

def sweep(parent: int) -> None:
    start = rect(parent)
    x, y = start.left, start.top
    original_w, original_h = start.right - x, start.bottom - y
    flags = 0x0004 | 0x0010  # SWP_NOZORDER | SWP_NOACTIVATE
    try:
        for _ in range(3):
            for step in list(range(1, 34)) + list(range(33, -1, -1)):
                user32.SetWindowPos(parent, 0, x, y,
                                    original_w + step * 6, original_h + step * 3, flags)
                time.sleep(0.014)
    finally:
        user32.SetWindowPos(parent, 0, x, y, original_w, original_h, flags)

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--seconds", type=float, default=8.0)
    parser.add_argument("--sweep", action="store_true")
    args = parser.parse_args()
    image = process_image(args.pid).lower()
    if "flexikit" not in image:
        raise RuntimeError("Target process is not FlexiKit")
    if args.sweep and not image.endswith("flexikit-resize-test.exe"):
        raise RuntimeError("Synthetic sweep is permitted only in isolated resize-test")
    parent, webview = find_main(args.pid)
    if user32.IsIconic(parent):
        raise RuntimeError("Main window is minimized: restore it before measuring")
    readings = []
    stop = threading.Event()
    reader = threading.Thread(target=capture, args=(parent, webview, args.seconds, readings, stop))
    reader.start()
    try:
        if args.sweep:
            sweep(parent)
        reader.join()
    finally:
        stop.set()
        reader.join()
    gaps = [sample for _, sample in readings]
    diffs = [max(abs(d) for d in sample) for sample in gaps]
    transitions = sum(a != b for a, b in zip(gaps, gaps[1:]))
    print(f"pid={args.pid} parent={parent} webview={webview} samples={len(readings)} changes={transitions}")
    if diffs:
        print(f"max_absolute_gap_px={max(diffs)} mismatch_2px_samples={sum(d >= 2 for d in diffs)}")
        print(f"peak_offsets_left_top_right_bottom={tuple(max(abs(g[i]) for g in gaps) for i in range(4))}")
        print(f"median_absolute_gap_px={statistics.median(diffs)}")
    print("NOTE: geometry measurements do not prove GPU paint/composition synchrony.")

if __name__ == "__main__":
    main()
