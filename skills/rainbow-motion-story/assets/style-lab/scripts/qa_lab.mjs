import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'qa');
const req=createRequire(createRequire(import.meta.url)('./shared-runtime.cjs')(process.argv.find(s=>s.startsWith('--dependencies='))?.slice(15)));
const {openBrowser}=req('@remotion/renderer');
fs.mkdirSync(out,{recursive:true});
const browser=await openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe',logLevel:'error'});
const base=process.argv.find(s=>s.startsWith('--url='))?.slice(6)||'http://localhost:8000';
const errors=[],report={checks:[],render:[],viewports:[],downloads:[],errors};
try{
const p=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:l=>{if(l.type==='error')errors.push(l.text)},onLog:()=>{}});
await p.setViewport({width:1600,height:1050,deviceScaleFactor:1});await p.goto({url:base+'/',timeout:30000});
await p.evaluate(async()=>{await document.fonts.ready});
const render=await p.evaluate(()=>{
 const all=window.styleLab.candidates,result=[],sheets={};
 for(const mod of new Set(all.map(c=>c.module))){
  const subset=all.filter(c=>c.module===mod),sheet=document.createElement('canvas');sheet.width=1280;sheet.height=204*subset.length;const sx=sheet.getContext('2d');
  subset.forEach((c,row)=>{
   const cv=document.createElement('canvas');cv.width=640;cv.height=360;const ctx=cv.getContext('2d');let finite=true,samples=[];
   for(let f=0;f<=120;f++){const state=c.sample(c.duration*f/120,{intensity:.7,palette:'titanium'});const visit=v=>{if(typeof v==='number'&&!Number.isFinite(v))finite=false;else if(v&&typeof v==='object')Object.values(v).forEach(visit)};visit(state)}
   let repeat=true;
   for(const [col,q]of [.08,.35,.65,.9].entries()){
    const t=c.duration*q;c.draw(ctx,t,640,360,{intensity:.7,palette:'titanium'});const a=cv.toDataURL();c.draw(ctx,c.duration*(1-q),640,360,{intensity:.7,palette:'titanium'});c.draw(ctx,t,640,360,{intensity:.7,palette:'titanium'});repeat&&=a===cv.toDataURL();
    sx.drawImage(cv,col*320,row*204,320,180);sx.fillStyle='#10202b';sx.fillRect(col*320,row*204+180,320,24);sx.fillStyle='#d4dce3';sx.font='11px monospace';sx.fillText(c.id+' / '+t.toFixed(2)+'s',col*320+7,row*204+196);samples.push({t,state:c.sample(t,{intensity:.7})})
   }
   // Exercise actual options at both extremes; ensure options produce finite pixels, not exceptions.
   for(const palette of ['titanium','ember','porcelain'])for(const intensity of [0,1])c.draw(ctx,c.duration*.5,640,360,{palette,intensity});
   result.push({id:c.id,module:mod,finite,repeat,duration:c.duration,refs:c.referenceIds,codeFile:c.codeFile,samples});
  });sheets[mod]=sheet.toDataURL().split(',')[1]
 }return{result,sheets}
});
report.render=render.result;for(const [m,data]of Object.entries(render.sheets))fs.writeFileSync(path.join(out,m+'-contact.png'),Buffer.from(data,'base64'));
report.checks.push({name:'38 candidates / six modules / finite states / reverse-seek pixels',passed:render.result.length===38&&new Set(render.result.map(r=>r.module)).size===6&&render.result.every(r=>r.finite&&r.repeat)});
// Full-page screenshots via CDP, no external browser runtime download.
async function screenshot(name){const size=await p.evaluate(()=>({width:innerWidth,height:document.documentElement.scrollHeight}));const r=await p._client().send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,...size,scale:1}});fs.writeFileSync(path.join(out,name),Buffer.from(r.value.data,'base64'))}
async function click(selector){const pos=await p.evaluate(sel=>{const e=document.querySelector(sel);if(!e)throw Error('Missing '+sel);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}},selector);await p._client().send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});await p._client().send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos})}
async function waitOpen(selector){return p.evaluate(async sel=>{for(let i=0;i<100;i++){if(document.querySelector(sel)?.open)return true;await new Promise(r=>setTimeout(r,50))}throw Error('Dialog did not open: '+sel)},selector)}
await click('#compareButton');await click('#saveButton');
const state=await p.evaluate(()=>window.styleLab.getState());report.checks.push({name:'A/B comparison and selection',passed:state.compare&&state.saved.length===1});
await click('#referencesButton');const refs=await p.evaluate(()=>({count:document.querySelectorAll('.ref-study').length,buttons:document.querySelectorAll('.ref-windows button').length}));report.checks.push({name:'eight reference studies',passed:refs.count===8&&refs.buttons>=16,...refs});
await p.evaluate(()=>document.querySelector('#referenceDialog').close());
await click('#codeButton');await waitOpen('#codeDialog');const code=await p.evaluate(()=>document.querySelector('#codeContent').textContent);report.checks.push({name:'source view',passed:code.includes('export')});await p.evaluate(()=>document.querySelector('#codeDialog').close());
await click('#compareButton');await click('#soundButton');
await new Promise(r=>setTimeout(r,1000));
report.checks.push({name:'user-triggered sound and playback',passed:await p.evaluate(()=>window.styleLab.getState().playing&&document.querySelector('#soundButton').getAttribute('aria-pressed')==='true')});await click('#soundButton');await p.evaluate(()=>window.styleLab.setPlaying(false));
for(const width of [1600,390]){await p.setViewport({width,height:width===390?844:1050,deviceScaleFactor:1});await p.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());window.scrollTo(0,0)});const result=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,brand:document.querySelector('.brand img').naturalWidth,broken:[...document.images].filter(im=>im.offsetWidth>0&&(!im.complete||!im.naturalWidth)).map(im=>im.src)}));report.viewports.push({...result,passed:result.scroll<=width&&result.brand>0&&result.broken.length===0});await screenshot('library-'+width+'.png')}
const paths=['/','/lab/modules/index.js','/lab/references.json','/使用说明.md',...render.result.map(r=>'/lab/'+r.codeFile.replace(/^\.\//,''))];
for(const href of new Set(paths)){const r=await fetch(base+href,{method:'HEAD'});report.downloads.push({href,status:r.status,passed:r.ok})}
const media=await fetch(base+'/reference-media/shuffle/video',{headers:{Range:'bytes=0-1023'}});const bytes=await media.arrayBuffer();report.checks.push({name:'reference video byte-range',passed:media.status===206&&bytes.byteLength===1024});
report.passed=report.checks.every(c=>c.passed)&&report.viewports.every(c=>c.passed)&&report.downloads.every(c=>c.passed)&&errors.length===0;
}catch(e){errors.push(String(e));report.passed=false}finally{await browser.close({silent:true});fs.writeFileSync(path.join(out,'lab-report.json'),JSON.stringify(report,null,2))}
console.log(JSON.stringify({passed:report.passed,checks:report.checks,viewports:report.viewports,errors},null,2));if(!report.passed)process.exitCode=1;
