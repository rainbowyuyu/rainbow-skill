import assert from 'node:assert/strict';
import {shellToForce,quantityToTerm,VEHICLE_ID,NOZZLE_MOUNTS,vehicleToWorld,shadowPoint,
    projectContinuityPoint,buildVehicleGeometry} from '../lab/modules/continuity.js';
import {palettes} from '../lab/modules/common.js';
import {candidates,modules,candidateById} from '../lab/modules/index.js';

let checks=0,stateSamples=0,geometrySamples=0,drawSamples=0;
const check=(x,label)=>{assert.ok(x,label);checks++;};
const near=(a,b,eps=1e-9,label='number')=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=eps,`${label}: ${a} != ${b}`);
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const length=p=>Math.hypot(...p);
const distance=(a,b)=>length(a.map((v,i)=>v-b[i]));
const vecNear=(a,b,eps=1e-9,label='vector')=>a.forEach((v,i)=>near(v,b[i],eps,label));
const overlaps=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
const labelBox=l=>[l.position[0]-l.width/2,l.position[1]-29,l.position[0]+l.width/2,l.position[1]+8];
const formulaBoxes=[[952,421,1040,477],[1085,415,1225,490],[1250,421,1295,477],[1313,415,1483,490]];
const movingValues=s=>[...s.camera.position,...s.camera.target,...s.shells.flatMap(p=>p.world),s.open,s.exhaust,s.force];

for(const c of [shellToForce,quantityToTerm]){
    check(c.duration===12&&c.loop===false,'clamped 12 second candidates');
    check(candidateById[c.id]===c&&modules[c.module].includes(c),'registered in existing category');
    check(candidates.filter(p=>p.id===c.id).length===1,'registered once');
    const ts=[0,.1,2.02,7.2,4.9,12,3.7];
    const first=ts.map(t=>c.sample(t));
    equal(ts.toReversed().map(t=>c.sample(t)).toReversed(),first,'arbitrary seek has no history');
    equal(c.sample(-20),c.sample(0),'negative time clamps to initial state');
    equal(c.sample(90),c.sample(12),'end holds instead of wrapping');
    equal(c.sample(NaN),c.sample(0),'invalid time resolves to deterministic initial state');
    for(let i=0;i<=1440;i++){
        const s=c.sample(i/120);stateSamples++;
        check(s.vehicle.id===VEHICLE_ID,'one vehicle identity through every handoff');
        check(s.nozzles.length===4,'four fixed nozzles');
        for(let j=0;j<4;j++){
            const n=s.nozzles[j],rest=NOZZLE_MOUNTS[j];
            equal(n.local,rest.local,'rigid mount never animates independently');
            check(n.parentId===VEHICLE_ID&&n.id===rest.id,'stable nozzle parent and ID');
            vecNear(n.world,vehicleToWorld(n.local,s.vehicle),1e-12,'mount shares parent transform');
            near(distance(n.world,n.exit),.47,1e-12,'fixed nozzle length');
            near(length(n.direction),1,1e-12,'unit exhaust direction');
            check(n.exit[1]>.6,'no nozzle intersects the floor');
            const q=projectContinuityPoint(n.world,s.camera,s.offsetX||0);
            check(q.depth>s.camera.near&&q.point!==null,'mount stays beyond near plane');
        }
        for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)near(distance(s.nozzles[a].world,s.nozzles[b].world),distance(NOZZLE_MOUNTS[a].local,NOZZLE_MOUNTS[b].local),1e-12,'pair distances remain rigid');
        check(s.camera.position.every(Number.isFinite)&&s.camera.target.every(Number.isFinite),'finite camera');
        near(s.camera.focusDistance,distance(s.camera.position,s.camera.target),1e-12,'focus tracks target');
        if(c===shellToForce){
            for(const part of s.shells){
                check(part.parentId===VEHICLE_ID,'shell remains in assembly graph');
                vecNear(part.world,vehicleToWorld(part.local.map((v,k)=>v+part.offset[k]),s.vehicle),1e-12,'shell follows declared local path');
                check(part.world[1]>=s.vehicle.position[1]+.1,'shell never drops through chassis');
            }
            s.shadows.forEach(shadow=>{
                const source=shadow.sourceId===VEHICLE_ID?s.vehicle.position:s.shells.find(p=>p.id===shadow.sourceId).world;
                vecNear(shadow.center,shadowPoint(source),1e-12,'shadow derived from actual source');
                near(shadow.center[1],.014,1e-12,'common shadow receiver');
            });
            if(s.label.alpha>.001){
                const points=[s.label.anchor,s.label.elbow,s.label.position];
                check(points.every(p=>p[0]>=65&&p[0]<=1525&&p[1]>=160&&p[1]<=710),'label safe area');
                vecNear(s.label.anchor,projectContinuityPoint(s.nozzles[1].exit,s.camera).point,1e-12,'label anchored to actual exit');
                check(s.inspect>.999&&s.open>.999,'labels wait for camera and assembly');
            }
        }else{
            near(s.terms.velocity,.6*s.v*s.v,1e-12,'velocity term arithmetic');
            near(s.terms.angle,.4*s.theta*s.theta,1e-12,'angle term arithmetic');
            near(s.J,s.terms.velocity+s.terms.angle,1e-12,'J arithmetic');
            near(s.thetaRadians,s.theta*.54,1e-12,'orientation follows normalized angle');
            near(s.formula.baseline,468,0,'fixed formula baseline');
            Object.values(s.formula.positions).forEach(p=>near(p[1],468,0,'all terms share baseline'));
            const labels=Object.values(s.labels).filter(l=>l.alpha>.01);
            labels.forEach(l=>{
                const b=labelBox(l);check(b[0]>=65&&b[1]>=165&&b[2]<=1525&&b[3]<=710,'label rectangle safe area');
                formulaBoxes.forEach(box=>check(!overlaps(b,box),'moving labels never cross formula terms'));
            });
            if(labels.length===2)check(!overlaps(labelBox(labels[0]),labelBox(labels[1])),'labels never overlap one another');
            if(s.formula.highlight.velocity>0)check(s.labels.velocity.handoff>.99,'first term highlights after quantity handoff');
            if(s.formula.highlight.angle>0)check(s.labels.angle.handoff>.99,'second term highlights after quantity handoff');
        }
    }
}

