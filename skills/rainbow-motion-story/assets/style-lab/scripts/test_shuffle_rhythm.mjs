import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {duration,modes,chapters,readHolds,cardIds,motionContacts,permutationStages,sample,draw,buildPlan,renderAudio,audioControlAt,readHoldGain} from '../lab/shuffle-rhythm.js';
let checks=0,stateSamples=0;
const check=(x,message)=>{assert.ok(x,message);checks++;};
const near=(a,b,eps,message)=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=eps,`${message}: ${a} vs ${b}`);
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const fingerprint=pcm=>crypto.createHash('sha256').update(Buffer.from(pcm.buffer,pcm.byteOffset,pcm.byteLength)).digest('hex');
const sorted=[...cardIds].sort(),bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
check(duration===18,'18 second finite sample');check(cardIds.length===52&&new Set(cardIds).size===52,'52 unique fixed IDs');
check(modes.length===3&&new Set(modes.map(m=>m.id)).size===3,'three sound arrangements');
check(chapters.every((c,i)=>c.time>=0&&c.time<18&&(i===0||c.time>chapters[i-1].time)),'chapters follow the actual timeline');
for(const permutation of permutationStages)equal([...permutation].sort(),sorted,'every staged permutation is a bijection');
for(let i=0;i<=720;i++){
    const s=sample(i/40);stateSamples++;
    equal(s.cards.map(c=>c.id),cardIds,'card IDs remain stable');equal([...s.permutation].sort(),sorted,'no dropped or duplicated card during handoff');
    check(new Set(s.cards.map(c=>c.rank)).size===52,'ranks remain a bijection');
    check(s.cards.every(c=>[...c.position,c.rotation,c.width,c.height,c.flip].every(Number.isFinite)),'finite card geometry');
    check(s.cards.every(c=>c.position[2]>=12-1e-9&&c.width>=137&&c.height>=194),'cards stay above support and retain size');
    for(const c of s.cards){
        const [x,y,z]=c.position,ex=(Math.abs(Math.cos(c.rotation))*c.width+Math.abs(Math.sin(c.rotation))*c.height)/2,ey=(Math.abs(Math.sin(c.rotation))*c.width+Math.abs(Math.cos(c.rotation))*c.height)/2;
        bounds.minX=Math.min(bounds.minX,x-ex);bounds.maxX=Math.max(bounds.maxX,x+ex);bounds.minY=Math.min(bounds.minY,y-z-ey);bounds.maxY=Math.max(bounds.maxY,y-z+ey);
    }
}
check(bounds.minX>=55&&bounds.maxX<=1545&&bounds.minY>=160&&bounds.maxY<=710,'whole card rectangles stay inside stage');
equal(sample(-100),sample(0),'negative seek clamps to start');equal(sample(100),sample(18),'end holds');
const seekTimes=[0,.3,1.6,3.7,6.7,7.4,9.8,11.7,14.3,16.7,18];
equal(seekTimes.toReversed().map(sample).toReversed(),seekTimes.map(sample),'arbitrary seek independent of frame history');
for(const [t,index] of [[0,0],[6.7,1],[12.3,2],[13.6,3],[14.9,4],[18,4]])equal(sample(t).permutation,permutationStages[index],'completed staged order');
check(permutationStages.every((p,i)=>i===0||p.some((id,k)=>id!==permutationStages[i-1][k])),'every completed shuffle actually changes order');
for(const hold of readHolds){
    const first=sample(hold.start);check(first.reading,'read window active');
    for(const t of [hold.start,(hold.start+hold.end)/2,hold.end]){const s=sample(t);equal(s.cards,first.cards,'cards genuinely hold for reading');equal(s.permutation,first.permutation,'order holds for reading');near(readHoldGain(t),0,0,'read gate exactly zero');}
}

// Contacts are arrival poses, rather than arbitrary audio timestamps.
check(new Set(motionContacts.map(e=>e.id)).size===motionContacts.length,'unique contact event IDs');
for(const e of motionContacts){
    check(e.time>=e.start&&e.time<18,'valid event interval');
    check(!readHolds.some(h=>e.time>=h.start&&e.time<=h.end),'no new motion contact in a read hold');
    if(e.cardId){
        const s=sample(e.time),c=s.cards.find(c=>c.id===e.cardId);equal(c.position,e.position,'contact position comes from exact motion sample');
        if(['card-seat','fan-seat','reorder-seat','final-seat'].includes(e.kind)){
            const after=sample(e.time+.00001).cards.find(c=>c.id===e.cardId);near(Math.hypot(...c.position.map((v,i)=>v-after.position[i])),0,1e-8,'card holds after contact');
        }
    }
}
// Sub-frame finite differences check gentle joins, not a promise of physical collision resolution.
let maxJoinSpeedChange=0;
for(const e of motionContacts.filter(e=>e.cardId&&['card-seat','reorder-seat'].includes(e.kind))){
    const h=1e-4,a=sample(e.time-h).cards.find(c=>c.id===e.cardId),b=sample(e.time).cards.find(c=>c.id===e.cardId),c=sample(e.time+h).cards.find(c=>c.id===e.cardId);
    const delta=Math.max(...a.position.map((v,i)=>Math.abs((b.position[i]-v)/h-(c.position[i]-b.position[i])/h)));maxJoinSpeedChange=Math.max(maxJoinSpeedChange,delta);
}
check(maxJoinSpeedChange<.05,'card arrival velocities settle continuously');

