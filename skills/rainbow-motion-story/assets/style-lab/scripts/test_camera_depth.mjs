import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {candidates,SCENE,ANCHORS,MESHES,STAGE_TIMES,SENSOR_HEIGHT_MM,resolveOptions,sampleCameraDepth,
  focalLengthToFov,thinLensImageDistanceMm,circleOfConfusionMm,circleOfConfusionPixels,opticalDepth,makeProjector,drawCameraDepth} from '../lab/modules/camera-depth.js';

let checks=0,samples=0,draws=0;const check=(ok,label)=>{assert.ok(ok,label);checks++;},equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const near=(a,b,e=1e-9,label='near')=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=e,`${label}: ${a} != ${b}`);
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=v=>v.map(x=>x/Math.hypot(...v));
const distance=(a,b)=>Math.hypot(...sub(a,b));
const finite=o=>{if(typeof o==='number')check(Number.isFinite(o),'finite state');else if(o&&typeof o==='object')Object.values(o).forEach(finite);};
const geometry=s=>({camera:s.camera,focus:s.focus,objects:s.objects});

// Independent physical ray-cone construction at the sensor plane, in metres.
for(const f of [28,50,85])for(const N of [1.4,2.8,8,16])for(const z of [2,3.3,9,14])for(const s of [2,7,24]){
  const fm=f/1000,vz=1/(1/fm-1/z),vs=1/(1/fm-1/s),apertureRadius=fm/(2*N),sensorDiameter=2*Math.abs(apertureRadius*(1-vs/vz))*1000;
  near(circleOfConfusionMm(z,s,f,N),sensorDiameter,1e-11,'CoC agrees with independent ray-cone similar triangles');
  near(circleOfConfusionMm(z,s,f,N*2),circleOfConfusionMm(z,s,f,N)/2,1e-12,'doubling f-number halves diameter');
  near(thinLensImageDistanceMm(z,f),vz*1000,1e-11,'image distance uses metre/mm conversion');
  near(circleOfConfusionMm(z,z,f,N),0,0,'focus plane has zero defocus diameter');
  near(circleOfConfusionPixels(sensorDiameter,1800),2*circleOfConfusionPixels(sensorDiameter,900),1e-10,'pixel CoC scales with actual output height');
}
near(circleOfConfusionMm(3,8,50,2.8),12500000/66780000,1e-12,'specific independent physical fixture');
near(focalLengthToFov(50),2*Math.atan(20.25/100)*180/Math.PI,1e-12,'36mm horizontal 16:9 crop yields sensorHeight20.25');
for(const args of [[0,8,50,2.8],[-1,8,50,2.8],[3,.05,50,2.8],[3,8,50,0],[3,8,NaN,2.8],[3,8,50,Infinity]]){assert.throws(()=>circleOfConfusionMm(...args),RangeError);checks++;}
assert.throws(()=>thinLensImageDistanceMm(.05,50),RangeError);checks++;
equal(resolveOptions({fNumber:0,focalLengthMm:999,focusMode:'wrong',manualFocusM:-3,depthMode:'wrong'}),{fNumber:1.4,focalLengthMm:85,focusMode:'directed',manualFocusM:2,depthMode:'dof'},'UI options clamp to explicit valid domain');
const axisCamera={position:[0,0,0],target:[0,0,1],roll:0,focalLengthMm:50,sensorHeightMm:20.25,principalPoint:[.5,.52]};
near(opticalDepth([0,0,8],axisCamera),8);near(opticalDepth([6,0,8],axisCamera),8,0,'off-axis position keeps axial depth, not 10m slant distance');
const axisProject=makeProjector(axisCamera);near(axisProject([1,0,8]).x,800-900*50/20.25/8,1e-9,'pinhole geometry uses lens/sensor ratio');
check(!axisProject([0,0,-1]).visible,'behind-camera point is clipped, not abs-reflected');

