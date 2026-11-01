import {candidates,frameRotaryState} from './modules/rotary-interaction.js';
import {DEFAULT_MOTOR,motorAt,setMotorSpeed,resumeSpeedAt,TAU} from './modules/rotary-session.js';
const $=id=>document.getElementById(id),copyDefault=()=>DEFAULT_MOTOR.map(e=>({...e}));
let selected=candidates[0],time=0,playing=false,rate=1,last=0,shown=-1,dirty=true,raf=0;
let motorEvents=copyDefault(),manual=false,cut=0,explode=0,view=null,labels=true,drag=null,current=null;
const cap=t=>Math.max(0,Math.min(18,Number(t)||0));
function opts(t){return{shaftAngle:motorAt(motorEvents,t).angle,labels,...(manual?{cut,explode}:{}),...(view?{viewYaw:view.yaw,viewPitch:view.pitch}:{})};}
function transport(){$('play').textContent=playing?'Ⅱ 暂停':'▶ 播放';$('play').setAttribute('aria-label',playing?'暂停':'播放');}
function pause(){if(playing&&shown>=0&&time<18)time=shown;playing=false;dirty=true;transport();}
function seek(t){time=cap(t);last=performance.now();dirty=true;paint();}
function toggle(){if(playing){pause();paint();return;}if(time>=18)seek(0);playing=true;last=performance.now();transport();}
function paint(){
 const t=playing&&time<18?Math.floor(time*30)/30:time,o=opts(t),s=selected.sample(t,o),motor=motorAt(motorEvents,t);current=s;
 selected.draw($('scene').getContext('2d'),t,1600,900,o);
 $('time').textContent=`${t.toFixed(3)} / 18.000 s`;$('seek').value=time;$('phase').textContent=manual?'手动检查结构':selected.stages[s.stageIndex]||'';$('annotation').textContent=s.annotation;
 $('shaftTurns').textContent=(s.shaftAngle/TAU).toFixed(3)+' 圈';$('rotorTurns').textContent=(s.rotorAngle/TAU).toFixed(3)+' 圈';
 $('cut').value=s.cut;$('explode').value=s.explode;$('cutValue').textContent=Math.round(s.cut*100)+'%';$('explodeValue').textContent=Math.round(s.explode*100)+'%';
 $('rpm').value=motor.rpm;$('rpmValue').textContent=motor.rpm.toFixed(0)+' rpm';$('freeze').textContent=motor.rpm===0?'恢复机构运动':'冻结机构，继续观察';
 const yaw=view?.yaw??s.camera?.yaw??.35,pitch=view?.pitch??s.camera?.pitch??.45;
 $('yaw').value=yaw;$('pitch').value=pitch;$('yawValue').textContent=(yaw*180/Math.PI).toFixed(0)+'°';$('pitchValue').textContent=(pitch*180/Math.PI).toFixed(0)+'°';
 document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.stage)===s.stageIndex)));
 $('diagnostics').textContent=JSON.stringify({id:selected.id,time:t,playing,manual,options:o,motorEvents,shaftAngle:s.shaftAngle,rotorAngle:s.rotorAngle,cut:s.cut,explode:s.explode,camera:s.camera});shown=t;dirty=false;
}
function refresh(){
 $('shotTitle').textContent=selected.variant==='explode'?'沿装配关系拆开':'移开前盖，观察内部';$('usage').textContent=selected.usage;$('candidateLink').href='./index.html#'+selected.id;
 document.querySelectorAll('[data-candidate]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.candidate===selected.id)));
 $('chapters').replaceChildren();selected.stageTimes.forEach((t,i)=>{const b=document.createElement('button');b.textContent=selected.stages[i];b.dataset.stage=i;b.onclick=()=>{pause();manual=false;time=cap(t);refresh();};$('chapters').append(b);});
 $('mode').value=manual?'manual':'scripted';$('cut').disabled=!manual;$('explode').disabled=!manual;$('labels').checked=labels;paint();
}
for(const [i,c] of candidates.entries()){
 const b=document.createElement('button'),num=document.createElement('small'),title=document.createElement('strong'),desc=document.createElement('span');num.textContent=`0${i+1} / MECHANICS`;title.textContent=c.variant==='explode'?'沿轴拆解 · 对应与归位':'打开观察口 · 运动不间断';desc.textContent=c.variant==='explode'?'认出每个零件来自哪里，再装回原处':'让外壳让开，持续追踪同一组顶点';b.append(num,title,desc);b.dataset.candidate=c.id;b.onclick=()=>{pause();selected=c;refresh();};$('choices').append(b);
}
$('play').onclick=toggle;$('restart').onclick=()=>{pause();seek(0);toggle();};$('prev').onclick=()=>{pause();seek(time-1/30);};$('next').onclick=()=>{pause();seek(time+1/30);};$('seek').oninput=e=>{pause();seek(e.target.value);};$('rate').onchange=e=>{rate=Number(e.target.value);last=performance.now();};
$('mode').onchange=e=>{pause();manual=e.target.value==='manual';if(manual){cut=current.cut;explode=current.explode;}refresh();};
for(const id of ['cut','explode'])$(id).oninput=e=>{pause();manual=true;if(id==='cut')cut=Number(e.target.value);else explode=Number(e.target.value);paint();};
function changeRPM(rpm){pause();const t=time;motorEvents=setMotorSpeed(motorEvents,t,rpm);$('status').textContent=`已在 ${t.toFixed(2)} 秒更新演示转速，保留当前角度。`;paint();}
$('rpm').oninput=e=>changeRPM(Number(e.target.value));$('freeze').onclick=()=>{pause();changeRPM(motorAt(motorEvents,time).rpm===0?resumeSpeedAt(motorEvents,time):0);};
function setView(yaw,pitch){view={yaw:Math.max(-.65,Math.min(.65,yaw)),pitch:Math.max(.2,Math.min(.8,pitch))};dirty=true;paint();}
for(const id of ['yaw','pitch'])$(id).oninput=e=>{pause();const base=view??{yaw:current.camera?.yaw??.35,pitch:current.camera?.pitch??.45};setView(id==='yaw'?Number(e.target.value):base.yaw,id==='pitch'?Number(e.target.value):base.pitch);};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{pause();const pair={front:[0,.2],oblique:[.35,.45],side:[.65,.5]}[b.dataset.view];setView(...pair);});
$('labels').onchange=e=>{labels=e.target.checked;dirty=true;paint();};
$('scene').onkeydown=e=>{if(e.code==='Space'){e.preventDefault();toggle();}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();pause();seek(time+(e.key==='ArrowLeft'?-1:1)/30);}};
$('scene').onpointerdown=e=>{if(e.button!==0)return;pause();drag={x:e.clientX,y:e.clientY,yaw:view?.yaw??current.camera?.yaw??.35,pitch:view?.pitch??current.camera?.pitch??.45};$('scene').setPointerCapture(e.pointerId);};
$('scene').onpointermove=e=>{if(!drag)return;setView(drag.yaw+(e.clientX-drag.x)*.003,drag.pitch+(e.clientY-drag.y)*.003);};
const endDrag=()=>{drag=null;};$('scene').onpointerup=endDrag;$('scene').onpointercancel=endDrag;$('scene').onlostpointercapture=endDrag;
$('reset').onclick=()=>{pause();motorEvents=copyDefault();manual=false;cut=0;explode=0;view=null;labels=true;$('status').textContent='已恢复分镜与默认转速。';refresh();};
const exportUrls=new Map();
function download(blob,name,linkId){const old=exportUrls.get(linkId);if(old)URL.revokeObjectURL(old);const url=URL.createObjectURL(blob),a=$(linkId);exportUrls.set(linkId,url);a.href=url;a.download=name;a.hidden=false;a.click();}
$('export').onclick=async()=>{
 pause();paint();const chosen=selected,events=motorEvents.map(e=>({...e})),settings={manual,cut,explode,view:view?{...view}:null,labels},at=shown,frames=[];
 $('export').disabled=true;
 try{
  for(let i=0;i<=540;i++){
   const t=i/30,o={shaftAngle:motorAt(events,t).angle,labels:settings.labels,...(settings.manual?{cut:settings.cut,explode:settings.explode}:{}),...(settings.view?{viewYaw:settings.view.yaw,viewPitch:settings.view.pitch}:{})},s=chosen.sample(t,o);
   frames.push({frame:i,time:t,shaftAngle:s.shaftAngle,rotorAngle:s.rotorAngle,cut:s.cut,explode:s.explode,camera:frameRotaryState(s),baseCamera:s.camera,parts:s.parts});
   if(i%6===0){$('status').textContent=`正在生成 ${i+1} / 541 个状态点…`;await new Promise(resolve=>setTimeout(resolve,0));}
  }
  const data={schemaVersion:1,candidateId:chosen.id,duration:18,fps:30,time:at,motorEvents:events,options:settings,angleUnit:'radians',geometry:'dimensionless ideal straight-sided rotor; not production Mazda geometry',renderFrameRange:[0,539],endpointFrame:540,code:'lab/modules/rotary-interaction.js',guide:'guides/rotary-interaction.md',frames};download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),chosen.id+'-plan.json','planDownload');$('status').textContent='已生成分镜、转速事件和 541 个状态点，可通过下载链接保存。';
 }catch(error){$('status').textContent='导出未完成，请重试。';console.error(error);}finally{$('export').disabled=false;}
};
$('saveFrame').onclick=()=>{pause();paint();const id=selected.id,t=shown;$('scene').toBlob(blob=>{if(!blob)return;download(blob,`${id}-${t.toFixed(2)}s.png`,'frameDownload');if(selected.id===id)$('status').textContent='已生成所选帧，可通过下载链接保存。';},'image/png');};
function tick(now){if(playing){time=cap(time+Math.max(0,now-last)/1000*rate);if(time>=18)pause();if((playing?Math.floor(time*30)/30:time)!==shown)dirty=true;}last=now;if(dirty)paint();raf=requestAnimationFrame(tick);}
window.addEventListener('document-reader:open',()=>{pause();paint();});document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();paint();}});window.addEventListener('pagehide',()=>{pause();cancelAnimationFrame(raf);});window.addEventListener('pageshow',e=>{if(e.persisted){last=performance.now();dirty=true;cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);}});refresh();raf=requestAnimationFrame(tick);
