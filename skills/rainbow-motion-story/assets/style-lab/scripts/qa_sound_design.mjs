import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {scenes,sounds,renderScene,getScenePlan,visualState,synthesizeSound,measureSignal,measureCue,encodeWav,windowGain} from '../lab/sound-design.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const rms=(render,a,b)=>{let sum=0,n=0;for(let i=Math.round(a*render.sampleRate);i<Math.round(b*render.sampleRate);i++){sum+=(render.left[i]**2+render.right[i]**2)/2;n++;}return Math.sqrt(sum/n);};
const finite=(v)=>{if(typeof v==='number')assert(Number.isFinite(v));else if(Array.isArray(v))v.forEach(finite);else if(v&&typeof v==='object')Object.values(v).forEach(finite);};
const report={passed:false,sampleRate:48000,channels:2,sourceSounds:[],scenes:[],syncMeasurements:[],limits:['Numerical PCM, anti-click boundary, mono and synchronization checks only.','No human listening or speech-intelligibility test. Placeholder is non-speech synthetic signal.','Sample peaks are not oversampled true peaks; independent ffmpeg measurements may add true-peak evidence.']};
const hashes=[];
for(const sound of sounds){
  const options={duration:sound.duration,sampleRate:48000,seed:1709},pcm=synthesizeSound(sound.id,options),again=synthesizeSound(sound.id,options);
  assert.equal(hash(pcm),hash(again));assert.equal(pcm[0],0);assert.equal(pcm.at(-1),0);
  assert(Math.abs(pcm[1])<.0001);assert(Math.abs(pcm.at(-2))<.0001);
  for(const value of pcm)assert(Number.isFinite(value));
  const peak=Math.max(...Array.from(pcm.subarray(0,Math.min(pcm.length,48000))).map(Math.abs));assert(peak>0&&peak<1.1);
  hashes.push(hash(pcm));report.sourceSounds.push({id:sound.id,duration:sound.duration,sha256:hash(pcm),firstSample:pcm[0],lastSample:pcm.at(-1),firstStep:Math.abs(pcm[1]),lastStep:Math.abs(pcm.at(-2))});
}
assert.equal(new Set(hashes).size,sounds.length);

const renders=new Map();
for(const scene of scenes)for(const variant of ['A','B']){
  const r=renderScene(scene.id,variant),again=renderScene(scene.id,variant);renders.set(`${scene.id}:${variant}`,r);
  assert.equal(hash(r.left),hash(again.left));assert.equal(hash(r.right),hash(again.right));
  assert.equal(r.left.length,8*48000);assert.equal(r.right.length,r.left.length);finite(r.metrics);
  assert.equal(r.metrics.clippedSamples,0);assert(r.metrics.samplePeak<.85);assert(r.metrics.monoRatio>.9);assert(Math.abs(r.metrics.dcLeft)<.0001&&Math.abs(r.metrics.dcRight)<.0001);
  assert.equal(r.left[0],0);assert.equal(r.left.at(-1),0);assert.equal(r.right[0],0);assert.equal(r.right.at(-1),0);
  const wav=encodeWav(r),dv=new DataView(wav.buffer);assert.equal(dv.getUint16(22,true),2);assert.equal(dv.getUint32(24,true),48000);assert.equal(dv.getUint32(40,true),8*48000*4);assert.equal(wav.length,44+8*48000*4);
  // Chunk seeking consists only of slicing the rendered absolute PCM.
  const sliced=r.left.slice(12345,23456),independent=again.left.slice(12345,23456);assert.equal(hash(sliced),hash(independent));
  for(let i=0;i<=240;i++){const t=i/30,s=visualState(scene.id,t);finite(s);assert.deepEqual(s,visualState(scene.id,t));}
  report.scenes.push({id:scene.id,variant,metrics:r.metrics,cues:r.cues.length,excluded:r.plan.excludedCues.length,leftSha256:hash(r.left),rightSha256:hash(r.right),wavSha256:hash(wav)});
}

