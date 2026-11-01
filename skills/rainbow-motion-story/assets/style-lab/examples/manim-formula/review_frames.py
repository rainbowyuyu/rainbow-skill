"""Extract stage frames without mistaking sampled review for continuous viewing."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess,json
ROOT=Path(__file__).resolve().parents[2]
TIMES={
 'FormulaSemanticTransform':[1.7,3.5,5.8,8.2,10.5,13.5],
 'DerivativeLinkedView':[3.9,6.9,7.4,9.5,11.4,13.5],
 'MatrixBasisMap':[2.9,4.6,6.2,8.0,10.8,13.6],
 'ComplexRotationProjection':[2.6,4.9,7.15,9.4,11.7,13.6],
}
qa=ROOT/'qa/manim-formula';qa.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
for scene,times in TIMES.items():
 sheet=Image.new('RGB',(960,3*294),(11,20,35));draw=ImageDraw.Draw(sheet)
 frames=[]
 for i,t in enumerate(times):
  frame=qa/f'{scene}-{i+1:02d}.jpg'
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(ROOT/'assets/manim-formula'/f'{scene}.mp4'),'-frames:v','1','-q:v','2',str(frame)],check=True)
  im=Image.open(frame).convert('RGB').resize((480,270))
  x=(i%2)*480;y=(i//2)*294
  sheet.paste(im,(x,y));draw.text((x+10,y+273),f'{scene} | t={t:.2f}s',fill=(191,210,230),font=font)
  frames.append({'time':t,'file':str(frame.relative_to(ROOT)).replace(chr(92),'/'),'reviewed':False})
 sheet.save(qa/f'{scene}-contact.jpg',quality=93)
 (qa/f'{scene}-review.json').write_text(json.dumps({'frames':frames,'contactSheetReviewed':False,'continuousPlayback':False},indent=2),encoding='utf-8')
 print(scene)
