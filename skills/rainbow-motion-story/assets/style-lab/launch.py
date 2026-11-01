"""Open this library; reuse only its own running server, never stop another app."""
from pathlib import Path
import argparse, json, subprocess, sys, time, urllib.request, webbrowser, socket
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--no-browser',action='store_true');args=parser.parse_args()
def show(port):
    url=f'http://127.0.0.1:{port}/lab/'
    if not args.no_browser:webbrowser.open(url)
    print(json.dumps({'url':url,'root':str(ROOT)},ensure_ascii=False))
def health(port):
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/health',timeout=.4) as response:return json.load(response)
    except (OSError,ValueError):return None
for port in range(8850,8871):
    info=health(port)
    if info and info.get('app')=='rainbow-motion-atelier' and Path(info.get('root','')).resolve()==ROOT:
        show(port);sys.exit(0)
    with socket.socket() as sock:
        try:sock.bind(('127.0.0.1',port))
        except OSError:continue
    flags=getattr(subprocess,'CREATE_NO_WINDOW',0)
    child=subprocess.Popen([sys.executable,str(ROOT/'serve.py'),'--port',str(port)],cwd=ROOT,creationflags=flags,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for _ in range(50):
        time.sleep(.1);info=health(port)
        if info and info.get('app')=='rainbow-motion-atelier' and Path(info.get('root','')).resolve()==ROOT:
            show(port);sys.exit(0)
        if child.poll() is not None:break
    raise RuntimeError('Library server could not start; run python serve.py to inspect.')
raise RuntimeError('Ports 8850-8870 occupied. Use python serve.py --port PORT.')
