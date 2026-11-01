/** Tests the real studio event handlers in a deterministic DOM/clock harness.
 * No browser, network or source footage access; this is not visual QA. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {candidates} from '../lab/modules/shuffle-explanation.js';
import {plans,beatAt} from '../examples/shuffle-story/narration-plans.js';

const root=fileURLToPath(new URL('../',import.meta.url));
let checks=0,readSamples=0,seekSamples=0,drawCount=0;
const findings=[],exportsChecked=[];
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const near=(a,b,eps=1e-8,label='number')=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=eps,`${label}: ${a} != ${b}`);
const captureFinding=(id,label,actual,expected)=>findings.push({id,severity:'low',label,actual,expected});
const codePath=resolve(root,'lab/shuffle-story-studio.js');
const planPath=resolve(root,'examples/shuffle-story/narration-plans.js');
const html=readFileSync(resolve(root,'lab/shuffle-story.html'),'utf8');

// Script state and animation state share one uninterrupted time domain.
for(const c of candidates){
    const plan=plans[c.id];check(plan.duration===c.duration,'plan duration equals candidate duration');
    const ids=plan.beats.map(b=>b.id);check(new Set(ids).size===ids.length,'unique beat IDs');
    check(c.stageTimes.length===c.stages.length,'navigation times have matching labels');
    for(const [i,b]of plan.beats.entries()){
        near(b.start,i?plan.beats[i-1].end:0,0,'no beat gap or overlap');
        check(b.end>b.start&&b.end<=c.duration,'positive beat inside timeline');
        equal(beatAt(c.id,b.start),b,'boundary selects new beat');
        if(i>0)equal(beatAt(c.id,b.start-1e-7),plan.beats[i-1],'just before boundary selects previous beat');
        check(b.timingBasis==='planned','script times not represented as measured speech');
        for(const id of b.dependsOn)check(plan.beats.slice(0,i).some(prior=>prior.id===id),'dependencies already introduced');
        for(const id of b.sourceIds)check(plan.sources.some(source=>source.id===id),'every source reference exists');
        if(b.readingWindow){
            const r=b.readingWindow;check(r.start>=b.start&&r.end<=b.end&&r.end>r.start,'reading window inside its beat');
            const steps=Math.ceil((r.end-r.start)*120);
            for(let j=0;j<=steps;j++){
                const t=r.start+(r.end-r.start)*j/steps,s=c.sample(t);readSamples++;
                check(s.readHold&&s.geometryStable,'entire declared read window is visually settled');
            }
        }
    }
    near(plan.beats.at(-1).end,c.duration,0,'final beat covers end');
    equal(beatAt(c.id,c.duration),plan.beats.at(-1),'terminal time retains final beat');
    for(const source of plan.sources)check(existsSync(resolve(dirname(planPath),source.path)),'authored source resolves from plan file');
    for(const t of [-1,NaN])if(beatAt(c.id,t)!==plan.beats[0])captureFinding('invalid-time-beat',`beatAt(${c.id}, ${String(t)}) does not match clamped animation`,beatAt(c.id,t).id,plan.beats[0].id);
}
const choice=candidates.find(c=>c.id==='visualization-choice-product');
const shuffle=candidates.find(c=>c.id==='storytelling-perfect-shuffle');
for(const b of plans[choice.id].beats.filter(b=>b.id==='read-result'||b.id==='hold-result')){
    const s=choice.sample(b.start);check(s.formula.product===720&&s.factorCount===6&&s.chosenCount===6,'result prose cannot precede complete product and six landed cards');
}
const returnBeat=plans[shuffle.id].beats.find(b=>b.id==='return');
const returned=shuffle.sample(returnBeat.start);check(returned.completedRounds===3&&returned.geometryStable,'return sentence begins after final gathering');
equal(returned.settledOrder,returned.originalOrder,'return sentence corresponds to exact identity order');
check(shuffle.sample(returnBeat.start-.001).completedRounds<3,'return event lands at the actual completion boundary');

// Minimal DOM accepts only APIs actually required by this module; missing IDs fail.
let wallClock=0,nextFrameId=0,nextBlobId=0;
const raf=new Map(),timers=[],blobs=new Map(),downloads=[],windowEvents=new Map(),documentEvents=new Map();
const allElements=[],elements=new Map();
function canvasContext(){
    const state={globalAlpha:1},stack=[];
    return new Proxy(state,{get(o,k){
        if(k in o)return o[k];
        if(k==='save')return()=>stack.push({...o});
        if(k==='restore')return()=>Object.assign(o,stack.pop());
        if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop(){}});
        if(k==='measureText')return value=>({width:String(value).length*14});
        return(...args)=>{if(args.some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error(`Nonfinite Canvas call ${k}`);};
    },set(o,k,v){o[k]=v;return true;}});
}
const drawing=canvasContext();
function element(tag='div',id=null){
    const el={tag,id,dataset:{},attributes:{},children:[],textContent:'',value:'',style:{},
        classList:{values:new Set(),toggle(name,force){if(force)this.values.add(name);else this.values.delete(name);}},
        setAttribute(name,value){this.attributes[name]=value;},
        append(...children){this.children.push(...children);},
        replaceChildren(...children){const old=new Set(this.children);this.children=[...children];for(const child of old)child.detached=true;},
        getContext(){return drawing;},click(){if(this.tag==='a')downloads.push({href:this.href,download:this.download});this.onclick?.();}};
    allElements.push(el);if(id)elements.set(id,el);return el;
}
for(const match of html.matchAll(/id="([^"]+)"/g))element(match[1]==='scene'?'canvas':'div',match[1]);
const document={hidden:false,getElementById:id=>elements.get(id)??null,
    createElement:tag=>element(tag),
    querySelectorAll:selector=>{const key=/^\[data-(.+)\]$/.exec(selector)?.[1];if(!key)throw Error('Unsupported selector '+selector);return allElements.filter(el=>!el.detached&&key in el.dataset);},
    addEventListener:(name,handler)=>documentEvents.set(name,handler)};
const context=vm.createContext({document,window:{addEventListener:(name,handler)=>windowEvents.set(name,handler)},
    performance:{now:()=>wallClock},
    requestAnimationFrame:fn=>{const id=++nextFrameId;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},
    Blob,URL:{createObjectURL:blob=>{const id=`blob:test-${++nextBlobId}`;blobs.set(id,blob);return id;},revokeObjectURL:id=>blobs.delete(id)},
    candidates:candidates.map(c=>({...c,draw(...args){drawCount++;return c.draw(...args);}})),plans,beatAt,console});
const source=readFileSync(codePath,'utf8').replace(/^import .*;\r?\n/gm,'');
new vm.Script(source,{filename:codePath}).runInContext(context);
const $=id=>elements.get(id);
const diagnostic=()=>JSON.parse($('diagnostics').textContent);
function tick(milliseconds){wallClock+=milliseconds;const queued=[...raf.values()];raf.clear();for(const fn of queued)fn(wallClock);}
function seek(t){$('seek').oninput({target:{value:String(t)}});seekSamples++;return diagnostic();}
function choose(id){document.querySelectorAll('[data-candidate]').find(el=>el.dataset.candidate===id).click();}
const initial=diagnostic();check(initial.id===choice.id&&initial.time===0&&!initial.playing,'initial paused scene');
for(const c of candidates){
    choose(c.id);check(diagnostic().id===c.id,'candidate switch updates identity');
    check(document.querySelectorAll('[data-stage]').length===c.stageTimes.length,'candidate switch replaces stage controls');
    const stamps=[c.duration,1.91,8.41,0,c.duration-.1,3.2,-4,NaN,Infinity];
    for(const t of stamps){const d=seek(t),expected=Number.isNaN(t)?0:Math.max(0,Math.min(c.duration,t));near(d.time,expected,1e-9,'seek clamps to legal timeline');check(d.beat===beatAt(c.id,d.time).id,'seek changes script with picture');check(d.phase===c.sample(d.time).phase,'seek changes phase with picture');}
    for(const [i,button]of document.querySelectorAll('[data-stage]').entries()){button.click();near(diagnostic().time,c.stageTimes[i],0,'chapter jump uses actual phase boundary');}
    for(const button of document.querySelectorAll('[data-beat]')){button.click();const beat=plans[c.id].beats.find(b=>b.id===button.dataset.beat);near(diagnostic().time,beat.start,0,'script click seeks that beat');}
}

choose(choice.id);seek(0);$('play').click();tick(1000);near(diagnostic().time,1,1e-9,'one-second playback');
$('play').click();const pausedTime=diagnostic().time;tick(2500);near(diagnostic().time,pausedTime,0,'paused playback does not advance');
if(diagnostic().playing!==false)captureFinding('stale-pause-diagnostic','Pause button is updated, but diagnostics.playing remains true until another paint',diagnostic().playing,false);
check($('play').attributes['aria-label']==='播放','pause updates accessible play label');
$('next').click();near(diagnostic().time,pausedTime+1/30,1e-9,'single next frame');check(!diagnostic().playing,'frame step is paused');
$('previous').click();near(diagnostic().time,pausedTime,1e-9,'single previous frame');
$('speed').onchange({target:{value:'0.5'}});$('play').click();tick(2000);near(diagnostic().time,pausedTime+1,1e-9,'half-speed uses elapsed time');
seek(12);tick(200);near(diagnostic().time,12.1,1e-9,'seek while playing resets clock origin');
choose(shuffle.id);check(diagnostic().time===0&&!diagnostic().playing,'switch during playback resets and pauses');
$('speed').onchange({target:{value:'1.5'}});seek(21.9);$('play').click();tick(1000);near(diagnostic().time,22,0,'end clamps');check(!diagnostic().playing,'end pauses');
$('play').click();tick(1000);near(diagnostic().time,1.5,1e-9,'play at end restarts at zero');
$('replay').click();tick(200);near(diagnostic().time,.3,1e-9,'replay resets from active playback');

document.hidden=true;documentEvents.get('visibilitychange')();tick(1000);const hiddenTime=diagnostic().time;tick(3000);near(diagnostic().time,hiddenTime,0,'hidden page pauses');check(!diagnostic().playing,'hidden page reports paused after paint');
document.hidden=false;documentEvents.get('visibilitychange')();tick(1000);near(diagnostic().time,hiddenTime,0,'visibility return does not auto-resume');
windowEvents.get('pagehide')();check(raf.size===0,'pagehide removes animation frame');
windowEvents.get('pageshow')({persisted:true});check(raf.size===1,'BFCache pageshow restores exactly one animation frame');tick(16);check(raf.size===1,'no duplicate frame loop after BFCache');
$('scene').onkeydown({code:'Space',key:' ',preventDefault(){}});tick(100);check(diagnostic().playing,'space key toggles playback');
$('scene').onkeydown({code:'ArrowLeft',key:'ArrowLeft',preventDefault(){}});check(!diagnostic().playing,'keyboard frame step pauses');

$('play').click();tick(250);const beforeRead=diagnostic().time;
windowEvents.get('document-reader:open')();check(!diagnostic().playing,'opening research reader pauses synchronously');
tick(3000);near(diagnostic().time,beforeRead,0,'research reader preserves original canvas time');
check(html.includes('src="./document-reader.js"')&&html.includes('href="./document-reader.css"'),'reader script and independent stylesheet wired');

for(const c of candidates){
    choose(c.id);seek(c.previewTime);$('export').click();const file=downloads.at(-1),blob=blobs.get(file.href);
    check(file.download===`${c.id}-storyboard.json`,'export filename names selected candidate');
    const payload=JSON.parse(await blob.text());
    check(payload.pathBase==='motion_atelier-root'&&payload.candidateId===c.id,'export declares consistent root and correct identity');
    near(payload.duration,c.duration,0,'export duration correct');equal(payload.beats,plans[c.id].beats,'export retains exact script and reading windows');
    check(payload.provenance==='original-code-and-script','export labels original material');
    const paths=[payload.code,...payload.dependencies,...payload.sources.map(s=>s.path),payload.referenceStudy];
    for(const path of paths){
        const absolute=resolve(root,path),rel=relative(root,absolute);
        check(!rel.startsWith('..')&&!/^[A-Za-z]:/.test(rel),'export dependency stays within library');
        if(!existsSync(absolute))findings.push({id:'missing-export-dependency',severity:'medium',candidate:c.id,path});
    }
    check(paths.includes('lab/modules/common.js')&&paths.includes('examples/shuffle-story/narration-plans.js'),'export includes renderer and script dependencies');
    check(payload.options.palette==='titanium','export retains current rendering options');
    exportsChecked.push({candidate:c.id,pathBase:payload.pathBase,dependencies:paths,bytes:blob.size});
}
const report={passed:!findings.length,checks,readSamples,seekSamples,drawCount,exportsChecked,findings,
    sourceHashes:Object.fromEntries([codePath,planPath].map(p=>[relative(root,p).replaceAll('\\','/'),createHash('sha256').update(readFileSync(p)).digest('hex')])),
    verified:['Beat/animation duration agreement','Contiguous causal script beats','No early result or return','All declared reading windows sampled at 120 Hz','Arbitrary seek including out-of-range input','Playback/pause/frame-step/speed/replay','Candidate switch','Visibility pause and BFCache restart','JSON payload and relative dependency paths'],
    notVerified:['Browser visual rendering','Actual speech synthesis durations','Subjective rhythm or sound quality','Download gesture restrictions in a real browser']};
writeFileSync(resolve(root,'qa/shuffle-story-contract.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(findings.length)process.exitCode=1;
