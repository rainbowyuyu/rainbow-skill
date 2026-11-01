import {createRequire}from'node:module';import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const req=createRequire(createRequire(import.meta.url)('./shared-runtime.cjs')(process.argv.find(s=>s.startsWith('--dependencies='))?.slice(15)));
const base=process.argv.find(s=>s.startsWith('--url='))?.slice(6)||'http://localhost:8000';
const browser=await req('@remotion/renderer').openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe',logLevel:'error'});
const report={checks:[],listening:false};
try{
 const p=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:null,onLog:()=>{}});
 await p.setViewport({width:1280,height:900,deviceScaleFactor:1});await p.goto({url:base+'/examples/audio/index.html',timeout:30000});
 report.media=await p.evaluate(async()=>{const result=[];for(const v of document.querySelectorAll('audio')){v.preload='auto';v.load();await new Promise((resolve,reject)=>{if(v.readyState>=1)return resolve();v.addEventListener('loadedmetadata',resolve,{once:true});v.addEventListener('error',()=>reject(Error(v.error.message)),{once:true});setTimeout(()=>reject(Error('metadata timeout')),10000)});v.muted=true;await v.play();await new Promise(r=>setTimeout(r,240));v.pause();result.push({src:v.currentSrc,duration:v.duration,time:v.currentTime,error:v.error?.message??null,muted:v.muted});}return result});
 report.checks.push({name:'Four local WAV files load and advance at 1x muted',passed:report.media.length===4&&report.media.every(m=>m.duration===10&&m.time>.1&&!m.error)});
 report.links=[];for(const href of await p.evaluate(()=>[...document.querySelectorAll('a')].map(a=>a.href))){const r=await fetch(href,{method:'HEAD'});report.links.push({href,status:r.status})}
 report.checks.push({name:'All listening-page links resolve',passed:report.links.every(l=>l.status===200)});
 await p.setViewport({width:390,height:844,deviceScaleFactor:1});
 const size=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));report.checks.push({name:'Mobile page has no horizontal overflow',passed:size.width===size.scrollWidth});
 const shot=await p._client().send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:size.width,height:size.height,scale:1}});fs.writeFileSync(path.join(root,'qa/audio-page-mobile.png'),Buffer.from(shot.value.data,'base64'));
 report.passed=report.checks.every(c=>c.passed);
}catch(e){report.passed=false;report.error=String(e)}finally{await browser.close({silent:true});fs.writeFileSync(path.join(root,'qa/audio-browser.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
