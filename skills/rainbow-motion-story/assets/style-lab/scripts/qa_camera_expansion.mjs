import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const req=createRequire(createRequire(import.meta.url)('./shared-runtime.cjs')());
const base=process.argv.find(a=>a.startsWith('--url='))?.slice(6)||'http://localhost:8000';
const browser=await req('@remotion/renderer').openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe',logLevel:'error'});
const ids=['camera-fpv-slalom','camera-fpv-dive','camera-first-person','camera-soul-drift','camera-bullet-time','camera-hitchcock-zoom'];
const report={base,checks:[],errors:[],candidates:[]};
try{
 const p=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:l=>{if(l.type==='error')report.errors.push(l.text)},onLog:()=>{}});
 await p.setViewport({width:1600,height:1050,deviceScaleFactor:1});await p.goto({url:base+'/lab/',timeout:30000});
 await p.evaluate(async()=>document.fonts.ready);
 for(const id of ids){
  const result=await p.evaluate(id=>{
   const lab=window.styleLab,c=lab.candidates.find(c=>c.id===id);lab.select(id);lab.setPlaying(false);
   const chapters=[...document.querySelectorAll('#stageChapters button')].map((b,i)=>{b.click();return{time:lab.getState().t,expected:c.stageTimes[i],label:b.textContent}});
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');
   const times=[...new Set([0,...c.stageTimes.flatMap(t=>[Math.max(0,t-1/30),t,Math.min(c.duration,t+1/30)]),c.duration])].sort((a,b)=>a-b);
   const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=Math.ceil(times.length/4)*200;const sx=sheet.getContext('2d');let repeat=true;
   times.forEach((t,i)=>{c.draw(ctx,t,640,360,{intensity:.7});const a=canvas.toDataURL();c.draw(ctx,c.duration-t,640,360,{intensity:.7});c.draw(ctx,t,640,360,{intensity:.7});repeat&&=a===canvas.toDataURL();const x=(i%4)*320,y=Math.floor(i/4)*200;sx.drawImage(canvas,x,y,320,180);sx.fillStyle='#101923';sx.fillRect(x,y+180,320,20);sx.fillStyle='#eff1ed';sx.font='11px sans-serif';sx.fillText(t.toFixed(3)+' s · '+id,x+6,y+194)});
   c.draw(ctx,c.previewTime??c.duration*.55,640,360,{intensity:.7});
   return{id,loop:c.loop!==false,chapters,repeat,times,sheet:sheet.toDataURL().split(',')[1]};
  },id);
  fs.mkdirSync(path.join(root,'qa/camera-expansion'),{recursive:true});fs.writeFileSync(path.join(root,'qa/camera-expansion',id+'.png'),Buffer.from(result.sheet,'base64'));delete result.sheet;
  report.candidates.push(result);
  if(!result.loop){
   await p.evaluate(()=>{const l=window.styleLab,c=l.candidates.find(c=>c.id===l.getState().id);l.seek(c.duration-.05);l.setPlaying(true)});
   await new Promise(r=>setTimeout(r,450));
   const held=await p.evaluate(()=>window.styleLab.getState());
   await p.evaluate(()=>window.styleLab.setPlaying(true));
   const restarted=await p.evaluate(()=>window.styleLab.getState());await p.evaluate(()=>window.styleLab.setPlaying(false));
   report.checks.push({name:id+' holds at end / explicitly restarts',passed:held.t===12&&!held.playing&&restarted.t<.5&&restarted.playing});
  }
 }
 report.checks.push({name:'six clips / exact stage navigation / reverse-seek pixels',passed:report.candidates.length===6&&report.candidates.every(c=>c.repeat&&c.chapters.length>=4&&c.chapters.every(b=>b.time===b.expected))});
 for(const [button,part]of [['cameraResearch','世界'],['scriptGuide',''],['typeGuide','']]){
  await p.evaluate(button=>document.getElementById(button).click(),button);
  const found=await p.evaluate(async part=>{for(let n=0;n<60;n++){const d=document.querySelector('#studyDialog'),content=document.querySelector('#studyContent').textContent;if(d.open&&content.length>200)return{ok:content.includes(part),chars:content.length};await new Promise(r=>setTimeout(r,50))}return{ok:false}},part);
  report.checks.push({name:button+' guide loads',passed:found.ok,...found});await p.evaluate(()=>document.querySelector('#studyDialog').close());
 }
 report.passed=report.checks.every(c=>c.passed)&&report.errors.length===0;
}catch(e){report.errors.push(String(e));report.passed=false}finally{await browser.close({silent:true});fs.writeFileSync(path.join(root,'qa/camera-expansion.json'),JSON.stringify(report,null,2))}
console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors:report.errors},null,2));if(!report.passed)process.exitCode=1;
