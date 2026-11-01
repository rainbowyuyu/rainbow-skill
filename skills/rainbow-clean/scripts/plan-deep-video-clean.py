"""Plan only verified duplicate render assets and completed render chunks."""
import argparse, hashlib, json, os, re, runpy, subprocess, time
from pathlib import Path

base=runpy.run_path(str(Path(__file__).with_name('plan-version-storage.py')))
linked=base['linked']; hashes={}
def safe(p,root):
    p=Path(os.path.abspath(p)); p.relative_to(root)
    if any(linked(q) for q in [p,*p.parents]):raise ValueError(f'Reparse path: {p}')
    return p
def sha(p):
    s=p.stat();key=(str(p),s.st_size,s.st_mtime_ns,s.st_ctime_ns)
    if key not in hashes:
        h=hashlib.sha256()
        with p.open('rb') as f:
            for b in iter(lambda:f.read(2**20),b''):h.update(b)
        hashes[key]=h.hexdigest()
    return hashes[key]
def old(p,cutoff):
    s=p.stat();return max(s.st_mtime,s.st_ctime)<cutoff
def walk(p):
    for b,ds,fs in os.walk(p,followlinks=False,onerror=lambda e:(_ for _ in ()).throw(e)):
        ds[:]=[d for d in ds if d not in {'publish','.git','node_modules','.venv','.venv312','.vendor','__pycache__'} and not linked(Path(b,d))]
        yield Path(b),fs
