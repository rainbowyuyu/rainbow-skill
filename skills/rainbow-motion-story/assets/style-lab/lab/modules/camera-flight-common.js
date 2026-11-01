/** Clipped perspective scene helpers for camera studies. Units are metres.
 * Original Canvas renderer: matte appearance study, not a ray tracer.
 * All inputs are absolute state; this module retains no animation state.
 */
import {clamp, text} from './common.js';

export const add = (a,b) => a.map((v,i)=>v+b[i]);
export const sub = (a,b) => a.map((v,i)=>v-b[i]);
export const mul = (a,s) => a.map(v=>v*s);
export const dot3 = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
export const cross3 = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const length3 = a => Math.hypot(...a);
export const unit = a => mul(a,1/(length3(a)||1));
export const lerp = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
export const rotateY = (p,a) => [p[0]*Math.cos(a)+p[2]*Math.sin(a),p[1],-p[0]*Math.sin(a)+p[2]*Math.cos(a)];

/** Sutherland–Hodgman half-space clipping, including exact intersections. */
export function clipPolygon(points, distance) {
  if(!points.length)return [];
  const out=[];let a=points[points.length-1], da=distance(a);
  for(const b of points){const db=distance(b);
    if((da>=0)!==(db>=0))out.push(lerp(a,b,da/(da-db)));
    if(db>=0)out.push(b);
    a=b;da=db;
  }
  return out;
}

export function viewFor(camera,{near=.12,far=240,width=1600,height=900}={}) {
  const forward=unit(sub(camera.target,camera.position));
  const referenceUp=Math.abs(forward[1])>.995?[0,0,1]:[0,1,0];
  const right=unit(cross3(forward,referenceUp)),up=unit(cross3(right,forward));
  const co=Math.cos(camera.roll||0),si=Math.sin(camera.roll||0);
  const focal=height*.5/Math.tan(camera.fov*Math.PI/360);
  const toCamera=point=>{const q=sub(point,camera.position),x=dot3(q,right),y=dot3(q,up);return [x*co-y*si,x*si+y*co,dot3(q,forward)];};
  const projectCamera=q=>[width*.5+focal*q[0]/q[2],height*.52-focal*q[1]/q[2]];
  const point=p=>{const q=toCamera(p);return {point:q[2]>=near&&q[2]<=far?projectCamera(q):null,depth:q[2]};};
  const polygon=points=>{
    let q=points.map(toCamera);
    q=clipPolygon(q,p=>p[2]-near);q=clipPolygon(q,p=>far-p[2]);
    if(q.length<3)return null;
    const depth=q.reduce((sum,p)=>sum+p[2],0)/q.length;
    q=q.map(projectCamera);
    for(const distance of [p=>p[0],p=>width-p[0],p=>p[1],p=>height-p[1]])q=clipPolygon(q,distance);
    if(q.length<3)return null;
    return {points:q,depth};
  };
  return {forward,right,up,near,far,focal,toCamera,point,polygon};
}

function rgb(hex){const h=hex.slice(1);return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}
function tint(hex,brightness,fog=0){const source=rgb(hex),haze=[30,49,58];return `rgb(${source.map((v,i)=>Math.round((v*brightness)*(1-fog)+haze[i]*fog)).join(',')})`;}
const LIGHT=unit([-.4,.8,.3]);
export const face=(points,color,options={})=>({points,color,...options});

export function box(center,size,color,{yaw=0,alpha=1,emissive=false}={}) {
  const vertices=[[-1,-1,-1],[-1,-1,1],[-1,1,-1],[-1,1,1],[1,-1,-1],[1,-1,1],[1,1,-1],[1,1,1]].map(v=>add(center,rotateY(v.map((c,i)=>c*size[i]*.5),yaw)));
  // All quads are wound outwards. One world-space light illuminates all objects.
  return [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]].map(ids=>face(ids.map(i=>vertices[i]),color,{alpha,emissive,cull:true}));
}

