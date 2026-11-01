import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {
  candidates,MOTIONFACE_DURATION,motionfaceDefaults,motionfacePalettes,
  normalizeMotionfaceOptions,partialPolyline,sampleCardConvergence,
  sampleFocusHandoff,sampleTraceAssembly
} from '../lab/modules/motionface-type.js';

// This is a pure-state and Canvas-command audit, not a browser/font/raster audit.
const checks=[],failures=[];
const metrics={stateSamples:0,finiteNumbers:0,drawingSamples:0,drawCommands:0,maxPolylineLengthError:0};
function check(name,fn){try{fn();checks.push({name,passed:true});}catch(error){const message=error.message;checks.push({name,passed:false,message});failures.push({name,message});}}
function finite(v,path='state'){
  if(typeof v==='number'){assert.ok(Number.isFinite(v),`${path} must be finite`);metrics.finiteNumbers++;}
  else if(v&&typeof v==='object')for(const [k,x]of Object.entries(v))finite(x,`${path}.${k}`);
}
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<=e,`${a} differs from ${b}`);
function visualState(s){const copy=structuredClone(s);delete copy.time;delete copy.phaseTime;return copy;}
function length(points){return points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);}

function recordingContext(){
  let balance=0;const stack=[],commands=[],textRuns=[];
  const state={globalAlpha:1,globalCompositeOperation:'source-over',filter:'none',font:'10px sans-serif',fillStyle:'#000',strokeStyle:'#000',lineWidth:1,lineCap:'butt',lineJoin:'miter',textAlign:'start',textBaseline:'alphabetic'};
  const record=(name,args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${name}: non-finite argument`);commands.push([name,args]);};
  const functions={};
  for(const name of ['setTransform','clearRect','fillRect','beginPath','closePath','moveTo','lineTo','stroke','fill','clip','translate','rotate','scale','rect','roundRect','arc','setLineDash'])functions[name]=(...args)=>{
    if(name==='arc')assert.ok(args[2]>=0,'negative arc radius');
    if(name==='roundRect')assert.ok(args[2]>=0&&args[3]>=0,'negative roundRect dimensions');
    record(name,args);
  };
  functions.save=()=>{stack.push({...state});balance++;record('save',[]);};
  functions.restore=()=>{assert.ok(balance>0,'unbalanced restore');Object.assign(state,stack.pop());balance--;record('restore',[]);};
  functions.measureText=value=>{
    const size=Number(/([\d.]+)px/.exec(state.font)?.[1]||10);
    // Deliberately approximate. Actual glyph metrics are a browser QA obligation.
    return {width:Array.from(String(value)).reduce((sum,c)=>sum+(c===' '? .3:/[\u0000-\u00ff]/.test(c)? .57:1),0)*size};
  };
  functions.fillText=(value,x,y)=>{const size=Number(/([\d.]+)px/.exec(state.font)?.[1]||10);textRuns.push({value:String(value),x,y,size,alpha:state.globalAlpha,font:state.font});record('fillText',[value,x,y,state.font]);};
  const ctx=new Proxy(state,{get(target,key){return key in functions?functions[key]:target[key];},set(target,key,value){if(typeof value==='number')assert.ok(Number.isFinite(value),`${String(key)} not finite`);if(key==='globalAlpha')assert.ok(value>=0&&value<=1,`invalid alpha ${value}`);target[key]=value;record(String(key),[value]);return true;}});
  const initial={...state};
  return {ctx,finish(){assert.equal(balance,0,'Canvas state stack not balanced');assert.deepEqual(state,initial,'drawing leaked Canvas styling');metrics.drawingSamples++;metrics.drawCommands+=commands.length;return {hash:createHash('sha256').update(JSON.stringify(commands)).digest('hex'),commands:commands.length,textRuns};}};
}

check('four finite candidates declare unique identities, real code entry and ordered reading stages',()=>{
  assert.equal(candidates.length,4);assert.equal(new Set(candidates.map(c=>c.id)).size,4);
  assert.deepEqual(candidates.map(c=>c.id),Object.keys(motionfaceDefaults));
  for(const c of candidates){
    assert.equal(c.duration,MOTIONFACE_DURATION);assert.equal(c.loop,false);assert.ok(['look','visualization'].includes(c.module));
    assert.equal(c.stageTimes.length,c.stages.length);assert.ok(c.recipe.length>=3&&c.referenceIds.includes('motionface'));
    assert.equal(c.codeFile,'./modules/motionface-type.js');
    c.stageTimes.forEach((v,i)=>assert.ok(v>=0&&v<c.duration&&(i===0||v>c.stageTimes[i-1])));
  }
});

check('all palettes, amplitudes, tempos and motion modes sample finite states deterministically',()=>{
  for(const c of candidates)for(const palette of Object.keys(motionfacePalettes))for(const intensity of [0,.65,1])for(const tempo of [.75,1,1.35])for(const reducedMotion of [false,true]){
    const options={mfPalette:palette,intensity,tempo,reducedMotion};
    for(let frame=0;frame<=140;frame++){const s=c.sample(frame/10,options);finite(s);metrics.stateSamples++;assert.ok(s.time>=0&&s.time<=14);}
    const known=structuredClone(c.sample(5.3,options));for(const t of [13,0,7.4,1.2,14,-3])c.sample(t,options);assert.deepEqual(c.sample(5.3,options),known);
    assert.deepEqual(c.sample(-4,options),c.sample(0,options));assert.deepEqual(c.sample(20,options),c.sample(14,options));
    for(const t of [NaN,Infinity,-Infinity])finite(c.sample(t,options));
  }
});

check('reading windows keep all visual state still and last at least 1.8 seconds at minimum tempo',()=>{
  for(const c of candidates)for(const tempo of [.75,1,1.35])for(const reducedMotion of [false,true]){
    const options={tempo,reducedMotion},end=c.sample(14,options),start=end.timings.at(-1).start;
    assert.ok(14-start>=1.8,`${c.id}: reading hold too short`);
    const baseline=visualState(c.sample(start+.001,options));
    for(const t of [start+.001,(start+14)/2,13.99,14]){const s=c.sample(t,options);assert.equal(s.readingHold,true);assert.deepEqual(visualState(s),baseline,`${c.id} moved inside reading hold at ${t}`);}
  }
});

check('card identity, units and F = ma remain tied to one exact teaching relation',()=>{
  for(const tempo of [.75,1,1.35])for(let frame=0;frame<=420;frame++){
    const s=sampleCardConvergence(frame/30,{tempo});assert.deepEqual(s.cards.map(c=>c.id),['force','mass','acceleration']);
    const byId=Object.fromEntries(s.cards.map(c=>[c.id,c]));near(byId.force.value,byId.mass.value*byId.acceleration.value);near(s.relation.residual,0);
    for(const card of s.cards){assert.ok(card.scaleX>0&&card.scaleX<=1);near(card.frontAlpha+card.backAlpha,1);assert.ok(card.x>80&&card.x<1520);}
  }
});

check('focus geometry and shown difference remain consistent at every frame',()=>{
  for(const tempo of [.75,1,1.35])for(let frame=0;frame<=420;frame++){
    const s=sampleFocusHandoff(frame/30,{tempo}),m=s.measurement;near(m.error,m.target-m.current);near(m.targetX-m.entityX,10*m.error);near(m.gapMidX,(m.entityX+m.targetX)/2);
    assert.equal(m.unit,'cm');assert.ok(m.current>=42&&m.current<=72);assert.ok(s.focus.x>=80&&s.focus.x+s.focus.width<=1520);assert.ok(s.focus.y>=280&&s.focus.y+s.focus.height<807);
  }
  const end=sampleFocusHandoff(14);assert.equal(end.measurement.current,72);assert.equal(end.measurement.error,28);
});

check('polyline reveals preserve cumulative distance on unequal and zero-length segments',()=>{
  for(const points of [[[0,0],[30,0],[30,40]],[[0,0],[0,0],[20,0],[20,80]],[[1,2]],[]]){
    const total=length(points);
    for(let i=0;i<=200;i++){const p=i/200,result=partialPolyline(points,p),error=Math.abs(length(result)-total*p);metrics.maxPolylineLengthError=Math.max(metrics.maxPolylineLengthError,error);assert.ok(error<1e-8);finite(result);}
    if(points.length)assert.deepEqual(partialPolyline(points,1).at(-1),points.at(-1));
  }
  assert.deepEqual(partialPolyline([[0,0],[30,0],[30,40]],3/7).at(-1),[30,0]);
});

check('assembly progresses by structural groups and keeps labels out until their members exist',()=>{
  const first=sampleTraceAssembly(0),complete=sampleTraceAssembly(14),ids=first.strokes.map(s=>s.id);
  assert.equal(new Set(ids).size,ids.length);assert.ok(first.strokes.every(s=>s.progress===0));assert.ok(complete.strokes.every(s=>s.progress===1));
  for(let f=0;f<=420;f++){
    const s=sampleTraceAssembly(f/30);assert.deepEqual(s.strokes.map(v=>v.id),ids);
    for(const label of s.labels)if(label.alpha>0)assert.ok(s.strokes.filter(v=>v.group==='member').every(v=>v.progress>.999),'label preceded completed member geometry');
    for(const stroke of s.strokes){assert.ok(stroke.progress>=0&&stroke.progress<=1);assert.ok(length(partialPolyline(stroke.points,stroke.progress))<=length(stroke.points)+1e-8);}
  }
});

check('exported assembly states own their point arrays and cannot corrupt later samples',()=>{
  const a=sampleTraceAssembly(7),b=sampleTraceAssembly(7);
  for(let i=0;i<a.strokes.length;i++){
    assert.notStrictEqual(a.strokes[i].points,b.strokes[i].points,'stroke points are shared between sampled states');
    for(let j=0;j<a.strokes[i].points.length;j++)assert.notStrictEqual(a.strokes[i].points[j],b.strokes[i].points[j],'stroke point is shared between sampled states');
  }
});

check('input normalization clamps nonfinite settings and keeps legacy palette mappings',()=>{
  const x=normalizeMotionfaceOptions({intensity:NaN,tempo:Infinity,headline:'  ',kicker:'\u0000 标题 ',result:'结果\u0001',palette:'missing'});
  assert.equal(x.intensity,.65);assert.equal(x.tempo,1);assert.equal(x.palette,'paper');assert.equal(x.kicker,'标题');assert.equal(x.result,'结果');
  for(const [a,b]of Object.entries({titanium:'lime',ember:'coral',porcelain:'paper'}))assert.equal(normalizeMotionfaceOptions({palette:a}).palette,b);
  assert.equal(normalizeMotionfaceOptions({tempo:0,intensity:-3}).tempo,.75);assert.equal(normalizeMotionfaceOptions({tempo:3,intensity:8}).intensity,1);
});

const drawing=[];
check('all four renderers draw finite balanced commands at key phases in every palette',()=>{
  for(const c of candidates)for(const palette of Object.keys(motionfacePalettes))for(const reducedMotion of [false,true])for(const t of [0,1.5,3.2,4.9,6.5,7.8,9.2,14]){
    const r=recordingContext(),options={mfPalette:palette,reducedMotion};c.draw(r.ctx,t,1600,900,options);const result=r.finish();assert.ok(result.commands>20&&result.textRuns.length>=2,'candidate did not draw its declared explanatory frame');drawing.push({id:c.id,t,options,hash:result.hash});
  }
});

check('reverse-seek renders reproduce identical command hashes',()=>{
  assert.equal(drawing.length,candidates.length*3*2*8,'the preceding draw audit must generate every expected sample');
  for(const d of drawing.toReversed()){const c=candidates.find(c=>c.id===d.id),r=recordingContext();c.draw(r.ctx,d.t,1600,900,d.options);assert.equal(r.finish().hash,d.hash);}
});

check('advertised long headline fixture is not reduced below 18px at the final reading frame',()=>{
  const headline='一个变化为什么能成为我们理解世界的入口'.repeat(8).slice(0,180);
  for(const c of candidates){const r=recordingContext();c.draw(r.ctx,14,1600,900,{headline});const result=r.finish();
    const relevant=result.textRuns.filter(v=>Array.from(v.value).length>20&&v.alpha>.99);
    assert.ok(relevant.length>0,`${c.id} long headline missing`);for(const run of relevant)assert.ok(run.size>=18,`${c.id} long headline is ${run.size}px`);
  }
});

const report={schemaVersion:1,kind:'motionface-pure-state-and-recorded-canvas-qa',passed:failures.length===0,checks,failures,metrics,sourceModule:fileURLToPath(new URL('../lab/modules/motionface-type.js',import.meta.url)),scope:'Pure numerical/state invariants, draw-command determinism, stage contracts and approximate long-copy check. Does not validate browser font metrics, pixels, clipping, source motion similarity or subjective readability.',browserReviewed:false,audioReviewed:false};
await mkdir(new URL('../qa/motionface/',import.meta.url),{recursive:true});await writeFile(new URL('../qa/motionface/state-and-drawing.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
