/** Original procedural sound studies. No samples, voice or soundtrack assets.
 * The event is the clock: onset, peak, contact and end refer to object actions.
 * UI playback must use AudioContext.currentTime; synthesis is deterministic.
 */
export const SAMPLE_RATE=48000;
const TAU=2*Math.PI;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{const x=clamp(v);return x*x*x*(x*(x*6-15)+10);};
const smoothDerivative=v=>v<=0||v>=1?0:30*v*v*(v-1)*(v-1);
const db=v=>10**(v/20);
const clone=v=>JSON.parse(JSON.stringify(v));
const event=(id,kind,onset,peak,contact,end,priority=1)=>({id,kind,onset,peak,contact,end,priority});
const pair=(a,b)=>[{id:'A',title:a[0],description:a[1]},{id:'B',title:b[0],description:b[1]}];

export const sounds=[
  {id:'metal-contact',title:'金属接触',description:'非整数倍模态与短促噪声；不是任何真实金属的测量录音。',duration:.55},
  {id:'wood-contact',title:'木质轻碰',description:'低频空腔与快速衰减；用于轻接触，不模拟具体木种。',duration:.28},
  {id:'air-passby',title:'空气掠过',description:'滤波噪声随接近/远离起伏，可映射速度和声像。',duration:1.1},
  {id:'air-rise',title:'空气预备',description:'逐渐明亮的噪声上扬，峰值后短促收尾。',duration:.85},
  {id:'ui-confirm',title:'状态确认',description:'短双音确认，用于完成而不是每次运动。',duration:.35},
  {id:'servo',title:'伺服转动',description:'连续转动的基音/谐波与低量噪声，可映射转速。',duration:1.2},
  {id:'low-impact',title:'低频落定',description:'柔和降频的低频冲击，保留可听谐波。',duration:.5},
  {id:'room-air',title:'空间空气',description:'低强度滤波噪声作为连续空间底色。',duration:8}
];
const soundIds=new Set(sounds.map(s=>s.id));

export const scenes=[
  {id:'contact-sync',title:'声音落在接触的哪一帧',question:'同一个落定动作，晚180毫秒和对准接触有什么区别？',duration:8,
    variants:pair(['延后180ms','只改变接触声的时间，材料、增益、声像保持相同。'],['对准接触','短攻击段从接触时刻开始；主要瞬态另行测量。']),
    events:[event('metal-seat','metal',.9,1.65,2,2.65),event('wood-seat','wood',3.8,4.55,4.9,5.5)],speechWindows:[],readWindows:[]},
  {id:'cue-density',title:'每个动作都有声，还是只听见结果',question:'同一组装配动作，哪些声音值得留下？',duration:8,
    variants:pair(['每个动作都触发','全部小动作、移动和完成都出现音效。'],['只留下因果重点','保留主要接触与最终确认，次要动作安静完成。']),
    events:[event('slide-1','move',.5,.85,1.1,1.25,.25),event('slide-2','move',1,1.35,1.6,1.75,.25),event('slide-3','move',1.5,1.85,2.1,2.25,.3),event('joint-1','metal',2.2,2.6,2.9,3.2,.9),event('slide-4','move',3,3.35,3.6,3.75,.25),event('joint-2','wood',3.8,4.2,4.5,4.9,.85),event('rotate','servo',4.85,5.35,5.85,6.05,.35),event('complete','confirm',6,6.3,6.55,6.75,1)],speechWindows:[],readWindows:[]},
  {id:'tail-control',title:'落定以后，把空间还给阅读',question:'同一个金属落定后，长尾还是短尾更适合读公式？',duration:8,
    variants:pair(['长尾持续','同一模态和初始增益，衰减延续2.8秒。'],['短尾落定','同一模态和初始增益，衰减缩短到0.42秒。']),
    events:[event('seat','metal',.8,1.45,1.8,2.3)],speechWindows:[],readWindows:[{start:2.25,end:5.6,label:'公式阅读窗口'}]},
  {id:'velocity-mapping',title:'速度应该听得出来',question:'连续空气声与转动声，能否同时表达加速、经过和减速？',duration:8,
    variants:pair(['均匀参数','声音起止相同，频谱与声像保持不变。'],['跟随运动','频率、响度和左右声像读取同一条动作进度曲线。']),
    events:[event('pass','passby',.75,2.3,2.3,3.85),event('turn','servo',4.3,5.4,5.4,6.5)],speechWindows:[],readWindows:[]},
  {id:'narration-space',title:'音效知道什么时候退后',question:'读字与讲解时，音效如何让出空间？',duration:8,
    variants:pair(['始终占满','保留全部音效强度和低优先级装饰。'],['提前让位','讲解前预降、结束后缓慢恢复；阅读时移除低优先级装饰。']),
    events:[event('prepare','rise',.35,.95,.95,1.1,.4),event('first-seat','metal',1.2,1.65,1.9,2.35,.9),event('decorative-pass','passby',2.75,3.35,3.35,3.95,.2),event('turn','servo',4.2,4.9,4.9,5.7,.75),event('done','confirm',6.1,6.4,6.5,6.65,1)],
    speechWindows:[{start:1.4,end:2.6,label:'讲解窗口1'},{start:4.35,end:5.75,label:'讲解窗口2'}],readWindows:[{start:2.85,end:3.9,label:'公式阅读窗口'}],
    placeholderNotice:'可选参考声为无语义合成信号，不是人声、TTS或语音可懂度测试。'}
];
const byId=Object.fromEntries(scenes.map(s=>[s.id,s]));
const active=(t,windows)=>windows.some(w=>t>=w.start&&t<w.end);
const motion=(t,e)=>{const duration=e.end-e.onset,p=clamp((t-e.onset)/duration);return {progress:smooth(p),speed:smoothDerivative(p)/duration,normalSpeed:smoothDerivative(p)/1.875};};