export function cylinder(center,radius,height,color,{segments=24,alpha=1}={}) {
  const lower=[],upper=[],result=[];
  for(let i=0;i<segments;i++){const a=i*Math.PI*2/segments;lower.push(add(center,[radius*Math.cos(a),-height*.5,radius*Math.sin(a)]));upper.push(add(center,[radius*Math.cos(a),height*.5,radius*Math.sin(a)]));}
  for(let i=0;i<segments;i++){const j=(i+1)%segments;result.push(face([lower[i],upper[i],upper[j],lower[j]],color,{alpha,cull:true}));}
  result.push(face([...upper].reverse(),color,{alpha,cull:true}));
  result.push(face(lower,color,{alpha,cull:true}));
  return result;
}

export function ribbon(points,width,color,{alpha=1,yOffset=.014}={}) {
  const result=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],t=unit([b[0]-a[0],0,b[2]-a[2]]),side=[-t[2]*width*.5,0,t[0]*width*.5];
    result.push(face([add(add(a,side),[0,yOffset,0]),add(sub(a,side),[0,yOffset,0]),add(sub(b,side),[0,yOffset,0]),add(add(b,side),[0,yOffset,0])],color,{alpha,emissive:true}));
  }
  return result;
}

export function ring(center,radius,width,color,{segments=64,alpha=1}={}) {
  const result=[];
  for(let i=0;i<segments;i++){const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
    result.push(face([a,b].flatMap((angle,j)=>{const rs=j?[radius-width*.5,radius+width*.5]:[radius+width*.5,radius-width*.5];return rs.map(r=>add(center,[r*Math.cos(angle),0,r*Math.sin(angle)]));}),color,{alpha,emissive:true}));
  }return result;
}

/** Euclidean distance to an oriented box. Negative inside. */
export function clearanceToBox(position,obstacle,radius=.22) {
  const local=rotateY(sub(position,obstacle.center),-(obstacle.yaw||0));
  const q=local.map((v,i)=>Math.abs(v)-obstacle.size[i]*.5);
  return length3(q.map(v=>Math.max(0,v)))+Math.min(0,Math.max(...q))-radius;
}

export function gate(center,width,height,accent,{yaw=0,thickness=.34}={}) {
  const pieces=[{center:add(center,rotateY([-width*.5-thickness*.5,height*.5,0],yaw)),size:[thickness,height,thickness]},
    {center:add(center,rotateY([width*.5+thickness*.5,height*.5,0],yaw)),size:[thickness,height,thickness]},
    {center:add(center,[0,height+thickness*.5,0]),size:[width+2*thickness,thickness,thickness]}].map(p=>({...p,yaw}));
  const faces=pieces.flatMap(p=>box(p.center,p.size,'#455d65',{yaw}));
  for(const side of [-1,1]){
    const at=add(center,rotateY([side*(width*.5+.01),height*.5,.035],yaw));
    faces.push(...box(at,[.048,height-.18,thickness*.95],accent,{yaw,emissive:true}));
    faces.push(...box(add(center,rotateY([side*(width*.5+.18),.14,0],yaw)),[.9,.28,.85],'#819394',{yaw}));
  }
  faces.push(...box(add(center,[0,height+.04,0]),[width,.055,thickness+.02],accent,{yaw,emissive:true}));
  return {faces,obstacles:pieces};
}

export function architecture(center,size,{accent='#dcaa6e',yaw=0}={}){
  const faces=box(center,size,'#63777a',{yaw});
  const rows=Math.max(2,Math.floor(size[1]/2.6));
  for(let i=1;i<rows;i++){
    const y=-size[1]*.5+i*size[1]/rows;
    faces.push(...box(add(center,rotateY([0,y,size[2]*.5+.008],yaw)),[size[0]*.9,.04,.025],i%3===0?accent:'#293f49',{yaw,emissive:i%3===0}));
  }
  faces.push(...box(add(center,[0,size[1]*.5+.06,0]),[size[0]+.12,.12,size[2]+.12],'#a7b1aa',{yaw}));
  return faces;
}

