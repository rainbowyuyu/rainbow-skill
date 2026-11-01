import {scenes, getScenePlan, renderScene, visualState, encodeWav} from './sound-design.js';

// AudioContext is the only playback clock. Scene geometry uses absolute timeline
// time; changing the soundtrack never changes an object trajectory.
const $ = id => document.getElementById(id);
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = v => {const p=clamp(v);return p*p*p*(10+p*(-15+6*p));};
const mix = (a,b,p) => a+(b-a)*p;
const colors={ink:'#ece9de',muted:'#8ca3b0',gold:'#edbb78',cyan:'#79dcda',coral:'#ed8e7e',line:'#304755'};
const soundNames={'room-air':'空间底声','metal-contact':'金属接触','wood-contact':'木质接触','air-passby':'空气经过','air-rise':'预备上扬','servo':'机械转动','ui-confirm':'完成确认','low-impact':'低频落定'};
const sceneHints=['接触与瞬态','主次与密度','尾音与阅读','速度与声像','让位与恢复'];
const state={sceneId:scenes[0].id,variant:'B',time:0,playing:false,muted:false,speed:1,fps:30,offsetMs:0,intensity:1,gainDb:0,includeSpeechPlaceholder:false};
let audio=null,master=null,source=null,sourceGain=null,clockStart=0,clockOffset=0,epoch=0,pending=false,noticeTimer,redraw=true;
let plan=getScenePlan(state.sceneId,state.variant,options());
const cache=new Map();
const canvas=$('sceneCanvas'),ctx=canvas.getContext('2d');
const timeline=$('timelineCanvas'),tx=timeline.getContext('2d');
const scene=()=>scenes.find(s=>s.id===state.sceneId);
function options(){return {sampleRate:48000,offsetMs:state.offsetMs,intensity:state.intensity,gainDb:state.gainDb,includeSpeechPlaceholder:state.includeSpeechPlaceholder};}
function timelineTime(){return state.playing&&audio?clamp(clockOffset+Math.max(0,audio.currentTime-clockStart)*state.speed,0,scene().duration):state.time;}
function notify(message){$('notice').textContent=message;$('notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('visible'),3200);}
function fail(error){pending=false;$('playButton').disabled=false;pause();$('renderStatus').textContent=`未完成：${error.message||error}`;notify(error.message||String(error));}
function holdGain(param,time){if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(time);else{const held=param.value;param.cancelScheduledValues(time);param.setValueAtTime(held,time);}}
function retireSource(){
  if(!source)return;const previous=source,gain=sourceGain;source=null;sourceGain=null;
  const now=audio.currentTime;holdGain(gain.gain,now);gain.gain.linearRampToValueAtTime(0,now+.03);
  try{previous.stop(now+.035);}catch{}
  previous.onended=()=>{previous.disconnect();gain.disconnect();};
}
function pause(){state.time=timelineTime();state.playing=false;pending=false;epoch++;retireSource();updateTransport();redraw=true;}
async function ensureAudio(){
  if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('此浏览器不支持 Web Audio。仍可查看时机与下载 WAV。');audio=new Audio();master=audio.createGain();master.gain.value=state.muted?0:1;master.connect(audio.destination);audio.addEventListener('statechange',()=>{if(audio.state!=='running'&&state.playing){pause();notify('音频被浏览器暂停，点击播放继续。');}});}
  if(audio.state!=='running')await audio.resume();if(audio.state!=='running')throw Error('浏览器尚未允许声音播放，请再次点击播放。');
}
function currentKey(){return JSON.stringify([state.sceneId,state.variant,options()]);}
async function rendered(){
  const key=currentKey();if(cache.has(key))return cache.get(key);
  const id=state.sceneId,variant=state.variant,opts=options();
  await new Promise(resolve=>setTimeout(resolve,0));
  const result=renderScene(id,variant,opts);cache.set(key,result);while(cache.size>4)cache.delete(cache.keys().next().value);
  if(key===currentKey())$('renderStatus').textContent=`48 kHz · 双声道 · ${result.duration.toFixed(1)} s · 样本峰值 ${result.metrics.samplePeakDbFS.toFixed(1)} dBFS`;
  return result;
}
async function play(){
  if(state.playing||pending)return;const ticket=++epoch;pending=true;$('playButton').disabled=true;
  try{
    await ensureAudio();if(ticket!==epoch)return;const result=await rendered();if(ticket!==epoch)return;
    if(result.metrics.samplePeak>1)throw Error('当前增益超过满刻度，请降低增益后试听或导出。');
    if(state.time>=scene().duration-.001)state.time=0;
    const buffer=audio.createBuffer(2,result.left.length,result.sampleRate);buffer.copyToChannel(result.left,0);buffer.copyToChannel(result.right,1);
    const next=audio.createBufferSource(),gain=audio.createGain();next.buffer=buffer;next.playbackRate.value=state.speed;next.connect(gain);gain.connect(master);
    clockOffset=state.time;clockStart=audio.currentTime+.04;gain.gain.setValueAtTime(0,clockStart);gain.gain.linearRampToValueAtTime(1,clockStart+.03);source=next;sourceGain=gain;
    next.onended=()=>{if(source!==next)return;state.time=scene().duration;state.playing=false;source=null;sourceGain=null;next.disconnect();gain.disconnect();updateTransport();redraw=true;};
    next.start(clockStart,state.time);state.playing=true;pending=false;updateTransport();redraw=true;
  }catch(error){if(ticket===epoch)fail(error);}finally{if(ticket===epoch){pending=false;$('playButton').disabled=false;}}
}
function updateTransport(){
  $('playButton').disabled=pending;$('playButton').innerHTML=state.playing?'Ⅱ <span>暂停</span>':'▶ <span>播放</span>';$('playButton').setAttribute('aria-label',state.playing?'暂停':'播放');
  $('muteButton').setAttribute('aria-pressed',String(state.muted));$('muteButton').textContent=state.muted?'已静音':'声音开';
  $('audioStatus').textContent=!audio?'点击播放后启用声音':state.muted?'静音 · 时钟继续':state.playing?'Web Audio 同步播放':'声音已就绪';
}
function seek(time){const resume=state.playing||pending;pause();state.time=clamp(Number(time)||0,0,scene().duration);redraw=true;draw();if(resume&&state.time<scene().duration)void play();}
function mutate(change){const resume=state.playing||pending;pause();change();refresh();if(resume)void play();}
function refresh(){
  plan=getScenePlan(state.sceneId,state.variant,options());
  const s=scene(),index=scenes.indexOf(s),variant=s.variants.find(v=>v.id===state.variant);
  $('sceneIndex').textContent=`${String(index+1).padStart(2,'0')} / TIMING STUDY`;$('sceneTitle').textContent=s.title;$('sceneQuestion').textContent=s.question;
  document.querySelectorAll('.scene-button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scene===s.id)));
  for(const v of ['A','B'])$(`variant${v}`).setAttribute('aria-pressed',String(state.variant===v));
  $('variantTitle').textContent=variant.title;$('variantDescription').textContent=variant.description;
  $('seekInput').max=s.duration;$('offsetMs').value=state.offsetMs;$('offsetRange').value=state.offsetMs;$('offsetFrames').value=(state.offsetMs*state.fps/1000).toFixed(2);
  $('offsetFrames').min=-state.fps/2;$('offsetFrames').max=state.fps/2;
  $('intensityInput').value=state.intensity;$('intensityValue').textContent=`${state.intensity.toFixed(2)}×`;$('gainInput').value=state.gainDb;$('gainValue').textContent=`${state.gainDb>0?'+':''}${state.gainDb} dB`;
  $('placeholderInput').checked=state.includeSpeechPlaceholder;$('speedSelect').value=state.speed;$('fpsSelect').value=state.fps;
  $('placeholderInput').disabled=!s.speechWindows.length;
  $('eventRows').replaceChildren(...plan.cues.filter(c=>c.eventId).map(c=>{const tr=document.createElement('tr');for(const text of [soundNames[c.sound]||c.sound,c.start.toFixed(3),`${c.anchorTime.toFixed(3)} · ${{contact:'接触',peak:'经过',onset:'启动',end:'完成'}[c.anchor]||c.anchor}`,c.end.toFixed(3)]){const td=document.createElement('td');td.textContent=text;tr.append(td);}return tr;}));
  $('renderStatus').textContent=cache.has(currentKey())?'当前方案已缓存':'播放或导出时合成当前方案';
  updateTransport();redraw=true;draw();
}
function label(c,text,x,y,size=20,color=colors.ink,align='left',weight=500){c.font=`${weight} ${size}px "Microsoft YaHei", sans-serif`;c.fillStyle=color;c.textAlign=align;c.fillText(text,x,y);}
function line(c,x1,y1,x2,y2,color=colors.line,width=2,dash=[]){c.beginPath();c.setLineDash(dash);c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();c.setLineDash([]);}
function rounded(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
function ring(c,x,y,r,color,width=2){c.beginPath();c.arc(x,y,Math.max(.01,r),0,Math.PI*2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function plate(x,y,width,height,color,rotation=0){
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.shadowColor='#0006';ctx.shadowBlur=30;ctx.shadowOffsetY=14;
  const gradient=ctx.createLinearGradient(-width/2,-height/2,width/2,height/2);gradient.addColorStop(0,color);gradient.addColorStop(1,'#233747');rounded(ctx,-width/2,-height/2,width,height,14,gradient,'#c2dce14d');ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  line(ctx,-width/2+15,-height/2+14,width/2-15,-height/2+14,'#ffffff38',2);
  for(const sign of [-1,1]){ring(ctx,sign*(width/2-24),0,5,'#bed2d887',2);line(ctx,sign*(width/2-24)-3,0,sign*(width/2-24)+3,0,'#d1dee4',1);}
  ctx.restore();
}
function contactGlow(x,y,pulse){if(pulse<.001)return;ctx.save();ctx.globalAlpha=clamp(pulse);ctx.shadowBlur=25;ctx.shadowColor=colors.gold;line(ctx,x-85,y,x+85,y,colors.gold,4);ring(ctx,x,y,35+45*(1-pulse),colors.gold,2);ctx.restore();}
function base(){
  const bg=ctx.createLinearGradient(0,0,1200,640);bg.addColorStop(0,'#182d39');bg.addColorStop(.6,'#101c27');bg.addColorStop(1,'#15212a');ctx.fillStyle=bg;ctx.fillRect(0,0,1200,640);
  const glow=ctx.createRadialGradient(570,300,0,570,300,470);glow.addColorStop(0,'#36566728');glow.addColorStop(1,'#18273400');ctx.fillStyle=glow;ctx.fillRect(0,0,1200,640);
  for(let i=0;i<15;i++)line(ctx,70+i*80,90,70+i*80,550,'#638ba308',1);
  for(let i=0;i<7;i++)line(ctx,60,90+i*70,1140,90+i*70,'#638ba308',1);
}
function drawContact(v,t){
  const events=v.events;
  events.forEach((e,i)=>{const x=i===0?350:850,approach=smooth((t-e.onset)/(e.contact-e.onset)),y=mix(215,365,approach);plate(x,425,260,36,'#365461');plate(x,y,210,84,i===0?'#7f9ba9':'#b38e68');
    const pulse=e.contactPulse;contactGlow(x,407,pulse);
    line(ctx,x-130,510,x+130,510,'#405867',1);line(ctx,x-130,510,x-130+260*approach,510,i===0?colors.cyan:colors.gold,3);
    label(ctx,i===0?'金属嵌合':'木件落定',x,140,26,colors.ink,'center',600);label(ctx,`${e.contact.toFixed(2)} s · 接触`,x,555,18,colors.muted,'center');
    if(t>=e.onset&&t<e.contact)label(ctx,'靠近',x,464,16,colors.muted,'center');else if(t>=e.contact)label(ctx,'接触已发生',x,464,16,colors.gold,'center');
  });
}
function drawDensity(v,t){
  const slots=[[-270,-95],[-90,-95],[90,-95],[270,-95],[-270,95],[-90,95],[90,95],[270,95]],x0=600,y0=320;
  rounded(ctx,210,193,780,263,28,'#0d182277','#54708255');
  v.events.forEach((e,i)=>{const [dx,dy]=slots[i],p=smooth((t-e.onset)/(e.contact-e.onset));const x=x0+dx,y=y0+dy-60*(1-p);ctx.save();ctx.globalAlpha=.3+.7*p;plate(x,y,145,65,i===v.events.length-1?'#ad8b5c':'#476b7b',e.kind==='servo'?(1-p)*Math.PI/2:0);ctx.restore();contactGlow(x,y+33,e.contactPulse);label(ctx,String(i+1).padStart(2,'0'),x,y+6,16,colors.ink,'center');});
  label(ctx,'所有动作照常发生',600,105,28,colors.ink,'center',600);
  label(ctx,'声音可以只强调关键接触和完成',600,535,21,colors.muted,'center');
}
function formulaPanel(t,window){
  const opacity=smooth((t-window.start)/.28)*smooth((window.end+.3-t)/.3);if(!opacity)return;
  ctx.save();ctx.globalAlpha=opacity;rounded(ctx,640,230,420,205,19,'#172c36ee','#61818355');label(ctx,'给阅读留出空间',680,277,21,colors.muted);label(ctx,'F = m a',680,340,42,colors.ink,'left',600);label(ctx,'现在看清这一项就够了',680,391,18,colors.cyan);ctx.restore();
}
function drawTail(v,t){
  const e=v.events[0],p=smooth((t-e.onset)/(e.contact-e.onset));plate(330,430,275,32,'#36505f');plate(330,mix(210,374,p),220,80,'#8a9da9');contactGlow(330,414,e.contactPulse);
  label(ctx,'先落定，再读字',320,140,28,colors.ink,'center',600);formulaPanel(t,scene().readWindows[0]);
  label(ctx,'动作与阅读时刻固定；只改变尾音',600,540,21,colors.muted,'center');
}
function drawVelocity(v,t){
  const pass=v.events[0],turn=v.events[1];line(ctx,160,245,1040,245,'#476b7a',2,[5,12]);
  const p=pass.progress,x=mix(175,1025,p);for(let i=7;i>=1;i--){ctx.save();ctx.globalAlpha=pass.normalSpeed*(.14-i*.012);plate(x-i*18,245,105,58,'#6dbfbc');ctx.restore();}plate(x,245,105,58,'#6dbfbc');
  label(ctx,'经过',120,174,22,colors.cyan);label(ctx,'左',160,302,18,colors.muted,'center');label(ctx,'右',1040,302,18,colors.muted,'center');
  ctx.save();ctx.translate(380,449);ctx.rotate(turn.progress*Math.PI*2);for(let i=0;i<8;i++){ctx.rotate(Math.PI/4);rounded(ctx,45,-13,50,26,6,'#9faeb7','#d8e4e84d');}ring(ctx,0,0,70,'#b2c5cc',15);ring(ctx,0,0,28,'#496575',12);ctx.restore();
  label(ctx,'转动',240,438,22,colors.gold,'right');
  const active=t<4.1?pass:turn;label(ctx,'动作速度',600,410,18,colors.muted);rounded(ctx,600,431,380,13,6,'#203542');rounded(ctx,600,431,Math.max(1,380*active.normalSpeed),13,6,colors.cyan);label(ctx,'起步 → 加速 → 经过 → 减速',600,490,21,colors.ink);
}
function drawNarration(v,t){
  const seat=v.events.find(e=>e.id==='first-seat'),turn=v.events.find(e=>e.id==='turn'),pass=v.events.find(e=>e.id==='decorative-pass'),done=v.events.find(e=>e.id==='done');
  const p=smooth((t-seat.onset)/(seat.contact-seat.onset)),y=mix(245,365,p);
  plate(330,420,260,32,'#3f5d6c');plate(330,y,195,78,'#77919f');contactGlow(330,404,seat.contactPulse);
  ctx.save();ctx.translate(330,y);ctx.rotate(turn.progress*Math.PI*2);ring(ctx,0,0,23,'#c4b08d',7);line(ctx,0,0,16,0,colors.gold,4);ctx.restore();
  if(t>=pass.onset&&t<=pass.end){const x=mix(145,510,pass.progress);line(ctx,x-45,202,x,202,'#79dcda55',3);}
  if(t>=done.contact){const d=smooth((t-done.contact)/.3);ctx.save();ctx.globalAlpha=d;ring(ctx,330,y,60,colors.cyan,2);label(ctx,'完成',330,477,18,colors.cyan,'center');ctx.restore();}
  const windows=scene().speechWindows;const speech=windows.find(w=>t>=w.start-.15&&t<=w.end+.3);
  if(speech){const a=smooth((t-(speech.start-.15))/.15)*smooth((speech.end+.3-t)/.3);ctx.save();ctx.globalAlpha=a;rounded(ctx,645,230,405,180,19,'#18343ed9','#78adba55');label(ctx,'这里是讲解窗口',680,280,25,colors.ink);for(let i=0;i<30;i++){const h=13+22*(.5+.5*Math.sin(i*.6+t*8))*(.5+.5*Math.cos(i*.25));line(ctx,684+i*10,344-h/2,684+i*10,344+h/2,colors.cyan,4);}label(ctx,'拟声可选 · 不是真实旁白',680,387,17,colors.muted);ctx.restore();}
  if(v.readActive)formulaPanel(t,scene().readWindows[0]);
  label(ctx,'动作继续，注意力轮换',600,140,28,colors.ink,'center',600);
  label(ctx,v.speechActive?'讲解时让位':v.readActive?'读公式时减少装饰':'需要强调时，声音再回来',600,535,22,v.speechActive?colors.cyan:colors.muted,'center');
}
function drawScene(time){
  const v=visualState(state.sceneId,time);base();
  ({'contact-sync':drawContact,'cue-density':drawDensity,'tail-control':drawTail,'velocity-mapping':drawVelocity,'narration-space':drawNarration}[state.sceneId])(v,time);
  $('visualStage').textContent=v.readActive?'阅读窗口':v.speechActive?'讲解窗口':v.stage;
  $('eventStatus').textContent=`${state.variant} 方案 · ${plan.cues.filter(c=>c.eventId&&time>=c.start&&time<c.end).length} 个音效在响`;
  $('visualMessage').textContent=state.sceneId==='velocity-mapping'?'动作进度驱动位置与旋转':'画面动作在 A/B 中完全相同';
}
const plot={left:105,right:1160,top:42,bottom:252};
function drawTimeline(time){
  const mobile=timeline.clientWidth<600,W=1200,H=mobile?430:285;
  if(timeline.height!==H)timeline.height=H;
  const x=t=>mix(plot.left,plot.right,t/scene().duration),bottom=mobile?407:255;
  tx.clearRect(0,0,W,H);tx.fillStyle='#101b24';tx.fillRect(0,0,W,H);
  for(let t=0;t<=scene().duration;t+=mobile?2:1){line(tx,x(t),mobile?56:29,x(t),bottom,'#29414e',mobile?2:1);label(tx,`${t}s`,x(t),mobile?40:22,mobile?36:15,colors.muted,'center');}
  label(tx,'动作',18,mobile?129:76,mobile?32:16,colors.muted);label(tx,'音效',18,mobile?239:143,mobile?32:16,colors.cyan);label(tx,'留白',18,mobile?377:235,mobile?32:16,colors.gold);
  scene().events.forEach((e,i)=>{const y=(mobile?100:63)+(i%2)*(mobile?31:19);rounded(tx,x(e.onset),y,Math.max(2,x(e.end)-x(e.onset)),mobile?17:10,4,'#344c5c');line(tx,x(e.contact),y-5,x(e.contact),y+(mobile?23:16),colors.gold,mobile?3:2);});
  const cues=plan.cues.filter(c=>c.eventId),lanes=[-Infinity,-Infinity,-Infinity];
  cues.forEach(c=>{let lane=lanes.findIndex(v=>v<=c.start);if(lane<0)lane=lanes.indexOf(Math.min(...lanes));lanes[lane]=c.end;const y=(mobile?203:118)+lane*(mobile?33:24);
    const from=clamp(c.start,0,scene().duration),to=clamp(c.end,0,scene().duration);if(to<=from)return;
    const grad=tx.createLinearGradient(x(from),0,x(to),0);grad.addColorStop(0,'#79dcdaa0');grad.addColorStop(1,'#5b7c8740');rounded(tx,x(from),y,Math.max(1,x(to)-x(from)),mobile?21:14,3,grad);
    line(tx,x(from),y-3,x(from),y+(mobile?24:17),colors.cyan,mobile?3:2);const anchor=clamp(c.start+c.anchorOffset,0,scene().duration);ring(tx,x(anchor),y+(mobile?10:7),mobile?5:3,colors.gold,mobile?3:2);
  });
  [...scene().speechWindows.map(w=>({...w,color:'#79dcda',label:'讲解'})),...scene().readWindows.map(w=>({...w,color:'#edbb78',label:'读字'}))].forEach(w=>{rounded(tx,x(w.start),mobile?344:215,x(w.end)-x(w.start),mobile?46:25,4,w.color+'24',w.color+'55');label(tx,w.label,(x(w.start)+x(w.end))/2,mobile?377:233,mobile?31:14,w.color,'center');});
  if(!scene().speechWindows.length&&!scene().readWindows.length)label(tx,mobile?'此场景未设置保护窗口':'此场景没有旁白 / 阅读保护窗口',plot.left,mobile?377:233,mobile?30:14,'#8ca3b0');
  line(tx,x(time),mobile?56:31,x(time),bottom,'#f6e8cd',mobile?3:2);tx.beginPath();tx.moveTo(x(time)-5,mobile?55:30);tx.lineTo(x(time)+5,mobile?55:30);tx.lineTo(x(time),mobile?65:37);tx.fillStyle='#f6e8cd';tx.fill();
  if(!mobile)label(tx,'竖线是画面接触时刻 · 圆点是音效设计锚点（非实测主峰）',plot.left,274,13,colors.muted);
}
function draw(){const time=timelineTime();drawScene(time);drawTimeline(time);$('seekInput').value=time;$('timeDisplay').innerHTML=`${time.toFixed(3)} <span>/ ${scene().duration.toFixed(3)} s</span>`;$('frameDisplay').textContent=`第 ${Math.round(time*state.fps)} 帧 · ${state.fps} fps`;redraw=false;}
function tick(){if(state.playing||redraw)draw();requestAnimationFrame(tick);}
function exportData(){return {schema:'motion-atelier.sound-design/v1',sceneId:state.sceneId,variant:state.variant,title:scene().title,source:'original-deterministic-synthesis',duration:scene().duration,options:options(),fps:state.fps,offsetFrames:state.offsetMs*state.fps/1000,events:scene().events,cues:plan.cues,excludedCues:plan.excludedCues,speechWindows:plan.speechWindows,readWindows:plan.readWindows,playbackOnly:{speed:state.speed,muted:state.muted},notice:'原速音频；合成参考声不是真实旁白。设计锚点与实测瞬态不同。'};}
function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
for(const [index,s]of scenes.entries()){
  const b=document.createElement('button');b.className='scene-button';b.dataset.scene=s.id;b.setAttribute('aria-pressed',String(index===0));
  const num=document.createElement('span');num.className='scene-num';num.textContent=String(index+1).padStart(2,'0');const title=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=sceneHints[index];small.textContent=s.question;title.append(strong,small);b.append(num,title);
  b.addEventListener('click',()=>{pause();state.sceneId=s.id;state.time=0;state.includeSpeechPlaceholder=false;refresh();});$('sceneList').append(b);
}
$('playButton').addEventListener('click',()=>state.playing?pause():void play());
$('replayButton').addEventListener('click',()=>{pause();state.time=0;redraw=true;void play();});
$('stopButton').addEventListener('click',()=>{pause();state.time=0;redraw=true;draw();});
$('muteButton').addEventListener('click',()=>{state.muted=!state.muted;if(master){holdGain(master.gain,audio.currentTime);master.gain.linearRampToValueAtTime(state.muted?0:1,audio.currentTime+.03);}updateTransport();});
$('seekInput').addEventListener('input',event=>seek(event.target.value));
$('speedSelect').addEventListener('change',event=>mutate(()=>{state.speed=Number(event.target.value);}));
for(const v of ['A','B'])$(`variant${v}`).addEventListener('click',()=>mutate(()=>{state.variant=v;}));
function offset(value){mutate(()=>{state.offsetMs=Math.round(clamp(Number(value)||0,-500,500));});}
$('offsetMs').addEventListener('change',event=>offset(event.target.value));$('offsetRange').addEventListener('input',event=>offset(event.target.value));$('offsetFrames').addEventListener('change',event=>offset(Number(event.target.value)/state.fps*1000));$('offsetReset').addEventListener('click',()=>offset(0));
$('fpsSelect').addEventListener('change',event=>{state.fps=Number(event.target.value);refresh();});
$('intensityInput').addEventListener('input',event=>mutate(()=>{state.intensity=Number(event.target.value);}));
$('gainInput').addEventListener('input',event=>mutate(()=>{state.gainDb=Number(event.target.value);}));
$('placeholderInput').addEventListener('change',event=>mutate(()=>{state.includeSpeechPlaceholder=event.target.checked;}));
$('resetButton').addEventListener('click',()=>mutate(()=>{state.offsetMs=0;state.intensity=1;state.gainDb=0;state.includeSpeechPlaceholder=false;}));
$('exportButton').addEventListener('click',()=>{download(new Blob([JSON.stringify(exportData(),null,2)],{type:'application/json'}),`${state.sceneId}-${state.variant}-timing.json`);notify('时机 JSON 已交给浏览器下载。');});
$('wavButton').addEventListener('click',async()=>{const button=$('wavButton');button.disabled=true;const id=state.sceneId,variant=state.variant;try{const result=await rendered();download(new Blob([encodeWav(result)],{type:'audio/wav'}),`${id}-${variant}-48k.wav`);notify('原速 WAV 已交给浏览器下载。');}catch(error){fail(error);}finally{button.disabled=false;}});
function canvasKey(event){if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();seek(timelineTime()+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?.5:1/state.fps));}else if(event.code==='Space'){event.preventDefault();state.playing?pause():void play();}}
canvas.addEventListener('keydown',canvasKey);timeline.addEventListener('keydown',canvasKey);
timeline.addEventListener('pointerdown',event=>{const rect=timeline.getBoundingClientRect();seek((clamp((event.clientX-rect.left)*1200/rect.width,plot.left,plot.right)-plot.left)/(plot.right-plot.left)*scene().duration);timeline.focus();});
document.addEventListener('keydown',event=>{if(event.code!=='Space'||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;if(event.target.closest('button,input,select,textarea,a,[contenteditable]'))return;event.preventDefault();state.playing?pause():void play();});
window.addEventListener('pagehide',()=>{pause();if(audio)void audio.close();});
window.addEventListener('resize',()=>{redraw=true;});
// Read-only diagnostic surface: QA drives the actual controls.
window.soundDesignLab={getState:()=>({...state,time:timelineTime(),pending,audioState:audio?.state??'not-created',audioTime:audio?.currentTime??0,masterGain:master?.gain.value??null,cacheEntries:cache.size}),getExport:exportData,getVisual:()=>visualState(state.sceneId,timelineTime())};
refresh();requestAnimationFrame(tick);
