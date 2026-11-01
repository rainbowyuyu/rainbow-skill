import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=(key,fallback)=>process.argv.find(x=>x.startsWith('--'+key+'='))?.slice(key.length+3)??fallback;
const base=arg('url','http://localhost:8000');
const req=createRequire(createRequire(import.meta.url)('./shared-runtime.cjs')(arg('dependencies',null)));
const browser=await req('@remotion/renderer').openBrowser('chrome',{browserExecutable:arg('browser','C:/Program Files/Google/Chrome/Application/chrome.exe'),logLevel:'error'});
const report={checks:[],errors:[],scope:'Dialog interaction, local link availability, each reference window playback; source muted, not subjective listening.'};
try{
 const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:l=>{if(l.type==='error')report.errors.push(l.text)},onLog:()=>{}});
 await page.setViewport({width:1440,height:960,deviceScaleFactor:1});
 await page.goto({url:base+'/lab/',timeout:30000});
 const index=await (await fetch(base+'/lab/references.json')).json();
 const refs=Array.isArray(index)?index:index.references;
 const ids=await page.evaluate(()=>window.styleLab.candidates.map(c=>c.id));
 report.checks.push({name:'Every recommended candidate exists',passed:refs.every(r=>r.recommendedCandidateIds.every(id=>ids.includes(id)))});
 async function waitFor(test){for(let n=0;n<100;n++){if(await page.evaluate(test))return;await new Promise(r=>setTimeout(r,60));}throw Error('UI state timeout');}
 await page.evaluate(()=>document.querySelector('#guideButton').click());
 await waitFor(()=>document.querySelector('#studyDialog').open);
 const guide=await page.evaluate(()=>({text:document.querySelector('#studyContent').textContent,links:[...document.querySelectorAll('#studyContent a')].map(a=>a.href)}));
 report.checks.push({name:'Main guide renders',passed:guide.text.includes('代码接口')&&guide.links.length>0});
 await page.evaluate(()=>document.querySelector('#studyDialog').close());
 const modules=[...new Set(await page.evaluate(()=>window.styleLab.candidates.map(c=>c.module)))];
 for(const mod of modules){
  await page.evaluate(mod=>{window.styleLab.select(window.styleLab.candidates.find(c=>c.module===mod).id);document.querySelector('#moduleGuide').click()},mod);
  await waitFor(()=>document.querySelector('#studyDialog').open);
  const state=await page.evaluate(()=>({text:document.querySelector('#studyContent').textContent,links:[...document.querySelectorAll('#studyContent a')].map(a=>a.href)}));
  report.checks.push({name:'Module guide '+mod,passed:state.text.length>250});
  for(const href of state.links.filter(h=>h.startsWith(base))){const r=await fetch(href,{method:'HEAD'});report.checks.push({name:'Guide link '+href,passed:r.ok,status:r.status});}
  await page.evaluate(()=>document.querySelector('#studyDialog').close());
 }
 for(const ref of refs){
  await page.evaluate(()=>document.querySelector('#referencesButton').click());
  await page.evaluate(id=>document.querySelector('#ref-'+id+' .read-study').click(),ref.id);
  await waitFor(()=>document.querySelector('#studyDialog').open);
  const links=await page.evaluate(()=>[...document.querySelectorAll('#studyContent a')].map(a=>a.href));
  for(const href of links.filter(h=>h.startsWith(base))){const r=await fetch(href,{method:'HEAD'});report.checks.push({name:'Study asset '+ref.id+' '+href,passed:r.ok,status:r.status});}
  await page.evaluate(()=>document.querySelector('#studyDialog').close());
  const windowCount=await page.evaluate(id=>document.querySelectorAll('#ref-'+id+' .ref-windows button').length,ref.id);
  for(let wi=0;wi<windowCount;wi++){
   await page.evaluate(({id,wi})=>document.querySelectorAll('#ref-'+id+' .ref-windows button')[wi].click(),{id:ref.id,wi});
   await waitFor(()=>document.querySelector('#sourceDialog').open&&document.querySelector('#sourceVideo').readyState>=2&&!document.querySelector('#sourceVideo').paused);
   const before=await page.evaluate(()=>document.querySelector('#sourceVideo').currentTime);
   await new Promise(r=>setTimeout(r,280));
   const after=await page.evaluate(()=>{const v=document.querySelector('#sourceVideo');return{time:v.currentTime,error:v.error?.message??null,muted:v.muted}});
   const w=(ref.windows||ref.observations)[wi];
   report.checks.push({name:'Window advances '+ref.id+' '+wi,passed:before>=w.start-.25&&before<w.end&&after.time>before&&!after.error&&after.muted,before,after:after.time,window:[w.start,w.end]});
   await page.evaluate(end=>{document.querySelector('#sourceVideo').currentTime=end+.05},w.end);
   await waitFor(()=>document.querySelector('#sourceVideo').paused);
   report.checks.push({name:'Window stops '+ref.id+' '+wi,passed:true});
   await page.evaluate(()=>document.querySelector('#sourceDialog').close());
  }
  const wanted=ref.recommendedCandidateIds[0];
  await page.evaluate(id=>document.querySelector('#ref-'+id+' .ref-links .reference-chip').click(),ref.id);
  report.checks.push({name:'Reference opens candidate '+ref.id,passed:(await page.evaluate(()=>window.styleLab.getState().id))===wanted});
 }
 report.passed=report.checks.every(c=>c.passed)&&!report.errors.length;
}catch(error){report.errors.push(String(error));report.passed=false;}finally{await browser.close({silent:true});fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa/interactions.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),errors:report.errors},null,2));
if(!report.passed)process.exitCode=1;