export function visualState(sceneId,time){
  const scene=byId[sceneId];if(!scene)throw Error(`Unknown sound scene: ${sceneId}`);
  const t=clamp(Number(time)||0,0,scene.duration);
  const events=scene.events.map(e=>({...e,...motion(t,e),contactPulse:Math.exp(-(((t-e.contact)/.085)**2))}));
  const current=events.find(e=>t>=e.onset&&t<=e.end)||[...events].reverse().find(e=>t>e.end)||events[0];
  let x=0,y=0,angle=0;
  if(current.kind==='passby'||current.kind==='move'){x=-1+2*current.progress;y=.12*Math.sin(Math.PI*current.progress);}
  else if(current.kind==='servo'){angle=TAU*current.progress;x=.1*Math.sin(angle);}
  else{const approach=smooth((t-current.onset)/(current.contact-current.onset));y=1-approach;x=current.kind==='wood'?.45:-.45;}
  return {time:t,events,currentEventId:current.id,stage:t<current.onset?'预备':t<current.contact?'动作':t<current.end?'接触 / 落定':'观察',object:{x,y,angle},speechActive:active(t,scene.speechWindows),readActive:active(t,scene.readWindows)};
}

function validateOptions(options){
  const sampleRate=options.sampleRate??SAMPLE_RATE,offsetMs=options.offsetMs??0,gainDb=options.gainDb??0,intensity=options.intensity??1;
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw Error('sampleRate must be an integer in8000..192000');
  if(!Number.isFinite(offsetMs)||Math.abs(offsetMs)>1000)throw Error('offsetMs must be within ±1000');
  if(!Number.isFinite(gainDb)||gainDb< -36||gainDb>12)throw Error('gainDb must be in-36..12');
  if(!Number.isFinite(intensity)||intensity<0||intensity>1.5)throw Error('intensity must be in0..1.5');
  return {sampleRate,offsetMs,gainDb,intensity,includeSpeechPlaceholder:options.includeSpeechPlaceholder===true};
}

function soundFor(e){return {metal:'metal-contact',wood:'wood-contact',move:'air-passby',passby:'air-passby',rise:'air-rise',servo:'servo',confirm:'ui-confirm'}[e.kind]||'low-impact';}
function cueFor(e,index){
  const sound=soundFor(e),moving=['air-passby','servo','air-rise'].includes(sound);
  const duration=moving?e.end-e.onset:sound==='wood-contact'?.28:sound==='ui-confirm'?.35:.55;
  const anchor=sound==='ui-confirm'?'end':sound==='air-passby'||sound==='air-rise'?'peak':sound==='servo'?'onset':'contact';
  const anchorTime=e[anchor],anchorOffset=moving&&anchor==='peak'?e.peak-e.onset:0;
  return {id:`${e.id}:${sound}`,sound,eventId:e.id,anchor,anchorTime,anchorOffset,start:anchorTime-anchorOffset,duration,priority:e.priority,gain:sound==='servo'?.12:sound==='air-passby'?.16:sound==='ui-confirm'?.13:.28,pan:0,seed:1709+index*7919,params:{peakFraction:duration?anchorOffset/duration:0,motionStart:e.onset,motionEnd:e.end,mapping:false},policy:'full'};
}

