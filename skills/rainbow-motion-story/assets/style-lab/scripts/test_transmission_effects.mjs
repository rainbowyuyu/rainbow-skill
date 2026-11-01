import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {candidates,trackingCandidate,windowRelayCandidate,sampleExposureTimes,sampleTracking,drawTracking,sampleWindowRelay,drawWindowRelay,PACKET_EVENTS,TRACKING_MOVES,trackingOptions} from '../lab/modules/transmission-effects.js';
let checks=0,states=0,draws=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const near=(a,b,e=1e-8,label='near')=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=e,`${label}: ${a} != ${b}`);

// Exact exposure duration, normalized quadrature and legal edge clipping.
for(const fps of [30,60])for(const angle of [0,90,180,360])for(const samples of [4,16,64])for(const time of [0,.001,3.78,17.999,18]){
    const e=sampleExposureTimes(time,{fps,shutterAngle:angle,samples}),span=angle/360/fps,start=Math.max(0,time-span/2),end=Math.min(18,time+span/2);
    near(e.reduce((sum,p)=>sum+p.weight,0),1,1e-14,'normalized exposure weights');
    check(e.length===(angle===0?1:samples),'zero shutter uses exactly one current state');
    near(e.reduce((sum,p)=>sum+p.weight*p.time,0),(start+end)/2,1e-12,'exposure centroid matches clipped interval');
    for(let i=0;i<e.length;i++)check(e[i].time>=start&&e[i].time<=end&&e[i].weight>0&&(i===0||e[i].time>=e[i-1].time),'ordered samples within timeline');
}
near(sampleTracking(3.78,{fps:30,shutterAngle:180}).shutterSeconds,1/60,1e-15,'180 degree at 30 fps gives 1/60 s');
near(sampleTracking(3.78,{fps:60,shutterAngle:180}).shutterSeconds,1/120,1e-15,'180 degree at 60 fps gives 1/120 s');
equal(trackingOptions({fps:99,shutterAngle:700,samples:100,cameraMode:'wrong',blurMode:'wrong'}).fps,30,'unsupported fps falls back');
check(trackingOptions({shutterAngle:-1,samples:1}).shutterAngle===0&&trackingOptions({samples:1}).samples===4&&trackingOptions({samples:100}).samples===64,'controls normalize their physical domains');

// Independent analytic integral of quintic trajectory checks convergence of actual subframe states.
const move=TRACKING_MOVES[1],time=3.78,span=1/30;
const primitive=q=>q**6-3*q**5+2.5*q**4;
const q0=(time-span/2-move.start)/(move.end-move.start),q1=(time+span/2-move.start)/(move.end-move.start);
const exact=move.from+(move.to-move.from)*(primitive(q1)-primitive(q0))/(q1-q0);
const average=s=>s.exposure.reduce((sum,e,i)=>sum+e.weight*s.sampleStates[i].world.leadX,0);
const low=sampleTracking(time,{samples:4,shutterAngle:360}),high=sampleTracking(time,{samples:64,shutterAngle:360});
check(Math.abs(average(high)-exact)<Math.abs(average(low)-exact),'more temporal samples converge toward analytic exposure integral');
near(average(high),exact,1e-7,'64 samples approximate analytic exposure');

for(const c of candidates){
    check(!c.loop&&c.stageTimes.length===c.stages.length,'nonloop candidate has aligned navigation labels');
    check(c.previewTime>0&&c.previewTime<c.duration,'preview is within duration');
    equal(c.sample(-2),c.sample(0),'negative time clamps');equal(c.sample(NaN),c.sample(0),'invalid time clamps');equal(c.sample(999),c.sample(c.duration),'terminal time holds');
    const ts=[c.duration,2.3,0,8.4,3.78];equal(ts.map(t=>c.sample(t)),ts.toReversed().map(t=>c.sample(t)).toReversed(),'arbitrary seek is history independent');
    c.stageTimes.forEach((t,i)=>check(c.sample(t).stageIndex===i&&typeof c.stages[i]==='string','exact stage boundary has its label'));
}

