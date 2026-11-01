const $ = id => document.getElementById(id);
const root = new URL('../', import.meta.url);
const film = $('film'), ns = 'http://www.w3.org/2000/svg';
const C = { a: '#FFCB78', b: '#62D6F6', c: '#FF7CA8', mint:'#7DE5BC', white: '#dce8e6', muted: '#7998a6', line: '#304b59' };
let data, scene, requestId = 0, available = false, codeText = '', toastTimer;
const saved = new Map();
function url(path) {
  const u = new URL(path, root);
  if (u.origin !== root.origin || !u.pathname.startsWith(root.pathname)) throw new Error('资源路径超出方法库');
  return u.href;
}
function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2600);
}
async function copy(value) {
  try { await navigator.clipboard.writeText(value); toast('已复制'); }
  catch { toast('浏览器未允许复制，可在代码窗口选择文字。'); }
}
const fmt=(n,d=2)=>(Math.abs(n)<0.00001?0:n).toFixed(d);
function sync() {
  const duration=Number.isFinite(film.duration)?film.duration:0;
  $('time').value=fmt(film.currentTime)+' / '+fmt(duration);
  $('timeline').max=duration||1; $('timeline').value=film.currentTime;
  $('play').textContent=film.paused?'播放':'暂停';
  const chapters=scene?.chapters||[]; let current=chapters[0];
  chapters.forEach(ch=>{if(film.currentTime+0.015>=ch.start)current=ch;});
  $('chapters').querySelectorAll('button').forEach((b,i)=>{
    const active=chapters[i]===current;b.classList.toggle('active',active);
    if(active)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
  });
  $('active-phase').textContent=current?.title||'原生样例';
}
function setAvailable(value) {
  available=value;['play','prev','next','restart','timeline'].forEach(id=>$(id).disabled=!value);
  $('chapters').querySelectorAll('button').forEach(b=>b.disabled=!value);
  $('media-wait').hidden=value;$('render-badge').hidden=!value;
}
function selectScene(id,focus=false) {
  const next=data.scenes.find(item=>item.id===id);if(!next)return;
  const token=++requestId;scene=next;film.pause();setAvailable(false);
  film.removeAttribute('src');film.removeAttribute('poster');film.load();
  $('scene-tabs').querySelectorAll('button').forEach(b=>{
    const selected=b.dataset.id===id;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;
    if(selected&&focus)b.focus();
  });
  $('scene-panel').setAttribute('aria-labelledby','tab-'+id);
  $('scene-kicker').textContent=next.kicker;$('scene-title').textContent=next.label;
  $('scene-question').textContent=next.question;$('invariant').textContent=next.invariant;$('changing').textContent=next.changing;
  $('formula').replaceChildren(...next.formula.map(part=>{const s=document.createElement(part.sup?'sup':'span');s.textContent=part.text;if(part.role)s.className=part.role;return s;}));
  if (id === 'matrix') {
    const label=document.createElement('span');label.textContent='A = ';
    const matrix=document.createElement('span');matrix.className='matrix-notation';matrix.setAttribute('aria-label','二乘二矩阵，第一行二一，第二行一一');
    [2,1,1,1].forEach((value,index)=>{const entry=document.createElement('span');entry.textContent=value;entry.className=index%2?'c':'b';matrix.append(entry);});
    $('formula').replaceChildren(label,matrix);
  }
  $('class-name').textContent=next.className;
  $('chapters').replaceChildren(...next.chapters.map(ch=>{
    const b=document.createElement('button');b.className='chapter';b.type='button';b.disabled=true;
    const t=document.createElement('span');t.textContent=fmt(ch.start,2)+' s';
    const h=document.createElement('strong');h.textContent=ch.title;
    const p=document.createElement('small');p.textContent=ch.text;
    b.append(t,h,p);b.addEventListener('click',()=>{film.pause();film.currentTime=Math.min(ch.start,Math.max(0,film.duration-1/data.fps));});return b;
  }));
  const p=next.parameter;
  $('parameter-label').textContent=p.label;$('parameter').min=p.min;$('parameter').max=p.max;$('parameter').step=p.step;
  $('parameter').value=saved.has(id)?saved.get(id):p.default;
  $('parameter-min').textContent=id==='complex'?'0':fmt(p.min,p.min%1?2:0);
  $('parameter-max').textContent=id==='complex'?'2π':fmt(p.max,p.max%1?2:0);
  $('live-question').textContent=next.liveQuestion;$('media-status').textContent='检查当前场景的实际渲染。';
  $('engine').textContent=data.implementation;
  $('media-meta').textContent=data.dimensions.join(' × ')+' · '+data.fps+' fps · 无声练习';
  draw();sync();history.replaceState(null,'','#'+id);
  fetch(url(next.video),{method:'HEAD'}).then(r=>{
    if(token!==requestId)return;if(!r.ok)throw new Error('媒体尚未发布');
    film.src=url(next.video);film.poster=url(next.poster);film.playbackRate=Number($('speed').value);film.load();
  }).catch(()=>{if(token===requestId)$('media-status').textContent='当前原生样片尚未就绪。可先查看下方数学联动、代码与研究记录。';});
}
function el(tag,attrs={},content) {
  const n=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));
  if(content!=null)n.textContent=content;return n;
}
const line=(x1,y1,x2,y2,color=C.line,width=1,dash)=>el('line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,...(dash?{'stroke-dasharray':dash}:{})});
const txt=(x,y,content,color=C.white,size=18,anchor='start')=>el('text',{x,y,fill:color,'font-size':size,'text-anchor':anchor},content);
const path=(d,color,width=2,extra={})=>el('path',{d,fill:'none',stroke:color,'stroke-width':width,'stroke-linejoin':'round','stroke-linecap':'round',...extra});
const dot=(x,y,color,r=5)=>el('circle',{cx:x,cy:y,r,fill:color});
function arrow(x1,y1,x2,y2,color,width=3) {
  const g=el('g'),a=Math.atan2(y2-y1,x2-x1),l=10;
  const d='M '+(x2-l*Math.cos(a-.38))+' '+(y2-l*Math.sin(a-.38))+' L '+x2+' '+y2+' L '+(x2-l*Math.cos(a+.38))+' '+(y2-l*Math.sin(a+.38));
  g.append(line(x1,y1,x2,y2,color,width),path(d,color,width));return g;
}
function draw() {
  if(!scene)return;const v=Number($('parameter').value);saved.set(scene.id,v);
  const svg=$('linked-view'),title=el('title',{id:'svg-title'},scene.liveQuestion),desc=el('desc',{id:'svg-desc'});
  svg.replaceChildren(title,desc);$('parameter-value').value=fmt(v)+(scene.id==='complex'?' rad':'');
  const add=(...nodes)=>svg.append(...nodes);
  if(scene.id==='semantic') {
    const a=2,b=3,c=v,sx=47,sy=47,x=77,y=122,w1=b*sx,w2=c*sx,h=a*sy;
    add(el('rect',{x,y,width:w1,height:h,fill:C.b,'fill-opacity':.15,stroke:C.b,'stroke-width':2}),el('rect',{x:x+w1,y,width:w2,height:h,fill:C.c,'fill-opacity':.15,stroke:C.c,'stroke-width':2}));
    add(txt(x+w1/2,y+h/2+7,'ab',C.b,24,'middle'),txt(x+w1+w2/2,y+h/2+7,'ac',C.c,Math.min(24,12+c*8),'middle'));
    add(txt(x+w1/2,y-20,'b = 3',C.b,19,'middle'),txt(x+w1+w2/2,y-20,'c = '+fmt(c),C.c,19,'middle'),txt(x-22,y+h/2+7,'a = 2',C.a,19,'end'));
    add(path('M '+x+' '+(y+h+17)+' v 8 h '+(w1+w2)+' v -8',C.muted,1),txt(x+(w1+w2)/2,y+h+54,'b + c',C.white,20,'middle'));
    add(line(444,74,444,290),txt(487,116,'整体的面积',C.muted,16),txt(487,153,'2 × (3 + '+fmt(c)+')',C.white,25),txt(487,214,'分块后相加',C.muted,16),txt(487,251,'6 + '+fmt(a*c)+' = '+fmt(a*(b+c)),C.white,25));
    $('live-equation').value='2(3 + '+fmt(c)+') = '+fmt(6+2*c);
    $('live-meaning').textContent='两块共享高度 a。拆分改变了观察方式，没有改变总面积。';
    desc.textContent='高度2，宽度3和'+fmt(c)+'，总面积'+fmt(6+2*c)+'。';
  } else if(scene.id==='derivative') {
    const dx=v,ox=75,oy=303,sx=112,sy=43,px=x=>ox+x*sx,py=y=>oy-y*sy,slope=2+dx;
    for(let x=0;x<=3;x++)add(line(px(x),py(0),px(x),py(6.2),C.line,.7));
    for(let y=0;y<=6;y++)add(line(px(0),py(y),px(3),py(y),C.line,.7));
    add(arrow(px(0),py(0),px(3.15),py(0),C.muted,1),arrow(px(0),py(0),px(0),py(6.45),C.muted,1));
    let d='';for(let x=0;x<=2.5;x+=.02)d+=(d?'L':'M')+' '+px(x)+' '+py(x*x)+' ';add(path(d,C.b,3));
    const p={x:px(1),y:py(1)},q={x:px(1+dx),y:py((1+dx)**2)},l=1-1/slope,r=2.45;
    add(path('M '+px(l)+' '+py(1+slope*(l-1))+' L '+px(r)+' '+py(1+slope*(r-1)),C.c,2),line(p.x,p.y,q.x,p.y,C.a,3),line(q.x,p.y,q.x,q.y,C.c,3),dot(p.x,p.y,C.a),dot(q.x,q.y,C.c));
    add(txt((p.x+q.x)/2,p.y+26,'Δx',C.a,18,'middle'),txt(q.x+10,(q.y+p.y)/2,'Δy',C.c,18),txt(px(2.55),py(5.95),'y = x²',C.b,21),txt(p.x-7,337,'x₀ = 1',C.muted,17,'middle'));
    add(line(449,70,449,292),txt(487,111,'当前割线',C.muted,16),txt(487,149,'Δy / Δx = '+fmt(slope),C.c,25),txt(487,212,'当 Δx → 0',C.muted,16),txt(487,249,'f′(1) = 2',C.mint,28));
    $('live-equation').value=fmt(dx*(2+dx),4)+' / '+fmt(dx)+' = '+fmt(slope);
    $('live-meaning').textContent='当前是有限差商 2 + Δx。它不断接近 2，但只有在取极限时，才得到这里的导数。';
    desc.textContent='增量'+fmt(dx)+'，割线斜率'+fmt(slope)+'，导数极限2。';
  } else if(scene.id==='matrix') {
    const t=v,ox=211,oy=239,s=43,point=(x,y)=>[ox+s*((1+t)*x+t*y),oy-s*(t*x+y)];
    const defs=el('defs'),clip=el('clipPath',{id:'plane-clip'});clip.append(el('rect',{x:35,y:45,width:390,height:276}));defs.append(clip);add(defs);
    const grid=el('g',{'clip-path':'url(#plane-clip)'});
    for(let k=-5;k<=5;k++){grid.append(line(35,oy-k*s,425,oy-k*s,'#263945',.55),line(ox+k*s,45,ox+k*s,321,'#263945',.55));}
    for(let k=-5;k<=5;k++){let p=point(k,-6),q=point(k,6);grid.append(line(...p,...q,C.line,k===0?1.5:.8));p=point(-6,k);q=point(6,k);grid.append(line(...p,...q,C.line,k===0?1.5:.8));}
    const origin=point(0,0),i=point(1,0),j=point(0,1),sum=point(1,1);
    grid.append(el('polygon',{points:[origin,i,sum,j].map(p=>p.join(',')).join(' '),fill:C.mint,'fill-opacity':.09,stroke:C.mint,'stroke-opacity':.35}));
    grid.append(arrow(...origin,...i,C.b),arrow(...origin,...j,C.c),arrow(...origin,...sum,C.white,2));
    add(grid,txt(i[0]+9,i[1]+8,'Aₜe₁',C.b,19),txt(j[0]-10,j[1]-12,'Aₜe₂',C.c,19,'end'),txt(sum[0]+10,sum[1]-8,'Aₜ(e₁ + e₂)',C.white,16),txt(origin[0]-13,origin[1]+19,'0',C.muted,15));
    add(line(449,70,449,292),txt(487,108,'Aₜ = (1 − t)I + tA',C.white,23),path('M 504 134 h -8 v 75 h 8 M 655 134 h 8 v 75 h -8',C.white,2),txt(519,160,fmt(1+t),C.b,26),txt(593,160,fmt(t),C.c,26),txt(519,199,fmt(t),C.b,26),txt(593,199,'1.00',C.c,26),txt(487,258,'det Aₜ = '+fmt(1+t-t*t),C.mint,22));
    $('live-equation').value='Aₜ(1, 1) = ('+fmt(1+2*t)+', '+fmt(1+t)+')';
    $('live-meaning').textContent='插值过程中面积会变化；最终 det A = 1。网格与向量使用同一矩阵，没有分别补动画。';
    desc.textContent='变换进度'+fmt(t)+'，向量一一变为'+fmt(1+2*t)+'、'+fmt(1+t)+'，面积倍率'+fmt(1+t-t*t)+'。';
  } else {
    const theta=v,cx=174,cy=184,r=98,wx=390,ww=306,px=cx+r*Math.cos(theta),py=cy-r*Math.sin(theta),qx=wx+theta/(Math.PI*2)*ww;
    add(line(cx-r-24,cy,cx+r+25,cy),line(cx,cy-r-24,cx,cy+r+25),el('circle',{cx,cy,r,fill:'none',stroke:C.muted,'stroke-width':1.5}),arrow(cx,cy,px,py,C.c),dot(px,py,C.c),line(px,py,qx,py,C.b,1,'5 6'));
    add(line(wx,cy,wx+ww+10,cy,C.muted),line(wx,cy-r-19,wx,cy+r+19,C.muted),line(wx,cy-r,wx+ww,cy-r,C.line,.7,'3 5'),line(wx,cy+r,wx+ww,cy+r,C.line,.7,'3 5'));
    let full='',partial='';for(let j=0;j<=180;j++){const phase=j/180*Math.PI*2;full+=(j?'L':'M')+' '+(wx+j/180*ww)+' '+(cy-r*Math.sin(phase))+' ';}
    const steps=Math.max(2,Math.ceil(theta*30));for(let j=0;j<=steps;j++){const phase=theta*j/steps;partial+=(j?'L':'M')+' '+(wx+phase/(Math.PI*2)*ww)+' '+(cy-r*Math.sin(phase))+' ';}
    add(path(full,C.line,2),path(partial,C.b,3),dot(qx,py,C.b),line(qx,cy,qx,py,C.b,1,'4 4'));
    add(txt(cx,318,'单位圆 · 同一个 θ',C.muted,17,'middle'),txt(wx+ww/2,318,'纵坐标 · sin θ',C.muted,17,'middle'),txt(wx,cy+22,'0',C.muted,14),txt(wx+ww/2,cy+22,'π',C.muted,14,'middle'),txt(wx+ww,cy+22,'2π',C.muted,14,'end'),txt(cx,45,'exp(iθ)',C.c,26,'middle'),txt(wx+ww/2,45,'sin θ = '+fmt(Math.sin(theta)),C.b,26,'middle'));
    $('live-equation').value='exp(iθ) ≈ '+fmt(Math.cos(theta))+' '+(Math.sin(theta)<0?'−':'+')+' '+fmt(Math.abs(Math.sin(theta)))+'i';
    $('live-meaning').textContent='虚部是圆上点的高度。把同一高度沿 θ 展开，就得到正弦曲线；半径始终保持 1。';
    desc.textContent='相位'+fmt(theta)+'弧度，虚部和正弦值均为'+fmt(Math.sin(theta))+'。';
  }
}
$('parameter').addEventListener('input',draw);
$('reset-parameter').addEventListener('click',()=>{$('parameter').value=scene.parameter.default;draw();});
$('play').addEventListener('click',async()=>{if(!available)return;if(!film.paused)film.pause();else{if(film.ended)film.currentTime=0;try{await film.play();}catch{toast('当前浏览器未能播放，请重试或下载样片。');}}});
$('restart').addEventListener('click',()=>{film.pause();film.currentTime=0;});
function step(direction){if(!available||!Number.isFinite(film.duration))return;film.pause();const fps=data.fps,frame=Math.round(film.currentTime*fps);film.currentTime=Math.max(0,Math.min(Math.ceil(film.duration*fps)-1,frame+direction))/fps;}
$('prev').addEventListener('click',()=>step(-1));$('next').addEventListener('click',()=>step(1));
$('timeline').addEventListener('input',()=>{if(available){film.pause();film.currentTime=Number($('timeline').value);}});
$('speed').addEventListener('change',()=>film.playbackRate=Number($('speed').value));
['timeupdate','pause','play','seeking','seeked','ended'].forEach(event=>film.addEventListener(event,sync));
film.addEventListener('loadedmetadata',()=>{if(film.currentSrc){setAvailable(true);$('timeline').step=1/data.fps;sync();}});
film.addEventListener('error',()=>{if(film.getAttribute('src')){setAvailable(false);$('media-status').textContent='视频解码暂时不可用。可从复现说明下载或重新生成。';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)film.pause();});window.addEventListener('pagehide',()=>film.pause());
$('copy-recipe').addEventListener('click',()=>copy([scene.label,'数学问题：'+scene.question,'不变量：'+scene.invariant,'编排：'+scene.recipe,'Manim 类：'+scene.className,'代码：examples/manim-formula/scenes.py','指南：guides/manim-formula-language.md','先核对实际输入和数学结论，再安排变化与观察时间。'].join('\n')));
$('code-open').addEventListener('click',async()=>{
  film.pause();$('code-dialog').showModal();$('class-name').textContent=scene.className;
  if(codeText){$('code-content').textContent=codeText;return;}
  try{const r=await fetch(url(data.code));if(!r.ok)throw new Error();codeText=await r.text();$('code-content').textContent=codeText;$('copy-code').disabled=false;}
  catch{$('code-content').textContent='源代码暂未就绪；稍后重新打开，或查看运行说明。';}
});
$('code-close').addEventListener('click',()=>$('code-dialog').close());$('copy-code').addEventListener('click',()=>copy(codeText));
try {
  const r=await fetch(url('examples/manim-formula/presentation.json'));if(!r.ok)throw new Error('清单不可用');data=await r.json();
  $('scene-tabs').replaceChildren(...data.scenes.map((item,index)=>{
    const b=document.createElement('button');b.id='tab-'+item.id;b.className='scene-tab';b.type='button';b.dataset.id=item.id;b.setAttribute('role','tab');b.setAttribute('aria-controls','scene-panel');
    const n=document.createElement('b');n.textContent=String(index+1).padStart(2,'0');const wrap=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=item.label;small.textContent=item.short;wrap.append(strong,small);b.append(n,wrap);
    b.addEventListener('click',()=>selectScene(item.id));b.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?data.scenes.length-1:(index+(event.key==='ArrowRight'?1:-1)+data.scenes.length)%data.scenes.length;selectScene(data.scenes[next].id,true);});return b;
  }));
  const hash=location.hash.slice(1);selectScene(data.scenes.some(item=>item.id===hash)?hash:data.scenes[0].id);
} catch {$('media-status').textContent='样例清单载入失败，请从方法库服务打开此页。';}

