import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {trials,inertiaState,foldCard,creationBrief,sample} from '../lab/modules/lemo-trials.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'lab/lemo-catalog.json'),'utf8'));
assert.equal(data.entries.length,157);assert.equal(new Set(data.entries.map(x=>x.id)).size,157);assert.equal(data.entries.filter(x=>x.kind==='ready').length,59);assert.equal(data.entries.filter(x=>x.kind==='archive').length,98);
for(const x of data.entries){for(const k of ['look','motion','use','avoid','exercise'])assert.ok(typeof x.analysis[k]==='string'&&x.analysis[k].trim().length>0,`${x.id}: missing specific ${k}`);assert.ok(fs.existsSync(path.resolve(root,'lab',x.still)));if(x.styleDoc)assert.ok(fs.existsSync(path.resolve(root,'lab',x.styleDoc)));assert.equal(creationBrief(x,'试题').styleId,x.id)}
for(const tr of trials)assert.ok(data.entries.some(x=>x.slug===tr.id));
let steps=0;
for(let t=0;t<=12;t+=.02){const k=inertiaState(t),epsilon=1e-5;assert.ok(k.ball-k.car>=95-1e-8&&k.ball-k.car<=215+1e-8,'ball stays on cart');if(t>epsilon&&Math.abs(t-2)>.01&&Math.abs(t-3)>.01&&Math.abs(t-6)>.01){const l=inertiaState(t-epsilon),r=inertiaState(t+epsilon);assert.ok(Math.abs((r.car-l.car)/(2*epsilon)-k.carVelocity)<1e-4);assert.ok(Math.abs((r.ball-l.ball)/(2*epsilon)-k.ballVelocity)<1e-4)}const p=foldCard(60,140,t/12*Math.PI/2);assert.ok(Math.abs(Math.hypot(...p)-Math.hypot(60,140))<1e-10);const hinge=foldCard(60,0,t);assert.equal(hinge[0],60);assert.ok(Math.abs(hinge[1])+Math.abs(hinge[2])<1e-12);steps++}
for(const t of [2,3,6]){const a=inertiaState(t-1e-7),b=inertiaState(t+1e-7);assert.ok(Math.abs(a.car-b.car)<.001&&Math.abs(a.ball-b.ball)<.001);assert.ok(Math.abs(a.carVelocity-b.carVelocity)<.001&&Math.abs(a.ballVelocity-b.ballVelocity)<.001)}
const result={catalog:157,ready:59,archive:98,trials:trials.length,physicalSamples:steps,pass:true,scope:'coverage, files, continuous kinematic derivatives, fixed hinge length; no source-film playback or audio approval'};fs.writeFileSync(path.join(root,'qa/lemo-atlas.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
