"""Analyze one local soundtrack without copying or classifying its contents.

Requires ffmpeg/ffprobe, numpy, scipy, matplotlib. Decode only the requested
window to memory. A detected transient is not an identified beat or sound effect.
"""
from pathlib import Path
import argparse, hashlib, json, subprocess
import numpy as np
from scipy.signal import stft, find_peaks
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


def sha256(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()


def analyze(source, output, start=0., end=None, visual_events=None):
    source=Path(source).resolve(); output=Path(output); output.mkdir(parents=True,exist_ok=True)
    meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(source)],encoding='utf8'))
    streams=[s for s in meta['streams'] if s['codec_type']=='audio']
    if not streams:raise ValueError('Input has no audio stream')
    duration=float(streams[0].get('duration',0))
    if end is None:end=duration
    if not (0<=start<end) or (duration and end>duration+.1):raise ValueError('Invalid analysis interval')
    sr=16000; hop=160; nfft=1024
    raw=subprocess.run(['ffmpeg','-v','error','-ss',str(start),'-i',str(source),'-t',str(end-start),'-map','0:a:0','-ac','1','-ar',str(sr),'-f','f32le','pipe:1'],capture_output=True,check=True).stdout
    a=np.frombuffer(raw,dtype='<f4').astype(np.float64)
    if len(a)<nfft:raise ValueError('Analysis interval must exceed 64 ms')
    f,t,z=stft(a,fs=sr,nperseg=nfft,noverlap=nfft-hop,boundary=None); t+=start
    mag=np.abs(z); flux=np.mean(np.maximum(0,np.diff(np.log1p(50*mag),axis=1)),axis=0); ft=t[1:]
    threshold=float(np.quantile(flux,.80)); prominence=max(float(np.median(np.abs(flux-np.median(flux))))*.8,1e-8)
    ix,props=find_peaks(flux,height=threshold,prominence=prominence,distance=15)
    events=[{'time':round(float(ft[i]),4),'strength':round(float(flux[i]),7),'windowPercentile':round(float(np.mean(flux<=flux[i])),4),'kind':'unclassified-mixed-track-transient'} for i in ix]
    block=1600; n=len(a)//block; rms=np.sqrt(np.mean(a[:n*block].reshape(n,block)**2,axis=1)); rt=start+(np.arange(n)+.5)*.1; db=20*np.log10(np.maximum(rms,1e-9))
    power=mag**2; bands={}
    for name,lo,hi in [('low_40_250',40,250),('body_250_1000',250,1000),('speech_overlap_1000_4000',1000,4000),('air_4000_7900',4000,7900)]:
        energy=np.sum(power[(f>=lo)&(f<hi)],axis=0); bands[name]=10*np.log10(np.maximum(energy,1e-12))
    visual_events=visual_events or []; neighbors=[]
    for e in visual_events:
        lo=float(e['start']);hi=float(e.get('end',lo));center=(lo+hi)/2
        near=min(events,key=lambda x:abs(x['time']-center)) if events else None
        delta=None if near is None else near['time']-center
        span_distance=None if near is None else max(lo-near['time'],near['time']-hi,0)
        neighbors.append({**e,'nearestTransient':near,'offsetFromWindowCenterSeconds':None if delta is None else round(delta,4),'distanceToVisualIntervalSeconds':None if span_distance is None else round(span_distance,4),'classification':'temporal-neighbor-only; source may be speech, music, or effect','visualTimingUncertaintySeconds':e.get('timingUncertaintySeconds',.1667)})
    intervals=np.diff([e['time'] for e in events]);
    result={'schemaVersion':1,'source':str(source),'sha256':sha256(source),'originalAudio':{k:streams[0].get(k) for k in ['codec_name','sample_rate','channels','duration']},'window':[start,start+len(a)/sr],'sampleRate':sr,'monoAnalysisOnly':True,'subjectiveListening':False,'method':{'rmsWindowSeconds':.1,'fftSize':nfft,'hopSeconds':hop/sr,'onset':'positive log-magnitude spectral flux; local 80th-percentile threshold; minimum 150 ms separation','threshold':threshold,'strengthIsProbability':False,'timeResolutionSeconds':hop/sr,'fftSmearingSeconds':nfft/sr,'beatTrackingPerformed':False},'limits':['Mixed soundtrack; transients may be consonants or music, not identifiable foley.','Band names indicate frequency ranges, not source separation or intelligibility.','Temporal proximity does not establish intentional synchronization.','Mono downmix can cancel stereo components. Use original stereo for listening.'],'summary':{'rmsDbfsPercentiles':{str(p):round(float(np.quantile(db,p/100)),3) for p in [10,50,90]},'samplePeakDbfs':round(float(20*np.log10(max(abs(a).max(),1e-9))),3),'candidateCount':len(events),'medianCandidateIntervalSeconds':round(float(np.median(intervals)),4) if len(intervals) else None},'candidates':events,'visualNeighbors':neighbors,'series':{'rmsTimes':rt.round(4).tolist(),'rmsDbfs':db.round(3).tolist(),'fluxTimes':ft.round(4).tolist(),'flux':flux.round(7).tolist(),'bandTimes':t.round(4).tolist(),'bandPowerDb':{k:v.round(3).tolist() for k,v in bands.items()}}}
    (output/'analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf8')
    fig,axes=plt.subplots(3,1,figsize=(13,7),sharex=True,constrained_layout=True)
    axes[0].plot(rt,db,color='#398b89',lw=1);axes[0].set(ylabel='RMS / dBFS',title=f'{source.parent.name} | mixed soundtrack | {start:g}–{end:g}s')
    axes[1].plot(ft,flux,color='#b46a46',lw=.7);axes[1].axhline(threshold,color='#555',ls='--',lw=.6);axes[1].scatter([e['time'] for e in events],[e['strength'] for e in events],s=13,color='#bd5438');axes[1].set(ylabel='positive flux')
    for name,b in bands.items():axes[2].plot(t,b,lw=.7,label=name)
    axes[2].legend(fontsize=7,ncol=2);axes[2].set(ylabel='band power / dB',xlabel='source time / s')
    for index,e in enumerate(visual_events,1):
        for ax in axes:ax.axvspan(e['start'],e.get('end',e['start']+.01),color='#d5a45d',alpha=.13)
        axes[0].text((e['start']+e.get('end',e['start']))/2,axes[0].get_ylim()[1]-2,f'V{index}',ha='center',fontsize=8)
    for ax in axes:ax.grid(alpha=.15);ax.set_xlim(start,end)
    fig.savefig(output/'signal-analysis.png',dpi=135);plt.close(fig)
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('--out',type=Path,required=True);p.add_argument('--start',type=float,default=0);p.add_argument('--end',type=float);p.add_argument('--visual-events',type=Path,help='JSON list: start, end, label, timingUncertaintySeconds')
    a=p.parse_args();ev=json.loads(a.visual_events.read_text('utf8')) if a.visual_events else []
    r=analyze(a.source,a.out,a.start,a.end,ev);print(json.dumps({'source':str(a.source),'sha256':r['sha256'],'window':r['window'],'summary':r['summary'],'output':str(a.out)},ensure_ascii=True))

if __name__=='__main__':main()
