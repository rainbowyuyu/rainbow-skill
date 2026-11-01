import {candidate,clamp,mix,smooth,text,line,TAU} from './common.js';
import {ROTARY_DEFAULTS,sampleRotaryState,sampleHousing,sampleRotorBoundary} from './rotary-geometry.js';

/** Original ideal Wankel teaching assembly. Opaque Canvas polygons, not ray tracing or production CAD. */
export const DURATION=18;
export const STAGE_TIMES=Object.freeze([0,2,5,10,14,16]);
export const APEX_COLORS=Object.freeze(['#c66c43','#287d84','#8a6795']);
export const ROTARY_SCENE=Object.freeze({id:'ideal-rotary-assembly',units:'normalized R=1',housingDepth:.62,rotorDepth:.32,coverThickness:.095,geometry:'ideal epitrochoid housing and straight-sided triangular rotor'});
const finite=(x,fallback)=>Number.isFinite(x)?x:fallback;
const cap=t=>clamp(finite(t,0),0,DURATION);
const ease=(t,a,b)=>smooth((t-a)/(b-a));
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
const material={housing:[100,122,128],wall:[31,67,73],cut:[185,199,195],cover:[181,190,187],rotor:[189,122,78],rotorEdge:[112,67,43],steel:[100,119,124],ink:[35,57,61],copper:[194,126,78],bolt:[75,94,99]};
const stages={
  section:['先认出完整装配','前盖沿轴退出，再移向侧边','壳体内壁、转子与偏心轴同时可见','三个顶点始终属于同一副转子','前盖沿原路径返回','回到完整装配，角相位连续'],
  explode:['同一副转子机构','先移开前盖，露出内部','后盖、壳体与转子沿装配轴分离','对照虚线轮廓，辨认每个装配位置','各实体沿原轴线归位','前盖合上，完整周期结束']
};
export function resolveRotaryOptions(options={}){
  return {viewYaw:clamp(finite(options.viewYaw,.46),-.65,.65),viewPitch:clamp(finite(options.viewPitch,.46),.2,.8),labels:options.labels!==false,
    motionTime:Number.isFinite(options.motionTime)?options.motionTime:null,shaftAngle:Number.isFinite(options.shaftAngle)?options.shaftAngle:null,
    cut:Number.isFinite(options.cut)?clamp(options.cut):null,explode:Number.isFinite(options.explode)?clamp(options.explode):null};
}
/** Orthonormal camera basis; positive depth is toward the viewer. No perspective resizing. */
export function rotaryCameraBasis(yaw,pitch){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);return{right:[cy,0,sy],up:[sy*sp,cp,-cy*sp],view:[-sy*cp,sp,cy*cp]};}
function part(id,label,restPosition,travel,extra={}){return{id,label,restPosition,travel,position:add(restPosition,travel),...extra};}
export function sampleRotaryInteraction(rawTime,variant='section',options={}){
  if(!(variant in stages))variant='section';
  const time=cap(rawTime),o=resolveRotaryOptions(options),motionTime=o.motionTime??time;
  const shaftAngle=o.shaftAngle??finite(motionTime*(TAU/6),0),kinematic=sampleRotaryState(shaftAngle,ROTARY_DEFAULTS);
  const open=ease(time,1.2,4.5)*(1-ease(time,14.2,17.6));
  const separated=variant==='explode'?ease(time,4.2,7.8)*(1-ease(time,12.5,15.5)):0;
  const cut=o.cut??open,explode=o.explode??separated;
  // A complete rigid cover is withdrawn first, then parked sideways. Nothing is alpha-erased.
  const coverAxial=.82*ease(cut,0,.38),coverSide=3.70*ease(cut,.25,1);
  const parts=[
    part('rear-cover','后端盖',[0,0,-.405],[0,0,-1.75*explode],{thickness:.095}),
    part('housing','壳体 · 连续内壁',[0,0,0],[0,0,-.52*explode],{thickness:.62}),
    part('rotor','三角转子',[kinematic.center.x,kinematic.center.y,0],[0,0,.73*explode],{angle:kinematic.rotorAngle,thickness:.32}),
    part('eccentric-shaft','偏心轴',[0,0,0],[0,0,0],{angle:shaftAngle,thickness:1.30+1.70*explode}),
    part('front-cover','前端盖',[0,0,.405],[coverSide,0,coverAxial+1.65*explode],{thickness:.095})
  ];
  const stageIndex=Math.max(0,STAGE_TIMES.findLastIndex(t=>time>=t));
  const camera={type:'orthographic',yaw:o.viewYaw,pitch:o.viewPitch,...rotaryCameraBasis(o.viewYaw,o.viewPitch),principalPoint:[800,470],scale:215};
  let annotation=stages[variant][stageIndex];
  if(o.cut!==null||o.explode!==null){
    const coverState=cut<=.001?(explode<=.001?'前盖闭合':'前盖保持轴向排列'):cut>=.999?'前盖已移至侧边':cut<=.25?'前盖沿轴退出':'前盖向侧边移开';
    annotation=`${coverState} · 观察开口 ${Math.round(cut*100)}% · 轴向拆解 ${Math.round(explode*100)}%`;
  }
  return{time,motionTime,variant,stageIndex,annotation,shaftAngle:kinematic.shaftAngle,rotorAngle:kinematic.rotorAngle,center:kinematic.center,apices:kinematic.apices,
    shaftTurns:shaftAngle/TAU,rotorTurns:kinematic.rotorAngle/TAU,cut,explode,camera,parts,labels:o.labels,
    stage:stages[variant][stageIndex],sceneId:ROTARY_SCENE.id,geometry:ROTARY_SCENE.geometry,parameters:{...ROTARY_DEFAULTS},
    drive:{defaultShaftDemoRpm:10,defaultRotorDemoRpm:10/3,speedRatio:3,kind:'slowed kinematic demonstration',speedKnownFromSample:o.shaftAngle===null&&o.motionTime===null,instantaneousRpm:null},
    rendering:'opaque depth-sorted orthographic Canvas polygon shading',physicalPathTracing:false,productionGeometry:false,
    openingMethod:'Rigid front cover withdrawn along z, then parked laterally; no transparent mask or arbitrary CSG',
    motionSource:o.shaftAngle!==null?'shaftAngle':o.motionTime!==null?'motionTime':'timeline'};
}

