import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {candidates, motionfaceKineticDefaults, partitionOrbitText, sampleTypeOrbitLock, layoutTypeOrbitLock} from '../lab/modules/motionface-kinetic.js';

const checks=[], failures=[], metrics={stateSamples:0,drawSamples:0,commands:0};
function check(name, fn){try{fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,message:error.message});failures.push({name,message:error.message});}}
function finite(value){if(typeof value==='number')assert(Number.isFinite(value));else if(value&&typeof value==='object')Object.values(value).forEach(finite);}
function stripTime(state){const s=structuredClone(state);delete s.time;delete s.phaseTime;return s;}
function recorder(){
  const initial={globalAlpha:1,font:'10px sans-serif',globalCompositeOperation:'source-over',filter:'none',fillStyle:'#000',strokeStyle:'#000',lineWidth:1,lineCap:'butt',textAlign:'start',textBaseline:'alphabetic'};
  const state={...initial},stack=[],commands=[],runs=[];
  const record=(name,args)=>{args.forEach(v=>{if(typeof v==='number')assert(Number.isFinite(v),name)});commands.push([name,args]);};
  const functions={save(){stack.push({...state});record('save',[])},restore(){assert(stack.length);Object.assign(state,stack.pop());record('restore',[])},measureText(value){const size=Number(/([\d.]+)px/.exec(state.font)?.[1]||10);return{width:Array.from(String(value)).reduce((sum,c)=>sum+(c===' '?.3:c.codePointAt(0)<128?.58:1),0)*size}},fillText(value,x,y){const size=Number(/([\d.]+)px/.exec(state.font)?.[1]||10);runs.push({value,size,x,y,alpha:state.globalAlpha});record('fillText',[value,x,y,state.font,state.globalAlpha])}};
  for(const name of ['setTransform','fillRect','beginPath','moveTo','lineTo','stroke','fill','arc','translate','rotate'])functions[name]=(...args)=>{if(name==='arc')assert(args[2]>=0);record(name,args)};
  const ctx=new Proxy(state,{get:(s,k)=>k in functions?functions[k]:s[k],set(s,k,v){if(typeof v==='number')assert(Number.isFinite(v),String(k));if(k==='globalAlpha')assert(v>=0&&v<=1);s[k]=v;record(k,[v]);return true}});
  return{ctx,runs,finish(){assert.equal(stack.length,0);assert.deepEqual(state,initial);metrics.drawSamples++;metrics.commands+=commands.length;return createHash('sha256').update(JSON.stringify(commands)).digest('hex')}};
}

const fixtures=[
  '先看变化，再看关系。',
  '把机器人眼前的距离，变成可以理解的误差，再让公式说明下一步怎样行动',
  '让观察成为关系，让关系引出解释，再把解释还给观众看到的同一个实体。'.repeat(8).slice(0,180),
  'V = I × R，电压与电流保持同一关系。',
  '看',
  '先看🌊，再说水怎样流。'
];

