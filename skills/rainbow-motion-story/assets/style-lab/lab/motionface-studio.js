const $=id=>document.getElementById(id);
const canvas=$('scene'),ctx=canvas.getContext('2d');
const playButton=$('play'),playIcon=playButton.firstChild,playLabel=playButton.querySelector('span');
const FPS=30,LOGICAL_WIDTH=1600,LOGICAL_HEIGHT=900;
const reduceQuery=matchMedia('(prefers-reduced-motion:reduce)');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const labels={paper:'奶油纸墨',lime:'黑白酸柠',coral:'深靛珊瑚'};
const presentation={
  'mf-card-convergence':{name:'卡片汇聚',short:'从散到整',icon:'cards'},
  'mf-mask-typeset':{name:'遮罩排字',short:'让文字显影',icon:'mask'},
  'mf-focus-handoff':{name:'焦点接力',short:'把注意力交出去',icon:'focus'},
  'mf-trace-assembly':{name:'轨迹组装',short:'从路径到结构',icon:'trace'},
  'mf-concept-bridge':{name:'对象接棒',short:'同一观测，从看见到判断',icon:'bridge'},
  'mf-type-orbit-lock':{name:'环字落定',short:'让环绕，落成一句话',icon:'orbit'}
};
const moduleDefinitions=[{path:'./modules/motionface-type.js',defaults:'motionfaceDefaults'},{path:'./modules/motionface-concepts.js',defaults:'motionfaceConceptDefaults'},{path:'./modules/motionface-kinetic.js',defaults:'motionfaceKineticDefaults'}];
const modulePaths=new Map();
const studyScope='公开首页动作观察，以及经用户授权登录后两部作品片段的静态研究；付费源码未解锁，未宣称完整素材库复刻。';
const dirty={headline:false,kicker:false,result:false};
let candidates=[],defaults={},selected=null,t=0,playing=false,last=0,palette='paper',reduced=reduceQuery.matches,stages=[],lastCodeTrigger=null;

