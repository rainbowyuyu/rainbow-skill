/** Original webpage art-direction examples. No remote templates or runtime dependencies. */
export const content = Object.freeze({
  title: '把复杂的世界，拆开看。',
  introduction: '从一阵风、一滴水，到一次稳定的抵达。用可见的结构，读懂看不见的关系。',
  projects: Object.freeze([
    {id:'tower',number:'01',title:'风，如何绕过一栋楼',subtitle:'上海中心 · 结构与气流',category:'结构',date:'研究 01',tags:['剖面','风场','城市'],description:'从城市尺度靠近塔身，再打开结构与阻尼器。重点是让观众知道：每一处变化，对应哪个问题。',question:'整体与局部之间，怎样保留同一个空间锚点？',method:'建立城市关系 → 聚焦塔身 → 展开一层 → 返回整体',art:'tower'},
    {id:'water',number:'02',title:'一滴水，为什么这样流',subtitle:'NS 方程 · 水面与作用力',category:'流体',date:'研究 02',tags:['水面','压强','粘性'],description:'把压强差、粘性与重力放回同一块水里。让文字跟随正在发生的变化，而不是让画面陪着公式转。',question:'这条公式中的每一项，能在水里看到什么？',method:'看到运动 → 找到作用 → 对照变化 → 回到同一水面',art:'water'},
    {id:'control',number:'03',title:'抵达之前，先学会修正',subtitle:'PID 控制 · 轨迹与反馈',category:'控制',date:'研究 03',tags:['轨迹','误差','反馈'],description:'同一条任务路线，用不同反馈方式完成。保留目标、误差与控制动作的联系，让变化有原因。',question:'为什么越接近目标，有时反而越容易晃动？',method:'给出目标 → 遇到扰动 → 比较反馈 → 稳定抵达',art:'control'},
    {id:'chip',number:'04',title:'在一毫米里，连接两面',subtitle:'电子封装 · 金属与玻璃',category:'材料',date:'研究 04',tags:['金属','互连','拆解'],description:'铜负责连接，玻璃负责隔开。沿着同一条路径穿过剖面，让材料质感和结构关系一起被看见。',question:'拆开后，怎样仍能认出部件原来的位置？',method:'认出材料 → 同轴分层 → 跟踪互连 → 回装核对',art:'chip'},
  ])
});

export const directions = Object.freeze([
  {id:'editorial',title:'纸上观察',english:'EDITORIAL',tagline:'先讲一个问题，再展开目录。',appropriateFor:'科普专栏、研究叙事、需要持续阅读的内容',tradeoff:'首个作品获得较大空间，批量查找效率低于工具台。',reason:'以标题、留白与一个重点作品建立入口；其他项目以目录承接。',layout:{hero:'非对称文字与重点插画',sectionOrder:['标题与引子','重点作品','研究目录'],narrowOrder:['标题','重点插画','研究目录']},tokens:{surface:'#f3f0e7',ink:'#263027',muted:'#62675d',accent:'#b6442e',line:'#d1d2c4',art:'#dce0d1',radius:'3px',contentWidth:'76rem',heading:'Georgia, "Songti SC", "SimSun", serif',body:'"Segoe UI", "Microsoft YaHei", sans-serif',motion:'240ms cubic-bezier(.2,.8,.2,1)'}},
  {id:'console',title:'工作中的秩序',english:'CONSOLE',tagline:'让作品、筛选与操作同时清楚。',appropriateFor:'创作工作台、资源管理、需要反复查找的页面',tradeoff:'信息密度更高，情绪铺陈和大幅视觉留白更少。',reason:'把搜索、分类、当前项目放到同一操作视野，用行结构提高可扫描性。',layout:{hero:'任务标题与紧凑概览',sectionOrder:['搜索与类别','项目行','当前项目详情'],narrowOrder:['标题','筛选','当前项目','项目行']},tokens:{surface:'#12232b',ink:'#edf4ec',muted:'#a4bcbf',accent:'#b9ed99',line:'#39515a',art:'#203d47',radius:'8px',contentWidth:'84rem',heading:'"Segoe UI", "Microsoft YaHei", sans-serif',body:'"Segoe UI", "Microsoft YaHei", sans-serif',motion:'180ms cubic-bezier(.2,.8,.2,1)'}},
  {id:'gallery',title:'有棱角的档案',english:'GALLERY',tagline:'给每个主题一个能被记住的形。',appropriateFor:'作品集、系列专题、以探索为目的的内容入口',tradeoff:'视觉面积更大，详细说明需要进入作品后阅读。',reason:'用大编号、克制的朱红与青蓝底形成视觉身份；卡片尺度随主次变化。',layout:{hero:'大字海报与横向档案索引',sectionOrder:['系列主张','海报网格','作品详情'],narrowOrder:['系列主张','顺序海报','作品详情']},tokens:{surface:'#dbe9e9',ink:'#153c43',muted:'#42636a',accent:'#a93625',line:'#9ebbbf',art:'#b9d2d4',radius:'0px',contentWidth:'80rem',heading:'"Arial Black", "Microsoft YaHei", sans-serif',body:'"Segoe UI", "Microsoft YaHei", sans-serif',motion:'300ms cubic-bezier(.16,1,.3,1)'}}
]);

