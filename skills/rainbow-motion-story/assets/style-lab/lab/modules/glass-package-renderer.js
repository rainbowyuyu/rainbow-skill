import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {duration,candidates,sample,routePoints,packageVias,cutawayVias,contactPlanes} from './glass-package-state.js';
export {duration,candidates,sample,routePoints};

// End caps wrap a shorter ceramic body. Their exposed faces are never coplanar.
export function createCapacitorGeometries(){return {body:new RoundedBoxGeometry(.36,.17,.36,3,.025),cap:new RoundedBoxGeometry(.39,.195,.13,3,.012),offset:.23};}

export function createGlassGeometry(cut=false){
 const sh=new THREE.Shape();
 if(cut){
  // The cut plane crosses the two foreground via axes. Open semicircular
  // notches are part of the contour (not invalid holes crossing its edge).
  sh.moveTo(-3,1.9);sh.lineTo(3,1.9);sh.lineTo(3,.65);
  for(const x of [.95,-.95]){sh.lineTo(x+.155,.65);sh.absarc(x,.65,.155,0,Math.PI,false);}
  sh.lineTo(-3,.65);sh.closePath();
 }else{sh.moveTo(-3,1.9);sh.lineTo(3,1.9);sh.lineTo(3,-1.9);sh.lineTo(-3,-1.9);sh.closePath();}
 for(const {x,z,holeRadius}of (cut?cutawayVias:packageVias)){
  if(cut&&z===-.65)continue;
  const hole=new THREE.Path();hole.absarc(x,-z,holeRadius,0,Math.PI*2,true);sh.holes.push(hole);
 }
 const g=new THREE.ExtrudeGeometry(sh,{depth:.664,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:.018,bevelThickness:.018,curveSegments:32});g.rotateX(-Math.PI/2);g.translate(0,.198,0);return g;
}

