import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {candidates,motionfaceConceptDefaults,MOTIONFACE_CONCEPT_DURATION,
    sampleConceptBridge,drawConceptBridge,normalizeConceptBridgeOptions,layoutConceptCopy}
    from '../lab/modules/motionface-concepts.js';

// Numerical and recorded-command checks only. Actual browser raster, fonts,
// motion continuity and subjective source comparison are separate reviews.
const checks=[],failures=[],metrics={stateSamples:0,finiteNumbers:0,drawingSamples:0,drawCommands:0,maxSingleFrameTravel:0};
const check=(name,fn)=>{try{fn();checks.push({name,passed:true});}catch(e){failures.push({name,message:e.message});checks.push({name,passed:false,message:e.message});}};
function finite(v,path='state'){
    if(typeof v==='number'){assert.ok(Number.isFinite(v),path+' is not finite');metrics.finiteNumbers++;}
    else if(v&&typeof v==='object')for(const [k,x]of Object.entries(v))finite(x,path+'.'+k);
}
function visualState(s){const v=structuredClone(s);delete v.time;delete v.phaseTime;return v;}
const near=(a,b,epsilon=1e-9)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
function recorder(){
    const commands=[],texts=[],stack=[];
    const state={globalAlpha:1,globalCompositeOperation:'source-over',filter:'none',font:'10px sans-serif',fillStyle:'#000',strokeStyle:'#000',lineWidth:1,lineCap:'butt',lineJoin:'miter',textAlign:'start',textBaseline:'alphabetic'};
    const initial={...state},funcs={};
    const record=(n,a)=>{for(const v of a)if(typeof v==='number')assert.ok(Number.isFinite(v),n+' nonfinite');commands.push([n,a]);};
    for(const n of ['setTransform','fillRect','beginPath','closePath','moveTo','lineTo','stroke','fill','clip','translate','rotate','scale','arc','ellipse'])funcs[n]=(...a)=>{if(n==='arc')assert.ok(a[2]>=0);if(n==='ellipse')assert.ok(a[2]>=0&&a[3]>=0);record(n,a);};
    funcs.save=()=>{stack.push({...state});record('save',[]);};
    funcs.restore=()=>{assert.ok(stack.length,'unbalanced restore');Object.assign(state,stack.pop());record('restore',[]);};
    funcs.createRadialGradient=(...a)=>{record('createRadialGradient',a);const id=commands.length;return {kind:'gradient',id,addColorStop:(...v)=>record('addColorStop',[id,...v])};};
    funcs.measureText=value=>{const size=Number(/([\d.]+)px/.exec(state.font)?.[1]||10);return {width:Array.from(String(value)).reduce((n,c)=>n+(c===' '?.3:/[\u0000-\u00ff]/.test(c)?.57:1),0)*size};};
    funcs.fillText=(value,x,y)=>{const size=Number(/([\d.]+)px/.exec(state.font)?.[1]||10);texts.push({text:String(value),x,y,size,alpha:state.globalAlpha,width:funcs.measureText(value).width,align:state.textAlign});record('fillText',[value,x,y,state.font]);};
    const ctx=new Proxy(state,{get:(o,k)=>k in funcs?funcs[k]:o[k],set:(o,k,v)=>{if(typeof v==='number')assert.ok(Number.isFinite(v));if(k==='globalAlpha')assert.ok(v>=0&&v<=1);o[k]=v;record(String(k),[v]);return true;}});
    return {ctx,finish(){assert.equal(stack.length,0);assert.deepEqual(state,initial,'Canvas style leak');metrics.drawingSamples++;metrics.drawCommands+=commands.length;return {hash:createHash('sha256').update(JSON.stringify(commands)).digest('hex'),commands:commands.length,texts};}};
}

