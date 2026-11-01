import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const req=createRequire(createRequire(import.meta.url)('./shared-runtime.cjs')(process.argv.find(s=>s.startsWith('--dependencies='))?.slice(15)));
const base=process.argv.find(s=>s.startsWith('--url='))?.slice(6)||'http://localhost:8000';
const browser=await req('@remotion/renderer').openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe',logLevel:'error'});
const errors=[],report={checks:[],viewports:[],exports:[],links:[],subjectiveListening:false,notice:'Browser timing/UI/export checks; no human listening or intelligibility claim.',errors};
const add=(name,passed,details={})=>report.checks.push({name,passed,...details});
try{
  const p=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:l=>{if(l.type==='error')errors.push(l.text)},onLog:()=>{}});
  await p.setViewport({width:1600,height:1050,deviceScaleFactor:1});await p.goto({url:base+'/lab/sound-design.html',timeout:30000});
  await p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<30&&!window.soundDesignLab;i++)await new Promise(r=>setTimeout(r,100));});
  const state=()=>p.evaluate(()=>window.soundDesignLab.getState());
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  async function click(selector){const pos=await p.evaluate(sel=>{const e=document.querySelector(sel);if(!e)throw Error('Missing '+sel);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}},selector);await p._client().send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});await p._client().send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos});}
  async function input(selector,value,type='input'){await p.evaluate((sel,val,event)=>{const e=document.querySelector(sel);e.value=val;e.dispatchEvent(new Event(event,{bubbles:true}));},selector,String(value),type);}
  async function ready(){return p.evaluate(async()=>{for(let i=0;i<80;i++){const s=window.soundDesignLab.getState();if(s.playing&&!s.pending)return s;await new Promise(r=>setTimeout(r,50));}throw Error('playback did not start');});}
  async function screenshot(name){await p.evaluate(()=>scrollTo(0,0));const size=await p.evaluate(()=>({width:innerWidth,height:document.documentElement.scrollHeight}));const r=await p._client().send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,...size,scale:1}});fs.writeFileSync(path.join(root,'qa',name),Buffer.from(r.value.data,'base64'));}
  const initial=await state();add('No autoplay and no AudioContext before interaction',initial.audioState==='not-created'&&!initial.playing&&initial.time===0,initial);
  add('Five semantic scene choices',await p.evaluate(()=>document.querySelectorAll('.scene-button').length===5));
  // Muted tests inspect the real Web Audio clock; they are not listening tests.
  await click('#muteButton');await click('#playButton');await ready();await delay(450);const moving=await state();
  add('Explicit play advances AudioContext clock while muted',moving.audioState==='running'&&moving.playing&&moving.muted&&moving.masterGain===0&&moving.time>.2,moving);
  await click('#playButton');const paused=await state();await delay(180);const held=await state();add('Pause holds the scene clock',!held.playing&&Math.abs(held.time-paused.time)<.0001);
  await input('#seekInput',2.35);const at=await state();const pixelsBefore=await p.evaluate(()=>document.querySelector('#sceneCanvas').toDataURL());await click('#variantA');const ab=await state();const pixelsAfter=await p.evaluate(()=>document.querySelector('#sceneCanvas').toDataURL());
  add('A/B preserves exact visual frame and timeline',ab.variant==='A'&&Math.abs(at.time-ab.time)<.0001&&pixelsBefore===pixelsAfter);
  await click('#variantB');await input('#offsetMs',125,'change');const offsets=await p.evaluate(()=>({state:window.soundDesignLab.getState(),frames:document.querySelector('#offsetFrames').value,plan:window.soundDesignLab.getExport()}));
  add('125 ms shifts only SFX and converts to 3.75 frames',offsets.state.offsetMs===125&&Number(offsets.frames)===3.75&&offsets.plan.cues.filter(c=>c.eventId).every(c=>Math.abs(c.designSyncDelta-.125)<1e-8));
  await input('#fpsSelect',60,'change');await input('#offsetFrames',-6,'change');const frameOffset=await state();add('Frame offset converts back through selected fps',frameOffset.fps===60&&frameOffset.offsetMs===-100);
  await click('#offsetReset');await input('#intensityInput',.6);await input('#gainInput',-6);const gain=await state();add('Intensity and common gain are applied',gain.intensity===.6&&gain.gainDb===-6&&gain.offsetMs===0);
  await input('#speedSelect',1.5,'change');await input('#seekInput',.5);await click('#playButton');await ready();await delay(100);const fast0=await state();await delay(450);const fast1=await state();
  add('Playback rate follows the audio clock',Math.abs((fast1.time-fast0.time)-(fast1.audioTime-fast0.audioTime)*1.5)<.03,{deltaScene:fast1.time-fast0.time,deltaAudio:fast1.audioTime-fast0.audioTime});
  await click('#variantA');await ready();const switchA=await state();await click('#variantB');await ready();const switchB=await state();add('A/B change during playback resumes at retained time',switchA.playing&&switchB.playing&&switchB.time>=switchA.time-.04&&switchB.time-switchA.time<1);
  // Rapid range-input changes cancel stale buffers without losing play intent.
  await p.evaluate(()=>{const e=document.querySelector('#gainInput');for(const v of [-8,-7,-6,-5]){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}});await ready();const rapid=await state();add('Rapid parameter edits retain playback and last value',rapid.playing&&rapid.gainDb===-5&&rapid.cacheEntries<=4);
  await click('#stopButton');const stopped=await state();add('Stop resets time and leaves no active playback',!stopped.playing&&!stopped.pending&&stopped.time===0);
  await click('#replayButton');await ready();await delay(180);const replay=await state();add('Replay starts from zero',replay.playing&&replay.time>.05&&replay.time<1);await click('#stopButton');
  const sceneResults=[];
  for(const id of ['contact-sync','cue-density','tail-control','velocity-mapping','narration-space']){
    await click(`[data-scene="${id}"]`);await input('#seekInput',3.25);const result=await p.evaluate(()=>({id:window.soundDesignLab.getState().sceneId,title:document.querySelector('#sceneTitle').textContent,visual:window.soundDesignLab.getVisual(),rows:document.querySelectorAll('#eventRows tr').length,alpha:document.querySelector('#sceneCanvas').getContext('2d').getImageData(600,300,1,1).data[3]}));sceneResults.push(result);
  }
  add('All five scenes draw and expose their current cue rows',sceneResults.length===5&&sceneResults.every(r=>r.rows>0&&r.alpha===255&&r.visual.time===3.25),{scenes:sceneResults.map(r=>({id:r.id,rows:r.rows,title:r.title}))});
  await click('#placeholderInput');add('Synthetic narration placeholder is optional and explicitly enabled',await p.evaluate(()=>window.soundDesignLab.getExport().options.includeSpeechPlaceholder));
  await click('#resetButton');const reset=await state();add('Reset restores SFX options without changing scene time',reset.offsetMs===0&&reset.intensity===1&&reset.gainDb===0&&!reset.includeSpeechPlaceholder&&reset.time===3.25);
  await p.evaluate(()=>document.querySelector('#sceneCanvas').focus());await p._client().send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await p._client().send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});const keyStep=await state();add('Canvas arrow key steps by one selected frame',Math.abs(keyStep.time-3.25-1/60)<.0001);
  const hit=await p.evaluate(()=>{const e=document.querySelector('#timelineCanvas');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width*(105+1055*.75)/1200,y:r.top+r.height*.5}});await p._client().send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...hit});await p._client().send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...hit});const seekHit=await state();add('Clicking timeline seeks to intended second',Math.abs(seekHit.time-6)<.015);
  // Capture exact Blob payloads at browser download boundary; avoids disk copies.
  await p.evaluate(()=>{window.__downloads=[];const blobs=new Map(),original=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=original(blob);blobs.set(url,blob);return url;};HTMLAnchorElement.prototype.click=function(){if(this.download&&blobs.has(this.href)){window.__downloads.push({name:this.download,blob:blobs.get(this.href)});return;}throw Error('Unexpected download target');};});
  await click('#exportButton');await click('#wavButton');
  const exported=await p.evaluate(async()=>{for(let i=0;i<80&&window.__downloads.length<2;i++)await new Promise(r=>setTimeout(r,50));const out=[];for(const d of window.__downloads){if(d.name.endsWith('.json')){out.push({name:d.name,size:d.blob.size,data:JSON.parse(await d.blob.text())});}else{const b=await d.blob.arrayBuffer(),v=new DataView(b),s=new TextDecoder().decode(b.slice(0,12));out.push({name:d.name,size:b.byteLength,signature:s,channels:v.getUint16(22,true),sampleRate:v.getUint32(24,true),bits:v.getUint16(34,true),dataSize:v.getUint32(40,true)});}}return out;});
  report.exports=exported;const json=exported.find(e=>e.data),wav=exported.find(e=>e.sampleRate);add('JSON exports current plan and separate audition preferences',json?.data.schema==='motion-atelier.sound-design/v1'&&json.data.sceneId==='narration-space'&&json.data.cues.length>0&&json.data.playbackOnly.speed===1.5);
  add('WAV exports exact 8 seconds of original-speed 48 kHz stereo PCM',wav?.sampleRate===48000&&wav.channels===2&&wav.bits===16&&wav.dataSize===48000*8*4&&wav.size===44+wav.dataSize&&wav.signature.startsWith('RIFF')&&wav.signature.endsWith('WAVE'));
  const contact=await p.evaluate(()=>{
    const stages={'contact-sync':[1.5,2.15,4.9],'cue-density':[1.6,4.5,6.65],'tail-control':[1.4,1.8,3.2],'velocity-mapping':[1.1,2.3,5.4],'narration-space':[1.9,3.2,4.9]};
    const sheet=document.createElement('canvas');sheet.width=1440;sheet.height=1400;const c=sheet.getContext('2d');let row=0;
    for(const [id,times] of Object.entries(stages)){
      document.querySelector(`[data-scene="${id}"]`).click();
      times.forEach((time,column)=>{const seek=document.querySelector('#seekInput');seek.value=time;seek.dispatchEvent(new Event('input',{bubbles:true}));c.drawImage(document.querySelector('#sceneCanvas'),column*480,row*280,480,256);c.fillStyle='#101b24';c.fillRect(column*480,row*280+256,480,24);c.fillStyle='#e8e4d9';c.font='13px monospace';c.fillText(`${id} / ${time.toFixed(2)}s`,column*480+10,row*280+273);});row++;
    }
    document.querySelector('[data-scene="contact-sync"]').click();const seek=document.querySelector('#seekInput');seek.value=2.15;seek.dispatchEvent(new Event('input',{bubbles:true}));return sheet.toDataURL().split(',')[1];
  });fs.writeFileSync(path.join(root,'qa/sound-design-contact.png'),Buffer.from(contact,'base64'));
  // Allow the transient export toast to dismiss before UI documentation shots.
  await delay(3300);
  for(const width of [1600,1000,390]){
    await p.setViewport({width,height:width===390?844:1050,deviceScaleFactor:1});const size=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,sceneRailHeight:document.querySelector('#sceneList').getBoundingClientRect().height,broken:[...document.images].filter(im=>!im.complete||!im.naturalWidth).map(im=>im.src)}));report.viewports.push({...size,passed:size.width>=size.scrollWidth&&size.broken.length===0&&(width>760||size.sceneRailHeight<120)});if(width!==1000)await screenshot(`sound-design-${width}.png`);
  }
  for(const href of await p.evaluate(()=>[...document.querySelectorAll('a')].map(a=>a.href).filter(v=>!v.includes('#')))){const r=await fetch(href,{method:'HEAD'});report.links.push({href,status:r.status});}
  add('Workbench navigation and source links resolve',report.links.every(l=>l.status===200));
  report.passed=report.checks.every(c=>c.passed)&&report.viewports.every(v=>v.passed)&&errors.length===0;
}catch(error){report.passed=false;errors.push(String(error));}finally{await browser.close({silent:true});fs.writeFileSync(path.join(root,'qa/sound-design-browser.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,checks:report.checks,viewports:report.viewports,links:report.links,errors},null,2));if(!report.passed)process.exitCode=1;
