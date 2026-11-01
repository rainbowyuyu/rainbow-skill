import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {DURATION,variants,sampleTitleSequence,drawTitleSequence,buildTitleSelection} from '../lab/modules/symbolic-titles.js';

const checks=[];
function checked(name,fn){fn();checks.push(name);}
function finiteTree(value){if(typeof value==='number')assert.ok(Number.isFinite(value));else if(value&&typeof value==='object')Object.values(value).forEach(finiteTree);}
function recorder(){let balance=0,operations=0;const hash=createHash('sha256'),alphaStack=[];
 const record=(name,args)=>{args.forEach(x=>{if(typeof x==='number')assert.ok(Number.isFinite(x),`${name}: nonfinite argument`);});hash.update(JSON.stringify([name,args]));operations++;};
 const object={globalAlpha:1};for(const name of ['beginPath','closePath','moveTo','lineTo','arc','rect','clip','fill','stroke','fillRect','clearRect','translate','scale','rotate','setLineDash','bezierCurveTo','fillText'])object[name]=(...args)=>{if(name==='arc')assert.ok(args[2]>=0);record(name,args);};
 object.save=()=>{balance++;alphaStack.push(object.globalAlpha);record('save',[]);};object.restore=()=>{balance--;assert.ok(balance>=0);object.globalAlpha=alphaStack.pop();record('restore',[]);};
 object.measureText=text=>({width:Array.from(text).length*Number(/([\d.]+)px/.exec(object.font)?.[1]||12)});
 object.createRadialGradient=(...args)=>{record('gradient',args);return {addColorStop:(...stops)=>record('colorStop',stops)};};
 const ctx=new Proxy(object,{set(target,key,value){if(typeof value==='number')assert.ok(Number.isFinite(value));if(key==='globalAlpha')assert.ok(value>=0&&value<=1);record(String(key),[typeof value==='object'?'gradient':value]);target[key]=value;return true;}});
 return {ctx,finish(){assert.equal(balance,0,'unbalanced Canvas save/restore');return {hash:hash.digest('hex'),operations};}};
}

checked('absolute-time sampling is deterministic, finite and safe at bounds',()=>{
 for(const v of variants)for(const t of [-2,0,.01,1,4.8,6.4,8,9,9.8,13.4,15,16.7,18,20,21,NaN,Infinity]){
  const a=sampleTitleSequence(t,v.id),b=sampleTitleSequence(t,v.id);finiteTree(a);assert.deepEqual(a,b);assert.ok(a.t>=0&&a.t<=DURATION);
  for(const key of ['pageSpread','stair','tower','sun','sea','aperture','portal','windowPush'])assert.ok(a[key]>=0&&a[key]<=1);
 }
 assert.equal(sampleTitleSequence(-2).t,0);assert.equal(sampleTitleSequence(21).t,20);assert.equal(sampleTitleSequence(5,'missing').variant,variants[0].id);
});
checked('recognition holds precede the negative-space push and reveal',()=>{
 const at=t=>sampleTitleSequence(t,'negative-space');
 for(const t of [4.8,5.6,6.4]){assert.equal(at(t).aperture,1);assert.equal(at(t).windowPush,0);}
 for(const t of [9,9.4,9.8]){assert.equal(at(t).windowPush,1);assert.equal(at(t).portal,0);}
 assert.equal(at(13.4).portal,1);assert.ok(at(13.4).mask.radius>Math.hypot(1104,558));
});
checked('morph and mask tracks remain continuous across cue boundaries',()=>{
 for(const v of variants)for(const boundary of [.3,3.1,4.1,4.8,6.1,6.4,7.6,9,9.8,13.2,13.4,14.7,16.7]){
  const a=sampleTitleSequence(boundary-1e-5,v.id),b=sampleTitleSequence(boundary+1e-5,v.id);
  for(const key of ['pageSpread','stair','tower','sun','sea','aperture','portal','windowPush','seam'])assert.ok(Math.abs(a[key]-b[key])<1e-4,`${key} at ${boundary}`);
  assert.ok(Math.abs(a.mask.radius-b.mask.radius)<.1);
 }
});
checked('the final title has an uninterrupted 3.3-second reading window',()=>{
 for(const v of variants){const first=sampleTitleSequence(16.7,v.id).title;for(const t of [16.7,17,18,19,20]){const s=sampleTitleSequence(t,v.id);assert.equal(s.title.alpha,1);assert.equal(s.readWindow,true);assert.deepEqual(s.title,first);}}
});
checked('exports are serializable and cannot mutate variant beat definitions',()=>{
 const result=buildTitleSelection(8,'dual-world',{title:'  一条新的航线  '});assert.equal(result.title,'一条新的航线');assert.equal(JSON.parse(JSON.stringify(result)).state.t,8);
 result.beats[0].label='changed';result.state.screenAnchor[0]=0;assert.notEqual(variants[2].beats[0][0],'changed');assert.deepEqual(sampleTitleSequence(8,'dual-world').screenAnchor,[.69,.38]);
 assert.equal(sampleTitleSequence(1,'outline-relay',{title:' '}).title.text,'未写完的航线');
});
const drawing=[];
checked('all three renderers draw finite paths with balanced Canvas state',()=>{
 for(const v of variants){const times=[0,1,4.8,5,6.4,7.5,8.5,9,9.8,10,11,12,13.4,14.7,16,16.7,20];
  for(const t of times){const r=recorder();drawTitleSequence(r.ctx,t,1600,900,{variant:v.id});const result=r.finish();assert.ok(result.operations>100);drawing.push({variant:v.id,t,...result});}
 }
});
checked('reverse seeking reproduces the same draw commands without frame history',()=>{
 for(const entry of drawing.toReversed()){const r=recorder();drawTitleSequence(r.ctx,entry.t,1600,900,{variant:entry.variant});assert.equal(r.finish().hash,entry.hash);}
});
checked('variants produce distinct visual commands before the common title',()=>{
 const hashes=variants.map(v=>drawing.find(x=>x.variant===v.id&&x.t===8.5).hash);assert.equal(new Set(hashes).size,3);
 const r=recorder();drawTitleSequence(r.ctx,18,1600,900,{variant:'outline-relay',title:'这是一个相当长的中文片名用来检查是否能够稳定排版并保持可读性',anchors:true});r.finish();
});
const report={kind:'symbolic-title-numerical-and-drawing-contract-checks',passed:checks.length,checks,renderSamples:drawing.length,scope:'State continuity, deterministic seeking, finite Canvas commands, stable title contract and export integrity. This does not validate raster appearance, font metrics or browser interaction.',browserReviewed:false};
await mkdir(new URL('../qa/',import.meta.url),{recursive:true});await writeFile(new URL('../qa/symbolic-titles-data.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