check('single finite candidate declares real code and consistent stage contracts',()=>{
  assert.equal(candidates.length,1);const c=candidates[0];assert.equal(c.id,'mf-type-orbit-lock');assert.equal(c.duration,14);assert.equal(c.loop,false);assert.equal(c.module,'look');assert.equal(c.codeFile,'./modules/motionface-kinetic.js');assert.deepEqual(Object.keys(motionfaceKineticDefaults),[c.id]);assert(c.referenceIds.includes('motionface'));assert(c.recipe.length>=3);c.stageTimes.forEach((v,i)=>assert(v>=0&&v<14&&(!i||v>c.stageTimes[i-1])));
});
check('every character and punctuation survives grouping into at most twelve stable identities',()=>{
  for(const headline of fixtures){const a=partitionOrbitText(headline);assert(a.tokens.length<=12);assert(a.tokens.length>0);assert.equal(a.tokens.map(v=>v.text).join(''),headline);assert.equal(a.textRows.map(v=>v.text).join(''),headline);assert.equal(new Set(a.tokens.map(v=>v.id)).size,a.tokens.length);let offset=0;for(const token of a.tokens){assert.equal(token.charStart,offset);offset+=Array.from(token.text).length;assert.equal(token.charEnd,offset)}assert.equal(offset,Array.from(headline).length);assert.deepEqual(partitionOrbitText(headline),a);}
});
check('Chinese row boundaries preserve words rather than splitting real terms',()=>{
  const headline='先让观众看见变化，再把真实的对象、同一组数据和清楚的结论连续地交到眼前。';
  const p=partitionOrbitText(headline),rows=p.textRows.map(v=>v.text);
  assert.equal(rows.join(''),headline);assert(p.tokens.length<=12);
  for(const word of ['真实','清楚'])assert(rows.some(row=>row.includes(word)),`${word} is broken across rows`);
  for(const phrase of ['真实的对象','清楚的结论'])assert(rows.some(row=>row.includes(phrase)),`${phrase} modifier is stranded across rows`);
  assert(rows.every(row=>!/^[的地得]/u.test(row)),'dependent particle begins a row');
  for(let i=0;i<rows.length-1;i++){assert(!(rows[i].endsWith('真')&&rows[i+1].startsWith('实')));assert(!(rows[i].endsWith('清')&&rows[i+1].startsWith('楚')));}
});
check('missing language segmentation falls back without loss or excessive groups',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(Intl,'Segmenter');
  try {
    Object.defineProperty(Intl,'Segmenter',{value:undefined,configurable:true,writable:true});
    for(const headline of [...fixtures,'先让观众看见变化，再把真实的对象、同一组数据和清楚的结论连续地交到眼前。']){
      const p=partitionOrbitText(headline);assert.equal(p.tokens.map(v=>v.text).join(''),headline);assert.equal(p.textRows.map(v=>v.text).join(''),headline);assert(p.tokens.length<=12);
      const r=recorder(),state=sampleTypeOrbitLock(14,{headline}),layout=layoutTypeOrbitLock(r.ctx,state);assert(layout.rows.every(row=>row.width<=1300+1e-8));r.finish();
    }
  } finally {if(descriptor)Object.defineProperty(Intl,'Segmenter',descriptor);else delete Intl.Segmenter;}
});
check('absolute state is finite and stable across palettes motion modes tempos and seeks',()=>{
  for(const palette of ['paper','lime','coral'])for(const intensity of [0,.65,1])for(const reducedMotion of [false,true])for(const tempo of [.75,1,1.35]){
    const options={palette,intensity,reducedMotion,tempo};for(let frame=0;frame<=140;frame++){finite(sampleTypeOrbitLock(frame/10,options));metrics.stateSamples++}
    const expected=sampleTypeOrbitLock(3.3,options);for(const t of [13,0,-5,14,NaN,Infinity,2.1])finite(sampleTypeOrbitLock(t,options));assert.deepEqual(sampleTypeOrbitLock(3.3,options),expected);assert.deepEqual(sampleTypeOrbitLock(-1,options),sampleTypeOrbitLock(0,options));assert.deepEqual(sampleTypeOrbitLock(20,options),sampleTypeOrbitLock(14,options));
  }
});
check('reading window keeps all state still with at least 1.8 seconds at slowest tempo',()=>{
  for(const tempo of [.75,1,1.35])for(const reducedMotion of [false,true]){const end=sampleTypeOrbitLock(14,{tempo,reducedMotion}),start=end.timings.at(-1).start;assert(14-start>=1.8-1e-10);assert(end.readHold);assert.deepEqual(stripTime(end),stripTime(sampleTypeOrbitLock(start+.0001,{tempo,reducedMotion})));assert(end.tokens.every(t=>t.lock===1&&t.rotation===0&&Math.abs(t.arc)<1e-10));}
});
check('measured final layout preserves complete copy with one font size and safe bounds',()=>{
  for(const headline of fixtures){const r=recorder(),s=sampleTypeOrbitLock(14,{headline}),l=layoutTypeOrbitLock(r.ctx,s);assert(l.size>=18&&l.size<=110);assert(l.rows.length>=1&&l.rows.length<=6);for(const row of l.rows){assert(row.x>=150-1e-8);assert(row.x+row.width<=1450+1e-8);assert(row.y-l.lineHeight/2>=218-1e-8);assert(row.y+l.lineHeight/2<=623+1e-8)}assert.equal(l.rows.map(v=>v.text).join(''),s.copy.headline);r.finish();}
});
check('returned measured geometry is isolated from caller mutation',()=>{
  const r=recorder(),s=sampleTypeOrbitLock(14),a=layoutTypeOrbitLock(r.ctx,s),b=structuredClone(a);a.rows[0].x=-999;a.bounds.width=-999;a.targets[Object.keys(a.targets)[0]].x=-999;assert.deepEqual(layoutTypeOrbitLock(r.ctx,s),b);r.finish();
});
check('default and long-copy renders have balanced finite commands and seek reversibly',()=>{
  const snapshots=[];
  for(const palette of ['paper','lime','coral'])for(const reducedMotion of [false,true])for(const headline of fixtures.slice(0,4))for(const t of [0,.8,2.2,3.2,4.8,6.5,8.5,10.5,14]){const options={palette,reducedMotion,headline},r=recorder();candidates[0].draw(r.ctx,t,1600,900,options);snapshots.push({options,t,hash:r.finish()})}
  for(const sample of snapshots.toReversed()){const r=recorder();candidates[0].draw(r.ctx,sample.t,1600,900,sample.options);assert.equal(r.finish(),sample.hash)}
});
check('reduced motion removes rotation and retains the full result',()=>{
  for(const t of [0,1,3,5,7,14]){const s=sampleTypeOrbitLock(t,{reducedMotion:true});assert(s.tokens.every(v=>v.rotation===0&&v.arc===0));assert.equal(s.tokens.map(v=>v.text).join(''),s.copy.headline);}
});

const report={schemaVersion:1,kind:'motionface-kinetic-state-and-recorded-canvas-qa',passed:failures.length===0,checks,failures,metrics,scope:'Deterministic state, text preservation, approximate measured layout and recorded Canvas calls. Does not replace actual browser font, collision, pixel, audio or continuous playback review.',browserReviewed:false,audioReviewed:false};
await mkdir(new URL('../qa/motionface/',import.meta.url),{recursive:true});await writeFile(new URL('../qa/motionface/kinetic-state-and-drawing.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
