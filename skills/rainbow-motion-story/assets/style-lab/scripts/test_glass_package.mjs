import assert from 'node:assert/strict';
import fs from 'node:fs';
import {duration,candidates,sample,routePoints,pointOnRoute,packageVias,cutawayVias,contactPlanes} from '../lab/modules/glass-package-state.js';
import {createGlassGeometry,createCapacitorGeometries} from '../lab/glass-package.bundle.js';
let checks=0,states=0;
function ok(x,msg){assert.ok(x,msg);checks++;}
function finite(x){if(typeof x==='number')ok(Number.isFinite(x),'all sample numbers finite');else if(x&&typeof x==='object')Object.values(x).forEach(finite);}
for(const c of candidates){
 const samples=[];
 for(let i=0;i<=duration*60;i++){const a=sample(i/60,{id:c.id});samples.push(a);finite(a);ok(a.camera.position[1]>a.camera.target[1],'camera remains above target');ok(a.roughness>=.12&&a.roughness<=.68,'bounded roughness');ok(a.separation>=0&&a.separation<=1,'bounded assembly');states++;}
 for(let i=samples.length-1;i>=0;i-=7){assert.deepEqual(sample(i/60,{id:c.id}),samples[i]);checks++;}
 for(const at of [3,5,7,8,16,17,18,19,21,22,23]){const a=sample(at-1e-5,{id:c.id}),b=sample(at+1e-5,{id:c.id});ok(Math.hypot(...a.camera.position.map((x,i)=>x-b.camera.position[i]))<.0001,'camera continuity across transitions');ok(Math.abs(a.separation-b.separation)<.0001,'assembly continuity');}
 const a=sample(-1,{id:c.id}),b=sample(999,{id:c.id});assert.deepEqual(a,sample(0,{id:c.id}));assert.deepEqual(b,sample(duration,{id:c.id}));checks+=2;
}
const a=sample(8,{id:'stack'}),b=sample(18,{id:'stack'});assert.deepEqual(a.camera,b.camera);assert.deepEqual(a.groups,b.groups);checks+=2;
const y=sample(12,{id:'stack'}).groups;ok(y.glass<y.redistribution&&y.redistribution<y.chips,'explosion preserves layer order');
for(const t of [0,24])ok(Object.values(sample(t,{id:'stack'}).groups).every(x=>x===0),'fully assembled at start and end');
const routeLength=routePoints.slice(1).reduce((n,p,i)=>n+Math.hypot(...p.map((x,k)=>x-routePoints[i][k])),0);
for(let i=0;i<=1000;i++){const q=pointOnRoute(i/1000);finite(q);ok(q.segment>=0&&q.segment<5,'valid conductor segment');const p=routePoints[q.segment],n=routePoints[q.segment+1];for(let k=0;k<3;k++)ok(q.position[k]>=Math.min(p[k],n[k])-1e-9&&q.position[k]<=Math.max(p[k],n[k])+1e-9,'marker remains on conductor bounds');ok(Math.abs(q.distance-i/1000*routeLength)<1e-9,'arc-length parameter');}
for(const at of [5,22])ok(sample(at,{id:'route'}).pulse.opacity===0,'signal has zero fade boundary');
const changed=sample(6,{id:'metal'});changed.camera.position[0]=999;changed.labels[0].anchor[0]=999;ok(sample(6,{id:'metal'}).camera.position[0]!==999&&sample(6,{id:'metal'}).labels[0].anchor[0]!==999,'isolated sample result');
assert.throws(()=>sample(NaN));assert.throws(()=>sample(0,{id:'unknown'}));assert.throws(()=>sample(0,{roughness:NaN}));checks+=3;
for(const via of [...packageVias,...cutawayVias])ok(via.copperRadius<via.holeRadius,'copper fits actual corresponding glass hole');
const cp=contactPlanes;ok(Math.abs(cp.solderCenter-cp.solderRadius-cp.boardTop)<1e-12,'solder exactly touches board');ok(Math.abs(cp.solderCenter+cp.solderRadius-cp.glassBottom)<1e-12,'solder exactly touches glass without penetration');
for(const cut of [false,true]){const g=createGlassGeometry(cut);g.computeBoundingBox();ok(Math.abs(g.boundingBox.min.y-contactPlanes.glassBottom)<1e-6,'actual bevel geometry bottom matches solder contact');ok(Math.abs(g.boundingBox.max.y-.88)<1e-6,'actual glass top below redistribution layer');for(const name of ['position','normal'])for(const v of g.attributes[name].array)ok(Number.isFinite(v),'geometry attributes finite');g.dispose();}
const capacitor=createCapacitorGeometries();capacitor.body.computeBoundingBox();capacitor.cap.computeBoundingBox();const body=capacitor.body.boundingBox,cap=capacitor.cap.boundingBox;
for(const axis of ['x','y']){ok(cap.min[axis]<body.min[axis]-.01,'metal cap envelops ceramic negative face');ok(cap.max[axis]>body.max[axis]+.01,'metal cap envelops ceramic positive face');}
ok(capacitor.offset+cap.min.z<body.max.z-.01,'cap overlaps shortened body at hidden join');ok(capacitor.offset+cap.max.z>body.max.z+.1,'exposed terminal face separated from ceramic end face');ok(capacitor.offset+cap.min.z>body.min.z,'cap leaves central ceramic exposed');capacitor.body.dispose();capacitor.cap.dispose();
const report={passed:true,checks,states,scope:'Deterministic state, transition continuity, assembly order, conductor route bounds, signal fade, copper-to-hole clearance, solder contacts, capacitor terminal clearances, actual beveled glass bounds and finite geometry attributes. Browser/WebGL visual review separate.',webglRenderReviewed:false,physicalSimulation:false};
fs.writeFileSync(new URL('../qa/glass-package-state.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
