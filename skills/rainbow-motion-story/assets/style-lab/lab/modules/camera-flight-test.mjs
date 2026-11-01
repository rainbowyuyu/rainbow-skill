import assert from 'node:assert/strict';
import {candidates,candidateById,cameraFlightInternals as internals} from './camera-flight.js';
import {viewFor,length3,sub} from './camera-flight-common.js';
import {palettes} from './common.js';

let samples=0,finiteNumbers=0,maxSpeed=0,maxAcceleration=0,maxGazeSpeed=0,minClearance=Infinity;
const extrema={};
function finite(value){if(typeof value==='number'){assert(Number.isFinite(value));finiteNumbers++;}else if(Array.isArray(value))value.forEach(finite);else if(value&&typeof value==='object')Object.values(value).forEach(finite);}
const norm=a=>{const d=length3(a);return a.map(v=>v/d);};
const velocity=(c,t,options,h=.0001)=>sub(c.sample(t+h,options).camera.position,c.sample(t-h,options).camera.position).map(v=>v/(2*h));

for(const c of candidates){
  assert.equal(c.duration,12);assert.equal(c.module,'camera');assert.equal(c.stages.length,4);assert.equal(c.stageTimes.length,4);
  assert(c.stageTimes.every((t,i)=>!i||t>c.stageTimes[i-1]));
  let minimum=Infinity,topSpeed=0,topAcceleration=0,topGazeSpeed=0;
  for(const intensity of [0,.65,1])for(const palette of ['titanium','ember','porcelain']){
    const options={intensity,palette};let previous=null,previousV=null,previousDirection=null;
    for(let i=0;i<=720;i++){
      const t=i/60,s=c.sample(t,options),v=velocity(c,t,options);samples++;finite(s);
      assert.deepEqual(s,c.sample(t,options),'same absolute time must reproduce exact state');
      assert(s.camera.fov>=40&&s.camera.fov<=90);assert(Math.abs(s.camera.roll)<.4);
      assert.deepEqual(s.camera.principalPoint,[.5,.52]);
      assert(s.camera.focusDistance>.1);assert(Math.abs(s.camera.focusDistance-length3(sub(s.camera.target,s.camera.position)))<1e-8);
      assert(s.routeClearance>.25,`${c.id} collision/clearance at ${t}: ${s.routeClearance}`);
      minimum=Math.min(minimum,s.routeClearance);topSpeed=Math.max(topSpeed,length3(v));
      const direction=norm(sub(s.camera.target,s.camera.position));
      if(previous){topAcceleration=Math.max(topAcceleration,length3(sub(v,previousV))*60);topGazeSpeed=Math.max(topGazeSpeed,length3(sub(direction,previousDirection))*60);}
      previous=s;previousV=v;previousDirection=direction;
    }
  }
  // Knot-side velocity checks catch a discontinuous piecewise camera, while
  // bounded acceleration checks above cover the actual between-knot motion.
  for(const t of [...c.stageTimes,.75,.8,2.4,2.75,9.45,11.35,11.6,12]){
    const before=velocity(c,t-.00002,{}),after=velocity(c,t+.00002,{});
    assert(length3(sub(before,after))<.02,`${c.id} velocity discontinuity at ${t}`);
  }
  if(c.loop){
    assert.deepEqual(c.sample(0).camera,c.sample(12).camera);
    assert.deepEqual(c.sample(-.25).camera,c.sample(11.75).camera);
    assert(length3(velocity(c,0,{}))<1e-7);
  }else{
    assert.deepEqual(c.sample(-1),c.sample(0));assert.deepEqual(c.sample(40),c.sample(12));
    assert(length3(velocity(c,0,{}))<1e-5);assert(length3(velocity(c,12,{}))<1e-5);
  }
  assert(topSpeed<35,`${c.id} implausibly fast geometry traversal`);
  assert(topAcceleration<90,`${c.id} jerky trajectory`);
  assert(topGazeSpeed<6,`${c.id} gaze whip`);
  extrema[c.id]={minimumClearanceMetres:minimum,maxSpeedMetresPerSecond:topSpeed,maxAccelerationMetresPerSecondSquared:topAcceleration,maxGazeDirectionRate:topGazeSpeed};
  maxSpeed=Math.max(maxSpeed,topSpeed);maxAcceleration=Math.max(maxAcceleration,topAcceleration);maxGazeSpeed=Math.max(maxGazeSpeed,topGazeSpeed);minClearance=Math.min(minClearance,minimum);
}