def snapshot(p):
    s=p.stat();return {'path':str(p),'size':s.st_size,'mtime':s.st_mtime_ns,'ctime':s.st_ctime_ns,'mtime_ticks':s.st_mtime_ns//100+621355968000000000,'ctime_ticks':s.st_ctime_ns//100+621355968000000000,'sha256':sha(p),'nlink':s.st_nlink}
def make_plan(root):
    protection=base['plan'](root,3);cutoff=time.time()-3*86400;items={};bundles=[];notes=[]
    projects=[p for p in protection['projects'] if not p['protected']]
    # Explicit user request extends deep cleanup to mapped archives, without following old aliases.
    hist=root/'_history'
    if hist.exists():
        for family in hist.iterdir():
            if not family.is_dir() or linked(family):continue
            for p in family.iterdir():
                if not p.is_dir() or linked(p) or not p.with_name(p.name+'.mapping.json').exists():continue
                info=base['tree'](p)
                if info['latest']<cutoff and not (p/'.rainbow-clean-keep').exists():projects.append({'path':str(p),'name':p.name,'protected':False})
    for project in projects:
        p=safe(Path(project['path']),root)
        if p.name=='rainbow_arc_2026_v16':continue
        print('Inspecting',p.name,flush=True)
        manifests=[];found=[]
        for b,fs in walk(p):
            rel=b.relative_to(p).parts
            if not rel:continue
            # Only build outputs under explicitly disposable working/output areas.
            if rel[0] not in {'tmp','work','output','outputs','research'}:continue
            if any(x.lower() in {'assets','originals','generated','audio','models','src','source','public'} or x.lower().startswith('qwen') for x in rel):continue
            if 'index.html' in fs and 'bundle.js' in fs:
                if 'remotion' in (b/'index.html').read_text('utf-8',errors='ignore').lower() and 'webpack' in (b/'bundle.js').open(encoding='utf-8',errors='ignore').read(1024).lower():found.append(b)
            if 'render-manifest.json' in fs:manifests.append(b/'render-manifest.json')
        for b in found:
            count=0
            # Preserve unknown files. Only identified webpack products can regenerate.
            for f in b.iterdir():
                if f.is_file() and not linked(f) and re.fullmatch(r'(?:(?:\d+\.)?bundle\.js(?:\.map)?|index\.html|favicon\.ico)',f.name) and old(f,cutoff):
                    items[str(f)]={'kind':'generated-bundle',**snapshot(f),'project':str(p),'bundle':str(b)};count+=1
            pub=b/'public'
            if pub.is_dir() and not linked(pub):
                for sub,fs in walk(pub):
                    for name in fs:
                        f=sub/name
                        if linked(f) or not old(f,cutoff):continue
                        original=p/'public'/f.relative_to(pub)
                        try:safe(original,root)
                        except (ValueError,OSError):continue
                        if original.is_file() and original.stat().st_size==f.stat().st_size and sha(original)==sha(f):
                            items[str(f)]={'kind':'duplicate-bundle-asset',**snapshot(f),'project':str(p),'bundle':str(b),'keeper':snapshot(original)};count+=1
            if count:bundles.append({'path':str(b),'files':count})
        # Incomplete renders protect every chunk they mention.
        parsed=[];pending=set()
        for m in manifests:
            try:d=json.loads(m.read_text('utf-8-sig'))
            except ValueError:continue
            parsed.append((m,d))
            if re.search(r'pending|incomplete|in.progress|failed|draft',str(d.get('status','')),re.I):
                for c in d.get('chunks',[]):
                    cp=Path(c.get('file',''));cp=cp if cp.is_absolute() else p/cp
                    pending.add(str(cp))
        for m,d in parsed:
            if re.search(r'pending|incomplete|in.progress|failed|draft',str(d.get('status','')),re.I):continue
            final=Path(d.get('final',''));final=final if final.is_absolute() else p/final
            try:
                safe(final,root)
                if not final.is_file() or not d.get('sha256') or sha(final)!=d['sha256']:continue
                probe=subprocess.run([r'C:\ffmpeg\bin\ffprobe.exe','-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,width,height','-of','json',str(final)],capture_output=True,text=True,check=True)
                stream=json.loads(probe.stdout)['streams'][0]
                if int(stream.get('nb_frames',0))!=int(d.get('frames',-1)):continue
            except (OSError,ValueError,KeyError,IndexError,subprocess.SubprocessError):continue
            for c in d.get('chunks',[]):
                f=Path(c.get('file',''));f=f if f.is_absolute() else p/f
                try:
                    safe(f,root);f.relative_to(p)
                    if not re.fullmatch(r'chunk-\d+-\d+\.mp4',f.name) or str(f) in pending or not f.is_file() or not old(f,cutoff):continue
                    if not c.get('sha256') or sha(f)!=c['sha256']:continue
                    items[str(f)]={'kind':'completed-render-chunk',**snapshot(f),'project':str(p),'keeper':snapshot(final),'manifest':snapshot(m)}
                except (OSError,ValueError):continue
    # Canonical sources/finals cannot also be deletion targets.
    keep={x['keeper']['path'] for x in items.values() if 'keeper' in x}
    incoming=[x['target'].lower().rstrip('\\') for x in protection['links']]
    items=[x for k,x in items.items() if k not in keep and not any(k.lower()==target or k.lower().startswith(target+'\\') for target in incoming)]
    selected_bundles={x['bundle'] for x in items if 'bundle' in x}
    bundles=[b for b in bundles if b['path'] in selected_bundles]
    return {'schema':1,'root':str(root),'days':3,'timestamp':time.time(),'protected':[p for p in protection['projects'] if p['protected']],'items':items,'bundles':bundles,'logical_bytes':sum(x['size'] for x in items),'notes':notes}

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--root',default=r'D:\projects\manim_extend_rainbow\video_project');ap.add_argument('--report',required=True);ap.add_argument('--reviewed')
    a=ap.parse_args();root=Path(a.root);safe(root,root);r=make_plan(root)
    if a.reviewed:
        reviewed=json.loads(Path(a.reviewed).read_text('utf-8-sig'))
        if reviewed['root']!=str(root) or reviewed['schema']!=1:raise ValueError('Manifest scope mismatch')
        allowed={x['path']:x for x in reviewed['items']}
        r['items']=[x for x in r['items'] if x['path'] in allowed and x==allowed[x['path']]]
        r['logical_bytes']=sum(x['size'] for x in r['items'])
        selected_bundles={x['bundle'] for x in r['items'] if 'bundle' in x}
        r['bundles']=[b for b in r['bundles'] if b['path'] in selected_bundles]
    Path(a.report).write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Candidates',len(r['items']),'GiB',round(r['logical_bytes']/1024**3,3),'Report',a.report,flush=True)
