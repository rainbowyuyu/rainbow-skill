import assert from 'node:assert/strict';
import {candidates,PART_IDS,sample,projectPoint,pathLength,revealPath,hatchOpacity,insideProjectedFace} from '../lab/modules/engraved-mechanism.js';
const finite=p=>p.every(Number.isFinite),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
let states=0,faces=0,hatches=0;
function impellerCoverage(state){
  let total=0,visible=0;
  for(const face of state.faces.filter(f=>f.partId.startsWith('impeller-'))){
    for(const mask of face.occluders){
      const housing=state.faces.find(f=>f.id===mask.id);
      assert.ok(housing,'occlusion mask must belong to actual projected geometry');
      for(const p of face.points)assert.ok(dot(housing.normal,sub(p,housing.center))<0,'occluder plane must be geometrically ahead of the entire clipped face');
    }
    for(let j=1;j<face.screen.length-1;j++){
      const a=face.screen[0],b=face.screen[j],c=face.screen[j+1];
      for(let u=0;u<=5;u++)for(let v=0;v<=5-u;v++){
        const p=a.map((x,i)=>x*(1-(u+v)/5)+b[i]*u/5+c[i]*v/5);total++;
        if(!face.occluders.some(h=>insideProjectedFace(p,h.screen)))visible++;
      }
    }
  }
  return {total,visible};
}
for(const candidate of candidates){
  const times=[0,.5,1.25,2.5,3.3,4.7,5.5,6.3,7.2,8.5,9.5,10.2,11.7,12.8,candidate.duration];
  const forward=times.map(t=>JSON.stringify(sample(t,{id:candidate.id})));
  for(let i=times.length-1;i>=0;i--){
    const s=sample(times[i],{id:candidate.id});assert.equal(JSON.stringify(s),forward[i],'seek must not depend on playback history');
    assert.deepEqual(s.parts.map(p=>p.id),PART_IDS,'part identities must remain stable');
    assert.equal(new Set(s.parts.map(p=>p.id)).size,PART_IDS.length);
    for(const p of s.parts)assert.ok(finite(p.center));
    assert.ok(s.drawProgress>=0&&s.drawProgress<=1&&s.hatchProgress>=0&&s.hatchProgress<=1);
    assert.ok(s.occlusion.hiddenLines==='off');
    for(let j=0;j<s.faces.length;j++){
      const f=s.faces[j];assert.ok(Number.isFinite(f.depth)&&f.depth>s.camera.near);
      if(j)assert.ok(s.faces[j-1].depth>=f.depth-1e-10,'far surfaces must be painted first');
      const toEye=s.camera.projection==='orthographic'?s.camera.forward.map(v=>-v):sub(s.camera.position,f.center);
      assert.ok(dot(f.normal,toEye)>0,'back-facing surfaces must be culled');
      for(const p of f.screen){assert.ok(finite(p),'projection finite');assert.ok(p[0]>60&&p[0]<1540&&p[1]>180&&p[1]<790,'authored parts stay out of title/footer areas');}
      for(const h of f.hatches){assert.ok(h.points.every(finite));assert.ok(h.spacingPixels>=0);assert.equal(h.alpha,hatchOpacity(h.spacingPixels));assert.ok(h.alpha>=0&&h.alpha<=1);hatches++;}
      for(const e of f.edges){assert.ok(['outline','structure'].includes(e.role));assert.ok(e.points.every(finite));}
      for(const mark of f.marks){assert.equal(f.id,'pump-cover/cap-b','surface marks must be drawn in their owning face pass');assert.ok(mark.points.every(finite));assert.deepEqual(mark.points[0],mark.points.at(-1));}
      faces++;
    }
    assert.ok(projectPoint(s.camera.position,s.camera)===null,'near-plane points cannot become Infinity');
    states++;
  }
  const closed=sample(0,{id:candidate.id}),opened=sample(7.2,{id:candidate.id}),returned=sample(candidate.duration,{id:candidate.id});
  const center=(s,id)=>s.parts.find(p=>p.id===id).center;
  assert.ok(center(opened,'pump-cover')[0]>center(closed,'pump-cover')[0]+.8);
  assert.deepEqual(center(closed,'pump-cover'),center(returned,'pump-cover'),'cover returns to assembly transform');
  assert.deepEqual(center(closed,'pump-shell'),center(opened,'pump-shell'),'shell must not follow detachable cover');
  assert.equal(returned.readWindow,true);
  for(const t of [0,3.8,candidate.duration-1,candidate.duration]){
    const s=sample(t,{id:candidate.id}),coverage=impellerCoverage(s);
    assert.equal(s.open,0);assert.equal(coverage.visible,0,'closed solid cover and housing must hide the entire impeller');
  }
  const exposed=impellerCoverage(sample(6.4,{id:candidate.id}));
  assert.ok(exposed.visible>100,'opened cover must reveal internal geometry');
  assert.ok(exposed.visible<exposed.total,'the shell must still occlude the covered internal portions');
  const mid=sample(6.4,{id:candidate.id});
  assert.ok(mid.callout.position[0]>mid.callout.anchor[0]+100&&mid.callout.position[1]<mid.callout.anchor[1]-40,'callout sits in the blank gap above and to the right, away from the coupling');
}
assert.equal(sample(1,{id:candidates[1].id}).hatchProgress,0,'structure precedes hatching');
assert.ok(sample(4.9,{id:candidates[1].id}).hatchProgress>.99);
assert.equal(hatchOpacity(1),0,'subpixel/dense hatch omitted');
assert.equal(hatchOpacity(5),1);assert.ok(hatchOpacity(3)>0&&hatchOpacity(3)<1);
const unequal=[[0,0],[10,0],[10,30]];
for(const q of [0,.1,.25,.4,.7,1])assert.ok(Math.abs(pathLength(revealPath(unequal,q))-pathLength(unequal)*q)<1e-8,'reveal uses arc length');
assert.deepEqual(revealPath(unequal,1),unequal);assert.deepEqual(revealPath(unequal,0),[]);
assert.throws(()=>sample(1,{id:'missing'}),RangeError);assert.throws(()=>sample(NaN),TypeError);
assert.deepEqual(sample(-5),sample(0));assert.deepEqual(sample(100),sample(candidates[0].duration));
console.log(JSON.stringify({passed:true,candidates:candidates.length,states,visibleFacesChecked:faces,hatchSegmentsChecked:hatches,checks:['finite-projection','near-plane','back-face-culling','depth-order','stable-part-identity','seek-determinism','assembly-return','surface-hatch-density','drawing-order','arc-length-reveal','argument-validation','geometric-cover-occlusion','partial-opening-visibility','callout-clearance'],scope:'finite authored geometry; not a general occlusion proof or fluid simulation'}));
