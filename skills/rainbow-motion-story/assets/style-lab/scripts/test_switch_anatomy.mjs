import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {candidates,sampleSwitchAnatomy,buildSwitchScene,makeSwitchProjector,visibleSwitchFaces,STAGE_TIMES} from '../lab/modules/switch-anatomy.js';

let checks=0,samples=0,draws=0;
const check=(x,label)=>{assert.ok(x,label);checks++;},equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;},near=(a,b,e=1e-9,label='near')=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=e,`${label}: ${a},${b}`);
function finite(x){if(typeof x==='number')check(Number.isFinite(x),'finite numeric data');else if(x&&typeof x==='object')Object.values(x).forEach(finite);}
const physical=s=>({press:s.press,spring:s.mechanism.spring,contact:s.mechanism.contact,actuator:s.mechanism.actuator,force:s.mechanism.force});
for(const c of candidates){
  check(c.duration===18&&c.loop===false&&c.controls.palette===false,'finite candidate');equal(c.stageTimes,STAGE_TIMES,'explicit stage times');
  equal(c.sample(-1),c.sample(0),'negative clamp');equal(c.sample(NaN),c.sample(0),'nonfinite clamp');equal(c.sample(200),c.sample(18),'finite terminal hold');
  for(const [i,t]of STAGE_TIMES.entries())equal(c.sample(t).stageIndex,i,'exact stage boundary');
  for(let f=0;f<=540;f++){const s=c.sample(f/30);samples++;finite(s);near(s.mechanism.travelMm,s.press*4);check(s.mechanism.contact.gapMm>=0,'contact never penetrates');near(s.mechanism.spring.lengthMm,10-4*s.press);if(s.mechanism.contact.closed)near(s.mechanism.contact.fixedTip.x,s.mechanism.contact.movingTip.x,0,'actual surface contact');}
  const times=[18,8.4,3.2,0,16.5,7.12];equal(times.map(t=>c.sample(t)),times.toReversed().map(t=>c.sample(t)).toReversed(),'history-free seeking');
  for(const press of [0,.49,.5,1])for(const cut of [0,.5,1])for(const explode of [0,.4,1]){
    const s=c.sample(4,{press,cut,explode,focus:.7});equal(physical(s),physical(c.sample(13,{press,cut:1-cut,explode:1-explode,focus:0})),'presentation never changes operating mechanics');
    equal(s.parts.find(p=>p.id==='fixed-contact').displayOffset,s.parts.find(p=>p.id==='moving-contact').displayOffset,'contact pair keeps one assembly displacement');
  }
}
check(sampleSwitchAnatomy(7.2).focus===1,'camera is at actual contacts when closure begins');
near(sampleSwitchAnatomy(7.2).mechanism.contact.gapMm,0,1e-12,'closure is visible in the close view');
const open=sampleSwitchAnatomy(6.5),closed=sampleSwitchAnatomy(9.5);check(open.mechanism.contact.gapMm>.3&&closed.mechanism.contact.closed,'default close view includes visible gap and closed surface');

