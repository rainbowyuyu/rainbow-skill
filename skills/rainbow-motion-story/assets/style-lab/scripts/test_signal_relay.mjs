import assert from 'node:assert/strict';
import {duration,candidates,buildPlan,sample,draw,renderAudio} from '../lab/modules/signal-relay.js';
let checks=0,states=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const near=(a,b,e=1e-7)=>check(Math.abs(a-b)<=e,`${a} ≈ ${b}`);
const finite=o=>{if(typeof o==='number')check(Number.isFinite(o),'finite');else if(o&&typeof o==='object')Object.values(o).forEach(finite);};
const visual=s=>({storyTime:s.storyTime,signals:s.signals,camera:s.camera});
const stub=()=>{const g={addColorStop(){}};return new Proxy({createRadialGradient(){return g;}},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});};
const audioResults=[];
for(const c of candidates){
  const plan=buildPlan(c.id);check(plan.events.length>=6&&plan.events.length<=7,'semantic density');
  for(const e of plan.events){check(e.onset<=e.peak&&e.peak<e.end,'event envelope');check(e.onset>=0&&e.end<=duration,'event bounds');}
  const recorded=[];for(let f=0;f<=duration*60;f++){const t=f/60,s=sample(t,{id:c.id});finite(s);check(s.signals.length===3,'three identities');check(new Set(s.signals.map(x=>x.id)).size===3,'unique identities');check(s.signals.every(x=>x.screen.depth>0),'in front of camera');check(s.signals.every(x=>x.screen.x>.1&&x.screen.x<.91&&x.screen.y>.2&&x.screen.y<.73),'safe picture area');recorded.push(s);states++;}
  for(let f=recorded.length-1;f>=0;f-=11){assert.deepEqual(sample(f/60,{id:c.id}),recorded[f]);checks++;}
  for(const h of plan.readHolds){assert.deepEqual(visual(sample(h.start+.0001,{id:c.id})),visual(sample(h.end-.0001,{id:c.id})));checks++;}
  for(const [at]of plan.timeMap.slice(1,-1)){const a=sample(at-1e-4,{id:c.id}),b=sample(at+1e-4,{id:c.id});near(a.storyTime,b.storyTime,1e-6);for(let i=0;i<3;i++){near(a.signals[i].screen.x,b.signals[i].screen.x,1e-6);near(a.signals[i].screen.y,b.signals[i].screen.y,1e-6);}}
  const meet=plan.events.find(e=>e.id==='gather-seat').onset,merged=sample(meet,{id:c.id});for(const a of merged.signals)for(const b of merged.signals){near(a.position.x,b.position.x);near(a.position.y,b.position.y);near(a.position.z,b.position.z);}
  const mutated=sample(4,{id:c.id});mutated.camera.x=900;mutated.signals[0].position.x=999;check(sample(4,{id:c.id}).camera.x!==900,'sample isolated');
  assert.deepEqual(sample(-1,{id:c.id}),sample(0,{id:c.id}));assert.deepEqual(sample(99,{id:c.id}),sample(duration,{id:c.id}));checks+=2;
  for(const at of [0,1,4,6,11,14,16,20,23,24])draw(stub(),at,1600,900,{id:c.id});
  const a=renderAudio(c.id,48000);check(a.left.length===duration*48000,'exact sample count');check(a.right.length===a.left.length,'stereo');check(a.metrics.samplePeak<.6&&a.metrics.rms>0,'headroom and signal');
  for(let i=0;i<a.left.length;i+=97){near(a.left[i],a.stems.music.left[i]+a.stems.sfx.left[i],4e-8);near(a.right[i],a.stems.music.right[i]+a.stems.sfx.right[i],4e-8);check(Number.isFinite(a.left[i])&&Number.isFinite(a.right[i]),'finite audio');}
  for(const a1 of [a.left,a.right,a.stems.music.left,a.stems.music.right,a.stems.sfx.left,a.stems.sfx.right]){near(a1[0],0,0);near(a1.at(-1),0,0);}
  // Isolated first and final SFX must genuinely extend into their planned tail,
  // then become exactly silent. A merely longer timeline label is insufficient.
  for(const key of ['emerge','resolve']){const e=plan.events.find(v=>v.id===key);let tailPeak=0,afterPeak=0;for(let i=Math.floor((e.end-.08)*48000);i<Math.floor((e.end-.02)*48000);i++)tailPeak=Math.max(tailPeak,Math.abs(a.stems.sfx.left[i]),Math.abs(a.stems.sfx.right[i]));for(let i=Math.ceil(e.end*48000);i<Math.min(a.left.length,Math.floor((e.end+.05)*48000));i++)afterPeak=Math.max(afterPeak,Math.abs(a.stems.sfx.left[i]),Math.abs(a.stems.sfx.right[i]));check(tailPeak>1e-7,`${key} actual synthesized tail reaches declared end`);near(afterPeak,0,0);}
  audioResults.push({id:c.id,...a.metrics});
}
assert.throws(()=>sample(NaN),TypeError);assert.throws(()=>sample(0,{id:'bad'}),RangeError);assert.throws(()=>renderAudio('pulse',1),RangeError);
check(sample(8,{id:'pulse'}).storyTime!==sample(8,{id:'legato'}).storyTime,'different temporal arrangements');
console.log(JSON.stringify({passed:true,checks,states,duration,audioResults,listeningPerformed:false,scope:'State/reverse seek/hold/anchor continuity and numerical audio. Visual review remains separate.'},null,2));