export function normalizeState(input={}) {
  const ids=content.projects.map(p=>p.id);
  return {
    directionId:directions.some(d=>d.id===input.directionId)?input.directionId:'editorial',
    title:typeof input.title==='string'?input.title.slice(0,180):content.title,
    query:typeof input.query==='string'?input.query.slice(0,180):'',
    category:['全部',...content.projects.map(p=>p.category)].includes(input.category)?input.category:'全部',
    selectedId:ids.includes(input.selectedId)?input.selectedId:'tower',
    favorites:[...new Set((Array.isArray(input.favorites)?input.favorites:[]).filter(id=>ids.includes(id)))],
    onlyFavorites:Boolean(input.onlyFavorites),compact:Boolean(input.compact),
    reducedMotion:Boolean(input.reducedMotion),
    rationale:typeof input.rationale==='string'?input.rationale.slice(0,1000):''
  };
}

export function filterProjects(input={}) {
  const s=normalizeState(input),q=s.query.trim().toLocaleLowerCase();
  return content.projects.filter(p=>(s.category==='全部'||p.category===s.category)&&(!s.onlyFavorites||s.favorites.includes(p.id))&&(!q||[p.title,p.subtitle,p.description,p.category,...p.tags].join(' ').toLocaleLowerCase().includes(q)));
}

export function cssTokens(directionId) {
  const d=directions.find(d=>d.id===directionId);if(!d)throw new RangeError('Unknown direction');
  return `.world-page[data-direction="${d.id}"] {\n${Object.entries(d.tokens).map(([k,v])=>`  --page-${k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}: ${v};`).join('\n')}\n}\n`;
}

export function buildSelection(input={}) {
  const s=normalizeState(input),d=directions.find(d=>d.id===s.directionId);
  return {schema:'motion-atelier.web-aesthetic/v1',task:'选择适合内容与使用任务的网页视觉方向',audience:'希望理解原理、浏览研究作品的观众',primaryAction:'查找并打开一个研究项目',contentKind:'原创演示数据，不连接现有视频工程',content:JSON.parse(JSON.stringify(content)),currentTitle:s.title,state:s,selectedDirection:{id:d.id,title:d.title},reason:s.rationale.trim()||d.reason,tradeoff:d.tradeoff,tokens:{...d.tokens},layout:JSON.parse(JSON.stringify(d.layout)),sourceRefs:[{kind:'reference-video',url:'https://www.douyin.com/video/7699773577990228857',scope:'组件词汇和完整网站模板的学习入口；三种页面结构为原创归纳'},{kind:'reference-site',url:'https://yuanpu.cc/',scope:'原视频中出现的源铺；本例未复制其模板代码或素材'}],implementation:{entry:'lab/web-aesthetic.html',data:'lab/modules/web-aesthetic.js',styles:'lab/web-aesthetic.css',controller:'lab/web-aesthetic-studio.js'},review:{aesthetic:'由任务适配与人工比较判断，不提供审美总分',required:['真实中文长度','选中和收藏状态','键盘与焦点','窄屏内容顺序','减少动态效果','导出与当前状态一致']}};
}

export function designPrompt(input={}) {
  const x=buildSelection(input),d=x.selectedDirection;
  return `请基于真实内容设计网页，采用「${d.title}」方向。\n\n任务：${x.task}\n用户：${x.audience}\n主要操作：${x.primaryAction}\n页面标题：${x.currentTitle||'（请保留空标题状态，不补编文案）'}\n选用理由：${x.reason}\n取舍：${x.tradeoff}\n\n内容顺序：${x.layout.sectionOrder.join(' → ')}\n窄屏顺序：${x.layout.narrowOrder.join(' → ')}\n保留项目 ID、标题和事实；不要虚构状态、统计、客户评价或模型能力。\n搜索、分类、收藏、选中项目、空结果和详情弹窗必须有真实行为；切换风格后保留输入与选择。\n中文长标题允许自然换行，不截断关键含义。用清晰的主次、对齐和间距组织内容，不叠加无关装饰。\n动效只提示状态或焦点变化，尊重 prefers-reduced-motion。\n\n设计变量：\n${cssTokens(d.id)}\n交付前检查：窄屏不横向溢出，键盘能到达所有操作，弹窗关闭后焦点返回来源，文本对比足够，导出参数与画面一致。\n\n这是原创结构示例。参考入口用于理解组件与网站系统，不复制原站资产或未核定许可的模板。`;
}

