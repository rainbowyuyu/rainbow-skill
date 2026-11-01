"""PTS-indexed camera/depth study. Does not copy the source video.

--overview: source-frame sampling every 2 seconds.
--windows '[[300,320,10]]': inclusive seconds, step in source frames.
"""
from pathlib import Path
from fractions import Fraction
import argparse,importlib.util,json,math,subprocess
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('camera_depth_core',ROOT/'scripts/extract_ai_draw.py')
core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
ref=next(r for r in json.loads((ROOT/'lab/references.json').read_text('utf8'))['references'] if r['id']=='camera')
core.SOURCE=Path(ref['sourceVideo']);core.EXPECTED_SHA256=ref['sourceSha256']
core.EVIDENCE=ROOT/'evidence/camera-depth';core.WORK=ROOT/'work/camera-depth'

def probe():
    stream=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,avg_frame_rate,time_base,start_pts,duration','-of','json',str(core.SOURCE)],encoding='utf8'))['streams'][0]
    assert stream['avg_frame_rate']==stream['r_frame_rate']=='25/1' and stream['start_pts']==512
    return stream

def pages(name,records):
    font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',16);out=[]
    for no,start in enumerate(range(0,len(records),20),1):
        group=records[start:start+20];sheet=Image.new('RGB',(1600,1320),'#101923');draw=ImageDraw.Draw(sheet)
        draw.text((14,8),f'CAMERA / {name} / page {no} / actual source PTS',font=font,fill='#eeece3')
        for i,r in enumerate(group):
            x,y=i%4*400,35+i//4*252
            with Image.open(ROOT/r['rawFrame']) as im:sheet.paste(im.resize((400,225),Image.Resampling.LANCZOS),(x,y))
            draw.text((x+6,y+229),f'{r["ptsSeconds"]:9.3f}s n={r["sourceFrameNumber"]:05}',font=font,fill='#eeece3')
        draw.text((14,1300),'Static samples only. No original lens/aperture/engine recovery; no listening.',font=font,fill='#aabbcc')
        path=core.EVIDENCE/f'{name}-page-{no:02}.jpg';sheet.save(path,quality=94,subsampling=0)
        page={'file':path.relative_to(ROOT).as_posix(),'sha256':core.sha256(path),'sourceFrameNumbers':[r['sourceFrameNumber'] for r in group],'ptsRangeSeconds':[group[0]['ptsSeconds'],group[-1]['ptsSeconds']],'frameCount':len(group),'reviewStatus':'awaitingReview'}
        for r in group:r['sheet']=page['file']
        out.append(page)
    return out
core.render_pages=pages

