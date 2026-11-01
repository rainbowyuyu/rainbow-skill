import assert from 'node:assert/strict';
import {writeFileSync, mkdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {timeAtFrame, sampleWaveSurface, composeReflection, fresnelSchlick, blendWaterInterface} from '../examples/production-toolkit/water-contracts.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checks=[], close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const run=(name,fn)=>{fn();checks.push({name,passed:true});};
const waves=[{amplitude:.45,kx:.8,kz:.2,omega:1.6,phase:.4},{amplitude:.12,kx:-.3,kz:1.7,omega:2.4,phase:-.6}];
const before=JSON.stringify(waves);
run('absolute frame clock rejects invalid inputs and supports arbitrary frame order',()=>{
  close(timeAtFrame(45,30),1.5);close(timeAtFrame(0,24),0);
  assert.throws(()=>timeAtFrame(1,0));assert.throws(()=>timeAtFrame(-1,30));assert.throws(()=>timeAtFrame(.5,30));
});
run('height slope and vertical derivative share the saved spectrum',()=>{
  const h=1e-5;
  for(let i=0;i<160;i++){
    const p={x:-8+i*.13,z:3-Math.cos(i)*2,time:i*.037,seaLevel:1.2};
    const state=sampleWaveSurface(waves,p), height=q=>sampleWaveSurface(waves,q).height;
    close(state.slopeX,(height({...p,x:p.x+h})-height({...p,x:p.x-h}))/(2*h));
    close(state.slopeZ,(height({...p,z:p.z+h})-height({...p,z:p.z-h}))/(2*h));
    close(state.velocityY,(height({...p,time:p.time+h})-height({...p,time:p.time-h}))/(2*h));
    close(Math.hypot(...state.normal),1);assert.ok(state.normal[1]>0);
  }
});
run('flat water, period and coordinate/phase equivalence remain exact',()=>{
  assert.deepEqual(sampleWaveSurface([],{x:0,z:0,time:3,seaLevel:2}).normal,[-0,1,-0]);
  const c=waves[0],p={x:3,z:4,time:1};
  close(sampleWaveSurface([c],p).height,sampleWaveSurface([c],{...p,time:1+2*Math.PI/c.omega}).height);
  const shifted={...c,phase:c.phase-c.kx*10-c.kz*20};
  close(sampleWaveSurface([c],p).height,sampleWaveSurface([shifted],{...p,x:13,z:24}).height);
});
run('random-order wave queries are deterministic and cannot mutate source modes',()=>{
  const a=sampleWaveSurface(waves,{x:2,z:3,time:9});a.normal[0]=999;
  const reference=sampleWaveSurface(waves,{x:2,z:3,time:9});
  for(const time of [100,0,-2,9,3])sampleWaveSurface(waves,{x:2,z:3,time});
  assert.deepEqual(sampleWaveSurface(waves,{x:2,z:3,time:9}),reference);assert.equal(JSON.stringify(waves),before);
  assert.throws(()=>sampleWaveSurface([{...waves[0],omega:NaN}],{x:0,z:0,time:0}));
});
run('coverage and premultiplied color share one normalized kernel without dark edge halos',()=>{
  const sky=[.1,.2,.3],bright=[4,2,1];
  const state=composeReflection([{premultiplied:bright,coverage:1,weight:1},{premultiplied:[0,0,0],coverage:0,weight:3}],sky);
  close(state.coverage,.25);state.radiance.forEach((v,i)=>close(v,.25*bright[i]+.75*sky[i]));
  const scaled=composeReflection([{premultiplied:bright,coverage:1,weight:10},{premultiplied:[0,0,0],coverage:0,weight:30}],sky);
  assert.deepEqual(state,scaled);
});
run('transparent opaque and screen-edge reflection cases use the same background',()=>{
  const sky=[.2,.4,.8],tap={premultiplied:[3,1,.4],coverage:1,weight:1};
  assert.deepEqual(composeReflection([{premultiplied:[0,0,0],coverage:0,weight:1}],sky).radiance,sky);
  assert.deepEqual(composeReflection([tap],sky).radiance,tap.premultiplied);
  assert.deepEqual(composeReflection([tap],sky,0).radiance,sky);
  composeReflection([tap],sky,.3).radiance.forEach((v,i)=>close(v,.3*tap.premultiplied[i]+.7*sky[i]));
});
run('invalid coverage kernels fail explicitly instead of silently manufacturing zeros',()=>{
  assert.throws(()=>composeReflection([],[1,1,1]));
  assert.throws(()=>composeReflection([{premultiplied:[0,0,0],coverage:.2,weight:0}],[1,1,1]));
  assert.throws(()=>composeReflection([{premultiplied:[1,0,0],coverage:0,weight:1}],[1,1,1]));
  assert.throws(()=>composeReflection([{premultiplied:[0,0,0],coverage:2,weight:1}],[1,1,1]));
});
run('one-interface Fresnel blend preserves endpoints and HDR radiance',()=>{
  close(fresnelSchlick(1,.02),.02);close(fresnelSchlick(0,.02),1);
  for(let i=0;i<=100;i++){
    const f=fresnelSchlick(i/100,.02);assert.ok(f>=.02&&f<=1);
    const result=blendWaterInterface([4,2,1],[.1,.2,.3],f);
    result.forEach((v,j)=>close(v,f*[4,2,1][j]+(1-f)*[.1,.2,.3][j]));
  }
  assert.deepEqual(blendWaterInterface([4,2,1],[.1,.2,.3],1),[4,2,1]);
});
run('finite inputs that overflow intermediate arithmetic fail explicitly',()=>{
  assert.throws(()=>timeAtFrame(10,Number.MIN_VALUE));
  assert.throws(()=>sampleWaveSurface([{amplitude:1,kx:1e308,kz:0,omega:0,phase:0}],{x:1e308,z:0,time:0}));
  assert.throws(()=>sampleWaveSurface([{amplitude:1e308,kx:0,kz:0,omega:0,phase:0},{amplitude:1e308,kx:0,kz:0,omega:0,phase:0}],{x:0,z:0,time:0}));
  assert.throws(()=>composeReflection([{premultiplied:[1,1,1],coverage:1,weight:1e308},{premultiplied:[1,1,1],coverage:1,weight:1e308}],[1,1,1]));
});
let externalSpectrum=null;
if(process.argv.includes('--spectrum')){
  const path=resolve(process.argv[process.argv.indexOf('--spectrum')+1]);
  const data=JSON.parse(readFileSync(path,'utf8')),modes=data.components;
  assert.ok(Array.isArray(modes)&&modes.length>0);
  run('explicitly supplied historical spectrum is readable with the same deterministic contract',()=>{
    const s=sampleWaveSurface(modes,{x:0,z:0,time:0});assert.ok(Number.isFinite(s.height));
    assert.deepEqual(s,sampleWaveSurface(modes,{x:0,z:0,time:0}));
  });
  externalSpectrum={path,components:modes.length,scope:'CPU numerical contract only; no GPU image or buoy simulation rerun'};
}
const report={date:'2026-10-24',passed:true,checks,externalSpectrum,scope:'Original helper numerics. Does not validate WaterPro, GPU shaders, pixel shimmer, physical calibration or the finished films.'};
mkdirSync(resolve(root,'qa/production-toolkit'),{recursive:true});
writeFileSync(resolve(root,'qa/production-toolkit/water-contracts.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
