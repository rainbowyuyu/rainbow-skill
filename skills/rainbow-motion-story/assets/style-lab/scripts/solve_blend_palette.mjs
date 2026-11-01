// Solve a global light + saturation multiplier so a shot's measured V/S land on target.
// Usage: node solve_blend_palette.mjs --page=repro-blend.html --t=6.875 --tv=188.6 --ts=84.2
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'local-config.json'),'utf8'));
const require=createRequire(config.sharedRuntime);
const arg=(k,d)=>{const h=process.argv.find(s=>s.startsWith('--'+k+'='));return h?h.slice(k.length+3):d;};
const page_=arg('page','repro-blend.html');
const t=parseFloat(arg('t','6.875'));
const tv=parseFloat(arg('tv','188.6')), ts=parseFloat(arg('ts','84.2'));
const browser=await require('@remotion/renderer').openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe',logLevel:'error'});
try{
  const p=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:()=>{},onLog:()=>{}});
  await p.setViewport({width:1920,height:1080,deviceScaleFactor:1});
  await p.goto({url:'file:///'+path.join(root,'lab',page_).split(path.sep).join('/'),timeout:30000});
  // expose a probe that re-renders with a multiplier applied on top of the draw
  const res=await p.evaluate(({t,tv,ts})=>{
    const R=window.__repro;
    const probe=(satMul)=>{
      const c=R.canvas, g=c.getContext('2d',{alpha:false});
      R.setTime(t);
      if (Math.abs(satMul-1)>1e-3){
        const tmp=document.createElement('canvas'); tmp.width=c.width; tmp.height=c.height;
        tmp.getContext('2d').drawImage(c,0,0);
        g.save(); g.setTransform(1,0,0,1,0,0); g.globalCompositeOperation='copy';
        g.filter='saturate('+satMul+')'; g.drawImage(tmp,0,0); g.filter='none'; g.restore();
      }
      const d=g.getImageData(0,0,c.width,c.height).data;
      let v=0,s=0,n=c.width*c.height;
      for(let i=0;i<d.length;i+=4*7){
        const r=d[i],gg=d[i+1],b=d[i+2];
        const mx=Math.max(r,gg,b), mn=Math.min(r,gg,b);
        v+=mx; s+= mx>0?(mx-mn)/mx*255:0;
      }
      const cnt=Math.ceil(d.length/(4*7));
      return {v:v/cnt,s:s/cnt};
    };
    const out=[];
    for (const m of [0.7,0.85,1.0,1.15,1.3]) out.push({mul:m,...probe(m)});
    return out;
  },{t,tv,ts});
  console.log('target V',tv,'S',ts);
  for(const r of res) console.log('satMul',r.mul,'→ V',r.v.toFixed(1),'S',r.s.toFixed(1));
} finally { await browser.close({silent:true}); }