def extract(name,first,last,step,stream,digest):
    directory=core.WORK/name;cached=directory/'frames.json'
    if cached.exists():return json.loads(cached.read_text('utf8'))
    directory.mkdir(parents=True,exist_ok=True)
    if list(directory.glob('frame-*.jpg')):raise FileExistsError('Unmanifested evidence exists')
    vf=f'showinfo@source,select=between(n\\,{first}\\,{last})*not(mod(n-{first}\\,{step})),showinfo@selected'
    command=['ffmpeg','-hide_banner','-loglevel','info','-n','-copyts','-i',str(core.SOURCE),'-map','0:v:0','-vf',vf,'-fps_mode','passthrough','-an','-q:v','3',str(directory/'frame-%05d.jpg')]
    result=subprocess.run(command,capture_output=True,encoding='utf8',errors='replace');(directory/'ffmpeg-showinfo.log').write_text(result.stderr,encoding='utf8');core.write_json(directory/'command.json',{'argv':command,'copyts':True})
    if result.returncode:raise RuntimeError('ffmpeg failed')
    original={};selected=[]
    for kind,n,pts,shown in core.SHOWINFO.findall(result.stderr):
        row={'n':int(n),'pts':int(pts),'shown':shown}
        if kind=='source':original[row['pts']]=row
        else:selected.append(row)
    files=sorted(directory.glob('frame-*.jpg'));assert len(files)==len(selected)==len(range(first,last+1,step))
    records=[]
    for path,s in zip(files,selected):
        r=original[s['pts']];exact=r['pts']*Fraction(stream['time_base'])
        assert exact==Fraction(stream['start_pts'])*Fraction(stream['time_base'])+Fraction(r['n'],25)
        records.append({'sourceFrameNumber':r['n'],'pts':r['pts'],'timeBase':stream['time_base'],'ptsSecondsRational':str(exact),'ptsSeconds':float(exact),'sourceElapsedSeconds':r['n']/25,'showinfoPtsTime':r['shown'],'rawFrame':path.relative_to(ROOT).as_posix(),'rawFrameSha256':core.sha256(path),'rawSize':[stream['width'],stream['height']]})
    group={'id':name,'sourceSha256':digest,'frameSelection':[first,last,step],'sourceFrameStep':step,'nominalSamplingIntervalSeconds':step/25,'samplingMethod':'-copyts preserves source PTS; pre/post-select showinfo match','decodedFrameCount':len(original),'frames':records,'pages':pages(name,records),'reviewStatus':'awaitingReview'}
    core.write_json(cached,group);print(json.dumps({'completed':name,'frames':len(records),'pages':len(group['pages'])}),flush=True);return group

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--overview',action='store_true');p.add_argument('--windows',type=core.windows_from_argument);p.add_argument('--verify',action='store_true');args=p.parse_args()
    digest=core.sha256(core.SOURCE);assert digest==core.EXPECTED_SHA256
    stream=probe();rate=Fraction(stream['avg_frame_rate']);core.EVIDENCE.mkdir(parents=True,exist_ok=True);core.WORK.mkdir(parents=True,exist_ok=True)
    path=core.EVIDENCE/'visual-manifest.json';manifest=json.loads(path.read_text('utf8')) if path.exists() else {'schema':'motion-atelier.camera-depth/v1','source':core.SOURCE.as_posix(),'sourceSha256':digest,'sourceStream':stream,'sourceNotCopied':True,'subjectiveListening':False,'continuousPlaybackByThisExtractor':False,'groups':[]}
    final=math.ceil(float(stream['duration'])*float(rate))-1
    windows=([[0,float(stream['duration']),50]] if args.overview else [])+(args.windows or [])
    for start,end,step in windows:
        assert end<=float(stream['duration'])
        safe=lambda x:f'{x:g}'.replace('.','p');name=f'visual-{safe(start)}-{safe(end)}-step{step}'
        offset=stream['start_pts']*float(Fraction(stream['time_base']))
        group=extract(name,max(0,math.ceil((start-offset)*float(rate)-1e-9)),min(final,math.floor((end-offset)*float(rate)+1e-9)),step,stream,digest)
        # Shared extraction core retains exact source PTS but has an AI-draw 30fps nominal interval; correct this metadata for camera's measured rate.
        group['nominalSamplingIntervalSeconds']=float(Fraction(step,1)/rate)
        core.write_json(core.EVIDENCE/f'{name}.json',group);core.write_json(core.WORK/name/'frames.json',group)
        manifest['groups']=[g for g in manifest['groups'] if g['id']!=name]+[group];core.write_json(path,manifest)
    if args.verify:
        unique={};page_count=0;records=0
        for g in manifest['groups']:
            assert g['nominalSamplingIntervalSeconds']==float(Fraction(g['sourceFrameStep'],1)/rate)
            assert [r['sourceFrameNumber'] for r in g['frames']]==list(range(g['frameSelection'][0],g['frameSelection'][1]+1,g['sourceFrameStep']))
            for r in g['frames']:
                records+=1;assert r['pts']*Fraction(r['timeBase'])==Fraction(r['ptsSecondsRational'])
                assert abs(float(Fraction(r['ptsSecondsRational']))-r['ptsSeconds'])<1e-12
                assert core.sha256(ROOT/r['rawFrame'])==r['rawFrameSha256'];assert r['rawSize']==[stream['width'],stream['height']]
                unique[r['sourceFrameNumber']]=r
            for page in g['pages']:
                page_count+=1;assert core.sha256(ROOT/page['file'])==page['sha256']
        qa={'passed':True,'sourceHashVerified':True,'frameRecords':records,'uniqueFrames':len(unique),'pageHashes':page_count,'scope':'Evidence integrity only. Static visual review and browser playback are separate records.'};core.write_json(core.EVIDENCE/'qa.json',qa);print(json.dumps(qa))
    print(json.dumps({'groups':len(manifest['groups']),'frames':sum(len(g['frames']) for g in manifest['groups']),'pages':sum(len(g['pages']) for g in manifest['groups'])}))
if __name__=='__main__':main()