check('one finite candidate uses its own copy, real module and standard metadata',()=>{
    assert.equal(candidates.length,1);const c=candidates[0];assert.equal(c.id,'mf-concept-bridge');
    assert.equal(c.duration,14);assert.equal(c.loop,false);assert.equal(c.module,'visualization');
    assert.equal(c.codeFile,'./modules/motionface-concepts.js');assert.equal(c.stages.length,c.stageTimes.length);
    assert.deepEqual(Object.keys(motionfaceConceptDefaults),[c.id]);assert.equal(c.sample(0).copy.headline,motionfaceConceptDefaults[c.id].headline);
    c.stageTimes.forEach((v,i)=>assert.ok(v>=0&&v<14&&(!i||v>c.stageTimes[i-1])));
});
check('normalization never borrows another candidate title and clamps all controls',()=>{
    const d=motionfaceConceptDefaults['mf-concept-bridge'];
    const s=normalizeConceptBridgeOptions({headline:' ',kicker:'\u0000',result:'  ',tempo:Infinity,intensity:NaN});
    assert.equal(s.headline,d.headline);assert.equal(s.kicker,d.kicker);assert.equal(s.result,d.result);
    assert.equal(s.tempo,1);assert.equal(s.intensity,.65);
    assert.equal(normalizeConceptBridgeOptions({headline:'a'.repeat(200)}).headline.length,180);
    for(const [old,p]of Object.entries({titanium:'lime',ember:'coral',porcelain:'paper'}))assert.equal(normalizeConceptBridgeOptions({palette:old}).palette,p);
});
check('all parameter combinations remain finite and deterministic under arbitrary seek',()=>{
    for(const mfPalette of ['paper','lime','coral'])for(const intensity of [0,.65,1])for(const tempo of [.75,1,1.35])for(const reducedMotion of [false,true]){
        const o={mfPalette,intensity,tempo,reducedMotion};
        for(let f=0;f<=420;f++){finite(sampleConceptBridge(f/30,o));metrics.stateSamples++;}
        const before=structuredClone(sampleConceptBridge(6.2,o));[14,0,-2,8,3].forEach(t=>sampleConceptBridge(t,o));
        assert.deepEqual(sampleConceptBridge(6.2,o),before);assert.deepEqual(sampleConceptBridge(-1,o),sampleConceptBridge(0,o));assert.deepEqual(sampleConceptBridge(99,o),sampleConceptBridge(14,o));
        for(const t of [NaN,Infinity,-Infinity])finite(sampleConceptBridge(t,o));
    }
});
check('one stable entity and one measurement explain every stage without changing data',()=>{
    for(const tempo of [.75,1,1.35])for(let f=0;f<=840;f++){
        const s=sampleConceptBridge(f/60,{tempo}),m=s.measurement,e=s.entity;
        assert.equal(e.id,'observation-entity');assert.equal(e.opacity,1);assert.equal(m.id,'observation-72');
        assert.equal(m.current,72);assert.equal(m.target,100);assert.equal(m.error,28);near(m.error,m.target-m.current);
        near((m.targetX-m.currentX)/s.rail.width,m.error/m.target);near(m.gapMidX,(m.targetX+m.currentX)/2);
        assert.ok(e.x-e.radius>=80&&e.x+e.radius<=1520);assert.ok(e.y-e.radius>=280&&e.y+e.radius<=700);
    }
});
check('object and labels move continuously and labels keep their offsets',()=>{
    for(const tempo of [.75,1,1.35]){
        let prior=sampleConceptBridge(0,{tempo});
        for(let f=1;f<=840;f++){
            const s=sampleConceptBridge(f/60,{tempo}),e=s.entity;
            const travel=Math.hypot(e.x-prior.entity.x,e.y-prior.entity.y);metrics.maxSingleFrameTravel=Math.max(metrics.maxSingleFrameTravel,travel);assert.ok(travel<12,'single-frame jump');
            near(s.observation.labels[0].x,e.x);near(s.observation.labels[0].y,e.y+e.radius+62);
            near(s.observation.labels[1].x,e.x);near(s.observation.labels[1].y,e.y+e.radius+101);
            if(s.judgement.headingAlpha>0){near(e.x,390);near(e.handoff,1);assert.ok(e.x+e.radius+22<760);}
            prior=s;
        }
        for(const b of [0,.65,2.55,2.7,3.85,5.1,6.65,6.8,8.7]){
            const a=sampleConceptBridge((b-1e-6)/tempo,{tempo}),c=sampleConceptBridge((b+1e-6)/tempo,{tempo});
            assert.ok(Math.hypot(a.entity.x-c.entity.x,a.entity.y-c.entity.y)<.01);assert.ok(Math.abs(a.entity.radius-c.entity.radius)<.01);
        }
    }
});
check('reading hold is still at every tempo and low motion fixes all entity geometry',()=>{
    for(const tempo of [.75,1,1.35])for(const reducedMotion of [false,true]){
        const o={tempo,reducedMotion},start=8.7/tempo;assert.ok(14-start>=2.39);
        const base=visualState(sampleConceptBridge(start+.001,o));
        for(const t of [start+.001,(start+14)/2,13.99,14]){const s=sampleConceptBridge(t,o);assert.ok(s.readingHold);assert.deepEqual(visualState(s),base);}
        if(reducedMotion)for(let f=0;f<=140;f++){const e=sampleConceptBridge(f/10,o).entity;near(e.x,390);near(e.y,446);near(e.radius,108);near(e.rotation,0);}
    }
});
check('exported marker and word arrays are owned by each sampled state',()=>{
    const a=sampleConceptBridge(4),b=sampleConceptBridge(4);assert.notStrictEqual(a.entity.markerAngles,b.entity.markerAngles);
    assert.notStrictEqual(a.intro.words,b.intro.words);assert.notStrictEqual(a.observation.labels,b.observation.labels);
    a.entity.markerAngles[0]=99;a.intro.words[0].text='changed';assert.deepEqual(sampleConceptBridge(4),b);
});
const draws=[];
check('all phases draw balanced finite Canvas commands in each palette and motion mode',()=>{
    for(const mfPalette of ['paper','lime','coral'])for(const reducedMotion of [false,true])for(const t of [0,1.4,2.7,4.2,5.5,6.6,7.1,8.2,9.2,14]){
        const o={mfPalette,reducedMotion},r=recorder();drawConceptBridge(r.ctx,t,1600,900,o);const q=r.finish();assert.ok(q.commands>60);assert.ok(q.texts.length>=4);draws.push({t,o,hash:q.hash});
    }
});
check('reverse render order produces identical Canvas commands',()=>{
    assert.equal(draws.length,60);for(const d of draws.toReversed()){const r=recorder();drawConceptBridge(r.ctx,d.t,1600,900,d.o);assert.equal(r.finish().hash,d.hash);}
});
check('long editable copy retains all characters and readable font sizes in layout',()=>{
    const copy='看见一个位置之后我们还需要知道它离目标有多远'.repeat(8).slice(0,180),r=recorder();
    const layout=layoutConceptCopy(r.ctx,copy);assert.equal(layout.lines.join(''),copy);assert.ok(layout.size>=18&&layout.height<=114);
    // layout helper is a measurement function and can change ctx.font; renderer
    // owns a save/restore boundary, verified independently above.
    const rr=recorder();drawConceptBridge(rr.ctx,14,1600,900,{headline:copy,kicker:copy,result:copy});const q=rr.finish();
    const long=q.texts.filter(t=>t.text.length>30&&t.alpha>.9);assert.ok(long.length>=7);
    assert.ok(long.every(t=>t.size>=18));assert.ok(long.every(t=>t.y>=40&&t.y+t.size/2<807));
});

const report={schemaVersion:1,kind:'motionface-concepts-pure-state-and-recorded-canvas-qa',passed:failures.length===0,checks,failures,metrics,
    sourceModule:'lab/modules/motionface-concepts.js',browserReviewed:false,audioReviewed:false,
    scope:'Pure state continuity, identity, measurement invariants, reading holds, finite Canvas commands and approximate text layout. Not a raster/font, playback or subjective aesthetic pass.'};
await mkdir(new URL('../qa/motionface/',import.meta.url),{recursive:true});
await writeFile(new URL('../qa/motionface/concepts-state-and-drawing.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