export function getScenePlan(sceneId,variant='B',options={}){
  const source=byId[sceneId];if(!source)throw Error(`Unknown sound scene: ${sceneId}`);
  if(!['A','B'].includes(variant))throw Error('variant must be A or B');
  const scene=clone(source),o=validateOptions(options),excludedCues=[];
  let cues=scene.events.map(cueFor);
  // Both variants share the same low-level environment. No A/B loudness matching.
  cues.unshift({id:'environment',sound:'room-air',eventId:null,anchor:'onset',anchorTime:0,anchorOffset:0,start:0,duration:scene.duration,priority:.1,gain:.026,pan:0,seed:45671,params:{},policy:'space'});
  if(sceneId==='contact-sync'&&variant==='A')for(const c of cues)if(c.eventId)c.start+=.18;
  if(sceneId==='cue-density'&&variant==='B')cues=cues.filter(c=>{if(c.eventId&&c.priority<.65){excludedCues.push({...c,reason:'secondary action: no new causal information'});return false;}return true;});
  if(sceneId==='tail-control'){
    const c=cues.find(c=>c.eventId==='seat');c.duration=variant==='A'?2.8:.42;c.params.decay=variant==='A'?.85:.105;c.params.brightness=.92;
  }
  if(sceneId==='velocity-mapping')for(const c of cues)if(c.eventId){c.params.mapping=variant==='B';c.pan=variant==='B'?{from:-.85,to:.85,easing:'quintic'}:0;}
  if(sceneId==='narration-space'&&variant==='B'){
    cues=cues.filter(c=>{const reading=scene.readWindows.some(w=>c.anchorTime>=w.start&&c.anchorTime<w.end);
      if(c.eventId&&c.priority<.5&&reading){excludedCues.push({...c,reason:'low priority decoration during reading'});return false;}return true;});
    for(const c of cues)c.policy='speech-and-reading';
  }
  for(const c of cues){c.start+=c.eventId?o.offsetMs/1000:0;c.gain*=db(o.gainDb)*o.intensity;c.designSyncDelta=c.start+c.anchorOffset-c.anchorTime;c.end=c.start+c.duration;}
  return {...scene,variant,options:o,cues,excludedCues,masterGain:.82,placeholderNotice:'Optional surrogate is amplitude-modulated synthetic tones/noise, NOT voice, TTS or proof of intelligibility.',soundOrigin:'Original deterministic synthesis; no third-party samples.'};
}

function rng(seed){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2147483648-1;};}
const lowpass=(freq,sampleRate)=>1-Math.exp(-TAU*freq/sampleRate);

/** Mono source before gain, pan and reading/speech policy. */
export function synthesizeSound(sound,{duration=.5,sampleRate=SAMPLE_RATE,seed=1709,params={}}={}){
  if(!soundIds.has(sound))throw Error(`Unknown procedural sound: ${sound}`);
  if(!Number.isFinite(duration)||duration<=0||duration>30)throw Error('duration must be in(0,30]');
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw Error('Invalid sample rate');
  const n=Math.max(2,Math.round(duration*sampleRate)),out=new Float32Array(n),random=rng(seed);
  let lo=0,hi=0,phase=0;
  const attack=['metal-contact','wood-contact','low-impact'].includes(sound)?.0015:sound==='ui-confirm'?.007:.025;
  for(let i=0;i<n;i++){
    const t=i/sampleRate,p=i/(n-1),noise=random(),edge=smooth(t/attack)*smooth((n-1-i)/(sampleRate*.035));let v=0;
    if(sound==='metal-contact'){
      const decay=params.decay??.13;
      v=(Math.sin(TAU*731*t)*Math.exp(-t/decay)+.55*Math.sin(TAU*1189*t)*Math.exp(-t/(decay*.7))+.26*Math.sin(TAU*1937*t)*Math.exp(-t/(decay*.4)))*.43;
      lo+=lowpass(5200,sampleRate)*(noise-lo);v+=.14*lo*Math.exp(-t/.009);
    }else if(sound==='wood-contact'){
      lo+=lowpass(2400,sampleRate)*(noise-lo);
      v=.57*Math.sin(TAU*213*t)*Math.exp(-t/.042)+.24*Math.sin(TAU*487*t)*Math.exp(-t/.024)+.24*lo*Math.exp(-t/.012);
    }else if(sound==='low-impact'){
      phase+=TAU*(48+115*Math.exp(-t/.035))/sampleRate;
      v=(.72*Math.sin(phase)+.16*Math.sin(phase*2))*Math.exp(-t/.095);
    }else if(sound==='ui-confirm'){
      const second=Math.max(0,t-.075);
      v=.43*Math.sin(TAU*523.25*t)*Math.exp(-t/.09)+.33*Math.sin(TAU*783.99*second)*Math.exp(-second/.095)*smooth(second/.008);
    }else if(sound==='servo'){
      const speed=params.mapping?smoothDerivative(p)/1.875:.6;
      phase+=TAU*(82+155*speed)/sampleRate;lo+=lowpass(950,sampleRate)*(noise-lo);
      v=(.39*Math.sin(phase)+.13*Math.sin(phase*3)+.06*lo)*(.35+.65*speed);
    }else if(sound==='air-passby'||sound==='air-rise'){
      const peak=clamp(params.peakFraction||.5,.08,.92),shape=p<peak?smooth(p/peak):smooth((1-p)/(1-peak));
      const speed=params.mapping?smoothDerivative(p)/1.875:.6;
      const freq=sound==='air-rise'?350+3200*p*p:params.mapping?350+2600*speed:1550;
      lo+=lowpass(freq,sampleRate)*(noise-lo);hi+=lowpass(170,sampleRate)*(lo-hi);
      v=(lo-hi)*shape*(sound==='air-rise'?.62:.75)*(.4+.6*speed);
    }else{
      lo+=lowpass(420,sampleRate)*(noise-lo);hi+=lowpass(65,sampleRate)*(lo-hi);
      v=(lo-hi)*.32*(.78+.22*Math.sin(TAU*.13*t+.6));
    }
    out[i]=v*edge;
  }
  out[0]=out[n-1]=0;return out;
}