/** SVG content contains only fixed code and validated enum inputs, never user text. */
export function artwork(kind,directionId='editorial') {
 const d=directions.find(d=>d.id===directionId)||directions[0],{surface,ink,accent,art}=d.tokens;
 const line=directionId==='console'?'#a9d8d2':ink;
 let body='';
 if(kind==='tower'){
  body=`<circle cx="580" cy="220" r="178" fill="${surface}" opacity=".55"/><path d="M160 470H770M200 450V365H255V450M275 450V325H335V450M615 450V285H680V450M700 450V348H750V450" fill="none" stroke="${line}" stroke-width="2" opacity=".5"/>`;
  for(let i=0;i<23;i++){const y=434-i*13,w=114-i*2.25,x=442+Math.sin(i/23*2.1)*39;body+=`<ellipse cx="${x}" cy="${y}" rx="${w/2}" ry="${11-i*.14}" fill="${i%5===0?accent:art}" stroke="${line}" stroke-width="1.5"/>`;}
  body+=`<path d="M390 434L448 142M505 434L505 142" stroke="${line}" fill="none" stroke-width="2"/><path d="M119 221C258 137 274 259 368 229M109 282C240 227 282 337 365 293M533 236C649 192 687 240 788 188M541 307C654 282 692 331 812 295" fill="none" stroke="${accent}" stroke-width="3"/><circle cx="108" cy="282" r="5" fill="${accent}"/>`;
 } else if(kind==='water'){
  body=`<circle cx="662" cy="174" r="90" fill="${accent}"/><path d="M0 382C190 218 295 448 470 284S744 291 900 211V560H0Z" fill="${ink}" opacity=".12"/>`;
  for(let i=0;i<18;i++){let p='';for(let x=0;x<=900;x+=12){const y=285+i*13+Math.sin(x/104+i*.17)*49+Math.cos(x/188+i*.09)*27;p+=(x?'L':'M')+x+','+y;}body+=`<path d="${p}" fill="none" stroke="${line}" stroke-width="${i===5?3:1.3}" opacity="${.32+i*.025}"/>`;}
  body+=`<path d="M370 256L381 205L392 256Z" fill="${surface}" stroke="${line}" stroke-width="2"/><ellipse cx="381" cy="260" rx="28" ry="9" fill="${accent}"/>`;
 } else if(kind==='control'){
  body=`<circle cx="451" cy="279" r="181" fill="none" stroke="${line}" stroke-width="1" opacity=".25"/><circle cx="451" cy="279" r="125" fill="none" stroke="${line}" stroke-width="1" opacity=".25"/><path d="M103 425H795M147 465V92" stroke="${line}" stroke-width="1.5" opacity=".5"/><path d="M170 401C248 390 282 128 369 147S410 414 487 385S552 154 612 195S654 316 735 277" fill="none" stroke="${line}" stroke-width="2" opacity=".35"/><path d="M170 401C280 410 275 150 374 204S447 329 528 278S625 275 735 277" fill="none" stroke="${accent}" stroke-width="6"/><path d="M169 278H735" stroke="${line}" stroke-width="1.5" stroke-dasharray="7 10"/><circle cx="735" cy="277" r="17" fill="${surface}" stroke="${accent}" stroke-width="5"/><circle cx="170" cy="401" r="7" fill="${line}"/>`;
 } else {
  for(let i=0;i<4;i++){const y=350-i*67;body+=`<path d="M215 ${y}L500 ${y-100}L720 ${y+12}L430 ${y+118}Z" fill="${i===2?accent:surface}" stroke="${line}" stroke-width="2"/>`;if(i===3)body+=`<path d="M326 ${y+3}L493 ${y-53}L603 ${y+4}L438 ${y+64}Z" fill="${ink}"/><path d="M355 ${y+1}L495 ${y-43}M381 ${y+14}L522 ${y-31}M407 ${y+27}L548 ${y-18}" stroke="${accent}" stroke-width="5"/>`;}
  body+=`<path d="M215 149V350M720 160V362M430 265V468" fill="none" stroke="${line}" stroke-width="1.5" stroke-dasharray="3 8" opacity=".4"/>`;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 560" role="img" aria-label="${{tower:'城市结构与风场',water:'波面与浮标',control:'目标与反馈轨迹',chip:'电子封装分层'}[kind]||'结构'}原创示意插画"><rect width="900" height="560" fill="${art}"/>${body}<path d="M36 36h24M36 36v24M864 524h-24M864 524v-24" stroke="${line}" stroke-width="1.5" opacity=".5"/></svg>`;
}
