"""Generate small original A/B listening examples; no reference audio sampled."""
from pathlib import Path
import json,hashlib
import numpy as np
from scipy.io import wavfile
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=Path(__file__).resolve().parents[1]
SR=48000;DURATION=10.;t=np.arange(round(SR*DURATION))/SR
def smooth(x):
 x=np.clip(x,0,1);return x*x*x*(x*(x*6-15)+10)
def edge():return smooth(t/.06)*smooth((DURATION-t)/.12)
def voice_gain(t):
 amount=np.zeros_like(t)
 for start,end in [(2.2,4.15),(6.35,8.0)]:amount=np.maximum(amount,smooth((t-(start-.45))/.45)*(1-smooth((t-end)/.85)))
 return 10**(-13*amount/20)
def bed(freqs,phase=0):
 a=sum((1/(i+1))*np.sin(2*np.pi*f*t+phase) for i,f in enumerate(freqs))*.085
 beat=np.mod(t,.5);a+=.14*np.sin(2*np.pi*(58*beat+30*.045*(1-np.exp(-beat/.045))))*np.exp(-beat*22)*smooth(beat/.008)
 return a
def placeholder():
 a=np.zeros_like(t)
 for start,end in [(2.2,4.15),(6.35,8.0)]:
  p=np.maximum(0,t-start);env=smooth(p/.035)*smooth((end-t)/.08);syll=.35+.65*np.sin(np.pi*p/0.22)**2
  a+=env*syll*(.12*np.sin(2*np.pi*135*t)+.085*np.sin(2*np.pi*540*t)+.055*np.sin(2*np.pi*1215*t)+.025*np.sin(2*np.pi*2295*t))
 return a
def main():
 out=ROOT/'examples/audio';out.mkdir(parents=True,exist_ok=True);ev=ROOT/'evidence/audio';ev.mkdir(parents=True,exist_ok=True)
 a=bed([220,330,440]);b=bed([196,294,392],.7);join=5.;width=.75
 # A abrupt phrase change still receives 6ms anti-click microfades.
 hard=a*(1-smooth((t-(join-.006))/.006))*(t<join)+b*smooth((t-join)/.006)*(t>=join)
 w=smooth((t-(join-width/2))/width);soft=np.cos(w*np.pi/2)*a+np.sin(w*np.pi/2)*b
 v=placeholder();music=bed([220,330,440])*.95;duck=voice_gain(t)
 samples={'join-A-abrupt':hard,'join-B-crossfade':soft,'voice-A-no-duck':v+music,'voice-B-preduck':v+music*duck}
 reports=[]
 for name,signal in samples.items():
  signal=signal*edge();signal[0]=signal[-1]=0;pcm=np.round(np.clip(signal,-1,1)*32767).astype('<i2');p=out/(name+'.wav');wavfile.write(p,SR,pcm)
  sr,read=wavfile.read(p);decoded=read/32768.;checks={'finite':bool(np.isfinite(signal).all()),'peakBelowMinus6Db':float(abs(decoded).max())<10**(-6/20),'exactZeroEndpoints':int(read[0])==0 and int(read[-1])==0,'format':sr==SR and read.ndim==1 and len(read)==SR*10,'edge20msPeakBelowMinus20Db':float(max(abs(decoded[:960]).max(),abs(decoded[-960:]).max()))<.1}
  assert all(checks.values()),(name,checks)
  reports.append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'samplePeakDbfs':round(float(20*np.log10(abs(decoded).max())),3),'largestSampleStep':round(float(abs(np.diff(decoded)).max()),6),'firstSample':int(read[0]),'lastSample':int(read[-1]),'checks':checks})
 fig,ax=plt.subplots(3,1,figsize=(12,6),constrained_layout=True)
 for name in ['join-A-abrupt','join-B-crossfade']:
  x=samples[name];hop=480;rms=np.sqrt(np.mean(x.reshape(-1,hop)**2,axis=1));ax[0].plot(t[::hop],20*np.log10(np.maximum(rms,1e-7)),label=name)
 ax[0].set(xlim=(4,6),ylabel='RMS / dBFS');ax[0].legend(fontsize=8)
 ax[1].plot(t[::480],20*np.log10(duck[::480]),color='#398b89');ax[1].set(ylabel='Music gain / dB')
 for start,end in [(2.2,4.15),(6.35,8.0)]:ax[1].axvspan(start,end,color='#d5a45d',alpha=.2)
 ax[2].plot(t[::48],v[::48],color='#b46a46',lw=.6);ax[2].set(ylabel='Voice placeholder',xlabel='seconds')
 for a in ax:a.grid(alpha=.15)
 fig.savefig(ev/'ab-samples.png',dpi=130);plt.close(fig)
 result={'originalSynthesis':True,'referenceAudioSampled':False,'subjectiveListening':False,'description':'Synthetic phrase transitions and formant-like voice occupancy, not intelligible TTS. A abrupt join has6ms anti-click edges; B has750ms equal-power blend. Duck starts450ms before voice placeholder and releases850ms after.','sampleRate':SR,'durationSeconds':10,'samples':reports,'passed':True}
 (ev/'sample-qa.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf8');print(json.dumps(result,ensure_ascii=True))
if __name__=='__main__':main()
