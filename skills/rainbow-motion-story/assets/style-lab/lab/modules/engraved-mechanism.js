/** Original finite-geometry linework studies. Not a fluid solver or general 3D renderer.
 * Absolute time, orthographic/perspective projection, convex-face painter ordering.
 * Surface hatches are fixed in part coordinates. No source-film assets or audio.
 */
export const candidates = Object.freeze([
  {id:'engraved-flow-path',title:'沿流路，看见结构',description:'黑橄榄背景上的象牙雕刻线：沿管道找入口，开盖看内部，再回到完整机构。',duration:14},
  {id:'engraved-orthographic-assembly',title:'一张图，装回同一个机构',description:'纸白正交图按结构、排线、尺寸依次建立；开盖、回装和拉远保留同一组部件。',duration:15},
]);
const BY_ID=new Map(candidates.map(x=>[x.id,x]));
export const PART_IDS=Object.freeze(['plinth','rail-near','rail-far','motor-foot','motor-shell','motor-rear','motor-front','shaft','coupling','pump-foot','pump-shell','pump-back','pump-cover','impeller-hub','inlet-pipe','inlet-flange','outlet-neck','outlet-pipe','outlet-flange',...Array.from({length:6},(_,i)=>`impeller-blade-${i}`)]);
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]};
const norm=a=>Math.hypot(...a),unit=a=>V.mul(a,1/(norm(a)||1));
const mix=(a,b,q)=>a+(b-a)*q,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,q)=>a.map((v,i)=>mix(v,b[i],q));
const smooth=q=>{q=clamp(q);return q*q*q*(10+q*(-15+6*q));};
const ramp=(t,a,b)=>smooth((t-a)/(b-a));
const envelope=(t,a,b,c,d)=>ramp(t,a,b)*(1-ramp(t,c,d));
const LIGHT=unit([-.55,.85,.4]);
const KEY=p=>p.map(v=>v.toFixed(6)).join(',');
const seed=i=>{const q=Math.sin(i*127.1+311.7)*43758.5453123;return q-Math.floor(q);};
const mean=ps=>ps.reduce((a,p)=>V.add(a,p),[0,0,0]).map(v=>v/ps.length);

function cameraFor(t,paper) {
  const q=paper?ramp(t,10,14.1):envelope(t,3.8,5.4,9.9,12.4);
  const position=paper?lerp([8,8.6,13],[8.9,8.2,13.4],q):lerp([8.3,6.3,12.3],[7.2,5.4,11.3],q);
  const target=[-.15,1.45,0],forward=unit(V.sub(target,position)),right=unit(V.cross(forward,[0,1,0])),up=V.cross(right,forward);
  return {position,target,forward,right,up,projection:paper?'orthographic':'perspective',scale:paper?mix(104,87,q):1,focal:1320,center:[790,448],near:.1};
}
export function projectPoint(point,camera) {
  const p=V.sub(point,camera.position),depth=V.dot(p,camera.forward);
  if(depth<=camera.near)return null;
  const k=camera.projection==='orthographic'?camera.scale:camera.focal/depth;
  return {point:[camera.center[0]+V.dot(p,camera.right)*k,camera.center[1]-V.dot(p,camera.up)*k],depth,scale:k};
}

/** Polyline reveal by distance, not vertex index. Returns a new path. */
export function revealPath(points,progress) {
  if(!points.length||progress<=0)return [];
  if(progress>=1)return points.map(p=>[...p]);
  const lengths=points.slice(1).map((p,i)=>norm(V.sub(p,points[i]))),total=lengths.reduce((a,b)=>a+b,0);
  let remaining=total*clamp(progress),out=[[...points[0]]];
  for(let i=0;i<lengths.length;i++){
    if(remaining>=lengths[i]){out.push([...points[i+1]]);remaining-=lengths[i];}
    else {out.push(lerp(points[i],points[i+1],lengths[i]?remaining/lengths[i]:0));break;}
  }
  return out;
}
export function pathLength(points){return points.slice(1).reduce((sum,p,i)=>sum+norm(V.sub(p,points[i])),0);}
export function hatchOpacity(spacingPixels){return smooth((spacingPixels-1.7)/3.3);}

