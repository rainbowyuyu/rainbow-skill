/** Execute real workbench handlers with real candidate samplers. Does not rasterize Canvas. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {candidates as originals,SOURCES} from '../lab/modules/mofs-explanation.js';

const root=fileURLToPath(new URL('../',import.meta.url)),scriptPath=resolve(root,'lab/mofs-writing-studio.js'),htmlPath=resolve(root,'lab/mofs-writing.html');
const source=readFileSync(scriptPath,'utf8'),html=readFileSync(htmlPath,'utf8');
let checks=0,drawCount=0;const findings=[],exportsChecked=[],pngChecked=[];
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const near=(a,b,e=1e-9,label='near')=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=e,`${label}: ${a} != ${b}`);
const clone=x=>JSON.parse(JSON.stringify(x));
const storageKey='motion-atelier:mofs-writing:v1';
function boot({saved={},failRead=false,failWrite=false}={}){
  let clock=0,frameId=0,blobId=0;const frames=new Map(),timers=[],blobs=new Map(),downloads=[],pngs=[],windowEvents=new Map(),documentEvents=new Map(),elements=new Map(),nodes=[],drawn=new Map(),storage={...saved};
  const detach=el=>{el.detached=true;el.children.forEach(detach);};
  function element(tag='div',id){
    const classes=new Set(),ctx={id};
    const el={tag,id,dataset:{},style:{},attributes:{},children:[],value:'',textContent:'',
      setAttribute(k,v){this.attributes[k]=String(v);},
      classList:{toggle(name,on){if(on??!classes.has(name))classes.add(name);else classes.delete(name);},contains(name){return classes.has(name);}},
      append(...children){this.children.push(...children);},replaceChildren(...children){this.children.forEach(detach);this.children=[...children];},
      getContext(){return ctx;},
      click(){if(tag==='a')downloads.push({url:this.href,filename:this.download});this.onclick?.();},
      toBlob(callback,type){pngs.push({callback,type,width:this.width,height:this.height,state:clone(drawn.get(id))});},
      querySelector(selector){if(selector==='span')return this.children.find(c=>c.tag==='span');const m=/^\[data-cue="([^"]+)"\]( span)?$/.exec(selector);if(m){const b=this.children.find(c=>c.dataset.cue===m[1]);return m[2]?b?.children.find(c=>c.tag==='span'):b;}throw Error('Unexpected child selector: '+selector);}
    };nodes.push(el);if(id)elements.set(id,el);return el;
  }
  for(const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const el=element(match[1],match[2]);for(const k of ['value','width','height']){const found=new RegExp(`\\b${k}="([^"]*)"`).exec(match[0]);if(found)el[k]=k==='value'?found[1]:Number(found[1]);}}
  for(const match of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const options=[...match[2].matchAll(/<option\b([^>]*)>/g)],selected=options.find(o=>/\bselected\b/.test(o[1]))||options[0];elements.get(match[1]).value=/\bvalue="([^"]+)"/.exec(selected[1])[1];}
  const document={hidden:false,getElementById:id=>elements.get(id)??null,createElement:tag=>element(tag),querySelectorAll:selector=>{const key=/^\[data-(.+)\]$/.exec(selector)?.[1];if(!key)throw Error('Unexpected selector '+selector);return nodes.filter(n=>!n.detached&&key in n.dataset);},addEventListener:(name,fn)=>documentEvents.set(name,fn)};
  const candidates=originals.map(c=>({...c,draw(ctx,time,width,height,options){drawCount++;const record={id:c.id,time,width,height,options:clone(options),state:c.sample(time,options)};drawn.set(ctx.id,record);return record.state;}}));
  const context=vm.createContext({document,window:{addEventListener:(name,fn)=>windowEvents.set(name,fn)},performance:{now:()=>clock},requestAnimationFrame:fn=>{const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},
    localStorage:{getItem:key=>{if(failRead)throw Error('Storage unavailable');return storage[key]??null;},setItem:(key,value)=>{if(failWrite)throw Error('Quota exceeded');storage[key]=value;}},Blob,URL:{createObjectURL:blob=>{const key=`blob:mofs-contract-${++blobId}`;blobs.set(key,blob);return key;},revokeObjectURL:key=>blobs.delete(key)},candidates,SOURCES});
  new vm.Script(source.replace(/^import .*;\r?\n/gm,''),{filename:scriptPath}).runInContext(context);
  const $=id=>elements.get(id),state=()=>JSON.parse($('diagnostics').textContent),tick=ms=>{clock+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(clock));};
  const seek=t=>{$('seek').oninput({target:{value:String(t)}});return state();},select=variant=>document.querySelectorAll('[data-candidate]').find(b=>b.dataset.candidate===`story-mofs-${variant}`).click();
  const edit=words=>{$('draft').onfocus();$('draft').value=words;$('draft').oninput();},key=value=>{let prevented=false;$('scene').onkeydown({code:value===' '?'Space':value,key:value,preventDefault(){prevented=true;}});check(prevented,'keyboard consumes transport');};
  return{$,state,tick,seek,select,edit,key,document,frames,timers,blobs,downloads,pngs,windowEvents,documentEvents,drawn,storage,context};
}
async function exportJSON(app){
  const visible=app.drawn.get('scene');app.$('export').click();const file=app.downloads.at(-1),blob=app.blobs.get(file.url),data=JSON.parse(await blob.text()),original=originals.find(c=>c.id===visible.id);
  check(file.filename===visible.id+'-storyboard.json','JSON named for visible story');near(data.time,visible.time,0,'export follows displayed time');
  check(data.candidateId===visible.id&&data.variant===original.variant&&data.duration===38,'exported story identity and duration');
  check(data.provenance==='original-code-and-script'&&data.timingBasis==='planned'&&data.audio==='not-synthesized'&&data.needsTimingReview,'export marks original planned silent storyboard');
  check(data.cues.length===original.cues.length,'full cue sequence exported');
  for(const [i,cue]of data.cues.entries()){const before=original.cues[i];check(cue.id===before.id&&cue.start===before.start&&cue.end===before.end,'export preserves cue identity/timing');check(cue.originalNarration===before.narration&&typeof cue.userEdited==='boolean','export distinguishes source and edited narration');check(cue.visibleEvidence===before.visibleEvidence&&cue.sceneEvent===before.sceneEvent,'export retains visible causal evidence');equal(cue.sourceIds,before.sourceIds,'cue source references retained');}
  check(data.hasUserEdits===data.cues.some(c=>c.userEdited),'top-level edit flag agrees with cues');
  check(data.pathBase==='motion_atelier-root','exported paths declare base');
  for(const path of [data.code,...data.dependencies,data.guide,data.referenceStudy,data.factSources]){check(!relative(root,resolve(root,path)).startsWith('..'),'exported path inside library');if(!existsSync(resolve(root,path)))findings.push({id:'missing-export-dependency',path});}
  if(data.sourceCatalog){equal(data.sourceCatalog,clone(SOURCES),'export includes exact source catalog');for(const cue of data.cues)for(const id of cue.sourceIds)check(id in data.sourceCatalog,'export source IDs self-resolve');}
  else findings.push({id:'missing-source-catalog'});
  exportsChecked.push({id:data.candidateId,time:data.time,edited:data.hasUserEdits,bytes:blob.size});return data;
}

const app=boot(),{$,state,tick,seek,select,edit,key}=app;
check(state().id==='story-mofs-result'&&!state().playing&&state().time===0,'paused original result opening');check(app.frames.size===1,'one RAF');near(state().speed,Number($('speed').value));
for(const t of [0,4.8,9.705,12,24,24.5,27.4,35.2,38])for(const variant of ['build','predict','result']){
  seek(t);select(variant);near(state().time,t,0,'variant change preserves exact instant');near(app.drawn.get('scene').time,t,0,'draw uses same preserved instant');
  const c=originals.find(c=>c.id===state().id),s=c.sample(t),cue=s.activeCue;
  check(state().cueId===cue.id&&state().stageIndex===s.stageIndex,'stage/cue diagnostics match actual sampler');
  check($('question').textContent===cue.question&&$('narration').textContent===(cue.narration||'留白，让观众观察画面。'),'question/narration synchronized');
  check($('screenText').textContent===cue.screenText&&$('evidence').textContent===cue.visibleEvidence,'screen text and evidence synchronize');
  check($('draft').value===cue.narration,'editor follows exact current sentence');
  check(app.document.querySelectorAll('[data-cue]').length===c.cues.length&&app.document.querySelectorAll('[data-stage]').length===c.cues.length,'switch replaces cue and stage buttons');
  check($('candidateLink').href.endsWith('#'+c.id),'library link follows active variant');
  for(const button of app.document.querySelectorAll('[data-cue]'))check(button.attributes['aria-pressed']===String(button.dataset.cue===cue.id),'current cue pressed state');
}

for(const variant of ['result','build','predict']){select(variant);const c=originals.find(c=>c.id===state().id);for(const [index,button]of app.document.querySelectorAll('[data-cue]').entries()){button.click();near(state().time,c.cues[index].start,0,'sentence click seeks exact cue start');check(state().cueId===c.cues[index].id&&!state().playing,'sentence locator pauses and selects intended cue');}for(const [index,button]of app.document.querySelectorAll('[data-stage]').entries()){button.click();near(state().time,c.stageTimes[index],0,'chapter follows same cue boundary');}}

select('result');seek(12.123);edit('先看这些连接点，再沿着连杆找过去。');
check(state().hasDraft&&$('narration').textContent==='先看这些连接点，再沿着连杆找过去。','edit updates current visible narration');
check($('cueKind').textContent==='你的改写 · 待校时'&&$('draftStatus').textContent.includes('本机改写'),'edited status and timing qualification');
check(JSON.parse(app.storage[storageKey])['story-mofs-result/result-components']===$('draft').value,'draft persists under candidate/cue identity');
let data=await exportJSON(app);check(data.cues.find(c=>c.id==='result-components').narration===$('draft').value&&data.cues.find(c=>c.id==='result-components').userEdited,'JSON includes real edit');
select('build');seek(12.123);check(!state().hasDraft,'same-time different candidate has independent draft');select('result');check(state().hasDraft&&$('draft').value==='先看这些连接点，再沿着连杆找过去。','switch retains candidate-specific edit');
const reloaded=boot({saved:app.storage});reloaded.seek(12.123);check(reloaded.$('draft').value===$('draft').value&&reloaded.state().hasDraft,'storage reload restores edit');
reloaded.$('resetDraft').click();check(!reloaded.state().hasDraft&&reloaded.$('draft').value===originals[0].sample(12.123).activeCue.narration,'restore returns original narration');check(!('story-mofs-result/result-components' in JSON.parse(reloaded.storage[storageKey])),'restore removes stored override');
edit('');check(state().hasDraft&&$('narration').classList.contains('silent'),'empty edited narration becomes intentional silence');
check(app.document.querySelectorAll('[data-cue]').find(b=>b.dataset.cue==='result-components').classList.contains('silent'),'edited empty sentence list becomes silent');
data=await exportJSON(app);check(data.cues.find(c=>c.id==='result-components').narration===''&&data.cues.find(c=>c.id==='result-components').userEdited,'empty edit survives export without falling back');
$('resetDraft').click();check(!state().hasDraft&&!$('narration').classList.contains('silent'),'restore clears local override and silence');
seek(24.2);edit('小球已经通过。');check(!app.document.querySelectorAll('[data-cue]').find(b=>b.dataset.cue==='result-pass-result').classList.contains('silent'),'adding speech to silent cue updates list style');$('resetDraft').click();

// Storage failures keep the active editing session usable and exportable.
for(const saved of [{[storageKey]:'{invalid'}, {[storageKey]:'[]'}, {[storageKey]:'null'}, {[storageKey]:JSON.stringify({'story-mofs-result/result-hook':123,unrelated:false})}]){const recovery=boot({saved});check(recovery.state().id==='story-mofs-result'&&!recovery.state().hasDraft,'malformed or unsupported storage recovers original');}
const blocked=boot({failRead:true,failWrite:true});blocked.edit('让观众先看清两颗球的位置。');check(blocked.state().hasDraft&&blocked.$('status').textContent.includes('导出 JSON'),'storage error explains export fallback');data=await exportJSON(blocked);check(data.cues[0].narration==='让观众先看清两颗球的位置。'&&data.cues[0].userEdited,'unsaved in-memory edit exports fully');
const blockedRestore=boot({saved:{[storageKey]:JSON.stringify({'story-mofs-result/result-hook':'保留在磁盘的旧改写。'})},failWrite:true});blockedRestore.$('resetDraft').click();check(!blockedRestore.state().hasDraft&&blockedRestore.$('draft').value===originals[0].cues[0].narration,'restore keeps original in session even if persistence fails');check(blockedRestore.$('status').textContent.includes('导出 JSON'),'failed restore persistence keeps its warning after refresh');check(JSON.parse(blockedRestore.storage[storageKey])['story-mofs-result/result-hook']==='保留在磁盘的旧改写。','failed persistence does not pretend old saved draft changed');

// Pause and export always refer to the frame actually displayed.
select('predict');seek(10.499);key(' ');tick(17);check(state().playing,'space starts');near(state().drawTime,Math.floor(state().time*30)/30,0,'playback is quantized to 30 fps');
await exportJSON(app);const beforePause=app.drawn.get('scene').time;$('play').click();near(state().time,beforePause,0,'pause freezes displayed instant');tick(800);near(state().time,beforePause,0,'pause stays fixed');
seek(5);$('next').click();near(state().time,5+1/30);$('prev').click();near(state().time,5);key('ArrowRight');near(state().time,5+1/30);key('ArrowLeft');near(state().time,5);
for(const t of [-5,NaN,38,99]){seek(t);near(state().time,Number.isNaN(t)?0:Math.max(0,Math.min(38,t)),0,'seek bounds');}
seek(3.2);$('speed').value='0.5';$('speed').onchange({target:{value:'0.5'}});$('play').click();tick(1000);near(state().time,3.7,1e-12,'half speed');$('speed').value='1.5';$('speed').onchange({target:{value:'1.5'}});tick(1000);near(state().time,5.2,1e-12,'speed changes continuously');
const beforeSwitch=state().drawTime;select('build');near(state().time,beforeSwitch,0,'switch during playback preserves visible moment');check(!state().playing,'switch pauses');
seek(37.98);$('play').click();tick(500);check(state().time===38&&state().drawTime===38&&!state().playing&&state().readHold,'terminal frame is held');$('play').click();tick(100);near(state().time,.15,1e-12,'play from end restarts');$('restart').click();tick(200);near(state().time,.3,1e-12,'restart honors playback rate');

seek(27.4);$('saveFrame').click();const png=app.pngs.shift();check(png.type==='image/png'&&png.width===1600&&png.height===900,'PNG uses actual scene dimensions');check(png.state.id==='story-mofs-build'&&png.state.time===27.4,'PNG capture matches visible candidate and instant');select('result');const oldStatus=$('status').textContent;png.callback(new Blob(['png'],{type:'image/png'}));check(app.downloads.at(-1).filename==='story-mofs-build-27.40s.png','PNG async name retains capture identity');check($('status').textContent===oldStatus,'old PNG callback does not overwrite another candidate status');pngChecked.push({id:png.state.id,time:png.state.time,width:png.width,height:png.height});
seek(24.3);$('saveFrame').click();const current=app.pngs.shift();current.callback(new Blob(['png'],{type:'image/png'}));check($('status').textContent==='已保存当前画面。','current PNG completion status');

$('play').click();tick(93);app.windowEvents.get('document-reader:open')();const reading=state().time;check(!state().playing,'reader open pauses');tick(2000);near(state().time,reading,0,'reader leaves frame held');
$('play').click();tick(71);const hiddenFrame=state().drawTime;app.document.hidden=true;app.documentEvents.get('visibilitychange')();check(!state().playing,'hidden page pauses');near(state().time,hiddenFrame,0,'hidden pause keeps displayed frame');tick(1000);near(state().time,hiddenFrame,0,'hidden page does not drift');app.document.hidden=false;app.documentEvents.get('visibilitychange')();tick(50);check(!state().playing,'return stays paused');
$('play').click();tick(79);const beforeHide=state().drawTime;app.windowEvents.get('pagehide')();check(app.frames.size===0,'pagehide cancels RAF');app.windowEvents.get('pageshow')({persisted:true});check(app.frames.size===1,'BFCache restores one RAF');tick(16);near(state().time,beforeHide,0,'BFCache restores visible time');check(!state().playing,'BFCache stays paused');app.windowEvents.get('pageshow')({persisted:true});check(app.frames.size===1,'repeated BFCache restore does not duplicate loop');
await exportJSON(app);check(app.timers.every(t=>t.ms===30000),'download URLs retained for async handling');app.timers.forEach(t=>t.fn());check(app.blobs.size===0,'temporary URLs can all be released');

const report={passed:findings.length===0,checks,drawCount,exportsChecked,pngChecked,findings,
  sourceHashes:Object.fromEntries([scriptPath,htmlPath].map(path=>[relative(root,path).replaceAll('\\','/'),createHash('sha256').update(readFileSync(path)).digest('hex')])),
  verified:['Actual event handlers with real candidate samplers','Same-time three-story switch','Cue and chapter location at exact boundaries','Current sentence editing, intentional silence and reset','Candidate/cue draft identity and storage reload','Malformed/unavailable storage recovery and export fallback','Full JSON with source narration and edited flags','Visible-time JSON and PNG capture identity','Seek, frame keys, rate changes and finite ending','Reader, hidden page and BFCache pause'],
  notVerified:['Browser raster appearance','Real PNG encoding and download delivery','Natural speech or TTS alignment','Subjective original audio listening']};
writeFileSync(resolve(root,'qa/mofs-writing-studio.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(findings.length)process.exitCode=1;
