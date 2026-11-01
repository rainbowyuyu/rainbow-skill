import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {candidates,DURATION,STAGE_TIMES,APEX_COLORS,sampleRotaryInteraction,resolveRotaryOptions,rotaryCameraBasis,buildRotaryScene,frameRotaryScene,frameRotaryState,makeRotaryProjector,visibleRotaryFaces} from '../lab/modules/rotary-interaction.js';
import {housingRadialClearance} from '../lab/modules/rotary-geometry.js';

let checks=0,samples=0,draws=0;
const check=(v,label)=>{assert.ok(v,label);checks++;};
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const near=(a,b,t=1e-9,label='near')=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${label}: ${a} vs ${b}`);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function finite(v){if(typeof v==='number')check(Number.isFinite(v),'finite numeric state');else if(v&&typeof v==='object')Object.values(v).forEach(finite);}
const motion=s=>({shaftAngle:s.shaftAngle,rotorAngle:s.rotorAngle,center:s.center,apices:s.apices});

equal(candidates.map(c=>c.id),['mechanics-rotary-section','mechanics-rotary-explode'],'two finite candidates');
equal(APEX_COLORS.length,3,'three persistent vertex colors');
for(const c of candidates){
  check(c.duration===18&&c.loop===false&&c.controls.palette===false&&c.controls.intensity===false,'finite clip metadata');
  equal(c.stageTimes,STAGE_TIMES,'shared stage times');
  equal(c.sample(-10),c.sample(0),'negative timeline clamps');equal(c.sample(Infinity),c.sample(0),'invalid time clamps');equal(c.sample(99),c.sample(18),'terminal state holds');
  for(const [i,t]of STAGE_TIMES.entries())equal(c.sample(t).stageIndex,i,'exact stage boundary');
  const times=[17.8,1.1,8.7,0,18,4.35,12.33],forward=times.map(t=>c.sample(t));equal(times.toReversed().map(t=>c.sample(t)).toReversed(),forward,'arbitrary seeks have no history');
  for(let i=0;i<=720;i++){
    const s=c.sample(DURATION*i/720);samples++;finite(s);near(s.rotorAngle*3,s.shaftAngle,1e-12,'unwrapped 3:1 speed relationship');near(Math.hypot(s.center.x,s.center.y),.22,1e-12,'eccentric center radius');
    for(const a of s.apices){near(Math.hypot(a.x-s.center.x,a.y-s.center.y),1,1e-12,'rigid radius');near(housingRadialClearance(a),0,2e-12,'all three apices trace the same housing');}
    for(const p of s.parts)equal(p.position,p.restPosition.map((v,j)=>v+p.travel[j]),'part displacement is explicit and reversible');
  }
  const start=c.sample(0),end=c.sample(18);near(end.shaftAngle,Math.PI*6);near(end.rotorAngle,Math.PI*2);
  start.apices.forEach((a,i)=>{near(a.x,end.apices[i].x,1e-12,'tagged x closes after three shaft turns');near(a.y,end.apices[i].y,1e-12,'tagged y closes after three shaft turns');});
  equal(start.parts.map(p=>p.travel),end.parts.map(p=>p.travel),'fully reassembled terminal part positions');
  const oneTurn=c.sample(6);check(distance([start.apices[0].x,start.apices[0].y],[oneTurn.apices[0].x,oneTurn.apices[0].y])>1,'tagged apex is not reset each shaft turn');
  for(const cut of [0,.15,.4,.75,1])for(const explode of [0,.5,1]){
    const a=c.sample(2,{cut,explode,shaftAngle:7.4}),b=c.sample(16,{cut,explode,shaftAngle:7.4});equal(a.parts,b.parts,'manual opening/explosion and phase override are independent of timeline');
    equal(motion(a),motion(c.sample(8,{cut:1-cut,explode:1-explode,shaftAngle:7.4})),'assembly changes never reset motion phase');
    const d=c.sample(8,{cut,explode,shaftAngle:9.3});equal(a.parts.map(p=>p.travel),d.parts.map(p=>p.travel),'rotation does not change assembly displacement');
    near(a.cut,cut,0);near(a.explode,explode,0);
  }
  equal(motion(c.sample(2,{motionTime:13})),motion(c.sample(13)),'motionTime overrides phase only');
  near(c.sample(1,{shaftAngle:8,motionTime:4}).shaftAngle,8,0,'shaftAngle wins over motionTime');
  const manual=c.sample(8,{shaftAngle:8,cut:0,explode:0});check(manual.annotation.includes('前盖闭合')&&!manual.annotation.includes('同时可见'),'manual annotation describes actual assembly state');check(!manual.drive.speedKnownFromSample&&manual.drive.instantaneousRpm===null,'an absolute angle override does not invent a measured speed');
  const closed=c.sample(4,{cut:0,explode:0}),axial=c.sample(4,{cut:.2,explode:0}),parked=c.sample(4,{cut:1,explode:0});
  equal(closed.parts.find(p=>p.id==='front-cover').travel,[0,0,0],'closed complete cover has zero travel');
  const ax=axial.parts.find(p=>p.id==='front-cover');near(ax.travel[0],0,0,'first step is axial only');check(ax.travel[2]>0,'cover withdraws first');
  const pk=parked.parts.find(p=>p.id==='front-cover');near(pk.travel[0],3.7,0,'complete cover parks laterally');near(pk.travel[2],.82,0,'cover retains axial clearance');
}
const invalid=resolveRotaryOptions({viewYaw:100,viewPitch:-100,cut:2,explode:-1,shaftAngle:NaN,motionTime:Infinity});equal(invalid,{viewYaw:.65,viewPitch:.2,labels:true,motionTime:null,shaftAngle:null,cut:1,explode:0},'option domains and nonfinite fallback');

for(const yaw of [-.65,0,.65])for(const pitch of [.2,.5,.8]){
  const b=rotaryCameraBasis(yaw,pitch);for(const v of [b.right,b.up,b.view])near(Math.hypot(...v),1,1e-12,'unit orthographic basis');near(dot(b.right,b.up),0,1e-12);near(dot(b.right,b.view),0,1e-12);near(dot(b.up,b.view),0,1e-12);
  for(const cut of [0,.5,1])for(const explode of [0,1]){
    const s=sampleRotaryInteraction(8,'explode',{viewYaw:yaw,viewPitch:pitch,cut,explode}),scene=buildRotaryScene(s),camera=frameRotaryScene(s,scene),project=makeRotaryProjector(camera),faces=visibleRotaryFaces(scene,camera);samples++;finite(scene);finite(camera);
    equal(frameRotaryState(s),camera,'lightweight framing exactly matches full mesh at camera/control extremes');
    check(scene.faces.length>1500,'physical caps, inner and outer walls have tessellated geometry');
    check(scene.faces.some(f=>f.partId==='housing'&&f.surface==='inner-wall')&&scene.faces.some(f=>f.partId==='housing'&&f.surface==='section'),'housing has actual wall and annular section faces');
    check(scene.faces.filter(f=>f.partId==='front-cover').length===384,'complete cover retains same mesh at all opening values');
    check(faces.every((f,i)=>i===0||f.depth>=faces[i-1].depth),'global face depth order');
    for(const f of scene.faces)for(const v of f.vertices){const p=project(v);check(p.x>=134&&p.x<=1466&&p.y>=195&&p.y<=733,'actual supported-angle geometry remains inside stage');}
    for(const f of faces)check(dot(f.normal,b.view)>0,'visible faces are front-facing in current angle');
    const p=project([.4,.3,-2]),q=project([.4,.3,2]),r=project([.8,.3,-2]),u=project([.8,.3,2]);near(distance([p.x,p.y],[r.x,r.y]),distance([q.x,q.y],[u.x,u.y]),1e-10,'orthographic size independent of axial depth');
  }
}
// Compare every exported state, plus deterministic arbitrary controls/phase, against the original full mesh path.
const framingBench={frames:0,fullMeshMs:0,vertexOnlyMs:0};
for(const c of candidates)for(let frame=0;frame<=540;frame++){
  const t=frame/30,s=c.sample(t);let start=performance.now();const full=frameRotaryScene(s,buildRotaryScene(s));framingBench.fullMeshMs+=performance.now()-start;
  start=performance.now();const light=frameRotaryState(s);framingBench.vertexOnlyMs+=performance.now()-start;framingBench.frames++;
  equal(light,full,'every exported 30 Hz state has exactly unchanged framing camera');
}
for(let i=0;i<80;i++){
  const unit=n=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);};
  const s=sampleRotaryInteraction(18*unit(i),'explode',{cut:unit(i+11),explode:unit(i+23),shaftAngle:(unit(i+37)-.5)*60,viewYaw:-.65+1.3*unit(i+41),viewPitch:.2+.6*unit(i+53)});
  equal(frameRotaryState(s),frameRotaryScene(s,buildRotaryScene(s)),'arbitrary phases and manual settings preserve exact framing');
}
// Bore segments must remain correctly wound as the rotor turns; mismatched angular samples twist a ring.
for(let i=0;i<=72;i++){
  const s=sampleRotaryInteraction(i/4,'section',{cut:1}),scene=buildRotaryScene(s);for(const f of scene.faces.filter(f=>f.id.startsWith('rotor/front-')))near(f.normal[2],1,1e-12,'rotor annular front remains correctly wound for a full tagged period');
}

// Exercise actual draw operations, including face shading and marker ordering, not a replacement draw stub.
function recorder(){const commands=[],stack=[],props={globalAlpha:1,filter:'none'},ctx=new Proxy(props,{
  get(target,key){if(key in target)return target[key];if(key==='save')return()=>{stack.push({...target});commands.push(['save']);};if(key==='restore')return()=>{check(stack.length>0,'balanced canvas stack');const p=stack.pop();for(const k of Object.keys(target))delete target[k];Object.assign(target,p);commands.push(['restore']);};
    if(key==='createLinearGradient'||key==='createRadialGradient')return(...args)=>{check(args.every(Number.isFinite),'finite gradients');return{type:key,args,stops:[],addColorStop(...stop){this.stops.push(stop);}};};
    return(...args)=>{check(args.filter(v=>typeof v==='number').every(Number.isFinite),'finite Canvas command');if(key==='clearRect')commands.length=0;commands.push([key,...args]);};},
  set(target,key,value){if(typeof value==='number')check(Number.isFinite(value),'finite Canvas property');target[key]=value;commands.push(['set',key,value]);return true;}});
  return{ctx,commands,stack};
}
const hash=r=>createHash('sha256').update(JSON.stringify(r.commands)).digest('hex');
for(const c of candidates){const r=recorder(),hashes=new Map();for(const t of [0,2.8,8,14.2,18]){c.draw(r.ctx,t,1600,900,{});draws++;hashes.set(t,hash(r));check(r.stack.length===0,'draw restores canvas state');}
  for(const t of [18,8,0,14.2,2.8]){c.draw(r.ctx,t,1600,900,{});draws++;equal(hash(r),hashes.get(t),'reverse/random seek identical Canvas commands');}
  const options={shaftAngle:4.3,cut:1,explode:.6,viewYaw:-.65,viewPitch:.8,labels:false};c.draw(r.ctx,4,1024,576,options);draws++;check(!r.commands.some(c=>c[0]==='fillText'&&c[1]==='壳体内壁'),'labels false hides part callouts');
}
console.log(JSON.stringify({passed:true,checks,samples,draws,framingBench,verified:['18-second finite terminal state','full tagged rotation and same three apex trajectories','independent assembly and motion overrides','continuous rigid-cover withdrawal and lateral parking','fixed mesh topology and real annular sections','orthonormal projection and global face ordering','supported-angle geometry stays in frame','rotor bore front orientation through a full tagged period','actual Canvas commands finite and random-seek deterministic','vertex-only framing exactly matches full mesh at all 1082 export states and camera/control extremes'],notVerified:['Browser raster appearance','Painter-order correctness at every intersecting silhouette','Manufacturing geometry','Combustion or power','Path tracing']},null,2));