// Ray-triangle intersections with the actual bevelled opaque plate, no screen-space claim.
function rayTriangle(origin,end,a,b,c){const dir=sub(end,origin),e1=sub(b,a),e2=sub(c,a),p=cross(dir,e2),det=dot(e1,p);if(Math.abs(det)<1e-10)return false;const inv=1/det,t=sub(origin,a),u=dot(t,p)*inv;if(u<0||u>1)return false;const q=cross(t,e1),v=dot(dir,q)*inv;if(v<0||u+v>1)return false;const fraction=dot(e2,q)*inv;return fraction>1e-6&&fraction<1-1e-6;}
const front=MESHES['copper-leaf'].find(f=>f.id==='copper-leaf/front').vertices;
const triangles=front.slice(1,-1).map((v,i)=>[front[0],v,front[i+2]]);
const heroPoints=MESHES['ceramic-orbit'].filter(f=>f.id.includes('/surface-')).filter((_,i)=>i%4===0).map(f=>f.vertices[0]);
function occlusion(time,variant){const s=sampleCameraDepth(time,variant);return heroPoints.filter(p=>triangles.some(tri=>rayTriangle(s.camera.position,p,...tri))).length/heroPoints.length;}
const occlusionStart=occlusion(0,'parallax'),occlusionEnd=occlusion(14,'parallax');
check(occlusionStart>.65,'opaque foreground genuinely occludes most sampled torus surface at start');
near(occlusionEnd,0,0,'parallel camera move reveals the complete sampled torus');
for(let t=0;t<=14;t+=.25)near(occlusion(t,'track'),0,0,'tracking path never re-hides the subject behind foreground');
const parallaxStart=sampleCameraDepth(2,'parallax'),parallaxEnd=sampleCameraDepth(9.5,'parallax');
const dx=Object.fromEntries(parallaxStart.objects.map((o,i)=>[o.layer,parallaxEnd.objects[i].projected.x-o.projected.x]));
check(Math.abs(dx.near)>Math.abs(dx.hero)&&Math.abs(dx.hero)>Math.abs(dx.far),'near/middle/far screen shifts have geometric parallax order');
near(dx.near*parallaxStart.objects[0].depthM,dx.hero*parallaxStart.objects[1].depthM,1e-8,'parallel translation screen displacement inversely proportional to depth');

