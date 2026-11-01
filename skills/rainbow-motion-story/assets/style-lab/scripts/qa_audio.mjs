import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {seededNoise,cuePlan,synthesizeCue,speechDucking} from '../lab/sound-preview.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),checks=[];
function check(name,fn){fn();checks.push({name,passed:true})}
check('Seeded sound is repeatable',()=>assert.deepEqual(seededNoise(1024,111),seededNoise(1024,111)));
const cues=[];
check('Cue PCM has exact silent endpoints, finite samples, and headroom',()=>{for(const sr of [16000,44100,48000])for(const kind of ['air','tap','tick','resolve']){const pcm=synthesizeCue(kind,sr,.7,111),peak=pcm.reduce((a,x)=>Math.max(a,Math.abs(x)),0);assert.equal(pcm[0],0);assert.equal(pcm.at(-1),0);assert(pcm.every(Number.isFinite));assert(peak>0&&peak<.8);cues.push({sr,kind,peak,samples:pcm.length})}});
check('Explanation hold has no repeating click from 2.5 to 7.5 seconds',()=>assert(!cuePlan('rhythm',10,'rhythm-explanation-hold').some(x=>x.time>2.5&&x.time<7.5)));
check('Preduck precedes voice and releases after final word',()=>{const win=[[2,4]];assert(speechDucking(1.75,win)<1);assert(Math.abs(speechDucking(2,win)-10**(-13/20))<1e-12);assert(Math.abs(speechDucking(2,win)-speechDucking(4,win))<1e-12);assert(speechDucking(4.3,win)<1);assert.equal(speechDucking(5,win),1)});
check('Overlapping speech windows never pump between words',()=>{const win=[[2,4],[3.8,5]];for(let t=2;t<5;t+=.005)assert(Math.abs(speechDucking(t,win)-10**(-13/20))<1e-10)});
check('Gain curve is continuous across window boundaries',()=>{const win=[[2,4]];for(const t of [1.55,2,4,4.85])assert(Math.abs(speechDucking(t-.0001,win)-speechDucking(t+.0001,win))<1e-6)});
const result={passed:true,checks,cues,limits:'Numerical PCM and envelope checks; not subjective listening or device loudness assurance.'};
fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa/audio-code.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
