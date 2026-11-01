import {candidate,clamp,mix,smooth,text,line,TAU} from './common.js';

/** Original gallery geometry. Metric pinhole projection and thin-lens CoC; Canvas blur is approximate. */
export const DURATION=14;
export const SENSOR_HEIGHT_MM=20.25;
export const STAGE_TIMES=Object.freeze([0,2,5.5,9.5,11.5]);
export const ANCHORS=Object.freeze({
  near:Object.freeze({id:'copper-leaf/focus',objectId:'copper-leaf',label:'近景铜片',position:[-.25,1.35,5.7]}),
  hero:Object.freeze({id:'ceramic-orbit/focus',objectId:'ceramic-orbit',label:'中景圆环',position:[.3,1.0,0]}),
  far:Object.freeze({id:'slate-portals/focus',objectId:'slate-portals',label:'远景拱门',position:[-.75,1.05,-4]})
});
export const SCENE=Object.freeze({id:'quiet-optical-gallery',units:'m',objects:[
  {id:'copper-leaf',layer:'near',position:[...ANCHORS.near.position],shape:'bevelled-plate',size:[.48,.44,.09],color:[182,113,72]},
  {id:'ceramic-orbit',layer:'hero',position:[...ANCHORS.hero.position],shape:'torus',majorRadius:.43,tubeRadius:.095,color:[104,146,143]},
  {id:'slate-portals',layer:'far',position:[...ANCHORS.far.position],shape:'three-portals',color:[109,121,130]}
]});
const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/(n||1));};
const blend=(a,b,u)=>a.map((v,i)=>mix(v,b[i],u));
const ease=(t,a,b)=>t<=a?0:t>=b?1:clamp(smooth((t-a)/(b-a)));
const cap=t=>clamp(Number.isFinite(t)?t:0,0,DURATION);
const positive=(value,label)=>{if(!Number.isFinite(value)||value<=0)throw new RangeError(`${label} must be positive and finite`);return value;};
export function focalLengthToFov(focalLengthMm,sensorHeightMm=SENSOR_HEIGHT_MM){return 2*Math.atan(positive(sensorHeightMm,'sensorHeightMm')/(2*positive(focalLengthMm,'focalLengthMm')))*180/Math.PI;}
export function thinLensImageDistanceMm(objectDepthM,focalLengthMm){const z=positive(objectDepthM,'objectDepthM')*1000,f=positive(focalLengthMm,'focalLengthMm');if(z<=f)throw new RangeError('Object plane must lie beyond focal length');return f*z/(z-f);}
export function circleOfConfusionMm(objectDepthM,focusDepthM,focalLengthMm,fNumber){
  const z=positive(objectDepthM,'objectDepthM')*1000,s=positive(focusDepthM,'focusDepthM')*1000,f=positive(focalLengthMm,'focalLengthMm'),N=positive(fNumber,'fNumber');
  if(z<=f||s<=f)throw new RangeError('Object and focus planes must lie beyond focal length');
  return f*f*Math.abs(z-s)/(N*z*(s-f)); // diameter on sensor, mm
}
export function circleOfConfusionPixels(cocMm,outputHeight=900,sensorHeightMm=SENSOR_HEIGHT_MM){if(!Number.isFinite(cocMm)||cocMm<0)throw new RangeError('cocMm must be nonnegative and finite');return cocMm*positive(outputHeight,'outputHeight')/positive(sensorHeightMm,'sensorHeightMm');}
export function resolveOptions(options={}){return{
  fNumber:clamp(Number.isFinite(options.fNumber)?options.fNumber:2.8,1.4,16),
  focalLengthMm:clamp(Number.isFinite(options.focalLengthMm)?options.focalLengthMm:50,28,85),
  focusMode:['directed','near','hero','far','manual'].includes(options.focusMode)?options.focusMode:'directed',
  manualFocusM:clamp(Number.isFinite(options.manualFocusM)?options.manualFocusM:8,2,24),
  depthMode:options.depthMode==='sharp'?'sharp':'dof'
};}
export function cameraBasis(camera){const forward=norm(sub(camera.target,camera.position)),rawRight=norm(cross(forward,[0,1,0])),rawUp=cross(rawRight,forward),roll=camera.roll||0;return{forward,right:rawRight.map((v,i)=>v*Math.cos(roll)-rawUp[i]*Math.sin(roll)),up:rawUp.map((v,i)=>v*Math.cos(roll)+rawRight[i]*Math.sin(roll))};}
export function opticalDepth(point,camera){return dot(sub(point,camera.position),cameraBasis(camera).forward);}
export function makeProjector(camera,width=1600,height=900){const b=cameraBasis(camera),focalPixels=height*camera.focalLengthMm/camera.sensorHeightMm,principal=camera.principalPoint||[.5,.52];return point=>{const q=sub(point,camera.position),depth=dot(q,b.forward),scale=focalPixels/Math.max(.001,depth);return{x:principal[0]*width+dot(q,b.right)*scale,y:principal[1]*height-dot(q,b.up)*scale,depth,scale,visible:depth>.1};};}
const phrases={
  handoff:['先看近处那片铜','机位不动，把焦点交给后方','中景清楚，近景退为前景','同一空间，注意力已经改变','停下，看清焦点和距离'],
  track:['先确定要跟住的圆环','镜头走近，焦点同时更新','读的是光轴深度，不是固定数字','停下时，主体仍然清楚','保留完整稳定的观察'],
  parallax:['前景暂时挡住中景','横移一点，空间开始分开','近处走得快，远处走得慢','主体露出，停住看清','物体没动，改变的是观察位置']
};
function cameraAt(time,variant){
  const u=ease(time,2,9.5);
  if(variant==='track')return{position:blend([.75,1.85,10.1],[.4,1.3,7.6],u),target:[-.1,1.0,0],roll:0};
  if(variant==='parallax'){const x=mix(-.52,.55,u);return{position:[x,1.6,9],target:[x,1.0,0],roll:0};}
  return{position:[0,1.6,9],target:[0,1.0,0],roll:0};
}
export function sampleCameraDepth(rawTime,variant='handoff',options={}){
  if(!(variant in phrases))variant='handoff';const time=cap(rawTime),o=resolveOptions(options),pose=cameraAt(time,variant);
  const camera={...pose,fov:focalLengthToFov(o.focalLengthMm),focalLengthMm:o.focalLengthMm,sensorHeightMm:SENSOR_HEIGHT_MM,sensorWidthMm:36,fNumber:o.fNumber,principalPoint:[.5,.52],units:'m'};
  const nearDepth=opticalDepth(ANCHORS.near.position,camera),heroDepth=opticalDepth(ANCHORS.hero.position,camera);
  let anchorPosition,anchorId,depthM;
  if(o.focusMode==='manual'){depthM=o.manualFocusM;anchorPosition=add(camera.position,cameraBasis(camera).forward.map(v=>v*depthM));anchorId='manual-focus-plane';}
  else if(o.focusMode!=='directed'){const a=ANCHORS[o.focusMode];anchorPosition=[...a.position];anchorId=a.id;depthM=opticalDepth(anchorPosition,camera);}
  else if(variant==='handoff'){
    const u=ease(time,2,5.5);anchorPosition=blend(ANCHORS.near.position,ANCHORS.hero.position,u);anchorId=u===0?ANCHORS.near.id:u===1?ANCHORS.hero.id:'near-to-hero-focus';depthM=mix(nearDepth,heroDepth,u);
  }else{anchorPosition=[...ANCHORS.hero.position];anchorId=ANCHORS.hero.id;depthM=heroDepth;}
  camera.focusDistance=depthM;
  const project=makeProjector(camera),objects=SCENE.objects.map(object=>{
    const depthM=opticalDepth(object.position,camera),cocMm=circleOfConfusionMm(depthM,camera.focusDistance,o.focalLengthMm,o.fNumber),cocPx=circleOfConfusionPixels(cocMm);
    return{id:object.id,layer:object.layer,position:[...object.position],depthM,cocMm,cocPx,cocReferenceHeight:900,blurPx:Math.min(24,cocPx/2),previewBlurPx:Math.min(24,cocPx/2),previewBlurClamped:cocPx/2>24,projected:project(object.position)};
  });
  const stageIndex=Math.max(0,STAGE_TIMES.findLastIndex(t=>time>=t));
  const cameraMoving=variant!=='handoff'&&time>2&&time<9.5,focusMoving=o.focusMode==='directed'&&variant==='handoff'&&time>2&&time<5.5;
  const annotation=o.focusMode==='directed'?phrases[variant][stageIndex]:o.focusMode==='manual'?'手动固定焦平面，观察各层的清晰变化':`焦点锁在${ANCHORS[o.focusMode].label}，比较其他层的清晰变化`;
  return{time,variant,stageIndex,phase:['establish','move','observe','arrive','hold'][stageIndex],annotation,camera,
    focus:{mode:o.focusMode,anchorId,anchorPosition,depthM,distanceKind:'axial',lensImageDistanceMm:thinLensImageDistanceMm(depthM,o.focalLengthMm)},
    objects,options:o,sceneId:SCENE.id,units:'m',geometryStable:!cameraMoving,readHold:time>=11.5&&!cameraMoving&&!focusMoving,
    projection:'pinhole-with-thin-lens-defocus-diameter',rendering:'center-depth grouped Gaussian preview',physicalPathTracing:false,
    framing:'The focus object stays in frame; foreground/context may intentionally cross the stage edge at long focal lengths.',
    focusMarkAlpha:1,stageBounds:[72,158,1528,748],focusChangeProgress:variant==='handoff'?ease(time,2,5.5):ease(time,2,9.5)
  };
}

