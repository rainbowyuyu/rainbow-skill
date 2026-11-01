import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {scenes,sounds,renderScene,encodeWav,synthesizeSound,measureSignal,measureCue} from '../lab/sound-design.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=path.join(root,'examples/sound-design');fs.mkdirSync(output,{recursive:true});
const manifest={schemaVersion:1,sampleRate:48000,channels:2,encoding:'PCM signed16 little endian',source:'Original deterministic synthesis; no third-party samples',normalization:'No per-file loudness normalization, compressor or limiter',auditionStatus:'Numerical validation only; no human listening claim',referenceSignal:'Optional surrogate is synthetic non-speech, not voice/TTS.',files:[]};
function save(filename,r,meta){const bytes=encodeWav(r);fs.writeFileSync(path.join(output,filename),bytes);manifest.files.push({filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),duration:r.duration??r.left.length/r.sampleRate,sampleRate:r.sampleRate,channels:2,...meta,metrics:r.metrics??measureSignal(r.left,r.right,r.sampleRate)});}
for(const scene of scenes)for(const variant of ['A','B']){
  const options={sampleRate:48000,offsetMs:0,gainDb:0,intensity:1,includeSpeechPlaceholder:false},r=renderScene(scene.id,variant,options);
  save(`${scene.id}-${variant}.wav`,r,{sceneId:scene.id,variant,options});
  fs.writeFileSync(path.join(output,`${scene.id}-${variant}.plan.json`),JSON.stringify({...r.plan,cueMeasurements:r.cues.filter(c=>c.eventId).map(c=>measureCue(c))},null,2));
}
for(const variant of ['A','B']){
  const options={sampleRate:48000,offsetMs:0,gainDb:0,intensity:1,includeSpeechPlaceholder:true};save(`narration-space-${variant}-NON_SPEECH_SURROGATE.wav`,renderScene('narration-space',variant,options),{sceneId:'narration-space',variant,options,warning:'Not speech. Synthetic amplitude-modulated test signal.'});
}
for(const sound of sounds){
  const duration=sound.id==='room-air'?2:sound.duration,pcm=synthesizeSound(sound.id,{duration,sampleRate:48000,seed:1709}),left=Float32Array.from(pcm,v=>v*.3/Math.sqrt(2)),right=left.slice();
  save(`source-${sound.id}.wav`,{left,right,sampleRate:48000,duration},{soundId:sound.id,options:{duration,sampleRate:48000,seed:1709,linearGain:.3,equalPowerCenter:true}});
}
manifest.totalWavBytes=manifest.files.reduce((sum,f)=>sum+f.bytes,0);if(manifest.totalWavBytes>=30*1024*1024)throw Error('WAV budget exceeded');
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({files:manifest.files.length,totalWavBytes:manifest.totalWavBytes,output},null,2));
