/** Real studio handlers, deterministic DOM/clock/download harness; not browser raster QA. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {candidates,sampleTracking,sampleWindowRelay,sampleExposureTimes} from '../lab/modules/transmission-effects.js';
const root=fileURLToPath(new URL('../',import.meta.url)),scriptPath=resolve(root,'lab/transmission-effects-studio.js'),htmlPath=resolve(root,'lab/transmission-effects.html');
const html=readFileSync(htmlPath,'utf8'),source=readFileSync(scriptPath,'utf8');
let checks=0,clock=0,frameId=0,blobId=0,drawCount=0;
const findings=[],exportsChecked=[],frames=new Map(),timers=[],blobs=new Map(),downloads=[],pngCallbacks=[],windowEvents=new Map(),documentEvents=new Map(),elements=new Map(),nodes=[],drawn=new Map();
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const near=(a,b,eps=1e-9,label='value')=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=eps,`${label}: ${a} != ${b}`);
const clone=value=>JSON.parse(JSON.stringify(value));
function element(tag='div',id){
    const ctx={id,fillRect(){},fillText(){},drawImage(){}};
    const el={tag,id,dataset:{},attributes:{},children:[],hidden:false,disabled:false,value:'',textContent:'',
        setAttribute(k,v){this.attributes[k]=v;},getContext(){return ctx;},
        append(...children){this.children.push(...children);},replaceChildren(...children){this.children.forEach(c=>c.detached=true);this.children=[...children];},
        click(){if(this.tag==='a')downloads.push({url:this.href,filename:this.download});this.onclick?.();},
        toBlob(callback,type){pngCallbacks.push({callback,type,width:this.width,height:this.height});}};
    nodes.push(el);if(id)elements.set(id,el);return el;
}
for(const match of html.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const el=element(match[1],match[2]);const value=/\bvalue="([^"]*)"/.exec(match[0]);if(value)el.value=value[1];}
for(const match of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
    const options=[...match[2].matchAll(/<option\b([^>]*)>/g)];const selected=options.find(o=>/\bselected\b/.test(o[1]))||options[0];elements.get(match[1]).value=/\bvalue="([^"]+)"/.exec(selected[1])[1];
}
for(const match of html.matchAll(/data-method="([^"]+)"/g))element('button').dataset.method=match[1];
const document={hidden:false,getElementById:id=>elements.get(id)??null,createElement:tag=>element(tag),
    querySelectorAll:selector=>{const key=/^\[data-(.+)\]$/.exec(selector)?.[1];if(!key)throw Error('Unexpected selector '+selector);return nodes.filter(node=>!node.detached&&key in node.dataset);},
    addEventListener:(name,fn)=>documentEvents.set(name,fn)};
const render=(ctx,time,width,height,options,kind)=>{drawCount++;const state=kind==='tracking'?sampleTracking(time,options):sampleWindowRelay(time);drawn.set(ctx.id,{time,width,height,options:clone(options),state});return state;};
const context=vm.createContext({document,window:{addEventListener:(name,fn)=>windowEvents.set(name,fn)},performance:{now:()=>clock},
    requestAnimationFrame:fn=>{const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},
    Blob,URL:{createObjectURL:blob=>{const key=`blob:contract-${++blobId}`;blobs.set(key,blob);return key;},revokeObjectURL:key=>blobs.delete(key)},
    candidates,sampleTracking,sampleWindowRelay,sampleExposureTimes,
    drawTracking:(...args)=>render(...args,'tracking'),drawWindowRelay:(...args)=>render(...args,'relay')});
new vm.Script(source.replace(/^import .*;\r?\n/gm,''),{filename:scriptPath}).runInContext(context);
const $=id=>elements.get(id),state=()=>JSON.parse($('diagnostics').textContent);
const tick=ms=>{clock+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(clock));};
const seek=t=>{$('seek').oninput({target:{value:String(t)}});return state();};
const control=(id,value)=>{$(id).value=String(value);$(id).oninput();return state();};
const method=name=>document.querySelectorAll('[data-method]').find(node=>node.dataset.method===name).click();
const readExport=async()=>{const file=downloads.at(-1);return {file,payload:JSON.parse(await blobs.get(file.url).text())};};
const auditExport=async expectedTime=>{
    $('export').click();const {file,payload}=await readExport(),d=state();
    check(payload.candidateId===d.id&&file.filename===d.id+'-selection.json','JSON identifies the selected candidate');
    equal(payload.options,d.options,'JSON retains all current controls');
    if(Math.abs(payload.time-expectedTime)>1e-9)findings.push({id:'export-displayed-frame-mismatch',severity:'medium',exportTime:payload.time,visibleTime:expectedTime});
    const recomputed=payload.candidateId==='look-tracking-exposure'?sampleTracking(payload.time,payload.options):sampleWindowRelay(payload.time);
    equal(payload.state,clone(recomputed),'exported state exactly matches declared time/options');
    check(payload.pathBase==='motion_atelier-root','JSON declares dependency base');
    const paths=[payload.code,...payload.dependencies,payload.referenceStudy,payload.guide];
    for(const path of paths){check(!relative(root,resolve(root,path)).startsWith('..'),'dependency stays inside library');if(!existsSync(resolve(root,path)))findings.push({id:'missing-export-dependency',severity:'medium',path});}
    const candidate=candidates.find(c=>c.id===d.id);equal(payload.stages,candidate.stages.map((label,i)=>({label,start:candidate.stageTimes[i]})),'export phase labels and starts match module');
    exportsChecked.push({id:d.id,time:payload.time,visibleTime:expectedTime,bytes:blobs.get(file.url).size});return payload;
};

check(state().id==='look-tracking-exposure'&&!state().playing,'initial tracking preview paused');near(state().time,candidates[0].previewTime,0,'representative preview selected');
for(const key of ['cameraMode','blurMode','fps','samples'])check(String(state().options[key])===$(key).value,'HTML defaults agree with controls: '+key);
near(drawn.get('canvasA').time,drawn.get('canvasB').time,0,'A/B share absolute time');check(drawn.get('canvasA').options.blurMode==='none','A always single-frame baseline');

// Read actual sampler outputs downstream of the actual UI handlers.
seek(9.575);control('cameraMode','fixed');const fixed=drawn.get('canvasB').state;
control('cameraMode','follow');const follow=drawn.get('canvasB').state;
check(Math.abs(fixed.screenVelocity[0])>2000&&follow.screenVelocity[0]===0,'camera control changes relative projected motion');
equal(fixed.packets.map(p=>p.world),follow.packets.map(p=>p.world),'camera mode preserves common world trajectory');
control('samples',64);check(drawn.get('canvasB').state.exposure.length===64,'sample count reaches actual quadrature');
control('fps',60);near(drawn.get('canvasB').state.shutterSeconds,1/120,1e-15,'fps controls actual exposure interval');
control('shutter',0);check(drawn.get('canvasB').state.exposure.length===1&&$('sampleCount').textContent==='1 个','zero shutter is one instant in scene and UI');
control('shutter',360);near(drawn.get('canvasB').state.shutterSeconds,1/60,1e-15,'full shutter uses full frame interval');
control('blurMode','spatial');check($('samples').disabled&&!$('shutter').disabled,'spatial disables unused temporal count only');check(drawn.get('canvasB').options.blurMode==='spatial'&&drawn.get('canvasA').options.blurMode==='none','spatial mode reaches B renderer only');
control('blurMode','none');check($('samples').disabled&&$('shutter').disabled,'no-blur mode disables both inactive controls');
control('blurMode','temporal');check(!$('samples').disabled&&!$('shutter').disabled,'temporal restores controls');

// Seek and playback modes: the actual rendered time is quantized only during playback.
for(const t of [18,0,9.575,3.07,-20,NaN,100]){seek(t);const expected=Number.isNaN(t)?0:Math.max(0,Math.min(18,t));near(state().time,expected,0,'seek bounds');near(drawn.get('canvasB').time,expected,0,'paused seek renders exact requested time');check(!state().playing,'scrubbing pauses');}
seek(5);$('next').click();near(state().time,5+1/60,1e-12,'next uses selected 60 fps');$('prev').click();near(state().time,5,1e-12,'previous reverses frame step');
control('fps',30);$('next').click();near(state().time,5+1/30,1e-12,'next uses selected 30 fps');
seek(9.575);$('play').click();tick(17);near(state().drawTime,Math.floor(state().time*30)/30,0,'active playback quantizes scene to selected fps');
await auditExport(drawn.get('canvasB').time);
const displayedBeforePause=drawn.get('canvasB').time;$('play').click();tick(1);const paused=state().time;near(paused,displayedBeforePause,0,'pause freezes previously displayed frame');tick(800);near(state().time,paused,0,'pause remains stable');
$('speed').onchange({target:{value:'0.5'}});seek(2);$('play').click();tick(1000);near(state().time,2.5,1e-9,'playback rate applies to elapsed time');
method('relay');check(state().id==='visualization-window-relay'&&!state().playing,'method switch pauses and selects relay');near(state().time,candidates[1].previewTime,0,'relay opens on own preview');
check($('comparison').hidden&&!$('relayView').hidden&&$('blurControls').hidden&&!$('relayNotes').hidden,'method changes correct visible panels');check(document.querySelectorAll('[data-stage]').length===candidates[1].stages.length,'relay stages rebuilt');
await auditExport(drawn.get('canvasRelay').time);
for(const [i,button]of document.querySelectorAll('[data-stage]').entries()){button.click();near(state().time,candidates[1].stageTimes[i],0,'chapter locates actual phase');check(!state().playing,'chapter seek paused');}
$('speed').onchange({target:{value:'1.5'}});seek(19.9);$('play').click();tick(1000);check(state().time===20&&!state().playing,'finite ending holds and pauses');$('play').click();tick(100);near(state().time,.15,1e-9,'play after end restarts');
$('restart').click();tick(200);near(state().time,.3,1e-9,'restart resets while playing');
$('canvasRelay').onkeydown({code:'ArrowLeft',key:'ArrowLeft',preventDefault(){}});check(!state().playing,'keyboard frame step pauses');

// Screenshot encoding is deliberately held until after the candidate changes.
method('tracking');seek(9.575);$('saveFrame').click();check(pngCallbacks.length===1,'PNG render requests asynchronous encoding');
check(pngCallbacks[0].width===1920&&pngCallbacks[0].height===590,'tracking PNG contains both canvases plus heading');
method('relay');pngCallbacks.shift().callback(new Blob(['png-data'],{type:'image/png'}));
if(downloads.at(-1).filename!=='look-tracking-exposure-frame.png')findings.push({id:'png-candidate-race',severity:'medium',actualFilename:downloads.at(-1).filename,expectedFilename:'look-tracking-exposure-frame.png'});

$('play').click();tick(100);const beforeRead=state().drawTime;windowEvents.get('document-reader:open')();tick(1);check(!state().playing,'research reader pauses');tick(1500);near(state().time,beforeRead,0,'research reading preserves displayed frame');
$('play').click();tick(100);document.hidden=true;documentEvents.get('visibilitychange')();tick(1);const hiddenTime=state().time;tick(3000);near(state().time,hiddenTime,0,'background tab pauses');
document.hidden=false;documentEvents.get('visibilitychange')();tick(100);check(!state().playing,'visibility restore does not auto-start');
windowEvents.get('pagehide')();check(frames.size===0,'pagehide cancels RAF');windowEvents.get('pageshow')({persisted:true});check(frames.size===1,'BFCache restores single RAF');tick(16);check(frames.size===1,'one frame loop after restoration');
method('tracking');check(!$('comparison').hidden&&$('relayView').hidden&&!$('blurControls').hidden&&$('relayNotes').hidden,'switching back restores tracking panels');
check(state().options.cameraMode==='follow'&&state().options.samples===64&&state().options.fps===30,'method switch retains chosen parameters');
const report={passed:!findings.length,checks,drawCount,exportsChecked,findings,sourceHashes:Object.fromEntries([scriptPath,htmlPath].map(path=>[relative(root,path).replaceAll('\\','/'),createHash('sha256').update(readFileSync(path)).digest('hex')])),
    verified:['Actual studio event handlers','A/B same time and baseline','Parameter changes reach actual sampler','Mode-specific disabled controls','Pause/seek/ending/frame-step/fps/speed','Method switch and stage navigation','Export identity/options/state/dependencies','PNG encode callback identity','Reader pause','Visibility pause and BFCache single loop'],
    notVerified:['Browser raster appearance','Actual PNG image encoding','Real browser download policy','GPU performance']};
writeFileSync(resolve(root,'qa/transmission-studio.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(findings.length)process.exitCode=1;