for(const c of candidates){
  check(c.duration===14&&!c.loop&&c.variant&&c.module==='camera','finite public candidate metadata');equal(c.stageTimes,STAGE_TIMES,'shared stage contract');
  equal(c.sample(-5),c.sample(0),'negative clamp');equal(c.sample(NaN),c.sample(0),'invalid time clamp');equal(c.sample(99),c.sample(14),'finite terminal hold');
  const times=[13.7,2.4,0,9.5,4.8,14];equal(times.map(t=>c.sample(t)),times.toReversed().map(t=>c.sample(t)).toReversed(),'history-free arbitrary seek');
  for(const start of c.stageTimes)check(c.sample(start).stageIndex===c.stageTimes.indexOf(start),'exact stage boundary selects correct chapter');
  for(const mode of ['directed','near','hero','far','manual'])for(const f of [28,50,85])for(let frame=0;frame<=420;frame++){
    const options={focusMode:mode,focalLengthMm:f,fNumber:frame%2?1.4:16,manualFocusM:6.4},s=c.sample(frame/30,options);samples++;finite(s);
    equal(s.objects.map(o=>o.id),SCENE.objects.map(o=>o.id),'three stable object identities');equal(s.objects.map(o=>o.position),SCENE.objects.map(o=>o.position),'objects never secretly translate to create a reveal');
    for(const object of s.objects){const forward=norm(sub(s.camera.target,s.camera.position)),independentDepth=dot(sub(object.position,s.camera.position),forward);near(object.depthM,independentDepth,1e-12,'actual optical axis depth');near(object.cocPx,object.cocMm/SENSOR_HEIGHT_MM*900,1e-10,'sensor-to-reference-pixel conversion');check(object.depthM>.1&&object.cocMm>=0&&object.blurPx<=24,'positive depth and explicit preview blur cap');}
    if(mode==='manual')near(s.focus.depthM,6.4,0,'manual focus holds axial distance');
    else if(mode!=='directed'){const anchor=ANCHORS[mode];near(s.focus.depthM,opticalDepth(anchor.position,s.camera),1e-12,'locked focus follows actual anchor');near(s.objects.find(o=>o.layer===mode).cocMm,0,1e-12,'locked anchor layer is in focus');check(s.annotation.includes(anchor.label),'override annotation names actual focus target');}
    else if(c.variant!=='handoff'||s.time>=5.5)near(s.objects.find(o=>o.layer==='hero').cocMm,0,1e-12,'directed track/reveal and completed handoff keep hero focus');
    if(c.variant==='handoff'){equal(s.camera.position,c.sample(0,options).camera.position,'focus handoff keeps fixed camera position');equal(s.camera.target,c.sample(0,options).camera.target,'focus handoff keeps fixed viewing direction');}
    if(s.time>=11.5){check(s.readHold&&s.geometryStable,'terminal read hold metadata');equal(geometry(s),geometry(c.sample(14,options)),'all optical and geometric states freeze in final hold');}
  }
  // Whole main subject must remain visible for every supported lens and frame.
  for(const f of [28,50,85])for(let frame=0;frame<=420;frame+=3){const s=c.sample(frame/30,{focalLengthMm:f}),project=makeProjector(s.camera);for(const face of MESHES['ceramic-orbit'].filter(f=>f.id.includes('/surface-')).filter((_,i)=>i%4===0))for(const point of face.vertices){const p=project(point);check(p.visible&&p.x>90&&p.x<1510&&p.y>175&&p.y<742,`${c.id} focal ${f} frame ${frame}: main subject respects stage/HUD bounds (${p.x},${p.y})`);}}
  for(const t of [0,2,5.5,9.5,11.5,14]){const h=1e-4,a=c.sample(t-h),b=c.sample(t),d=c.sample(t+h);for(const field of ['position','target'])for(let axis=0;axis<3;axis++)near((b.camera[field][axis]-a.camera[field][axis])/h,(d.camera[field][axis]-b.camera[field][axis])/h,.001,'camera C1 boundary');near((b.focus.depthM-a.focus.depthM)/h,(d.focus.depthM-b.focus.depthM)/h,.001,'focus C1 boundary');}
  for(const t of [0,3.7,9.5,14])equal(geometry(c.sample(t,{depthMode:'dof'})),geometry(c.sample(t,{depthMode:'sharp'})),'sharp comparison never changes camera, focus, geometry or CoC');
}
check(Math.abs(distance(ANCHORS.hero.position,sampleCameraDepth(5,'track').camera.position)-sampleCameraDepth(5,'track').focus.depthM)>.001,'off-axis tracking fixture detects wrong Euclidean focus implementation');
const maxBlur=sampleCameraDepth(6,'handoff',{focalLengthMm:85,fNumber:1.4,focusMode:'manual',manualFocusM:2}).objects.find(o=>o.layer==='far');check(maxBlur.previewBlurClamped&&maxBlur.cocPx>48&&maxBlur.blurPx===24,'preview cap does not corrupt physical CoC');

