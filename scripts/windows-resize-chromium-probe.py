"""Capture WebView2's own compositor on resize, in isolated test mode only.

Unlike Win32 desktop screen grabs, CDP Page.captureScreenshot captures Chromium's
composited surface even when the remote Windows desktop hides the test window.
It does NOT establish what DWM displayed to the user at the same moment.

Only the artificial solid-color DOM is captured; no user content, images or
credentials are retained, saved, or transmitted.
"""
from __future__ import annotations
import argparse
import base64
import io
import json
import os
import pathlib
import statistics
import subprocess
import sys
import time

from PIL import Image
import importlib.util

HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("fk_window_ab",HERE/"windows-resize-frame-ab.py")
if spec is None or spec.loader is None:
    raise RuntimeError("Missing isolated A/B experiment module")
ab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(ab)
u=ab.u
cdp=ab.cdp
geom=ab.geom

def capture(ws, reqid: int) -> bytes:
    ws.send(json.dumps({"id":reqid,"method":"Page.captureScreenshot",
        "params":{"format":"png","captureBeyondViewport":False,"fromSurface":True}}))
    while True:
        item=json.loads(ws.recv(timeout=15))
        if item.get("id")!=reqid:
            continue
        if item.get("error"):
            raise RuntimeError("WebView2 compositor screenshot rejected")
        encoded=item.get("result",{}).get("data")
        if not encoded:
            raise RuntimeError("WebView2 did not return screenshot data")
        return base64.b64decode(encoded)

def run_variant(frame: str, count: int) -> dict:
    env=os.environ.copy()
    env["FLEXIKIT_RESIZE_TEST_FRAME"]=frame
    env["FLEXIKIT_RESIZE_TRANSPARENT"]="0"
    env["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"]=f"--remote-debugging-port={cdp.port}"
    proc=subprocess.Popen([str(ab.exe)],cwd=ab.exe.parent,env=env,
        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    ws=None
    results=[]
    try:
        parent,web=ab.wait_main(proc.pid)
        ws=cdp.connect_to_cdp()
        u.SetWindowPos(parent,-1,50,40,1090,695,ab.SET_FLAGS)
        time.sleep(.35)
        if not cdp.eval_js(ws,ab.JS_MINIMAL,11).get("marker"):
            raise RuntimeError("Synthetic page not installed")
        time.sleep(.22)
        for i in range(count):
            step=i%12
            ww=1090+step*11
            hh=695+step*6
            u.SetWindowPos(parent,-1,50,40,ww,hh,ab.SET_FLAGS)
            start=time.monotonic()
            data=capture(ws,100+i)
            duration=(time.monotonic()-start)*1000
            with Image.open(io.BytesIO(data)) as im:
                width,height=im.size
                if width<8 or height<8:
                    raise RuntimeError("Unexpected screenshot dimensions")
                edge=im.getpixel((width-3,height//2))[:3]
                center=im.getpixel((width//2,height//2))[:3]
                good=lambda pixel:max(abs(a-b) for a,b in zip(pixel,ab.COL))<=30
                matched=bool(good(edge) and good(center))
            child=geom.rect(web)
            results.append({"matched":matched,"ms":duration,
                "viewPx":(child.right-child.left,child.bottom-child.top),
                "capturePx":(width,height)})
        return {"frame":frame,"samples":len(results),
            "edgePaintMatched":sum(x["matched"] for x in results),
            "allEdgePaintMatched":all(x["matched"] for x in results),
            "medianCaptureMs":round(statistics.median(x["ms"] for x in results),2),
            "maxCaptureMs":round(max(x["ms"] for x in results),2),
            "firstViewportPx":list(results[0]["viewPx"]),
            "firstChromiumCapturePx":list(results[0]["capturePx"]),
            "captureSemantics":"WebView2 compositor, NOT Windows DWM / physical mouse drag"}
    finally:
        if ws:
            try:ws.close()
            except Exception:pass
        proc.terminate()
        try:proc.wait(timeout=7)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)

def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--captures",type=int,default=24)
    parser.add_argument("--frame",choices=("standard","custom","both"),default="both")
    args=parser.parse_args()
    if not 1<=args.captures<=100:
        raise ValueError("Use 1..100 capture probes")
    if not ab.exe.is_file() or ab.exe.name!="flexikit-resize-test.exe":
        raise RuntimeError("Only the opt-in isolated resize-test EXE is allowed")
    frames=("standard","custom") if args.frame=="both" else (args.frame,)
    for frame in frames:
        print(json.dumps(run_variant(frame,args.captures)),flush=True)

if __name__=="__main__":
    try:main()
    except Exception as err:
        print(json.dumps({"failed":type(err).__name__,"message":str(err)[:200]}),file=sys.stderr)
        sys.exit(1)
