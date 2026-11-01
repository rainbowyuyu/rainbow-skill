import {presets, durationFor, sample, draw as drawCore, getCueSheet, renderAudio} from './emotion-motion.js';
import {encodeWav, measureSignal} from './sound-design.js';

const $=id=>document.getElementById(id),clamp=(value,lo=0,hi=1)=>Math.min(hi,Math.max(lo,value));
const candidates=[...presets,{id:'reel',title:'连起来看',description:'四种动作连续出现，最后停留观察它们的差别。',feeling:'推进、缓行、停住与回弹形成对照',useCase:'先比较动作语气，再选择适合当前内容的一种',risk:'包含明确的剪切点；段落相接不代表同一连续物理运动。',duration:15}];
const state={id:'fast',mode:'object',soundStyle:'matched',gain:.65,muted:false,listenOnly:false,fps:30,time:0,playing:false};
const colors={cyan:'#87d7d4',gold:'#efbd7e',muted:'#9fb1bb',ink:'#eeeae0',line:'#324b5a'};
const canvas=$('sceneCanvas'),ctx=canvas.getContext('2d'),chart=$('timelineCanvas'),cx=chart.getContext('2d');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const cache=new Map();
const sourceRecords=new Map();
let audio=null,master=null,source=null,sourceGain=null,clockStart=0,clockOffset=0,pending=false,epoch=0,dirty=true,noticeTimer,raf=0,stageVisible=true;
let lastDiagnosticUpdate=-Infinity;
let cues=[],events=[],speedSamples=[],maxSpeed=1;
const duration=()=>durationFor(state.id);
const options=(gain=state.gain)=>({mode:state.mode,soundStyle:state.soundStyle,gain});
const currentMeta=()=>candidates.find(p=>p.id===state.id);
function time(){return state.playing&&audio?clamp(clockOffset+Math.max(0,audio.currentTime-clockStart),0,duration()):state.time;}
function notify(message){$('notice').textContent=message;$('notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('visible'),3200);}
function hold(param,at){if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(at);else{const value=param.value;param.cancelScheduledValues(at);param.setValueAtTime(value,at);}}
function masterLevel(){return state.muted?0:state.gain;}
function updateMaster(){if(!audio||!master)return;hold(master.gain,audio.currentTime);master.gain.linearRampToValueAtTime(masterLevel(),audio.currentTime+.03);}
function retire(){
  if(!source)return;const old=source,gain=sourceGain;source=null;sourceGain=null;
  const at=audio.currentTime;hold(gain.gain,at);gain.gain.linearRampToValueAtTime(0,at+.025);const record=sourceRecords.get(old);if(record)record.stopAt=Math.min(record.stopAt,at+.03);try{old.stop(at+.03);}catch{}
  old.onended=()=>{sourceRecords.delete(old);old.disconnect();gain.disconnect();updateDiagnostics();};
}
function pause(){state.time=time();state.playing=false;pending=false;epoch++;retire();updateTransport();dirty=true;}
function failure(error){pause();$('renderStatus').textContent=`未完成：${error.message||error}`;notify(error.message||String(error));}
async function ensureAudio(){
  if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('此浏览器不支持 Web Audio，仍可查看动作并导出 WAV。');audio=new Audio();master=audio.createGain();master.gain.value=masterLevel();master.connect(audio.destination);audio.addEventListener('statechange',()=>{if(audio.state!=='running'&&state.playing){pause();notify('浏览器暂停了声音。点击播放继续。');}});}
  if(audio.state!=='running')await audio.resume();if(audio.state!=='running')throw Error('声音尚未启用，请再次点击播放。');
}
function key(){return JSON.stringify([state.id,state.mode,state.soundStyle]);}
async function playbackBuffer(){
  const cacheKey=key();if(cache.has(cacheKey))return cache.get(cacheKey);
  const id=state.id,opts=options(1);await new Promise(resolve=>setTimeout(resolve,0));
  const rendered=renderAudio(id,{sampleRate:48000,...opts});const metrics=measureSignal(rendered.left,rendered.right,rendered.sampleRate);
  if(metrics.samplePeak>1)throw Error('合成音频超过满刻度，已停止播放。');
  const result={...rendered,metrics};cache.set(cacheKey,result);while(cache.size>4)cache.delete(cache.keys().next().value);
  if(cacheKey===key())$('renderStatus').textContent=`48 kHz · 双声道 · ${result.duration.toFixed(2)} s · 原创合成`;
  return result;
}
async function play(){
  if(state.playing||pending)return;if(!stageVisible)canvas.scrollIntoView({block:'center',behavior:'auto'});
  const ticket=++epoch;pending=true;updateTransport();
  try{
    await ensureAudio();if(ticket!==epoch||document.hidden)return;const rendered=await playbackBuffer();if(ticket!==epoch||document.hidden)return;
    if(state.time>=duration()-.001)state.time=0;
    const buffer=audio.createBuffer(2,rendered.left.length,rendered.sampleRate);buffer.copyToChannel(rendered.left,0);buffer.copyToChannel(rendered.right,1);
    const next=audio.createBufferSource(),gain=audio.createGain();next.buffer=buffer;next.connect(gain);gain.connect(master);clockOffset=state.time;clockStart=audio.currentTime+.04;gain.gain.setValueAtTime(0,clockStart);gain.gain.linearRampToValueAtTime(1,clockStart+.025);source=next;sourceGain=gain;
    next.onended=()=>{sourceRecords.delete(next);if(source!==next){updateDiagnostics();return;}state.time=duration();state.playing=false;source=null;sourceGain=null;next.disconnect();gain.disconnect();updateTransport();dirty=true;};
    updateMaster();next.start(clockStart,state.time);sourceRecords.set(next,{startAt:clockStart,stopAt:clockStart+buffer.duration-state.time});state.playing=true;pending=false;updateTransport();dirty=true;
  }catch(error){if(ticket===epoch)failure(error);}finally{if(ticket===epoch){pending=false;updateTransport();}}
}
function seek(value){const resume=state.playing||pending;pause();state.time=clamp(Number(value)||0,0,duration());draw();if(resume&&state.time<duration())void play();}
function change(mutator,reset=false){const resume=state.playing||pending;pause();mutator();state.time=reset?0:clamp(state.time,0,duration());refresh();if(resume)void play();}
function updateTransport(){
  $('playButton').disabled=pending;$('playButton').textContent=pending?'准备声音…':state.playing?'Ⅱ 暂停':'▶ 播放一次';$('playButton').setAttribute('aria-label',state.playing?'暂停':'播放一次');
  $('muteButton').textContent=state.muted?'已静音':'声音开';$('muteButton').setAttribute('aria-pressed',String(state.muted));
  $('audioStatus').textContent=pending?(state.muted?'静音 · 准备播放':'正在准备声音'):!audio?(state.muted?'已静音 · 尚未播放':'点击播放后启用声音'):state.playing?(state.muted?'静音 · 音频时钟继续':'声音与画面同步'):(state.muted?'已静音 · 已暂停':'声音已就绪 · 已暂停');
  updateDiagnostics();
}
function updateDiagnostics(){
  const now=audio?.currentTime??0;
  $('playbackDiagnostics').textContent=JSON.stringify({time:time(),playing:state.playing,pending,audioState:audio?.state??'not-created',audioTime:now,activeSourceCount:[...sourceRecords.values()].filter(r=>now>=r.startAt&&now<r.stopAt).length,scheduledSourceCount:sourceRecords.size,epoch,muted:state.muted,id:state.id,soundStyle:state.soundStyle});
  lastDiagnosticUpdate=performance.now();
}
function speedAt(t){return sample(state.id,t,options()).object.speed;}
function rebuild(){
  cues=getCueSheet(state.id,options());
  events=sample(state.id,0,options()).events.filter(e=>Number.isFinite(e.time)).sort((a,b)=>a.time-b.time);
  const times=new Set(Array.from({length:361},(_,i)=>duration()*i/360));
  for(const event of events){times.add(clamp(event.time,0,duration()));times.add(clamp(event.time-1e-6,0,duration()));times.add(clamp(event.time+1e-6,0,duration()));}
  speedSamples=[...times].sort((a,b)=>a-b).map(t=>({time:t,speed:speedAt(t)}));maxSpeed=Math.max(.1,...speedSamples.map(p=>p.speed))*1.12;
}
function refresh(){
  const p=currentMeta();rebuild();$('sceneHeading').textContent=`${p.title} · ${duration().toFixed(0)} 秒`;$('presetTitle').textContent=p.title;$('presetDescription').textContent=p.description;$('presetFeeling').textContent=p.feeling;$('presetUse').textContent=p.useCase;$('presetRisk').textContent=p.risk;
  for(const button of document.querySelectorAll('[data-preset]'))button.setAttribute('aria-pressed',String(button.dataset.preset===state.id));
  for(const button of document.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode));
  for(const button of document.querySelectorAll('[data-sound]'))button.setAttribute('aria-pressed',String(button.dataset.sound===state.soundStyle));
  $('soundDescription').textContent=state.soundStyle==='matched'?'音色与包络按具体动作安排，比较它们怎样跟随推进、停住和接触。':'相同提示音标记同一组可见事件，方便比较音色变化带来的区别。';
  $('gainInput').value=state.gain;$('gainValue').textContent=`${Math.round(state.gain*100)}%`;$('listenOnlyInput').checked=state.listenOnly;$('fpsSelect').value=state.fps;$('seekInput').max=duration();
  fillRows();updateTransport();dirty=true;draw();
}
const soundNames={'air-motion':'随运动的空气声','air-passby':'空气掠过','air-rise':'空气上扬','metal-contact':'金属接触','wood-contact':'木质接触','low-impact':'低频落点','ui-confirm':'统一提示音','servo':'机械转动','room-air':'空气底声'};
function cueName(c){return c.label||soundNames[c.sound]||c.sound||c.id;}
function fillRows(){
  $('cueRows').replaceChildren(...cues.map(c=>{const tr=document.createElement('tr');for(const value of [cueName(c),c.start.toFixed(3),`${c.anchorTime.toFixed(3)} · ${{onset:'启动',peak:'峰值',end:'抵达',contact:'接触'}[c.anchor]||'事件'}`,c.end.toFixed(3)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}));
  if(!cues.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='本段保留安静，没有音效。';tr.append(td);$('cueRows').append(tr);}
}
function text(c,value,x,y,size=20,color=colors.ink,align='left',weight=500){c.font=`${weight} ${size}px "Microsoft YaHei",sans-serif`;c.fillStyle=color;c.textAlign=align;c.fillText(value,x,y);}
function line(c,x1,y1,x2,y2,color=colors.line,width=1,dash=[]){c.beginPath();c.setLineDash(dash);c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();c.setLineDash([]);}
function circle(c,x,y,r,color){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
function rounded(c,x,y,w,h,r,fill){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();}
function drawListenOnly(){
  const gradient=ctx.createLinearGradient(0,0,1200,675);gradient.addColorStop(0,'#1c343f');gradient.addColorStop(1,'#101d29');ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,675);
  ctx.beginPath();ctx.arc(600,270,59,0,Math.PI*2);ctx.strokeStyle='#7caeb466';ctx.lineWidth=2;ctx.stroke();for(let i=0;i<7;i++){const h=18+45*Math.sin((i+1)*Math.PI/8);line(ctx,552+i*16,270-h/2,552+i*16,270+h/2,colors.cyan,6);}
  text(ctx,'只听声音',600,403,44,colors.ink,'center',600);text(ctx,'动作仍按同一时钟运行，取消勾选即可查看。',600,453,22,colors.muted,'center');
}
function chartGeometry(){const mobile=chart.clientWidth<560;return {mobile,width:mobile?680:1000,height:mobile?390:340,left:mobile?65:83,right:mobile?650:968,top:mobile?39:32,bottom:mobile?209:191,cueTop:mobile?268:239,cueBottom:mobile?339:299};}
function drawTimeline(t){
  const g=chartGeometry();if(chart.width!==g.width||chart.height!==g.height){chart.width=g.width;chart.height=g.height;}const c=cx,x=value=>g.left+value/duration()*(g.right-g.left),y=value=>g.bottom-value/maxSpeed*(g.bottom-g.top);c.clearRect(0,0,g.width,g.height);c.fillStyle='#111e29';c.fillRect(0,0,g.width,g.height);
  const ticks=state.id==='reel'?5:4;
  for(let i=0;i<=ticks;i++){const second=duration()*i/ticks;line(c,x(second),g.top,x(second),g.cueBottom,'#3a536044',1);text(c,`${second.toFixed(0)}s`,x(second),g.height-16,g.mobile?22:17,colors.muted,'center');}
  for(let i=0;i<=2;i++){const speed=maxSpeed*i/2;line(c,g.left,y(speed),g.right,y(speed),'#3a536044',1);text(c,speed.toFixed(1),g.left-10,y(speed)+6,g.mobile?20:16,colors.muted,'right');}
  text(c,'|v| /s',g.left,g.mobile?26:20,g.mobile?21:16,colors.cyan);text(c,'音效',g.mobile?10:22,g.cueTop+18,g.mobile?21:17,colors.gold);
  c.save();c.beginPath();c.rect(g.left,g.top-1,g.right-g.left,g.bottom-g.top+2);c.clip();
  c.beginPath();let previous=null;for(const p of speedSamples){const jump=previous&&events.some(e=>(e.kind==='cut'||e.kind==='contact')&&e.time>=previous.time&&e.time<=p.time);if(!previous||jump)c.moveTo(x(p.time),y(p.speed));else c.lineTo(x(p.time),y(p.speed));previous=p;}c.strokeStyle=colors.cyan;c.lineWidth=g.mobile?3:2.5;c.stroke();c.restore();
  for(const e of events){if(e.time<0||e.time>duration())continue;line(c,x(e.time),g.top,x(e.time),g.cueBottom,e.kind==='cut'?'#bc9dc866':'#edbd7e44',1,e.kind==='cut'?[6,6]:[3,7]);circle(c,x(e.time),g.bottom+13,g.mobile?4:3,e.kind==='cut'?'#c5a6ce':colors.gold);}
  const lanes=[-Infinity,-Infinity,-Infinity];for(const cue of cues){let lane=lanes.findIndex(end=>end<=cue.start);if(lane<0)lane=lanes.indexOf(Math.min(...lanes));lanes[lane]=cue.end;const start=clamp(cue.start,0,duration()),end=clamp(cue.end,0,duration());if(end<=start)continue;const yy=g.cueTop+lane*(g.mobile?24:19);const gradient=c.createLinearGradient(x(start),0,x(end),0);gradient.addColorStop(0,'#efbd7eab');gradient.addColorStop(1,'#efbd7e28');rounded(c,x(start),yy,Math.max(2,x(end)-x(start)),g.mobile?15:12,3,gradient);line(c,x(start),yy-3,x(start),yy+(g.mobile?18:15),colors.gold,2);circle(c,x(clamp(cue.anchorTime,0,duration())),yy+(g.mobile?7:6),g.mobile?4:3,colors.ink);}
  line(c,x(t),g.top,x(t),g.cueBottom,'#f1e9dcaa',2);circle(c,x(t),y(speedAt(t)),g.mobile?5:4,colors.cyan);
}
function draw(){
  const t=time(),s=sample(state.id,t,options());if(state.listenOnly)drawListenOnly();else drawCore(ctx,state.id,t,canvas.width,canvas.height,options());drawTimeline(t);
  $('stageStatus').textContent=state.listenOnly?'仅试听 · 画面已收起':s.reading?'观察 / 阅读窗口':s.cut?'镜头交接':s.stage||'动作段';$('timeDisplay').textContent=`${t.toFixed(3)} / ${duration().toFixed(3)} s`;$('seekInput').value=t;$('frameDisplay').textContent=`第 ${Math.round(t*state.fps)} 帧 · ${state.fps} fps`;$('speedValue').textContent=`|v| = ${s.object.speed.toFixed(2)} /s`;dirty=false;
}
function tick(){if(state.playing||dirty)draw();if(performance.now()-lastDiagnosticUpdate>=100)updateDiagnostics();raf=requestAnimationFrame(tick);}
function exportData(){return {schema:'motion-atelier.emotion-motion/v1',id:state.id,title:currentMeta().title,duration:duration(),options:options(),fps:state.fps,events,cues,units:{time:'seconds',position:'normalized-canvas',speed:'hypot(vx,vy), normalized-canvas/s'},audio:{source:'original-deterministic-synthesis',sampleRate:48000,channels:2},playbackOnly:{muted:state.muted,listenOnly:state.listenOnly},notice:'声音切换不改变动作。同一事件表驱动画面和音效；设计锚点不等于波形的实测主峰。'};}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const symbols={fast:'↗',slow:'≈',stop:'⊣',bounce:'⌁',reel:'▧'};
for(const [index,preset]of candidates.entries()){
  const b=document.createElement('button');b.className='preset-button';b.dataset.preset=preset.id;b.setAttribute('aria-pressed',String(preset.id===state.id));const number=document.createElement('span');number.className='preset-number';number.textContent=preset.id==='reel'?'15 SEC / REEL':`${String(index+1).padStart(2,'0')} / ${preset.duration} SEC`;const title=document.createElement('strong');title.textContent=preset.title;const short=document.createElement('small');short.textContent=preset.id==='reel'?'四种动作连续比较':preset.feeling;const symbol=document.createElement('span');symbol.className='preset-icon';symbol.textContent=symbols[preset.id];symbol.setAttribute('aria-hidden','true');b.append(number,title,short,symbol);b.addEventListener('click',()=>change(()=>{state.id=preset.id;},true));$('presetList').append(b);
}
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>change(()=>{state.mode=b.dataset.mode;}));for(const b of document.querySelectorAll('[data-sound]'))b.addEventListener('click',()=>change(()=>{state.soundStyle=b.dataset.sound;}));
$('playButton').addEventListener('click',()=>state.playing?pause():void play());$('replayButton').addEventListener('click',()=>{pause();state.time=0;void play();});$('stopButton').addEventListener('click',()=>{pause();state.time=0;draw();});
$('muteButton').addEventListener('click',()=>{state.muted=!state.muted;updateMaster();updateTransport();});$('gainInput').addEventListener('input',event=>{state.gain=Number(event.target.value);updateMaster();$('gainValue').textContent=`${Math.round(state.gain*100)}%`;cues=getCueSheet(state.id,options());fillRows();dirty=true;});
$('seekInput').addEventListener('input',event=>seek(event.target.value));$('fpsSelect').addEventListener('change',event=>{state.fps=Number(event.target.value);dirty=true;});$('listenOnlyInput').addEventListener('change',event=>{state.listenOnly=event.target.checked;dirty=true;});
$('exportJsonButton').addEventListener('click',()=>{download(new Blob([JSON.stringify(exportData(),null,2)],{type:'application/json'}),`emotion-${state.id}-${state.soundStyle}.json`);notify('动作与声音事件表已交给浏览器下载。');});
$('exportWavButton').addEventListener('click',async()=>{const button=$('exportWavButton'),id=state.id,opts=options();button.disabled=true;try{await new Promise(resolve=>setTimeout(resolve,0));const rendered=renderAudio(id,{sampleRate:48000,...opts});download(new Blob([encodeWav(rendered)],{type:'audio/wav'}),`emotion-${id}-${opts.soundStyle}-48k.wav`);$('renderStatus').textContent=`已导出 ${rendered.duration.toFixed(2)} s · 48 kHz · 双声道 · 音量 ${Math.round(opts.gain*100)}%`;notify('WAV 已交给浏览器下载，静音不影响导出。');}catch(error){failure(error);}finally{button.disabled=false;}});
function keyControl(event){if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();seek(time()+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?.5:1/state.fps));}else if(event.code==='Space'){event.preventDefault();state.playing?pause():void play();}}
canvas.addEventListener('keydown',keyControl);chart.addEventListener('keydown',keyControl);chart.addEventListener('pointerdown',event=>{const rect=chart.getBoundingClientRect(),g=chartGeometry(),point=(event.clientX-rect.left)*g.width/rect.width;seek(clamp((point-g.left)/(g.right-g.left))*duration());chart.focus();});
document.addEventListener('keydown',event=>{if(event.code!=='Space'||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('button,input,select,textarea,a,[contenteditable]'))return;event.preventDefault();state.playing?pause():void play();});
function preference(){if(reduced.matches){pause();$('preferenceNote').textContent='已检测到减少动态效果偏好：默认暂停，只有手动播放才运动；无自动循环。';}else $('preferenceNote').textContent='默认暂停，不自动循环。合成音效不包含参考作品音频采样。';}reduced.addEventListener('change',preference);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state.playing||pending))pause();});
const observer=new IntersectionObserver(entries=>{stageVisible=entries[0]?.isIntersecting??true;if(!stageVisible&&state.playing){pause();notify('画面离开可见区域，已暂停。');}},{threshold:.01});observer.observe(canvas);
window.addEventListener('resize',()=>{dirty=true;});window.addEventListener('pagehide',()=>{pause();observer.disconnect();cancelAnimationFrame(raf);if(audio)void audio.close();});
window.emotionMotionLab={getState:()=>({...state,time:time(),pending,audioState:audio?.state??'not-created',audioTime:audio?.currentTime??0,masterGain:master?.gain.value??null,cacheEntries:cache.size,stageVisible,reducedMotion:reduced.matches}),getExport:exportData,getSample:t=>sample(state.id,t??time(),options())};
preference();refresh();raf=requestAnimationFrame(tick);
