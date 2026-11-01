// Sweep wash parameters for the S4 white-flash frames by patching them in-page.
// The wash parameters live in drawWash(); we monkey-patch window.__flashCfg and
// have the page read it when present.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'local-config.json'),'utf8'));
const require=createRequire(config.sharedRuntime);
const b=await require('@remotion/renderer').openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe',logLevel:'error'});
const p=await b.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:()=>{},onLog:()=>{}});
await p.setViewport({width:960,height:540,deviceScaleFactor:1});
await p.goto({url:'file:///'+path.join(root,'lab','repro-blend.html').split(path.sep).join('/')});
const out=await p.evaluate(()=>{
  const R=window.__repro; const c=R.canvas, g=c.getContext('2d',{alpha:false});
  const W=960,H=540;
  const small=document.createElement('canvas'); small.width=W; small.height=H;
  const sc=small.getContext('2d',{alpha:false});
  const M=()=>{const d=sc.getImageData(0,0,W,H).data; let v=0,s=0,n=0; const gr=new Float32Array(W*H);
    for(let i=0,k=0;i<d.length;i+=4,k++){const r=d[i],gg=d[i+1],bb=d[i+2];
      const mx=Math.max(r,gg,bb),mn=Math.min(r,gg,bb); v+=mx; s+=mx>0?(mx-mn)/mx*255:0;
      gr[k]=0.299*r+0.587*gg+0.114*bb; n++;}
    let gx=0,gy=0; for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;
      gx+=Math.abs(gr[i+1]-gr[i-1]); gy+=Math.abs(gr[i+W]-gr[i-W]);}
    return {v:v/n,s:s/n,e:(gx+gy)/(2*(W-2)*(H-2))/8,gr};};
  const gram=(f)=>{R.setTime(f/24); sc.setTransform(1,0,0,1,0,0); sc.drawImage(c,0,0,W,H); return M();};
  const a181=gram(181), a183=gram(183);
  const res=[];
  for (const blur of [6,10,14,18]){
    for (const fill of [0.10,0.25,0.40,0.55]){
      for (const desat of [0.35,0.5,0.65]){
        R.setTime(181/24);
        R.canvas.getContext('2d');
        // draw the same frame 181, then apply wash manually at 960
        sc.setTransform(1,0,0,1,0,0);
        sc.drawImage(c,0,0,W,H);
        const tmp=document.createElement('canvas'); tmp.width=W; tmp.height=H;
        tmp.getContext('2d').drawImage(small,0,0);
        sc.globalCompositeOperation='source-over'; sc.filter='blur('+blur+'px)'; sc.drawImage(tmp,0,0); sc.filter='none';
        sc.globalCompositeOperation='saturation'; sc.fillStyle='rgba(128,128,128,'+desat+')'; sc.fillRect(0,0,W,H);
        sc.globalCompositeOperation='source-over'; sc.fillStyle='rgba(214,224,230,'+fill+')'; sc.fillRect(0,0,W,H);
        const m=M();
        let pd=0; for(let i=0;i<m.gr.length;i++) pd+=Math.abs(m.gr[i]-a181.gr[i]); pd/=m.gr.length;
        res.push({blur,fill,desat,v:+m.v.toFixed(1),s:+m.s.toFixed(1),pd:+pd.toFixed(2)});
      }
    }
  }
  return {a181:{v:+a181.v.toFixed(1),s:+a181.s.toFixed(1)},res};
});
const T={v:180.1,s:33.5,pd:47.65};
const best=out.res.slice().sort((x,y)=>Math.hypot(x.v-T.v,(x.s-T.s)*1.2,(x.pd-T.pd)*0.8)-Math.hypot(y.v-T.v,(y.s-T.s)*1.2,(y.pd-T.pd)*0.8));
console.log('f181 base',out.a181);
for(const r of best.slice(0,8)) console.log(JSON.stringify(r));
await b.close({silent:true});
