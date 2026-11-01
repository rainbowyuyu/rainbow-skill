import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {candidates,stories,CUES,SOURCES,DURATION,GEOMETRY,TOPOLOGY,BUILD_ORDER,BUILD_SCHEDULE,
  sampleMofs,apertureClearance,stopHeight,makeProjector} from '../lab/modules/mofs-explanation.js';

let checks=0,samples=0,draws=0,collisionComparisons=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const near=(a,b,e=1e-9,label='near')=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=e,`${label}: ${a} != ${b}`);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const finite=o=>{if(typeof o==='number')check(Number.isFinite(o),'finite sample number');else if(o&&typeof o==='object')Object.values(o).forEach(finite);};
const nodeById=Object.fromEntries(TOPOLOGY.nodes.map(n=>[n.id,n]));
function pointSegmentDistance(point,a,b){const ab=sub(b,a),ap=sub(point,a),u=Math.max(0,Math.min(1,dot(ap,ab)/dot(ab,ab)));return distance(point,a.map((v,i)=>v+ab[i]*u));}
const geometry=s=>({camera:s.camera,frameworks:s.frameworks,guests:s.guests,scene:s.scene});
const inverseEase=value=>{let low=0,high=1;for(let k=0;k<60;k++){const q=(low+high)/2,p=q*q*q*(q*(q*6-15)+10);if(p<value)low=q;else high=q;}return(low+high)/2;};
function collisions(s){
  for(const guest of s.guests){if(guest.alpha<.001)continue;
    for(const node of s.frameworks[0].nodes){if(node.alpha<.999)continue;const d=distance(guest.position,node.position);check(d+1e-8>=guest.radius+GEOMETRY.nodeRadius,`${s.variant} ${s.time} ${guest.id} intersects ${node.id}: ${d}`);collisionComparisons++;}
    for(const edge of s.frameworks[0].edges){if(edge.progress<.999)continue;const d=pointSegmentDistance(guest.position,edge.fromPosition,edge.toPosition);check(d+1e-8>=guest.radius+GEOMETRY.linkerRadius,`${s.variant} ${s.time} ${guest.id} intersects ${edge.id}: ${d}`);collisionComparisons++;}
  }
  if(s.guests.every(g=>g.alpha>.999)){check(distance(...s.guests.map(g=>g.position))>=s.guests.reduce((a,g)=>a+g.radius,0),'guests do not intersect each other');collisionComparisons++;}
}

check(DURATION===38&&candidates.length===3,'three finite original explanation routes');
equal(candidates.map(c=>c.id),['story-mofs-result','story-mofs-build','story-mofs-predict'],'stable public identities');
check(TOPOLOGY.nodes.length===24&&TOPOLOGY.edges.length===40,'declared cage topology');
check(new Set(TOPOLOGY.nodes.map(n=>n.id)).size===24&&new Set(TOPOLOGY.edges.map(e=>e.id)).size===40,'all topology IDs unique');
const connected=new Set([BUILD_ORDER.root]);for(let pass=0;pass<24;pass++)for(const edge of TOPOLOGY.edges){if(connected.has(edge.from))connected.add(edge.to);if(connected.has(edge.to))connected.add(edge.from);}
check(connected.size===24,'single connected framework');
for(const edge of TOPOLOGY.edges)check(distance(nodeById[edge.from].position,nodeById[edge.to].position)>.1,'no degenerate link');
for(const schedule of BUILD_SCHEDULE){
  const before=sampleMofs(schedule.start,'build').frameworks[0];
  near(before.nodes.find(n=>n.id===schedule.startNode).alpha,1,1e-9,'growth begins at established node');
  near(before.edges.find(e=>e.id===schedule.id).progress,0,1e-9,'edge starts at source node');
  near(sampleMofs(schedule.end,'build').frameworks[0].edges.find(e=>e.id===schedule.id).progress,1,1e-9,'scheduled edge settles completely');
}
near(Math.max(...BUILD_SCHEDULE.map(e=>e.end)),9.705,1e-9,'explicit build-completion time');
check(sampleMofs(9.705,'build').guests.every(g=>g.alpha===0),'guests are not introduced before completed framework');
check(sampleMofs(10.2,'build').guests.every(g=>g.alpha>0),'guests become visible after topology settles');
near(apertureClearance(),.545,1e-9,'independent node-limited aperture');
check(GEOMETRY.smallGuestRadius<apertureClearance()&&GEOMETRY.largeGuestRadius>apertureClearance(),'actual sizes straddle actual opening');
check(stopHeight(.63)>GEOMETRY.levels[2]+.3,'large sphere is stopped above aperture plane');
const contact=[0,stopHeight(.63),0];
const nearestSolid=Math.min(...TOPOLOGY.nodes.map(n=>distance(contact,n.position)-GEOMETRY.nodeRadius),...TOPOLOGY.edges.map(e=>pointSegmentDistance(contact,nodeById[e.from].position,nodeById[e.to].position)-GEOMETRY.linkerRadius));
check(nearestSolid>.63&&nearestSolid<.66,'stop height leaves only the explicit small contact margin');

