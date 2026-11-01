import {candidate,clamp,mix,smooth,text,line,TAU} from './common.js';
import {sampleSwitchMechanism} from './switch-mechanism.js';

/** Original single-switch teaching figure. Physical state and presentation transforms are separate. */
export const DURATION=18;
export const STAGE_TIMES=Object.freeze([0,2,5,8,12,15]);
const cap=t=>clamp(Number.isFinite(t)?t:0,0,DURATION),finite=(v,f)=>Number.isFinite(v)?v:f;
const ease=(t,a,b)=>smooth((t-a)/(b-a));
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
const xyz=p=>Array.isArray(p)?p:[p.x,p.y,p.z];
const M={base:[74,91,94],housing:[190,196,188],edge:[129,147,142],key:[230,228,212],stem:[49,99,102],metal:[167,183,184],copper:[185,120,72],contact:[226,178,101],dark:[55,72,72],seat:[147,163,153]};
const words={section:['先认出一枚完整按键','外壳移开，里面仍是同一机构','键轴下降，弹簧连续压缩','走近这两片金属，观察间隙','松开，弹簧把键轴推回','退回整体，保留结构关系'],explode:['完整装配作为原位参照','先让外壳让开','沿装配轴分离，每件都有归处','看清弹簧、键轴和触片的对应','先回装，再观察同一动作','释放按键，回到原位']};
export function resolveSwitchOptions(o={}){return{press:Number.isFinite(o.press)?clamp(o.press):null,cut:Number.isFinite(o.cut)?clamp(o.cut):null,explode:Number.isFinite(o.explode)?clamp(o.explode):null,focus:Number.isFinite(o.focus)?clamp(o.focus):null,viewYaw:clamp(finite(o.viewYaw,-.52),-.75,-.12),viewPitch:clamp(finite(o.viewPitch,.42),.25,.60),labels:o.labels!==false};}
export function switchCameraBasis(yaw,pitch){const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);return{right:[c,0,-s],up:[-s*sp,cp,-c*sp],view:[s*cp,sp,c*cp]};}
export function makeSwitchProjector(camera){const b=switchCameraBasis(camera.yaw,camera.pitch);return point=>{const p=sub(xyz(point),camera.target),scale=camera.scale;return{x:camera.principalPoint[0]+dot(p,b.right)*scale,y:camera.principalPoint[1]-dot(p,b.up)*scale,depth:dot(p,b.view),scale};};}
function presentationParts(m,cut,explode){
  const axis={base:0,housing:8,stem:14,keycap:22,spring:6,'moving-contact':2.5,'fixed-contact':2.5};
  return m.parts.map(p=>{const operating=xyz(p.operatingPosition),offset=[0,(axis[p.id]||0)*explode,0];return{...p,operatingPosition:operating,displayOffset:offset,position:add(operating,offset)};});
}
export function sampleSwitchAnatomy(rawTime,variant='section',options={}){
  if(!(variant in words))variant='section';const time=cap(rawTime),o=resolveSwitchOptions(options);
  const defaultPress=variant==='section'?ease(time,5.4,9)*(1-ease(time,11.5,14.5)):ease(time,12,14)*(1-ease(time,15,17));
  const press=o.press??defaultPress,cut=o.cut??ease(time,1.5,4.4)*(1-ease(time,16,18));
  const explode=o.explode??(variant==='explode'?ease(time,4.6,7.5)*(1-ease(time,9,12)):0);
  const focus=o.focus??(variant==='section'?ease(time,5.1,7)*(1-ease(time,12,15.2)):ease(time,12,13.6)*(1-ease(time,15,17.5)));
  const mechanism=sampleSwitchMechanism(time,{press,explode:0}),parts=presentationParts(mechanism,cut,explode),stageIndex=Math.max(0,STAGE_TIMES.findLastIndex(t=>time>=t));
  let annotation=words[variant][stageIndex];
  if(o.press!==null||o.cut!==null||o.explode!==null||o.focus!==null)annotation=`${mechanism.contact.closed?'两触点已接触':'两触点之间仍有间隙'} · 开壳 ${Math.round(cut*100)}% · 拆解 ${Math.round(explode*100)}%`;
  const state={time,variant,stageIndex,annotation,press,cut,explode,focus,labels:o.labels,mechanism,parts,
    camera:{type:'orthographic',yaw:o.viewYaw,pitch:o.viewPitch,target:[0,7,0],scale:26,principalPoint:[800,470]},
    sceneId:'original-linear-key-switch',units:'mm, original illustrative design',physicalPathTracing:false,productionGeometry:false,
    operatingAssembly:explode<.001,openingMethod:'Two-piece teaching shell; front/left cover translates outward as one rigid part',
    focusMethod:'Continuous target and orthographic scale toward the actual contact pair; no substituted inset model'};
  state.camera=frameSwitchState(state);return state;
}
function boxCorners(center,size){return[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[center[0]+x*size[0]/2,center[1]+y*size[1]/2,center[2]+z*size[2]/2])));}
export function frameSwitchState(s){
  const b=switchCameraBasis(s.camera.yaw,s.camera.pitch),e=s.explode,c=s.cut;
  // Conservative physical envelopes, fixed to the same world axes and part offsets as the meshes.
  const points=[...boxCorners([0,7+e*10,0],[16,20+e*24,15]),...boxCorners([-18*c,7+8*e,7*c],[12.2,14,10.2])];
  const projected=points.map(p=>[dot(p,b.right),-dot(p,b.up)]),xmin=Math.min(...projected.map(p=>p[0])),xmax=Math.max(...projected.map(p=>p[0])),ymin=Math.min(...projected.map(p=>p[1])),ymax=Math.max(...projected.map(p=>p[1]));
  const overviewScale=Math.min(29,1280/(xmax-xmin),525/(ymax-ymin));
  const cx=(xmin+xmax)/2,cy=(ymin+ymax)/2,overviewTarget=add(b.right.map(v=>v*cx),b.up.map(v=>v*-cy));
  const contact=s.mechanism.contact,contactTarget=[(contact.fixedTip.x+contact.movingTip.x)/2,contact.fixedTip.y+2.5*s.explode,contact.fixedTip.z];
  const u=smooth(s.focus),target=overviewTarget.map((v,i)=>mix(v,contactTarget[i],u)),scale=mix(overviewScale,108,u);
  return{...s.camera,target,scale,principalPoint:[800,mix(468,470,u)],overviewScale,focus:s.focus,stageBounds:[72,158,1528,748],viewDomain:'front-left isometric observation; no unrestricted orbit'};
}
function face(id,vertices,color){return{id,vertices,color,normal:norm(cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0])))};}
function box(faces,id,center,size,color,maxEdge=Infinity){const p=boxCorners(center,size);for(const[i,indices]of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]].entries()){
  const v=indices.map(j=>p[j]),nu=Math.max(1,Math.ceil(Math.hypot(...sub(v[1],v[0]))/maxEdge)),nv=Math.max(1,Math.ceil(Math.hypot(...sub(v[3],v[0]))/maxEdge));
  const point=(u,w)=>v[0].map((x,k)=>x+(v[1][k]-x)*u+(v[3][k]-x)*w);
  for(let u=0;u<nu;u++)for(let w=0;w<nv;w++)faces.push(face(`${id}/${i}-${u}-${w}`,[point(u/nu,w/nv),point((u+1)/nu,w/nv),point((u+1)/nu,(w+1)/nv),point(u/nu,(w+1)/nv)],color));
}}
function prism(faces,id,profile,depth,color){
  const area=profile.reduce((a,p,i)=>{const q=profile[(i+1)%profile.length];return a+p[0]*q[1]-q[0]*p[1];},0),loop=area<0?[...profile].reverse():profile;
  const front=loop.map(p=>add(p,[0,0,depth/2])),back=loop.map(p=>add(p,[0,0,-depth/2]));
  faces.push(face(id+'/front',front,color),face(id+'/back',[...back].reverse(),color));
  for(let i=0;i<loop.length;i++){const j=(i+1)%loop.length;faces.push(face(`${id}/side-${i}`,[back[i],back[j],front[j],front[i]],color));}
}
function cylinder(faces,id,a,b,r,color,n=16){
  const axis=norm(sub(b,a)),helper=Math.abs(axis[1])>.95?[1,0,0]:[0,1,0],u=norm(cross(axis,helper)),v=cross(axis,u);
  const ring=center=>Array.from({length:n},(_,i)=>add(center,add(u.map(x=>x*r*Math.cos(i/n*TAU)),v.map(x=>x*r*Math.sin(i/n*TAU))))),pa=ring(a),pb=ring(b);
  for(let i=0;i<n;i++){const j=(i+1)%n;faces.push(face(`${id}/side-${i}`,[pa[i],pa[j],pb[j],pb[i]],color),face(`${id}/a-${i}`,[a,pa[j],pa[i]],color),face(`${id}/b-${i}`,[b,pb[i],pb[j]],color));}
}
function tube(faces,id,points,r,color,n=6){
  const rings=points.map((p,i)=>{const axis=norm(sub(points[Math.min(points.length-1,i+1)],points[Math.max(0,i-1)])),helper=Math.abs(axis[1])>.95?[1,0,0]:[0,1,0],u=norm(cross(axis,helper)),v=cross(axis,u);return Array.from({length:n},(_,j)=>add(p,add(u.map(x=>x*r*Math.cos(j/n*TAU)),v.map(x=>x*r*Math.sin(j/n*TAU)))));});
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++)faces.push(face(`${id}/${i}-${j}`,[rings[i][j],rings[i][(j+1)%n],rings[i+1][(j+1)%n],rings[i+1][j]],color));
  faces.push(face(id+'/start',[...rings[0]].reverse(),color),face(id+'/end',rings.at(-1),color));
}
function sphere(faces,id,center,r,color){const n=32,m=16,point=(i,j)=>{const a=i/n*TAU,t=-Math.PI/2+j/m*Math.PI;return add(center,[r*Math.sin(t),r*Math.cos(t)*Math.cos(a),r*Math.cos(t)*Math.sin(a)]);};for(let i=0;i<n;i++)for(let j=0;j<m;j++){const p=[point(i,j),point(i+1,j),point(i+1,j+1),point(i,j+1)];if(j===0)p.splice(0,1);if(j===m-1)p.splice(2,1);const f=face(`${id}/${i}-${j}`,p,color);if(dot(f.normal,sub(p[0],center))<0){p.reverse();faces.push(face(f.id,p,color));}else faces.push(f);}}
function ribbon(faces,id,points,width,thickness,color){
  const rings=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=norm(sub(b,a)),n=[-d[1]*thickness/2,d[0]*thickness/2,0];return[add(p,add(n,[0,0,width/2])),add(p,add(n,[0,0,-width/2])),add(p,sub([0,0,-width/2],n)),add(p,sub([0,0,width/2],n))];});
  for(let i=0;i<rings.length-1;i++)for(let k=0;k<4;k++)faces.push(face(`${id}/${i}-${k}`,[rings[i][k],rings[i+1][k],rings[i+1][(k+1)%4],rings[i][(k+1)%4]],color));
}
export function buildSwitchScene(s){
  const faces=[],m=s.mechanism,e=s.explode,c=s.cut,offsets=Object.fromEntries(s.parts.map(p=>[p.id,p.displayOffset])),pby=Object.fromEntries(s.parts.map(p=>[p.id,p]));
  const shift=(point,id)=>add(xyz(point),offsets[id]||[0,0,0]);
  box(faces,'base-plate',[0,-.6,0],[12,1.2,10],M.base);
  box(faces,'base-recess',[0,.10,0],[10.6,.20,8.6],M.seat);
  for(const x of [-4.8,4.8])for(const z of [-3.8,3.8]){
    box(faces,`foot-${x}-${z}`,[x,-1.55,z],[1.9,.7,1.9],M.dark);
    cylinder(faces,`base-screw-${x}-${z}`,[x,.2,z],[x,.34,z],.24,M.metal,12);
    box(faces,`screw-slot-${x}-${z}`,[x,.35,z],[.32,.015,.05],M.dark);
  }
  const h=[0,8*e,0],cover=[-18*c,8*e,7*c];
  // Remaining rear/right walls, and a rigid L cover removed outward from both occupied sides.
  for(const [id,p,size]of [['rear',[0,6.8,-4.65],[12,13.6,.7]],['right',[5.65,6.8,0],[.7,13.6,8.6]]])box(faces,'shell-'+id,add(p,h),size,M.housing,1.2);
  for(const [id,p,size]of [['front',[0,6.8,4.65],[12,13.6,.7]],['left',[-5.65,6.8,0],[.7,13.6,8.6]]])box(faces,'cover-'+id,add(p,cover),size,M.housing,1.2);
  // Ribs terminate on the shell's top/bottom edges, and travel with their own half shell.
  for(const x of [-4.2,-2.1,0,2.1,4.2]){box(faces,`rear-rib-${x}`,add([x,6.8,-4.15],h),[.20,12.8,.30],M.edge);box(faces,`front-rib-${x}`,add([x,6.8,4.15],cover),[.20,12.8,.30],M.edge);}
  for(const x of [-4.9,4.9])for(const z of [-3.7,3.7]){
    const parent=z>0?cover:h;cylinder(faces,`housing-boss-${x}-${z}`,add([x,12.6,z],parent),add([x,13.6,z],parent),.50,M.edge,16);cylinder(faces,`housing-fastener-${x}-${z}`,add([x,13.6,z],parent),add([x,13.76,z],parent),.25,M.metal,12);
  }
  const stemPos=pby.stem.position,keyPos=pby.keycap.position;
  box(faces,'stem',stemPos,[2.8,3.6,2.8],M.stem);box(faces,'stem-guide-l',add(stemPos,[-1.6,0,0]),[.4,3.6,1.4],M.edge);box(faces,'stem-guide-r',add(stemPos,[1.6,0,0]),[.4,3.6,1.4],M.edge);
  box(faces,'keycap-skirt',add(keyPos,[0,-.5,0]),[15,1.4,14],M.key);box(faces,'keycap-top',add(keyPos,[0,.5,0]),[14.2,1,13.2],M.key);
  box(faces,'keycap-inset',add(keyPos,[0,1.015,0]),[11.9,.03,10.9],[210,215,201]);
  for(const x of [-5.7,5.7])box(faces,`keycap-edge-${x}`,add(keyPos,[x,1.04,0]),[.12,.025,10.9],M.edge);
  const springPoints=m.spring.points.map(p=>shift(p,'spring'));
  tube(faces,'spring-wire',springPoints,m.spring.wireDiameterMm/2,M.metal,8);
  const sb=shift(m.spring.bottom,'spring'),st=shift(m.spring.top,'spring');
  cylinder(faces,'spring-bottom-seat',add(sb,[0,-.25,0]),sb,1.85,M.edge,24);cylinder(faces,'spring-top-seat',st,add(st,[0,.25,0]),1.85,M.edge,24);
  const contact=m.contact,fp=contact.fixedLeafPoints.map(p=>shift(p,'fixed-contact')),mp=contact.movingLeafPoints.map(p=>shift(p,'moving-contact'));
  ribbon(faces,'fixed-leaf',fp,.70,contact.leafThicknessMm,M.copper);ribbon(faces,'moving-leaf',mp,.70,contact.leafThicknessMm,M.copper);
  const fixedCenter=shift(contact.fixedPadCenter,'fixed-contact'),movingCenter=shift(contact.movingPadCenter,'moving-contact');
  sphere(faces,'fixed-pad',fixedCenter,contact.padRadiusMm??.3,M.contact);sphere(faces,'moving-pad',movingCenter,contact.padRadiusMm??.3,M.contact);
  for(const [id,root]of [['fixed-contact',contact.fixedRoot],['moving-contact',contact.movingRoot]]){
    const p=shift(root,id);box(faces,id+'-mount',add(p,[0,-.38,0]),[.7,.76,1.5],M.dark);box(faces,id+'-terminal',add(p,[0,-1.15,0]),[.32,.9,.8],M.copper);cylinder(faces,id+'-rivet',add(p,[0,.04,-.5]),add(p,[0,.04,.5]),.17,M.metal,12);
  }
  const actuator=m.actuator;
  prism(faces,'stem-cam',actuator.camProfile.map(p=>shift(p,'stem')),actuator.camDepthMm,M.stem);
  const support=actuator.supportPoints.map(p=>shift(p,'stem'));for(let i=0;i<support.length-1;i++)cylinder(faces,`stem-cam-support-${i}`,support[i],support[i+1],.13,M.stem,8);
  prism(faces,'contact-follower',actuator.followerProfile.map(p=>shift(p,'moving-contact')),.8,M.edge);
  const from=shift(actuator.compliance.from,'moving-contact'),to=shift(actuator.compliance.to,'moving-contact'),compliancePoints=Array.from({length:49},(_,i)=>{const u=i/48,a=u*TAU*4,r=i===0||i===48?0:.095;return[mix(from[0],to[0],u),from[1]+Math.cos(a)*r,from[2]+Math.sin(a)*r];});
  tube(faces,'contact-compliance',compliancePoints,.027,M.copper,6);
  return{faces,landmarks:{key:keyPos,spring:shift(m.spring.points[Math.floor(m.spring.points.length*.55)],'spring'),fixedTip:shift(contact.fixedTip,'fixed-contact'),movingTip:shift(contact.movingTip,'moving-contact'),contactCenter:fixedCenter,cam:shift(actuator.camContactPoint,'stem')},partCount:s.parts.length,meshGroupCount:new Set(faces.map(f=>f.id.split('/')[0])).size,shading:'opaque four-tone solids; continuous normal shading on contact pads'};
}
export function visibleSwitchFaces(scene,camera){const project=makeSwitchProjector(camera),view=switchCameraBasis(camera.yaw,camera.pitch).view;return scene.faces.filter(f=>dot(f.normal,view)>1e-7).map(f=>({...f,points:f.vertices.map(project),depth:f.vertices.reduce((a,p)=>a+dot(p,view),0)/f.vertices.length})).sort((a,b)=>a.depth-b.depth||a.id.localeCompare(b.id));}
function polygon(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
function drawScene(ctx,s,scene){const view=switchCameraBasis(s.camera.yaw,s.camera.pitch).view,light=norm([-1,2,2]);for(const f of visibleSwitchFaces(scene,s.camera)){const d=Math.max(0,dot(f.normal,light)),round=f.id.startsWith('fixed-pad/')||f.id.startsWith('moving-pad/'),tone=round?.62+.5*d:d>.8?1.12:d>.42?.98:d>.1?.81:.64,spec=Math.max(0,dot(f.normal,norm(add(light,view))))**40*(round?.28:.12),color=`rgb(${f.color.map(v=>Math.round(clamp(v*(tone+spec),0,255))).join(',')})`;polygon(ctx,f.points);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=.6;ctx.lineJoin='round';ctx.stroke();}}
function contactTrace(ctx,s,scene){if(s.cut<.7||!s.labels)return;const project=makeSwitchProjector(s.camera),a=project(scene.landmarks.fixedTip),b=project(scene.landmarks.movingTip),closed=s.mechanism.contact.closed,col=closed?'#24534c':'#80522f';
  if(s.focus>.35){const x=(a.x+b.x)/2,y=(a.y+b.y)/2,lx=clamp(x+296,940,1200);ctx.save();ctx.globalAlpha*=ease(s.focus,.35,.7);line(ctx,[x,y-6],[lx-6,y-82],col+'aa',1.2);line(ctx,[lx-6,y-82],[lx+240,y-82],col+'aa',1.2);text(ctx,closed?'两接触面相遇':`表面间隙 ${s.mechanism.contact.gapMm.toFixed(2)} mm`,lx,y-105,24,col,650);ctx.restore();}
}
function partLabels(ctx,s,scene){if(!s.labels||s.focus>.3||s.explode<.25)return;const project=makeSwitchProjector(s.camera),pby=Object.fromEntries(s.parts.map(p=>[p.id,p]));ctx.save();ctx.globalAlpha*=ease(s.explode,.25,.65)*(1-ease(s.focus,.1,.3));
  const labels=[['键帽',pby.keycap.position,170,-8],['键轴',pby.stem.position,-175,-7],['回位弹簧',scene.landmarks.spring,182,-8],['金属触片',scene.landmarks.contactCenter,170,20],['底座',[0,-.6,0],-165,25]];
  for(const[label,point,dx,dy]of labels){const p=project(point),x=p.x+dx,y=p.y+dy,sign=Math.sign(dx),ink='#49645c';line(ctx,[p.x,p.y],[x-sign*18,y],ink+'75',1.1);text(ctx,label,x,y-4,23,ink,600,sign>0?'left':'right');}
  ctx.restore();
}
export function drawSwitchAnatomy(ctx,time,width,height,options={},state,variant='section'){
  const s=state||sampleSwitchAnatomy(time,variant,options),scene=buildSwitchScene(s);
  ctx.save();ctx.setTransform(width/1600,0,0,height/900,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.clearRect(0,0,1600,900);
  const bg=ctx.createLinearGradient(0,0,1500,900);bg.addColorStop(0,'#f4f1e8');bg.addColorStop(1,'#dbe0d7');ctx.fillStyle=bg;ctx.fillRect(0,0,1600,900);
  ctx.save();ctx.beginPath();ctx.rect(72,158,1456,590);ctx.clip();drawScene(ctx,s,scene);contactTrace(ctx,s,scene);partLabels(ctx,s,scene);ctx.restore();
  text(ctx,s.variant==='section'?'一次按下，两个触点相遇':'拆开之后，看清每件的归处',78,65,42,'#273f3d',750);text(ctx,s.annotation,80,115,23,'#526a61',500);line(ctx,[80,146],[1520,146],'#60766b2b',1);
  text(ctx,s.focus>.65?'触点局部 · 同一实体':'机械按键 · 原创教学结构',1520,67,21,'#526a61',550,'right');
  const cols=[s.press>.02?'#2f7372':'#738179',s.mechanism.spring.compressionMm>2.02?'#2f7372':'#738179',s.mechanism.contact.closed?'#2f7372':'#9b6948'];
  const labels=[`按压 ${s.mechanism.travelMm.toFixed(2)} mm`,`弹簧长度 ${s.mechanism.spring.lengthMm.toFixed(2)} mm`,s.mechanism.contact.closed?'金属触点闭合':'金属触点断开'];
  [80,590,1110].forEach((x,i)=>{text(ctx,labels[i],x,798,25,cols[i],650);if(i<2)line(ctx,[x+322,798],[x+432,798],'#66817566',2);});
  text(ctx,s.explode>.01?'拆解示意 · 位移保留，拆开时不代表可工作的电路':'动作与间隙来自同一模型 · 弹性参数为原创教学设定',80,849,19,'#607168',450);
  text(ctx,'Canvas 实体着色 · 非生产 CAD / 非有限元',1520,849,18,'#607168',450,'right');ctx.restore();return s;
}
const metadata=[
  {id:'mechanics-switch-section',variant:'section',title:'移开外壳，跟着一次按压看触点',description:'从完整按键连续进入内部与触点局部；键轴位移、弹簧压缩和触点间隙由同一模型决定。',stages:['完整按键','外壳让开','键轴下行','触点局部','释放回弹','回到整体'],previewTime:9.5},
  {id:'mechanics-switch-explode',variant:'explode',title:'拆解与回装，对照每一件的位置',description:'外壳先移开，键帽、键轴、回位弹簧和触点组沿装配轴分离，再沿原关系回装并执行按压。',stages:['装配原位','外壳让开','沿轴拆开','部件对应','回装按压','释放回位'],previewTime:7.8}
];
export const candidates=metadata.map(meta=>candidate({...meta,module:'mechanics',duration:DURATION,loop:false,stageTimes:[...STAGE_TIMES],codeFile:'modules/switch-anatomy.js',referenceIds:['anatomy-mechanics'],controls:{intensity:false,palette:false},parameters:{press:{min:0,max:1,default:null},cut:{min:0,max:1,default:null},explode:{min:0,max:1,default:null},focus:{min:0,max:1,default:null},viewYaw:{min:-.75,max:-.12,default:-.52},viewPitch:{min:.25,max:.60,default:.42},labels:{default:true}},usage:'适合用一个小动作解释机械位移如何改变触点状态；原创尺寸用于教学，不对应具体品牌开关。',recipe:['结构、动作与读数共用一个机构状态。','把完整外壳移开，保留真实厚度和深度遮挡。','沿真实触点位置连续推近，观察表面间隙从非零到零。']},(t,o)=>sampleSwitchAnatomy(t,meta.variant,o),(ctx,t,w,h,o,s)=>drawSwitchAnatomy(ctx,t,w,h,o,s,meta.variant)));