function part(id,tone=.48){return {id,tone,faces:[],center:[0,0,0]};}
function face(p,id,points,wanted,{hatch=true,hatchCount=7,role='surface'}={}){
  let ps=points.map(v=>[...v]),normal=unit(V.cross(V.sub(ps[1],ps[0]),V.sub(ps[2],ps[0])));
  if(V.dot(normal,wanted)<0){ps=ps.reverse();normal=V.mul(normal,-1);}
  const hatches=[];
  if(hatch&&ps.length===4){
    for(let i=1;i<hatchCount;i++){
      const q=i/hatchCount;
      hatches.push({id:`${id}-h${i}`,points:[lerp(ps[0],ps[3],q),lerp(ps[1],ps[2],q)],q});
    }
  }
  p.faces.push({id:`${p.id}/${id}`,partId:p.id,points:ps,normal,center:mean(ps),hatches,role,tone:p.tone});
}
function box(id,center,size,tone=.4){
  const p=part(id,tone),[x,y,z]=center,[a,b,c]=size.map(v=>v/2);
  face(p,'top',[[x-a,y+b,z-c],[x+a,y+b,z-c],[x+a,y+b,z+c],[x-a,y+b,z+c]],[0,1,0],{hatchCount:12});
  face(p,'bottom',[[x-a,y-b,z-c],[x+a,y-b,z-c],[x+a,y-b,z+c],[x-a,y-b,z+c]],[0,-1,0]);
  face(p,'front',[[x-a,y-b,z+c],[x+a,y-b,z+c],[x+a,y+b,z+c],[x-a,y+b,z+c]],[0,0,1],{hatchCount:8});
  face(p,'back',[[x-a,y-b,z-c],[x+a,y-b,z-c],[x+a,y+b,z-c],[x-a,y+b,z-c]],[0,0,-1]);
  face(p,'right',[[x+a,y-b,z-c],[x+a,y-b,z+c],[x+a,y+b,z+c],[x+a,y+b,z-c]],[1,0,0]);
  face(p,'left',[[x-a,y-b,z-c],[x-a,y-b,z+c],[x-a,y+b,z+c],[x-a,y+b,z-c]],[-1,0,0]);
  p.center=[...center];return p;
}
function cylinder(id,a,b,r,tone=.5,{sides=32,caps=true,hatchCount=9}={}){
  const p=part(id,tone),axis=unit(V.sub(b,a)),ref=Math.abs(axis[1])<.9?[0,1,0]:[1,0,0],u=unit(V.cross(axis,ref)),v=V.cross(axis,u);
  const ring=(origin,i)=>V.add(origin,V.mul(V.add(V.mul(u,Math.cos(i*Math.PI*2/sides)),V.mul(v,Math.sin(i*Math.PI*2/sides))),r));
  for(let i=0;i<sides;i++){
    const aa=ring(a,i),ab=ring(a,i+1),ba=ring(b,i),bb=ring(b,i+1),normal=unit(V.sub(mean([aa,ab,ba,bb]),mean([a,b])));
    face(p,`side-${i}`,[aa,ba,bb,ab],normal,{hatchCount});
  }
  if(caps){
    face(p,'cap-a',Array.from({length:sides},(_,i)=>ring(a,i)),V.mul(axis,-1),{hatch:false,role:'cap'});
    face(p,'cap-b',Array.from({length:sides},(_,i)=>ring(b,i)),axis,{hatch:false,role:'cap'});
  }
  p.center=mean([a,b]);p.axis=axis;p.radius=r;return p;
}
function blade(id,c,angle){
  const p=box(id,[0,0,0],[.18,.77,.14],.59);
  const rotate=q=>[q[0],q[1]*Math.cos(angle)-q[2]*Math.sin(angle),q[1]*Math.sin(angle)+q[2]*Math.cos(angle)];
  const shift=V.add(c,[0,Math.cos(angle)*.52,Math.sin(angle)*.52]);
  p.faces=p.faces.map(f=>({...f,points:f.points.map(q=>V.add(rotate(q),shift)),normal:rotate(f.normal),center:V.add(rotate(f.center),shift),hatches:f.hatches.map(h=>({...h,points:h.points.map(q=>V.add(rotate(q),shift))}))}));
  p.center=shift;return p;
}

