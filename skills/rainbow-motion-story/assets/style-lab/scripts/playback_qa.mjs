import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'qa/playback');fs.mkdirSync(dir,{recursive:true});
const require=createRequire(createRequire(import.meta.url)('./shared-runtime.cjs')(process.argv.find(s=>s.startsWith('--dependencies='))?.slice(15)));
const browser=await require('@remotion/renderer').openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe',logLevel:'error'});
const base=process.argv.find(s=>s.startsWith('--url='))?.slice(6)||'http://localhost:8000';
const only=process.argv.find(s=>s.startsWith('--ids='))?.slice(6).split(',');
const sourceFingerprint=crypto.createHash('sha256').update(fs.readdirSync(path.join(root,'lab/modules')).filter(n=>n.endsWith('.js')).sort().map(n=>fs.readFileSync(path.join(root,'lab/modules',n))).reduce((a,b)=>Buffer.concat([a,b]),Buffer.alloc(0))).digest('hex');
const report=only&&fs.existsSync(path.join(dir,'manifest.json'))?JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')).filter(r=>!only.includes(r.id)):[];
try{
 const p=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:()=>{},onLog:()=>{}});
 await p.setViewport({width:1500,height:1000,deviceScaleFactor:1});await p.goto({url:base+'/lab/',timeout:30000});
 const items=(await p.evaluate(()=>window.styleLab.candidates.map(c=>({id:c.id,duration:c.duration})))).filter(i=>!only||only.includes(i.id));
 for(const item of items){
  const observed=await p.evaluate(async({id,duration})=>{
   window.styleLab.select(id);window.styleLab.seek(0);window.styleLab.setPlaying(true);
   const start=performance.now(),samples=[],cv=document.createElement('canvas');cv.width=1600;cv.height=200*Math.ceil(duration/5);const ctx=cv.getContext('2d');let last=-1;
   while((performance.now()-start)/1000<duration-.1){
    const state=window.styleLab.getState(),second=Math.floor(state.t);
    if(second>last){last=second;const n=samples.length,x=n%5*320,y=Math.floor(n/5)*200;ctx.drawImage(document.querySelector('#stageA'),x,y,320,180);ctx.fillStyle='#101d27';ctx.fillRect(x,y+180,320,20);ctx.fillStyle='#dfe7ee';ctx.font='11px monospace';ctx.fillText(state.t.toFixed(3)+'s / '+id,x+6,y+194);samples.push({canvasTime:state.t,wallTime:(performance.now()-start)/1000})}
    await new Promise(r=>setTimeout(r,70));
   }
   const state=window.styleLab.getState();window.styleLab.setPlaying(false);return{elapsed:(performance.now()-start)/1000,end:state.t,samples,png:cv.toDataURL().split(',')[1]};
  },item);
  fs.writeFileSync(path.join(dir,item.id+'.png'),Buffer.from(observed.png,'base64'));delete observed.png;report.push({...item,...observed,sourceFingerprint,muted:true,mode:'real-time canvas playback with one-second visual sampling'});fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(report,null,2));console.log(item.id+' '+observed.elapsed.toFixed(2)+'s; content '+Math.max(...observed.samples.map(s=>s.canvasTime)).toFixed(2)+'s');
 }
}finally{await browser.close({silent:true})}
