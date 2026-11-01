"""Local, dependency-free library server; reference videos remain in their original folder."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse, json, mimetypes, re

ROOT = Path(__file__).resolve().parent
IDS = {'car-ignition','ai-draw','shuffle','transmission','aesthetic','mofs','camera','rotary-cutaway'}

def discover():
    config=ROOT/'local-config.json'
    if config.is_file():
        try:
            p=Path(json.loads(config.read_text('utf-8-sig')).get('referenceRoot',''))
            if p.is_dir() and (p/'car-ignition/download.json').is_file(): return p
        except (ValueError,OSError): pass
    for ancestor in ROOT.parents:
        p = ancestor/'video_project/pid_embodied_control/work/v02/references'
        if p.is_dir(): return p
    return None

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def translate_path(self,path):
        clean=unquote(urlsplit(path).path)
        if clean=='/': return str(ROOT/'lab/index.html')
        return super().translate_path(path)
    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        self.send_header('X-Content-Type-Options','nosniff')
        super().end_headers()
    def do_HEAD(self): self.handle_request(False)
    def do_GET(self): self.handle_request(True)
    def handle_request(self,body):
        clean=unquote(urlsplit(self.path).path)
        if clean=='/health':
            data=json.dumps({'app':'rainbow-motion-atelier','root':str(ROOT),'referencesAvailable':bool(self.server.reference_root)},ensure_ascii=False).encode('utf-8')
            self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers()
            if body:self.wfile.write(data)
            return
        if clean=='/':
            self.send_response(302);self.send_header('Location','/lab/');self.end_headers();return
        if clean=='/favicon.ico':
            self.send_response(204);self.end_headers();return
        match=re.fullmatch(r'/reference-media/([a-z-]+)/(video|audio)',clean)
        if match:
            key,kind=match.groups()
            base=self.server.reference_root
            if key not in IDS or not base: return self.send_error(404,'Local research media unavailable')
            try:
                info=json.loads((base/key/'download.json').read_text('utf-8-sig'))
                entry=next(e for e in info if any(s['codec_type']==kind for s in e['probe']['streams']))
                path=base/key/f"media-{entry['index']:02d}.mp4"
            except (OSError,ValueError,KeyError,StopIteration): return self.send_error(404)
        else:
            path=Path(self.translate_path(self.path)).resolve()
            if ROOT!=path and ROOT not in path.parents: return self.send_error(403)
            if path.is_dir(): path=path/'index.html'
        if not path.is_file(): return self.send_error(404)
        size=path.stat().st_size;start=0;end=size-1;partial=False
        requested=self.headers.get('Range')
        if requested:
            m=re.fullmatch(r'bytes=(\d*)-(\d*)',requested)
            if not m or not any(m.groups()): return self.send_error(416)
            first,last=m.groups()
            if first: start=int(first);end=min(end,int(last)) if last else end
            else: start=max(0,size-int(last))
            if start>end or start>=size:
                self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return
            partial=True
        mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        if path.suffix in ('.js','.mjs'):mime='text/javascript'
        if path.suffix=='.md':mime='text/plain; charset=utf-8'
        self.send_response(206 if partial else 200)
        self.send_header('Content-Type',mime);self.send_header('Accept-Ranges','bytes')
        self.send_header('Content-Length',str(end-start+1))
        if partial:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.end_headers()
        if body:
            try:
                with path.open('rb') as f:
                    f.seek(start);left=end-start+1
                    while left:
                        block=f.read(min(65536,left))
                        if not block:break
                        self.wfile.write(block);left-=len(block)
            except (ConnectionResetError,ConnectionAbortedError,BrokenPipeError):pass
    def log_message(self,*args):pass

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8850);p.add_argument('--references',type=Path)
    args=p.parse_args();server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    server.reference_root=args.references or discover()
    print(f'Motion Atelier: http://127.0.0.1:{args.port}/',flush=True)
    server.serve_forever()
