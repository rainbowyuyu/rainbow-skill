import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {candidateById} from '../lab/modules/index.js';
import {projector} from '../lab/modules/common.js';
import {viewFor} from '../lab/modules/camera-flight-common.js';
import {makeProjector as depthProjector} from '../lab/modules/camera-depth.js';
import {applyCameraPose} from '../lab/adapter.js';
import {sampleCameraShot, applyCameraShot} from '../lab/camera-driver.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const req=createRequire(createRequire(import.meta.url)('./shared-runtime.cjs')(process.argv.find(s=>s.startsWith('--dependencies='))?.slice(15)));
const {PerspectiveCamera, Vector3}=req('three');
const camera=new PerspectiveCamera(45,16/9,.1,1000);
let count=0,maxProjectionError=0,dirtyCameraCases=0;
for(const candidate of Object.values(candidateById).filter(c=>c.module==='camera'))for(const t of [0,.5,2,4,7,9.5,12]){
 const pose=candidate.sample(t).camera;
 applyCameraPose(camera,pose);camera.updateMatrixWorld(true);
 const matrix=[...camera.matrixWorld.elements];
 const projection=[...camera.projectionMatrix.elements],aspect=camera.aspect;
 // Reusing a camera from another shot must not inherit zoom, lens shift or crop.
 camera.zoom=2.4;camera.filmOffset=7.5;
 camera.setViewOffset(1920,1080,220,90,1440,810);camera.updateProjectionMatrix();
 applyCameraPose(camera,pose);camera.updateMatrixWorld(true);
 assert.equal(camera.zoom,1,'pose replaces previous zoom');
 assert.equal(camera.filmOffset,0,'pose replaces previous lens shift');
 assert.equal(camera.aspect,aspect,'pose preserves the renderer aspect ratio');
 assert.deepEqual([...camera.projectionMatrix.elements],projection,'dirty camera projection matches a clean application');
 assert(Math.abs(camera.getEffectiveFOV()-pose.fov)<1e-12,'sampled FOV is effective FOV');
 dirtyCameraCases++;
 applyCameraPose(camera,candidate.sample(9-t).camera);
 applyCameraPose(camera,pose);camera.updateMatrixWorld(true);
 assert.deepEqual([...camera.matrixWorld.elements],matrix,'absolute roll does not accumulate');
 for(const delta of [[0,0,0],[.4,.2,.3],[-.5,-.2,.4],[.1,.3,-.2]]){
  const point=pose.target.map((x,i)=>x+delta[i]);
  const fp=candidate.codeFile.endsWith('camera-flight.js')?viewFor(pose).point(point).point:null;
  const p=candidate.codeFile.endsWith('camera-depth.js')?depthProjector(pose)(point):fp?{x:fp[0],y:fp[1]}:projector(pose)(point),q=new Vector3(...point).project(camera);
  const x=(q.x+1)*800,y=(1-q.y)*450;
  const error=Math.hypot(x-p.x,y-p.y);assert(error<1e-8,'Canvas and Three camera projection match');maxProjectionError=Math.max(maxProjectionError,error);count++;
 }
}
const nonLoop=Object.values(candidateById).filter(c=>c.module==='camera'&&c.loop===false);
for(const c of nonLoop){
 assert.deepEqual(sampleCameraShot(c.id,-30).camera,c.sample(0).camera);
 assert.deepEqual(sampleCameraShot(c.id,99999).camera,c.sample(c.duration).camera);
 let seen=null;const shot=sampleCameraShot(c.id,180);applyCameraShot(camera,shot,(worldTime,state)=>{seen={worldTime,state}});
 assert.equal(seen.worldTime,shot.worldTime);assert.deepEqual(seen.state,shot.state);
}
assert.throws(()=>sampleCameraShot('missing',0));assert.throws(()=>sampleCameraShot('camera-orbit-bank',0,0));
const result={passed:true,projectionSamples:count,maxProjectionError,dirtyCameraCases,projectionReset:{zoom:1,filmOffset:0,aspectPreserved:true,viewOffsetReplaced:true},clampedCandidates:nonLoop.map(c=>c.id),absoluteRoll:true,actionClockForwarded:true};
fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa/camera-adapter.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