/** Preduck and release respond to declared semantic windows, not cue index. */
export function windowGain(time,windows,{floorDb=-12,pre=.16,release=.4}={}){
  let amount=0;for(const w of windows){const enter=smooth((time-(w.start-pre))/pre),leave=1-smooth((time-w.end)/release);amount=Math.max(amount,enter*leave);}return db(floorDb*amount);
}

function cueGain(time,cue,plan){
  if(cue.policy!=='speech-and-reading')return 1;
  const speech=windowGain(time,plan.speechWindows,{floorDb:cue.priority>=.8?-10:cue.sound==='room-air'?-13:-16});
  const reading=windowGain(time,plan.readWindows,{floorDb:cue.priority>=.8?-5:-11,pre:.12,release:.35});return speech*reading;
}

function surrogateSample(t,sr,random){
  // Purely synthetic test bed: amplitude-modulated carrier bands, no phonemes.
  const syllable=.2+.8*Math.sin(TAU*2.4*t)**2;
  return (.022*Math.sin(TAU*170*t)+.012*Math.sin(TAU*510*t)+.008*random())*syllable;
}

export function measureSignal(left,right,sampleRate=SAMPLE_RATE){
  if(!(left instanceof Float32Array)||!(right instanceof Float32Array)||left.length!==right.length||!left.length)throw Error('Expected nonempty equal Float32Array channels');
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw Error('Invalid sample rate');
  let peak=0,monoPeak=0,sumL=0,sumR=0,sumM=0,meanL=0,meanR=0,cross=0,maxStep=0,clippedSamples=0;
  for(let i=0;i<left.length;i++){const l=left[i],r=right[i];if(!Number.isFinite(l)||!Number.isFinite(r))throw Error(`Nonfinite PCM at sample${i}`);const m=(l+r)*.5;peak=Math.max(peak,Math.abs(l),Math.abs(r));if(Math.abs(l)>=1||Math.abs(r)>=1)clippedSamples++;monoPeak=Math.max(monoPeak,Math.abs(m));sumL+=l*l;sumR+=r*r;sumM+=m*m;meanL+=l;meanR+=r;cross+=l*r;if(i)maxStep=Math.max(maxStep,Math.abs(l-left[i-1]),Math.abs(r-right[i-1]));}
  const n=left.length,stereoRms=Math.sqrt((sumL+sumR)/(2*n)),monoRms=Math.sqrt(sumM/n);
  return {samplePeak:peak,samplePeakDbFS:20*Math.log10(Math.max(peak,1e-12)),samplePeakDbfs:20*Math.log10(Math.max(peak,1e-12)),monoPeak,stereoRms,monoRms,monoRatio:stereoRms?monoRms/stereoRms:1,dcLeft:meanL/n,dcRight:meanR/n,correlation:sumL&&sumR?cross/Math.sqrt(sumL*sumR):1,maxAdjacentSampleStep:maxStep,duration:n/sampleRate,clippedSamples};
}