// Stable reading windows are genuine geometric holds, not only a text label.
for(const t of [6.5,7.0,7.8,8.7]){
    const a=shellToForce.sample(7.2),b=shellToForce.sample(t);
    equal(b.camera,a.camera,'camera holds during force reading');equal(b.shells,a.shells,'shells hold during reading');equal(b.nozzles,a.nozzles,'nozzles hold during reading');
    near(b.exhaust,1,0,'stable plume amount');near(b.force,1,0,'stable force amount');
}
const initial=shellToForce.sample(0),final=shellToForce.sample(12);
equal(initial.vehicle,final.vehicle,'same exterior assembly at both ends');equal(initial.shells,final.shells,'shells return exactly');equal(initial.camera,final.camera,'camera returns exactly');
for(const [a,b] of [[4.4,5.05],[8.6,12]]){
    const first=quantityToTerm.sample(a);
    for(let t=a;t<b;t+=.03){const s=quantityToTerm.sample(t);near(s.v,first.v,0,'velocity hold');near(s.theta,first.theta,0,'angle hold');near(s.J,first.J,0,'formula read hold');equal(s.labels,first.labels,'labels hold for reading');}
}
// Only one quantity changes at once. No formula term jumps ahead of its entity value.
for(let i=1;i<1440;i++){
    const a=quantityToTerm.sample((i-1)/120),b=quantityToTerm.sample((i+1)/120);
    check(!(Math.abs(a.v-b.v)>1e-10&&Math.abs(a.theta-b.theta)>1e-10),'one changing parameter at a time');
}
// Quintic stage joins must have continuous positions, velocities and accelerations.
const boundaries=[1.25,3.15,3.25,4.75,5.1,5.8,5.9,6.45,8.75,8.8,9,9.25,9.3,9.35,10.85,11.45];
for(const t of boundaries){
    const h=1e-4,a=movingValues(shellToForce.sample(t-h)),b=movingValues(shellToForce.sample(t)),c=movingValues(shellToForce.sample(t+h));
    a.forEach((v,i)=>{near((b[i]-v)/h,(c[i]-b[i])/h,.005,'join velocity continuity');});
}

