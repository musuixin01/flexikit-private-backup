"""Default-opaque FlexiKit / WebView2 window smoke test.

Runs *only* the isolated flexikit-resize-test.exe and verifies its DOM via
local Chrome DevTools protocol. This deliberately tests window geometry,
resize-handle hit regions, viewport and scroll behavior, native hit testing,
maximization and continuous synthetic resizing. It does not prove DWM frame
presentation or real user mouse dragging. No screenshots or private page text
are saved. The production app, user data and system GPU settings are untouched.
"""
from __future__ import annotations

import ctypes
import importlib.util
import json
import os
import pathlib
import socket
import subprocess
import sys
import time
from ctypes import wintypes as w
from urllib.request import urlopen

import psutil
from websockets.sync.client import connect

source = pathlib.Path(__file__).with_name("windows-resize-diagnostics.py")
spec = importlib.util.spec_from_file_location("flexikit_geom", source)
if spec is None or spec.loader is None:
    raise RuntimeError("Resize geometry helper unavailable")
geom = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geom)
u = geom.user32

exe = pathlib.Path(r"D:\AI_Cache\flexikit-resize-isolated\debug\flexikit-resize-test.exe")
if not exe.is_file() or exe.name != "flexikit-resize-test.exe":
    raise RuntimeError("Isolated diagnostic binary not found")
port = 9238
with socket.socket() as probe:
    try:
        probe.bind(("127.0.0.1", port))
    except OSError as error:
        raise RuntimeError("Local CDP test port is busy") from error

u.GetDpiForWindow.argtypes = [w.HWND]
u.GetDpiForWindow.restype = w.UINT
u.SendMessageTimeoutW.argtypes = [w.HWND, w.UINT, w.WPARAM, w.LPARAM, w.UINT, w.UINT, ctypes.POINTER(ctypes.c_size_t)]
u.SendMessageTimeoutW.restype = ctypes.c_size_t
u.ShowWindow.argtypes = [w.HWND, ctypes.c_int]
u.SetForegroundWindow.argtypes = [w.HWND]
u.GetForegroundWindow.restype = w.HWND
u.GetCursorPos.argtypes = [ctypes.POINTER(geom.Point)]
u.SetCursorPos.argtypes = [ctypes.c_int, ctypes.c_int]

def dimensions(hwnd: int) -> tuple[int, int]:
    r = geom.rect(hwnd)
    return r.right - r.left, r.bottom - r.top

def native_hit(hwnd: int, sx: int, sy: int) -> int | None:
    packed = ((sy & 65535) << 16) | (sx & 65535)
    result = ctypes.c_size_t()
    value = u.SendMessageTimeoutW(hwnd, 0x0084, 0, packed, 0x0002, 300, ctypes.byref(result))
    return int(result.value) if value else None

def viewport_probe() -> str:
    return """JSON.stringify((()=>{
       const vw=innerWidth,vh=innerHeight,d=document.documentElement;
       const content=document.querySelector('.app-window-content');
       const hit=(x,y)=>document.elementFromPoint(x,y)?.closest('.native-resize-handle')?.className||'';
       const c=content?.getBoundingClientRect();
       return {dpr:devicePixelRatio,screen:[vw,vh],docClient:[d.clientWidth,d.clientHeight],
         scrollDoc:[d.scrollWidth,d.scrollHeight],
         contentRect:c?[c.left,c.top,c.width,c.height]:null,
         contentScroll:content?[content.scrollWidth,content.clientWidth,content.scrollHeight,content.clientHeight]:null,
         edges:{east:hit(vw-3,vh/2),south:hit(vw/2,vh-3),
          southeast:hit(vw-3,vh-3),west:hit(3,vh/2),
          north:hit(vw/2,3),northwest:hit(3,3),northeast:hit(vw-3,3),southwest:hit(3,vh-3)},
         rootScrollEnabled:getComputedStyle(d).overflowY!=='hidden',
         contentScrollable:content?getComputedStyle(content).overflowY==='auto':false,
         overlays:[...document.querySelectorAll('.native-resize-handle')].length,
         probeFrames:window.__fkProbe||null
       };
    })())"""

def connect_to_cdp(timeout_s: float = 12.0):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            with urlopen(f"http://127.0.0.1:{port}/json/list", timeout=1.5) as stream:
                targets = json.loads(stream.read())
            pages = [t for t in targets if t.get("type") == "page" and t.get("url", "").startswith("http://tauri.localhost")]
            if pages:
                return connect(pages[0]["webSocketDebuggerUrl"], open_timeout=3, max_size=3_000_000)
        except (OSError, ValueError, TimeoutError):
            pass
        time.sleep(.2)
    raise RuntimeError("No isolated WebView2 Chrome DevTools page available")

def eval_js(ws, expression: str, index: int) -> object:
    payload = {"id":index, "method":"Runtime.evaluate",
        "params":{"expression":expression,"returnByValue":True,"awaitPromise":False}}
    ws.send(json.dumps(payload))
    while True:
        response=json.loads(ws.recv(timeout=8))
        if response.get("id") == index:
            if response.get("error"):
                raise RuntimeError("CDP rejected isolated probe")
            result=response.get("result",{}).get("result",{})
            if result.get("type") == "string":
                return json.loads(result.get("value","{}"))
            return result.get("value")