const circleLoop=(r,n=64,center=[0,0])=>Array.from({length:n},(_,i)=>{const a=i/n*TAU;return[center[0]+Math.cos(a)*r,center[1]+Math.sin(a)*r];});
const translateLoop=(loop,p,z)=>loop.map(v=>[v[0]+p[0],v[1]+p[1],z+p[2]]);
function face(id,vertices,color,extra={}){return{id,vertices,color,normal:norm(cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0]))),...extra};}
function annulus(faces,id,outer,inner,position,depth,colors){
  const front=translateLoop(outer,position,depth/2),back=translateLoop(outer,position,-depth/2),insideFront=translateLoop(inner,position,depth/2),insideBack=translateLoop(inner,position,-depth/2);
  // Export framing traverses exactly the same primitive vertices without allocating faces or normals.
  if(faces.points){faces.points.push(...front,...back,...insideFront,...insideBack);return;}
  for(let i=0;i<outer.length;i++){const j=(i+1)%outer.length;
    faces.push(face(`${id}/front-${i}`,[front[i],front[j],insideFront[j],insideFront[i]],colors.front,{partId:id,surface:'section'}),
      face(`${id}/back-${i}`,[back[j],back[i],insideBack[i],insideBack[j]],colors.back||colors.front,{partId:id,surface:'section'}),
      face(`${id}/outer-${i}`,[back[i],back[j],front[j],front[i]],colors.outer,{partId:id,surface:'outer-wall'}),
      face(`${id}/inner-${i}`,[insideFront[i],insideFront[j],insideBack[j],insideBack[i]],colors.inner,{partId:id,surface:'inner-wall'}));
  }
}
function solid(faces,id,loop,position,depth,colors,center=[0,0]){
  const front=translateLoop(loop,position,depth/2),back=translateLoop(loop,position,-depth/2),fc=add(position,[...center,depth/2]),bc=add(position,[...center,-depth/2]);
  if(faces.points){faces.points.push(...front,...back,fc,bc);return;}
  for(let i=0;i<loop.length;i++){const j=(i+1)%loop.length;
    faces.push(face(`${id}/front-${i}`,[fc,front[i],front[j]],colors.front,{partId:id}),face(`${id}/back-${i}`,[bc,back[j],back[i]],colors.front,{partId:id}),
      face(`${id}/side-${i}`,[back[i],back[j],front[j],front[i]],colors.outer,{partId:id}));}
}
const outline=sampleHousing(ROTARY_DEFAULTS,96).map(p=>[p.x,p.y]);
const outer=outline.map(([x,y])=>{const r=Math.hypot(x,y);return[x*(1+.19/r),y*(1+.19/r)];});
const mid=outline.map(([x,y])=>{const r=Math.hypot(x,y);return[x*(1+.095/r),y*(1+.095/r)];});
function coverMesh(faces,p){
  annulus(faces,p.id,outer,circleLoop(.15,96),p.position,p.thickness,{front:material.cover,back:material.housing,outer:material.housing,inner:material.ink});
  const z=p.position[2]+p.thickness/2+.009;
  // Machined lip, hub and seated screw heads are actual small opaque solids.
  annulus(faces,`${p.id}/lip`,outer,outer.map(([x,y])=>[x*.982,y*.982]),[p.position[0],p.position[1],z],.018,{front:material.cut,outer:material.steel,inner:material.steel});
  annulus(faces,`${p.id}/bearing`,circleLoop(.25,48),circleLoop(.112,48),[p.position[0],p.position[1],z+.025],.065,{front:material.steel,outer:material.ink,inner:material.ink});
  for(const index of [4,15,30,43,53,65,78,89]){const [x,y]=mid[index];solid(faces,`${p.id}/bolt-${index}`,circleLoop(.034,12),[x+p.position[0],y+p.position[1],z+.012],.024,{front:material.bolt,outer:material.ink});}
}
/** Every cross-section is a real annular face with finite wall thickness. All parts remain opaque. */
function buildRotaryGeometry(state,verticesOnly=false){
  const faces=verticesOnly?{points:[]}:[],markers=[],byId=Object.fromEntries(state.parts.map(p=>[p.id,p]));
  const housing=byId.housing;
  annulus(faces,'housing',outer,outline,housing.position,housing.thickness,{front:material.cut,back:material.housing,outer:material.housing,inner:material.wall});
  for(const z of [-.23,-.115,0,.115,.23]){
    const ribOuter=outer.map(([x,y])=>{const r=Math.hypot(x,y);return[x*(1+.028/r),y*(1+.028/r)];});
    annulus(faces,`housing/rib-${z}`,ribOuter,outer,add(housing.position,[0,0,z]),.025,{front:material.steel,outer:material.housing,inner:material.housing});
  }
  coverMesh(faces,byId['rear-cover']);coverMesh(faces,byId['front-cover']);
  const rotor=byId.rotor,rotorZ=rotor.position[2],boundary=sampleRotorBoundary(state.shaftAngle,ROTARY_DEFAULTS,24).map(p=>[p.x,p.y]);
  const rotorLoop=boundary.map(([x,y])=>[x-state.center.x,y-state.center.y]);
  const rotorBore=rotorLoop.map(([x,y])=>{const r=Math.hypot(x,y);return[x*.24/r,y*.24/r];});
  annulus(faces,'rotor',rotorLoop,rotorBore,rotor.position,rotor.thickness,{front:material.rotor,back:material.rotor,outer:material.rotorEdge,inner:material.ink});
  annulus(faces,'rotor/bearing',circleLoop(.255,48),circleLoop(.18,48),add(rotor.position,[0,0,.164]),.018,{front:material.steel,outer:material.steel,inner:material.ink});
  // One eccentric journal follows the same center as the rotor; the output axis stays fixed.
  const shaft=byId['eccentric-shaft'];
  solid(faces,'eccentric-shaft',circleLoop(.105,40),[0,0,0],shaft.thickness,{front:material.steel,outer:material.steel});
  solid(faces,'eccentric-journal',circleLoop(.173,48),[state.center.x,state.center.y,.21+rotorZ],.20,{front:material.steel,outer:material.ink});
  const hubA=[0,0],hubB=[state.center.x,state.center.y],a=state.shaftAngle,n=[-Math.sin(a)*.11,Math.cos(a)*.11];
  const crank=[add(hubA,n),add(hubB,n),sub(hubB,n),sub(hubA,n)].reverse();
  solid(faces,'eccentric-web',crank,[0,0,.285+rotorZ],.085,{front:material.copper,outer:material.rotorEdge},[state.center.x/2,state.center.y/2]);
  if(verticesOnly)return faces.points;
  state.apices.forEach((p,i)=>{
    // Markers sit just inside each fixed apex, on the rotor face; painter ordering occludes them naturally.
    const position=[mix(p.x,state.center.x,.065),mix(p.y,state.center.y,.065),rotorZ+.170];
    markers.push({id:`apex-${i}`,position,color:APEX_COLORS[i],label:String.fromCharCode(65+i)});
  });
  return{faces,markers,landmarks:{housing:add(housing.position,[-1.21,.45,.31]),rotor:[state.center.x-.30,state.center.y-.26,rotorZ+.18],shaft:[state.center.x,state.center.y,.34+rotorZ],frontCover:add(byId['front-cover'].position,[.65,.65,.055]),rearCover:add(byId['rear-cover'].position,[-.65,.58,.055])}};
}
export function buildRotaryScene(state){return buildRotaryGeometry(state);}
export function makeRotaryProjector(camera,{scale=camera.scale??215,origin=camera.principalPoint??[800,470],target=camera.target??[0,0,0]}={}){
  const b=rotaryCameraBasis(camera.yaw,camera.pitch);return point=>{const p=sub(point,target);return{x:origin[0]+dot(p,b.right)*scale,y:origin[1]-dot(p,b.up)*scale,depth:dot(p,b.view),scale};};
}
export function frameRotaryScene(state,scene){
  const project=makeRotaryProjector(state.camera,{scale:1,origin:[0,0],target:[0,0,0]}),points=scene.faces.flatMap(f=>f.vertices.map(project));
  const xmin=Math.min(...points.map(p=>p.x)),xmax=Math.max(...points.map(p=>p.x)),ymin=Math.min(...points.map(p=>p.y)),ymax=Math.max(...points.map(p=>p.y));
  return cameraFromBounds(state,xmin,xmax,ymin,ymax);
}
function cameraFromBounds(state,xmin,xmax,ymin,ymax){
  const scale=Math.min(255,1330/Math.max(xmax-xmin,.01),535/Math.max(ymax-ymin,.01));
  return{...state.camera,scale,principalPoint:[800-(xmin+xmax)*scale/2,464-(ymin+ymax)*scale/2],projectedBounds:[800-(xmax-xmin)*scale/2,464-(ymax-ymin)*scale/2,800+(xmax-xmin)*scale/2,464+(ymax-ymin)*scale/2]};
}
/** Exact export framing from shared primitive vertices; no full mesh, normals, or time-dependent cache. */
export function frameRotaryState(state){
  const project=makeRotaryProjector(state.camera,{scale:1,origin:[0,0],target:[0,0,0]});
  let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
  for(const point of buildRotaryGeometry(state,true)){const p=project(point);xmin=Math.min(xmin,p.x);xmax=Math.max(xmax,p.x);ymin=Math.min(ymin,p.y);ymax=Math.max(ymax,p.y);}
  return cameraFromBounds(state,xmin,xmax,ymin,ymax);
}
function polygon(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
function faceColor(f,view){const light=norm([-.6,1.5,2.8]),diffuse=Math.max(0,dot(f.normal,light)),spec=Math.max(0,dot(f.normal,norm(add(light,view))))**35,brightness=.58+.43*diffuse+.25*spec;return`rgb(${f.color.map(v=>Math.round(clamp(v*brightness,0,255))).join(',')})`;}
/** Sort actual faces globally; no fixed 2D layer order when yaw/pitch changes. */
export function visibleRotaryFaces(scene,camera){const project=makeRotaryProjector(camera),view=rotaryCameraBasis(camera.yaw,camera.pitch).view;
  return scene.faces.filter(f=>dot(f.normal,view)>1e-8).map(f=>({...f,points:f.vertices.map(project),depth:f.vertices.reduce((s,p)=>s+dot(p,view),0)/f.vertices.length})).sort((a,b)=>a.depth-b.depth||a.id.localeCompare(b.id));
}
function background(ctx){const g=ctx.createLinearGradient(0,0,1400,900);g.addColorStop(0,'#f0ede4');g.addColorStop(.6,'#dddcd2');g.addColorStop(1,'#c8d0ca');ctx.fillStyle=g;ctx.fillRect(0,0,1600,900);
  const glow=ctx.createRadialGradient(1050,310,10,1050,310,900);glow.addColorStop(0,'#fffdf388');glow.addColorStop(1,'#fffdf300');ctx.fillStyle=glow;ctx.fillRect(0,0,1600,900);
}
function ghostOutline(ctx,project,loop,z,color){const p=loop.map(([x,y])=>project([x,y,z]));ctx.save();ctx.setLineDash([5,8]);ctx.strokeStyle=color;ctx.lineWidth=1.2;polygon(ctx,p);ctx.stroke();ctx.restore();}
function drawGuides(ctx,s,project){
  const a=project([0,0,-2.8]),b=project([0,0,3.6]);line(ctx,[a.x,a.y],[b.x,b.y],'#4d6f6a55',1.2,[9,10]);
  if(s.explode>.04){ghostOutline(ctx,project,outer,-.405,'#4b69604a');ghostOutline(ctx,project,outline,.31,'#4b69604a');}
  if(s.cut>.02){const start=project([0,0,.405]),axial=project([0,0,.405+.82+1.65*s.explode]),park=project(s.parts.find(p=>p.id==='front-cover').position);line(ctx,[start.x,start.y],[axial.x,axial.y],'#4265653d',1.3,[5,8]);line(ctx,[axial.x,axial.y],[park.x,park.y],'#4265653d',1.3,[5,8]);}
}
function renderScene(ctx,s,scene,camera){const view=rotaryCameraBasis(camera.yaw,camera.pitch).view,project=makeRotaryProjector(camera);
  const entries=visibleRotaryFaces(scene,camera);
  for(const marker of scene.markers)entries.push({...marker,marker:true,depth:dot(marker.position,view)});
  entries.sort((a,b)=>a.depth-b.depth||a.id.localeCompare(b.id));
  for(const f of entries){
    if(f.marker){const p=project(f.position);ctx.beginPath();ctx.arc(p.x,p.y,8.8,0,TAU);ctx.fillStyle=f.color;ctx.fill();ctx.strokeStyle='#f7eedb';ctx.lineWidth=1.5;ctx.stroke();text(ctx,f.label,p.x,p.y+.3,10.5,'#fff8e8',750,'center');continue;}
    const color=faceColor(f,view);polygon(ctx,f.points);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=color;ctx.lineJoin='round';ctx.lineWidth=.65;ctx.stroke();
  }
}
function callout(ctx,label,p,x,y,color='#325651',align='left'){
  const endx=x+(align==='right'?-4:4),elbow=[endx,y+16];line(ctx,[p.x,p.y],elbow,color+'80',1.2);line(ctx,elbow,[endx+(align==='right'?-22:22),y+16],color+'80',1.2);
  ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,TAU);ctx.fillStyle=color;ctx.fill();text(ctx,label,x,y,20,color,600,align);
}
function annotations(ctx,s,scene,camera){const project=makeRotaryProjector(camera);
  // Labels use local anchors and separate edge lanes; leaders never span across the entire assembly.
  if(s.cut>.60){
    const housingMinX=Math.min(...scene.faces.filter(f=>f.partId==='housing').flatMap(f=>f.vertices.map(v=>project(v).x)));
    const p=project(scene.landmarks.housing);callout(ctx,'壳体内壁',p,clamp(housingMinX-18,105,1400),clamp(p.y-48,180,660),'#325651','right');
    const r=project(scene.landmarks.rotor);callout(ctx,'转子',r,clamp(r.x-80,100,1400),clamp(r.y+92,230,742));
    const c=project(scene.landmarks.frontCover);callout(ctx,'移开的前端盖',c,clamp(c.x+30,200,1500),clamp(c.y-100,180,660),'#46615c','right');
  }else{const c=project(scene.landmarks.frontCover);callout(ctx,'前端盖',c,clamp(c.x+48,200,1500),clamp(c.y-78,185,660),'#46615c','right');}
  if(s.explode>.55){const r=project(scene.landmarks.rearCover);callout(ctx,'后端盖',r,clamp(r.x-24,100,1400),clamp(r.y-75,180,660));}
}
export function drawRotaryInteraction(ctx,time,width,height,options={},state,variant='section'){
  const s=state||sampleRotaryInteraction(time,variant,options),scene=buildRotaryScene(s),camera=frameRotaryScene(s,scene),project=makeRotaryProjector(camera);
  ctx.save();ctx.setTransform(width/1600,0,0,height/900,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.clearRect(0,0,1600,900);background(ctx);
  // Soft editorial contact wash; this is not a simulated light-transport shadow.
  const shadow=ctx.createRadialGradient(800,700,20,800,700,520);shadow.addColorStop(0,'#3d5b5730');shadow.addColorStop(.65,'#3d5b570a');shadow.addColorStop(1,'#3d5b5700');ctx.save();ctx.translate(0,550);ctx.scale(1,.22);ctx.fillStyle=shadow;ctx.fillRect(100,-450,1400,1400);ctx.restore();
  drawGuides(ctx,s,project);renderScene(ctx,s,scene,camera);
  if(s.labels)annotations(ctx,s,scene,camera);
  text(ctx,s.variant==='section'?'移开前盖，看清转子':'沿装配轴，拆开同一副机构',78,66,42,'#233f3e',750);
  text(ctx,s.annotation,80,114,23,'#4b6560',500);line(ctx,[80,146],[1520,146],'#556f6426',1);
  text(ctx,'理想 Wankel 机构',1520,67,21,'#4b6560',600,'right');
  const deg=a=>((a/TAU)%1+1)%1*360;
  text(ctx,`轴角 ${deg(s.shaftAngle).toFixed(1)}°`,80,798,27,'#244641',650);
  text(ctx,`转子角 ${deg(s.rotorAngle).toFixed(1)}°`,350,798,27,'#244641',650);
  text(ctx,'轴 : 转子 = 3 : 1',800,798,27,'#244641',650,'center');
  for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(1254+i*80,797,5,0,TAU);ctx.fillStyle=APEX_COLORS[i];ctx.fill();text(ctx,String.fromCharCode(65+i),1270+i*80,798,22,'#45645d',650);}
  text(ctx,s.motionSource==='timeline'?'默认演示速度 · 18 s = 轴 3 圈 / 转子 1 圈':'手动运动相位 · 轴角与转子角来自同一状态',80,849,19,'#526a63',450);
  text(ctx,'理想教学几何 · 非 13B 生产模型 · Canvas 着色，非光追',1520,849,18,'#526a63',450,'right');ctx.restore();return s;
}
const metadata=[
  {id:'mechanics-rotary-section',variant:'section',title:'移开前盖，观察同一副转子',description:'完整前端盖先沿轴退出，再移到侧边；固定壳体内的三角转子和偏心轴保持连续角相位。',stages:['完整装配','移开前盖','内部运动','追踪同一顶点','沿原路径回装','完整周期'],previewTime:8,recipe:['所有顶点来自同一理想运动学状态。','完整前盖先退出、再移向侧边；观察开口是实体拆离。','内外壁、端面与转子按正投影深度排序。']},
  {id:'mechanics-rotary-explode',variant:'explode',title:'转子机构沿轴拆解与回装',description:'后端盖、壳体、转子和前端盖按装配轴分离；保留固定输出轴、原位虚线与连续的三比一转速关系。',stages:['完整装配','前盖让路','轴向拆解','接口停留','沿轴归位','前盖闭合'],previewTime:9,recipe:['先让完整前盖退出。','各件位移只由拆解参数决定，运动角相位保持独立。','保留原位轮廓，沿原路径连续回装。']}
];
export const candidates=metadata.map(meta=>candidate({...meta,module:'mechanics',duration:DURATION,loop:false,stageTimes:[...STAGE_TIMES],referenceIds:['rotary-cutaway'],codeFile:'modules/rotary-interaction.js',controls:{intensity:false,palette:false},
  parameters:{viewYaw:{min:-.65,max:.65,default:.46},viewPitch:{min:.2,max:.8,default:.46},cut:{min:0,max:1,default:null},explode:{min:0,max:1,default:null},labels:{default:true},motionTime:{default:null},shaftAngle:{default:null}},
  usage:'用于解释理想转子机构的运动、观察开口和轴向装配；不用于生产尺寸、燃烧性能或功率推断。'
},(t,o)=>sampleRotaryInteraction(t,meta.variant,o),(ctx,t,w,h,o,s)=>drawRotaryInteraction(ctx,t,w,h,o,s,meta.variant)));