const slalom=candidateById['camera-fpv-slalom'];
const rollVelocity=(c,t,options,h=.0001)=>(c.sample(t+h,options).camera.roll-c.sample(t-h,options).camera.roll)/(2*h);
for(const intensity of [0,.65,1]){
  const options={intensity};
  assert.equal(slalom.sample(12,options).camera.roll,0,'slalom must finish level');
  assert.equal(slalom.sample(14,options).camera.roll,0,'nonloop hold must stay level');
  assert(Math.abs(rollVelocity(slalom,12,options))<1e-7,'final angular velocity must be zero');
  for(const t of [9.8,12]){
    const before=rollVelocity(slalom,t-.00002,options),after=rollVelocity(slalom,t+.00002,options);
    assert(Math.abs(before-after)<.0001,`roll velocity must be continuous at ${t}`);
  }
  for(const t of [0,3,6,9.7]){
    const s=slalom.sample(t,options),expected=.32*Math.sin(s.distance/29*Math.PI*2)*(.45+.55*intensity);
    assert(Math.abs(s.camera.roll-expected)<1e-12,'recovery must not alter earlier bank');
  }
}

const soul=candidateById['camera-soul-drift'];
assert.deepEqual(soul.sample(0).camera.position,internals.eyeAnchor);
assert.deepEqual(soul.sample(11.8).camera.position,internals.eyeAnchor);
assert.equal(soul.sample(0).headAlpha,0);assert.equal(soul.sample(11.8).headAlpha,0);
assert(soul.sample(3.3).eyeDistance>10);assert(soul.sample(3.3).headAlpha===1);
for(let i=0;i<=720;i++)assert(Math.abs(candidateById['camera-first-person'].sample(i/60).camera.position[1]-1.67)<=.012001);

// The view clips edges through the near plane; it must not reject the entire
// face or divide a behind-camera vertex by a clamped fake depth.
const camera={position:[0,0,0],target:[0,0,-1],fov:65,roll:.2};
const view=viewFor(camera);
const crossed=view.polygon([[-1,-1,.2],[1,-1,-2],[1,1,-2],[-1,1,.2]]);
assert(crossed&&crossed.points.length>=3);
assert.equal(view.polygon([[-1,-1,2],[1,-1,2],[1,1,2],[-1,1,2]]),null);
assert.equal(view.polygon([[-1,-1,-260],[1,-1,-260],[1,1,-260],[-1,1,-260]]),null);
for(const p of crossed.points){assert(p[0]>=-1e-8&&p[0]<=1600+1e-8);assert(p[1]>=-1e-8&&p[1]<=900+1e-8);}

let projectedFaces=0;
const builders=[internals.slalomScene,internals.diveScene,internals.firstPersonScene,internals.soulScene];
for(let index=0;index<candidates.length;index++)for(let i=0;i<=24;i++){
  const s=candidates[index].sample(i*.5),scene=builders[index](palettes.titanium,s),v=viewFor(s.camera);
  for(const face of [...scene.ground,...scene.faces]){
    const projected=v.polygon(face.points);if(!projected)continue;projectedFaces++;
    finite(projected);for(const p of projected.points){assert(p[0]>=-1e-6&&p[0]<=1600+1e-6);assert(p[1]>=-1e-6&&p[1]<=900+1e-6);}
  }
}
console.log(JSON.stringify({passed:true,candidates:candidates.length,samples,finiteNumbers,projectedFaces,minClearance,maxSpeed,maxAcceleration,maxGazeSpeed,extrema,limits:'Geometric route and projection checks only; not proof of aircraft dynamics or subjective video quality.'},null,2));
