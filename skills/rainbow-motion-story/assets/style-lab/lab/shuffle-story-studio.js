import {candidates} from './modules/shuffle-explanation.js';
import {plans,beatAt} from '../examples/shuffle-story/narration-plans.js';
const $=id=>document.getElementById(id),ctx=$('scene').getContext('2d');
let selected=candidates[0],time=0,playing=false,speed=1,last=0,frame=0,dirty=true;
const options={palette:'titanium',intensity:.7};
const clamp=t=>Math.max(0,Math.min(selected.duration,t));
function pause(){playing=false;dirty=true;transport();}
function transport(){$('play').textContent=playing?'Ⅱ 暂停':'▶ 播放';$('play').setAttribute('aria-label',playing?'暂停':'播放');}
function seek(t){time=clamp(Number(t)||0);last=performance.now();dirty=true;paint();}
function toggle(){if(playing){pause();return;}if(time>=selected.duration)seek(0);playing=true;last=performance.now();transport();}
function refresh(){const plan=plans[selected.id];$('seek').max=selected.duration;$('candidateLink').href=`./index.html#${selected.id}`;
 document.querySelectorAll('[data-candidate]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.candidate===selected.id)));
 $('chapters').replaceChildren();selected.stageTimes.forEach((t,i)=>{const b=document.createElement('button');b.textContent=selected.stages[i]??`${t}s`;b.dataset.stage=i;b.onclick=()=>seek(t);$('chapters').append(b);});
 $('scriptBeats').replaceChildren();for(const beat of plan.beats){const b=document.createElement('button'),small=document.createElement('small'),label=document.createElement('span');small.textContent=`${beat.start.toFixed(2)} — ${beat.end.toFixed(2)} s`;label.textContent=beat.narration||'留白，读完结果';b.append(small,label);b.dataset.beat=beat.id;b.onclick=()=>seek(beat.start);$('scriptBeats').append(b);}
 $('status').textContent='';transport();paint();}
function paint(){selected.draw(ctx,time,1600,900,options);const s=selected.sample(time,options),b=beatAt(selected.id,time);$('stageName').textContent=s.annotation??selected.stages[s.stageIndex]??s.phase;$('time').textContent=`${time.toFixed(3)} / ${selected.duration.toFixed(3)} s`;$('seek').value=time;
 $('question').textContent=b.question;$('narration').textContent=b.narration||'留白，让观众读完结果。';$('narration').classList.toggle('silent',!b.narration);$('visual').textContent=b.visual;$('after').textContent=b.afterBelief;$('beatTime').textContent=`${b.start.toFixed(2)}—${b.end.toFixed(2)} s`;
 document.querySelectorAll('[data-beat]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.beat===b.id)));
 document.querySelectorAll('[data-stage]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.stage)===s.stageIndex)));
 $('diagnostics').textContent=JSON.stringify({id:selected.id,time,playing,speed,phase:s.phase,stageIndex:s.stageIndex,beat:b.id,readHold:s.readHold,timingBasis:'planned',audio:'not-synthesized'});dirty=false;}
for(const [i,c]of candidates.entries()){const b=document.createElement('button'),title=document.createElement('strong'),small=document.createElement('small');title.textContent=`0${i+1} / ${plans[c.id].title}`;small.textContent=i===0?'把选择数逐个交给公式':'让同一组身份，揭开固定规则';b.append(title,small);b.dataset.candidate=c.id;b.onclick=()=>{pause();selected=c;time=0;refresh();};$('choices').append(b);}
$('play').onclick=toggle;$('replay').onclick=()=>{pause();seek(0);toggle();};$('previous').onclick=()=>{pause();seek(time-1/30);};$('next').onclick=()=>{pause();seek(time+1/30);};$('seek').oninput=e=>seek(e.target.value);$('speed').onchange=e=>{speed=Number(e.target.value);last=performance.now();dirty=true;};
$('scene').onkeydown=e=>{if(e.code==='Space'){e.preventDefault();toggle();}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();pause();seek(time+(e.key==='ArrowLeft'?-1:1)/30);}};
$('export').onclick=()=>{const plan=plans[selected.id],payload={...plan,candidateId:selected.id,pathBase:'motion_atelier-root',code:'lab/modules/shuffle-explanation.js',dependencies:['lab/modules/common.js','examples/shuffle-story/narration-plans.js'],sources:plan.sources.map(s=>({...s,path:'lab/modules/shuffle-explanation.js'})),options,provenance:'original-code-and-script',referenceStudy:'studies/shuffle-story.md'},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${selected.id}-storyboard.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);$('status').textContent='已导出讲稿、镜头、阅读窗与依赖关系。';};
function tick(now){if(playing){time=clamp(time+Math.max(0,(now-last)/1000)*speed);if(time>=selected.duration)pause();dirty=true;}last=now;if(dirty)paint();frame=requestAnimationFrame(tick);}
window.addEventListener('document-reader:open',()=>{pause();paint();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();dirty=true;}});window.addEventListener('pagehide',()=>{pause();cancelAnimationFrame(frame);});window.addEventListener('pageshow',e=>{if(e.persisted){last=performance.now();dirty=true;cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);}});
refresh();frame=requestAnimationFrame(tick);