/** Polygon painter with backface, near/far and viewport clipping. */
export function renderScene(ctx,camera,{ground=[],faces=[]}){
  const view=viewFor(camera);
  const paint=(items,sort)=>{
    const queue=[];
    for(const f of items){
      const normal=unit(cross3(sub(f.points[1],f.points[0]),sub(f.points[2],f.points[0])));
      if(f.cull&&dot3(normal,sub(camera.position,f.points[0]))<=0)continue;
      const q=view.polygon(f.points);if(!q)continue;
      queue.push({...q,f,normal});
    }
    if(sort)queue.sort((a,b)=>b.depth-a.depth);
    for(const q of queue){
      const light=q.f.emissive?1:clamp(.42+.48*Math.max(0,dot3(q.normal,LIGHT))+.12*Math.max(0,q.normal[1]),.28,1.08);
      const fog=clamp((q.depth-28)/190,0,.62);
      ctx.globalAlpha=q.f.alpha??1;ctx.fillStyle=tint(q.f.color,light,fog);
      ctx.beginPath();ctx.moveTo(...q.points[0]);q.points.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();ctx.fill();
      // A same-color hairline seals raster cracks between coplanar faces.
      ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.45;ctx.stroke();
    }
  };
  ctx.save();ctx.beginPath();ctx.rect(0,0,1600,900);ctx.clip();paint(ground,false);paint(faces,true);ctx.restore();
  return view;
}

export function floor({extent=110,step=8,color='#253c42',warm='#bc925f'}={}){
  const faces=[face([[-extent,0,-extent],[-extent,0,extent],[extent,0,extent],[extent,0,-extent]],color)];
  for(let z=-extent;z<=extent;z+=step)faces.push(face([[-extent,.005,z-.015],[extent,.005,z-.015],[extent,.005,z+.015],[-extent,.005,z+.015]],'#48616a',{alpha:.35,emissive:true}));
  for(let x=-extent;x<=extent;x+=step)faces.push(face([[x-.015,.006,-extent],[x+.015,.006,-extent],[x+.015,.006,extent],[x-.015,.006,extent]],'#48616a',{alpha:.35,emissive:true}));
  return faces;
}

export function drawFlightFrame(ctx,w,h,theme,s,{title,subtitle,detail,scene}){
  ctx.save();ctx.setTransform(w/1600,0,0,h/900,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.clearRect(0,0,1600,900);
  const sky=ctx.createLinearGradient(0,0,0,900);sky.addColorStop(0,'#142733');sky.addColorStop(.55,'#556c75');sky.addColorStop(1,'#89918b');ctx.fillStyle=sky;ctx.fillRect(0,0,1600,900);
  const view=renderScene(ctx,s.camera,scene);
  const veil=ctx.createLinearGradient(0,0,0,180);veil.addColorStop(0,'#08131dd9');veil.addColorStop(1,'#08131d00');ctx.fillStyle=veil;ctx.fillRect(0,0,1600,180);
  const foot=ctx.createLinearGradient(0,720,0,900);foot.addColorStop(0,'#07111a00');foot.addColorStop(1,'#07111aeb');ctx.fillStyle=foot;ctx.fillRect(0,720,1600,180);
  text(ctx,title,72,63,34,'#f4efe5',700);text(ctx,subtitle,74,108,20,'#c1d0d1');
  text(ctx,s.stage,1524,68,23,theme.gold,600,'right');
  text(ctx,detail,74,799,23,'#e5e9e6',500);
  text(ctx,`高度 ${s.camera.position[1].toFixed(1)} m  ·  横滚 ${(s.camera.roll*180/Math.PI).toFixed(1)}°  ·  视角 ${s.camera.fov.toFixed(0)}°`,74,840,18,'#acbec4');
  text(ctx,'固定几何路径 · 非飞行动力学',1524,840,18,'#acbec4',400,'right');
  ctx.strokeStyle='#a5b9bd44';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(74,875);ctx.lineTo(1524,875);ctx.stroke();
  ctx.strokeStyle=theme.gold;ctx.beginPath();ctx.moveTo(74,875);ctx.lineTo(74+1450*s.phase,875);ctx.stroke();ctx.restore();
  return view;
}