function geometry(open,spin){
  const coverX=1.87+open*1.15;
  const parts=[
    box('plinth',[-.2,.13,0],[9.7,.24,3.65],.25),
    box('rail-near',[-.3,.39,1.13],[8.7,.29,.19],.34),box('rail-far',[-.3,.39,-1.13],[8.7,.29,.19],.34),
    box('motor-foot',[-2,.67,0],[2.7,.4,1.9],.37),
    cylinder('motor-shell',[-3.4,1.63,0],[-.65,1.63,0],.84,.62,{hatchCount:13}),
    cylinder('motor-rear',[-3.57,1.63,0],[-3.4,1.63,0],.9,.41),
    cylinder('motor-front',[-.65,1.63,0],[-.46,1.63,0],.9,.52),
    cylinder('shaft',[-.45,1.63,0],[.65,1.63,0],.16,.73),
    cylinder('coupling',[-.18,1.63,0],[.19,1.63,0],.29,.43),
    box('pump-foot',[1.12,.59,0],[1.76,.26,1.64],.4),
    cylinder('pump-shell',[.55,1.72,0],[1.86,1.72,0],1.08,.58,{caps:false,hatchCount:8}),
    cylinder('pump-back',[.43,1.72,0],[.56,1.72,0],1.14,.47),
    cylinder('pump-cover',[coverX,1.72,0],[coverX+.15,1.72,0],1.15,.65,{hatchCount:3}),
    cylinder('impeller-hub',[1.2,1.72,0],[1.69,1.72,0],.24,.62),
    cylinder('inlet-pipe',[coverX+.15,1.72,0],[coverX+1.9,1.72,0],.34,.41),
    cylinder('inlet-flange',[coverX+1.83,1.72,0],[coverX+2.05,1.72,0],.48,.64),
    cylinder('outlet-neck',[1.12,2.65,0],[1.12,3.75,0],.29,.51),
    cylinder('outlet-pipe',[1.12,3.65,0],[3.95,3.65,0],.29,.49),
    cylinder('outlet-flange',[3.83,3.65,0],[4.02,3.65,0],.43,.65),
    ...Array.from({length:6},(_,i)=>blade(`impeller-blade-${i}`,[1.61,1.72,0],i*Math.PI/3+spin)),
  ];
  return parts;
}

function projectGeometry(parts,camera){
  const all=parts.flatMap(p=>p.faces),visible=new Map();
  for(const f of all){
    const toEye=camera.projection==='orthographic'?V.mul(camera.forward,-1):V.sub(camera.position,f.center);
    if(V.dot(f.normal,toEye)<=1e-9)continue;
    const projected=f.points.map(p=>projectPoint(p,camera));
    if(projected.some(v=>!v))continue;
    const ps=projected.map(p=>p.point),hatches=f.hatches.map(h=>{
      const points=h.points.map(p=>projectPoint(p,camera).point);
      const step=h.q+1/(f.hatches.length+1),a=lerp(f.points[0],f.points[3],h.q),b=lerp(f.points[0],f.points[3],step);
      const spacing=norm(V.sub(projectPoint(a,camera).point,projectPoint(b,camera).point));
      return {...h,points,spacingPixels:spacing,alpha:hatchOpacity(spacing)};
    });
    // Face decorations belong to the face draw pass, never a final x-ray overlay.
    const marks=f.id==='pump-cover/cap-b'?Array.from({length:8},(_,i)=>{
      const angle=i*Math.PI/4,center=[f.center[0]+.002,1.72+.96*Math.cos(angle),.96*Math.sin(angle)];
      return {id:`cover-bolt-${i}`,points:Array.from({length:17},(_,j)=>{
        const a=j*Math.PI/8;
        return projectPoint([center[0],center[1]+.034*Math.cos(a),center[2]+.034*Math.sin(a)],camera).point;
      })};
    }):[];
    visible.set(f.id,{...f,screen:ps,depth:projectPoint(f.center,camera).depth,hatches,edges:[],marks});
  }
  // Edges are shared per part. Silhouettes are heavier; planar seams are omitted.
  for(const part of parts){
    const edgeMap=new Map();
    for(const f of part.faces)for(let i=0;i<f.points.length;i++){
      const a=f.points[i],b=f.points[(i+1)%f.points.length],key=[KEY(a),KEY(b)].sort().join('|');
      const e=edgeMap.get(key)||{a,b,faces:[]};e.faces.push(f);edgeMap.set(key,e);
    }
    for(const e of edgeMap.values()){
      const vf=e.faces.filter(f=>visible.has(f.id));if(!vf.length)continue;
      const silhouette=vf.length!==e.faces.length||e.faces.length===1;
      const crease=e.faces.length===2&&V.dot(e.faces[0].normal,e.faces[1].normal)<.68;
      if(!silhouette&&!crease)continue;
      const owner=vf.sort((a,b)=>a.id.localeCompare(b.id))[0];
      visible.get(owner.id).edges.push({points:[projectPoint(e.a,camera).point,projectPoint(e.b,camera).point],role:silhouette?'outline':'structure'});
    }
  }
  const faces=[...visible.values()].sort((a,b)=>b.depth-a.depth||a.id.localeCompare(b.id));
  const bounds=ps=>({minX:Math.min(...ps.map(p=>p[0])),maxX:Math.max(...ps.map(p=>p[0])),minY:Math.min(...ps.map(p=>p[1])),maxY:Math.max(...ps.map(p=>p[1]))});
  const overlaps=(a,b)=>a.minX<=b.maxX&&b.minX<=a.maxX&&a.minY<=b.maxY&&b.minY<=a.maxY;
  const housing=faces.filter(f=>['pump-shell','pump-back','pump-cover','inlet-pipe','inlet-flange'].includes(f.partId)).map(f=>({...f,bounds:bounds(f.screen)}));
  for(const f of faces){
    // The impeller is geometrically inside the housing. A convex housing face is
    // an occluder only when ALL vertices of this interior face lie behind its
    // plane. Its projected polygon masks only covered pixels: moving the cover
    // reveals the opening gradually, with no time-based hiding of the impeller.
    const faceBounds=bounds(f.screen);
    f.occluders=f.partId.startsWith('impeller-')?housing.filter(h=>overlaps(faceBounds,h.bounds)&&f.points.every(p=>V.dot(h.normal,V.sub(p,h.center))< -1e-7)).map(h=>({id:h.id,screen:h.screen})):[];
    f.fullyOccluded=f.occluders.some(h=>f.screen.every(p=>insideProjectedFace(p,h.screen)));
  }
  return faces;
}

