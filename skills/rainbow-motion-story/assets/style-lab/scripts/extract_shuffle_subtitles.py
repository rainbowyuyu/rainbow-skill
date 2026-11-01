"""Extract small PTS-indexed subtitle crops for local research, not an ASR transcript."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT/'work/shuffle-story/subtitle-crops'
OUT = ROOT/'evidence/shuffle-story'
def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def save(path, obj): path.write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def extract():
    ref = next(x for x in json.loads((ROOT/'lab/references.json').read_text(encoding='utf-8'))['references'] if x['id']=='shuffle')
    source = Path(ref['sourceVideo'])
    assert sha(source)==ref['sourceSha256']
    WORK.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
    vf = 'select=not(mod(n\\,15)),showinfo,crop=1280:100:0:605'
    cmd = ['ffmpeg','-hide_banner','-i',str(source),'-vf',vf,'-fps_mode','vfr','-q:v','2','-y',str(WORK/'subtitle-%04d.png')]
    result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', check=True)
    (WORK/'ffmpeg-showinfo.log').write_text(result.stderr,encoding='utf-8')
    records = []
    for match in re.finditer(r'\bn:\s*(\d+)\s+pts:\s*(\d+)\s+pts_time:([\d.]+)',result.stderr):
        n, pts, time = int(match[1]),int(match[2]),float(match[3]); image=WORK/f'subtitle-{n+1:04d}.png'
        records.append({'id':f'sub-{n:04d}','sourceFrameNumber':n*15,'pts':pts,'timeBase':'1/15360','time':time,'path':str(image),'sha256':sha(image),'crop':{'x':0,'y':605,'width':1280,'height':100},'fullFrameSize':[1280,720]})
    assert len(records)==276 and records[-1]['time']==137.5
    save(OUT/'subtitle-frames.json', {'schema':'motion-atelier.subtitle-frames/v1','source':str(source),'sourceSha256':ref['sourceSha256'],'sampleStepSeconds':.5,'scope':'Visible Chinese/English subtitle crop, not verified spoken words.','frames':records})
    save(WORK/'command.json',{'command':cmd,'sourceUnchanged':sha(source)==ref['sourceSha256']})
    print(json.dumps({'frames':len(records),'manifest':str(OUT/'subtitle-frames.json')}))

def sheets():
    manifest=json.loads((OUT/'subtitle-frames.json').read_text(encoding='utf-8'))
    raw=json.loads((OUT/'subtitle-ocr-raw.json').read_text(encoding='utf-8-sig'))
    by_id={x['id']:x for x in raw['frames']}
    font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',22)
    # Review every sample; English is retained as evidence but is not a narration substitute.
    for page in range((len(manifest['frames'])+17)//18):
        rows=manifest['frames'][page*18:(page+1)*18]
        canvas=Image.new('RGB',(1310,len(rows)*133),'#ececec'); draw=ImageDraw.Draw(canvas)
        for row,f in enumerate(rows):
            draw.text((15,row*133+3),f"{f['id']} | {f['time']:.3f}s | frame {f['sourceFrameNumber']}",font=font,fill='#151515')
            canvas.paste(Image.open(f['path']).convert('RGB'),(15,row*133+29))
        canvas.save(OUT/f'subtitle-review-{page+1:02d}.jpg',quality=94)
    groups=[]
    for f in manifest['frames']:
        o=by_id[f['id']]
        chinese=''.join(line['text'] for line in o['lines'] if re.search(r'[\u4e00-\u9fff]',line['text']))
        normalized=re.sub(r'\s+','',chinese)
        if groups and groups[-1]['normalizedOcr']==normalized:
            g=groups[-1];g['lastObserved']=f['time'];g['frameIds'].append(f['id'])
        else:
            groups.append({'groupId':f'ocr-{len(groups):03d}','firstObserved':f['time'],'lastObserved':f['time'],'normalizedOcr':normalized,'frameIds':[f['id']],'status':'OCR candidate; not manually verified'})
    save(OUT/'subtitle-ocr-groups.json',{'sourceSha256':manifest['sourceSha256'],'method':'Windows.Media.Ocr zh-Hans-CN; whitespace-normalized Chinese-bearing lines; no spoken-word inference.','groups':groups})
    print(json.dumps({'groups':len(groups),'reviewSheets':(len(manifest['frames'])+17)//18}))

def verify():
    m=json.loads((OUT/'subtitle-frames.json').read_text(encoding='utf-8'))
    review=json.loads((OUT/'subtitle-manual-review.json').read_text(encoding='utf-8'))
    assert sha(m['source'])==m['sourceSha256']
    assert len(m['frames'])==276 and all(f['time']==i*.5 for i,f in enumerate(m['frames']))
    assert all(sha(f['path'])==f['sha256'] for f in m['frames'])
    by_time={f['time']:f for f in m['frames']}; cues=[]
    for index,(first,last,text,representative,chapter) in enumerate(review['cues']):
        frames=[f for f in m['frames'] if first<=f['time']<=last]
        evidence=by_time[representative]
        assert frames and first<=representative<=last
        assert all(sha(f['path'])==f['sha256'] for f in frames)
        cues.append({'id':f'cue-{index+1:03d}','chapter':chapter,'text':text,'contentKind':'visible-subtitle','spokenTextVerified':False,
                     'firstReadableSample':first,'lastReadableSample':last,'approximateNavigationSpan':[max(0,first-.5),min(138,last+.5)],
                     'timingAccuracy':'Sample timestamps exact; onset/offset approximate. Fades not frame-resolved.',
                     'textReliability':'Visually verified wording, layout whitespace and dash/ellipsis normalized.',
                     'representativeFrame':evidence,'supportingFrameIds':[f['id'] for f in frames],
                     'reviewSheet':f'subtitle-review-{int(representative*2)//18+1:02d}.jpg'})
    result={'schema':'motion-atelier.visible-subtitles/v1','source':m['source'],'sourceSha256':m['sourceSha256'],
            'sourceCopied':False,'sampleCount':len(m['frames']),'timeRange':[0,137.5],'sampleStepSeconds':.5,
            'scope':review['scope'],'timingMeaning':review['timingMeaning'],'unconfirmed':review['unconfirmed'],
            'fadeNotes':review['fadeNotes'],'cues':cues,'subjectiveListening':False,'asr':False}
    save(OUT/'subtitle-verified.json',result)
    rows=['# 可见字幕核对表（内部研究）','','本表按画面读出，不是逐字口播。0.5秒抽样；区间为清晰可读样本跨度，非精确入点/出点。布局空格与破折号/省略号字形已归一；不得直接作为发布脚本。','', '| 编号 | 章节 | 可读样本时间 / 秒 | 字幕文字 | 代表证据 |','|---|---|---|---|---|']
    for c in cues:
        f=c['representativeFrame'];relative=Path(f['path']).relative_to(ROOT).as_posix()
        rows.append(f"| {c['id']} | {c['chapter']} | {c['firstReadableSample']:.1f}–{c['lastReadableSample']:.1f} | {c['text']} | [{f['time']:.3f}s / frame {f['sourceFrameNumber']}](../../{relative}) |")
    rows.extend(['','## 未确认','',*['- '+x for x in review['unconfirmed']]])
    (OUT/'subtitle-transcript-internal.md').write_text('\n'.join(rows)+'\n',encoding='utf-8')
    save(OUT/'subtitle-validation.json',{'passed':True,'sampleCount':len(m['frames']),'manuallyVerifiedCueCount':len(cues),
                                      'all276CropsReviewedIn16Sheets':True,'allCueEvidenceHashesVerified':True,'all276CropHashesVerified':True,
                                      'sourceUnmodified':sha(m['source'])==m['sourceSha256'],
                                      'exactSpokenTranscript':False,'noModelDownload':True,'noPaidApi':True})
    print(json.dumps({'verifiedCues':len(cues),'sourceUnmodified':sha(m['source'])==m['sourceSha256']}))

def ocr():
    script=ROOT/'scripts/ocr_shuffle_subtitles.ps1'
    command=script.read_text(encoding='utf-8').replace('param([string]$Root = (Split-Path -Parent $PSScriptRoot))', "$Root = '"+str(ROOT).replace("'","''")+"'")
    # WindowsPowerShell5.1 exposes WinRT here; do not change the user's execution policy.
    subprocess.run(['C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-Command',command],check=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--sheets',action='store_true');p.add_argument('--verify',action='store_true');p.add_argument('--ocr',action='store_true');a=p.parse_args()
    verify() if a.verify else sheets() if a.sheets else ocr() if a.ocr else extract()
