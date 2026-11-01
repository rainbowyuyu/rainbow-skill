/** Original signal choreography and synthesis. No reference soundtrack, logo or data.
 * Canvas perspective illustration; the rays are designed trajectories, not physics.
 * Absolute-time sampling keeps reverse scrubbing and export deterministic.
 */
export const duration = 24;
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x*x*x*(x*(x*6-15)+10); };
const mix = (a,b,t) => a + (b-a)*t;
const copy = v => JSON.parse(JSON.stringify(v));
const palette = ['#7be6d1','#f4bd7a','#b7a5ff'];
export const candidates = [
  {id:'pulse',title:'脉冲接力',duration,description:'快进、落点、停留。三次动作各有一个结果，主重音落在会合完成时。'},
  {id:'legato',title:'连奏航行',duration,description:'让长轨迹和声音尾部跨过段落；动作更宽，只有重要交接使用短音。'},
  {id:'suspended',title:'悬停后释放',duration,description:'会合前留出悬停，撤去节拍；准备结束后再把能量交给向远处的运动。'},
];
const timings = {
  pulse:[[0,0],[1.2,1],[3.6,4],[4.5,6],[5.4,6],[8.4,10],[10.2,11],[11.4,11],[14.4,14],[15.3,14],[19.2,20],[21.6,23],[24,24]],
  legato:[[0,0],[1.2,1],[4.8,4],[6,6],[6.6,6],[10.2,10],[12,11],[12.6,11],[15.6,14],[16.2,14],[20.4,20],[22.2,23],[24,24]],
  suspended:[[0,0],[1.2,1],[3.6,4],[4.8,6],[5.4,6],[8.4,10],[10.2,11],[13.2,11],[15.6,14],[16.2,14],[19.8,20],[21.6,23],[24,24]],
};
function definition(id='pulse') { if (!timings[id]) throw new RangeError(`Unknown arrangement: ${id}`); return timings[id]; }
function timeValue(t) { if(typeof t!=='number'||!Number.isFinite(t))throw new TypeError('Finite numeric seconds required');return clamp(t,0,duration); }
function storyAt(t,id) { const knots=definition(id);for(let i=1;i<knots.length;i++)if(t<=knots[i][0]){const a=knots[i-1],b=knots[i];return mix(a[1],b[1],smooth((t-a[0])/(b[0]-a[0])));}return 24; }
function atStory(s,id) { return definition(id).find(k=>k[1]===s)[0]; }
export function buildPlan(id='pulse') {
  const knots=definition(id), t=s=>atStory(s,id);
  const events=[
    {id:'emerge',kind:'chime',onset:.2,peak:.2,end:1.5,semantic:'三个信号进入同一空间',pan:-.45},
    {id:'relay-rise',kind:'air',onset:t(6)-.65,peak:t(6)-.07,end:t(6)+.18,semantic:'焦点接力的预备与抵达',pan:.4},
    {id:'relay-seat',kind:'chime',onset:t(6),peak:t(6),end:t(6)+.8,semantic:'接力完成，留下阅读窗',pan:.3},
    {id:'gather-rise',kind:'air',onset:t(14)-1.1,peak:t(14)-.04,end:t(14)+.3,semantic:'三条路线汇聚',pan:0},
    {id:'gather-seat',kind:'impact',onset:t(14),peak:t(14),end:t(14)+1.4,semantic:'会合完成的主要重音',pan:0},
    {id:'depart',kind:'air',onset:t(20)-1.6,peak:t(20)-.25,end:t(20)+.55,semantic:'结果向远处延伸，尾响跨过下一段',pan:.6},
    {id:'resolve',kind:'chime',onset:t(23),peak:t(23),end:23.9,semantic:'最后确认，声音退场',pan:.15},
  ];
  if(id==='legato') events.splice(2,1);
  const readHolds=knots.slice(1).flatMap((k,i)=>k[1]===knots[i][1]?[{start:knots[i][0],end:k[0],storyTime:k[1]}]:[]);
  return {schema:'motion-atelier.signal-relay/v1',id,duration,bpm:100,origin:'original-illustration',
    question:'怎样让三个连续动作既有音乐的起伏，也让观众看懂交接？',
    music:{origin:'original-procedural-synthesis',bpm:100,beatSeconds:.6,note:'原创练习配乐的设定值，不是参考视频的测量 BPM。'},
    timeMap:copy(knots),events,readHolds,
    chapters:[{time:0,title:'三个信号'},{time:t(4),title:'焦点接力'},{time:t(10),title:'靠近会合'},{time:t(14),title:'完成会合'},{time:t(20),title:'向远处延伸'},{time:t(23),title:'结果停留'}],
    evidence:'从连续光轨、身份持续与焦点接力提炼的原创试作；不代表参考原片精确复刻。'};
}
function track(p,i) {
  const q=clamp(p), convergence=1-smooth((q-.40)/(14/24-.40));
  const emergence=smooth((q-.64)/.30), separation=(i-1)*1.48;
  return {x:mix(-7,7,q),y:separation*convergence+Math.sin(q*TAU*.85+i*.55)*.28*convergence+(i-1)*.45*emergence,
    z:(i-1)*1.1*convergence+Math.sin(q*TAU*.65)*.5+(i-1)*.24*emergence};
}
function cameraAt(s) { const p=s/24;return {x:mix(-2.4,3.5,smooth(p)),y:.25+Math.sin(p*Math.PI)*.45,z:12.6-1.25*Math.sin(p*Math.PI),yaw:mix(-.10,.14,smooth(p)),roll:.018*Math.sin(p*TAU),focal:9.1}; }
function project(v,c) {
  const x=v.x-c.x,y=v.y-c.y, z=v.z;
  const xr=x*Math.cos(c.yaw)-z*Math.sin(c.yaw),zr=x*Math.sin(c.yaw)+z*Math.cos(c.yaw), depth=c.z-zr;
  const scale=c.focal/depth;
  return {x:.5+(xr*Math.cos(c.roll)-y*Math.sin(c.roll))*scale*.066,y:.51-(xr*Math.sin(c.roll)+y*Math.cos(c.roll))*scale*.118,scale,depth};
}
export function sample(t,{id='pulse'}={}) {
  t=timeValue(t); const s=storyAt(t,id),p=s/24,plan=buildPlan(id),camera=cameraAt(s);
  const focusId=s<6?'signal-a':s<11?'signal-b':s<14?'signal-c':'relay';
  const stage=s<4?'01 · 建立三条路线':s<10?'02 · 把焦点交给下一条':s<14?'03 · 会合前，留一口气':s<20?'04 · 一个结果，承接所有动作':'05 · 把结果送向远处';
  const caption=s<4?'三条路线，同一个去处。':s<10?'方向保持，注意力接力。':s<14?'先看清靠近，再等会合。':s<20?'会合完成，让重音落下。':'轨迹不断，故事继续。';
  const signals=['a','b','c'].map((key,i)=>{const position=track(p,i);return {id:`signal-${key}`,label:['青岚','琥光','紫序'][i],color:palette[i],position,screen:project(position,camera),alpha:smooth(t/.7),trailStart:Math.max(0,p-.5),trailEnd:p};});
  const recent=plan.events.filter(e=>t>=e.onset&&t<=e.end),energy=recent.reduce((m,e)=>Math.max(m,Math.sin(clamp((t-e.onset)/(e.end-e.onset))*Math.PI)),0);
  return {id,time:t,storyTime:s,stage,caption,focusId,camera,signals,energy,reading:plan.readHolds.some(h=>t>=h.start&&t<=h.end),events:copy(recent),
    annotation:'原创连续运动示意 · 非实测信号传播',gathered:s>=14,merge:smooth((s-11)/3)};
}
function line(ctx,points,color,width,alpha=1) {ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.globalAlpha=1;}
function circle(ctx,x,y,r,fill) {ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,Math.max(.01,r),0,TAU);ctx.fill();}
function label(ctx,text,x,y,size,color='#edf4f6',weight=600) {ctx.font=`${weight} ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;ctx.fillStyle=color;ctx.fillText(text,x,y);}
const stars=Array.from({length:110},(_,i)=>({x:((Math.sin(i*74.71+2)*43758.5)%1+1)%1,y:((Math.sin(i*34.25+19)*13758.5)%1+1)%1,depth:.25+(i%9)/12,r:.5+(i%4)*.22}));
export function draw(ctx,t,width,height,{id='pulse'}={}) {
  const s=sample(t,{id}),w=1600,h=900;ctx.save();ctx.scale(width/w,height/h);ctx.clearRect(0,0,w,h);ctx.fillStyle='#050b14';ctx.fillRect(0,0,w,h);
  const sky=ctx.createRadialGradient(790,435,70,800,460,900);sky.addColorStop(0,'#102333');sky.addColorStop(.55,'#091420');sky.addColorStop(1,'#030711');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  for(const star of stars){const x=((star.x*w-s.camera.x*star.depth*16)%w+w)%w,y=star.y*h;circle(ctx,x,y,star.r,`rgba(165,199,214,${.12+star.depth*.22})`);}
  // Quiet curved reference arcs give one shared world behind all tracks.
  ctx.save();ctx.translate(820-s.camera.x*10,480);ctx.scale(1,.32);ctx.strokeStyle='#8cb7cb';ctx.lineWidth=1.2;ctx.globalAlpha=.065;
  for(const r of [210,440,680,920]){ctx.beginPath();ctx.arc(0,0,r,Math.PI*.05,Math.PI*1.9);ctx.stroke();}ctx.restore();
  const pixel=v=>{const p=project(v,s.camera);return {x:p.x*w,y:p.y*h};};
  const sorted=[0,1,2].sort((a,b)=>s.signals[b].screen.depth-s.signals[a].screen.depth);
  for(const i of sorted){
    const signal=s.signals[i],future=Array.from({length:101},(_,j)=>pixel(track(j/100,i)));line(ctx,future,signal.color,1,.09);
    const count=100,trail=Array.from({length:count+1},(_,j)=>pixel(track(mix(signal.trailStart,signal.trailEnd,j/count),i)));
    // Segmented stroke controls falloff without adding random glitter every frame.
    for(let j=1;j<trail.length;j++){const a=(j/count)**1.45*signal.alpha;line(ctx,[trail[j-1],trail[j]],signal.color,13,a*.045);line(ctx,[trail[j-1],trail[j]],signal.color,5.4,a*.30);line(ctx,[trail[j-1],trail[j]],signal.color,2.4,a*.92);}
    const x=signal.screen.x*w,y=signal.screen.y*h,rr=7*signal.screen.scale;
    const g=ctx.createRadialGradient(x,y,0,x,y,40);g.addColorStop(0,signal.color+'80');g.addColorStop(.25,signal.color+'28');g.addColorStop(1,signal.color+'00');ctx.fillStyle=g;ctx.globalAlpha=signal.alpha;ctx.fillRect(x-40,y-40,80,80);circle(ctx,x,y,rr+1,signal.color);circle(ctx,x,y,rr*.45,'#f5ffff');ctx.globalAlpha=1;
    if(s.storyTime<11){const isFocus=s.focusId===signal.id;ctx.globalAlpha=signal.alpha*(isFocus?1:.53);label(ctx,signal.label,x+20,y-15,21,signal.color,700);label(ctx,isFocus?'当前焦点':'保持方向',x+21,y+12,12,'#9daeba',500);ctx.globalAlpha=1;}
  }
  const center=pixel(track(s.storyTime/24,1));
  // Local ellipses mark semantic arrivals; they never replace the shared track.
  for(const e of s.events){if(e.kind==='air')continue;const age=s.time-e.onset;if(age<0||age>.8)continue;const focus=s.signals.find(v=>v.id===s.focusId),anchor=focus?{x:focus.screen.x*w,y:focus.screen.y*h}:center,r=12+smooth(age/.8)*32;ctx.save();ctx.translate(anchor.x,anchor.y);ctx.rotate(-.24);ctx.globalAlpha=(1-smooth(age/.8))*.46;ctx.strokeStyle=focus?.color??'#d9f6e9';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(0,0,r,r*.42,0,0,TAU);ctx.stroke();ctx.restore();}
  if(s.storyTime>=11){const a=smooth((s.storyTime-11)/1.1);ctx.globalAlpha=a;label(ctx,s.gathered?'会合 / RELAY':'同一个锚点',center.x+30,center.y-40,23,'#eaf5f4',700);label(ctx,s.gathered?'三个身份，保留在同一条航线里':'方向、身份、运动都继续',center.x+31,center.y-12,15,'#9bb5c3',500);ctx.globalAlpha=1;}
  if(s.gathered){const r=24+(s.storyTime-14)*4;ctx.globalAlpha=(1-smooth((s.storyTime-14)/4))*.5;ctx.strokeStyle='#d9f6e9';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(center.x,center.y,r,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
  label(ctx,'SIGNAL / CONTINUITY',66,66,15,'#79b7b7',600);label(ctx,'让变化，接成一条线',64,112,31,'#e7eff3',700);
  ctx.textAlign='right';label(ctx,`${s.time.toFixed(2).padStart(5,'0')}  /  24.00`,1534,68,18,'#9aafbe',500);label(ctx,candidates.find(c=>c.id===id).title,1534,98,17,'#9aafbe',500);ctx.textAlign='left';
  const fade=smooth(s.time/.7);ctx.globalAlpha=fade;label(ctx,s.stage,68,757,16,'#94b9c2',600);label(ctx,s.caption,65,804,31,'#e9f1f5',650);label(ctx,s.reading?'观察窗口 · 让画面完成一句话':'同一轨迹 · 同一身份 · 同一事件时钟',68,841,14,'#7e96a7',500);ctx.globalAlpha=1;
  ctx.strokeStyle='#c4ddd9';ctx.globalAlpha=.18;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(68,712);ctx.lineTo(1532,712);ctx.stroke();ctx.globalAlpha=1;
  const barX=68,barY=880,barWidth=1464;ctx.fillStyle='#24414b';ctx.fillRect(barX,barY,barWidth,2);ctx.fillStyle='#89cebf';ctx.fillRect(barX,barY,barWidth*s.time/duration,2);
  ctx.restore();return s;
}

function stereo(n){return {left:new Float32Array(n),right:new Float32Array(n)};}
function addTone(stem,rate,start,seconds,freq,gain,pan=0,attack=.02,decay=.6){
  const a=Math.max(0,Math.round(start*rate)),b=Math.min(stem.left.length,Math.ceil((start+seconds)*rate)),l=Math.cos((pan+1)*Math.PI/4),r=Math.sin((pan+1)*Math.PI/4);
  for(let i=a;i<b;i++){const u=i/rate-start,env=smooth(u/attack)*Math.exp(-u/decay)*smooth((seconds-u)/Math.min(.2,seconds*.3)),v=(Math.sin(TAU*freq*u)+.19*Math.sin(TAU*freq*2*u))*.84*env*gain;stem.left[i]+=v*l;stem.right[i]+=v*r;}
}
function addAir(stem,rate,e,index){let seed=(701+index*7309)>>>0,filtered=0;const a=Math.round(e.onset*rate),b=Math.min(stem.left.length,Math.ceil(e.end*rate));
  for(let i=a;i<b;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;filtered=.965*filtered+.035*noise;const t=i/rate,p=clamp((t-e.onset)/(e.end-e.onset)),ramp=t<e.peak?smooth((t-e.onset)/(e.peak-e.onset)):1-smooth((t-e.peak)/(e.end-e.peak)),pan=mix(-e.pan,e.pan,smooth(p)),v=(noise*.18+filtered*2.1)*ramp*.055;stem.left[i]+=v*Math.cos((pan+1)*Math.PI/4);stem.right[i]+=v*Math.sin((pan+1)*Math.PI/4);}
}
export function renderAudio(id='pulse',sampleRate=48000) {
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw new RangeError('Sample rate must be an integer between 8000 and 192000');
  const plan=buildPlan(id),n=duration*sampleRate,music=stereo(n),sfx=stereo(n),left=new Float32Array(n),right=new Float32Array(n);
  const chords=[[146.832,174.614,220],[130.813,164.814,195.998],[116.541,146.832,174.614],[130.813,174.614,220]];
  // Slow harmonic bed persists across visual milestones; generated, not sampled.
  for(let bar=0;bar<4;bar++)for(let j=0;j<3;j++)addTone(music,sampleRate,bar*6,Math.min(7.5,duration-bar*6),chords[bar][j],.034,j*.6-.6,1.1,8);
  for(let beat=0;beat<40;beat++){
    const at=beat*.6,held=plan.readHolds.some(h=>at>h.start-.1&&at<h.end),suspense=id==='suspended'&&at>9.6&&at<13.8;
    if(suspense)continue;
    if(beat%4===0&&!held)addTone(music,sampleRate,at,.5,49,.1,0,.007,.18);
    if((id==='pulse'&&beat%2===0)||(id==='legato'&&beat%4===2)||(id==='suspended'&&beat%4===0)){
      const chord=chords[Math.min(3,Math.floor(at/6))],freq=chord[(beat/2|0)%3]*2;addTone(music,sampleRate,at+.05,.8,freq,held?.009:.028,Math.sin(beat)*.5,.015,.35);
    }
  }
  plan.events.forEach((e,i)=>{
    if(e.kind==='air')addAir(sfx,sampleRate,e,i);
    else if(e.kind==='impact'){addTone(sfx,sampleRate,e.onset,1.4,55,.20,0,.008,.24);addTone(sfx,sampleRate,e.onset,1.4,220,.06,0,.008,.55);}
    else {const span=e.end-e.onset;addTone(sfx,sampleRate,e.onset,span,i===0?440:523.251,.065,e.pan,.008,Math.max(.26,span*.35));addTone(sfx,sampleRate,e.onset+.075,span-.075,659.255,.026,e.pan,.018,Math.max(.23,(span-.075)*.30));}
  });
  let peak=0,sum=0,stemPeakMusic=0,stemPeakSfx=0;
  for(let i=0;i<n;i++){const t=i/sampleRate,envelope=smooth(t/.22)*smooth((duration-1/sampleRate-t)/.75);for(const stem of [music,sfx]){stem.left[i]*=envelope;stem.right[i]*=envelope;}left[i]=music.left[i]+sfx.left[i];right[i]=music.right[i]+sfx.right[i];peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));sum+=left[i]**2+right[i]**2;stemPeakMusic=Math.max(stemPeakMusic,Math.abs(music.left[i]),Math.abs(music.right[i]));stemPeakSfx=Math.max(stemPeakSfx,Math.abs(sfx.left[i]),Math.abs(sfx.right[i]));}
  return {left,right,sampleRate,stems:{music,sfx},metrics:{samplePeak:peak,rms:Math.sqrt(sum/(2*n)),stemPeakMusic,stemPeakSfx,clipped:peak>=1,listeningPerformed:false},plan};
}
