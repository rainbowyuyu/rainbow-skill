import {candidates} from './modules/switch-anatomy.js';
import {switchControls,planSwitchTransition,sampleSwitchTransition} from './modules/switch-session.js';
const $=id=>document.getElementById(id),cap=t=>Math.max(0,Math.min(18,Number(t)||0));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let selected=candidates[0],time=0,playing=false,rate=1,last=0,shown=-1,dirty=true,raf=0,current=null;
let manual=false,controls={press:0,cut:0,explode:0,focus:0},plan=null,releaseAt=null,pendingPlay=false,view=null,labels=true,drag=null;
const clock=()=>performance.now()/1000;
function options(){return{labels,...(manual?controls:{}),...(view?{viewYaw:view.yaw,viewPitch:view.pitch}:{})};}
function transport(){$('play').textContent=playing||pendingPlay?'Ⅱ 暂停':'▶ 播放';$('play').setAttribute('aria-label',playing||pendingPlay?'暂停':'播放');}
function pause(){if(playing&&shown>=0)time=shown;playing=false;pendingPlay=false;transport();}
function cancelAction(){plan=null;releaseAt=null;pendingPlay=false;}
function seek(t){pause();cancelAction();manual=false;time=cap(t);dirty=true;paint();}
function change(patch,{release=false,playAfter=false}={}){
 pause();const now=clock(),pendingTarget=plan?.to;if(plan)controls=sampleSwitchTransition(plan,now);else controls=switchControls(current);
 manual=true;releaseAt=null;pendingPlay=playAfter;
 const request={...(pendingTarget??{}),...patch};if(patch.press>0)request.explode=0;if(patch.explode>0)request.press=0;
 plan=planSwitchTransition(controls,request,now,{reducedMotion:reduced.matches});
 if(release)releaseAt=plan.end+.75;
 dirty=true;transport();paint();
}
function toggle(){
 if(playing||pendingPlay){pause();cancelAction();paint();return;}
 if(time>=18){time=0;manual=false;cancelAction();}
 if(manual){change(switchControls(selected.sample(time,{labels})),{playAfter:true});return;}
 playing=true;last=performance.now();transport();
}
const descriptions={keycap:'手指推动键帽，键轴沿导向下降。它既压缩弹簧，也通过侧面的斜面带动触片。',spring:'上端跟随键轴，下端坐在底座上。压得越短，理想线性弹簧的恢复力越大；松开后让键轴回位。',contact:'斜面推动随动件，缩小两金属触点的间隙。接触后的额外行程由弹性耦合吸收，不让触点穿过去。',housing:'底座固定触片根部和弹簧下端；外壳提供装配空间。展示时移开前侧壳体，让内部动作露出来。'};
function partText(){$('partNote').textContent=descriptions[$('part').value];}
function paint(){
 const t=playing?Math.floor(time*30)/30:time,o=options(),s=selected.sample(t,o),m=s.mechanism;current=s;
 selected.draw($('scene').getContext('2d'),t,1600,900,o);
 $('time').textContent=`${t.toFixed(3)} / 18.000 s`;$('seek').value=time;
 $('phase').textContent=manual?(plan?'正在调整结构':'手动检查'):selected.stages[s.stageIndex];$('annotation').textContent=s.annotation;
 $('travel').textContent=m.travelMm.toFixed(2)+' mm';$('force').textContent=m.spring.forceN.toFixed(3)+' N';
 $('contact').textContent=s.explode>.001?'拆解展示':m.contact.closed?'已闭合':'未接触';
 for(const id of ['press','cut','explode','focus']){$(id).value=s[id];$(id+'Value').textContent=id==='press'?m.travelMm.toFixed(2)+' mm':Math.round(s[id]*100)+'%';}
 $('yaw').value=s.camera.yaw;$('pitch').value=s.camera.pitch;$('labels').checked=labels;
 $('toggleExplode').textContent=s.explode>.5?'装回去':'拆开看看';
 document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(!manual&&Number(b.dataset.stage)===s.stageIndex)));
 $('diagnostics').textContent=JSON.stringify({id:selected.id,time:t,playing,pendingPlay,manual,transitioning:!!plan,controls:switchControls(s),camera:s.camera,travelMm:m.travelMm,contactGapMm:m.contact.gapMm,closed:m.contact.closed,operatingAssembly:s.operatingAssembly,forceN:m.spring.forceN});
 shown=t;dirty=false;
}
function refresh(){
 $('shotTitle').textContent=selected.variant==='explode'?'拆开，认出装配关系':'让动作解释内部';$('usage').textContent=selected.usage;$('candidateLink').href='./index.html#'+selected.id;
 document.querySelectorAll('[data-candidate]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.candidate===selected.id)));
 $('chapters').replaceChildren();selected.stageTimes.forEach((t,i)=>{const b=document.createElement('button');b.textContent=selected.stages[i];b.dataset.stage=i;b.onclick=()=>seek(t);$('chapters').append(b);});paint();
}
for(const [i,c] of candidates.entries()){
 const b=document.createElement('button'),n=document.createElement('small'),h=document.createElement('strong'),p=document.createElement('span');n.textContent=`0${i+1} / MECHANISM STUDY`;h.textContent=c.variant==='explode'?'轴向拆解 · 先拆再装':'局部观察 · 跟随一次按压';p.textContent=c.variant==='explode'?'让每个零件保留自己的装配位置':'从完整按键走近同一对金属触点';b.append(n,h,p);b.dataset.candidate=c.id;b.onclick=()=>{pause();cancelAction();manual=false;selected=c;time=0;refresh();};$('choices').append(b);
}
$('play').onclick=toggle;$('restart').onclick=()=>{seek(0);toggle();};$('prev').onclick=()=>seek(time-1/30);$('next').onclick=()=>seek(time+1/30);$('seek').oninput=e=>seek(e.target.value);$('rate').onchange=e=>{rate=Number(e.target.value);last=performance.now();};
for(const id of ['press','cut','explode','focus'])$(id).oninput=e=>{change({[id]:Number(e.target.value)});$('status').textContent=id==='press'&&current.explode>0?'先回装，再按下。':id==='explode'&&current.press>0?'先松开，再拆解。':'';};
$('pressOnce').onclick=()=>{change({press:1,cut:1,explode:0,focus:.7},{release:true});$('status').textContent='回装 → 按下 → 短暂停留 → 松开。';};
$('toggleExplode').onclick=()=>{change({explode:(plan?.to.explode??current.explode)>.5?0:1,cut:1,focus:0});$('status').textContent='沿装配关系移动，可以中途改变方向。';};
$('part').onchange=partText;$('inspectPart').onclick=()=>{const id=$('part').value;change(id==='contact'?{explode:0,cut:1,focus:1}:id==='housing'?{press:0,cut:1,explode:0,focus:0}:id==='spring'?{press:0,cut:1,explode:.5,focus:0}:{cut:1,explode:0,focus:0});};
function setView(yaw,pitch){view={yaw:Math.max(-.75,Math.min(-.12,yaw)),pitch:Math.max(.25,Math.min(.60,pitch))};dirty=true;paint();}
for(const id of ['yaw','pitch'])$(id).oninput=e=>{pause();const base=view??current.camera;setView(id==='yaw'?Number(e.target.value):base.yaw,id==='pitch'?Number(e.target.value):base.pitch);};
$('labels').onchange=e=>{labels=e.target.checked;dirty=true;paint();};
$('scene').onkeydown=e=>{if(e.code==='Space'){e.preventDefault();toggle();}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();seek(time+(e.key==='ArrowLeft'?-1:1)/30);}};
$('scene').onpointerdown=e=>{if(e.button!==0)return;pause();drag={x:e.clientX,y:e.clientY,yaw:current.camera.yaw,pitch:current.camera.pitch};$('scene').setPointerCapture(e.pointerId);};
$('scene').onpointermove=e=>{if(drag)setView(drag.yaw+(e.clientX-drag.x)*.003,drag.pitch+(e.clientY-drag.y)*.003);};
const endDrag=()=>{drag=null;};$('scene').onpointerup=endDrag;$('scene').onpointercancel=endDrag;$('scene').onlostpointercapture=endDrag;
$('reset').onclick=()=>{pause();cancelAction();manual=false;view=null;labels=true;$('status').textContent='已恢复当前时刻的完整分镜。';paint();};
const urls=new Map();
function download(blob,name,id){if(urls.has(id))URL.revokeObjectURL(urls.get(id));const u=URL.createObjectURL(blob),a=$(id);urls.set(id,u);a.href=u;a.download=name;a.hidden=false;a.click();}
function freeze(){pause();cancelAction();paint();}
$('saveFrame').onclick=()=>{freeze();const name=selected.id+'-'+shown.toFixed(2)+'s.png';$('scene').toBlob(b=>{if(b){download(b,name,'frameDownload');$('status').textContent='画面已生成，可使用下载链接保存。';}},'image/png');};
$('export').onclick=async()=>{
 freeze();const chosen=selected,o=structuredClone(options()),at=shown,mode=manual?'manual-frozen-state':'scripted',frames=[];$('export').disabled=true;
 try{
  for(let i=0;i<=540;i++){const t=i/30,s=chosen.sample(t,o),m=s.mechanism;frames.push({frame:i,time:t,controls:switchControls(s),camera:s.camera,parts:s.parts,travelMm:m.travelMm,spring:{lengthMm:m.spring.lengthMm,forceN:m.spring.forceN},contact:{gapMm:m.contact.gapMm,closed:m.contact.closed},operatingAssembly:s.operatingAssembly});if(i%30===0){$('status').textContent=`生成状态 ${i+1} / 541…`;await new Promise(r=>setTimeout(r,0));}}
  const data={schemaVersion:1,candidateId:chosen.id,mode,duration:18,fps:30,time:at,options:o,parameters:chosen.sample(at,o).mechanism.parameters,renderFrameRange:[0,539],endpointFrame:540,units:'mm,N,radians',model:'original ideal linear spring switch; not a branded product or dynamic simulation',code:'lab/modules/switch-anatomy.js',mechanism:'lab/modules/switch-mechanism.js',guide:'guides/anatomy-mechanics.md',frames};
  download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),chosen.id+'-plan.json','planDownload');$('status').textContent=mode==='scripted'?'已导出 18 秒分镜和 541 个状态点。':'已导出当前手动状态与视角；未把操作历史当成动画。';
 }catch(e){console.error(e);$('status').textContent='导出失败，请重试。';}finally{$('export').disabled=false;}
};
function tick(nowMs){const now=nowMs/1000;
 if(plan){controls=sampleSwitchTransition(plan,now);dirty=true;if(now>=plan.end){plan=null;if(pendingPlay){manual=false;pendingPlay=false;playing=true;last=nowMs;transport();}}}
 if(releaseAt!==null&&now>=releaseAt){releaseAt=null;plan=planSwitchTransition(controls,{press:0},now,{reducedMotion:reduced.matches});dirty=true;}
 if(playing){time=cap(time+Math.max(0,nowMs-last)/1000*rate);if(time>=18){playing=false;transport();}if(Math.floor(time*30)/30!==shown)dirty=true;}
 last=nowMs;if(dirty)paint();raf=requestAnimationFrame(tick);
}
function suspend(){pause();cancelAction();dirty=true;paint();}
window.addEventListener('document-reader:open',suspend);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});window.addEventListener('pagehide',()=>{suspend();cancelAnimationFrame(raf);});window.addEventListener('pageshow',e=>{if(e.persisted){last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);}});
partText();refresh();raf=requestAnimationFrame(tick);
