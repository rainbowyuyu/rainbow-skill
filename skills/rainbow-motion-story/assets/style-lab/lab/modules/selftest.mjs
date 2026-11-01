import assert from 'node:assert/strict';
import {candidates,candidateById,modules} from './index.js';
import {projector,cubePoints} from './common.js';

const metrics={candidates:candidates.length,samples:0,finiteNumbers:0,maxRodLengthError:0,maxEnergyError:0,maxFluxError:0,maxCameraStep:0,maxCameraBoundaryVelocityError:0};
function finite(v){if(typeof v==='number'){assert(Number.isFinite(v));metrics.finiteNumbers++}else if(v&&typeof v==='object')Object.values(v).forEach(finite)}
function near(a,b,eps=1e-8){if(typeof a==='number')assert(Math.abs(a-b)<eps,`${a} != ${b}`);else if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(a))near(a[k],b[k],eps)}else assert.equal(a,b)}
assert(candidates.length>0);assert.equal(new Set(candidates.map(c=>c.id)).size,candidates.length);
const moduleNames=['storytelling','rhythm','camera','mechanics','visualization','look'];
assert.deepEqual(Object.keys(modules).sort(),[...moduleNames].sort(),'All six named modules stay registered.');
assert.deepEqual(Object.keys(candidateById).sort(),candidates.map(c=>c.id).sort(),'Candidate lookup covers the complete registry.');
for(const c of candidates){assert(moduleNames.includes(c.module),`Unknown module for ${c.id}`);assert.strictEqual(candidateById[c.id],c)}
for(const [module,items]of Object.entries(modules)){
 const expected=candidates.filter(c=>c.module===module);
 assert(items.length>0,`Empty module: ${module}`);
 assert.equal(new Set(items.map(c=>c.id)).size,items.length,`Duplicate module entries: ${module}`);
 assert.deepEqual(items.map(c=>c.id).sort(),expected.map(c=>c.id).sort(),`Missing or misclassified candidate: ${module}`);
 items.forEach(c=>{assert.equal(c.module,module);assert.strictEqual(candidateById[c.id],c)});
}
for(const c of candidates){
 assert(c.recipe.length>=3&&c.stages.length>=3&&c.referenceIds.length&&c.usage&&c.codeFile);
 for(const intensity of[0,.65,1])for(const palette of['titanium','ember','porcelain']){
  const options={intensity,palette};for(let frame=0;frame<=300;frame++){const t=frame/300*c.duration,s=c.sample(t,options);finite(s);metrics.samples++}
  if(c.loop!==false)near(c.sample(2.75,options),c.sample(2.75+c.duration,options));
  else { near(c.sample(-1,options),c.sample(0,options));near(c.sample(c.duration+1,options),c.sample(c.duration,options)); }
  assert.deepEqual(c.sample(7,options),c.sample(7,options));
 }
}
const gear=candidateById['mechanics-linked-gears'];for(let t=0;t<10;t+=.031){const s=gear.sample(t);near(s.sunAngle,4*s.carrierAngle);near(s.planetAngle,-s.sunAngle/2);s.planets.forEach(p=>near(Math.hypot(p.x,p.y),96))}
const slider=candidateById['mechanics-slider-crank'];for(let t=0;t<10;t+=.017){const s=slider.sample(t),err=Math.abs(s.measuredLength-s.rodLength);metrics.maxRodLengthError=Math.max(metrics.maxRodLengthError,err);assert(err<1e-10)}
const energy=candidateById['visualization-entity-formula'];for(let t=0;t<10;t+=.017){const s=energy.sample(t),err=Math.abs(s.total-.5*s.k);metrics.maxEnergyError=Math.max(metrics.maxEnergyError,err);assert(err<1e-12)}
for (const field of ['xMeasureAlpha','vMeasureAlpha','potentialAlpha','kineticAlpha','joinAlpha','barAlpha']) assert.equal(energy.sample(0)[field],0,'first establish entity: '+field);
near(energy.sample(1.5).xMeasureAlpha,1);assert.equal(energy.sample(1.5).potentialAlpha,0);
near(energy.sample(3.5).potentialAlpha,1);assert.equal(energy.sample(3.5).kineticAlpha,0);assert.equal(energy.sample(3.5).vMeasureAlpha,0);
near(energy.sample(5).vMeasureAlpha,1);assert.equal(energy.sample(5).kineticAlpha,0);
near(energy.sample(6).kineticAlpha,1);assert.equal(energy.sample(6).joinAlpha,0);assert.equal(energy.sample(6).barAlpha,0);
near(energy.sample(7.7).barAlpha,1);assert(energy.sample(9.9).barAlpha<.05);
const exploded=candidateById['mechanics-axial-exploded'];
for(let f=0;f<=300;f++){
 const s=exploded.sample(f/30);near(Math.hypot(...s.axis),1);near(s.axis,exploded.sample(0).axis);near(s.shaftStart,exploded.sample(0).shaftStart);near(s.shaftEnd,exploded.sample(0).shaftEnd);
 for(const p of s.parts){const dx=p.x-p.restPose[0],dy=p.y-p.restPose[1];near(dx*s.axis[1]-dy*s.axis[0],0);near(p.x,p.restPose[0]+s.axis[0]*p.travel);near(p.y,p.restPose[1]+s.axis[1]*p.travel);assert(p.x-p.r>100&&p.x+p.r<1500&&p.y-p.r>165&&p.y+p.r<720)}
 for(let i=1;i<s.parts.length;i++)assert(s.parts[i].x>s.parts[i-1].x,'axial parts preserve order');
}
assert(exploded.sample(1.5).parts[0].progress>exploded.sample(1.5).parts[4].progress);assert.equal(exploded.sample(1.5).parts[1].progress,0);assert.equal(exploded.sample(1.5).parts[3].progress,0);
assert(exploded.sample(7.7).parts[1].progress<exploded.sample(7.7).parts[0].progress,'inner part returns before outer');
const flow=candidateById['visualization-flow-continuity'];for(let t=0;t<10;t+=.1){const s=flow.sample(t),err=Math.max(Math.abs(s.flux-s.throatArea*s.throatVelocity),Math.abs(s.flux-s.wideArea*s.wideVelocity));metrics.maxFluxError=Math.max(metrics.maxFluxError,err);assert(err<1e-8);for(const p of s.particles){assert(p.x>=300&&p.x<=1300);assert(Number.isFinite(p.velocity)&&p.velocity>0)}}
const hold=candidateById['rhythm-explanation-hold'];assert.equal(hold.sample(3).position,hold.sample(7).position);assert(hold.sample(5).hold);
for(const c of modules.camera){
 let last=null;for(let i=0;i<=360;i++){const s=c.sample(i/360*c.duration).camera;assert(s.fov>10&&s.fov<110);assert(Math.hypot(...s.target.map((x,j)=>x-s.position[j]))>.01);const center=projector(s)(s.target);near(center.x,800);near(center.y,480);if(last)metrics.maxCameraStep=Math.max(metrics.maxCameraStep,Math.hypot(...s.position.map((x,j)=>x-last[j])));last=s.position}
 if(c.loop===false)continue;
 const h=.0001,a=c.sample(c.duration-h).camera.position,b=c.sample(0).camera.position,d=c.sample(h).camera.position;
 const err=Math.max(...b.map((x,i)=>Math.abs((x-a[i])/h-(d[i]-x)/h)));metrics.maxCameraBoundaryVelocityError=Math.max(metrics.maxCameraBoundaryVelocityError,err);assert(err<.002,c.id);
}
const dz=candidateById['camera-dolly-zoom'];near(dz.sample(0).projectionScale,dz.sample(5).projectionScale);
const orbitPoints=[...cubePoints([-2.1,.3,-1.1],[.6,.6,.6]),...cubePoints([2.1,.3,-1.1],[.6,.6,.6]),...cubePoints([0,.18,0],[4.4,.35,1.8]),...cubePoints([0,1.9,0],[4,2,.4])];
for(const intensity of[0,.65,1])for(let f=0;f<300;f++){const project=projector(candidateById['camera-orbit-bank'].sample(f/30,{intensity}).camera);for(const p of orbitPoints.map(project))assert(p.x>100&&p.x<1500&&p.y>165&&p.y<850,'orbit full geometry envelope')}
const route=candidateById['visualization-route-bridge'];
for(const t of[0,1,2,3,4,5,6,7,8,9]){const s=route.sample(t);assert.equal(s.points.length,101);s.points.forEach((p,i)=>{assert.equal(p.id,i);near(Math.hypot(...p.position),Math.hypot(p.x,p.y))});const a=s.points[s.marker.segment].position,b=s.points[s.marker.segment+1].position,m=s.marker.position,d=a.map((x,i)=>b[i]-x),v=a.map((x,i)=>m[i]-x);const cross=[d[1]*v[2]-d[2]*v[1],d[2]*v[0]-d[0]*v[2],d[0]*v[1]-d[1]*v[0]];assert(Math.hypot(...cross)<1e-10)}
const lattice=candidateById['visualization-lattice-growth'];assert.equal(lattice.sample(.8).nodes.filter(n=>n.reveal>.99).length,8);assert.equal(lattice.sample(.8).edges.filter(e=>e.reveal>.99).length,12);assert.equal(lattice.sample(5).nodes.filter(n=>n.reveal>.99).length,64);assert.equal(new Set(lattice.sample(5).edges.map(e=>`${Math.min(e.a,e.b)}-${Math.max(e.a,e.b)}`)).size,144);
const blur=candidateById['look-multisample-shutter'].sample(3,{intensity:1});assert.equal(blur.sampleTimes.length,16);near(blur.sampleTimes.reduce((a,b)=>a+b,0)/16,3);assert(blur.sampleTimes[0]<3&&blur.sampleTimes.at(-1)>3);
console.log(JSON.stringify({passed:true,...metrics},null,2));