/** Convex projected-face containment, also used to inspect geometric masks. */
export function insideProjectedFace(point,polygon,tolerance=1e-7){
  let sign=0;
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const cross=(b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]);
    if(Math.abs(cross)<=tolerance)continue;
    const next=Math.sign(cross);if(sign&&next!==sign)return false;sign=next;
  }
  return true;
}

export function sample(input,options={}){
  const id=options.id??candidates[0].id,meta=BY_ID.get(id);
  if(!meta)throw new RangeError(`Unknown engraved mechanism: ${id}`);
  if(!Number.isFinite(input))throw new TypeError('time must be finite');
  const t=clamp(input,0,meta.duration),paper=id===candidates[1].id;
  const open=paper?envelope(t,5.3,7.1,8.25,10):envelope(t,5,6.6,9.15,10.9);
  const spin=paper?0:Math.max(0,t-3.6)*.9*(1-.8*open);
  const camera=cameraFor(t,paper),parts=geometry(open,spin),faces=projectGeometry(parts,camera);
  const drawProgress=paper?ramp(t,0,2.5):ramp(t,0,1.25),hatchProgress=paper?ramp(t,2.7,4.8):ramp(t,.9,3.2);
  const dimsProgress=paper?envelope(t,4,5,10,11):envelope(t,2.8,3.5,4.7,5.1);
  // Flow is an instructional section overlay; hidden internal portion is dashed.
  const coverX=1.87+open*1.15,flowWorld=[[coverX+2.05,1.72,0],[coverX+.15,1.72,0],[1.5,1.72,0],[1.12,2.55,0],[1.12,3.65,0],[4.03,3.65,0]];
  const flowProgress=paper?0:ramp(t,3.7,5.4)*(1-ramp(t,11.5,12.7));
  const flowScreen=flowWorld.map(p=>projectPoint(p,camera).point),flow=revealPath(flowScreen,flowProgress);
  const particles=Array.from({length:7},(_,i)=>{const p=((t*.16+i/7)%1+1)%1;const path=revealPath(flowScreen,p);return {id:`flow-particle-${i}`,progress:p,position:path.at(-1),alpha:flowProgress>p?flowProgress:0};});
  const phase=paper?(t<2.7?'先建立结构':t<5.3?'排线给出体积':t<8.25?'沿安装轴拆开':t<10?'同一组件，回到原位':'拉开，看完整关系'):(t<3.7?'外轮廓与表面是两层':t<5?'沿管路找到入口':t<9.15?'开盖，让内部关系可见':t<11.5?'回装后仍是同一条流路':'停留，看完整的机构');
  const calloutAnchor=projectPoint([coverX+.15,2.55,.76],camera).point;
  const callout={text:'沿轴开盖',anchor:calloutAnchor,position:V.add(calloutAnchor,[170,-72]),alpha:open};
  return {id,time:t,duration:meta.duration,paper,phase,camera,parts:parts.map(p=>({id:p.id,center:p.center,faceCount:p.faces.length})),faces,open,spin,drawProgress,hatchProgress,dimsProgress,flowProgress,flow,flowWorld,particles,callout,readWindow:paper?(t>=4.8&&t<=5.3)||(t>=14.1):t>=12.7,occlusion:{method:'front-face culling + depth-sorted convex faces; impeller also clips against projected housing faces proved in front of it',hiddenLines:'off',flow:'explicit section overlay, internal span dashed'},evidence:'original finite-geometry 2.5D study; no fluid simulation or ray tracing'};
}