for(let frame=0;frame<=18*60;frame++)for(const cameraMode of ['fixed','follow']){
    const time=frame/60,s=sampleTracking(time,{cameraMode,samples:4});states++;
    check(s.packets.length===5&&new Set(s.packets.map(p=>p.id)).size===5,'fixed packet identities');
    check(s.packets.every(p=>p.position.every(Number.isFinite)),'finite projected positions');
    for(const e of s.sampleStates){
        near(e.camera.x,cameraMode==='follow'?e.world.leadX:0,0,'camera recomputed at every exposure sample');
        near(e.camera.velocity,cameraMode==='follow'?e.world.leadVelocity:0,0,'camera derivative matches its own sample');
        for(const packet of e.packets){
            near(packet.position[0],700+(packet.world[0]-e.camera.x)*89,1e-10,'projection uses object and camera of the same sample');
            near(packet.screenVelocity[0],89*(packet.worldVelocity[0]-e.camera.velocity),1e-10,'screen velocity is relative velocity');
        }
    }
    if(cameraMode==='follow'){near(s.screenVelocity[0],0,0,'tracked subject has zero screen velocity');near(s.packets[2].position[0],700,0,'tracked subject retains screen anchor');}
    if(s.readHold)check(s.sampleStates.every(e=>e.world.leadVelocity===0),'read hold excludes any exposure motion');
}
const fixed=sampleTracking(3.78,{cameraMode:'fixed',shutterAngle:360}),follow=sampleTracking(3.78,{cameraMode:'follow',shutterAngle:360});
check(Math.abs(fixed.screenVelocity[0])>1000,'test includes visibly fast motion');
check(Math.abs(follow.backgroundScreenVelocity)>1000&&follow.screenVelocity[0]===0,'following camera transfers screen motion to background');
equal(fixed.sampleStates.map(s=>s.packets.map(p=>p.world)),follow.sampleStates.map(s=>s.packets.map(p=>p.world)),'camera comparison uses exactly the same world motion');
for(const t of TRACKING_MOVES.flatMap(m=>[m.start,m.end])){
    const h=1e-5,a=sampleTracking(t-h),b=sampleTracking(t),c=sampleTracking(t+h);
    near((b.world.leadX-a.world.leadX)/h,(c.world.leadX-b.world.leadX)/h,.005,'trajectory velocity joins continuously');
}
for(const t of [2,3.7,5.5,9.6,14]){
    const h=1e-5,s=sampleTracking(t),a=sampleTracking(t-h),b=sampleTracking(t+h);
    near((b.world.leadX-a.world.leadX)/(2*h),s.world.leadVelocity,1e-6,'velocity agrees with finite difference of trajectory');
}

// One immutable event table owns all six packet states and logical window movement.
for(const event of PACKET_EVENTS){
    check(event.sentAt<event.receivedAt&&event.receivedAt<event.ackDepartAt&&event.ackDepartAt<event.ackArrivedAt,'causal event ordering');
    check(event.byteEnd-event.byteStart===100,'each fixed identity covers 100 bytes');
    const send=sampleWindowRelay(event.sentAt),before=sampleWindowRelay(event.ackArrivedAt-1e-7),after=sampleWindowRelay(event.ackArrivedAt);
    check(send.packets[event.index].eligible,'each packet is sent only after becoming eligible');
    check(before.packets[event.index].state!=='acknowledged'&&after.packets[event.index].state==='acknowledged','confirmation is never early');
    near(after.window.visualStart,before.window.visualStart,1e-6,'ack arrival does not teleport frame');
    if(event.index>=3)check(event.sentAt>=PACKET_EVENTS[event.index-3].ackArrivedAt+.55,'next packet waits until its newly freed visual slot is exposed');
}
for(let frame=0;frame<=20*60;frame++){
    const time=frame/60,s=sampleWindowRelay(time);states++;
    const sent=PACKET_EVENTS.filter(e=>time>=e.sentAt).length,received=PACKET_EVENTS.filter(e=>time>=e.receivedAt).length,confirmed=PACKET_EVENTS.filter(e=>time>=e.ackArrivedAt).length;
    check(s.sentCount===sent&&s.receivedCount===received&&s.confirmedCount===confirmed,'three counts come from exact events');
    check(confirmed<=received&&received<=sent&&sent-confirmed<=3,'ack causal order and at-most-three outstanding packets');
    check(s.window.byteStart===confirmed*100&&s.window.byteEnd===Math.min(600,confirmed*100+300),'logical window from confirmation frontier');
    check(s.window.visualStart<=confirmed+1e-9,'presentation window cannot lead confirmed data');
    check(s.window.visualEnd>=s.window.visualStart&&s.window.visualEnd<=6,'window stays within finite sequence range');
    equal(s.packets.map(p=>p.id),PACKET_EVENTS.map(e=>e.id),'IDs stable across zoom and relay');
    for(let i=1;i<s.ticks.length;i++){near(s.ticks[i].byte-s.ticks[i-1].byte,100,0,'byte ruler units preserved');near(s.ticks[i].x-s.ticks[i-1].x,155*s.camera.zoom,1e-9,'zoom transforms ruler and packets together');}
    for(const packet of s.packets){near(packet.slot[0],(s.ticks[packet.index].x+s.ticks[packet.index+1].x)/2,1e-9,'ledger stays anchored to byte interval');check(packet.slot[0]-54>=100&&packet.slot[0]+54<=1500,'zoom never clips packet identity ledger');}
}
for(const t of [0,1,3.2,4.2])near(sampleWindowRelay(t).window.visualStart,0,0,'sending/establishing alone does not slide the window');
for(const t of [4.7,6.5,8.79])near(sampleWindowRelay(t).window.visualStart,0,0,'packets arriving at receiver do not yet move sender window');
const final=sampleWindowRelay(20);check(final.sentCount===6&&final.receivedCount===6&&final.confirmedCount===6&&final.window.byteStart===600,'all records agree at end');
for(const t of [17.2,18,19.9]){const s=sampleWindowRelay(t);check(s.readHold,'terminal reading window');equal(s.camera,final.camera,'camera stable for terminal reading');equal(s.packets,final.packets,'packet records stable for terminal reading');}