const plannedRates=[];
for(const story of stories){
  check(story.timingBasis==='planned'&&story.physicalSimulation===false&&story.adsorptionComputed===false,'science and timing status explicit');
  near(story.cues[0].start,0);near(story.cues.at(-1).end,DURATION);
  check(new Set(story.cues.map(c=>c.id)).size===story.cues.length,'unique cue IDs');
  for(const [index,cue] of story.cues.entries()){
    check(cue.start<cue.end&&cue.end<=DURATION,'positive bounded cue duration');
    if(index)near(cue.start,story.cues[index-1].end,1e-9,'gapless non-overlapping cues');
    check(cue.screenText.length<=24&&cue.question&&cue.visibleEvidence&&cue.sceneEvent,'short title and usable action contract');
    check(cue.sourceIds.length>0&&cue.sourceIds.every(id=>id in SOURCES),'all claims resolve to declared sources');
    if(cue.narration){const rate=[...cue.narration.replace(/[\p{P}\p{Z}\s]/gu,'')].length/(cue.end-cue.start);plannedRates.push({cueId:cue.id,charactersPerSecond:Number(rate.toFixed(2))});check(rate<=6.6,'planned narration fits conversational pace estimate');}
    else check(cue.kind==='read-hold','silence has an observation purpose');
    if(cue.resultOf)check(cue.start>=story.cues.find(c=>c.sceneEvent===cue.resultOf).end,'result title starts after associated action');
  }
}

