// Grid-search (brightness, saturate) for one shot so mean V and mean S hit targets.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'local-config.json'),'utf8'));
const require=createRequire(config.sharedRuntime);
const arg=(k,d)=>{const h=process.argv.find(s=>s.startsWith('--'+k+'='));return h?h.slice(k.length+3):d;};
const t=parseFloat(arg('t','6.875'));
const tv=parseFloat(arg('tv','188.6')), ts=parseFloat(arg('ts','84.2'));
const page_=arg('page','repro-blend.html');
const b=await require('@remotion/renderer').openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe',logLevel:'error'});
try{
  const p=await b.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:()=>{},onLog:()=>{}});
  await p.setViewport({width:1920,height:1080,deviceScaleFactor:1});
  await p.goto({url:'file:///'+path.join(root,'lab',page_).split(path.sep).join('/'),timeout:30000});
  const res=await p.evaluate(({t})=>{
    const R=window.__repro; const c=R.canvas, g=c.getContext('2d',{alpha:false});
    const measure=()=>{
      const d=g.getImageData(0,0,c.width,c.height).data;
      let v=0,s=0,cnt=0;
      for(let i=0;i<d.length;i+=4*7){
        const r=d[i],gg=d[i+1],bb=d[i+2];
        const mx=Math.max(r,gg,bb),mn=Math.min(r,gg,bb);
        v+=mx; s+= mx>0?(mx-mn)/mx*255:0; cnt++;
      }
      return {v:v/cnt,s:s/cnt};
    };
    const out=[];
    R.setTime(t); const base=measure();
    const tmp=document.createElement('canvas'); tmp.width=c.width; tmp.height=c.height;
    const tg=tmp.getContext('2d',{alpha:false});
    for (const br of [1.0,1.06,1.12,1.18,1.24,1.3]){
      for (const sa of [0.9,1.0,1.1,1.2,1.3,1.45,1.6]){
        R.setTime(t);                       // re-render clean base every probe
        tg.setTransform(1,0,0,1,0,0); tg.globalCompositeOperation='copy';
        tg.drawImage(c,0,0);
        g.setTransform(1,0,0,1,0,0); g.globalCompositeOperation='copy';
        g.filter='brightness('+br+') saturate('+sa+')';
        g.drawImage(tmp,0,0); g.filter='none';
        const m=measure();
        out.push({br,sa,v:+m.v.toFixed(1),s:+m.s.toFixed(1)});
      }
    }
    return {base,out};
  },{t});
  const best=res.out.slice().sort((a,b)=>{
    return Math.hypot(a.v-tv,(a.s-ts)*0.6)-Math.hypot(b.v-tv,(b.s-ts)*0.6);});
  console.log('base',res.base);
  console.log('target',tv,ts);
  for(const r of best.slice(0,5)) console.log(JSON.stringify(r));
} finally { await b.close({silent:true}); }
