import {duration,modes,readHolds,chapters,sample,draw,buildPlan,renderAudio} from './shuffle-rhythm.js';
import {encodeWav} from './sound-design.js';
const $=id=>document.getElementById(id),clamp=(v,a=0,b=duration)=>Math.min(b,Math.max(a,v));
const state={mode:'restrained',time:0,playing:false,pending:false,muted:false,gain:.65,listenOnly:false,error:null};
const scene=$('scene'),ctx=scene.getContext('2d'),score=$('score'),chart=score.getContext('2d');
const cache=new Map(),records=new Map();let audio=null,master=null,active=null,clockStart=0,clockOffset=0,epoch=0,dirty=true,frame=0;
const now=()=>state.playing&&audio?clamp(clockOffset+Math.max(0,audio.currentTime-clockStart)):state.time;
function setLevel(){if(!audio)return;const at=audio.currentTime,p=master.gain;if(p.cancelAndHoldAtTime)p.cancelAndHoldAtTime(at);else{p.cancelScheduledValues(at);p.setValueAtTime(p.value,at);}p.linearRampToValueAtTime(state.muted?0:state.gain,at+.025);}
function retire(record,at=audio?.currentTime??0,fade=.035){if(!record||record.retired)return;record.retired=true;record.gain.gain.cancelScheduledValues(at);record.gain.gain.setValueAtTime(record.gain.gain.value,at);record.gain.gain.linearRampToValueAtTime(0,at+fade);record.stopAt=at+fade+.005;try{record.source.stop(record.stopAt);}catch{}if(active===record)active=null;}
function pause(){state.time=now();state.playing=false;state.pending=false;epoch++;for(const r of records.values())retire(r);transport();dirty=true;}
async function ensureAudio(){if(!audio){audio=new(window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=state.muted?0:state.gain;master.connect(audio.destination);audio.addEventListener('statechange',()=>{if(audio.state!=='running'&&state.playing)pause();});}if(audio.state!=='running')await audio.resume();if(audio.state!=='running')throw Error('点击播放以启用声音。');}
function data(mode){if(!cache.has(mode)){const rendered=renderAudio(mode,48000);if(rendered.metrics?.samplePeak>1)throw Error('音频超过满刻度，未开始播放。');cache.set(mode,rendered);}return cache.get(mode);}
async function start({switching=false}={}){
  const token=++epoch;state.pending=true;state.error=null;transport();
  try{await ensureAudio();if(token!==epoch||document.hidden)return;const r=data(state.mode);if(token!==epoch||document.hidden)return;
    const continuing=switching&&state.playing,at=audio.currentTime+.035;
    let position=continuing?clamp(clockOffset+Math.max(0,at-clockStart)):state.time;
    if(continuing&&position>=duration){pause();state.time=duration;dirty=true;return;}
    if(!continuing&&position>=duration-.001)position=0;
    const buffer=audio.createBuffer(2,r.left.length,r.sampleRate);buffer.copyToChannel(r.left,0);buffer.copyToChannel(r.right,1);
    const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=buffer;source.connect(gain);gain.connect(master);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(1,at+.035);
    const prior=active;retire(prior,at,.035);const record={source,gain,startAt:at,stopAt:at+duration-position,retired:false};records.set(source,record);active=record;
    if(!continuing){clockOffset=position;clockStart=at;state.time=position;}
    source.onended=()=>{records.delete(source);source.disconnect();gain.disconnect();if(active===record){active=null;state.playing=false;state.time=duration;transport();dirty=true;}};
    source.start(at,position);state.playing=true;state.pending=false;setLevel();transport();dirty=true;
  }catch(e){if(token===epoch){state.error=e.message;pause();}}
  finally{if(token===epoch){state.pending=false;transport();}}
}
function seek(value){const resume=state.playing||state.pending;pause();state.time=clamp(Number(value)||0);paint();if(resume&&state.time<duration)void start();}
function transport(){
  $('play').textContent=state.pending?'准备…':state.playing?'Ⅱ 暂停':'▶ 播放';$('play').setAttribute('aria-label',state.playing?'暂停':'播放');$('play').disabled=state.pending;
  $('mute').textContent=state.muted?'已静音':'声音开';$('mute').setAttribute('aria-pressed',String(state.muted));
  $('audioStatus').textContent=state.error??(state.pending?'准备原创音效…':state.playing?(state.muted?'静音播放 · 同一时间线':'声音与画面同步'):'点击播放或定位，比较动作与声音');
}
function refresh(){const m=modes.find(m=>m.id===state.mode);$('modeDescription').textContent=m.description;document.querySelectorAll('[data-sound-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.soundMode===state.mode)));$('cueCount').textContent=`${buildPlan(state.mode).cues.length} 个声音事件 · 18 秒`;dirty=true;transport();}
function waveform(c,t){const w=score.width,h=score.height,x=t=>55+t/duration*(w-90),plan=buildPlan(state.mode);c.clearRect(0,0,w,h);c.fillStyle='#0c1923';c.fillRect(0,0,w,h);c.font='18px "Microsoft YaHei",sans-serif';
  for(const hold of readHolds){c.fillStyle='#83cbbd17';c.fillRect(x(hold.start),35,x(hold.end)-x(hold.start),148);c.fillStyle='#a7d7ce';c.fillText('停留',x(hold.start)+8,31);}
  const contacts=plan.contacts??sample(0).motionContacts??[];c.strokeStyle='#314650';c.beginPath();c.moveTo(55,72);c.lineTo(w-35,72);c.stroke();
  c.fillStyle='#6b8b9b';for(const e of contacts){if(!Number.isFinite(e.time))continue;c.fillRect(x(e.time),52,2,20);}
  for(const [i,cue]of plan.cues.entries()){const a=cue.start??cue.time??0,b=cue.end??(a+(cue.duration??.15)),lane=i%3;c.fillStyle=state.mode==='legato'?'#95cfc0aa':'#e6bd83a8';c.fillRect(x(a),94+lane*23,Math.max(2,x(b)-x(a)),13);}
  c.fillStyle='#94a8b3';c.font='17px Consolas,monospace';c.textAlign='center';for(let i=0;i<=18;i+=3)c.fillText(`${i}s`,x(i),215);c.textAlign='left';
  c.strokeStyle='#f4efe4';c.lineWidth=2;c.beginPath();c.moveTo(x(t),38);c.lineTo(x(t),187);c.stroke();c.fillStyle='#f4efe4';c.beginPath();c.arc(x(t),73,4,0,Math.PI*2);c.fill();
}
function paint(){const t=now(),s=sample(t);if(!state.listenOnly)draw(ctx,t,scene.width,scene.height,{mode:state.mode});else{ctx.fillStyle='#101e29';ctx.fillRect(0,0,scene.width,scene.height);ctx.fillStyle='#e6bd83';ctx.font='48px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText('只听声音的密度与停顿',scene.width/2,scene.height/2-15);ctx.font='23px "Microsoft YaHei",sans-serif';ctx.fillStyle='#9cb3c0';ctx.fillText(s.stage??'同一条动作时间线',scene.width/2,scene.height/2+42);ctx.textAlign='left';}
  waveform(chart,t);$('sceneStage').textContent=s.stage??'洗牌与停顿';$('time').textContent=`${t.toFixed(3)} / ${duration.toFixed(3)} s`;$('seek').value=t;$('frame').textContent=`第 ${Math.round(t*30)} 帧 / 30 fps`;
  for(const b of document.querySelectorAll('[data-chapter]')){const i=Number(b.dataset.chapter);b.setAttribute('aria-pressed',String(t>=chapters[i].time&&t<(chapters[i+1]?.time??duration+.01)));}
  dirty=false;
}
function diagnostics(){const at=audio?.currentTime??0;$('diagnostics').textContent=JSON.stringify({...state,time:now(),audioState:audio?.state??'not-created',audioTime:at,activeSources:[...records.values()].filter(r=>at>=r.startAt&&at<r.stopAt).length,scheduledSources:records.size,cacheEntries:cache.size,reading:sample(now()).reading,epoch});}
let lastDiagnostics=0;function tick(at){if(state.playing||dirty)paint();if(at-lastDiagnostics>150){diagnostics();lastDiagnostics=at;}frame=requestAnimationFrame(tick);}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
for(const [i,m]of modes.entries()){const button=document.createElement('button');button.dataset.soundMode=m.id;button.innerHTML=`<strong>0${i+1} / ${m.title}</strong><small>${({restrained:'让关键接触被听见',dense:'比较逐张触发的密度',legato:'让摩擦连接一串动作'})[m.id]}</small>`;button.onclick=()=>{if(state.mode===m.id)return;state.mode=m.id;refresh();if(state.playing||state.pending)void start({switching:true});};$('modes').append(button);}
for(const [i,c]of chapters.entries()){const b=document.createElement('button');b.textContent=c.title;b.dataset.chapter=i;b.onclick=()=>seek(c.time);$('chapters').append(b);}
$('play').onclick=()=>state.playing?pause():void start();$('replay').onclick=()=>{pause();state.time=0;void start();};$('previous').onclick=()=>{pause();seek(state.time-1/30);};$('next').onclick=()=>{pause();seek(state.time+1/30);};$('mute').onclick=()=>{state.muted=!state.muted;setLevel();transport();};$('seek').oninput=e=>seek(e.target.value);
$('gain').oninput=e=>{state.gain=Number(e.target.value);$('gainValue').textContent=`${Math.round(state.gain*100)}%`;setLevel();};$('listenOnly').onchange=e=>{state.listenOnly=e.target.checked;dirty=true;};
$('json').onclick=()=>{const payload={...buildPlan(state.mode),schema:'motion-atelier.shuffle-rhythm/v1',gain:state.gain,audio:{origin:'original-synthesis',sampleRate:48000,channels:2},scope:'原创声音设计，未复制参考音轨；拟声不等于实录。'};download(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`shuffle-${state.mode}-plan.json`);$('exportStatus').textContent='声音事件表已交给浏览器下载。';};
$('wav').onclick=async()=>{const mode=state.mode,level=state.gain;$('wav').disabled=true;try{await new Promise(r=>setTimeout(r,0));const r=data(mode),scaled={...r,left:r.left.map(v=>v*level),right:r.right.map(v=>v*level)};download(new Blob([encodeWav(scaled)],{type:'audio/wav'}),`shuffle-${mode}-48k.wav`);$('exportStatus').textContent=`已导出 ${mode} · 48 kHz 双声道 · 音量 ${Math.round(level*100)}%`;}catch(e){$('exportStatus').textContent=e.message;}finally{$('wav').disabled=false;}};
function keys(e){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();seek(now()+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.5:1/30));}else if(e.code==='Space'){e.preventDefault();state.playing?pause():void start();}}scene.addEventListener('keydown',keys);score.addEventListener('keydown',keys);
score.addEventListener('pointerdown',e=>{const rect=score.getBoundingClientRect();seek(clamp(((e.clientX-rect.left)*score.width/rect.width-55)/(score.width-90),0,1)*duration);score.focus();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('pagehide',event=>{pause();cancelAnimationFrame(frame);if(audio&&!event.persisted)void audio.close();});
window.addEventListener('pageshow',event=>{if(!event.persisted)return;if(audio?.state==='closed'){audio=null;master=null;active=null;records.clear();}dirty=true;cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);});
window.shuffleRhythmLab={getState:()=>({...state,time:now(),audioState:audio?.state??'not-created'}),getPlan:()=>buildPlan(state.mode)};
refresh();paint();diagnostics();frame=requestAnimationFrame(tick);
