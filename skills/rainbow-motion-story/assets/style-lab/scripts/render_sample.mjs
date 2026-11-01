// Exports the actual absolute-time canvas frames to FFmpeg, without an intermediate image sequence.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const opt=(k,d)=>process.argv.find(s=>s.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const resolveShared=createRequire(import.meta.url)('./shared-runtime.cjs');
const deps=resolveShared(opt('dependencies',null));
const require=createRequire(deps);
const {openBrowser}=require('@remotion/renderer');
const width=Number(opt('width','1280')),height=Math.round(width*9/16/2)*2,fps=Number(opt('fps','30'));
const id=opt('id',''),out=path.resolve(opt('output',path.join(root,'qa','sample.mp4'))),url=opt('url','http://localhost:8000/');
if(!id)throw Error('Provide --id=<candidate-id>');
fs.mkdirSync(path.dirname(out),{recursive:true});
if(fs.existsSync(out))throw Error('Output exists: choose a new path');
const browser=await openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe',logLevel:'error'});
let ff;
try{
 const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:()=>{},onLog:()=>{}});
 await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});await page.goto({url,timeout:30000});
 const duration=await page.evaluate(async(id)=>{await document.fonts.ready;const c=window.styleLab.candidates.find(c=>c.id===id);if(!c)throw Error('Unknown candidate: '+id);return c.duration},id);
 const seconds=Math.min(duration,Number(opt('seconds',String(duration)))),frames=Math.round(seconds*fps);
 ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-n','-f','image2pipe','-vcodec','png','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',out],{stdio:['pipe','ignore','pipe']});
 let error='';ff.stderr.on('data',b=>error+=b);ff.on('error',e=>error+=e.message);const completion=once(ff,'close');
 for(let f=0;f<frames;f++){
  const png=await page.evaluate((id,t,w,h)=>{const c=window.styleLab.candidates.find(x=>x.id===id);const cv=document.createElement('canvas');cv.width=w;cv.height=h;c.draw(cv.getContext('2d'),t,w,h,{intensity:.7,palette:'titanium'});return cv.toDataURL('image/png').split(',')[1]},id,f/fps,width,height);
  if(!ff.stdin.write(Buffer.from(png,'base64')))await once(ff.stdin,'drain');
 }
 ff.stdin.end();const [code]=await completion;if(code!==0)throw Error(error);
 fs.writeFileSync(out+'.json',JSON.stringify({id,width,height,fps,frames,duration:frames/fps,audio:false,method:'absolute-time frames; no real-time capture',source:fs.realpathSync(path.join(root,'lab/modules'))},null,2));
 console.log(JSON.stringify({out,frames,width,height,fps}));
}finally{await browser.close({silent:true});if(ff&&!ff.killed&&ff.exitCode===null)ff.kill()}