const audioReports=[];
for(const mode of modes){
    const plan=buildPlan(mode.id),byEvent=new Map(motionContacts.map(e=>[e.id,e]));
    check(plan.duration===duration,'sound and picture duration agree');
    for(const cue of plan.cues){
        const event=byEvent.get(cue.eventId);check(Boolean(event),'every cue belongs to a motion contact');
        near(cue.anchorTime,event.time,0,'cue anchor comes from motion');near(cue.start+cue.anchorOffset,cue.anchorTime,1e-12,'designed sync is exact');
        near(cue.end-cue.start,cue.duration,1e-12,'cue interval consistent');check(cue.start>=0&&cue.end<=18,'bounded sound');
        check(cue.panTrack.every(p=>Number.isFinite(p[0])&&p[1]>=-.85&&p[1]<=.85),'bounded spatial pan');
        for(const [t,pan] of [cue.panTrack[0],cue.panTrack.at(-1)]){
            const object=cue.cardId?sample(t).cards.find(c=>c.id===cue.cardId):null,expected=object?Math.max(-.85,Math.min(.85,(object.position[0]-800)/620)):0;
            near(pan,expected,1e-12,'sound pan follows actual card position');near(audioControlAt(cue,t).pan,pan,1e-12,'pan trace interpolation endpoints');
        }
    }
    const audio=renderAudio(mode.id,48000),again=renderAudio(mode.id,48000);
    check(audio.left instanceof Float32Array&&audio.right instanceof Float32Array,'Float32 stereo output');
    check(audio.left.length===18*48000&&audio.right.length===audio.left.length,'exact audio sample count');
    equal([fingerprint(audio.left),fingerprint(audio.right)],[fingerprint(again.left),fingerprint(again.right)],'seeded audio repeats bit-identically');
    check(audio.metrics.samplePeak<.5&&audio.metrics.clippedSamples===0,'conservative sample-peak headroom without limiter');
    check(Math.abs(audio.metrics.dcLeft)<.001&&Math.abs(audio.metrics.dcRight)<.001,'DC stays small');
    check(audio.metrics.monoRatio>.85,'no destructive stereo phase cancellation');
    const silence=readHolds.map(h=>{
        let peak=0;for(let i=Math.ceil(h.start*48000);i<Math.min(audio.left.length,Math.floor(h.end*48000));i++)peak=Math.max(peak,Math.abs(audio.left[i]),Math.abs(audio.right[i]));
        near(peak,0,0,'protected reading window is exactly silent');return {...h,peak};
    });
    near(audio.left[0],0,0,'zero leading edge');near(audio.right.at(-1),0,0,'zero trailing edge');
    audioReports.push({mode:mode.id,cues:plan.cues.length,contactCues:plan.cues.filter(c=>c.kind==='contact').length,frictionCues:plan.cues.filter(c=>c.kind==='friction').length,hash:fingerprint(audio.left),metrics:audio.metrics,silence});
}
const [restrained,dense,legato]=audioReports;
check(dense.contactCues===motionContacts.length,'dense triggers every motion contact');
check(dense.contactCues>restrained.contactCues*8,'arrangements have distinct cue density');
check(legato.contactCues<restrained.contactCues&&legato.frictionCues>0,'legato selects fewer contacts and continuous gestures');
check(new Set(audioReports.map(a=>a.hash)).size===3,'all three audio outputs differ');

// Every mode draws the same full card rectangles, not different comparison footage.
function recordedContext(){
    const calls=[],state={},stack=[];let gradients=0;
    const ctx=new Proxy(state,{get(o,k){
        if(k in o)return o[k];
        if(k==='save')return()=>{stack.push({...o});calls.push(['save']);};
        if(k==='restore')return()=>{Object.assign(o,stack.pop());calls.push(['restore']);};
        if(k==='createLinearGradient'||k==='createRadialGradient')return(...args)=>{const id=gradients++;calls.push([k,...args,id]);return {id,addColorStop:(...args)=>calls.push(['stop',id,...args])};};
        return(...args)=>{calls.push([k,...args]);};
    },set(o,k,value){o[k]=value;calls.push(['set',k,typeof value==='object'?value.id:value]);return true;}});
    return {ctx,calls};
}
for(const t of [0,3.7,9.8,11.7,16.7]){
    const streams=modes.map(mode=>{const r=recordedContext();equal(draw(r.ctx,t,1200,675,{mode:mode.id}),sample(t),'draw returns canonical sample');return r.calls;});
    equal(streams[0],streams[1],'dense sound leaves picture untouched');equal(streams[0],streams[2],'legato sound leaves picture untouched');
}
for(const action of [()=>sample(NaN),()=>buildPlan('wrong'),()=>renderAudio('dense',0),()=>draw(null,0,1600,900)]){assert.throws(action);checks++;}
console.log(JSON.stringify({passed:true,checks,stateSamples,contacts:motionContacts.length,bounds,maxJoinSpeedChange,audioReports,
    verified:['52 fixed identities and permutation bijections','Exact completed order at each stage','Settled contact poses','Arbitrary seek','Stage bounds','Shared cue/contact timing','Spatial panning','Read-hold silence','Seeded stereo synthesis','Peak/DC/mono checks','Identical visual comparison'],
    notVerified:['Human listening preference','True-peak and integrated loudness','Real paper collisions or friction','Original source audio or geometry reconstruction']},null,2));
