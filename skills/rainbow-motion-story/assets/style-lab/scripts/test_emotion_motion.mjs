import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {presets,durationFor,sample,draw,getCueSheet,renderAudio,audioControlAt} from '../lab/emotion-motion.js';
import {measureSignal,encodeWav,synthesizeSound} from '../lab/sound-design.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let checks=0,motionSamples=0,derivativeSamples=0;
const check=(v,message)=>{assert.ok(v,message);checks++;};
const near=(a,b,tolerance=1e-8,label='value')=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,`${label}: ${a} vs ${b}`);
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const hash=pcm=>crypto.createHash('sha256').update(Buffer.from(pcm.buffer,pcm.byteOffset,pcm.byteLength)).digest('hex');
const energy=(audio,start,end)=>{
  let sum=0,peak=0,n=0;
  for(let i=Math.ceil(start*audio.sampleRate);i<Math.min(audio.left.length,Math.floor(end*audio.sampleRate));i++){
    sum+=audio.left[i]**2+audio.right[i]**2;peak=Math.max(peak,Math.abs(audio.left[i]),Math.abs(audio.right[i]));n++;
  }return {rms:n?Math.sqrt(sum/(2*n)):0,peak};
};
check(presets.length===4&&new Set(presets.map(p=>p.id)).size===4,'four distinct base candidates');
const ids=[...presets.map(p=>p.id),'reel'];
const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
for(const id of ids){
  const duration=durationFor(id);near(duration,id==='reel'?15:4,0,'shared observation duration');
  for(let i=0;i<=Math.round(duration*120);i++){
    const t=i/120,s=sample(id,t),o=s.object;
    for(const n of [o.x,o.y,o.velocity.x,o.velocity.y,o.acceleration.x,o.acceleration.y,o.speed])check(Number.isFinite(n),'finite motion');
    near(o.speed,Math.hypot(o.velocity.x,o.velocity.y),1e-12,'speed equals actual velocity magnitude');
    check(o.x>=0&&o.x<=1&&o.y>=0&&o.y<=1,'subject remains inside stage');
    check(o.y+o.radius<=s.floor+1e-12,'subject never penetrates support plane');
    bounds.minX=Math.min(bounds.minX,o.x);bounds.maxX=Math.max(bounds.maxX,o.x);bounds.minY=Math.min(bounds.minY,o.y);bounds.maxY=Math.max(bounds.maxY,o.y);
    const h=1e-5;
    if(t>h&&t<duration-h&&!s.events.some(e=>Math.abs(t-e.time)<h*2)){
      const a=sample(id,t-h),b=sample(id,t+h);
      if(a.activeId===s.activeId&&b.activeId===s.activeId){
        near((b.object.x-a.object.x)/(2*h),o.velocity.x,2e-7,'x derivative');
        near((b.object.y-a.object.y)/(2*h),o.velocity.y,2e-7,'y derivative');
        near((b.object.velocity.x-a.object.velocity.x)/(2*h),o.acceleration.x,3e-6,'x acceleration');
        near((b.object.velocity.y-a.object.velocity.y)/(2*h),o.acceleration.y,3e-6,'y acceleration');
        derivativeSamples++;
      }
    }
    motionSamples++;
  }
  const times=[0,.13,.37,.9,1.18,1.45,2.6,3.2,duration];
  const direct=times.map(t=>sample(id,t));equal(times.toReversed().map(t=>sample(id,t)).toReversed(),direct,'random access independent of playback order');
  for(const t of times){
    equal(sample(id,t,{soundStyle:'matched',gain:1}),sample(id,t,{soundStyle:'neutral',gain:0}),'audio configuration cannot change picture');
    equal(sample(id,t,{mode:'type'}).object,sample(id,t,{mode:'object'}).object,'word and object share exact trajectory');
  }
}

// A stop is a genuine hold and an explicitly recorded velocity jump.
const stopEvent=sample('stop',0).events.find(e=>e.kind==='contact');
check(sample('stop',stopEvent.time-1e-6).object.velocity.x>.5,'arrival still has incoming velocity');
near(sample('stop',stopEvent.time).object.velocity.x,0,0,'hard contact takes right-side zero velocity');
for(const t of [1.45,1.7,2.4,3.9])equal(sample('stop',t).object,sample('stop',4).object,'hard stop holds the full state');
check(stopEvent.incomingVelocity>0&&stopEvent.outgoingVelocity===0,'inelastic impulse declared');
check(sample('fast',.25).object.velocity.x<0,'fast includes real short anticipation');
const maxFast=Math.max(...Array.from({length:401},(_,i)=>sample('fast',i/100).object.speed));
const maxSlow=Math.max(...Array.from({length:401},(_,i)=>sample('slow',i/100).object.speed));
check(maxFast>maxSlow*3,'fast and slow are structurally distinct speeds');