for(const candidate of candidates){
  check(!candidate.loop&&candidate.module==='storytelling'&&candidate.story.cues===candidate.cues,'candidate contract includes editable story');
  equal(candidate.stageTimes,candidate.cues.map(c=>c.start),'chapter navigation is cue-driven');
  equal(candidate.sample(-2),candidate.sample(0),'negative input clamps');equal(candidate.sample(NaN),candidate.sample(0),'invalid input clamps');equal(candidate.sample(100),candidate.sample(38),'finite ending clamps');
  const order=[35.2,0,9.705,6.123,27.4,12,38];equal(order.map(t=>candidate.sample(t)),order.toReversed().map(t=>candidate.sample(t)).toReversed(),'arbitrary seek is history independent');
  for(const cue of candidate.cues){check(candidate.sample(cue.start).activeCue.id===cue.id,'exact cue boundary selects next intended cue');if(cue.start>0)check(candidate.sample(cue.start-1e-6).activeCue.id!==cue.id,'prior cue remains before boundary');}
  for(let frame=0;frame<=38*60;frame++){
    const s=candidate.sample(frame/60);samples++;finite(s);collisions(s);
    equal(s.frameworks[0].nodes.map(n=>n.id),TOPOLOGY.nodes.map(n=>n.id),'node identities remain fixed');
    equal(s.frameworks[0].edges.map(e=>e.id),BUILD_ORDER.edges.map(e=>e.id),'edge identities remain fixed');
    check(s.guests[0].passes&&!s.guests[1].passes,'geometry gives stable passing verdict');
    check(!s.adsorptionComputed&&!s.physicalSimulation&&s.guests.every(g=>!g.adsorptionComputed),'no physics or adsorption simulation claimed');
    if(s.scene.smallResultAlpha>1e-8)near(s.guests[0].progress,1,1e-9,'small result follows completed motion');
    if(s.scene.largeResultAlpha>1e-8)near(s.guests[1].progress,1,1e-9,'large result follows completed motion');
    if(s.variant==='predict'&&s.time<20.5)check(s.scene.smallResultAlpha===0&&s.scene.largeResultAlpha===0&&s.guests.every(g=>g.progress===0),'prediction does not reveal result early');
    const project=makeProjector(s.camera);
    for(const object of [...s.frameworks[0].nodes.map(n=>({...n,radius:GEOMETRY.nodeRadius})),...s.guests]){
      if(object.alpha<.001)continue;const p=project(object.position),r=object.radius*p.scale;
      check(p.visible&&p.x-r>260&&p.x+r<1350&&p.y-r>180&&p.y+r<740,`${s.variant} ${s.time} ${object.id} geometry stays in reserved stage: ${JSON.stringify({p,r})}`);
    }
    if(s.time>=12)equal(geometry(s),geometry(sampleMofs(s.time,'predict')),'all routes share exactly the same core demonstration');
    if(s.time>=35.2){check(s.readHold&&s.geometryStable,'ending is an explicit read hold');equal(geometry(s),geometry(candidate.sample(38)),'final scene and camera genuinely stop');}
  }
  // C2 easing on the camera and objects includes reverse-playback and shared handoff.
  const pathPhases=[.24,.58].flatMap(p=>[20.5+3.5*inverseEase(p),24.5+2.9*inverseEase(p)]);
  const reversePhases=[.24,.58].flatMap(p=>[.15+2.25*inverseEase(p),2.55+1.85*inverseEase(p)]).map(replayTime=>6.5+4.2*inverseEase(1-replayTime/4.8));
  const joins=[0,.2,3.5,4.8,6.5,8.5,10.7,11.5,12,16.1,19.2,20.5,24,24.5,27.4,28,28.1,28.4,32.2,33.4,35.2,38,...pathPhases,...reversePhases];
  for(const t of joins){const h=1e-4,a=candidate.sample(t-h),b=candidate.sample(t),c=candidate.sample(t+h);for(const field of ['position','target'])for(let i=0;i<3;i++)near((b.camera[field][i]-a.camera[field][i])/h,(c.camera[field][i]-b.camera[field][i])/h,.01,'camera velocity join');
    for(let j=0;j<2;j++)for(let i=0;i<3;i++)near((b.guests[j].position[i]-a.guests[j].position[i])/h,(c.guests[j].position[i]-b.guests[j].position[i])/h,.01,'guest path velocity join');
  }
  for(const t of [24.31,24.4,27.71,27.9,35.3,37.9]){const a=candidate.sample(t),b=candidate.sample(t+.01);check(a.activeCue.kind==='read-hold'&&a.geometryStable&&a.readHold,'actual read hold agrees with cue and motion');equal(geometry(a),geometry(b),'read hold actually has constant scene state');}
  for(const t of [24.1,27.5])check(!candidate.sample(t).readHold,'label fade does not claim a settled reading window');
}