for(const variant of ['A','B'])for(const cue of getScenePlan('contact-sync',variant).cues.filter(c=>c.eventId)){
  const m=measureCue(cue);report.syncMeasurements.push({variant,...m});
  const expected=variant==='A'?.18:0;
  assert(Math.abs(m.designedSyncDelta-expected)<1e-9);
  assert(m.thresholdDelayFromAnchor>=expected&&m.thresholdDelayFromAnchor<expected+.003);
  assert(m.peakDelayFromAnchor>=expected&&m.peakDelayFromAnchor<expected+.012);
}
const pa=getScenePlan('contact-sync','A'),pb=getScenePlan('contact-sync','B');
for(let i=1;i<pa.cues.length;i++){const a={...pa.cues[i]},b={...pb.cues[i]};delete a.start;delete b.start;delete a.end;delete b.end;delete a.designSyncDelta;delete b.designSyncDelta;assert.deepEqual(a,b,'sync A/B must change timing only');}
assert(getScenePlan('cue-density','B').excludedCues.length===5);
assert(getScenePlan('narration-space','B').excludedCues.some(c=>c.eventId==='decorative-pass'));

const speechA=renders.get('narration-space:A'),speechB=renders.get('narration-space:B');
const voiceRatios=speechA.plan.speechWindows.map(w=>rms(speechB,w.start+.1,w.end-.05)/rms(speechA,w.start+.1,w.end-.05));assert(voiceRatios.every(v=>v<.4));
const readRatio=rms(speechB,2.95,3.8)/rms(speechA,2.95,3.8);assert(readRatio<.1);
const tailRatio=rms(renders.get('tail-control:B'),2.3,3.6)/rms(renders.get('tail-control:A'),2.3,3.6);assert(tailRatio<.05);
const stereo=renders.get('velocity-mapping:B');assert(hash(stereo.left)!==hash(stereo.right));
assert.equal(hash(renders.get('velocity-mapping:A').left),hash(renders.get('velocity-mapping:A').right));
assert(windowGain(1.3,[{start:1.4,end:2.6}])<1);assert(windowGain(2.7,[{start:1.4,end:2.6}])<1);assert.equal(windowGain(3.1,[{start:1.4,end:2.6}]),1);

const surrogateA=renderScene('narration-space','A',{includeSpeechPlaceholder:true}),surrogateB=renderScene('narration-space','B',{includeSpeechPlaceholder:true});let maxSurrogateDifference=0;
for(let i=0;i<speechA.left.length;i++)maxSurrogateDifference=Math.max(maxSurrogateDifference,Math.abs((surrogateA.left[i]-speechA.left[i])-(surrogateB.left[i]-speechB.left[i])));
assert(maxSurrogateDifference<2e-8,'A/B reference surrogate must remain identical');

// Supported gain/offset extremes remain finite; global ramp removes crop clicks.
for(const offsetMs of [-500,500]){
  const r=renderScene('contact-sync','B',{offsetMs,gainDb:6,intensity:1.5});assert(r.metrics.samplePeak<1);assert.equal(r.left[0],0);assert.equal(r.left.at(-1),0);
  assert(Math.abs(r.cues[1].designSyncDelta-offsetMs/1000)<1e-9);
}
const zero=renderScene('contact-sync','B',{intensity:0});assert.equal(zero.metrics.samplePeak,0);
assert.equal(measureSignal(new Float32Array([1.2,-1.1]),new Float32Array([0,0])).clippedSamples,2);
assert.throws(()=>encodeWav({left:new Float32Array([NaN]),right:new Float32Array([0])}),/Nonfinite/);
assert.throws(()=>encodeWav({left:new Float32Array([Infinity]),right:new Float32Array([0])}),/Nonfinite/);
assert.throws(()=>encodeWav({left:new Float32Array([1.1]),right:new Float32Array([0])}),/full scale/);
assert.throws(()=>encodeWav({left:new Float32Array([0]),right:new Float32Array([0]),sampleRate:0}),/sample rate/);
assert.throws(()=>getScenePlan('unknown'),/Unknown/);assert.throws(()=>getScenePlan('contact-sync','C'),/variant/);
report.passed=true;report.policies={speechEnergyRatios:voiceRatios,readEnergyRatio:readRatio,shortToLongTailEnergyRatio:tailRatio,maxSurrogateDifference};
const output=path.join(root,'examples/sound-design');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'qa-numerical.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,sounds:sounds.length,abRenders:report.scenes.length,peakMax:Math.max(...report.scenes.map(s=>s.metrics.samplePeak)),monoMin:Math.min(...report.scenes.map(s=>s.metrics.monoRatio)),policies:report.policies,report:'examples/sound-design/qa-numerical.json'},null,2));