// Contact geometry and restitution use the same events as sound scheduling.
const contacts=sample('bounce',0).events.filter(e=>e.kind==='contact');
check(contacts.length===4,'three rebounds then final contact');
for(const [i,e]of contacts.entries()){
  const s=sample('bounce',e.time);
  near(s.object.y+s.object.radius,s.floor,2e-12,'bounce contact meets floor exactly');
  near(s.object.velocity.y,e.outgoingVelocity,2e-12,'bounce samples the declared right side');
  if(i<3)near(e.outgoingVelocity,-Math.sqrt(.3)*e.incomingVelocity,2e-12,'common restitution');
  else near(e.outgoingVelocity,0,0,'last contact absorbs remaining velocity');
}
const cuts=sample('reel',0).events.filter(e=>e.kind==='cut');
equal(cuts.map(e=>e.time),[3,6,9,12],'reel editorial boundaries explicitly declared');
for(const e of cuts){check(sample('reel',e.time).cut,'exact cut marked');check(sample('reel',e.time-1e-6).activeId!==sample('reel',e.time).activeId,'cut changes the active chapter');}
for(let section=0;section<4;section++)for(const local of [.2,.5,.9,1.5,2.2]){
  const t=section*3+local*3/4,a=sample(presets[section].id,local),b=sample('reel',t);
  near(a.object.x,b.object.x,1e-12,'reel position maps exact local time');near(a.object.y,b.object.y,1e-12,'reel vertical position');
  near(a.object.speed*4/3,b.object.speed,1e-11,'reel speed chain rule');
}

// Audit event alignment, actual-speed control and complete silence windows.
const audioReports=[];
for(const id of ids)for(const soundStyle of ['matched','neutral']){
  const options={soundStyle,gain:1,sampleRate:48000},cues=getCueSheet(id,options),events=sample(id,0).events;
  check(new Set(cues.map(c=>c.id)).size===cues.length,'cue IDs are unique');
  for(const cue of cues){
    check(cue.start>=0&&cue.end<=durationFor(id),'cue contained within video');
    near(cue.duration,cue.end-cue.start,1e-12,'cue duration');
    const event=events.find(e=>e.id===cue.eventId);check(Boolean(event),'cue references a real visual event');
    near(cue.start+cue.anchorOffset,event.time,1e-12,'event anchors determine sound timing');
    if(cue.sound==='air-motion'){
      for(let i=0;i<=30;i++){
        const t=cue.start+(cue.end-cue.start)*i/30,control=audioControlAt(cue,t),s=sample(id,t);
        near(control.speed,s.object.speed,1e-10,'air uses actual sampled motion speed');
        check(control.envelope>=0&&control.envelope<=1,'bounded air envelope');
      }
      near(audioControlAt(cue,cue.start).envelope,0,0,'air attack begins at zero');near(audioControlAt(cue,cue.end).envelope,0,0,'air release ends at zero');
      for(const contact of cue.contactTimes)near(audioControlAt(cue,contact).envelope,0,0,'no noise jump at ideal contact');
    }else{
      const stem=synthesizeSound(cue.sound,{sampleRate:48000,duration:cue.duration,seed:cue.seed,params:cue.params});
      check(stem[0]===0&&stem.at(-1)===0,'transient stem begins and ends at zero');
      let edge=0;for(const index of [1,2,stem.length-2,stem.length-1])edge=Math.max(edge,Math.abs(stem[index]-stem[index-1])*cue.gain);
      check(edge<.0001,'transient stem has gradual first/last sample edges');
    }
  }
  if(soundStyle==='neutral')check(cues.every(c=>c.sound==='ui-confirm'&&c.seed===9109&&c.gain===.16),'neutral uses the same source and gain at every anchor');
  const a=renderAudio(id,options),b=renderAudio(id,options),metrics=measureSignal(a.left,a.right,a.sampleRate);
  equal(hash(a.left),hash(b.left),'deterministic left PCM');equal(hash(a.right),hash(b.right),'deterministic right PCM');
  near(a.duration,durationFor(id),0,'audio duration matches picture');check(a.left.length===durationFor(id)*48000&&a.right.length===a.left.length,'exact stereo sample count');
  check(metrics.samplePeak<.75&&metrics.clippedSamples===0,'safe headroom without clipping or limiting');
  check(metrics.monoRatio>.85,'no serious stereo cancellation');check(Math.abs(metrics.dcLeft)<.0001&&Math.abs(metrics.dcRight)<.0001,'low DC offset');
  check(metrics.maxAdjacentSampleStep<.1,'bounded adjacent signal step; not a perceptual click test');
  // Broadband air can change quickly inside a cue. Inspect scheduling edges
  // separately, rather than mislabelling every high-frequency sample as a click.
  let scheduledEdgeStep=0;
  for(const cue of cues)for(const boundary of [cue.start,cue.end]){
    // A different continuous noise stem can legitimately be active here. Its
    // high-frequency variation is not an edge introduced by this transient.
    if(cues.some(other=>other.id!==cue.id&&boundary>=other.start&&boundary<other.end))continue;
    const center=Math.round(boundary*a.sampleRate);
    for(let i=Math.max(1,center-2);i<=Math.min(a.left.length-1,center+2);i++)
      scheduledEdgeStep=Math.max(scheduledEdgeStep,Math.abs(a.left[i]-a.left[i-1]),Math.abs(a.right[i]-a.right[i-1]));
  }
  check(scheduledEdgeStep<.002,'scheduled audio boundaries avoid abrupt digital steps');
  check(a.left[0]===0&&a.right[0]===0&&a.left.at(-1)===0&&a.right.at(-1)===0,'zero file endpoints');
  const silence=[];
  for(const event of events.filter(e=>e.kind==='reading')){
    const end=id==='reel'?(event.sourceId?Math.min(12,(Math.floor(event.time/3)+1)*3):15):4;
    const level=energy(a,event.time+.015,end-.005);check(level.peak===0,'declared reading window really is silent');silence.push({start:event.time+.015,end:end-.005,...level});
  }
  if(id==='reel')check(energy(a,12,15).peak===0,'overview is actually silent');
  const wav=encodeWav(a),view=new DataView(wav.buffer,wav.byteOffset,wav.byteLength);
  check(view.getUint32(24,true)===48000&&view.getUint16(22,true)===2&&view.getUint16(34,true)===16,'48k stereo PCM16 WAV');
  check(wav.length===44+a.left.length*4,'correct WAV payload length');
  audioReports.push({id,soundStyle,duration:a.duration,cueCount:cues.length,sha256Left:hash(a.left),sha256Right:hash(a.right),metrics,scheduledEdgeStep,silence});
}
const muted=renderAudio('reel',{gain:0});check(muted.left.every(v=>v===0)&&muted.right.every(v=>v===0),'gain zero is exact silence');
const half=renderAudio('fast',{gain:.5}),full=renderAudio('fast',{gain:1});
for(let i=0;i<full.left.length;i+=131){near(half.left[i],full.left[i]*.5,1e-10,'linear gain left');near(half.right[i],full.right[i]*.5,1e-10,'linear gain right');}