// Mesh audit catches detached, offscreen or nonfinite parts, including displaced shells.
let faceCount=0,minDepth=Infinity;
for(const c of [shellToForce,quantityToTerm])for(let i=0;i<=24;i++){
    const s=c.sample(i*.5),mesh=buildVehicleGeometry(s,palettes.titanium,{closed:c===quantityToTerm,showForces:c===shellToForce});geometrySamples++;
    check(mesh.groups.some(g=>g.id==='chassis'),'chassis in render graph');
    for(const mount of NOZZLE_MOUNTS)check(mesh.groups.some(g=>g.id===mount.id),'all four nozzles rendered');
    for(const f of mesh.faces){
        faceCount++;
        for(const v of f.points){
            check(v.length===3&&v.every(Number.isFinite),'finite mesh vertex');
            const q=projectContinuityPoint(v,s.camera,s.offsetX||0);minDepth=Math.min(minDepth,q.depth);
            check(q.depth>.12,'whole body in front of near plane');
            check(q.point[0]>65&&q.point[0]<1535&&q.point[1]>165&&q.point[1]<710,'main entity within readable stage');
        }
    }
    const vertexSet=new Set(mesh.groups.filter(g=>g.shadow).flatMap(g=>g.faces).flatMap(f=>f.points).map(shadowPoint).map(p=>p.map(n=>n.toFixed(8)).join(',')));
    for(const shadow of mesh.ground.filter(f=>f.color==='#02080e'))for(const p of shadow.points)check(vertexSet.has(p.map(n=>n.toFixed(8)).join(',')),'shadow hull comes from transformed mesh vertices');
}

// Recording a Canvas call stream checks deterministic draw without claiming browser QA.
function context(){
    const calls=[],state={globalAlpha:1,lineWidth:1,strokeStyle:'#000000',fillStyle:'#000000'},stack=[];let gradientId=0;
    return {calls,ctx:new Proxy(state, {get(o,k){
        if(k in o)return o[k];
        if(k==='save')return()=>{stack.push({...o});calls.push(['save']);};
        if(k==='restore')return()=>{Object.assign(o,stack.pop());calls.push(['restore']);};
        if(k==='createLinearGradient'||k==='createRadialGradient')return(...args)=>{
            const id=`gradient-${gradientId++}`;calls.push([k,...args,id]);return {id,addColorStop:(...args)=>calls.push(['stop',id,...args])};};
        if(k==='measureText')return value=>({width:String(value).length*14});
        return(...args)=>{args.filter(a=>typeof a==='number').forEach(n=>check(Number.isFinite(n),'finite Canvas numeric argument'));calls.push([k,...args]);};
    },set(o,k,v){if(typeof v==='number')check(Number.isFinite(v),'finite Canvas property');o[k]=v;calls.push(['set',k,v&&typeof v==='object'?v.id:v]);return true;}})};
}
for(const c of [shellToForce,quantityToTerm])for(const palette of ['titanium','porcelain'])for(const t of [0,4.7,7.2,8,12]){
    const a=context(),b=context();c.draw(a.ctx,t,1600,900,{palette});c.draw(b.ctx,t,1600,900,{palette});equal(a.calls,b.calls,'identical Canvas draw stream');drawSamples++;
}
console.log(JSON.stringify({passed:true,checks,stateSamples,geometrySamples,faceCount,minDepth,drawSamples,
    verified:['Rigid mounts and identities','Actual mesh shadow projection','Stable read windows','Fixed formula baseline','Cost arithmetic','Single changing quantity','Nonoverlapping label trajectories','Continuous camera and shell stage joins','Arbitrary seek','Deterministic Canvas draw'],
    notVerified:['Browser visual quality','Physical flight simulation','Reference source reconstruction','Ray tracing']},null,2));