function polygon(c,ps){c.beginPath();ps.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();}
function polyline(c,ps){if(ps.length<2)return;c.beginPath();ps.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();}
const rgb=(a,b,q)=>`rgb(${a.map((v,i)=>Math.round(mix(v,b[i],q))).join(',')})`;
function surfaceColor(face,paper){
  const diffuse=.24+.76*Math.max(0,V.dot(face.normal,LIGHT));
  return paper?rgb([145,151,137],[238,233,214],.58+.35*diffuse):rgb([15,20,16],[206,206,182],clamp(face.tone*(.35+.65*diffuse)));
}
function label(c,txt,x,y,size,color,weight=500,align='left'){
  c.fillStyle=color;c.font=`${weight} ${size}px "Microsoft YaHei UI",sans-serif`;c.textAlign=align;c.fillText(txt,x,y);
}
function dimension(c,s,a,b,offset,text){
  const pa=projectPoint(a,s.camera).point,pb=projectPoint(b,s.camera).point,A=V.add(pa,offset),B=V.add(pb,offset),ink=s.paper?'#5f695d':'#9caa94';
  c.save();c.globalAlpha=s.dimsProgress;c.strokeStyle=ink;c.lineWidth=1;
  polyline(c,[pa,A]);polyline(c,[pb,B]);polyline(c,[A,B]);
  for(const p of [A,B])polyline(c,[[p[0]-4,p[1]+5],[p[0]+4,p[1]-5]]);
  label(c,text,(A[0]+B[0])/2,(A[1]+B[1])/2-9,16,ink,500,'center');c.restore();
}
export function draw(ctx,t,width,height,options={}){
  const s=sample(t,options),c=ctx,ink=s.paper?'#27382e':'#e6e5cf',muted=s.paper?'#6e786c':'#84917d',accent=s.paper?'#866941':'#e8b95b';
  c.save();c.setTransform(width/1600,0,0,height/900,0,0);c.fillStyle=s.paper?'#e8e7db':'#10150f';c.fillRect(0,0,1600,900);
  // Seeded, stationary broad paper fibres; not per-frame screen noise.
  c.save();c.globalAlpha=s.paper?.024:.035;c.strokeStyle=s.paper?'#777e6b':'#b3b7a1';c.lineWidth=.8;
  for(let i=0;i<62;i++){const x=seed(i+1)*1600,y=seed(i+101)*900;polyline(c,[[x,y],[x+40+seed(i+201)*210,y+seed(i+301)*5]]);}c.restore();
  c.strokeStyle=s.paper?'#bec3b1':'#273325';c.lineWidth=.8;c.globalAlpha=.4;
  // A quiet floor, projected in the same world as the mechanism.
  for(let x=-7;x<=7;x++){const a=projectPoint([x,0,-4],s.camera),b=projectPoint([x,0,4],s.camera);if(a&&b)polyline(c,[a.point,b.point]);}
  for(let z=-4;z<=4;z++){const a=projectPoint([-7,0,z],s.camera),b=projectPoint([7,0,z],s.camera);if(a&&b)polyline(c,[a.point,b.point]);}
  c.globalAlpha=1;
  for(const f of s.faces){
    const stageDelay=f.partId==='plinth'?0:f.partId.startsWith('motor')?.04:.09;
    const q=clamp((s.drawProgress-stageDelay)/(1-stageDelay));if(q<=0||f.fullyOccluded)continue;
    c.save();
    // Intersect the outside of every housing occluder. This clips fills, edges
    // and hatches together even if a large cover face has an earlier mean depth.
    for(const mask of f.occluders){
      c.beginPath();c.rect(0,0,1600,900);mask.screen.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.clip('evenodd');
    }
    polygon(c,f.screen);c.fillStyle=s.paper?rgb([232,231,219],surfaceColor(f,true).match(/\d+/g).map(Number),s.hatchProgress):surfaceColor(f,false);c.fill();
    // Actual polygon clip prevents local hatch ends crossing part silhouettes.
    c.save();polygon(c,f.screen);c.clip();c.strokeStyle=s.paper?'#374937':'#d0d5b9';c.lineWidth=.72;
    for(const h of f.hatches){
      c.globalAlpha=h.alpha*s.hatchProgress*(s.paper?.24:.31);if(c.globalAlpha<.015)continue;
      polyline(c,revealPath(h.points,clamp((s.hatchProgress-h.q*.18)/.82)));
    }
    c.restore();
    for(const e of f.edges){c.strokeStyle=ink;c.lineWidth=e.role==='outline'?(s.paper?1.48:1.66):.72;c.globalAlpha=e.role==='outline'?.78:.3;polyline(c,revealPath(e.points,q));}
    // Projected circles live on the cap and are occluded by later foreground faces.
    c.save();polygon(c,f.screen);c.clip();c.strokeStyle=ink;c.lineWidth=1.05;c.globalAlpha=.6*q;
    for(const mark of f.marks)polyline(c,revealPath(mark.points,q));c.restore();
    c.restore();c.globalAlpha=1;
  }
  // Face-layer ordering gives physical occlusion. This overlay is intentionally a section route.
  if(s.flow.length>1){
    c.save();c.strokeStyle=accent;c.lineWidth=2.2;c.globalAlpha=s.flowProgress*.8;c.setLineDash([7,6]);polyline(c,s.flow);c.setLineDash([]);
    for(const p of s.particles){if(!p.position||p.alpha<=0)continue;c.globalAlpha=p.alpha*.9;c.fillStyle=accent;c.beginPath();c.arc(...p.position,3.5,0,Math.PI*2);c.fill();}
    const a=projectPoint([3.9,3.7,0],s.camera).point;label(c,'流向示意',a[0]+16,a[1]-8,18,accent);c.restore();
  }
  dimension(c,s,[-3.58,.13,1.83],[3.9,.13,1.83],[0,55],'同一装配轴 / 示例比例');
  // Keep the label in the gap above the inlet, away from the shaft/coupling.
  if(s.callout.alpha>.005){
    const a=s.callout.anchor,p=s.callout.position;
    c.save();c.globalAlpha=s.callout.alpha*.8;c.strokeStyle=muted;c.lineWidth=1;
    polyline(c,[a,[a[0]+55,a[1]-30],[p[0]-14,p[1]-5]]);
    label(c,s.callout.text,...p,18,muted);c.restore();
  }
  label(c,s.paper?'02 / DRAWING → ASSEMBLY':'01 / SURFACE → STRUCTURE',78,65,17,muted,600);
  label(c,s.paper?'从一张图，装回一个机构':'沿一条流路，看清每一层',78,111,35,ink,600);
  label(c,s.paper?'结构线先出现，明暗随后。零件始终保留自己的位置关系。':'强轮廓 · 弱排线 · 明确的内部观察',80,147,19,muted);
  c.strokeStyle=s.paper?'#bfc5b5':'#3b4635';c.lineWidth=1;polyline(c,[[80,794],[1520,794]]);
  label(c,s.phase,80,835,23,ink,500);label(c,'原创有限几何预演 · 非流体求解',1520,835,15,muted,400,'right');
  label(c,'局部固定排线 / 几何投影 / 实体面遮挡',80,867,14,muted,400);
  c.restore();return s;
}