for(const yaw of [-.75,-.52,-.12])for(const pitch of [.25,.42,.60])for(const cut of [0,1])for(const explode of [0,1]){
  const s=sampleSwitchAnatomy(8,'explode',{viewYaw:yaw,viewPitch:pitch,cut,explode,focus:0,press:.33}),scene=buildSwitchScene(s),project=makeSwitchProjector(s.camera),faces=visibleSwitchFaces(scene,s.camera);samples++;finite(scene);
  for(const face of scene.faces)for(const vertex of face.vertices){const p=project(vertex);check(p.x>72&&p.x<1528&&p.y>158&&p.y<748,'whole-object overview framing within canvas stage');}
  check(faces.every((f,i)=>i===0||f.depth>=faces[i-1].depth),'faces sorted globally by current view depth');
  for(const id of ['stem-cam/','contact-follower/','contact-compliance/','fixed-pad/','moving-pad/'])check(scene.faces.some(f=>f.id.startsWith(id)),'real mechanical cause and contact pad meshes '+id);
}
const insidePolygon=(p,v)=>{let inside=false;for(let i=0,j=v.length-1;i<v.length;j=i++){if(((v[i].y>p.y)!==(v[j].y>p.y))&&(p.x<(v[j].x-v[i].x)*(p.y-v[i].y)/(v[j].y-v[i].y)+v[i].x))inside=!inside;}return inside;};
for(const press of [0,.25,.49,.5,.75,1])for(const yaw of [-.75,-.52,-.12])for(const pitch of [.25,.42,.60]){
  const s=sampleSwitchAnatomy(8,'section',{press,cut:1,explode:0,focus:1,viewYaw:yaw,viewPitch:pitch}),scene=buildSwitchScene(s),project=makeSwitchProjector(s.camera);
  for(const p of [scene.landmarks.fixedTip,scene.landmarks.movingTip]){const q=project(p);check(q.x>500&&q.x<1100&&q.y>350&&q.y<590,'actual contact surfaces remain central in close-up');}
  const a=project(scene.landmarks.fixedTip),b=project(scene.landmarks.movingTip);near(b.x-a.x,s.mechanism.contact.gapMm*Math.cos(yaw)*s.camera.scale,1e-10,'screen gap comes from actual same-space contact surface separation');
  const faces=visibleSwitchFaces(scene,s.camera);
  for(const [key,prefix]of [['fixedPadCenter','fixed-pad/'],['movingPadCenter','moving-pad/']]){const p=project(s.mechanism.contact[key]),top=faces.filter(f=>insidePolygon(p,f.points)).at(-1);check(top?.id.startsWith(prefix),'actual painter order leaves both contact pad centers visible; shell cannot overpaint them');}
}
function recorder(){const commands=[],stack=[],props={filter:'none',globalAlpha:1},ctx=new Proxy(props,{get(target,key){if(key in target)return target[key];if(key==='save')return()=>{stack.push({...target});commands.push(['save']);};if(key==='restore')return()=>{check(stack.length>0,'balanced Canvas state');const p=stack.pop();for(const k of Object.keys(target))delete target[k];Object.assign(target,p);commands.push(['restore']);};if(key==='createLinearGradient'||key==='createRadialGradient')return(...args)=>({type:key,args,stops:[],addColorStop(...s){this.stops.push(s);}});return(...args)=>{check(args.filter(x=>typeof x==='number').every(Number.isFinite),'finite draw arguments');if(key==='clearRect')commands.length=0;commands.push([key,...args]);};},set(target,key,value){if(typeof value==='number')check(Number.isFinite(value),'finite Canvas property');target[key]=value;commands.push(['set',key,value]);return true;}});return{ctx,commands,stack};}
const hash=r=>createHash('sha256').update(JSON.stringify(r.commands)).digest('hex');
const frameTimings=[];
for(const c of candidates){const r=recorder(),known=new Map();for(const t of [0,4,6.5,9.5,13,18]){const start=performance.now();c.draw(r.ctx,t,1600,900,{});frameTimings.push(performance.now()-start);draws++;known.set(t,hash(r));check(r.stack.length===0,'drawing restores state');}
  for(const t of [13,0,18,6.5,4,9.5]){c.draw(r.ctx,t,1600,900,{});draws++;equal(hash(r),known.get(t),'actual Canvas commands are deterministic across random seek');}
  c.draw(r.ctx,8,800,450,{press:.25,cut:1,explode:1,focus:1,labels:false});draws++;check(!r.commands.some(c=>c[0]==='fillText'&&String(c[1]).startsWith('表面间隙')),'label override hides optional local measurement');
}
const report={passed:true,checks,samples,draws,recorderDrawMeanMs:frameTimings.reduce((a,b)=>a+b,0)/frameTimings.length,verified:['finite 18 second candidates','press, spring and contact share one core state','opening, explosion and focus independent of mechanics','shared display displacement for the two contacting pads','continuous camera enters actual contact before closure','whole-object overview inside canvas stage at view limits','actual local gap projects from pad surfaces','cam, follower and compliance meshes present','both contact-pad centers remain visible in actual painter order','finite and history-free actual Canvas commands'],notVerified:['browser raster quality','production-switch geometry','FEM contact mechanics','general 3D collision audit','electrical load or switching bounce']};
writeFileSync(fileURLToPath(new URL('../qa/switch-anatomy.json',import.meta.url)),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