export function renderScene(sceneId,variant='B',options={}){
  const plan=getScenePlan(sceneId,variant,options),sampleRate=plan.options.sampleRate,n=Math.round(plan.duration*sampleRate),left=new Float32Array(n),right=new Float32Array(n);
  for(const cue of plan.cues){
    const pcm=synthesizeSound(cue.sound,{duration:cue.duration,sampleRate,seed:cue.seed,params:cue.params}),start=Math.round(cue.start*sampleRate);
    for(let j=0;j<pcm.length;j++){const i=start+j;if(i<0||i>=n)continue;const t=i/sampleRate;
      const p=clamp((t-cue.start)/cue.duration),pan=typeof cue.pan==='number'?cue.pan:cue.pan.from+(cue.pan.to-cue.pan.from)*smooth(p);
      const angle=(clamp(pan,-1,1)+1)*Math.PI/4,value=pcm[j]*cue.gain*plan.masterGain*cueGain(t,cue,plan);
      left[i]+=value*Math.cos(angle);right[i]+=value*Math.sin(angle);
    }
  }
  if(plan.options.includeSpeechPlaceholder){
    const random=rng(98917);for(let i=0;i<n;i++){const t=i/sampleRate;let envelope=0;for(const w of plan.speechWindows)envelope=Math.max(envelope,smooth((t-w.start)/.025)*smooth((w.end-t)/.05));const value=surrogateSample(t,sampleRate,random)*envelope;left[i]+=value;right[i]+=value;}
  }
  // Global 15ms edges protect deliberate user offsets/truncation. No auto gain,
  // compression or limiter changes the A/B comparison's level relationship.
  for(let i=0;i<n;i++){const edge=smooth(i/(sampleRate*.015))*smooth((n-1-i)/(sampleRate*.025));left[i]*=edge;right[i]*=edge;}
  left[0]=right[0]=left[n-1]=right[n-1]=0;
  const metrics=measureSignal(left,right,sampleRate);
  return {left,right,sampleRate,duration:plan.duration,cues:plan.cues,plan,metrics};
}

export function encodeWav({left,right,sampleRate=SAMPLE_RATE}){
  const measurement=measureSignal(left,right,sampleRate);
  if(measurement.samplePeak>1)throw Error('PCM exceeds full scale: reduce gain before export. No hidden clipping/normalization is applied.');
  const dataSize=left.length*4,buffer=new ArrayBuffer(44+dataSize),view=new DataView(buffer),write=(offset,s)=>[...s].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  write(0,'RIFF');view.setUint32(4,36+dataSize,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,dataSize,true);
  for(let i=0;i<left.length;i++)for(let ch=0;ch<2;ch++){const v=ch?right[i]:left[i];view.setInt16(44+i*4+ch*2,Math.round(v<0?v*32768:v*32767),true);}return new Uint8Array(buffer);
}

export function measureCue(cue,sampleRate=SAMPLE_RATE){
  const pcm=synthesizeSound(cue.sound,{duration:cue.duration,sampleRate,seed:cue.seed,params:cue.params});
  let peak=0,index=0;for(let i=0;i<pcm.length;i++)if(Math.abs(pcm[i])>peak){peak=Math.abs(pcm[i]);index=i;}
  const threshold=peak*.1;let onset=0;while(onset<pcm.length&&Math.abs(pcm[onset])<threshold)onset++;
  const window=Math.max(1,Math.round(.008*sampleRate));let energy=0,maxEnergy=0,rmsIndex=0;
  for(let i=0;i<pcm.length;i++){energy+=pcm[i]*pcm[i];if(i>=window)energy-=pcm[i-window]*pcm[i-window];if(energy>maxEnergy){maxEnergy=energy;rmsIndex=Math.max(0,i-window/2);}}
  return {id:cue.id,sound:cue.sound,designAnchor:cue.anchor,designAnchorTime:cue.anchorTime,designAnchorOffset:cue.anchorOffset,designedSyncDelta:cue.start+cue.anchorOffset-cue.anchorTime,measuredThreshold10PercentTime:cue.start+onset/sampleRate,measuredAbsolutePeakTime:cue.start+index/sampleRate,measured8msRmsPeakTime:cue.start+rmsIndex/sampleRate,peakDelayFromAnchor:cue.start+index/sampleRate-cue.anchorTime,thresholdDelayFromAnchor:cue.start+onset/sampleRate-cue.anchorTime,sourcePeak:peak,firstSample:pcm[0],lastSample:pcm[pcm.length-1]};
}