function announce(value){$('status').textContent=value;}
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function icon(kind){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 40 40');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.4');
  const definitions={cards:[['rect',{x:5,y:10,width:20,height:25,rx:3,transform:'rotate(-12 15 23)'}],['rect',{x:15,y:5,width:20,height:25,rx:3}],['path',{d:'M20 13H29M20 18H29M20 23H26'}]],mask:[['path',{d:'M6 7H34M6 33H34M12 29L20 11L28 29M15 23H25'}],['path',{d:'M5 20H35','stroke-dasharray':'2 3'}]],focus:[['circle',{cx:11,cy:21,r:5}],['circle',{cx:29,cy:15,r:7}],['path',{d:'M17 21C23 27 26 25 29 23M25 27L29 23L24 22'}]],trace:[['path',{d:'M6 31C6 11 25 31 25 10','stroke-dasharray':'2 3'}],['circle',{cx:6,cy:31,r:3}],['rect',{x:20,y:4,width:13,height:13,rx:3}],['path',{d:'M23 30H33M28 25V35'}]],bridge:[['path',{d:'M4 10H13M4 15H10M28 25H36M28 30H33'}],['circle',{cx:20,cy:20,r:7}],['path',{d:'M8 25C8 32 18 35 24 32M29 7C33 8 35 12 35 16','stroke-dasharray':'2 3'}]],orbit:[['ellipse',{cx:20,cy:20,rx:15,ry:10,transform:'rotate(-28 20 20)'}],['path',{d:'M12 16H27M12 23H24'}],['circle',{cx:7,cy:25,r:3}],['circle',{cx:32,cy:13,r:2}]]};
  for(const [tag,attrs] of definitions[kind]){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);svg.append(node);}return svg;
}
function options(){return {palette,intensity:Number($('intensity').value)/100,headline:$('headline').value,kicker:$('kicker').value,result:$('result').value,reducedMotion:reduced};}
function ordinal(id){return String(candidates.findIndex(item=>item.id===id)+1).padStart(2,'0');}
function currentModule(){return modulePaths.get(selected.id);}
function currentDefaults(){return defaults[selected?.id]||selected?.defaults||{};}
function copyDefaults(force=false){const values=currentDefaults();for(const key of Object.keys(dirty)){if(force||!dirty[key]){$(key).value=typeof values[key]==='string'?values[key]:'';dirty[key]=false;}}}
function normalizedStages(sample){
  if(Array.isArray(sample?.timings)&&sample.timings.length)return sample.timings.map((stage,i)=>({id:stage.id||String(i),label:stage.label||`阶段 ${i+1}`,start:clamp(Number(stage.start)||0,0,selected.duration),end:clamp(Number(stage.end)||selected.duration,0,selected.duration),reading:Boolean(stage.reading)}));
  const names=selected.stages||['建立对象','动作展开','阅读落定','接力'];return names.map((label,i)=>({id:String(i),label,start:selected.duration*i/names.length,end:selected.duration*(i+1)/names.length}));
}
function renderStageButtons(){
  $('stages').replaceChildren();for(const [i,stage]of stages.entries()){const button=element('button','stage-button');button.type='button';button.dataset.index=String(i);button.setAttribute('aria-label',`${stage.label}，从 ${stage.start.toFixed(1)} 秒查看`);button.append(element('small','',`${stage.start.toFixed(1)} — ${stage.end.toFixed(1)}s`),element('strong','',stage.label));button.onclick=()=>seek(stage.start);$('stages').append(button);}
}
function draw(){
  if(!selected)return;
  const value=options();selected.draw(ctx,t,canvas.width,canvas.height,value);const sample=selected.sample(t,value);
  $('timeline').value=String(t);$('timeline').setAttribute('aria-valuetext',`${t.toFixed(2)} 秒，共 ${selected.duration} 秒`);if(document.activeElement!==$('seekSeconds'))$('seekSeconds').value=t.toFixed(2);$('time').textContent=`${t.toFixed(2).padStart(5,'0')} / ${selected.duration.toFixed(2)}`;
  const playbackState=playing?'playing':t>=selected.duration?'ended':'paused';
  if(playButton.dataset.state!==playbackState){
    // Keep the button and its hit-tested children stable across blur and RAF draws.
    playIcon.nodeValue=playing?'Ⅱ ':'▶ ';playLabel.textContent=playing?'暂停':playbackState==='ended'?'重播':'播放';
    playButton.setAttribute('aria-label',playing?'暂停':playbackState==='ended'?'从头播放':'播放');playButton.dataset.state=playbackState;
  }
  const hold=Boolean(sample?.readHold??sample?.readingHold);$('readingFlag').textContent=hold?'阅读停顿':'动作展开';$('readingFlag').dataset.hold=String(hold);$('phaseText').textContent=sample?.phase||stages.find(stage=>t>=stage.start&&t<stage.end)?.label||stages.at(-1)?.label||'完成';
  const phaseIndex=Number.isInteger(sample?.phaseIndex)?sample.phaseIndex:Math.max(0,stages.findIndex(stage=>t>=stage.start&&t<stage.end));for(const button of $('stages').children){const active=Number(button.dataset.index)===phaseIndex;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
}
function resize(){const ratio=Math.min(2,Math.max(1,window.devicePixelRatio||1));const width=Math.round(LOGICAL_WIDTH*ratio),height=Math.round(LOGICAL_HEIGHT*ratio);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}draw();}
function setPlaying(value){if(value&&reduced){announce('减少动态效果已开启。可拖动时间轴或逐帧查看，关闭后再播放。');return;}if(value&&t>=selected.duration)t=0;playing=Boolean(value);last=performance.now();draw();}
function seek(value){if(!selected)return;t=clamp(Number(value)||0,0,selected.duration);playing=false;last=performance.now();draw();}
function select(id){
  const next=candidates.find(candidate=>candidate.id===id);if(!next)return;selected=next;t=0;playing=false;last=performance.now();copyDefaults();history.replaceState(null,'','#'+id);const meta=presentation[id];$('activeName').textContent=`${ordinal(id)} / ${meta.name}`;$('methodUse').textContent=selected.usage||selected.description||'先建立明确对象，让变化发生，再留下足够的阅读时间。';$('timeline').max=selected.duration;$('seekSeconds').max=selected.duration;$('moduleSource').href=currentModule();
  for(const button of $('candidates').children)button.setAttribute('aria-pressed',String(button.dataset.candidate===id));stages=normalizedStages(selected.sample(0,options()));renderStageButtons();draw();
}
function setPalette(value){if(!Object.hasOwn(labels,value))return;palette=value;document.documentElement.dataset.palette=value;$('paletteName').textContent=labels[value];for(const button of $('palettes').children)button.setAttribute('aria-pressed',String(button.dataset.palette===value));draw();}
function setReduced(value){reduced=Boolean(value);$('reducedMotion').checked=reduced;if(reduced)playing=false;draw();}
function download(value,type,name){const url=URL.createObjectURL(new Blob([value],{type})),anchor=element('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function selection(){return {schema:'rainbow-motion-selection/1',study:'motionface-authorized-fragment-studies',candidate:selected.id,name:presentation[selected.id].name,module:currentModule().replace('./','lab/'),render:{width:LOGICAL_WIDTH,height:LOGICAL_HEIGHT,fps:FPS,duration:selected.duration,loop:false},options:options(),preview:{timeSeconds:Number(t.toFixed(5)),playbackRate:Number($('tempo').value),reducedMotion:reduced},stages,usage:selected.usage||'',reference:{url:'https://motionface.cc/',scope:studyScope},audio:'静音动效研究。未添加或复刻来源音频。',implementation:'原创 Canvas 2D 方法示范；不代表来源网站使用的实现算法。',integration:{time:'绝对时间，单位秒；不要把播放速度同时乘入模块参数。',text:'headline / kicker / result 可替换，保留阅读停顿。',entry:'candidates.find(item => item.id === candidate).draw(ctx, seconds, width, height, options)'}};}
function codeText(){return `import { candidates } from ${JSON.stringify(currentModule())};\n\n// 当前页面位于 lab/；在其他位置引用时调整 import 路径。\nconst motion = candidates.find(item => item.id === ${JSON.stringify(selected.id)});\nconst options = ${JSON.stringify(options(),null,2)};\n\n// 1600 × 900 逻辑画面；Canvas 像素可乘以最高 2 的 DPR。\nconst seconds = ${t.toFixed(3)};\nmotion.draw(ctx, seconds, canvas.width, canvas.height, options);\nconst state = motion.sample(seconds, options);\n// state.phase / state.readHold / state.timings 可与讲稿、字幕同步。\n// 只推进 seconds 改变播放速度；到 ${selected.duration} 秒停止，不自动循环。\n`;}
function closeCode(){if(!$('codeDialog').open)return;$('codeDialog').close();lastCodeTrigger?.focus();}
function bind(){
  for(const item of candidates){const meta=presentation[item.id];if(!meta)continue;const button=element('button','candidate');button.type='button';button.dataset.candidate=item.id;button.setAttribute('aria-pressed','false');const visual=element('span','candidate-icon');visual.append(icon(meta.icon));const text=element('span','candidate-copy');text.append(element('span','candidate-index',`${ordinal(item.id)} / ${item.duration}s`),element('strong','',meta.name),element('small','',meta.short));button.append(visual,text);button.onclick=()=>select(item.id);$('candidates').append(button);}
  $('candidateCount').textContent=String(candidates.length).padStart(2,'0');$('candidateSummary').textContent=`${candidates.length} 种原创方法 · 静音动效研究`;
  $('play').onclick=()=>setPlaying(!playing);$('restart').onclick=()=>{seek(0);if(!reduced)setPlaying(true);else announce('已回到开头；减少动态效果模式下可手动逐帧。');};$('prev').onclick=()=>seek(t-1/FPS);$('next').onclick=()=>seek(t+1/FPS);$('timeline').oninput=event=>seek(event.target.value);$('seekSeconds').oninput=event=>{if(event.target.value!==''&&event.target.validity.valid)seek(event.target.value);};$('seekSeconds').onblur=()=>{seek($('seekSeconds').value);$('seekSeconds').value=t.toFixed(2);};$('tempo').onchange=()=>{last=performance.now();announce(`播放速度 ${$('tempo').value}×；动作曲线与阅读阶段保持原定义。`);};
  $('intensity').oninput=()=>{$('intensityValue').textContent=$('intensity').value+'%';draw();};for(const button of $('palettes').children)button.onclick=()=>setPalette(button.dataset.palette);for(const key of Object.keys(dirty))$(key).oninput=()=>{dirty[key]=true;draw();};$('resetText').onclick=()=>{copyDefaults(true);draw();announce('已恢复当前方法的默认文字。');};$('reducedMotion').onchange=()=>setReduced($('reducedMotion').checked);reduceQuery.addEventListener('change',event=>setReduced(event.matches));
  canvas.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();setPlaying(!playing);}else if(event.key==='ArrowLeft'){event.preventDefault();seek(t-1/FPS);}else if(event.key==='ArrowRight'){event.preventDefault();seek(t+1/FPS);}else if(event.key==='Home'){event.preventDefault();seek(0);}else if(event.key==='End'){event.preventDefault();seek(selected.duration);}});
  $('saveSelection').onclick=()=>{download(JSON.stringify(selection(),null,2),'application/json;charset=utf-8',`${selected.id}-selection.json`);announce('已导出选用方案：文字、配色、幅度、阶段和代码入口均已记录。');};$('showCode').onclick=()=>{lastCodeTrigger=document.activeElement;$('codeText').value=codeText();$('copyStatus').textContent='';$('codeDialog').showModal();$('closeCode').focus();};$('closeCode').onclick=closeCode;$('codeDialog').addEventListener('cancel',event=>{event.preventDefault();closeCode();});$('codeDialog').addEventListener('click',event=>{if(event.target!==$('codeDialog'))return;const bounds=$('codeDialog').getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeCode();});
  $('copyCode').onclick=async()=>{try{await navigator.clipboard.writeText($('codeText').value);$('copyStatus').textContent='代码已复制，包含当前文字与动效设置。';}catch{$('codeText').focus();$('codeText').select();$('copyStatus').textContent='浏览器未允许自动复制。文本已选中，可按 Ctrl+C，或下载调用示例。';}};$('downloadCode').onclick=()=>{download($('codeText').value,'text/javascript;charset=utf-8',`${selected.id}-usage.js`);$('copyStatus').textContent='已下载调用示例。请根据项目位置调整 import 路径。';};
  window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(id!==selected.id&&candidates.some(item=>item.id===id))select(id);});window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){playing=false;draw();announce('页面暂时离开，已暂停在当前画面。');}last=performance.now();});
}
function loop(now){if(playing&&selected){const dt=clamp((now-last)/1000,0,.1);t=Math.min(selected.duration,t+dt*Number($('tempo').value));if(t>=selected.duration){playing=false;announce('已到末帧。可重播、反向逐帧，或导出当前方案。');}draw();}last=now;requestAnimationFrame(loop);}
async function init(){try{
  const results=await Promise.allSettled(moduleDefinitions.map(definition=>import(definition.path))),loaded=[];
  results.forEach((result,index)=>{const definition=moduleDefinitions[index];if(result.status==='fulfilled'){for(const item of result.value.candidates||[])if(Object.hasOwn(presentation,item.id)){loaded.push(item);modulePaths.set(item.id,definition.path);}Object.assign(defaults,result.value[definition.defaults]||{});}else console.warn('Motionface module not yet available:',definition.path,result.reason);});
  candidates=Object.keys(presentation).map(id=>loaded.find(item=>item.id===id)).filter(Boolean);if(!candidates.length)throw new Error('No Motionface candidates available');bind();const id=location.hash.slice(1);select(candidates.some(item=>item.id===id)?id:candidates[0].id);setReduced(reduced);resize();requestAnimationFrame(loop);
  if(candidates.length<Object.keys(presentation).length)announce(`已加载 ${candidates.length} 种方法；其余模块暂未就绪，可稍后刷新。`);
}catch(error){canvas.hidden=true;$('errorState').hidden=false;$('activeName').textContent='模块未载入';for(const node of document.querySelectorAll('main button,main input,main select'))node.disabled=true;announce('动效模块暂未载入，请检查本地服务并刷新。');console.error('Motionface workbench initialization failed:',error);}}
init();
