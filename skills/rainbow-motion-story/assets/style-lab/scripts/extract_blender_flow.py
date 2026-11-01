"""Extract auditable 6fps samples of the user-provided 24fps Blender flow reference."""
from pathlib import Path
from fractions import Fraction
import hashlib,json,re,subprocess
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/blender-flow'
OUT=ROOT/'evidence/blender-flow'
FRAMES=OUT/'frames'; FRAMES.mkdir(parents=True,exist_ok=True)
src=WORK/'reference-video.mp4'
probe=json.loads((WORK/'probe.json').read_text('utf-8'))
v=next(s for s in probe['streams'] if s['codec_type']=='video')
assert v['r_frame_rate']=='24/1'
cmd=['C:/ffmpeg/bin/ffmpeg.exe','-hide_banner','-y','-i',str(src),'-vf','showinfo@source,select=not(mod(n\\,4)),showinfo@selected,scale=800:450','-fps_mode','passthrough','-an','-q:v','2',str(FRAMES/'frame-%03d.jpg')]
run=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
(WORK/'extract.log').write_text(run.stderr,'utf-8')
original={};selected=[]
for kind,n,pts,stamp in re.findall(r'\[showinfo@(source|selected)\s+@[^\]]+\]\s+n:\s*(\d+)\s+pts:\s*(-?\d+)\s+pts_time:([^\s]+)',run.stderr):
    row={'n':int(n),'pts':int(pts)}
    if kind=='source': original[int(pts)]=row
    else: selected.append(row)
images=sorted(FRAMES.glob('frame-*.jpg'));assert len(images)==len(selected)==50
records=[]
for p,row in zip(images,selected):
    orig=original[row['pts']];t=Fraction(orig['pts'])*Fraction(v['time_base'])
    records.append({'sourceFrame':orig['n'],'ptsUnits':orig['pts'],'timeBase':v['time_base'],'ptsSeconds':float(t),'ptsRational':str(t),'path':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'reviewed':False})
font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',16)
pages=[]
for j,start in enumerate(range(0,len(records),12),1):
    sheet=Image.new('RGB',(1600,920),(16,24,28));draw=ImageDraw.Draw(sheet)
    draw.text((16,10),f'BLENDER FLOW REFERENCE / 6fps source samples / page {j}',font=font,fill='#e1edea')
    for i,row in enumerate(records[start:start+12]):
        x=i%4*400;y=40+i//4*290
        with Image.open(ROOT/row['path']) as im: sheet.paste(im.resize((400,225)),(x,y))
        draw.text((x+8,y+236),f"{row['ptsSeconds']:.3f}s | frame {row['sourceFrame']:03d}",font=font,fill='#e1edea')
        row['contactSheet']=f'evidence/blender-flow/contact-{j:02d}.jpg'
    dest=OUT/f'contact-{j:02d}.jpg';sheet.save(dest,quality=93);pages.append(dest.relative_to(ROOT).as_posix())
manifest={'source':'work/blender-flow/reference-video.mp4','sourceFrameCount':len(original),'sampling':'Every fourth presentation frame at 24fps; integer PTS matched before and after selection; full image resized without cropping.','frames':records,'sheets':pages,'reviewedFrames':0,'continuousPlayback':False,'subjectiveAudioListening':False}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),'utf-8')
source={'url':'https://v.douyin.com/85SXSqesAFI/','canonicalUrl':'https://www.douyin.com/video/7699790483135972799','author':'柳疯衫·awa','title':'Blend建模动画分享一流水','dateChecked':'2026-10-23','acquisition':'Browser-observed public video.currentSrc, HTTP without cookies','bytes':src.stat().st_size,'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'duration':float(probe['format']['duration']),'videoFrames':int(v['nb_frames']),'width':v['width'],'height':v['height'],'frameRate':v['r_frame_rate'],'sampleCount':50,'reviewedFrames':0,'continuousPlayback':False,'subjectiveAudioListening':False,'boundary':'The title attributes Blender, but no source blend, solver settings, render engine or accuracy measurements are supplied.'}
(OUT/'source.json').write_text(json.dumps(source,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps({'frames':len(records),'sheets':pages,'duration':source['duration']}))