// Simulated Canvas records the actual compositing call stream, including offscreen layers.
// It checks arithmetic and determinism, not raster appearance.
let trace=[],canvasId=0;
function makeContext(label){
    const state={globalAlpha:1,globalCompositeOperation:'source-over',filter:'none'},stack=[];
    return new Proxy(state,{get(o,k){if(k in o)return o[k];
        if(k==='save')return()=>{stack.push({...o});trace.push([label,'save']);};
        if(k==='restore')return()=>{Object.assign(o,stack.pop());trace.push([label,'restore']);};
        if(k==='createLinearGradient'||k==='createRadialGradient')return(...args)=>{trace.push([label,k,...args]);return {gradient:true,addColorStop:(...args)=>trace.push([label,'colorStop',...args])};};
        if(k==='drawImage')return(canvas,...args)=>trace.push([label,'drawImage',canvas.id,...args,o.globalAlpha,o.globalCompositeOperation,o.filter]);
        return(...args)=>{check(args.filter(v=>typeof v==='number').every(Number.isFinite),'finite Canvas numeric arguments');trace.push([label,k,...args]);};
    },set(o,k,v){if(typeof v==='number')check(Number.isFinite(v),'finite Canvas property');o[k]=v;trace.push([label,'set',k,v&&typeof v==='object'?'gradient':v]);return true;}});
}
globalThis.OffscreenCanvas=class{constructor(width,height){this.width=width;this.height=height;this.id=`offscreen-${++canvasId}`;this.ctx=makeContext(this.id);}getContext(){return this.ctx;}};
const normalize=stream=>{const map=new Map();return stream.map(call=>call.map(value=>typeof value==='string'&&value.startsWith('offscreen-')?(map.has(value)?map.get(value):(map.set(value,`layer-${map.size+1}`),map.get(value))):value));};
for(const cameraMode of ['fixed','follow'])for(const blurMode of ['none','temporal','spatial'])for(const time of [0,3.78,18]){
    const ctx=makeContext('main'),o={cameraMode,blurMode,samples:4};trace=[];drawTracking(ctx,time,1600,900,o);const first=normalize(trace);
    trace=[];drawTracking(ctx,8.31,1600,900,o);trace=[];drawTracking(ctx,time,1600,900,o);equal(normalize(trace),first,'draw does not retain old displayed frame');draws++;
    const mainImage=trace.findIndex(call=>call[0]==='main'&&call[1]==='drawImage');
    check(mainImage>=0,'scene composite reaches main canvas');
    const hud=trace.filter((call,i)=>i>mainImage&&call[0]==='main'&&call[1]==='fillText');check(hud.some(call=>String(call[2]).endsWith(' s')),'time HUD drawn after composited scene');
    if(blurMode==='temporal'){
        const additions=trace.filter(call=>call[0]!=='main'&&call[1]==='drawImage');check(additions.length===4,'all temporal sample states actually composited');
        additions.forEach((call,i)=>near(call.at(-3),1/(i+1),1e-15,'running mean has normalized new-sample alpha'));
        const effective=additions.map((call,i)=>call.at(-3)*additions.slice(i+1).reduce((weight,next)=>weight*(1-next.at(-3)),1));
        effective.forEach(weight=>near(weight,.25,1e-14,'each actual subframe has equal final weight'));
        check(!trace.some(call=>call[1]==='set'&&call[2]==='filter'&&String(call[3]).startsWith('blur')),'temporal mode never substitutes blur filter');
    }
}
for(const palette of ['titanium','porcelain'])for(const time of [0,3.2,9.55,14.7,20]){
    trace=[];drawWindowRelay(makeContext('main'),time,1600,900,{palette});const a=trace;trace=[];drawWindowRelay(makeContext('main'),time,1600,900,{palette});equal(trace,a,'relay repeat draw deterministic');draws++;
}
delete globalThis.OffscreenCanvas;
const report={passed:true,checks,states,draws,verified:['Clipped normalized midpoint exposure','Analytic integral convergence','Each subframe has its own camera and objects','Screen-relative velocity','Running-mean compositing weights','No old-frame accumulation','HUD after compositing','Causal packet/ACK event ledger','At most three outstanding packets','Window never leads ACK','Ruler and packet transform correspondence','Stable reading windows','Arbitrary seek and deterministic draw'],notVerified:['Browser raster appearance','Linear-light HDR accumulation','Physical camera optics','Complete TCP implementation','Source video rendering algorithm']};
writeFileSync(fileURLToPath(new URL('../qa/transmission-effects.json',import.meta.url)),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
