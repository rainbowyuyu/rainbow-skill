"""Read-only inventory and conservative storage plan. Never follows junctions."""
import argparse, hashlib, json, os, re, time
from pathlib import Path

SKIP={'.git','.venv','.venv312','.vendor','__pycache__'}

def linked(p):
    return p.is_symlink() or p.is_junction()

def walk(p):
    for base, dirs, files in os.walk(p, followlinks=False, onerror=lambda e: (_ for _ in ()).throw(e)):
        for name in list(dirs):
            q=Path(base,name)
            if linked(q):
                dirs.remove(name); yield q, True
        for name in files:
            q=Path(base,name); yield q, linked(q)

def tree(p):
    files=[]; links=[]; latest=0; size=0
    for q,islink in walk(p):
        rel=q.relative_to(p).as_posix()
        if islink:
            links.append({'relative':rel,'target':str(q.resolve()),'raw':os.readlink(q)})
        else:
            s=q.stat();latest=max(latest,s.st_mtime,s.st_ctime);size+=s.st_size
            files.append([rel,s.st_size,s.st_mtime_ns,s.st_ctime_ns])
    encoded=json.dumps(sorted(files),ensure_ascii=False).encode()
    return {'bytes':size,'count':len(files),'latest':latest,'fingerprint':hashlib.sha256(encoded).hexdigest(),'links':links}

def plan(root, days):
    cutoff=time.time()-days*86400; projects=[]; links=[]; dependencies=[]
    for p in sorted(root.iterdir()):
        if not p.is_dir() or linked(p) or p.name.startswith('_') or p.name in {'maintenance','shared'}:continue
        recent=0; dep=[]; donor=False
        # Scan every regular file outside environments/dependencies to protect recent media, source and work.
        for base,dirs,files in os.walk(p,followlinks=False,onerror=lambda e: (_ for _ in ()).throw(e)):
            for name in list(dirs):
                q=Path(base,name)
                if linked(q):
                    links.append({'path':str(q),'target':str(q.resolve())});dirs.remove(name)
                elif name in SKIP:dirs.remove(name)
                elif name=='node_modules':
                    dirs.remove(name); info=tree(q);info['path']=str(q);info['project']=p.name
                    package=q.parent/'package.json';lock=q.parent/'package-lock.json'
                    info['reinstallable']=package.is_file() and lock.is_file()
                    if info['reinstallable']:
                        try:
                            spec=json.loads(package.read_text('utf-8-sig')); locked=json.loads(lock.read_text('utf-8-sig'))
                            info['reinstallable']=bool(locked.get('lockfileVersion')) and not any(str(v).startswith(('file:','link:','workspace:')) for k in ('dependencies','devDependencies') for v in spec.get(k,{}).values()) and not any(v.get('link') or str(v.get('resolved','')).startswith('file:') for v in locked.get('packages',{}).values())
                        except (ValueError,TypeError):info['reinstallable']=False
                    info['package_hash']=hashlib.sha256(package.read_bytes()+lock.read_bytes()).hexdigest() if info['reinstallable'] else None
                    dep.append(info)
                    for link in info['links']:links.append({'path':str(q/link['relative']),'target':link['target']})
            for name in files:
                q=Path(base,name)
                if linked(q):links.append({'path':str(q),'target':str(q.resolve())});continue
                s=q.stat();recent=max(recent,s.st_mtime,s.st_ctime)
        match=re.fullmatch(r'(.+)_v(\d+)',p.name,re.I)
        projects.append({'name':p.name,'path':str(p),'latest':recent,'family':match[1] if match else p.name,'version':int(match[2]) if match else None})
        dependencies.extend(dep)
    families={}
    for p in projects:
        if p['version'] is not None:families.setdefault(p['family'],[]).append(p['version'])
    actions=[]
    for p in projects:
        latest_two=sorted(families.get(p['family'],[]),reverse=True)[:2]
        p['protected']=p['latest']>=cutoff or p['name']=='rainbow_arc_2026_v16' or (Path(p['path'])/'.rainbow-clean-keep').exists() or (p['version'] is not None and p['version'] in latest_two)
        if p['version'] is not None and not p['protected']:
            # Published packages are stable user-facing paths; archive them only via
            # the separate reviewed publication-history transaction.
            if (Path(p['path'])/'publish').exists():continue
            # Do not relocate a physical dependency donor. Independent dependencies can
            # be removed this run; archive the now dependency-free version next run.
            if any(d['project']==p['name'] for d in dependencies):continue
            info=tree(Path(p['path']))
            # Any recently touched dependency or file protects the entire version too.
            if info['latest']>=cutoff:continue
            if any(not (x['raw'].startswith('\\??\\') or Path(x['raw']).is_absolute()) for x in info['links']):continue
            actions.append({'kind':'archive','path':p['path'],'destination':str(root/'_history'/p['family']/p['name']),'project':p['name'],**info})
    by_name={p['name']:p for p in projects}
    for d in dependencies:
        p=by_name[d['project']];target=d['path'].lower()
        if 'publish' in Path(d['path']).relative_to(root).parts:continue
        d['incoming_links']=[x['path'] for x in links if x['target'].lower()==target or x['target'].lower().startswith(target+'\\')]
        if not p['protected'] and d['latest']<cutoff and d['reinstallable'] and not d['incoming_links'] and d['bytes']>1024:
            actions.append({'kind':'remove-dependencies',**d})
    return {'schema':1,'root':str(root),'days':days,'timestamp':time.time(),'projects':projects,'dependencies':dependencies,'links':links,'actions':actions}

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--root',default=r'D:\projects\manim_extend_rainbow\video_project');ap.add_argument('--days',type=int,default=3);ap.add_argument('--report',required=True)
    args=ap.parse_args()
    if args.days<3:raise SystemExit('Minimum retention is 3 days')
    root=Path(args.root)
    if any(linked(p) for p in [root,*root.parents]):raise SystemExit('Root/ancestor is a reparse point')
    result=plan(root,args.days)
    Path(args.report).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    for a in result['actions']:print(a['kind'],a['path'],round(a['bytes']/1024**2,2),'MiB',flush=True)
    print('Report:',args.report)
