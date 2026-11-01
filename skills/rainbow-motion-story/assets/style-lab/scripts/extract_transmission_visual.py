"""Auditable dense visual study of the cached transmission reference.

Reuse the existing source-frame/PTS/hash extraction implementation. This wrapper
only writes transmission-deep evidence; it never copies the source media.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('transmission_visual_core',ROOT/'scripts/extract_ai_draw.py')
core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
core.SOURCE=ROOT.parents[1]/'video_project/pid_embodied_control/work/v02/references/transmission/media-01.mp4'
core.EXPECTED_SHA256='a53ab07ce45f0bfe0c519b5c5d6dc6c0931f199485c1ff3c1815a09448fa5964'
core.EVIDENCE=ROOT/'evidence/transmission-deep'
core.WORK=ROOT/'work/transmission-deep'

def pages(name,records):
    font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',15)
    heading=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',19)
    output=[]
    for page_no,start in enumerate(range(0,len(records),20),1):
        group=records[start:start+20]
        sheet=Image.new('RGB',(1600,1085),(10,18,25));paint=ImageDraw.Draw(sheet)
        paint.text((14,10),f'TRANSMISSION | {name} | page {page_no:02} | {core.timestamp(group[0]["ptsSeconds"])} - {core.timestamp(group[-1]["ptsSeconds"])}',font=heading,fill=(230,235,235))
        for tile_no,record in enumerate(group):
            x,y=(tile_no%4)*400,42+(tile_no//4)*202
            with Image.open(ROOT/record['rawFrame']) as source:
                image=source.convert('RGB');image.thumbnail((400,174),Image.Resampling.LANCZOS)
                sheet.paste(image,(x+(400-image.width)//2,y+(174-image.height)//2))
            paint.rectangle((x,y+174,x+399,y+201),fill=(21,37,48))
            paint.text((x+6,y+180),f'PTS {record["ptsSeconds"]:10.6f}s n={record["sourceFrameNumber"]:05}',font=font,fill=(232,224,200))
        paint.text((14,1062),'Actual decoded PTS / static evidence, not continuous playback / no audio listening',font=font,fill=(156,177,188))
        target=core.EVIDENCE/f'{name}-page-{page_no:02}.jpg';sheet.save(target,quality=94,subsampling=0)
        page={'file':target.relative_to(ROOT).as_posix(),'sha256':core.sha256(target),'width':1600,'height':1085,'frameCount':len(group),'sourceFrameNumbers':[r['sourceFrameNumber'] for r in group],'ptsRangeSeconds':[group[0]['ptsSeconds'],group[-1]['ptsSeconds']],'reviewStatus':'awaitingReview'}
        output.append(page)
        for record in group:record['sheet']=page['file']
    return output
core.render_pages=pages

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--overview',action='store_true');parser.add_argument('--windows',type=core.windows_from_argument);args=parser.parse_args()
    if not args.overview and not args.windows:parser.error('Use --overview or --windows')
    digest=core.sha256(core.SOURCE)
    if digest!=core.EXPECTED_SHA256:raise ValueError('Source changed')
    stream=core.probe(core.SOURCE)
    core.EVIDENCE.mkdir(parents=True,exist_ok=True);core.WORK.mkdir(parents=True,exist_ok=True)
    target=core.EVIDENCE/'visual-manifest.json'
    manifest=json.loads(target.read_text('utf8')) if target.exists() else {'schema':'motion-atelier.transmission-deep/v1','source':core.SOURCE.as_posix(),'sourceSha256':digest,'sourceStream':stream,'priorReadOnlyEvidence':'evidence/transmission/manifest.json','sourceNotCopied':True,'subjectiveListening':False,'continuousPlaybackThisStudy':False,'groups':[]}
    final=math.ceil(float(stream['duration'])*30)-1
    windows=([[0,float(stream['duration']),150]] if args.overview else [])+(args.windows or [])
    for start,end,step in windows:
        if end>float(stream['duration']):raise ValueError('Outside source')
        safe=lambda value:f'{value:g}'.replace('.','p')
        name=f'visual-{safe(start)}-{safe(end)}-step{step}'
        group=core.extract(name,math.ceil(start*30-1e-9),min(final,math.floor(end*30+1e-9)),step,stream,digest)
        manifest['groups']=[g for g in manifest['groups'] if g['id']!=name]+[group]
        core.write_json(target,manifest)
    print(json.dumps({'groups':len(manifest['groups']),'frames':sum(len(g['frames']) for g in manifest['groups']),'pages':sum(len(g['pages']) for g in manifest['groups'])}))

if __name__=='__main__':main()
