import {PRESETS, sampleCurve, sampleMotion} from './rate-curves.js';

const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const presets=new Map(PRESETS.map(p=>[p.id,p]));
const C={a:'#80d7d6',b:'#efbd79',ink:'#eeeade',muted:'#9bb0bb',line:'#35505f',danger:'#ee9682'};
const defaults=id=>Object.fromEntries(presets.get(id).parameters.map(p=>[p.key,p.default]));
const state={a:'linear',b:'minimum-jerk',optionsA:{},optionsB:{},duration:2.4,distance:560,mode:'object',fps:30,edit:'B',graphRange:'main',time:0,playing:false};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const canvas=$('motionCanvas'),ctx=canvas.getContext('2d');
const graphs=[['positionChart','position'],['velocityChart','velocity'],['accelerationChart','acceleration']];
let clockStart=0,clockOffset=0,raf=0,dirty=true,noticeTimer,plotData=null,span=3.2;
const laneId=lane=>state[lane.toLowerCase()];
const laneOptions=lane=>state[`options${lane}`];
const meta=lane=>presets.get(laneId(lane));
const motion=(lane,time)=>sampleMotion(laneId(lane),time,{duration:state.duration,distance:state.distance,origin:0,...laneOptions(lane)});
const normalized=(lane,u)=>sampleCurve(laneId(lane),u,laneOptions(lane));
function time(){return state.playing?clamp(clockOffset+(performance.now()-clockStart)/1000,0,span):state.time;}
function notify(message){$('notice').textContent=message;$('notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('visible'),3000);}
function pause(){state.time=time();state.playing=false;updateTransport();dirty=true;}
function play(){if(state.playing)return;if(state.time>=span-.001)state.time=0;clockOffset=state.time;clockStart=performance.now();state.playing=true;updateTransport();dirty=true;}
function seek(value){const running=state.playing;pause();state.time=clamp(Number(value)||0,0,span);draw();if(running&&state.time<span)play();}
function updateTransport(){$('playButton').textContent=state.playing?'Ⅱ 暂停':'▶ 播放一次';$('playButton').setAttribute('aria-label',state.playing?'暂停':'播放一次');}
function responseEnd(lane){
  const id=laneId(lane),p=laneOptions(lane);if(id==='spring-underdamped')return Math.max(1,6.3/(p.zeta*p.omega));if(id==='spring-critical')return Math.max(1,12/p.omega);return 1;
}
function rebuildPlot(){
  const end=Math.max(responseEnd('A'),responseEnd('B'));span=end*state.duration+.8;
  // Zoom the chart without cutting the simulation. A slow physical spring can
  // take many T to settle; its tail must not compress another curve to a pixel.
  const uMax=state.graphRange==='full'?span/state.duration:1.4,lanes={};
  for(const lane of ['A','B']){
    const events=normalized(lane,0).discontinuities;
    const us=new Set(Array.from({length:641},(_,i)=>i*uMax/640));
    for(const e of events)if(e.u>=0&&e.u<=uMax){us.add(e.u);if(e.u>0)us.add(Math.max(0,e.u-1e-7));us.add(Math.min(uMax,e.u+1e-7));}
    lanes[lane]={samples:[...us].sort((a,b)=>a-b).map(u=>normalized(lane,u)),events};
  }
  plotData={uMax,lanes};
  $('seekInput').max=span.toFixed(6);
  const hasSpring=['A','B'].some(l=>meta(l).domain==='settling');
  $('clockNote').textContent=hasSpring?`观察到 ${span.toFixed(2)} 秒。弹簧在 T 后继续响应，有限观察不代表完全停止；默认不循环。`:'走完后保留 0.8 秒读窗，不自动循环。空格播放 / 暂停，← → 逐帧。';
  $('spacingNote').textContent=`小点：0–T 内每隔 ${(state.duration/20).toFixed(2)} s 记录一次 · A/B 同时刻`;
  const nonsmooth=['A','B'].filter(l=>plotData.lanes[l].events.some(e=>e.order<3));
  $('derivativeNote').textContent=`时长减半，同一路程的速度变成 2 倍、加速度变成 4 倍。${nonsmooth.length?`${nonsmooth.join('/')} 在虚线所示接点存在导数跳变；速度突变对应冲量，不能用有限加速度峰代替。`:'位移与一、二阶导数接入停留段时连续；这不等于所有更高阶导数都连续。'}`;
}
function mutate(change,{parameters=false,preserveNormalized=false}={}){
  const running=state.playing,oldU=time()/state.duration;pause();change();rebuildPlot();state.time=clamp(preserveNormalized?oldU*state.duration:state.time,0,span);refresh(parameters);if(running&&state.time<span)play();
}
function select(lane,id){if(!presets.has(id))return;mutate(()=>{state[lane.toLowerCase()]=id;state[`options${lane}`]=defaults(id);state.edit=lane;},{parameters:true});}
function text(c,value,x,y,size=20,color=C.ink,align='left',weight=500){c.font=`${weight} ${size}px "Microsoft YaHei",sans-serif`;c.fillStyle=color;c.textAlign=align;c.fillText(value,x,y);}
function line(c,x1,y1,x2,y2,color=C.line,width=1,dash=[]){c.beginPath();c.setLineDash(dash);c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();c.setLineDash([]);}
function box(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
function circle(c,x,y,r,fill,stroke){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
function nice(value){if(Math.abs(value)<1e-8)return'0';if(Math.abs(value)>=1000)return value.toFixed(0);if(Math.abs(value)>=10)return value.toFixed(1);return value.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');}
function stageBackground(){const g=ctx.createLinearGradient(0,0,1200,600);g.addColorStop(0,'#19323f');g.addColorStop(.55,'#111e2a');g.addColorStop(1,'#172733');ctx.fillStyle=g;ctx.fillRect(0,0,1200,600);line(ctx,32,298,1168,298,'#45647465',1);}
function laneLabel(lane,y){const color=lane==='A'?C.a:C.b;text(ctx,lane,45,y,27,color,'left',700);text(ctx,meta(lane).title,85,y,24,C.ink,'left',600);}
// Shared framing leaves room for the full allowed anticipation and spring
// overshoot. Never clamp one lane or its sampled curve to keep it on screen.
function trackMap(position){return 290+position*.58;}
function spacing(lane,y){
  const color=lane==='A'?C.a:C.b;
  for(let i=0;i<=20;i++){const s=motion(lane,state.duration*i/20);circle(ctx,trackMap(s.position),y,3.2,color+'77');}
  line(ctx,trackMap(0),y-10,trackMap(0),y+10,C.muted,1);line(ctx,trackMap(state.distance),y-10,trackMap(state.distance),y+10,C.muted,1);
  text(ctx,'0',trackMap(0),y+31,17,C.muted,'center');text(ctx,`${state.distance} px`,trackMap(state.distance),y+31,17,C.muted,'center');
}
function drawObject(lane,t,y){
  const s=motion(lane,t),color=lane==='A'?C.a:C.b,x=trackMap(s.position);laneLabel(lane,y-94);line(ctx,145,y+29,1140,y+29,'#57737c',2);
  for(let i=0;i<15;i++)line(ctx,180+i*60,y+29,180+i*60,y+34,'#49636e',1);
  const shadow=ctx.createRadialGradient(x,y+31,0,x,y+31,79);shadow.addColorStop(0,'#0008');shadow.addColorStop(1,'#0000');ctx.fillStyle=shadow;ctx.fillRect(x-85,y+13,170,40);
  const grad=ctx.createLinearGradient(x-46,y-27,x+46,y+24);grad.addColorStop(0,color);grad.addColorStop(.2,lane==='A'?'#659ca8':'#af8d60');grad.addColorStop(1,'#2b4554');box(ctx,x-46,y-29,92,58,12,grad,'#d4e2e377');line(ctx,x-32,y-17,x+32,y-17,'#ffffff55',2);circle(ctx,x-30,y+12,4,'#18313d','#c7d9de77');circle(ctx,x+30,y+12,4,'#18313d','#c7d9de77');
  if(laneId(lane)==='impact-rebound'){line(ctx,trackMap(state.distance)+47,y-48,trackMap(state.distance)+47,y+30,color,4);text(ctx,'接触面',trackMap(state.distance)+57,y-40,16,color);}
  spacing(lane,y+62);
  const arrow=Math.sign(s.velocity)*Math.min(80,Math.abs(s.velocity)*.07);if(Math.abs(arrow)>1){line(ctx,x,y-47,x+arrow,y-47,color,2);line(ctx,x+arrow,y-47,x+arrow-Math.sign(arrow)*7,y-52,color,2);}
}
function drawType(lane,t,y){
  const s=motion(lane,t),color=lane==='A'?C.a:C.b,x=trackMap(s.position);laneLabel(lane,y-94);
  const target=trackMap(state.distance);line(ctx,target,y-46,target,y+28,'#61737b77',1,[4,7]);text(ctx,'文字停靠线',target,y-55,15,C.muted,'center');
  text(ctx,'看清变化',x,y+3,41,color,'center',650);line(ctx,x-83,y+21,x+83,y+21,color+'44',2);
  spacing(lane,y+64);
}
function cameraPanel(lane,t,y){
  const s=motion(lane,t),color=lane==='A'?C.a:C.b;laneLabel(lane,y-94);
  const left=410,top=y-60,w=700,h=150,centerX=left+w/2,centerY=top+76;
  ctx.save();ctx.beginPath();ctx.roundRect(left,top,w,h,12);ctx.clip();const bg=ctx.createLinearGradient(0,top,0,top+h);bg.addColorStop(0,'#0d1e2a');bg.addColorStop(1,'#203540');ctx.fillStyle=bg;ctx.fillRect(left,top,w,h);
  const cameraZ=s.position/800*7;
  const project=(x,yy,z)=>{const depth=z-cameraZ;return{x:centerX+x*260/depth,y:centerY+yy*260/depth,depth};};
  for(let i=-6;i<=6;i++){const a=project(i*2,2,14),b=project(i*2,2,50);line(ctx,a.x,a.y,b.x,b.y,'#54778455',1);}
  for(let z=15;z<=45;z+=3){const a=project(-14,2,z),b=project(14,2,z);line(ctx,a.x,a.y,b.x,b.y,'#6483904d',1);}
  for(const z of [42,34,26,18]){const p=project(0,0,z),width=940/p.depth,height=1160/p.depth;box(ctx,p.x-width/2,p.y-height/2,width,height,Math.max(1,width*.035),'#172f3a',color+(z===18?'bb':'55'));line(ctx,p.x-width/2,p.y-height/2,p.x+width/2,p.y-height/2,color,2);}
  line(ctx,centerX-6,centerY,centerX+6,centerY,'#cedade66',1);line(ctx,centerX,centerY-6,centerX,centerY+6,'#cedade66',1);ctx.restore();
  text(ctx,`推进 ${nice(s.position)} px`,54,y-28,19,color);text(ctx,'固定朝向与焦距',54,y+1,17,C.muted);text(ctx,'Canvas 透视示例',54,y+28,17,C.muted);
  // Track the camera itself separately from the view it sees.
  const start=70,end=345,zx=start+(s.position/1500)*(end-start);line(ctx,start,y+65,end,y+65,'#567480',2);for(let i=0;i<=20;i++){const x=start+motion(lane,state.duration*i/20).position/1500*(end-start);circle(ctx,x,y+65,2.6,color+'77');}box(ctx,zx-7,y+56,14,16,3,color);text(ctx,'镜头位置 / 0–T 等时距点',70,y+99,14,C.muted);
}
function drawStage(t){
  stageBackground();const draw=state.mode==='camera'?cameraPanel:state.mode==='type'?drawType:drawObject;draw('A',t,175);draw('B',t,435);
  const maxResponse=Math.max(responseEnd('A'),responseEnd('B'))*state.duration;
  $('phaseLabel').textContent=t>=maxResponse?(['A','B'].some(l=>meta(l).domain==='settling')?'观察尾段 · 弹簧仍在衰减':'稳定读窗'):t>=state.duration?'继续观察响应':'运动段';
}
const chartBox={l:73,r:570,t:22,b:252};
function drawChart(id,field,t){
  const cv=$(id),c=cv.getContext('2d'),W=600,H=310;c.clearRect(0,0,W,H);c.fillStyle='#111e29';c.fillRect(0,0,W,H);
  const all=['A','B'].flatMap(l=>plotData.lanes[l].samples.map(s=>s[field]));let lo=Math.min(0,...all),hi=Math.max(field==='position'?1:0,...all);if(Math.abs(hi-lo)<1e-5){lo=-.5;hi=.5;}const pad=(hi-lo)*.1;lo-=pad;hi+=pad;
  const x=u=>chartBox.l+u/plotData.uMax*(chartBox.r-chartBox.l),y=v=>chartBox.b-(v-lo)/(hi-lo)*(chartBox.b-chartBox.t);
  for(let i=0;i<=4;i++){const u=plotData.uMax*i/4;line(c,x(u),chartBox.t,x(u),chartBox.b,'#3a536044',1);text(c,nice(u),x(u),278,21,C.muted,'center');}
  for(let i=0;i<=3;i++){const v=lo+(hi-lo)*i/3;line(c,chartBox.l,y(v),chartBox.r,y(v),'#3a536044',1);text(c,nice(v),chartBox.l-10,y(v)+6,20,C.muted,'right');}
  if(lo<=0&&hi>=0)line(c,chartBox.l,y(0),chartBox.r,y(0),'#64818d',1.5);
  if(field==='position')line(c,chartBox.l,y(1),chartBox.r,y(1),'#77909b55',1,[4,8]);
  for(const lane of ['A','B']){
    const color=lane==='A'?C.a:C.b,data=plotData.lanes[lane];
    const relevant=data.events.filter(e=>e.order<=(field==='position'?0:field==='velocity'?1:2));
    c.beginPath();let previous=null;
    for(const s of data.samples){
      // The exact event sample can be either left-sided (finite endpoint) or
      // right-sided (impact). Break on both adjacent intervals; endpoint
      // markers below display the actual left and right derivative values.
      const crossed=previous&&relevant.some(e=>e.u>=previous.u&&e.u<=s.u);
      if(!previous||crossed)c.moveTo(x(s.u),y(s[field]));else c.lineTo(x(s.u),y(s[field]));previous=s;
    }c.strokeStyle=color;c.lineWidth=3;c.stroke();
    for(const e of relevant){line(c,x(e.u),chartBox.t,x(e.u),chartBox.b,color+'65',1,[4,5]);for(const side of ['left','right'])circle(c,x(e.u),y(e[side][field]),3.5,side==='right'?color:'#111e29',color);}
    const current=normalized(lane,t/state.duration);if(current.u<=plotData.uMax)circle(c,x(current.u),y(current[field]),5,color);
  }
  if(t/state.duration<=plotData.uMax)line(c,x(t/state.duration),chartBox.t,x(t/state.duration),chartBox.b,'#e5e4db66',1);text(c,'u = t / T',chartBox.r,304,19,C.muted,'right');
}
function updateReadout(lane,t){const s=motion(lane,t),row=$(`readout${lane}`),data=[`${lane} · ${meta(lane).title}`,`${nice(s.position)} px`,`${nice(s.velocity)} px/s`,`${nice(Math.abs(s.velocity))} px/s`,`${nice(s.acceleration)} px/s²`];for(let i=0;i<data.length;i++)row.children[i].textContent=data[i];}
function draw(){const t=time();drawStage(t);for(const [id,field]of graphs)drawChart(id,field,t);for(const lane of ['A','B'])updateReadout(lane,t);$('timeDisplay').textContent=`${t.toFixed(2)} / ${span.toFixed(2)} s`;$('seekInput').value=t;$('frameLabel').textContent=`第 ${Math.round(t*state.fps)} 帧 · u=${(t/state.duration).toFixed(2)}`;
  $('plotRangeNote').textContent=state.graphRange==='full'?`完整响应：0–${plotData.uMax.toFixed(2)}T（${span.toFixed(2)} 秒）；主要动作可切回放大查看。`:`主运动：0–1.4T。${t/state.duration>1.4?`当前 u=${(t/state.duration).toFixed(2)} 在图外，可切换完整响应。`:'长尾仍在计算，切换完整响应可查看。'}`;dirty=false;}
function tick(){if(state.playing||dirty)draw();if(state.playing&&time()>=span){state.time=span;state.playing=false;updateTransport();dirty=true;}raf=requestAnimationFrame(tick);}
function parameterControls(){
  const lane=state.edit,preset=meta(lane),holder=$('curveParameters');holder.replaceChildren();
  if(!preset.parameters.length){const p=document.createElement('p');p.className='no-parameters';p.textContent='这条曲线的形状固定。试着改时长，观察同一曲线怎样改变分量。';holder.append(p);}
  for(const p of preset.parameters){
    const block=document.createElement('div');block.className='parameter';const head=document.createElement('div');head.className='control-title';const label=document.createElement('label');label.htmlFor=`parameter-${p.key}`;label.textContent=p.label;const output=document.createElement('output');output.id=`parameter-value-${p.key}`;output.textContent=String(laneOptions(lane)[p.key]);head.append(label,output);const input=document.createElement('input');input.type='range';input.id=`parameter-${p.key}`;input.min=p.min;input.max=p.max;input.step=p.step;input.value=laneOptions(lane)[p.key];input.setAttribute('aria-label',`${lane} ${p.label}`);input.addEventListener('input',()=>mutate(()=>{laneOptions(lane)[p.key]=Number(input.value);}));block.append(head,input);holder.append(block);
  }
  $('curveBoundary').textContent=`边界：${preset.boundaryContinuity}`;
}
function refresh(parameters=false){
  $('curveA').value=state.a;$('curveB').value=state.b;$('durationInput').value=state.duration;$('durationValue').textContent=`${state.duration.toFixed(1)} s`;$('distanceInput').value=state.distance;$('distanceValue').textContent=`${state.distance} px`;$('fpsSelect').value=state.fps;
  for(const lane of ['A','B'])$(`edit${lane}`).setAttribute('aria-pressed',String(state.edit===lane));
  $('plotMainButton').setAttribute('aria-pressed',String(state.graphRange==='main'));$('plotFullButton').setAttribute('aria-pressed',String(state.graphRange==='full'));
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
  const p=meta(state.edit);$('activeTitle').textContent=`${state.edit} · ${p.title}`;$('activeFeeling').textContent=p.feeling;$('activeUse').textContent=p.useCase;$('activeRisk').textContent=p.risk;
  if(parameters)parameterControls();else for(const p of meta(state.edit).parameters){const out=$(`parameter-value-${p.key}`);if(out)out.textContent=String(laneOptions(state.edit)[p.key]);}
  $('modeNote').textContent=state.mode==='camera'?'固定路径、朝向与焦距 · Canvas 透视示例':state.mode==='type'?'同一句文字 · 位移曲线控制进入与停靠':'同一物体 · 同一路径 · 相同距离';
  if(state.mode==='camera'&&[state.a,state.b].includes('impact-rebound'))$('modeNote').textContent='碰撞曲线会让镜头突然变速；此处仅用于比较，不建议用于成片。';
  updateCards();updateTransport();dirty=true;draw();
}
function miniCurve(cv,preset){const c=cv.getContext('2d'),w=cv.width,h=cv.height,opts=defaults(preset.id),uMax=preset.domain==='settling'?1.5:1;const data=Array.from({length:121},(_,i)=>sampleCurve(preset.id,i*uMax/120,opts));const lo=Math.min(0,...data.map(v=>v.position))-.07,hi=Math.max(1,...data.map(v=>v.position))+.07,x=u=>12+u/uMax*(w-24),y=v=>h-9-(v-lo)/(hi-lo)*(h-18);c.clearRect(0,0,w,h);line(c,12,y(0),w-12,y(0),'#53707d44',1);line(c,12,y(1),w-12,y(1),'#53707d44',1,[4,7]);c.beginPath();data.forEach((p,i)=>i?c.lineTo(x(p.u),y(p.position)):c.moveTo(x(p.u),y(p.position)));c.strokeStyle=state.b===preset.id?C.b:state.a===preset.id?C.a:'#a1b9c5';c.lineWidth=2.5;c.stroke();}
function createCards(){for(const [i,p]of PRESETS.entries()){
  const article=document.createElement('article');article.className='curve-card';article.dataset.curve=p.id;
  const top=document.createElement('div');top.className='card-top';const index=document.createElement('span');index.className='card-number';index.textContent=String(i+1).padStart(2,'0');const badges=document.createElement('div');badges.className='card-badges';top.append(index,badges);const h=document.createElement('h3');h.textContent=p.title;const cv=document.createElement('canvas');cv.className='mini-curve';cv.width=360;cv.height=100;cv.setAttribute('aria-hidden','true');const dl=document.createElement('dl');for(const [title,copy]of [['感觉',p.feeling],['用途',p.useCase],['留意',p.risk]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=title;dd.textContent=copy;dl.append(dt,dd);}const actions=document.createElement('div');actions.className='card-actions';for(const lane of ['A','B']){const b=document.createElement('button');b.dataset.lane=lane;b.textContent=`设为 ${lane}`;b.setAttribute('aria-label',`${p.title}设为${lane}曲线`);b.addEventListener('click',()=>{select(lane,p.id);notify(`${lane} 已选：${p.title}`);});actions.append(b);}article.append(top,h,cv,dl,actions);$('curveCards').append(article);
}}
function updateCards(){for(const p of PRESETS){const card=document.querySelector(`[data-curve="${p.id}"]`);card.classList.toggle('selected-a',state.a===p.id);card.classList.toggle('selected-b',state.b===p.id);const badges=card.querySelector('.card-badges');badges.replaceChildren();for(const lane of ['A','B'])if(laneId(lane)===p.id){const badge=document.createElement('span');badge.className=lane.toLowerCase();badge.textContent=lane;badges.append(badge);}miniCurve(card.querySelector('canvas'),p);}}
function exportData(){return {schema:'motion-atelier.rate-curves/v1',mode:state.mode,duration:state.duration,distance:state.distance,origin:0,units:{time:'seconds',distance:'canvas-logical-px',normalizedTime:'u=t/T',velocity:'signed dx/dt',speed:'abs(dx/dt)'},fps:state.fps,lanes:Object.fromEntries(['A','B'].map(l=>[l,{id:laneId(l),parameters:{...laneOptions(l)},domain:meta(l).domain}])),preview:{observationDuration:span,automaticLoop:false,canvasPerspectiveOnly:state.mode==='camera',graphRange:state.graphRange,graphUMax:plotData.uMax,spacingTimeRange:[0,state.duration],spacingInterval:state.duration/20},notice:'物理弹簧不会在duration强行停止；碰撞不连续处返回指定侧有限导数，冲量需单独处理。'};}
function code(){const config=exportData();return `// 与 rate-curves.js 放在同一目录。无实时钟、无随机数。\nimport {sampleMotion} from './rate-curves.js';\n\nexport const motionPlan = ${JSON.stringify(config,null,2)};\n\nexport function frameState(frame, fps = motionPlan.fps) {\n  const timeSeconds = frame / fps;\n  return Object.fromEntries(Object.entries(motionPlan.lanes).map(([lane, choice]) => {\n    const sample = sampleMotion(choice.id, timeSeconds, {\n      duration: motionPlan.duration,\n      distance: motionPlan.distance,\n      origin: motionPlan.origin,\n      ...choice.parameters,\n    });\n    return [lane, {...sample, speed: Math.abs(sample.velocity)}];\n  }));\n}\n\n// const {A, B} = frameState(frame);\n// mesh.position.x = B.position;\n// 文字：transform: translateX(B.position + 'px')。\n// 相机：把 position 作为路径距离，再求路径上的真实位置。\n// 弹簧保留尾巴；实际成片另行核对镜头边界、遮挡与采样。\n`;}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const downloadCode=()=>{download(new Blob([code()],{type:'text/javascript'}),'rate-curve-selection.mjs');notify('实际参数与代码已交给浏览器下载。');};
for(const lane of ['A','B']){
  const selectEl=$(`curve${lane}`);for(const p of PRESETS){const o=document.createElement('option');o.value=p.id;o.textContent=p.title;selectEl.append(o);}selectEl.addEventListener('change',()=>select(lane,selectEl.value));
  const row=$(`readout${lane}`);for(let i=0;i<5;i++)row.append(document.createElement('span'));
  $(`edit${lane}`).addEventListener('click',()=>{state.edit=lane;refresh(true);});
}
$('playButton').addEventListener('click',()=>state.playing?pause():play());$('replayButton').addEventListener('click',()=>{pause();state.time=0;play();});$('stopButton').addEventListener('click',()=>{pause();state.time=0;draw();});
$('seekInput').addEventListener('input',e=>seek(e.target.value));$('durationInput').addEventListener('input',e=>mutate(()=>{state.duration=Number(e.target.value);},{preserveNormalized:true}));$('distanceInput').addEventListener('input',e=>mutate(()=>{state.distance=Number(e.target.value);}));$('fpsSelect').addEventListener('change',e=>{state.fps=Number(e.target.value);refresh();});
$('swapButton').addEventListener('click',()=>mutate(()=>{[state.a,state.b]=[state.b,state.a];[state.optionsA,state.optionsB]=[state.optionsB,state.optionsA];},{parameters:true}));$('resetCurveButton').addEventListener('click',()=>mutate(()=>{state[`options${state.edit}`]=defaults(laneId(state.edit));},{parameters:true}));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;refresh();}));
for(const [id,range]of [['plotMainButton','main'],['plotFullButton','full']])$(id).addEventListener('click',()=>{state.graphRange=range;rebuildPlot();refresh();});
$('exportJsonButton').addEventListener('click',()=>{download(new Blob([JSON.stringify(exportData(),null,2)],{type:'application/json'}),'rate-curve-selection.json');notify('A/B 参数已交给浏览器下载。');});$('exportCodeButton').addEventListener('click',downloadCode);$('dialogDownloadButton').addEventListener('click',downloadCode);$('showCodeButton').addEventListener('click',()=>{$('codeContent').textContent=code();$('codeDialog').showModal();});$('closeCodeButton').addEventListener('click',()=>$('codeDialog').close());
function key(event){if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();seek(time()+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?.5:1/state.fps));}else if(event.code==='Space'){event.preventDefault();state.playing?pause():play();}}
canvas.addEventListener('keydown',key);for(const [id]of graphs){const cv=$(id);cv.addEventListener('keydown',key);cv.addEventListener('pointerdown',event=>{const r=cv.getBoundingClientRect(),u=clamp(((event.clientX-r.left)*600/r.width-chartBox.l)/(chartBox.r-chartBox.l),0,1)*plotData.uMax;seek(u*state.duration);cv.focus();});}
document.addEventListener('keydown',event=>{if(event.code!=='Space'||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('button,input,select,textarea,a,[contenteditable]')||$('codeDialog').open)return;event.preventDefault();state.playing?pause():play();});
function preference(){if(reduced.matches){pause();$('motionPreference').textContent='已检测到减少动态效果偏好：默认静止，只有点击播放才运动；无自动循环。';}else $('motionPreference').textContent='默认不自动播放，也不自动循环。可用方向键逐帧观察。';}reduced.addEventListener('change',preference);window.addEventListener('resize',()=>{dirty=true;});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.playing)pause();});window.addEventListener('pagehide',()=>{pause();cancelAnimationFrame(raf);});
window.rateCurveLab={getState:()=>({...state,time:time(),observationDuration:span,reducedMotion:reduced.matches}),getExport:exportData,getCode:code,getSamples:t=>({A:motion('A',t),B:motion('B',t)}),presets:PRESETS};
createCards();rebuildPlot();preference();refresh(true);raf=requestAnimationFrame(tick);
