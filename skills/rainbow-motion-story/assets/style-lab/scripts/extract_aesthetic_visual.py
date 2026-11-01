"""Extract PTS-verified aesthetic-reference study frames without copying its video.

--overview samples the entire reference every ten decoded source frames (3 fps).
--windows takes [startSeconds,endSeconds,stepFrames] triples with inclusive ends.
"""
from __future__ import annotations
import argparse
import importlib.util
import math
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('aesthetic_visual_core',ROOT/'scripts/extract_ai_draw.py')
core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
core.SOURCE=ROOT.parents[1]/'video_project/pid_embodied_control/work/v02/references/aesthetic/media-01.mp4'
core.EXPECTED_SHA256='ed9e361ef27fb8491e83bf4e647ed717c0c90af5e6ecf31abab90c13fd4e3529'
core.EVIDENCE=ROOT/'evidence/aesthetic-deep'
core.WORK=ROOT/'work/aesthetic-deep'

def pages(name,records):
    font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',15)
    heading=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',19)
    output=[]
    for page_no,start in enumerate(range(0,len(records),20),1):
        group=records[start:start+20]
        sheet=Image.new('RGB',(1600,1185),(10,18,25));paint=ImageDraw.Draw(sheet)
        paint.text((14,10),f'AESTHETIC | {name} | page {page_no:02} | {core.timestamp(group[0]["ptsSeconds"])} - {core.timestamp(group[-1]["ptsSeconds"])}',font=heading,fill=(230,235,235))
        for tile_no,record in enumerate(group):
            x,y=(tile_no%4)*400,42+(tile_no//4)*222
            with Image.open(ROOT/record['rawFrame']) as source:
                image=source.convert('RGB');image.thumbnail((400,194),Image.Resampling.LANCZOS)
                sheet.paste(image,(x+(400-image.width)//2,y+(194-image.height)//2))
            paint.rectangle((x,y+194,x+399,y+221),fill=(21,37,48))
            paint.text((x+6,y+200),f'PTS {record["ptsSeconds"]:10.6f}s n={record["sourceFrameNumber"]:04}',font=font,fill=(232,224,200))
        paint.text((14,1162),'Actual decoded PTS / static evidence, not continuous playback / no audio listening',font=font,fill=(156,177,188))
        target=core.EVIDENCE/f'{name}-page-{page_no:02}.jpg';sheet.save(target,quality=94,subsampling=0)
        page={'file':target.relative_to(ROOT).as_posix(),'sha256':core.sha256(target),'width':1600,'height':1185,'frameCount':len(group),'sourceFrameNumbers':[r['sourceFrameNumber'] for r in group],'ptsRangeSeconds':[group[0]['ptsSeconds'],group[-1]['ptsSeconds']],'reviewStatus':'awaitingReview'}
        output.append(page)
        for record in group:record['sheet']=page['file']
    return output
core.render_pages=pages

def measure(manifest):
    """Coarse file-pixel descriptors, not physical luminance or aesthetic scores."""
    import numpy as np
    unique={}
    for group in manifest['groups']:
        for record in group['frames']:unique.setdefault(record['sourceFrameNumber'],record)
    measurements=[]
    for number,record in sorted(unique.items()):
        with Image.open(ROOT/record['rawFrame']) as source:
            rgb=np.asarray(source.convert('RGB'),dtype=np.float32)/255
            hsv=np.asarray(source.convert('HSV'),dtype=np.float32)
        code_luma=rgb@np.array([.2126,.7152,.0722],dtype=np.float32)
        hue=hsv[:,:,0]*360/255;saturation=hsv[:,:,1]/255;value=hsv[:,:,2]/255
        warm=(((hue<=65)|(hue>=345))&(saturation>=.35)&(value>=.25))
        cool=((hue>=180)&(hue<=250)&(saturation>=.2)&(value>=.25))
        measurements.append({'sourceFrameNumber':number,'ptsSeconds':record['ptsSeconds'],
          'rawFrame':record['rawFrame'],'rawFrameSha256':record['rawFrameSha256'],
          'darkCodeArea':float(np.mean(code_luma<=.15)),
          'brightCodeArea':float(np.mean(code_luma>=.75)),
          'warmHueArea':float(np.mean(warm)),'coolHueArea':float(np.mean(cool)),
          'codeLumaQuantiles':{str(q):float(np.quantile(code_luma,q)) for q in [.1,.5,.9]}})
    overview=next(g for g in manifest['groups'] if g['sourceFrameStep']==10)
    indices={record['sourceFrameNumber'] for record in overview['frames']}
    uniform=[row for row in measurements if row['sourceFrameNumber'] in indices]
    result={'schema':'motion-atelier.aesthetic-color/v1','sourceSha256':manifest['sourceSha256'],
      'method':{'dimensions':'Full extracted source frame, no crop, no resizing; JPEG source-frame proxy',
      'codeLuma':'0.2126 R + 0.7152 G + 0.0722 B on gamma-encoded RGB / 255; NOT linear-light luminance',
      'dark':'codeLuma <= 0.15','bright':'codeLuma >= 0.75',
      'warm':'HSV hue <=65 or >=345 degrees; saturation >=0.35; value >=0.25',
      'cool':'HSV hue 180..250 degrees; saturation >=0.20; value >=0.25',
      'limits':'Threshold areas describe image pixels only; dark area is not semantic empty space. Not an aesthetic score, color grade recovery, physical illumination measurement or object segmentation.'},
      'uniqueFrames':len(measurements),'uniformOverviewCount':len(uniform),'uniformSamplingStepSeconds':1/3,
      'uniformOverviewMedian':{key:float(np.median([row[key] for row in uniform])) for key in ['darkCodeArea','brightCodeArea','warmHueArea','coolHueArea']},
      'frames':measurements}
    core.write_json(core.EVIDENCE/'color-metrics.json',result)
    width,height=1600,920
    chart=Image.new('RGB',(width,height),(14,19,27));draw=ImageDraw.Draw(chart)
    font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',20);small=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',15)
    draw.text((45,24),'FILE-PIXEL AREA OVER TIME | full-clip overview sampled at 3 fps',font=font,fill='#e6e5df')
    colors=['#94a8bd','#f4ecd7','#eab36f','#77bddb']
    fields=['darkCodeArea','brightCodeArea','warmHueArea','coolHueArea']
    for index,(key,color) in enumerate(zip(fields,colors)):
        top=90+index*185;bottom=top+135
        draw.text((45,top-26),key,font=small,fill=color)
        for fraction in [0,.5,1]:
            y=bottom-fraction*135
            draw.line([(125,y),(1550,y)],fill='#29313b',width=1)
            draw.text((60,y-8),f'{fraction*100:3.0f}%',font=small,fill='#97a5b2')
        points=[(125+row['ptsSeconds']/float(manifest['sourceStream']['duration'])*1425,bottom-row[key]*135) for row in uniform]
        draw.line(points,fill=color,width=3)
        for x,y in points:draw.ellipse((x-2,y-2,x+2,y+2),fill=color)
        for t in [0,5,10,15,20,25]:draw.text((125+t/float(manifest['sourceStream']['duration'])*1425-8,bottom+9),f'{t}s',font=small,fill='#97a5b2')
    draw.text((45,866),'Thresholds are explicit in color-metrics.json. Dark pixels are not automatically empty space.',font=small,fill='#b6bec8')
    draw.text((45,891),'Gamma-coded image descriptors; not physical luminance, a style score, or continuous-playback evidence.',font=small,fill='#b6bec8')
    chart.save(core.EVIDENCE/'color-area-timeline.png')
    print(json.dumps({'colorMetrics':len(measurements),'uniformOverviewMedian':result['uniformOverviewMedian']}))

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--overview',action='store_true');parser.add_argument('--windows',type=core.windows_from_argument);parser.add_argument('--measure',action='store_true');args=parser.parse_args()
    if not args.overview and not args.windows and not args.measure:parser.error('Use --overview, --windows or --measure')
    digest=core.sha256(core.SOURCE)
    if digest!=core.EXPECTED_SHA256:raise ValueError('Source changed')
    stream=core.probe(core.SOURCE)
    core.EVIDENCE.mkdir(parents=True,exist_ok=True);core.WORK.mkdir(parents=True,exist_ok=True)
    target=core.EVIDENCE/'visual-manifest.json'
    manifest=json.loads(target.read_text('utf8')) if target.exists() else {'schema':'motion-atelier.aesthetic-deep/v1','source':core.SOURCE.as_posix(),'sourceSha256':digest,'sourceStream':stream,'priorReadOnlyEvidence':'evidence/aesthetic/manifest.json','sourceNotCopied':True,'subjectiveListening':False,'continuousPlaybackThisStudy':False,'groups':[]}
    if manifest['sourceSha256']!=digest:raise ValueError('Manifest source differs')
    final=math.ceil(float(stream['duration'])*30)-1
    windows=([[0,float(stream['duration']),10]] if args.overview else [])+(args.windows or [])
    for start,end,step in windows:
        if end>float(stream['duration']):raise ValueError('Outside source')
        safe=lambda value:f'{value:g}'.replace('.','p')
        name=f'visual-{safe(start)}-{safe(end)}-step{step}'
        group=core.extract(name,math.ceil(start*30-1e-9),min(final,math.floor(end*30+1e-9)),step,stream,digest)
        manifest['groups']=[g for g in manifest['groups'] if g['id']!=name]+[group]
        core.write_json(target,manifest)
    if args.measure:
        if not manifest['groups']:raise ValueError('Extract --overview before measurement')
        measure(manifest)
    print(json.dumps({'groups':len(manifest['groups']),'frames':sum(len(g['frames']) for g in manifest['groups']),'pages':sum(len(g['pages']) for g in manifest['groups'])}))

if __name__=='__main__':main()
