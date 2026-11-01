"""PTS-indexed MOFs subtitle/scene evidence for local study; not an ASR transcript.

Extract all source frames at about 0.5 s spacing, retaining actual decoded PTS.
Then --ocr uses installed Windows OCR and --sheets builds human-review sheets.
"""
from pathlib import Path
from fractions import Fraction
import argparse,hashlib,json,math,re,subprocess
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/mofs-script';OUT=ROOT/'evidence/mofs-script'
PATTERN=re.compile(r'\[showinfo@(source|selected)\s+@[^\]]+\]\s+n:\s*(\d+)\s+pts:\s*(-?\d+)\s+pts_time:([^\s]+)')
def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()
def save(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def read(path):return json.loads(path.read_text('utf-8-sig'))

def extract():
    ref=next(r for r in read(ROOT/'lab/references.json')['references'] if r['id']=='mofs')
    source=Path(ref['sourceVideo']);assert sha(source)==ref['sourceSha256']
    stream=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,avg_frame_rate,time_base,start_pts,duration','-of','json',str(source)],encoding='utf8'))['streams'][0]
    rate=Fraction(stream['avg_frame_rate']);step=max(1,round(float(rate)*.5));tb=Fraction(stream['time_base'])
    OUT.mkdir(parents=True,exist_ok=True);WORK.mkdir(parents=True,exist_ok=True)
    manifest=OUT/'subtitle-frames.json'
    if manifest.exists():
        m=read(manifest)
        assert m['sourceSha256']==ref['sourceSha256'] and all(Path(r['path']).exists() and Path(r['fullFrame']).exists() for r in m['frames'])
        print(json.dumps({'reused':len(m['frames'])}));return
    frames=WORK/'frames';crops=WORK/'subtitle-crops';frames.mkdir(exist_ok=True);crops.mkdir(exist_ok=True)
    if any(frames.iterdir()) or any(crops.iterdir()):raise FileExistsError('Unmanifested output exists; refusing overwrite')
    vf=f'showinfo@source,select=not(mod(n\\,{step})),showinfo@selected'
    command=['ffmpeg','-hide_banner','-loglevel','info','-n','-i',str(source),'-map','0:v:0','-vf',vf,'-fps_mode','passthrough','-an','-q:v','2',str(frames/'frame-%05d.jpg')]
    run=subprocess.run(command,capture_output=True,encoding='utf8',errors='replace');(WORK/'ffmpeg-showinfo.log').write_text(run.stderr,encoding='utf8');save(WORK/'command.json',{'argv':command})
    if run.returncode:raise RuntimeError('ffmpeg extraction failed')
    original={};selected=[]
    for kind,n,pts,shown in PATTERN.findall(run.stderr):
        row={'n':int(n),'pts':int(pts),'shown':shown}
        if kind=='source':
            assert row['pts'] not in original;original[row['pts']]=row
        else:selected.append(row)
    files=sorted(frames.glob('frame-*.jpg'));assert len(files)==len(selected)
    width,height=stream['width'],stream['height'];crop_y=round(height*610/720);crop_h=height-crop_y
    records=[]
    for index,(path,row) in enumerate(zip(files,selected)):
        raw=original[row['pts']];assert raw['n']%step==0
        exact=raw['pts']*tb;crop=crops/f'subtitle-{index+1:05d}.png'
        with Image.open(path) as image:assert image.size==(width,height);image.crop((0,crop_y,width,height)).save(crop)
        records.append({'id':f'sub-{index:04d}','sourceFrameNumber':raw['n'],'pts':raw['pts'],'timeBase':stream['time_base'],'ptsSecondsRational':str(exact),'time':float(exact),'showinfoPtsTime':raw['shown'],'selectedShowinfoPtsTime':row['shown'],'path':str(crop),'sha256':sha(crop),'fullFrame':str(path),'fullFrameSha256':sha(path),'crop':{'x':0,'y':crop_y,'width':width,'height':crop_h},'fullFrameSize':[width,height]})
    assert [r['sourceFrameNumber'] for r in records]==list(range(0,len(original),step))
    save(manifest,{'schema':'motion-atelier.subtitle-frames/v2','referenceId':'mofs','source':str(source),'sourceSha256':ref['sourceSha256'],'sourceStream':stream,'decodedSourceFrames':len(original),'sampleStepFrames':step,'nominalSampleStepSeconds':float(Fraction(step,1)/rate),'samplingMethod':'source-frame selection, pre/post-select showinfo matched by integer PTS','sourceCopied':False,'scope':'Visible subtitle/image evidence, not verified spoken words.','frames':records})
    print(json.dumps({'frames':len(records),'sourceFrames':len(original),'nominalStep':float(Fraction(step,1)/rate),'lastPts':records[-1]['time']}))

def ocr():
    script=ROOT/'scripts/ocr_mofs_subtitles.ps1'
    command=script.read_text('utf8').replace('param([string]$Root = (Split-Path -Parent $PSScriptRoot))',"$Root = '"+str(ROOT).replace("'","''")+"'")
    subprocess.run(['C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-Command',command],check=True)

def sheets():
    m=read(OUT/'subtitle-frames.json');raw=read(OUT/'subtitle-ocr-raw.json');byid={r['id']:r for r in raw['frames']}
    groups=[]
    for row in m['frames']:
        text=''.join(line['text'] for line in byid[row['id']]['lines'] if re.search(r'[\u4e00-\u9fff]',line['text']))
        norm=re.sub(r'\s+','',text)
        if groups and groups[-1]['normalizedOcr']==norm:groups[-1]['frameIds'].append(row['id']);groups[-1]['lastObserved']=row['time']
        else:groups.append({'id':f'ocr-{len(groups):03d}','normalizedOcr':norm,'firstObserved':row['time'],'lastObserved':row['time'],'frameIds':[row['id']],'status':'OCR candidate, not manually verified'})
    save(OUT/'subtitle-ocr-groups.json',{'sourceSha256':m['sourceSha256'],'groups':groups})
    lookup={r['id']:r for r in m['frames']};font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',21);pages=[]
    def crop_pages(name,rows):
        for p,start in enumerate(range(0,len(rows),12),1):
            chosen=rows[start:start+12];canvas=Image.new('RGB',(1310,len(chosen)*146),'#ececec');paint=ImageDraw.Draw(canvas)
            for line,row in enumerate(chosen):
                paint.text((15,line*146+3),f'{row["id"]} | PTS {row["time"]:.6f}s | source n={row["sourceFrameNumber"]}',font=font,fill='#151515')
                with Image.open(row['path']) as image:canvas.paste(image.convert('RGB'),(15,line*146+32))
            path=OUT/f'{name}-{p:02d}.jpg';canvas.save(path,quality=95,subsampling=0)
            pages.append({'file':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'frameIds':[r['id'] for r in chosen],'kind':name,'reviewStatus':'awaitingReview'})
    crop_pages('hook-crops',[r for r in m['frames'] if r['time']<=35])
    crop_pages('subtitle-groups',[lookup[g['frameIds'][len(g['frameIds'])//2]] for g in groups])
    rows=m['frames'][::6]
    for p,start in enumerate(range(0,len(rows),16),1):
        chosen=rows[start:start+16];canvas=Image.new('RGB',(1600,1000),'#0c1219');paint=ImageDraw.Draw(canvas)
        for i,row in enumerate(chosen):
            x,y=i%4*400,i//4*250
            with Image.open(row['fullFrame']) as image:image=image.convert('RGB');image.thumbnail((400,225));canvas.paste(image,(x,y))
            paint.text((x+7,y+225),f'{row["time"]:.3f}s n={row["sourceFrameNumber"]}',font=font,fill='#e8e8e0')
        path=OUT/f'scene-overview-{p:02d}.jpg';canvas.save(path,quality=95,subsampling=0)
        pages.append({'file':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'frameIds':[r['id'] for r in chosen],'kind':'scene-overview','reviewStatus':'awaitingReview'})
    save(OUT/'review-pages.json',{'sourceSha256':m['sourceSha256'],'groups':len(groups),'pages':pages,'scope':'Review targets only. Generation is not viewing.'})
    print(json.dumps({'groups':len(groups),'pages':len(pages),'kinds':{kind:sum(p['kind']==kind for p in pages) for kind in set(p['kind'] for p in pages)}}))

def verify():
    m=read(OUT/'subtitle-frames.json');raw=read(OUT/'subtitle-ocr-raw.json');pages=read(OUT/'review-pages.json');review=read(OUT/'subtitle-manual-review.json');cues=read(OUT/'subtitle-verified.json')
    assert sha(m['source'])==m['sourceSha256']
    rows=m['frames'];lookup={r['id']:r for r in rows};assert len(rows)==len(lookup)
    assert [r['sourceFrameNumber'] for r in rows]==list(range(0,m['decodedSourceFrames'],m['sampleStepFrames']))
    for row in rows:
        exact=row['pts']*Fraction(row['timeBase'])
        assert exact==Fraction(row['ptsSecondsRational']) and abs(float(exact)-row['time'])<1e-12
        assert sha(row['path'])==row['sha256'] and sha(row['fullFrame'])==row['fullFrameSha256']
        with Image.open(row['path']) as image:assert image.size==(row['crop']['width'],row['crop']['height'])
        with Image.open(row['fullFrame']) as image:assert list(image.size)==row['fullFrameSize']
    assert {r['id'] for r in raw['frames']}==set(lookup)
    assert all(r['cropSha256']==lookup[r['id']]['sha256'] and r['sourceFrameNumber']==lookup[r['id']]['sourceFrameNumber'] for r in raw['frames'])
    for page in pages['pages']:
        assert sha(ROOT/page['file'])==page['sha256']
        assert all(i in lookup for i in page['frameIds'])
    assert {r['file'] for r in review['reviewedPages']}=={r['file'] for r in pages['pages']}
    assert all(r['sha256']==next(p['sha256'] for p in pages['pages'] if p['file']==r['file']) for r in review['reviewedPages'])
    for cue in cues['cues']:
        for evidence in cue['evidence']:
            row=lookup[evidence['sampleId']]
            assert evidence['pts']==row['pts'] and evidence['time']==row['time'] and evidence['cropSha256']==row['sha256']
    result={'schema':'motion-atelier.mofs-script-qa/v1','passed':True,'sourceHashVerified':True,'frameRecordsVerified':len(rows),'fullAndCropHashesVerified':len(rows)*2,'ocrAssociationsVerified':len(raw['frames']),'pageHashesVerified':len(pages['pages']),'reviewedUniqueFrameIds':len(set(review['reviewedFrameIds'])),'representativeCues':len(cues['cues']),'scope':'Integrity and evidence associations only; not spoken-word verification or a scientific/visual quality score.'}
    save(OUT/'qa.json',result);print(json.dumps(result))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--ocr',action='store_true');p.add_argument('--sheets',action='store_true');p.add_argument('--verify',action='store_true');a=p.parse_args()
    verify() if a.verify else ocr() if a.ocr else sheets() if a.sheets else extract()