// Actual grouped draw path; offscreen stubs preserve command hashes and filter state.
let canvasNumber=0;const contexts=[];
function recorder(){const commands=[],stack=[],properties={globalAlpha:1,filter:'none'},hud=[],drawImages=[];let transform=[1,0,0,1,0,0];
  const ctx=new Proxy(properties,{get(target,key){if(key in target)return target[key];if(key==='save')return()=>{stack.push({properties:{...target},transform:[...transform]});commands.push(['save']);};if(key==='restore')return()=>{check(stack.length>0,'balanced Canvas save/restore');const value=stack.pop();for(const k of Object.keys(target))delete target[k];Object.assign(target,value.properties);transform=value.transform;commands.push(['restore']);};
    if(key==='createLinearGradient'||key==='createRadialGradient')return(...args)=>{check(args.every(Number.isFinite),'finite gradient arguments');const value={type:key,args,stops:[]};value.addColorStop=(...stop)=>value.stops.push(stop);return value;};
    if(key==='drawImage')return(canvas,...args)=>{const capture={source:createHash('sha256').update(JSON.stringify(canvas.record.commands)).digest('hex'),filter:target.filter,args,transform:[...transform]};drawImages.push(capture);commands.push(['drawImage',capture]);};
    return(...args)=>{check(args.filter(a=>typeof a==='number').every(Number.isFinite),'finite actual Canvas method arguments');if(key==='clearRect'){commands.length=0;hud.length=0;drawImages.length=0;}if(key==='setTransform')transform=[...args];if(key==='fillText')hud.push({text:args[0],filter:target.filter});commands.push([key,...args]);};
  },set(target,key,value){if(typeof value==='number')check(Number.isFinite(value),'finite Canvas property');target[key]=value;commands.push(['set',key,value]);return true;}});const record={ctx,commands,stack,hud,drawImages};contexts.push(record);return record;
}
globalThis.OffscreenCanvas=class{constructor(width,height){this.id=++canvasNumber;this.width=width;this.height=height;this.record=recorder();}getContext(){return this.record.ctx;}};
const frameHash=record=>createHash('sha256').update(JSON.stringify(record.commands)).digest('hex');
for(const c of candidates){const ctx=recorder(),hashes=new Map();for(const t of [0,3.6,6.2,11.5,14]){c.draw(ctx.ctx,t,1600,900,{});draws++;hashes.set(t,frameHash(ctx));check(ctx.stack.length===0&&ctx.hud.length>5&&ctx.hud.every(t=>t.filter==='none'),'HUD remains sharp after grouped defocus');check(ctx.drawImages.length===3,'three independently depth-sorted object groups');}
  for(const t of [14,3.6,0,11.5,6.2]){c.draw(ctx.ctx,t,1600,900,{});draws++;check(frameHash(ctx)===hashes.get(t),'same context arbitrary seek has identical complete draw commands');}
  c.draw(ctx.ctx,12,1600,900,{});const endHash=frameHash(ctx);c.draw(ctx.ctx,14,1600,900,{});check(frameHash(ctx)===endHash,'actual final frames hold without time-HUD changes');
  const s=c.sample(6.2),dof=recorder(),sharp=recorder();drawCameraDepth(dof.ctx,6.2,1600,900,{depthMode:'dof'},s,c.variant);drawCameraDepth(sharp.ctx,6.2,1600,900,{depthMode:'sharp'},s,c.variant);check(frameHash(dof)!==frameHash(sharp),'same state produces distinct defocus versus all-sharp composition');
}
for(const context of contexts)check(context.stack.length===0,'all offscreen stacks restored');
check(contexts.some(c=>c.drawImages.some(image=>/^blur\(/.test(image.filter))),'actual offscreen compositing uses optical defocus mapping');
delete globalThis.OffscreenCanvas;

const report={passed:true,checks,samples,draws,occlusion:{initialFraction:occlusionStart,finalFraction:occlusionEnd,surfacePoints:heroPoints.length},parallaxPixels:dx,
  verified:['Independent lens ray-cone calculation in metres against API millimetres','Aperture, focus-plane and output-height invariants','Pinhole projection and explicit axial depth','Behind-camera rejection and invalid optical-domain errors','Actual foreground ray-triangle occlusion and geometric reveal','Tracking never hides target behind foreground','Near/middle/far inverse-depth parallax','Fixed scene identities','Supported-lens subject safe region','C1 camera and focus joins','Same-state sharp/defocus comparison','Finite silent terminal hold','Actual Canvas depth-group/filter commands and sharp HUD','Arbitrary draw order determinism'],
  notVerified:['Physical path-traced lens bokeh','Per-pixel depth of field or occlusion reconstruction','Chromatic aberration or real lens focus breathing','Browser raster appearance and subjective aesthetics','GPU performance']};
writeFileSync(fileURLToPath(new URL('../qa/camera-depth.json',import.meta.url)),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