function recorder(){const calls=[],stack=[],labels=[],state={globalAlpha:1};let gid=0;const ctx=new Proxy(state,{get(target,key){if(key in target)return target[key];if(key==='save')return()=>{stack.push({...target});calls.push(['save']);};if(key==='restore')return()=>{check(stack.length>0,'Canvas restore has matching save');const saved=stack.pop();for(const k of Object.keys(target))delete target[k];Object.assign(target,saved);calls.push(['restore']);};if(key==='createLinearGradient'||key==='createRadialGradient')return(...args)=>{check(args.every(Number.isFinite),'finite gradient');const id=gid++;calls.push([key,id,...args]);return{id,addColorStop:(...v)=>calls.push(['stop',id,...v])};};return(...args)=>{check(args.filter(v=>typeof v==='number').every(Number.isFinite),'finite Canvas method');if(key==='fillText')labels.push({text:args[0],x:args[1],y:args[2],font:target.font,align:target.textAlign,alpha:target.globalAlpha});calls.push([key,...args]);};},set(target,key,value){if(typeof value==='number')check(Number.isFinite(value),'finite Canvas property');target[key]=value;calls.push(['set',key,value&&typeof value==='object'?value.id:value]);return true;}});return{ctx,calls,stack,labels};}
for(const c of candidates){for(const time of [0,4.8,7.2,9.705,12,17.4,21.8,24.3,27.8,31.4,35.2,38]){const a=recorder(),b=recorder();c.draw(a.ctx,time,1600,900,{});c.draw(b.ctx,time,1600,900,{});equal(a.calls,b.calls,'deterministic actual draw stream');check(a.stack.length===0&&b.stack.length===0,'draw restores all Canvas state');draws++;}const a=recorder(),b=recorder();c.draw(a.ctx,35.2,1600,900,{});c.draw(b.ctx,38,1600,900,{});equal(a.calls,b.calls,'last reading window has identical rendered commands');}
// Conservative CJK label rectangles read from actual fillText calls; raster/font QA remains separate.
for(const c of candidates)for(const time of [24.4,27.8,35.2,38]){
  const s=c.sample(time),project=makeProjector(s.camera),record=recorder();c.draw(record.ctx,time,1600,900,{});
  const spheres=[...s.frameworks[0].nodes.map(n=>({...n,radius:GEOMETRY.nodeRadius})),...s.guests];
  const links=s.frameworks[0].edges.flatMap(e=>Array.from({length:21},(_,i)=>({position:e.fromPosition.map((v,k)=>v+(e.toPosition[k]-v)*i/20),radius:GEOMETRY.linkerRadius})));
  const labelNames=['通过','被挡住','孔口 · 能否进入','内表面 · 能否停留'];
  for(const label of record.labels.filter(l=>labelNames.includes(l.text)&&l.alpha>.99)){
    const size=Number(/(\d+)px/.exec(label.font)[1]),width=[...label.text].length*size,left=label.align==='right'?label.x-width:label.x,right=left+width,top=label.y-size*.6,bottom=label.y+size*.6;
    check(left>84&&right<1512&&top>160&&bottom<780,'result label respects reserved frame');
    for(const part of [...spheres,...links]){const p=project(part.position),r=part.radius*p.scale;check(p.x+r<left||p.x-r>right||p.y+r<top||p.y-r>bottom,`${c.id} ${time} label ${label.text} is outside projected geometry`);}
  }
}

const report={passed:true,checks,samples,draws,collisionComparisons,plannedRates,
  verified:['Finite original 38-second stories with gapless cue coverage','Sources resolved for every cue','Independent sphere/node and sphere/link collision distances','Aperture verdict and contact height','Connected persistent topology with source-before-growth','Same physical demonstration after 12 seconds','Result labels after action completion','Shared camera and object C1 joins','Absolute-time arbitrary seeking','Safe model bounds','Static final reading window','Deterministic finite actual Canvas draw commands'],
  notVerified:['Actual MOF crystal topology','Molecular adsorption or selectivity simulation','Chemical kinetics','Browser raster and typography appearance','Exact per-pixel depth ordering','Narrated audio or TTS timing','Subjective audio listening']};
writeFileSync(fileURLToPath(new URL('../qa/mofs-explanation.json',import.meta.url)),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