def rect_snap(parent: int, web: int) -> dict:
    wr=geom.rect(parent);client=geom.rect(parent,client=True)
    offset,changed=geom.guarded_alignment(parent,web)
    return {"outer":[wr.right-wr.left,wr.bottom-wr.top],
        "client":[client.right,client.bottom],"web":list(dimensions(web)),
        "offsets":list(offset) if offset is not None else None,
        "sampleChanged":changed}

def test() -> dict:
    env=os.environ.copy()
    env.pop("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",None)
    env["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"]=f"--remote-debugging-port={port}"
    env["FLEXIKIT_RESIZE_TRANSPARENT"]="0"
    prev_foreground=u.GetForegroundWindow()
    prev_cursor=geom.Point();u.GetCursorPos(ctypes.byref(prev_cursor))
    proc=subprocess.Popen([str(exe)],cwd=exe.parent,env=env,
                          stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    ws=None;parent=None;original=None
    result={"mode":"Default (opaque)","binary":"isolated resize-test","pid":proc.pid,
            "cases":[],"failures":[]}
    try:
        deadline=time.monotonic()+13
        while time.monotonic()<deadline:
            try:parent,web=geom.find_main(proc.pid);break
            except RuntimeError:time.sleep(.2)
        if parent is None:raise RuntimeError("Isolated main HWND not found")
        original=geom.rect(parent)
        # The WebView child may appear before native frame subclassing completes.
        time.sleep(.65)
        result["dpi"]=u.GetDpiForWindow(parent)
        result["sameThread"]=geom.window_threads(parent,web)[0]==geom.window_threads(parent,web)[1]
        ws=connect_to_cdp()
        procinfo=psutil.Process(proc.pid)
        browsers=[p for p in procinfo.children(recursive=True) if p.name().lower()=="msedgewebview2.exe"]
        result["webviewProcesses"]=len(browsers)
        result["defaultRenderFlags"]=not any(
            "--disable-direct-composition" in arg or "--disable-gpu-compositing" in arg
            for child in browsers for arg in child.cmdline())
        u.SetWindowPos(parent,-1,55,50,1130,720,0x0010)
        time.sleep(.5)
        eval_js(ws,"""(function(){
           window.__fkProbe={frames:0,widthChanges:0,handleMissing:0,maxEdgeGap:0,lastWidth:innerWidth};
           function frame(){let p=window.__fkProbe;if(!p)return;
             p.frames++;if(innerWidth!==p.lastWidth)p.widthChanges++;p.lastWidth=innerWidth;
             let e=document.querySelector('.native-resize-east'),c=document.querySelector('.native-resize-southeast');
             if(!e||!c){p.handleMissing++;}else{
               const diff=Math.max(Math.abs(e.getBoundingClientRect().right-innerWidth),
                Math.abs(c.getBoundingClientRect().right-innerWidth));
               p.maxEdgeGap=Math.max(p.maxEdgeGap,diff);
             }requestAnimationFrame(frame);}requestAnimationFrame(frame);return JSON.stringify(true);
        })()""",1)
        case_sizes=[(1020,680),(1180,720),(1280,790),(1430,780),(1130,720)]
        for idx,(width,height) in enumerate(case_sizes):
            success=u.SetWindowPos(parent,-1,55,50,width,height,0x0010)
            if not success:result["failures"].append(f"set_size_{idx}");continue
            time.sleep(.16)
            native=rect_snap(parent,web)
            dom=eval_js(ws,viewport_probe(),idx+2)
            rootAligned=dom["docClient"][0] == dom["screen"][0]
            # A full-width scroll box is critical: the earlier 8px outer gutter
            # was invisible to HWND alignment checks yet visibly detached UI.
            contentRight = dom["contentRect"][0] + dom["contentRect"][2] if dom["contentRect"] else -1
            fullBleed = abs(contentRight-dom["screen"][0]) <= 1.25
            expected={
                "east":"native-resize-east","south":"native-resize-south",
                "southeast":"native-resize-southeast","west":"native-resize-west",
                "north":"native-resize-north","northwest":"native-resize-northwest",
                "northeast":"native-resize-northeast","southwest":"native-resize-southwest",
            }
            edges={k:v in str(dom.get("edges",{}).get(k,"")) for k,v in expected.items()}
            wr=geom.rect(parent)
            points={"right":(wr.right-3,wr.top+(wr.bottom-wr.top)//2),
                "bottom":(wr.left+(wr.right-wr.left)//2,wr.bottom-3),
                "corner":(wr.right-3,wr.bottom-3),"center":(wr.left+width//2,wr.top+height//2)}
            hit={n:native_hit(parent,*point) for n,point in points.items()}
            outer_client_gap=[native["outer"][i]-native["client"][i] for i in range(2)]
            client_web_gap=[native["client"][i]-native["web"][i] for i in range(2)]
            # Windows 125% scaling sometimes retains a stable 1-physical-pixel
            # residual at the bottom. Report it; do not confuse it with the
            # transient 6px gap or an image-compositor glitch.
            aligned=(native["offsets"] is not None
                     and max(map(abs,outer_client_gap+client_web_gap+native["offsets"]))<=1)
            native_hit_ok=hit=={"right":11,"bottom":15,"corner":17,"center":1}
            scroll_probe=eval_js(ws, """JSON.stringify((()=>{
               const e=document.querySelector('.app-window-content');
               if(!e)return {available:false};
               const before=e.scrollTop;
               e.scrollTop=Math.min(80,Math.max(0,e.scrollHeight-e.clientHeight));
               const after=e.scrollTop;
               e.scrollTop=before;
               return {available:true,overflow:e.scrollHeight>e.clientHeight,
                 changed:after>before||e.scrollHeight<=e.clientHeight};
            })())""",idx+30)
            case={"size":f"{width}x{height}","native":native,"rootWidthAligned":rootAligned,
                "domViewport":dom["screen"],"scrollEnabled":dom["contentScrollable"],"fullBleed":fullBleed,
                "edgeHit8":sum(edges.values()),"nativeHT":hit,"nativeHitOk":native_hit_ok,
                "outerClientGap":outer_client_gap,"clientWebGap":client_web_gap,
                "viewportPhysicalDelta":[round(dom["screen"][i]-native["web"][i],2) for i in range(2)],
                "alignedWithinOnePx":aligned,"scrollProbe":scroll_probe,
                "contentWidth":dom["contentRect"][2] if dom["contentRect"] else None}
            result["cases"].append(case)
            if not rootAligned or not fullBleed or not aligned or not all(edges.values()) or not native_hit_ok or not scroll_probe["changed"]:
                result["failures"].append(f"geometry_or_dom_{width}x{height}")
        # Quickly resize three cycles. Verify in-flight deviation separately from post-return.
        post=[];invalid=0
        for _ in range(3):
            for step in list(range(1,34))+list(range(33,-1,-1)):
                u.SetWindowPos(parent,-1,55,50,1130+step*6,720+step*3,0x0010)
                sample,changed=geom.guarded_alignment(parent,web)
                if sample is not None and not changed:post.append(max(map(abs,sample)))
                else:invalid+=1
                time.sleep(.014)
        time.sleep(.35)
        result["sweep"]={"postSamples":len(post),"invalid":invalid,
                        "maxPostGapPx":max(post) if post else None,
                        "postGapGte2":sum(v>=2 for v in post)}
        result["animationProbe"]=eval_js(ws,"JSON.stringify(window.__fkProbe||null)",21)
        result["afterSweep"]=rect_snap(parent,web)
        if not post or max(post)>1:result["failures"].append("post_return_misalignment")
        # Native OS maximize/restore then compare client/WebView and DOM.
        u.ShowWindow(parent,3);time.sleep(.6)
        maxi=rect_snap(parent,web);max_dom=eval_js(ws,viewport_probe(),22)
        result["maximized"]={"native":maxi,"viewport":max_dom["screen"],
            "edgesCount":max_dom["overlays"],"dpr":max_dom["dpr"]}
        u.ShowWindow(parent,9);time.sleep(.65)
        restored=rect_snap(parent,web);restored_dom=eval_js(ws,viewport_probe(),23)
        result["restored"]={"native":restored,"viewport":restored_dom["screen"],
            "rootWidthAligned":restored_dom["docClient"][0] == restored_dom["screen"][0],
            "eastHit": "native-resize-east" in restored_dom["edges"]["east"],
            "cornerHit": "native-resize-southeast" in restored_dom["edges"]["southeast"]}
        if maxi["offsets"] is None or max(map(abs,maxi["offsets"]))>1:result["failures"].append("maximize_child_alignment")
        if restored["offsets"] is None or max(map(abs,restored["offsets"]))>1:result["failures"].append("restore_child_alignment")
        result["physicalDpiScale"] = round(result["dpi"] / 96, 3)
        result["interpretation"] = "1px static residual tolerated and reported; GPU/DWM visual tear and real pointer dragging remain untested"
        result["testPass"]=not result["failures"]
    finally:
        if ws:
            try:ws.close()
            except Exception:pass
        if parent and original:
            u.ShowWindow(parent,9)
            u.SetWindowPos(parent,-2,original.left,original.top,
              original.right-original.left,original.bottom-original.top,0x0010)
        u.SetCursorPos(prev_cursor.x,prev_cursor.y)
        if prev_foreground:u.SetForegroundWindow(prev_foreground)
        proc.terminate()
        try:proc.wait(timeout=5)
        except subprocess.TimeoutExpired:proc.kill();proc.wait(timeout=5)
    return result

if __name__=="__main__":
    try:print(json.dumps(test(),ensure_ascii=False))
    except Exception as exc:
        # Avoid logging page content/process command lines.
        print(json.dumps({"testPass":False,"errorType":type(exc).__name__,
                          "error":str(exc)[:250]},ensure_ascii=False))
        sys.exit(1)
