"""Auditable contact-sheet extraction for the supplied Magpie-inspired Odyssey concept film.
Uses the already acquired public video; does not download or bundle source media.
"""
from pathlib import Path
from fractions import Fraction
import hashlib,json,re,subprocess,sys
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/magpie-title'
EVIDENCE=ROOT/'evidence/magpie-title'
SOURCE=WORK/'reference-video.mp4'
EVIDENCE.mkdir(parents=True,exist_ok=True)
DENSE='--dense' in sys.argv
FRAMES=EVIDENCE/('dense-frames' if DENSE else 'frames');FRAMES.mkdir(exist_ok=True)
WINDOWS=[(105,138),(183,222),(426,486),(564,603),(636,675),(846,879),(906,945)]
selection='not(mod(n\\,15))' if not DENSE else '('+'+'.join(f'between(n\\,{a}\\,{b})' for a,b in WINDOWS)+')*not(mod(n\\,3))'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
probe=json.loads((WORK/'probe.json').read_text(encoding='utf-8'))
v=next(x for x in probe['streams'] if x['codec_type']=='video')
assert v['r_frame_rate']=='30/1' and v['avg_frame_rate']=='30/1'
command=['ffmpeg','-hide_banner','-loglevel','info','-y','-i',str(SOURCE),'-map','0:v:0','-vf','showinfo@source,select='+selection+',showinfo@selected,scale=800:450','-fps_mode','passthrough','-an','-q:v','2',str(FRAMES/'frame-%03d.jpg')]
run=subprocess.run(command,capture_output=True,encoding='utf-8',errors='replace');(WORK/('dense-extraction.log' if DENSE else 'extraction.log')).write_text(run.stderr,encoding='utf-8')
assert run.returncode==0
pattern=re.compile(r'\[showinfo@(source|selected)\s+@[^\]]+\]\s+n:\s*(\d+)\s+pts:\s*(-?\d+)\s+pts_time:([^\s]+)')
original={};selected=[]
for kind,n,pts,stamp in pattern.findall(run.stderr):
 item={'n':int(n),'pts':int(pts),'printed':stamp}
 if kind=='source':original[int(pts)]=item
 else:selected.append(item)
images=sorted(FRAMES.glob('frame-*.jpg'));assert len(images)==len(selected)
assert len(images)==(sum((b-a)//3+1 for a,b in WINDOWS) if DENSE else 76)
records=[]
for image,s in zip(images,selected):
 o=original[s['pts']];t=Fraction(o['pts'])*Fraction(v['time_base'])
 records.append({'sourceFrame':o['n'],'ptsUnits':o['pts'],'timeBase':v['time_base'],'ptsSeconds':float(t),'ptsRational':str(t),'rawFrame':image.relative_to(ROOT).as_posix(),'sha256':sha(image),'reviewed':False})
font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',18);small=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',15)
pages=[]
for j,start in enumerate(range(0,len(records),12),1):
 group=records[start:start+12];sheet=Image.new('RGB',(1600,994),(14,16,18));draw=ImageDraw.Draw(sheet)
 draw.text((16,12),f'MAGPIE-INSPIRED ODYSSEY | {"10fps transition" if DENSE else "2fps overview"} | page {j} | source evidence',fill=(230,230,220),font=font)
 for i,r in enumerate(group):
  x=(i%4)*400;y=48+(i//4)*300
  with Image.open(ROOT/r['rawFrame']) as im:sheet.paste(im.resize((400,225),Image.Resampling.LANCZOS),(x,y))
  draw.text((x+8,y+236),f"PTS {r['ptsSeconds']:06.3f}s / frame {r['sourceFrame']:04d}",fill=(220,215,200),font=small)
  r['contactPage']=f'evidence/magpie-title/{"dense" if DENSE else "contact"}-{j:02d}.jpg'
 path=EVIDENCE/f'{"dense" if DENSE else "contact"}-{j:02d}.jpg';sheet.save(path,quality=94,subsampling=0)
 pages.append(path.relative_to(ROOT).as_posix())
manifest={'schemaVersion':1,'source':'work/magpie-title/reference-video.mp4','sampling':('Every3rd frame in selected transition windows (10fps)' if DENSE else 'Every15th decoded presentation frame from30fps (2fps)')+'; pre/post-select showinfo matched by integerPTS; full16:9 frame resized to800x450 without cropping.','sourcePresentationFrames':len(original),'framesExtracted':len(records),'sourceFramesReviewed':0,'contactPages':pages,'frames':records,'continuousPlayback':False,'subjectiveAudioListening':False}
(EVIDENCE/('dense.json' if DENSE else 'manifest.json')).write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
source={'schemaVersion':1,'sourceId':'magpie-title','originalUrl':'https://v.douyin.com/ea1ezBTjGLo/','canonicalUrl':'https://www.douyin.com/video/7696978272303492243','videoId':'7696978272303492243','author':'AAA太刀批发汀总','title':'喜鹊谋杀案片头美学｜诺兰版奥德赛概念短片','checkedDate':'2026-10-23','sourceType':'Creator-labelled AI-generated concept short, not verified official Nolan or Magpie Murders opening','accessMethod':'Browser-observed video.currentSrc; publicHTTP without cookies','mediaFile':'work/magpie-title/reference-video.mp4','mediaBytes':SOURCE.stat().st_size,'mediaSha256':sha(SOURCE),'httpStatus':200,'duration':float(probe['format']['duration']),'width':v['width'],'height':v['height'],'frameRate':v['r_frame_rate'],'videoFrames':v['nb_frames'],'videoDuration':v['duration'],'audioPresent':True,'sourceFramesExtracted':len(records),'sourceFramesReviewed':0,'continuousPlayback':False,'subjectiveAudioListening':False,'authorToolClaim':'Visible author comment says 即梦和gpt; attributed statement, not independently verified.'}
if not DENSE:(EVIDENCE/'source.json').write_text(json.dumps(source,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'frames':len(records),'pages':pages,'duration':source['duration'],'size':[v['width'],v['height']]}))
