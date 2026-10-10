"""Isolated native-frame vs custom-frame WebView2 resizing A/B.

Four variants: standard/custom Windows frame x full/minimal DOM.
Synthetic SetWindowPos is a controlled diagnostic, NOT human mouse drag.
Measures HWND/client/WRY geometry, rAF viewport changes, and screen pixels
from an artificial solid-color page (memory-only); no user document capture.
Requires the opt-in resize-test EXE; never touches the production process.
"""
from __future__ import annotations

import argparse
import ctypes
import json
import os
import pathlib
import statistics
import subprocess
import sys
import threading
import time

import importlib.util
from ctypes import wintypes as w

SRC = pathlib.Path(__file__).parent
def module(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, SRC / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError("Missing isolated diagnostic dependency")
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj

geom = module("windows-resize-diagnostics.py", "fk_native_geom_ab")
cdp = module("windows-resize-default-smoke.py", "fk_default_cdp_ab")
u = geom.user32
exe = pathlib.Path(r"D:\AI_Cache\flexikit-resize-isolated\debug\flexikit-resize-test.exe")

u.GetWindowLongPtrW = getattr(u, "GetWindowLongPtrW")
u.GetWindowLongPtrW.argtypes = [w.HWND, ctypes.c_int]
u.GetWindowLongPtrW.restype = ctypes.c_ssize_t

COL = (165, 91, 141)
SET_FLAGS = 0x0004 | 0x0010  # NOZORDER | NOACTIVATE

JS_START = """JSON.stringify((()=>{
 const timeline={frames:0, changes:[], maxRafGapMs:0, prev:0, w:innerWidth,h:innerHeight};
 window.__fkABTimeline=timeline;
 const loop=(stamp)=>{
  const p=window.__fkABTimeline;if(!p)return;
  p.frames++;
  if(p.prev)p.maxRafGapMs=Math.max(p.maxRafGapMs,stamp-p.prev);
  p.prev=stamp;
  if(innerWidth!==p.w||innerHeight!==p.h){
   p.changes.push([Math.round(performance.timeOrigin+stamp),innerWidth,innerHeight]);
   p.w=innerWidth;p.h=innerHeight;
  }
  requestAnimationFrame(loop);
 };
 requestAnimationFrame(loop);
 return true;
})())"""

JS_MINIMAL = """JSON.stringify((()=>{
 document.body.replaceChildren();
 const s=document.createElement('style');
 s.textContent='html,body{margin:0!important;padding:0!important;overflow:hidden!important;transition:none!important;background:rgb(165,91,141)!important}';
 document.head.append(s);
 const marker=document.createElement('main');
 marker.id='fk-synthetic-solid-surface';
 marker.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;background:rgb(165,91,141);z-index:2147483647;pointer-events:none;transition:none;animation:none';
 document.body.append(marker);
 return {marker:!!document.querySelector('#fk-synthetic-solid-surface')};
})())"""

JS_END = """JSON.stringify((()=>{
 const t=window.__fkABTimeline||{};
 const m=document.querySelector('#fk-synthetic-solid-surface');
 return {frames:t.frames||0,changes:t.changes||[],maxRafGapMs:t.maxRafGapMs||0,
  marker:!!m,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,
  scrollBoxRight:document.querySelector('.app-window-content')?.getBoundingClientRect().right||null};
})())"""

def wait_main(pid: int, deadline_s: float = 14) -> tuple[int, int]:
    deadline=time.monotonic()+deadline_s
    while time.monotonic()<deadline:
        try:
            hwnd,web=geom.find_main(pid)
            if u.IsWindowVisible(hwnd):
                return hwnd,web
        except RuntimeError:
            pass
        time.sleep(.16)
    raise RuntimeError("No isolated main window")

def screen_probe(hwnd: int, web: int) -> str:
    """Try one all-in-memory screenshot of the solid rectangle's right edge."""
    from PIL import ImageGrab
    outer_before=geom.rect(hwnd)
    child_before=geom.rect(web)
    x0=child_before.right-40
    y0=child_before.top+(child_before.bottom-child_before.top)//2-8
    if x0<0 or y0<0 or child_before.right>u.GetSystemMetrics(0):
        return "offscreen"
    img=ImageGrab.grab(bbox=(x0,y0,child_before.right,y0+16))
    child_after=geom.rect(web)
    outer_after=geom.rect(hwnd)
    coords=lambda r:(r.left,r.top,r.right,r.bottom)
    if coords(child_before)!=coords(child_after) or coords(outer_before)!=coords(outer_after):
        return "resize_race"
    try:
        interior=img.getpixel((17,8))[:3]
        edge=img.getpixel((37,8))[:3]
        match=lambda color: max(abs(a-b) for a,b in zip(color,COL))<=30
        if not match(interior):
            return "not_visible_or_occluded"
        if not match(edge):
            return "screen_edge_color_mismatch"
        return "edge_color_matches"
    finally:
        img.close()

def once(frame: str, page: str, steps: int) -> dict:
    if frame not in ("standard","custom") or page not in ("full","minimal"):
        raise ValueError("Invalid isolated A/B variant")
    if not exe.is_file() or exe.name!="flexikit-resize-test.exe":
        raise RuntimeError("Isolated resize-test binary missing")
    env=os.environ.copy()
    env["FLEXIKIT_RESIZE_TEST_FRAME"]=frame
    env["FLEXIKIT_RESIZE_TRANSPARENT"]="0"
    env["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"]=f"--remote-debugging-port={cdp.port}"
    old_fg=u.GetForegroundWindow()
    proc=subprocess.Popen([str(exe)],cwd=exe.parent,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    hwnd=0
    ws=None
    stop=threading.Event()
    samples=[]
    sample_changed=0
    try:
        hwnd,web=wait_main(proc.pid)
        ws=cdp.connect_to_cdp()
        time.sleep(.28)
        style=u.GetWindowLongPtrW(hwnd,-16)
        has_caption=(style & 0x00C00000)!=0
        if has_caption!=(frame=="standard"):
            raise RuntimeError("Isolated frame switch did not take effect")
        rect=geom.rect(hwnd)
        u.SetWindowPos(hwnd,-1,48,38,1100,690,SET_FLAGS)
        time.sleep(.3)
        if page=="minimal":
            ok=cdp.eval_js(ws,JS_MINIMAL,2)
            if not ok or not ok["marker"]:
                raise RuntimeError("Minimal solid page installation failed")
        cdp.eval_js(ws,JS_START,3)
        time.sleep(.12)
        client=geom.rect(hwnd,client=True)
        start=geom.rect(hwnd)
        thread_same=geom.window_threads(hwnd,web)[0]==geom.window_threads(hwnd,web)[1]
        changes=[]
        post=[]
        counts={}
        def capture() -> None:
            nonlocal sample_changed
            while not stop.is_set():
                a,changed=geom.guarded_alignment(hwnd,web)
                if changed:sample_changed+=1
                if a is not None:samples.append(max(map(abs,a)))
                time.sleep(.008)
        observer=threading.Thread(target=capture,daemon=True)
        observer.start()
        try:
            # Continuous and reversible; do NOT move/click a human cursor.
            for i in range(steps):
                angle=i%64
                factor=angle if angle<=32 else (64-angle)
                ww=1100+factor*6
                hh=690+factor*3
                t0=time.time()*1000
                if not u.SetWindowPos(hwnd,-1,48,38,ww,hh,SET_FLAGS):
                    raise RuntimeError("Test SetWindowPos failed")
                t1=time.time()*1000
                o,changed=geom.guarded_alignment(hwnd,web)
                if o is not None and not changed:post.append(max(map(abs,o)))
                changes.append([round(t0),ww,hh,round(t1-t0,3)])
                if page=="minimal" and i%5==0:
                    kind=screen_probe(hwnd,web)
                    counts[kind]=counts.get(kind,0)+1
                time.sleep(.012)
        finally:
            stop.set()
            observer.join(timeout=3)
        time.sleep(.25)
        dom=cdp.eval_js(ws,JS_END,4)
        change_widths=dom["changes"]
        return {
            "frame":frame,"page":page,"pid":proc.pid,
            "nativeStyleCaption":has_caption,"sameWin32UiThread":thread_same,
            "outerAtRest":[start.right-start.left,start.bottom-start.top],
            "clientAtRest":[client.right,client.bottom],
            "resizeSteps":len(changes),"setWindowPosMsMedian":round(statistics.median(row[3] for row in changes),3),
            "setWindowPosMsMax":round(max(row[3] for row in changes),3),
            "sameThreadConcurrentGeometrySamples":len(samples),
            "concurrentMisalignmentGe2":sum(v>=2 for v in samples),
            "concurrentMaxGapPx":max(samples) if samples else None,
            "sampleRaceDiscarded":sample_changed,
            "postResizeSamples":len(post),"postResizeGe2":sum(v>=2 for v in post),
            "postResizeMaxGapPx":max(post) if post else None,
            "domRafFrames":dom["frames"],"domViewportChanges":len(change_widths),
            "domRafMaxGapMs":round(dom["maxRafGapMs"],2),
            "pixelProbe":counts if page=="minimal" else "not_captured_full_page",
            "pixelCaveat":"in-memory screenshot after each fifth synthetic resize; only when host and child rectangles stable",
            "state":"synthetic SetWindowPos only; no human continuous drag, no DWM present timestamp",
        }
    finally:
        stop.set()
        if ws:
            try:ws.close()
            except Exception:pass
        # Terminate only the isolated test process. Never touch user's app.
        proc.terminate()
        try:proc.wait(timeout=7)
        except subprocess.TimeoutExpired:
            proc.kill();proc.wait(timeout=5)
        if old_fg and u.IsWindow(old_fg):
            u.SetForegroundWindow(old_fg)

def main() -> int:
    a=argparse.ArgumentParser()
    a.add_argument("--steps",type=int,default=130)
    a.add_argument("--frame",choices=["standard","custom","both"],default="both")
    a.add_argument("--page",choices=["full","minimal","both"],default="both")
    args=a.parse_args()
    if args.steps<24 or args.steps>400:raise ValueError("Expected 24..400 synthetic steps")
    modes=["standard","custom"] if args.frame=="both" else [args.frame]
    pages=["full","minimal"] if args.page=="both" else [args.page]
    results=[]
    for page in pages:
        for frame in modes:
            result=once(frame,page,args.steps)
            results.append(result)
            print(json.dumps(result,ensure_ascii=False),flush=True)
    print(json.dumps({"variants":len(results),"prodProcessTouched":False,
        "interpretation":"A/B diagnostic only; observed geometry and screen pixels do not replace user physical drag acceptance."}),flush=True)
    return 0

if __name__=="__main__":
    try:sys.exit(main())
    except Exception as error:
        print(json.dumps({"diagnosticFailed":type(error).__name__,"message":str(error)[:240]}),file=sys.stderr)
        sys.exit(1)
