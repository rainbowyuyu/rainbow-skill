"""Read-only, full-track signal study of Jun reference. No source separation or listening.

Only the designated work/evidence directories are written. No copied soundtrack exports.
Transient times are STFT-window centres, not manually annotated sound onsets.
"""
from pathlib import Path
import argparse
import datetime as dt
import hashlib
import json
import subprocess
import numpy as np
from scipy.signal import stft, find_peaks
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT/'work/jun-emotion-reference'
OUT = ROOT/'evidence/jun-emotion'
SOURCE = WORK/'reference.mp4'


def db(value):
    return 20*np.log10(np.maximum(value, 1e-10))


def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def contiguous_segments(times, enabled, step, minimum):
    result = []
    began = None
    for i, flag in enumerate([*enabled, False]):
        if flag and began is None:
            began = i
        elif not flag and began is not None:
            lo, hi = max(0., times[began]-step/2), times[i-1]+step/2
            if hi-lo >= minimum:
                result.append({'start':round(float(lo),4),'end':round(float(hi),4),'duration':round(float(hi-lo),4)})
            began = None
    return result


def run(visual_events=None, frame_events=None):
    WORK.mkdir(exist_ok=True, parents=True)
    OUT.mkdir(exist_ok=True, parents=True)
    probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(SOURCE)], encoding='utf-8'))
    audio = next(x for x in probe['streams'] if x['codec_type']=='audio')
    video = next(x for x in probe['streams'] if x['codec_type']=='video')
    (WORK/'audio-probe.json').write_text(json.dumps(probe,ensure_ascii=False,indent=2),encoding='utf-8')
    rate = int(audio['sample_rate'])
    raw = subprocess.run(['ffmpeg','-v','error','-i',str(SOURCE),'-map','0:a:0','-ac','2','-ar',str(rate),'-f','f32le','pipe:1'], capture_output=True, check=True).stdout
    stereo = np.frombuffer(raw,dtype='<f4').reshape(-1,2).astype(np.float64)
    declared_duration = float(audio['duration'])
    decoded_duration = len(stereo)/rate
    # Respect declared stream extent; retain decode-padding evidence separately.
    stereo = stereo[:round(declared_duration*rate)]
    duration = len(stereo)/rate
    assert np.isfinite(stereo).all()
    decoded_peak = float(np.max(np.abs(stereo)))
    energy = np.mean(stereo**2,axis=1)
    mono = stereo.mean(axis=1)
    global_rms = float(np.sqrt(energy.mean()))

    # Original stereo energy: no cancellation from summing L+R.
    energy_series = {}
    for ms in [10,100,500]:
        n = round(rate*ms/1000)
        count = len(stereo)//n
        rms = np.sqrt(energy[:count*n].reshape(count,n).mean(axis=1))
        t = (np.arange(count)+.5)*n/rate
        energy_series[str(ms)] = {'times':t.round(6).tolist(),'rmsDbfs':db(rms).round(4).tolist()}

    # Separate analysis decode preserves both channels at a lower spectral rate.
    sr, nfft, hop = 16000, 1024, 160
    raw16 = subprocess.run(['ffmpeg','-v','error','-i',str(SOURCE),'-map','0:a:0','-ac','2','-ar',str(sr),'-t',str(duration),'-f','f32le','pipe:1'],capture_output=True,check=True).stdout
    a16 = np.frombuffer(raw16,dtype='<f4').reshape(-1,2).astype(np.float64)
    channels=[]
    for c in range(2):
        freq,t,z = stft(a16[:,c],fs=sr,nperseg=nfft,noverlap=nfft-hop,boundary=None,padded=False)
        channels.append(np.abs(z)**2)
    power = np.mean(channels,axis=0)
    mag = np.sqrt(power)
    flux = np.mean(np.maximum(0,np.diff(np.log1p(50*mag),axis=1)),axis=0)
    ft = t[1:]
    threshold = float(np.quantile(flux,.80))
    prominence = max(float(np.median(np.abs(flux-np.median(flux))))*.8,1e-8)
    peaks,_ = find_peaks(flux,height=threshold,prominence=prominence,distance=8)
    candidates = [{'id':f'T{i+1:02d}','time':round(float(ft[p]),4),'flux':round(float(flux[p]),7),'withinTrackPercentile':round(float(np.mean(flux<=flux[p])),4),'classification':'unclassified-mixed-track-transient'} for i,p in enumerate(peaks)]
    bands={}
    for name,lo,hi in [('40–250 Hz',40,250),('250–1000 Hz',250,1000),('1000–4000 Hz',1000,4000),('4000–7900 Hz',4000,7900)]:
        bands[name]=10*np.log10(np.maximum(power[(freq>=lo)&(freq<hi)].sum(axis=0),1e-14))

    # Count only candidates from the same global threshold. Counts are not beats.
    bins=[]
    for start in np.arange(0,duration,1.):
        end=min(float(start+1),duration)
        segment=stereo[round(start*rate):round(end*rate)]
        ts=[c['time'] for c in candidates if start<=c['time']<end]
        bins.append({'start':round(float(start),4),'end':round(end,4),'rmsDbfs':round(float(db(np.sqrt(np.mean(segment**2)))),3),'samplePeakDbfs':round(float(db(np.max(np.abs(segment)))),3),'candidateCount':len(ts),'candidatesPerSecond':round(float(len(ts)/(end-start)),3),'candidateTimes':ts,'partialBin':bool(end-start<.99)})
    density=[]
    for center in np.arange(.5,duration-.5+.001,.1):
        count=int(sum(center-.5<=c['time']<center+.5 for c in candidates))
        density.append({'center':round(float(center),3),'window':1.,'count':count})
    # Left/right 0.5s energy contrasts identify changes, not causes.
    change_t=np.arange(.5,duration-.5,.05)
    differences=[]
    for center in change_t:
        left=energy[round((center-.5)*rate):round(center*rate)].mean()
        right=energy[round(center*rate):round((center+.5)*rate)].mean()
        differences.append(10*np.log10(max(right,1e-20)/max(left,1e-20)))
    differences=np.asarray(differences)
    ci,_=find_peaks(abs(differences),height=4.,distance=10)
    changes=[{'time':round(float(change_t[i]),3),'nextHalfSecondMinusPreviousDb':round(float(differences[i]),3),'comparisonWindowSeconds':.5,'classification':'energy-change-not-source-identity'} for i in ci]
    et=np.asarray(energy_series['10']['times']); edb=np.asarray(energy_series['10']['rmsDbfs'])
    quiet=contiguous_segments(et,edb<-40,.01,.12)

    # Read input measurements; no normalized audio output is saved.
    loud=subprocess.run(['ffmpeg','-hide_banner','-i',str(SOURCE),'-map','0:a:0','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
    (WORK/'audio-loudness-ffmpeg.log').write_text(loud.stderr,encoding='utf-8')
    chunk=loud.stderr[loud.stderr.rfind('{'):loud.stderr.rfind('}')+1]
    loud_raw=json.loads(chunk)
    def finite(key):
        value=float(loud_raw[key])
        return value if np.isfinite(value) else None
    loudness={'inputIntegratedLufs':finite('input_i'),'inputTruePeakDbtp':finite('input_tp'),'inputLraLu':finite('input_lra'),'inputGateThresholdLufs':finite('input_thresh'),'method':'FFmpeg loudnorm input fields only, ITU-R BS.1770/EBU R128 based; no processed audio saved','lraInterpretation':'15s short example; not a reliable measure of artistic breath/rhythm or a platform target.'}

    neighbors=[]
    for e in visual_events or []:
        lo=float(e['start']);hi=float(e.get('end',lo));centre=(lo+hi)/2
        nearest=min(candidates,key=lambda c:abs(c['time']-centre)) if candidates else None
        segment=stereo[round(lo*rate):round(hi*rate)]
        inside=[c for c in candidates if lo<=c['time']<hi]
        uncertainty='Parent inspected consecutive frames; frame grid1/30s, spectral window64ms; no subframe synchronization claim.' if 'startFrame' in e else 'Rough parent-observed interval; uncertainty bound unmeasured, exact frame contacts not annotated.'
        neighbors.append({**e,'stereoRmsDbfs':round(float(db(np.sqrt(np.mean(segment**2)))),3),'candidateCount':len(inside),'candidateTimes':[c['time'] for c in inside],'nearestTransient':nearest,'distanceToVisualIntervalSeconds':None if nearest is None else round(max(lo-nearest['time'],nearest['time']-hi,0),4),'offsetFromVisualCentreSeconds':None if nearest is None else round(nearest['time']-centre,4),'relationship':'temporal-proximity-only; does not prove authored synchronization or sound category','uncertaintyNote':uncertainty})

    result={'schemaVersion':1,'createdAt':dt.datetime.now(dt.timezone.utc).isoformat(),'source':str(SOURCE),'sourceUrl':'https://v.douyin.com/7qReAgYmodU/','sourceSha256':hash_file(SOURCE),'scope':'Complete decoded soundtrack, no source separation, no subjective listening, no video viewing by this analysis task','subjectiveListening':False,'audio':{k:audio.get(k) for k in ['codec_name','profile','sample_rate','channels','start_time','duration']},'video':{k:video.get(k) for k in ['codec_name','width','height','avg_frame_rate','nb_frames','duration']},'decodedBeforeTrimSeconds':decoded_duration,'analyzedSeconds':duration,'loudness':loudness,'summary':{'stereoEnergyRmsDbfs':round(float(db(global_rms)),3),'decodedSamplePeakDbfs':round(float(db(decoded_peak)),3),'monoToStereoRmsRatio':round(float(np.sqrt(np.mean(mono**2))/global_rms),5),'transientCandidateCount':len(candidates),'strongestCandidates':sorted(candidates,key=lambda c:c['flux'],reverse=True)[:10],'energyChanges':changes,'quietIntervals':quiet,'quietDefinition':'10ms stereo RMS below -40dBFS for >=120ms; not psychoacoustic silence'},'method':{'nativeStereoEnergy':True,'spectralSampleRate':sr,'fftWindowSeconds':nfft/sr,'hopSeconds':hop/sr,'candidateThresholdPercentile':80,'candidateThreshold':threshold,'candidateMinDistanceSeconds':.08,'candidateProminence':prominence,'candidateTimestamps':'STFT window centres; 64ms temporal smearing, not exact transient starts','candidateStrengthIsProbability':False,'beatTrackingPerformed':False,'sourceSeparationPerformed':False,'densityWindowSeconds':1.,'energyChangeThresholdDb':4.,'energyChangeSideWindowSeconds':.5},'limits':['混合音轨中的瞬态可能来自任意声部，不能从峰值命名具体拟声。','频段能量不是声源分离，也不证明人声清楚程度。','10ms步长不代表10ms事件定位准确度；频谱窗为64ms。','候选阈值和80ms最小间隔会漏掉较弱或过密事件；密度是算法条件下的计数。','本次没有主观听审；不能判断音色、情绪、音乐协调或作者意图。','短片LRA不作为呼吸感评分；响度数字也不是候选审美排名。','本文件是下载编码副本的测量，不代表作者的原始母带。'],'candidates':candidates,'oneSecondBins':bins,'visualNeighbors':neighbors,'series':{'energy':energy_series,'fluxTimes':ft.round(4).tolist(),'flux':flux.round(7).tolist(),'bandTimes':t.round(4).tolist(),'bandEnergyDb':{name:value.round(4).tolist() for name,value in bands.items()},'density':density}}
    frame_neighbors=[]
    for e in frame_events or []:
        event_time=e['frame']/30
        nearest=min(candidates,key=lambda c:abs(c['time']-event_time)) if candidates else None
        frame_neighbors.append({**e,'time':event_time,'nearestTransient':nearest,'candidateMinusVisualSeconds':None if nearest is None else round(nearest['time']-event_time,5),'boundary':'Parent inspected each frame; frame timestamp precision1/30s, flux uses64ms windows. Proximity is not proof of exact authored synchronization.'})
    result['visualFrameEvents']=frame_neighbors
    (OUT/'audio-analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')

    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9})
    fig,axes=plt.subplots(4,1,figsize=(15,9),sharex=True,constrained_layout=True)
    stride=max(1,len(stereo)//6000);count=int(np.ceil(len(stereo)/stride));times=[];mins=[];maxs=[]
    for i in range(count):
        block=stereo[i*stride:min((i+1)*stride,len(stereo))]
        times.append((i*stride+len(block)/2)/rate);mins.append(block.min(axis=0));maxs.append(block.max(axis=0))
    mins=np.array(mins);maxs=np.array(maxs)
    axes[0].fill_between(times,mins[:,0],maxs[:,0],lw=0,color='#348b97',alpha=.72,label='L min/max')
    axes[0].fill_between(times,mins[:,1],maxs[:,1],lw=0,color='#d9a55b',alpha=.32,label='R min/max')
    axes[0].set(ylabel='Amplitude',ylim=(-decoded_peak*1.12,decoded_peak*1.12))
    axes[0].set_title('Jun reference | full soundtrack signal study | no subjective listening',pad=18)
    axes[0].legend(loc='lower left',ncol=2)
    er=energy_series['100'];axes[1].plot(er['times'],er['rmsDbfs'],color='#3b8178',lw=1.1)
    axes[1].set(ylabel='Stereo RMS / dBFS',ylim=(-70,0))
    for item in quiet:axes[1].axvspan(item['start'],item['end'],color='#8291aa',alpha=.2)
    axes[2].plot(ft,flux,lw=.7,color='#855ea1');axes[2].axhline(threshold,color='#888',lw=.7,ls='--')
    axes[2].scatter([c['time'] for c in candidates],[c['flux'] for c in candidates],s=13,color='#b76048')
    for i,c in enumerate(sorted(sorted(candidates,key=lambda x:x['flux'],reverse=True)[:8],key=lambda x:x['time'])):
        axes[2].annotate(f"{c['id']} {c['time']:.2f}",(c['time'],c['flux']),xytext=(0,9+12*(i%2)),textcoords='offset points',ha='center',fontsize=7)
    axes[2].set_ylim(0,float(flux.max())*1.27)
    axes[2].set(ylabel='Positive spectral flux')
    axes[3].step([x['center'] for x in density],[x['count'] for x in density],where='mid',color='#ba7749')
    axes[3].set(ylabel='Candidates / 1s',xlabel='Source time / seconds',ylim=(0,max([x['count'] for x in density],default=1)+1))
    for i,e in enumerate(visual_events or [],1):
        for ax in axes:ax.axvspan(e['start'],e.get('end',e['start']+.01),color='#b6c8d6',alpha=.12)
        axes[0].text((e['start']+e.get('end',e['start']))/2,.96,f'V{i}',transform=axes[0].get_xaxis_transform(),ha='center',va='top',fontsize=8)
    for ax in axes:ax.grid(alpha=.15);ax.set_xlim(0,duration)
    fig.savefig(OUT/'audio-signal.png',dpi=150);plt.close(fig)
    fig,ax=plt.subplots(figsize=(15,4),constrained_layout=True)
    for name,value in bands.items():ax.plot(t,value,lw=.8,label=name)
    ax.legend(ncol=4);ax.set(xlabel='Source time / seconds',ylabel='STFT band energy / relative dB',title='Mixed-track frequency bands — not identified sources',xlim=(0,duration));ax.grid(alpha=.15)
    fig.savefig(OUT/'audio-band-energy.png',dpi=150);plt.close(fig)
    validation={'finitePcm':bool(np.isfinite(stereo).all()),'nativeChannels':2,'allCandidatesWithinAnalyzedWindow':all(0<=c['time']<=duration for c in candidates),'seriesLengthsMatch':len(ft)==len(flux),'sourceUnmodified':hash_file(SOURCE)==result['sourceSha256'],'subjectiveListening':False,'numericOnly':True}
    validation['passed']=all(validation[x] for x in ['finitePcm','allCandidatesWithinAnalyzedWindow','seriesLengthsMatch','sourceUnmodified'])
    (OUT/'audio-analysis-validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'summary':result['summary'],'loudness':loudness,'output':str(OUT),'validation':validation},ensure_ascii=True))
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--visual-events',type=Path)
    parser.add_argument('--frame-events',type=Path)
    args=parser.parse_args()
    events=json.loads(args.visual_events.read_text(encoding='utf-8')) if args.visual_events else None
    frame_events=json.loads(args.frame_events.read_text(encoding='utf-8')) if args.frame_events else None
    run(events,frame_events)
