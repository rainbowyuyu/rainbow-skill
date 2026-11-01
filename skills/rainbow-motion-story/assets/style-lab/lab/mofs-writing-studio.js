import {candidates,SOURCES} from './modules/mofs-explanation.js';
const $=id=>document.getElementById(id), variants=['result','build','predict'];
const choices={result:{title:'先看一个结果',summary:'先让变化发生，再追问它为什么发生。'},build:{title:'先搭一个结构',summary:'从一处连接开始，走到可以解释的整体。'},predict:{title:'先做一次预测',summary:'先留观察时间，验证后再给机制。'}};
const storageKey='motion-atelier:mofs-writing:v1';
let drafts={};try{const raw=JSON.parse(localStorage.getItem(storageKey)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))drafts=Object.fromEntries(Object.entries(raw).filter(([,v])=>typeof v==='string'));}catch{}
let selected=candidates[0],time=0,playing=false,speed=1,last=0,rafId=0,dirty=true,shown=-1,editorKey='';
const story=()=>selected.story;
const keyFor=c=>`${selected.id}/${c.id}`;
const spoken=c=>drafts[keyFor(c)]??c.narration;
const cap=t=>Math.max(0,Math.min(selected.duration,Number(t)||0));
const cueAt=t=>selected.sample(t).activeCue;
function transport(){$('play').textContent=playing?'Ⅱ 暂停':'▶ 播放';$('play').setAttribute('aria-label',playing?'暂停':'播放');}
function pause(){if(playing&&shown>=0&&time<selected.duration)time=shown;playing=false;dirty=true;transport();}
function seek(t){time=cap(t);last=performance.now();dirty=true;paint();}
function toggle(){if(playing){pause();paint();return;}if(time>=selected.duration)seek(0);playing=true;last=performance.now();transport();}
function refresh(){
 $('seek').max=selected.duration;$('candidateLink').href=`./index.html#${selected.id}`;$('status').textContent='';editorKey='';
 document.querySelectorAll('[data-candidate]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.candidate===selected.id)));
 $('chapters').replaceChildren();selected.stageTimes.forEach((t,i)=>{const b=document.createElement('button');b.dataset.stage=i;b.textContent=selected.stages[i];b.onclick=()=>{pause();seek(t);};$('chapters').append(b);});
 $('cueList').replaceChildren();for(const cue of story().cues){const b=document.createElement('button'),label=document.createElement('small'),words=document.createElement('span');b.dataset.cue=cue.id;label.textContent=`${cue.start.toFixed(1)}–${cue.end.toFixed(1)} s`;words.textContent=spoken(cue)||'留白，观察已经出现的结果';b.append(label,words);b.classList.toggle('silent',!spoken(cue));b.onclick=()=>{pause();seek(cue.start);};$('cueList').append(b);}paint();
}
function paint(){
 const t=playing&&time<selected.duration?Math.floor(time*30)/30:time,s=selected.sample(t),cue=s.activeCue;
 selected.draw($('scene').getContext('2d'),t,1600,900,{});$('time').textContent=`${t.toFixed(3)} / ${selected.duration.toFixed(3)} s`;$('seek').value=time;$('phase').textContent=s.annotation||selected.stages[s.stageIndex]||s.phase;
 $('question').textContent=cue.question;$('narration').textContent=spoken(cue)||'留白，让观众观察画面。';$('narration').classList.toggle('silent',!spoken(cue));$('cueKind').textContent=spoken(cue)?(keyFor(cue) in drafts?'你的改写 · 待校时':'原创口播示例'):'观察停留';$('cueTime').textContent=`${cue.start.toFixed(1)}–${cue.end.toFixed(1)} s`;
 $('evidence').textContent=Array.isArray(cue.visibleEvidence)?cue.visibleEvidence.join('；'):cue.visibleEvidence;$('screenText').textContent=Array.isArray(cue.screenText)?cue.screenText.join(' · '):cue.screenText||'让位于物体';
 document.querySelectorAll('[data-cue]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cue===cue.id)));document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.stage)===s.stageIndex)));
 if(editorKey!==keyFor(cue)){editorKey=keyFor(cue);$('draft').value=spoken(cue)||'';draftStatus();}
 $('diagnostics').textContent=JSON.stringify({id:selected.id,variant:selected.variant,time,drawTime:t,playing,speed,cueId:cue.id,stageIndex:s.stageIndex,readHold:s.readHold,timingBasis:'planned',hasDraft:keyFor(cue) in drafts});shown=t;dirty=false;
}
function draftStatus(){const len=[...$('draft').value.replace(/\s/g,'')].length;$('draftStatus').textContent=`${len} 字 · ${editorKey in drafts?'本机改写':'原始示例'}`;}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(drafts));return true;}catch{$('status').textContent='浏览器无法保存改写，请导出 JSON 留存。';return false;}}
for(const [i,c]of candidates.entries()){const v=c.variant||variants[i],b=document.createElement('button'),small=document.createElement('small'),title=document.createElement('strong'),desc=document.createElement('span');small.textContent=`0${i+1} / 开场方式`;title.textContent=choices[v].title;desc.textContent=choices[v].summary;b.append(small,title,desc);b.dataset.candidate=c.id;b.onclick=()=>{pause();selected=c;time=cap(time);refresh();};$('choices').append(b);}
$('play').onclick=toggle;$('restart').onclick=()=>{pause();seek(0);toggle();};$('prev').onclick=()=>{pause();seek(time-1/30);};$('next').onclick=()=>{pause();seek(time+1/30);};$('seek').oninput=e=>{pause();seek(e.target.value);};$('speed').onchange=e=>{speed=Number(e.target.value);last=performance.now();dirty=true;};
$('scene').onkeydown=e=>{if(e.code==='Space'){e.preventDefault();toggle();}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();pause();seek(time+(e.key==='ArrowLeft'?-1:1)/30);}};
$('draft').onfocus=()=>{pause();paint();};$('draft').oninput=()=>{const cue=cueAt(shown>=0?shown:time),value=$('draft').value;drafts[keyFor(cue)]=value;persist();const item=$('cueList').querySelector(`[data-cue="${cue.id}"]`);item.querySelector('span').textContent=value||'留白，观察已经出现的结果';item.classList.toggle('silent',!value);paint();draftStatus();};
$('resetDraft').onclick=()=>{const cue=cueAt(shown>=0?shown:time);delete drafts[keyFor(cue)];const saved=persist();refresh();if(!saved)$('status').textContent='浏览器无法保存恢复操作，请导出 JSON 留存。';};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('export').onclick=()=>{const plan=story(),edited=plan.cues.some(c=>keyFor(c) in drafts);const data={...plan,candidateId:selected.id,time:shown>=0?shown:time,provenance:'original-code-and-script',timingBasis:'planned',audio:'not-synthesized',hasUserEdits:edited,needsTimingReview:true,cues:plan.cues.map(c=>({...c,narration:spoken(c),originalNarration:c.narration,userEdited:keyFor(c) in drafts})),sourceCatalog:SOURCES,pathBase:'motion_atelier-root',code:'lab/modules/mofs-explanation.js',dependencies:['lab/modules/common.js'],guide:'guides/mofs-writing.md',referenceStudy:'studies/mofs-script.md',factSources:'evidence/mofs-writing-sources/sources.json'};download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),selected.id+'-storyboard.json');$('status').textContent='已导出完整讲稿、动作依据和你的改写。';};
$('saveFrame').onclick=()=>{pause();paint();const id=selected.id,t=shown;$('scene').toBlob(blob=>{if(!blob)return;download(blob,`${id}-${t.toFixed(2)}s.png`);if(selected.id===id)$('status').textContent='已保存当前画面。';},'image/png');};
function tick(now){if(playing){time=cap(time+Math.max(0,now-last)/1000*speed);if(time>=selected.duration)pause();if((playing?Math.floor(time*30)/30:time)!==shown)dirty=true;}last=now;if(dirty)paint();rafId=requestAnimationFrame(tick);}
window.addEventListener('document-reader:open',()=>{pause();paint();});document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();paint();}});window.addEventListener('pagehide',()=>{pause();cancelAnimationFrame(rafId);});window.addEventListener('pageshow',e=>{if(e.persisted){last=performance.now();dirty=true;cancelAnimationFrame(rafId);rafId=requestAnimationFrame(tick);}});refresh();rafId=requestAnimationFrame(tick);
