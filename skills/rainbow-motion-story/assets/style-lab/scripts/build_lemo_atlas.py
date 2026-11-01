"""Compile pinned source metadata + reviewed notes; keep docs separate for lazy loading."""
from pathlib import Path
import json,shutil
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'work/lemo-study/upstream';OUT=ROOT/'evidence/lemo-opuscar';OUT.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(p.read_text('utf-8-sig'))
ready=read(SRC/'styleboard/catalog.json');archive=read(SRC/'styleboard/opuscar98_styles.json');notes={};films={}
for group in 'abc':
    p=ROOT/f'studies/lemo-analysis-{group}.json'
    if p.exists():
        d=read(p);notes.update({x['slug']:x for x in d['ready']});films.update({x['no']:x for x in d['archive']})
sha='3961ddb3d24d8876e0e2754f7790d66908acee51';base=f'https://github.com/lemomo-ai/lemo-opuscar/blob/{sha}'
docs=OUT/'docs';docs.mkdir(exist_ok=True)
for name in ['LICENSE','DIRECTOR.md','TECHNIQUE.md','README.zh-CN.md']:
    shutil.copy2(SRC/name,docs/name)
entries=[]
for x in ready:
    slug=x['slug'];dst=docs/slug;dst.mkdir(exist_ok=True)
    for name in ['STYLE.md','DEMO.md','style.json']:shutil.copy2(SRC/'styles'/slug/name,dst/name)
    entries.append({'id':slug,'slug':slug,'kind':'ready','name':x['cn'],'en':x['en'],'family':x['cat'],'description':x.get('line_cn',''),'uses':x.get('uses',[]),'still':f'../evidence/lemo-opuscar/stills/ready-{slug}.jpg','source':f'{base}/styles/{slug}/STYLE.md','code':f'{base}/styles/{slug}/demo','styleDoc':f'../evidence/lemo-opuscar/docs/{slug}/STYLE.md','demoDoc':f'../evidence/lemo-opuscar/docs/{slug}/DEMO.md','analysis':notes.get(slug,{}),'staticReview':'contact-sheet-thumbnail','verification':notes.get(slug,{}).get('verification',{})})
for x in archive['films']:
    no=x['no'];promptfile=OUT/f'film-{no:02}.json';promptfile.write_text(json.dumps(x,ensure_ascii=False,indent=2),'utf-8')
    entries.append({'id':f'film-{no:02}','no':no,'kind':'archive','name':x['style_zh'],'en':x['style_en'],'family':x['render'],'description':x['desc_zh'],'film':x['zh'],'year':x['year'],'uses':x.get('blend_zh',[]),'still':f'../evidence/lemo-opuscar/stills/film-{no:02}.jpg','source':f'{base}/styleboard/opuscar98_styles.json','code':f'{base}/styleboard/opuscar98/index.html','promptDoc':f'../evidence/lemo-opuscar/film-{no:02}.json','analysis':films.get(no,{}),'staticReview':'contact-sheet-thumbnail','verification':films.get(no,{}).get('verification',{})})
result={'schemaVersion':1,'repository':'https://github.com/lemomo-ai/lemo-opuscar','commit':sha,'readyCount':59,'archiveCount':98,'review':{'readyNotes':len(notes),'archiveNotes':len(films),'staticFramesReviewed':157,'staticContactSheets':8,'fullSourceFilmsViewed':0,'sourceAudioReviewed':False},'entries':entries}
(ROOT/'lab/lemo-catalog.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf-8')
shutil.copy2(ROOT/'work/lemo-study/fetch-manifest.json',OUT/'source-manifest.json')
print(json.dumps(result['review']))
