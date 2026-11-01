"""Write a normalized catalog manifest; actual links are created by PowerShell."""
import argparse, json, re
from pathlib import Path

CATEGORIES=('publish','cover','output','source','assets','work','history')
def inventory(root):
    groups={}
    for p in root.iterdir():
        if not p.is_dir() or p.name.startswith(('_','.')) or p.name in {'maintenance','shared'}:continue
        resolved=p.resolve()
        try:resolved.relative_to(root)
        except ValueError:continue
        m=re.fullmatch(r'(.+)_v(\d+)',p.name,re.I)
        family=m[1] if m else p.name;v=int(m[2]) if m else 0
        groups.setdefault(family,[]).append((v,p))
    topics=[]
    for family,versions in sorted(groups.items()):
        versions.sort(key=lambda x:x[0],reverse=True);current=versions[0][1].resolve();links=[]
        def link(category,label,target):
            if not target.is_dir():return
            canonical=target.resolve()
            try:canonical.relative_to(root)
            except ValueError:return
            links.append({'category':category,'label':label,'target':str(canonical)})
        for n in ('cover','covers'):link('cover',n,current/n)
        link('publish','files',current/'publish')
        if family in {'ai_evolution_trailer','ai_evolution_ch01_vision_choice'}:
            link('publish','shared-release',root/'publication_2026-09-23'/'publish')
        for n in ('cover','covers'):link('cover','public-'+n,current/'public'/n)
        for n in ('output','outputs','delivery','publication'):link('output',n,current/n)
        for q in current.iterdir():
            if q.is_dir() and re.fullmatch(r'output-v\d+(?:-[a-z0-9-]+)?',q.name,re.I):
                link('output',q.name,q/'delivery' if (q/'delivery').is_dir() else q)
                link('work',q.name+'-work',q/'work')
        for n in ('src','scripts','manim','scene','experiments'):link('source',n,current/n)
        link('source','project',current)
        for n in ('public','audio','assets','models','media'):link('assets',n,current/n)
        for n in ('work','tmp','research'):link('work',n,current/n)
        for n in ('archive','versions'):link('history',n,current/n)
        for v,p in versions[1:]:
            if p.resolve()!=current:link('history',p.name,p)
        # Already archived versions remain discoverable even if old compatibility entries disappear.
        hist=root/'_history'/family
        if hist.is_dir():
            used={l['label'] for l in links if l['category']=='history'}
            for p in hist.iterdir():
                if p.is_dir() and p.name not in used:link('history',p.name,p)
        topics.append({'family':family,'current':str(current),'categories':list(CATEGORIES),'links':links})
    return {'root':str(root),'catalog':str(root/'_catalog'),'topics':topics}
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--root',default=r'D:\projects\manim_extend_rainbow\video_project');ap.add_argument('--report',required=True)
    a=ap.parse_args();root=Path(a.root)
    if root.is_junction() or root.is_symlink():raise ValueError('Root must be physical')
    Path(a.report).write_text(json.dumps(inventory(root),ensure_ascii=False,indent=2),encoding='utf-8')
