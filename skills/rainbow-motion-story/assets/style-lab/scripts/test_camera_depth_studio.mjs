/** Execute the actual studio event handlers with real samplers; Canvas draw calls are instrumented. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {candidates as originals, resolveOptions} from '../lab/modules/camera-depth.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const scriptPath=resolve(root,'lab/camera-depth-studio.js'),htmlPath=resolve(root,'lab/camera-depth.html');
const source=readFileSync(scriptPath,'utf8'),html=readFileSync(htmlPath,'utf8');
let checks=0,drawCount=0;
const exportsChecked=[],pngChecked=[],findings=[];
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const near=(a,b,e=1e-9,label='numeric equivalence')=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=e,`${label}: ${a} vs ${b}`);
const clone=x=>JSON.parse(JSON.stringify(x));
const equal=(a,b,label)=>{assert.deepEqual(clone(a),clone(b),label);checks++;};

function boot(){
 let clock=0,frameId=0,blobId=0;
 const frames=new Map(),timers=[],blobs=new Map(),downloads=[],pngs=[],windowEvents=new Map(),documentEvents=new Map(),elements=new Map(),nodes=[],drawn=new Map();
 const detach=el=>{el.detached=true;el.children.forEach(detach);};
 function element(tag='div',id){
  const classes=new Set(),ctx={id};
  const el={tag,id,dataset:{},style:{},attributes:{},children:[],value:'',textContent:'',hidden:false,
   setAttribute(k,v){this.attributes[k]=String(v);},
   classList:{toggle(name,on){if(on??!classes.has(name))classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},
   append(...children){this.children.push(...children);},
   replaceChildren(...children){this.children.forEach(detach);this.children=[...children];},
   getContext(){return ctx;},
   click(){if(tag==='a')downloads.push({url:this.href,filename:this.download});this.onclick?.();},
   toBlob(callback,type){pngs.push({callback,type,width:this.width,height:this.height,state:clone(drawn.get(id))});},
   querySelector(selector){if(['output','small','strong'].includes(selector))return this.children.find(c=>c.tag===selector);throw Error('Unexpected child selector '+selector);},
  };
  nodes.push(el);if(id)elements.set(id,el);return el;
 }
 for(const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)){
  const el=element(match[1],match[2]);el.hidden=/\bhidden\b/.test(match[0]);
  for(const k of ['value','width','height']){const found=new RegExp(`\\b${k}="([^"]*)"`).exec(match[0]);if(found)el[k]=k==='value'?found[1]:Number(found[1]);}
 }
 for(const match of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
  const options=[...match[2].matchAll(/<option\b([^>]*)>/g)],selected=options.find(o=>/\bselected\b/.test(o[1]))||options[0];
  elements.get(match[1]).value=/\bvalue="([^"]+)"/.exec(selected[1])[1];
 }
 const document={hidden:false,getElementById:id=>elements.get(id)??null,createElement:tag=>element(tag),
  querySelectorAll:selector=>{const key=/^\[data-(.+)\]$/.exec(selector)?.[1];if(!key)throw Error('Unexpected selector '+selector);return nodes.filter(n=>!n.detached&&key in n.dataset);},
  addEventListener:(name,fn)=>documentEvents.set(name,fn)};
 const candidates=originals.map(c=>({...c,draw(ctx,time,width,height,options){drawCount++;const record={id:c.id,time,width,height,options:clone(options),state:c.sample(time,options)};drawn.set(ctx.id,record);return record.state;}}));
 const context=vm.createContext({document,window:{addEventListener:(name,fn)=>windowEvents.set(name,fn)},performance:{now:()=>clock},
  requestAnimationFrame:fn=>{const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},Blob,
  URL:{createObjectURL:blob=>{const key=`blob:camera-depth-${++blobId}`;blobs.set(key,blob);return key;},revokeObjectURL:key=>blobs.delete(key)},candidates,resolveOptions});
 new vm.Script(source.replace(/^import .*;\r?\n/gm,''),{filename:scriptPath}).runInContext(context);
 const $=id=>elements.get(id),state=()=>JSON.parse($('diagnostics').textContent);
 const tick=ms=>{clock+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(clock));};
 const seek=t=>{$('seek').oninput({target:{value:String(t)}});return state();};
 const select=id=>document.querySelectorAll('[data-candidate]').find(b=>b.dataset.candidate===id).click();
 const input=(id,value)=>{$(id).value=String(value);$(id).oninput({target:{value:String(value)}});};
 const change=(id,value)=>{$(id).value=String(value);$(id).onchange({target:{value:String(value)}});};
 const key=value=>{let prevented=false;$('scene').onkeydown({code:value===' '?'Space':value,key:value,preventDefault(){prevented=true;}});check(prevented,'keyboard transport prevents browser default');};
 return{$,state,tick,seek,select,input,change,key,document,frames,timers,blobs,downloads,pngs,windowEvents,documentEvents,drawn};
}

async function exportJSON(app){
 const visible=app.drawn.get('scene');app.$('export').click();
 const file=app.downloads.at(-1),blob=app.blobs.get(file.url),data=JSON.parse(await blob.text()),candidate=originals.find(c=>c.id===visible.id);
 check(file.filename===`${visible.id}-camera-plan.json`,'JSON file retains selected identity');
 check(data.candidateId===visible.id&&data.variant===candidate.variant&&data.duration===14&&data.fps===30,'JSON candidate and timing metadata');
 near(data.time,visible.time,0,'JSON stores displayed frame time');
 equal(data.options,app.state().options,'JSON preserves current parameter choices');
 check(data.provenance==='original-camera-study'&&data.rendering.includes('no ray-traced bokeh'),'JSON describes original preview limits');
 check(data.units.world==='metres'&&data.units.coc==='diameter in millimetres'&&data.units.focus==='optical-axis depth in metres','JSON units distinguish axis depth and CoC diameter');
 check(data.frames.length===421,'JSON includes 420-frame shot plus endpoint sample');
 for(const [i,frame]of data.frames.entries()){
  check(frame.frame===i&&frame.time===i/30,'export frame sequence is exact 30fps');
  const expected=candidate.sample(i/30,data.options);
  equal(frame.camera,expected.camera,'export camera comes from real sampler');
  equal(frame.focus,expected.focus,'export focus comes from real sampler');
  check(frame.readHold===expected.readHold,'export preserves reading interval');
 }
 check(data.frames.at(-1).time===14&&data.frames.at(-1).readHold,'endpoint retains final reading pose');
 exportsChecked.push({id:data.candidateId,time:data.time,frames:data.frames.length,options:data.options,bytes:blob.size});
 return data;
}

const app=boot(),{$,state,tick,seek,select,input,change,key}=app;
check(state().id===originals[0].id&&!state().playing&&state().time===0,'opens first candidate paused at zero');
check(app.frames.size===1,'one animation loop');
near(state().speed,Number($('speed').value));
$('compare').click();check(state().comparing&&!$('sharpView').hidden&&$('views').classList.contains('comparing'),'compare enables paired view');
for(const t of [0,1,2,4.5,5.5,9.5,11.5,14])for(const candidate of originals){
 seek(t);select(candidate.id);
 near(state().time,t,0,'candidate switch preserves exact paused time');
 const main=app.drawn.get('scene'),sharp=app.drawn.get('sharp');
 check(main.id===candidate.id&&sharp.id===candidate.id,'both views use same candidate');
 near(main.time,t,0,'main view same time');near(sharp.time,t,0,'sharp view same time');
 equal(main.state.camera,sharp.state.camera,'comparison shares identical camera');
 equal(main.state.focus,sharp.state.focus,'comparison shares identical focus');
 check(main.options.depthMode==='dof'&&sharp.options.depthMode==='sharp','only blur mode changes');
 const active=app.document.querySelectorAll('[data-stage]').filter(b=>b.attributes['aria-pressed']==='true');
 check(active.length===1&&Number(active[0].dataset.stage)===state().stageIndex,'active chapter follows sampler');
}

select('camera-focus-handoff');seek(0);const coc=()=>state().objects.find(o=>o.layer==='hero').cocMm;
input('aperture',2.8);const beforeCoC=coc();input('aperture',5.6);near(coc(),beforeCoC/2,1e-12,'aperture handler reaches optical computation');
check(!state().playing&&$('apertureValue').textContent==='f/5.6','aperture control updates visible output and pauses');
const fovBefore=state().camera.fov;input('focal',85);check(state().camera.fov<fovBefore&&state().camera.focalLengthMm===85,'focal handler changes actual projection');
for(const mode of ['near','hero','far']){change('focus',mode);const object=state().objects.find(o=>o.layer===mode);near(object.cocMm,0,1e-12,'focus target becomes sharp');near(state().focus.depthM,object.depthM,1e-12,'focus uses target axial depth');check($('manualField').hidden,'preset focus hides manual control');}
change('focus','manual');input('manual',12.4);check(!$('manualField').hidden&&state().options.focusMode==='manual','manual focus control appears');near(state().focus.depthM,12.4,0,'manual focus reaches sampled plane');
input('manual',99);near(state().options.manualFocusM,24,0,'out-of-range input follows declared effective domain');near(Number($('manual').value),24,0,'effective input shown back to user');
$('reset').click();equal(state().options,resolveOptions({}),'reset restores all optical defaults');

for(const candidate of originals){
 select(candidate.id);
 for(const [i,t]of candidate.stageTimes.entries()){app.document.querySelectorAll('[data-stage]').find(b=>Number(b.dataset.stage)===i).click();near(state().time,t,0,'chapter seeks exact boundary');check(!state().playing&&state().stageIndex===i,'chapter pauses and activates expected stage');}
 change('focus','manual');input('manual',7.3);input('aperture',4.2);input('focal',67);seek(6.123);await exportJSON(app);
}
$('reset').click();$('compare').click();check(!state().comparing&&$('sharpView').hidden,'compare closes secondary view');
seek(5);$('next').click();near(state().time,5+1/30);$('prev').click();near(state().time,5);key('ArrowRight');near(state().time,5+1/30);key('ArrowLeft');near(state().time,5);
for(const t of [-5,NaN,14,99]){seek(t);near(state().time,Number.isNaN(t)?0:Math.max(0,Math.min(14,t)),0,'seek bounds');}
seek(4.499);key(' ');tick(17);check(state().playing,'space starts');near(state().drawTime,Math.floor(state().time*30)/30,0,'playing is displayed at 30fps');
await exportJSON(app);const beforePause=app.drawn.get('scene').time;$('play').click();near(state().time,beforePause,0,'pause keeps actually displayed time');tick(800);near(state().time,beforePause,0,'paused frame stays fixed');
seek(3.2);change('speed',.5);$('play').click();tick(1000);near(state().time,3.7,1e-12,'half-speed playback');change('speed',1.5);tick(1000);near(state().time,5.2,1e-12,'rate change preserves time');
const beforeSwitch=state().drawTime;select(originals[0].id);near(state().time,beforeSwitch,0,'switch during playback preserves visible frame');check(!state().playing,'candidate switch pauses');
seek(13.98);$('play').click();tick(500);check(state().time===14&&state().drawTime===14&&!state().playing&&state().readHold,'finite shot holds final pose');$('play').click();tick(100);near(state().time,.15,1e-12,'play at end starts a fresh shot');$('restart').click();tick(200);near(state().time,.3,1e-12,'restart respects playback rate');

seek(8.23);$('saveFrame').click();const png=app.pngs.shift();check(png.type==='image/png'&&png.width===1600&&png.height===900,'PNG requests actual canvas size');near(png.state.time,8.23,0,'PNG captures displayed time');
const pngId=png.state.id;select(originals[1].id);const statusBefore=$('status').textContent;png.callback(new Blob(['test-png'],{type:'image/png'}));check(app.downloads.at(-1).filename===`${pngId}-8.23s.png`,'asynchronous PNG keeps original shot identity');check($('status').textContent===statusBefore,'old PNG completion does not overwrite new shot status');pngChecked.push({id:pngId,time:8.23,width:1600,height:900});

$('play').click();tick(93);app.windowEvents.get('document-reader:open')();const reading=state().time;check(!state().playing,'document reader pauses');tick(2000);near(state().time,reading,0,'reader leaves observation frame held');
$('play').click();tick(71);const hiddenFrame=state().drawTime;app.document.hidden=true;app.documentEvents.get('visibilitychange')();check(!state().playing,'background pauses');near(state().time,hiddenFrame,0,'background pause preserves display');tick(1000);near(state().time,hiddenFrame,0,'background does not advance');app.document.hidden=false;app.documentEvents.get('visibilitychange')();tick(50);check(!state().playing,'return remains paused');
$('play').click();tick(79);const beforeHide=state().drawTime;app.windowEvents.get('pagehide')();check(app.frames.size===0,'pagehide cancels RAF');app.windowEvents.get('pageshow')({persisted:true});check(app.frames.size===1,'BFCache restores one RAF');tick(16);near(state().time,beforeHide,0,'BFCache preserves last visible frame');check(!state().playing,'BFCache stays paused');app.windowEvents.get('pageshow')({persisted:true});check(app.frames.size===1,'BFCache cannot duplicate loop');
check(app.timers.every(t=>t.ms===30000),'download URLs survive asynchronous handling');app.timers.forEach(t=>t.fn());check(app.blobs.size===0,'temporary blob URLs are released');

const paths=[scriptPath,htmlPath,resolve(root,'lab/modules/camera-depth.js')];
const report={passed:findings.length===0,checks,drawCount,exportsChecked,pngChecked,findings,
 sourceHashes:Object.fromEntries(paths.map(path=>[relative(root,path).replaceAll('\\','/'),createHash('sha256').update(readFileSync(path)).digest('hex')])),
 verified:['Actual event handlers with real camera-depth samplers','Optical parameter changes reach projection and CoC','Same-time same-camera sharp comparison','Three candidate selection and exact chapter boundaries','Frame stepping, seek, rate changes and finite endpoint hold','Full 30fps JSON including endpoint and units','Displayed-time JSON and async PNG identity','Document reader, background and BFCache pause'],
 notVerified:['Canvas raster appearance or browser layout','Real PNG encoding/download delivery','Path-traced optics or physical lens bokeh','Original reference video or audio review']};
writeFileSync(resolve(root,'qa/camera-depth-studio.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks,drawCount,exports:exportsChecked.length,pngs:pngChecked.length,report:'qa/camera-depth-studio.json'},null,2));
if(findings.length)process.exitCode=1;
