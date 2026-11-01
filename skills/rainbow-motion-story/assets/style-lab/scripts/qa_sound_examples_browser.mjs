import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.argv.find(s=>s.startsWith('--url='))?.slice(6)||'http://localhost:8000';
const req=createRequire(createRequire(import.meta.url)('./shared-runtime.cjs')());
const report={passed:false,checks:[],listeningPerformed:false,scope:'Offline listening-page media decoding, exclusive playback, local links and responsive layout; muted automated playback only.'};
const browser=await req('@remotion/renderer').openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe',logLevel:'error'});
try {
  const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:null,onLog:()=>{}});
  await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
  await page.goto({url:base+'/examples/sound-design/index.html',timeout:30000});
  const initial=await page.evaluate(()=>[...document.querySelectorAll('audio')].map(a=>({paused:a.paused,preload:a.preload,autoplay:a.autoplay})));
  report.checks.push({name:'20 audio samples are opt-in and initially paused',passed:initial.length===20&&initial.every(a=>a.paused&&!a.autoplay&&a.preload==='none')});
  report.media=await page.evaluate(async()=>{
    const rows=[];
    for(const a of document.querySelectorAll('audio')){
      a.muted=true;a.load();
      await new Promise((resolve,reject)=>{
        if(a.readyState>=1)return resolve();
        const timer=setTimeout(()=>reject(Error('metadata timeout')),10000);
        a.addEventListener('loadedmetadata',()=>{clearTimeout(timer);resolve()},{once:true});
        a.addEventListener('error',()=>{clearTimeout(timer);reject(Error(a.error?.message||'audio error'))},{once:true});
      });
      rows.push({file:a.getAttribute('src'),duration:a.duration,error:a.error?.message??null});
    }
    return rows;
  });
  report.checks.push({name:'Every WAV decodes in Chrome',passed:report.media.length===20&&report.media.every(a=>a.duration>0&&!a.error)});
  const playback=await page.evaluate(async()=>{
    const [a,b]=document.querySelectorAll('audio');await a.play();await new Promise(r=>setTimeout(r,220));const firstTime=a.currentTime;await b.play();await new Promise(r=>setTimeout(r,220));const result={firstTime,firstPaused:a.paused,secondTime:b.currentTime,secondPaused:b.paused};b.pause();return result;
  });
  report.checks.push({name:'Playing B pauses A, playback advances',passed:playback.firstTime>.05&&playback.firstPaused&&playback.secondTime>.05&&!playback.secondPaused,...playback});
  const links=await page.evaluate(()=>[...document.querySelectorAll('a')].map(a=>a.href));
  report.links=[];
  for(const href of links){const response=await fetch(href,{method:'HEAD'});report.links.push({href,status:response.status});}
  report.checks.push({name:'All local page, documentation and download links resolve',passed:report.links.every(r=>r.status===200)});
  for(const width of [1440,390]){
    await page.setViewport({width,height:900,deviceScaleFactor:1});
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    report.checks.push({name:`No horizontal overflow at ${width}`,passed:layout.width===layout.scroll,...layout});
    const shot=await page._client().send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(root,`qa/sound-examples-${width}.png`),Buffer.from(shot.value.data,'base64'));
  }
  report.passed=report.checks.every(c=>c.passed);
} catch(error){report.error=String(error);} finally {
  await browser.close({silent:true});
  fs.writeFileSync(path.join(root,'qa/sound-examples-browser.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify({passed:report.passed,checks:report.checks,error:report.error},null,2));if(!report.passed)process.exitCode=1;