function rotate(p,angles){let [x,y,z]=p;const[a,b,c]=angles;[y,z]=[y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];[x,z]=[x*Math.cos(b)+z*Math.sin(b),-x*Math.sin(b)+z*Math.cos(b)];return[x*Math.cos(c)-y*Math.sin(c),x*Math.sin(c)+y*Math.cos(c),z];}
const face=(id,vertices,color)=>({id,vertices,color,normal:norm(cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0])))});
function boxFaces(id,center,size,color){const p=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>add(center,[x*size[0]/2,y*size[1]/2,z*size[2]/2]))));return[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]].map((indices,i)=>face(`${id}/face-${i}`,indices.map(n=>p[n]),color));}
function buildLeaf(){const o=SCENE.objects[0],c=o.position,w=o.size[0]/2,h=o.size[1]/2,d=o.size[2]/2,b=.018,faces=[];
  const outline=[[w-b,h],[-w+b,h],[-w,h-b],[-w,-h+b],[-w+b,-h],[w-b,-h],[w,-h+b],[w,h-b]];
  const front=outline.map(([x,y])=>add(c,[x,y,d])),back=outline.map(([x,y])=>add(c,[x,y,-d]));
  faces.push(face('copper-leaf/front',front,o.color),face('copper-leaf/back',[...back].reverse(),o.color));
  for(let i=0;i<8;i++)faces.push(face(`copper-leaf/bevel-${i}`,[front[i],back[i],back[(i+1)%8],front[(i+1)%8]],[205,143,88]));
  // Narrow inset ridges make sharp-vs-defocused detail observable without embedded typography.
  for(let i=0;i<11;i++){const x=-.19+i*.038;faces.push(...boxFaces(`copper-leaf/ridge-${i}`,add(c,[x,0,d+.002]),[.009,.30,.004],i%2?[149,90,62]:[224,171,112]));}
  for(const x of [-.14,.14])faces.push(...boxFaces(`copper-leaf/suspension-${x}`,add(c,[x,1.24,0]),[.0035,2.04,.0035],[93,102,91]));
  return faces;
}
function buildHero(){const o=SCENE.objects[1],faces=[],n=72,m=16,rotation=[-.12,.28,-.12];
  const point=(i,j)=>{const u=i/n*TAU,v=j/m*TAU,r=o.majorRadius+o.tubeRadius*Math.cos(v);return add(o.position,rotate([r*Math.cos(u),r*Math.sin(u),o.tubeRadius*Math.sin(v)],rotation));};
  for(let i=0;i<n;i++)for(let j=0;j<m;j++)faces.push(face(`ceramic-orbit/surface-${i}-${j}`,[point(i,j),point(i+1,j),point(i+1,j+1),point(i,j+1)],o.color));
  faces.push(...boxFaces('ceramic-orbit/stand',[.3,.17,0],[.72,.12,.42],[194,190,174]),...boxFaces('ceramic-orbit/stem',[.3,.35,0],[.07,.25,.1],[176,119,72]));
  return faces;
}
function buildFar(){const o=SCENE.objects[2],faces=[];for(let i=0;i<3;i++){const x=o.position[0]+(i-1)*.81,z=o.position[2]-(i===1?.22:0),height=1.65-(i===1?0:.18),color=o.color.map(v=>v+(i===1?9:-7));faces.push(...boxFaces(`${o.id}/column-${i}-left`,[x-.29,height/2+.22,z],[.10,height,.16],color),...boxFaces(`${o.id}/column-${i}-right`,[x+.29,height/2+.22,z],[.10,height,.16],color),...boxFaces(`${o.id}/cap-${i}`,[x,height+.22,z],[.68,.12,.16],color),...boxFaces(`${o.id}/plinth-${i}`,[x,.17,z],[.74,.12,.38],[178,174,162]));}return faces;}
export const MESHES=Object.freeze({'copper-leaf':buildLeaf(),'ceramic-orbit':buildHero(),'slate-portals':buildFar()});
function polygon(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
function softContact(ctx,object,project){if(object.layer==='near')return;const center=[object.position[0],.108,object.position[2]],p=project(center),x=project(add(center,[object.layer==='hero'?.68:1.4,0,0])),z=project(add(center,[0,0,.65]));ctx.save();ctx.transform(x.x-p.x,x.y-p.y,z.x-p.x,z.y-p.y,p.x,p.y);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'#34473e42');g.addColorStop(.38,'#34473e20');g.addColorStop(1,'#34473e00');ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();}
function renderObject(ctx,object,state){const project=makeProjector(state.camera),light=norm([-1,2.5,3]);
  softContact(ctx,object,project);
  const faces=MESHES[object.id].map(f=>({...f,points:f.vertices.map(project),center:f.vertices[0]})).filter(f=>dot(f.normal,sub(state.camera.position,f.center))>0&&f.points.every(p=>p.visible)).sort((a,b)=>b.points.reduce((s,p)=>s+p.depth,0)/b.points.length-a.points.reduce((s,p)=>s+p.depth,0)/a.points.length);
  for(const f of faces){const diffuse=Math.max(0,dot(f.normal,light)),view=norm(sub(state.camera.position,f.center)),specular=Math.max(0,dot(f.normal,norm(add(light,view))))**(object.layer==='hero'?28:60),brightness=.47+diffuse*.60+specular*.38;
    const fill=`rgb(${f.color.map(v=>Math.round(clamp(v*brightness,0,255))).join(',')})`;polygon(ctx,f.points);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=fill;ctx.lineWidth=.75;ctx.lineJoin='round';ctx.stroke();
  }
}
const layers=new WeakMap();
function getLayer(ctx,id){let groups=layers.get(ctx);if(!groups){groups=new Map();layers.set(ctx,groups);}if(!groups.has(id)){const create=()=>{if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(1600,900);const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;return canvas;};const source=create(),filtered=create();groups.set(id,{source,filtered,sourceContext:source.getContext('2d',{willReadFrequently:true}),filteredContext:filtered.getContext('2d',{willReadFrequently:true})});}return groups.get(id);}
function reset(ctx){ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.clearRect(0,0,1600,900);}
function objectLayer(ctx,object,state,renderMode){const layer=getLayer(ctx,object.id);reset(layer.sourceContext);renderObject(layer.sourceContext,object,state);reset(layer.filteredContext);
  const blur=renderMode==='sharp'?0:object.blurPx;layer.filteredContext.filter=blur>.001?`blur(${blur.toFixed(4)}px)`:'none';layer.filteredContext.drawImage(layer.source,0,0);layer.filteredContext.filter='none';ctx.filter='none';ctx.drawImage(layer.filtered,0,0);
}
function background(ctx){const g=ctx.createLinearGradient(0,150,1300,900);g.addColorStop(0,'#e9e2d4');g.addColorStop(.6,'#c7c9bc');g.addColorStop(1,'#aab7b2');ctx.fillStyle=g;ctx.fillRect(0,0,1600,900);
  const light=ctx.createRadialGradient(1130,250,20,1130,250,850);light.addColorStop(0,'#fff9df88');light.addColorStop(1,'#fff9df00');ctx.fillStyle=light;ctx.fillRect(0,0,1600,900);
  // Soft photographic backdrop; not a ray-traced ground plane or shadow simulation.
  const base=ctx.createLinearGradient(0,555,0,790);base.addColorStop(0,'#778e8500');base.addColorStop(1,'#506f6b38');ctx.fillStyle=base;ctx.fillRect(0,555,1600,245);
}
function focusBracket(ctx,state){const project=makeProjector(state.camera),p=project(state.focus.anchorPosition);if(!p.visible||p.x<90||p.x>1510||p.y<185||p.y>690)return;const color='#344f4b',r=17;
  ctx.save();ctx.globalAlpha=.75;for(const sx of [-1,1])for(const sy of [-1,1]){line(ctx,[p.x+sx*(r-7),p.y+sy*r],[p.x+sx*r,p.y+sy*r],color,1.5);line(ctx,[p.x+sx*r,p.y+sy*(r-7)],[p.x+sx*r,p.y+sy*r],color,1.5);}ctx.restore();
}
const titles={handoff:'焦点，把视线交给后方',track:'镜头在走，焦点跟住它',parallax:'横移，让被遮住的主体出现'};
export function drawCameraDepth(ctx,time,width,height,options={},state,variant='handoff'){
  const s=state||sampleCameraDepth(time,variant,options),o=resolveOptions(options);
  ctx.save();ctx.setTransform(width/1600,0,0,height/900,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.clearRect(0,0,1600,900);background(ctx);
  ctx.save();ctx.beginPath();ctx.rect(72,158,1456,590);ctx.clip();s.objects.toSorted((a,b)=>b.depthM-a.depthM).forEach(object=>objectLayer(ctx,object,s,o.depthMode));ctx.restore();focusBracket(ctx,s);
  // Reading information is composited after depth groups and remains sharp.
  ctx.filter='none';text(ctx,titles[s.variant],80,72,46,'#253e3c',750);text(ctx,s.annotation,82,121,25,'#405957',500);
  text(ctx,o.depthMode==='sharp'?'全清晰对照':'按深度失焦',1515,76,23,'#405957',600,'right');line(ctx,[82,148],[1515,148],'#526a642c',1);
  text(ctx,`${s.camera.focalLengthMm.toFixed(0)} mm  /  f ${s.camera.fNumber.toFixed(1)}`,82,798,28,'#253e3c',650);
  text(ctx,`焦平面 ${s.focus.depthM.toFixed(2)} m`,1515,798,28,'#253e3c',650,'right');
  const active=s.focus.anchorId===ANCHORS.near.id?'近景铜片':s.focus.anchorId===ANCHORS.hero.id?'中景圆环':s.focus.anchorId===ANCHORS.far.id?'远景拱门':s.focus.mode==='manual'?'手动焦平面':'近景 → 中景';
  text(ctx,active,800,799,26,'#405957',550,'center');
  text(ctx,'固定对象 · 光轴深度与薄透镜弥散圆 · 分层失焦预览',82,849,21,'#526763',450);text(ctx,'非路径追踪',1515,849,20,'#526763',450,'right');ctx.restore();return s;
}
const metadata=[
  {id:'camera-focus-handoff',variant:'handoff',title:'固定机位，焦点从近景交给主体',description:'保留同一空间和投影，只改变焦平面；读图窗口里对比近、中、远三个物体。',stages:['先认出近景','移焦开始','中景接住注意','比较空间层次','稳定读图'],previewTime:6.5,recipe:['先让观众认出近处物件。','机位不动，按薄透镜距离把焦点交向中景。','等焦点落定再讲主体，HUD独立保持锐利。']},
  {id:'camera-focus-track',variant:'track',title:'移动机位，按真实锚点追焦',description:'斜向推进时不断重新计算主体沿光轴的深度；焦距、光圈与对象位置都有明确单位。',stages:['先确定目标','机位开始移动','沿光轴追焦','抵达观察位','稳定读图'],previewTime:7,recipe:['给主体固定焦点锚点。','每帧用相机前向与锚点差向量求点积。','抵达后相机和焦点共同停止，保留检查时间。']},
  {id:'camera-parallax-reveal',variant:'parallax',title:'侧移视差，揭示同一个中景',description:'前景铜片原先挡住圆环；相机平行侧移后，近景位移大、远景位移小，主体被自然揭示。',stages:['先见前景遮挡','侧移开始','近远层分开','主体完整露出','稳定读图'],previewTime:9.8,recipe:['把前景遮挡放进真实三维位置。','平行侧移，不让对象为揭示而偷偷移动。','用前、中、远屏幕位移差确认视差，最后留稳定观察。']}
];
export const candidates=metadata.map(meta=>candidate({...meta,module:'camera',duration:DURATION,loop:false,stageTimes:[...STAGE_TIMES],referenceIds:['camera'],codeFile:'modules/camera-depth.js',controls:{intensity:false,palette:false},
  parameters:{fNumber:{min:1.4,max:16,default:2.8},focalLengthMm:{min:28,max:85,default:50},focusMode:{values:['directed','near','hero','far','manual'],default:'directed'},manualFocusM:{min:2,max:24,default:8},depthMode:{values:['dof','sharp'],default:'dof'}},
  usage:meta.variant==='handoff'?'需要把注意力从一个物体交给另一个时，先固定机位，再改变焦点。':meta.variant==='track'?'需要走近主体又保持细节清楚时，让焦点跟随同一个空间锚点。':'需要揭示被挡住的结构时，用前、中、远景的相对位移交代空间。'
},(t,o)=>sampleCameraDepth(t,meta.variant,o),(ctx,t,w,h,o,s)=>drawCameraDepth(ctx,t,w,h,o,s,meta.variant)));