// Dry Canvas recording checks deterministic drawing calls, not visual quality.
function fakeContext(){const calls=[],stack=[];const gradient=()=>({addColorStop:(...args)=>calls.push(['color-stop',...args])});
  const c={globalAlpha:1,save(){stack.push(this.globalAlpha);calls.push(['save']);},restore(){this.globalAlpha=stack.pop();calls.push(['restore']);},measureText(){return{width:148,actualBoundingBoxAscent:61,actualBoundingBoxDescent:3,actualBoundingBoxRight:72};},createRadialGradient(...args){calls.push(['radial',...args]);return gradient();},createLinearGradient(...args){calls.push(['linear',...args]);return gradient();}};
  for(const method of ['setTransform','clearRect','fillRect','translate','scale','rotate','beginPath','moveTo','lineTo','stroke','fill','arc','ellipse','roundRect','fillText'])c[method]=(...args)=>{for(const v of args)if(typeof v==='number')check(Number.isFinite(v),'finite drawing operand');calls.push([method,...args]);};
  return {context:c,calls};
}
for(const id of ids)for(const mode of ['object','type'])for(const t of [0,.7,1.45,2.65,durationFor(id)]){
  const a=fakeContext(),b=fakeContext();const state=draw(a.context,id,t,1200,675,{mode});draw(b.context,id,t,1200,675,{mode});equal(a.calls,b.calls,'draw uses deterministic state');equal(state,sample(id,t,{mode}),'draw returns the same sampled state');
}
for(const action of [()=>sample('unknown',0),()=>sample('fast',NaN),()=>sample('fast',0,{mode:'bad'}),()=>renderAudio('fast',{gain:1.1}),()=>renderAudio('fast',{sampleRate:0}),()=>getCueSheet('fast',{soundStyle:'other'})]){assert.throws(action);checks++;}

const report={passed:true,checks,motionSamples,derivativeSamples,baseCandidates:4,reelSeconds:15,
  peakSpeed:{fast:maxFast,slow:maxSlow,ratio:maxFast/maxSlow},normalizedBounds:bounds,audioReports,
  verified:['Absolute-time random access','Analytic velocity vs finite-difference positions','Contact geometry and restitution','Reel time scaling and explicit cuts','Shared event/sound anchors','Speed-driven continuous air control','Quiet reading windows','Deterministic 48k stereo PCM','Clipping/DC/mono/edge checks','Canvas call determinism'],
  notVerified:['No human listening judgement','No perceptual emotion certification','No true-peak measurement in this numeric script','No real-material or aerodynamic simulation','Canvas call recording is not browser visual QA']};
fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa/emotion-motion-numerical.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks,motionSamples,derivativeSamples,audioRenders:audioReports.length,peakMax:Math.max(...audioReports.map(r=>r.metrics.samplePeak)),report:'qa/emotion-motion-numerical.json'},null,2));
