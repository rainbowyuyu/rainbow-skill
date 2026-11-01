import * as ui from './modules/ui-choreography.js';
import * as line from './modules/engraved-mechanism.js';

const $=id=>document.getElementById(id);
const metadata={
  'ui-identity-relay':{family:'UI / 同一对象的连续交接',question:'布局换了，观众还能找到同一个对象吗？',module:ui,code:'lab/modules/ui-choreography.js',api:'../examples/ui-choreography/API.md',guide:'../guides/ui-continuity.md',study:'../studies/max-ui-motion.md',stops:[[0,'建立素材'],[1.5,'选中'],[3.8,'跨容器'],[9,'展开详情'],[12,'停稳阅读']],transfer:'沿用同一个素材身份，先选中，再移动到工作区，最后展开详情。跨容器时先抬到共同坐标层，避免裁切和重复影子。',source:'MAX 参考：0–3.5 秒的寻找与选中，15–22.5 秒的素材与面板交接。',limits:'原创 Canvas 2D 仿射界面预演；没有模拟原片的三维面板弯曲。',brief:'让选中对象跨布局保持身份与可读性；接入项目实际素材，不复制来源品牌。'},
  'ui-click-to-timeline':{family:'UI / 动作与结果',question:'一次确认，怎样自然变成时间线里的结果？',module:ui,code:'lab/modules/ui-choreography.js',api:'../examples/ui-choreography/API.md',guide:'../guides/ui-continuity.md',study:'../studies/max-ui-motion.md',stops:[[0,'建立任务'],[2.6,'按钮反馈'],[4.3,'移动素材'],[6.4,'提交结果'],[12,'稳定阅读']],transfer:'按钮按下只是动作开始。素材抵达目标、完成提交后才给确认；倾斜布局先回正，再留出结果阅读时间。',source:'MAX 参考：24.5–27.5 秒，按钮 → 片段 → 播放头 → 下一布局。',limits:'原创 Canvas 2D 界面解释；确认事件可供声音接入，当前试作静音。',brief:'绑定真实提交事件，把按钮动作与素材结果连成一条链；结果保持可读。'},
  'engraved-flow-path':{family:'LINEWORK / 黑场雕刻',question:'不靠透明外壳，也能讲清内部关系吗？',module:line,code:'lab/modules/engraved-mechanism.js',api:'../examples/engraved-mechanism/API.md',guide:'../guides/linework-language.md',study:'../studies/qinyulian-linework.md',stops:[[0,'建立轮廓'],[3,'排线成体'],[5.6,'沿流路'],[8,'开盖看结构'],[13,'回装落定']],transfer:'实体面保留前后遮挡，排线绑定部件表面，暖金只突出当前解释路径。拆开、看清，再把同一组部件装回去。',source:'沁雨莲参考：10–16 秒的材料揭示与吊装；全片黑场雕刻层次。',limits:'有限凸面几何的投影与深度排序，非通用 Z-buffer。流向虚线是解释层，不是 CFD。',brief:'用实体遮挡、分级线条和局部排线建立体积，以少量暖金引导当前结构关系。'},
  'engraved-orthographic-assembly':{family:'LINEWORK / 纸白工程图',question:'怎样让工程图拥有可读的动作顺序？',module:line,code:'lab/modules/engraved-mechanism.js',api:'../examples/engraved-mechanism/API.md',guide:'../guides/linework-language.md',study:'../studies/qinyulian-linework.md',stops:[[0,'轮廓建立'],[3.8,'排线出现'],[6.4,'部件拆开'],[9.7,'回装'],[14.5,'图版落定']],transfer:'结构先出现，排线补充明暗，尺寸最后建立。用同一机构演示拆装，让图版承担解释与停顿。',source:'沁雨莲参考：106–110 秒纸白图版的分步建立与媒介切换。',limits:'原创单一正交视角图版，并未复刻原片的三视图排版。固定纸纹、有限凸面排序。',brief:'先结构，后材质，再标注；保持部件 ID 和装配轴，保证任意定位一致。'},
};
const candidates=[...ui.candidates,...line.candidates];
let active=candidates.find(c=>c.id===location.hash.slice(1))||candidates[2];
let time=0,playing=false,last=null;
const canvas=$('stage'),ctx=canvas.getContext('2d');
function stop(){playing=false;last=null;$('play').textContent='播放';$('play').setAttribute('aria-label','播放');}
function render(){
  const m=metadata[active.id];m.module.draw(ctx,time,canvas.width,canvas.height,{id:active.id});
  const s=m.module.sample(time,{id:active.id});
  $('time').value=time;$('timecode').textContent=`${time.toFixed(2)} / ${active.duration.toFixed(2)}`;
  $('phase').textContent=typeof s.phase==='string'?s.phase:'观察 · 动作 · 落定';
  $('hold').textContent=s.readWindow===true?'阅读窗口':'';
  $('state').textContent=JSON.stringify({id:active.id,time,phase:s.phase,camera:s.camera,drawProgress:s.drawProgress,hatchProgress:s.hatchProgress,readWindow:s.readWindow,occlusion:s.occlusion,hero:s.hero,masks:s.masks,commit:s.clipCommitted,events:s.events,partIds:s.parts?.map(p=>p.id)},null,2);
}
function select(id,updateHash=true){
  const item=candidates.find(c=>c.id===id);if(!item)return;active=item;stop();time=0;
  const m=metadata[id];$('title').textContent=active.title;$('family').textContent=m.family;
  $('question').textContent=m.question;$('description').textContent=active.description;
  $('transfer').textContent=m.transfer;$('sourceNote').textContent=m.source;$('limits').textContent=m.limits;
  for(const key of ['api','guide','study'])$(key).href=m[key];
  $('time').max=active.duration;
  document.querySelectorAll('.choice').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));
  $('stops').replaceChildren(...m.stops.map(([t,label])=>{const b=document.createElement('button');b.textContent=`${t.toFixed(1)}s · ${label}`;b.onclick=()=>{stop();time=t;render();};return b;}));
  if(updateHash)history.replaceState(null,'',`#${id}`);render();
}
for(const candidate of candidates){const b=document.createElement('button');b.className='choice';b.dataset.id=candidate.id;b.setAttribute('aria-pressed','false');const small=document.createElement('small'),strong=document.createElement('strong'),span=document.createElement('span');small.textContent=metadata[candidate.id].family;strong.textContent=candidate.title;span.textContent=`${candidate.duration} 秒 · 原创预演`;b.append(small,strong,span);b.onclick=()=>select(candidate.id);$('candidates').append(b);}
$('play').onclick=()=>{if(playing){stop();return;}if(time>=active.duration)time=0;playing=true;last=null;$('play').textContent='暂停';$('play').setAttribute('aria-label','暂停');};
$('prev').onclick=()=>{stop();time=Math.max(0,time-1/30);render();};
$('next').onclick=()=>{stop();time=Math.min(active.duration,time+1/30);render();};
$('restart').onclick=()=>{stop();time=0;render();};
$('time').oninput=()=>{stop();time=Number($('time').value);render();};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);$('message').textContent=`已导出 ${name}`;}
$('brief').onclick=()=>{const m=metadata[active.id];download(new Blob([JSON.stringify({schemaVersion:1,candidate:active.id,title:active.title,duration:active.duration,selectedTime:time,technique:m.brief,sourceObservation:m.source,code:m.code,api:m.api,limits:m.limits,renderContract:'sample(t,{id}); draw(ctx,t,width,height,{id}); absolute seconds; silent',projectIntegration:{question:'',stateSource:'',narrationCue:'',musicWindow:'',handoffAnchor:'',review:'待接入工程后检查'}},null,2)],{type:'application/json'}),`${active.id}-brief.json`);};
$('png').onclick=()=>canvas.toBlob(blob=>{if(blob)download(blob,`${active.id}-${time.toFixed(2)}s.png`);},'image/png');
window.addEventListener('hashchange',()=>select(location.hash.slice(1),false));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('document-reader:open',stop);
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA','BUTTON','A','SUMMARY'].includes(document.activeElement?.tagName))return;if(e.code==='Space'){e.preventDefault();$('play').click();}else if(e.code==='ArrowRight')$('next').click();else if(e.code==='ArrowLeft')$('prev').click();});
function tick(stamp){if(playing){if(last!==null)time=Math.min(active.duration,time+(stamp-last)/1000*Number($('speed').value));last=stamp;render();if(time>=active.duration)stop();}requestAnimationFrame(tick);}
select(active.id,false);
if(matchMedia('(prefers-reduced-motion: reduce)').matches)$('message').textContent='当前默认暂停；可用阶段按钮查看稳定状态，也可主动播放完整运动。';
requestAnimationFrame(tick);
