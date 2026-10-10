"""Stage 6 opt-in DOM-render latency on an isolated Tauri/WebView2 host.

Only runs flexikit-resize-test.exe (own app identity). It does NOT load the
user's main Desktop profile, Canvas window, Pet, credentials, or document paths.
Measures hash-router library/dashboard rendering completion across 20+ cycles.
Does not claim physical pointer-to-pixel, GPU/DWM present timing, or production UX.
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import socket
import statistics
import subprocess
import sys
import time
from urllib.request import urlopen

import psutil
from websockets.sync.client import connect

EXE=pathlib.Path(r"D:\AI_Cache\flexikit-resize-isolated\debug\flexikit-resize-test.exe")

def percentile(data: list[float], point: int) -> float:
    sorted_data=sorted(data)
    x=(len(sorted_data)-1)*point/100
    lo=int(x)
    hi=min(lo+1,len(sorted_data)-1)
    return sorted_data[lo]+(sorted_data[hi]-sorted_data[lo])*(x-lo)

def wait_cdp(port: int, deadline_s=15):
    end=time.monotonic()+deadline_s
    while time.monotonic()<end:
        try:
            with urlopen(f"http://127.0.0.1:{port}/json/list", timeout=.4) as response:
                targets=json.loads(response.read())
            for target in targets:
                if target.get("type")=="page" and str(target.get("url","")).startswith("http://tauri.localhost"):
                    return connect(target["webSocketDebuggerUrl"],open_timeout=3,max_size=2_000_000)
        except (OSError,ValueError,TimeoutError):
            pass
        time.sleep(.14)
    raise RuntimeError("Isolated WebView2 CDP target missing")

def evaluate(ws,index:int,expression:str):
    ws.send(json.dumps({"id":index,"method":"Runtime.evaluate",
                        "params":{"expression":expression,"returnByValue":True,"awaitPromise":True}}))
    while True:
        msg=json.loads(ws.recv(timeout=12))
        if msg.get("id")==index:
            if msg.get("error"):
                raise RuntimeError("Isolated CDP evaluation failed")
            output=msg.get("result",{}).get("result",{})
            if output.get("subtype")=="error":
                raise RuntimeError("Isolated front-end rejected the navigation")
            if output.get("type")!="string":
                raise RuntimeError("Isolated probe did not return JSON string")
            return json.loads(output["value"])

def wait_render_expr(library:bool)->str:
    route="#/app?view=library" if library else "#/app"
    selector=".workspace-content" if library else ".workspace-dashboard"
    return """(async()=>{const route=%s,selector=%s,t0=performance.now();
        if(location.hash!==route) location.hash=route;
        return await new Promise(resolve=>{
          let settled=false;
          const abort=setTimeout(()=>{if(!settled){settled=true;resolve(JSON.stringify({ok:false,reason:'timeout'}))}},4500);
          const frame=()=>{if(settled)return;
            const el=document.querySelector(selector);
            if(location.hash===route&&el&&el.getBoundingClientRect().width>10){
              requestAnimationFrame(()=>requestAnimationFrame(()=>{
                if(settled)return;
                settled=true;clearTimeout(abort);
                resolve(JSON.stringify({ok:true,elapsed_ms:performance.now()-t0}));
              }));
            }else requestAnimationFrame(frame);
          };requestAnimationFrame(frame);
        });
       })()"""%(json.dumps(route),json.dumps(selector))

def run(count:int):
    if not EXE.is_file() or EXE.name!="flexikit-resize-test.exe":
        raise RuntimeError("Missing isolated test executable")
    if any((x.info.get("name") or "").lower()=="flexikit-resize-test.exe"
           for x in psutil.process_iter(["name"])):
        raise RuntimeError("An isolated test process exists: refusing to alter its app state")
    with socket.socket() as probe:
        probe.bind(("127.0.0.1",0))
        port=probe.getsockname()[1]
    env=os.environ.copy()
    env["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"]=f"--remote-debugging-port={port}"
    env["FLEXIKIT_RESIZE_TEST_FRAME"]="standard"
    env["FLEXIKIT_RESIZE_TRANSPARENT"]="0"
    proc=subprocess.Popen([str(EXE),"--fk-resize-standard"],cwd=EXE.parent,
                          env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    ws=None
    results={"dashboard":[],"library":[]}
    try:
        ws=wait_cdp(port)
        initial=evaluate(ws,1,wait_render_expr(False))
        if not initial.get("ok"):
            raise RuntimeError("Initial isolated dashboard not ready")
        for i in range(count):
            for side in ("library","dashboard"):
                result=evaluate(ws,20+i*2+(side=="dashboard"),wait_render_expr(side=="library"))
                if not result.get("ok"):
                    raise RuntimeError(f"Isolated DOM transition timed out ({side})")
                results[side].append(result["elapsed_ms"])
        return {
            "result":"PASS","isolatedHostOnly":True,"iterations":count,
            "paintCommittedDomAfterTwoRafs":True,
            "metrics":{side:{"count":len(samples),
                 "p50_ms":round(percentile(samples,50),2),
                 "p95_ms":round(percentile(samples,95),2),
                 "max_ms":round(max(samples),2)} for side,samples in results.items()},
            "limitations":"Hash navigation to Vue rendered DOM + 2 animation frames, not physical click latency or DWM visibility; no Canvas or Pet",
        }
    finally:
        if ws:
            try:ws.close()
            except Exception:pass
        proc.terminate()
        try:proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill();proc.wait(timeout=5)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--iterations",type=int,default=20)
    args=parser.parse_args()
    if not 10<=args.iterations<=60:
        raise ValueError("Iteration count must be between 10 and 60")
    print(json.dumps(run(args.iterations),ensure_ascii=False))

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print(json.dumps({"result":"FAILED","errorType":type(exc).__name__,
             "reason":str(exc)[:170]}),file=sys.stderr)
        sys.exit(1)