/** WebGL raster PBR demonstration; no ray tracing or electrical solver. */
export function createScene(canvas,{antialias=true}={}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#33363b');scene.fog=new THREE.Fog('#33363b',24,50);
 const camera=new THREE.PerspectiveCamera(38,16/9,.1,80),pmrem=new THREE.PMREMGenerator(renderer),env=new THREE.Scene();
 env.background=new THREE.Color('#55545a');
 const envResources=[];
 function card(color,intensity,x,y,z,w,h,rotation){const g=new THREE.PlaneGeometry(w,h),m=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide});const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.rotation.set(...rotation);env.add(o);envResources.push(g,m);}
 card('#fff1d9',5,-5,7,4,5,10,[-Math.PI/3,0,-.3]);
 card('#d9ebff',3,6,5,-4,3,8,[Math.PI/4,0,.3]);
 card('#fffefa',7,0,8,-2,2.4,12,[Math.PI/2,0,0]);
 card('#dfe4e6',1.6,-7,0,-4,3,8,[0,Math.PI/2,0]);
 card('#0a0b0d',.1,5,2,5,4,7,[0,-Math.PI/4,0]);
 const environment=pmrem.fromScene(env,.025,.1,40);scene.environment=environment.texture;scene.environmentIntensity=.75;envResources.forEach(r=>r.dispose());
 const hemi=new THREE.HemisphereLight('#e8eff5','#29221f',1.25);scene.add(hemi);
 const key=new THREE.DirectionalLight('#fff0d8',3.1);key.position.set(-3,7,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=8;key.shadow.camera.bottom=-6;key.shadow.camera.near=.2;key.shadow.camera.far=22;key.shadow.bias=-.00015;key.shadow.normalBias=.018;key.shadow.radius=3;scene.add(key);
 const fill=new THREE.DirectionalLight('#b9d2f2',1.0);fill.position.set(5,3,-4);scene.add(fill);
 const mats={
  copper:new THREE.MeshPhysicalMaterial({color:'#c79565',metalness:1,roughness:.27,envMapIntensity:1.1}),
  gold:new THREE.MeshStandardMaterial({color:'#d6ba81',metalness:1,roughness:.31,envMapIntensity:1}),
  solder:new THREE.MeshStandardMaterial({color:'#c2c7ce',metalness:1,roughness:.25}),
  silicon:new THREE.MeshPhysicalMaterial({color:'#172b35',metalness:.55,roughness:.24,clearcoat:.35,clearcoatRoughness:.16}),
  dieTop:new THREE.MeshStandardMaterial({color:'#1d323a',metalness:.7,roughness:.27}),
  dielectric:new THREE.MeshStandardMaterial({color:'#384b47',metalness:0,roughness:.58}),
  dark:new THREE.MeshStandardMaterial({color:'#25292b',metalness:.15,roughness:.5}),
  ceramic:new THREE.MeshStandardMaterial({color:'#b5b7b2',metalness:0,roughness:.48}),
  glass:new THREE.MeshPhysicalMaterial({color:'#c8e9e2',metalness:0,roughness:.11,transmission:.8,thickness:.72,ior:1.48,attenuationColor:'#82aaa1',attenuationDistance:4,transparent:false,side:THREE.FrontSide,envMapIntensity:1.1}),
  floor:new THREE.MeshStandardMaterial({color:'#494747',metalness:.12,roughness:.57}),
  signal:new THREE.MeshStandardMaterial({color:'#c3ffed',emissive:'#71ddbf',emissiveIntensity:2.4,metalness:.1,roughness:.25,transparent:true,depthWrite:false}),
 };
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),mats.floor);ground.rotation.x=-Math.PI/2;ground.position.y=-.17;ground.receiveShadow=true;scene.add(ground);
 const models={metal:new THREE.Group(),stack:new THREE.Group(),route:new THREE.Group()};Object.values(models).forEach(g=>scene.add(g));
 const pickable=[],allGeometries=new Set();
 function mesh(geo,mat,group,x=0,y=0,z=0,shadow=true){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;group.add(m);allGeometries.add(geo);if(mat!==mats.glass&&!mat.transparent&&mat.opacity>0)pickable.push(m);return m;}
 const rbox=(w,h,d,r=.03)=>new RoundedBoxGeometry(w,h,d,3,Math.min(r,h*.45,w*.45,d*.45));
 function box(group,mat,w,h,d,x,y,z,r=.03){return mesh(rbox(w,h,d,r),mat,group,x,y,z);}
 function disc(group,mat,r,h,x,y,z){return mesh(new THREE.CylinderGeometry(r,r,h,32),mat,group,x,y,z);}
 function glassCore(group,cut=false){const core=mesh(createGlassGeometry(cut),mats.glass,group,0,0,0,false);core.receiveShadow=false;return core;}

 function trace(group,a,b,mat=mats.copper,width=.12,height=.048){
  const dx=b[0]-a[0],dz=b[2]-a[2],dy=b[1]-a[1];
  if(Math.abs(dy)>.001)return disc(group,mat,width*.68,Math.abs(dy),(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
  const len=Math.hypot(dx,dz),o=box(group,mat,len+width,height,width,(a[0]+b[0])/2,a[1],(a[2]+b[2])/2,.018);o.rotation.y=-Math.atan2(dz,dx);return o;
 }
 function platePattern(group,y){
  for(let k=0;k<6;k++){
   const z=-1.3+k*.5;
   trace(group,[-2.65,y,z],[-1.52,y,z]);trace(group,[-1.52,y,z],[-1.17,y,z+.18]);
   trace(group,[1.17,y,z+.18],[1.52,y,z]);trace(group,[1.52,y,z],[2.65,y,z]);
   disc(group,mats.gold,.085,.045,-2.65,y,z);disc(group,mats.gold,.085,.045,2.65,y,z);
  }
 }
 function die(group,x,z,w=1.65,d=1.65){
  box(group,mats.silicon,w,.32,d,x,1.2,z,.045);box(group,mats.dieTop,w-.14,.027,d-.14,x,1.374,z,.012);
  // Deliberately coarse, raised zones: enough structure to read without moiré.
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){
   const px=x+(a-1)*(w-.32)/3,pz=z+(b-1)*(d-.32)/3;
   box(group,(a+b)%3===0?mats.copper:mats.dark,(w-.48)/3,.016,(d-.48)/3,px,1.399,pz,.006);
   if((a+b)%3!==0)for(let q=0;q<3;q++)box(group,mats.gold,.025,.012,(d-.6)/3,px+(q-1)*.065,1.412,pz,.004);
  }
  for(let k=0;k<7;k++){const u=(k-3)*.19;box(group,mats.gold,.065,.055,.16,x+u,1.09,z+d/2+.055,.01);box(group,mats.gold,.065,.055,.16,x+u,1.09,z-d/2-.055,.01);}
 }
 function packageModel(group){
  const parts={base:new THREE.Group(),glass:new THREE.Group(),redistribution:new THREE.Group(),chips:new THREE.Group()};Object.values(parts).forEach(g=>group.add(g));
  // Visible package board + solder array have real separation and depth.
  box(parts.base,mats.dark,6.32,.14,4.15,0,.01,0,.06);
  for(let i=0;i<11;i++)for(let j=0;j<7;j++){const o=mesh(new THREE.SphereGeometry(.105,24,16),mats.solder,parts.base,(i-5)*.52,contactPlanes.solderCenter,(j-3)*.5);o.scale.y=contactPlanes.solderRadius/.105;}
  glassCore(parts.glass);for(const {x,z,copperRadius}of packageVias){disc(parts.glass,mats.copper,copperRadius,.76,x,.53,z);disc(parts.glass,mats.gold,.22,.045,x,.925,z);}
  box(parts.redistribution,mats.dielectric,6.08,.08,3.9,0,.95,0,.04);platePattern(parts.redistribution,1.01);
  die(parts.chips,-1.05,-.12,1.78,2.25);die(parts.chips,1.05,-.12,1.78,2.25);
  const capacitor=createCapacitorGeometries();
  for(const x of [-2.55,2.55])for(const z of [-1.15,0,1.15]){mesh(capacitor.body,mats.ceramic,parts.chips,x,1.12,z);mesh(capacitor.cap,mats.solder,parts.chips,x,1.12,z-capacitor.offset);mesh(capacitor.cap,mats.solder,parts.chips,x,1.12,z+capacitor.offset);}
  return parts;
 }
 const metalParts=packageModel(models.metal),stackParts=packageModel(models.stack);
 const routeGroup=models.route;glassCore(routeGroup,true);
 // Section removed toward the camera. Copper stays physical; labels explicitly explain the cutaway.
 for(let i=0;i<routePoints.length-1;i++)trace(routeGroup,routePoints[i],routePoints[i+1],mats.copper,.17,.065);
 for(const x of [-.95,.95]){disc(routeGroup,mats.gold,.235,.05,x,.99,-.65);disc(routeGroup,mats.gold,.235,.05,x,.12,-.65);}
 for(const x of [-2.55,2.55]){box(routeGroup,mats.silicon,.7,.28,.75,x,1.17,-.65,.045);box(routeGroup,mats.gold,.56,.025,.61,x,1.323,-.65,.02);}
 // Background vias/lines show the design repeats; only one path carries the visual marker.
 for(const {x,z,copperRadius}of cutawayVias.filter(v=>v.z===-1.3)){disc(routeGroup,mats.copper,copperRadius,.76,x,.53,z);disc(routeGroup,mats.gold,.17,.045,x,.925,z);}trace(routeGroup,[-2.5,.925,-1.3],[2.5,.925,-1.3],mats.copper,.09,.035);
 // Edge markings bracket the removed slice without covering the via openings.
 for(const [x,w]of [[-2.03,1.85],[0,1.5],[2.03,1.85]]){const edge=box(routeGroup,mats.ceramic,w,.018,.018,x,.2,-.65,.003);edge.castShadow=false;}
 const signal=mesh(new THREE.SphereGeometry(.11,24,16),mats.signal,routeGroup,0,1,0,false);
 const signalLight=new THREE.PointLight('#89f6d0',.8,1.6,2);routeGroup.add(signalLight);
 const halo=mesh(new THREE.TorusGeometry(.18,.014,8,40),mats.signal,routeGroup,0,0,0,false);halo.rotation.x=-Math.PI/2;
 const raycaster=new THREE.Raycaster(),v=new THREE.Vector3(),direction=new THREE.Vector3();let width=1600,height=900,disposed=false,lastState;
 function resize(w,h){if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1)throw new RangeError('positive viewport required');width=Math.round(w);height=Math.round(h);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
 function render(t,options={}){
  if(disposed)throw new Error('scene disposed');const state=sample(t,options);lastState=state;
  for(const [id,g] of Object.entries(models))g.visible=id===state.id;
  for(const [name,g]of Object.entries(stackParts))g.position.y=state.groups[name];
  mats.copper.roughness=state.roughness;mats.gold.roughness=Math.min(.72,state.roughness+.03);
  const cp=state.camera.position;camera.position.set(...cp);camera.fov=state.camera.fov;camera.lookAt(...state.camera.target);camera.updateProjectionMatrix();
  scene.environmentRotation.y=.12; // environment is fixed in world-space: reflections move with the view.
  mats.signal.opacity=state.pulse.opacity;signal.position.set(...state.pulse.position);signal.visible=state.pulse.visible;signal.scale.setScalar(.7+.3*state.pulse.opacity);signalLight.position.copy(signal.position);signalLight.intensity=state.pulse.visible?state.pulse.opacity*.6:0;
  halo.visible=state.pulse.visible;halo.position.copy(signal.position);halo.scale.setScalar(.9+.08*Math.sin(t*2));
  renderer.render(scene,camera);
  const visibleMeshes=pickable.filter(m=>{let a=m;while(a){if(!a.visible)return false;a=a.parent;}return true;});
  const labels=state.labels.map(label=>{
   const world=new THREE.Vector3(...label.anchor);v.copy(world).project(camera);const dist=camera.position.distanceTo(world);direction.copy(world).sub(camera.position).normalize();raycaster.set(camera.position,direction);raycaster.far=Math.max(0,dist-.15);const hit=raycaster.intersectObjects(visibleMeshes,false);return {...label,x:(v.x+1)/2,y:(1-v.y)/2,depth:v.z,visible:v.z>-1&&v.z<1&&Math.abs(v.x)<.97&&Math.abs(v.y)<.9,occluded:hit.length>0};
  });
  return {...state,labels,stats:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,width,height,renderer:'Three.js WebGL raster PBR',transmission:'screen-space transmission approximation',shadows:'PCF shadow map'}};
 }
 function dispose(){if(disposed)return;disposed=true;for(const g of allGeometries)g.dispose();ground.geometry.dispose();Object.values(mats).forEach(m=>m.dispose());environment.dispose();pmrem.dispose();renderer.dispose();}
 resize(canvas.width||1600,canvas.height||900);render(0);return {render,resize,dispose};
}
