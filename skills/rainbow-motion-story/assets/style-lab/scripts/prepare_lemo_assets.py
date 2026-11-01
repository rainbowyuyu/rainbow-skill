"""Cache the pinned, licensed reference stills; never execute upstream code."""
import concurrent.futures,hashlib,json,urllib.request,time
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'work/lemo-study'
OUT=ROOT/'evidence/lemo-opuscar'
data=json.loads((SRC/'discovery.json').read_text('utf-8'))
tree={x['path']:x for x in data['tree']}
catalog=json.loads((SRC/'upstream/styleboard/catalog.json').read_text('utf-8'))
paths=[f"docs/frames/{x['slug']}.jpg" for x in catalog]+[f'styleboard/img/opuscar98/{n:02}.jpg' for n in range(1,99)]
def fetch(path):
    meta=tree[path]; dest=OUT/'stills'/('ready-'+Path(path).name if path.startswith('docs') else 'film-'+Path(path).name)
    dest.parent.mkdir(parents=True,exist_ok=True)
    url=f"https://raw.githubusercontent.com/lemomo-ai/lemo-opuscar/{data['commit']}/{path}"
    for attempt in range(3):
        try:
            blob=dest.read_bytes() if dest.exists() else urllib.request.urlopen(url,timeout=50).read()
            assert hashlib.sha1(b'blob '+str(len(blob)).encode()+b'\0'+blob).hexdigest()==meta['sha']
            dest.write_bytes(blob)
            return {'source':path,'local':str(dest.relative_to(ROOT)).replace('\\','/'),'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'url':url}
        except Exception:
            if attempt==2:raise
            time.sleep(1)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex: rows=list(ex.map(fetch,paths))
(OUT/'stills-manifest.json').write_text(json.dumps({'commit':data['commit'],'license':'CC BY 4.0; LemoLab; contact sheets resize originals; no motion/audio verification implied','files':rows},ensure_ascii=False,indent=2),'utf-8')
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
for batch in range(0,len(rows),20):
    part=rows[batch:batch+20]; sheet=Image.new('RGB',(1600,4*259),(20,23,27));draw=ImageDraw.Draw(sheet)
    for i,row in enumerate(part):
        img=Image.open(ROOT/row['local']).convert('RGB');img.thumbnail((388,220));x=(i%4)*400;y=(i//4)*207
        # Five rows, 4 columns. Each thumbnail 16:9 at 352x198 plus label.
        img.thumbnail((380,177));sheet.paste(img,(x+8,y+24));draw.text((x+8,y+3),Path(row['local']).stem,font=font,fill='#ebd5b8')
    sheet.save(OUT/f'contact-{batch//20+1:02}.jpg',quality=90)
print(json.dumps({'stills':len(rows),'bytes':sum(x['bytes'] for x in rows),'contactSheets':8}))
