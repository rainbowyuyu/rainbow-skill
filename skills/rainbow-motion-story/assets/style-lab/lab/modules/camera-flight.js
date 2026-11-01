/** Four original camera studies. Real perspective; deterministic absolute time.
 * A camera choreography model, not an aircraft controller or physics solver.
 */
import {candidate,clamp,smooth,TAU} from './common.js';
import {add,sub,mul,unit,length3,rotateY,box,cylinder,face,gate,architecture,floor,ribbon,ring,clearanceToBox,drawFlightFrame} from './camera-flight-common.js';

const DURATION=12;
const localTime=t=>clamp(t,0,DURATION);
// C2 acceleration/deceleration ramps surrounding a constant-speed cruise.
const cruiseProgress=(value,edge=.16)=>{const q=clamp(value),integral=u=>u**6-3*u**5+2.5*u**4;return q<edge?edge*integral(q/edge)/(1-edge):q>1-edge?1-edge*integral((1-q)/edge)/(1-edge):(q-edge*.5)/(1-edge);};
const stageAt=(time,stages,times)=>stages[Math.max(0,times.findLastIndex(v=>time>=v))];
const ahead=(route,u,lead=.025)=>unit(sub(route(u+lead+.0001),route(u+lead-.0001)));
const pose=(position,direction,{roll=0,fov=66,focus=7}={})=>({position,target:add(position,mul(direction,focus)),fov,roll,focusDistance:focus,principalPoint:[.5,.52]});
const metadata={module:'camera',duration:DURATION,referenceIds:['camera'],codeFile:'./modules/camera-flight.js',loop:false,
  implementation:'Canvas perspective camera with near-plane and viewport clipping. Fixed geometric route, not flight dynamics.',
  parameters:{intensity:{min:0,max:1,default:.65,meaning:'Controls bank/FOV only; route clearance is unchanged'},palette:{values:['titanium','ember','porcelain'],default:'titanium'}}};
// Only immutable world geometry is cached; sampled camera/animation state is not.
const worldCache=new Map();
const cachedWorld=(id,theme,build)=>{const key=`${id}:${theme.gold}:${theme.cyan}`;if(!worldCache.has(key))worldCache.set(key,build());return worldCache.get(key);};

// Fixed slalom centre line. Gate opening and traversal use the same function.
const slalomPoint=s=>[2.65*Math.sin(s/29*TAU),2.45+.28*Math.sin(s/38*TAU),8-s];
const slalomYaw=s=>Math.atan2(-(2.65*TAU/29)*Math.cos(s/29*TAU),1);
const slalomGateDistances=[7,15,23,31,39,47];
function slalomScene(theme){
  return cachedWorld('slalom',theme,()=>{
  const faces=[],ground=floor(),obstacles=[];
  for(const [i,s]of slalomGateDistances.entries()){
    const p=slalomPoint(s),g=gate([p[0],0,p[2]],5.8,5.3,i%2?theme.cyan:theme.gold,{yaw:slalomYaw(s)});
    faces.push(...g.faces);obstacles.push(...g.obstacles);
  }
  const route=Array.from({length:181},(_,i)=>{const p=slalomPoint(-5+i*66/180);return [p[0],.012,p[2]];});
  ground.push(...ribbon(route,.075,theme.gold,{alpha:.7}));
  for(let i=0;i<15;i++){
    const s=-4+i*4.5,p=slalomPoint(s),yaw=slalomYaw(s);
    for(const side of [-1,1]){
      const c=add([p[0],0,p[2]],rotateY([side*(6.4+(i%3)*.45),0,0],yaw));
      const height=3.8+(i%4)*2.3,size=[1.6,height,2.2],center=add(c,[0,height*.5,0]);
      faces.push(...architecture(center,size,{accent:side>0?theme.cyan:theme.gold,yaw}));obstacles.push({center,size,yaw});
      ground.push(...box(add([p[0],.018,p[2]],rotateY([side*3.4,0,0],yaw)),[.7,.03,.28],side>0?theme.cyan:theme.gold,{yaw,emissive:true}));
    }
  }
  return {ground,faces,obstacles};});
}
const slalomStages=['辨认第一道门','横滚进入弯道','近景两侧掠过','减速进入留白'];
const slalomTimes=[0,2.1,4.7,9.8];
const slalom=candidate({...metadata,id:'camera-fpv-slalom',title:'贴近门框的穿梭绕飞',description:'沿六道真实门洞连续穿行，横滚跟随弯曲，近处门框和远处建筑产生不同视差。',
  usage:'适合从宏观结构进入内部空间，先识别门框，再加速；尾帧应停留或接下一镜，不自动跳回起点。',stages:slalomStages,stageTimes:slalomTimes,previewTime:5.2,
  recipe:['门洞和镜头读取同一条中心线；以净空约束限制轨迹。','转向前让视线提前指向下一弯，横滚克制且连续。','先通过近景，再让远景留下；用透视关系说明速度。']},(t,o)=>{
  const time=localTime(t),phase=time/DURATION,u=smooth(phase),distance=52*u,position=slalomPoint(distance);
  // Quintic recovery is flat through t=9.8, then reaches level with zero
  // angular velocity and acceleration at t=12. The centre line is unchanged.
  const target=slalomPoint(distance+4.2),bank=time===DURATION?0:.32*Math.sin(distance/29*TAU)*(.45+.55*o.intensity)*smooth((DURATION-time)/2.2);
  const camera={position,target,fov:65+7*Math.sin(Math.PI*u)**2*o.intensity,roll:bank,focusDistance:length3(sub(target,position)),principalPoint:[.5,.52]};
  const scene=slalomScene(o.theme),routeClearance=Math.min(position[1]-.22,...scene.obstacles.map(v=>clearanceToBox(position,v)));
  return {time,worldTime:time,phase,routeProgress:u,distance,camera,routeClearance,clearanceRadius:.22,stage:stageAt(time,slalomStages,slalomTimes),gateDistances:slalomGateDistances};
},(ctx,t,w,h,o,s)=>drawFlightFrame(ctx,w,h,o.theme,s,{title:'穿门，而不是绕着场景转',subtitle:'近景门框交代速度 · 远景建筑交代方向',detail:'看向下一个弯，再让机身跟上',scene:slalomScene(o.theme)}));

const diveRoute=u=>[3*Math.sin(Math.PI*u)*Math.sin(TAU*u),28-26*smooth((u-.04)/.56)+10*smooth((u-.62)/.38),12-56*u];
function diveScene(theme){
  return cachedWorld('dive',theme,()=>{
  const ground=floor(),faces=[],obstacles=[];
  for(let i=0;i<4;i++)for(const side of [-1,1]){
    const height=34-i*6.2,center=[side*(7.5+i*.25),height*.5,4-i*15],size=[3.1,height,4.3];
    faces.push(...architecture(center,size,{accent:side<0?theme.gold:theme.cyan}));obstacles.push({center,size});
    for(let y=3;y<height;y+=4)faces.push(...box([center[0]-side*1.57,y,center[2]],[.06,.15,3.7],side<0?theme.gold:theme.cyan,{emissive:true}));
  }
  for(const z of [-24,-35]){const g=gate([0,0,z],10.5,12,z===-24?theme.gold:theme.cyan,{thickness:.45});faces.push(...g.faces);obstacles.push(...g.obstacles);}
  for(const z of [-58,-76])for(const side of [-1,1]){
    const center=[side*10,8,z],size=[3.5,16,4];faces.push(...architecture(center,size,{accent:side>0?theme.gold:theme.cyan}));obstacles.push({center,size});
  }
  for(let z=15;z>=-60;z-=3.5){ground.push(...box([0,.025,z],[.1,.04,1.65],theme.gold,{emissive:true}));for(const side of [-1,1])ground.push(...box([side*4.8,.025,z],[1.1,.04,.16],theme.cyan,{emissive:true}));}
  return {ground,faces,obstacles};});
}
const diveStages=['高处建立落差','沿立面俯冲','提前抬头拉起','沿光带平稳离开'];
const diveTimes=[0,2.4,5.5,8.5];
const dive=candidate({...metadata,id:'camera-fpv-dive',title:'从高处俯冲，贴地前拉起',description:'镜头从28米高处掠过建筑立面，下降到2米后抬头离开；地面标线和楼层条带呈现真实透视。',
  usage:'适合空间尺度揭示和高潮推进。最低净空有数值检查；这是几何运镜，不能据此声称飞行器可完成。',stages:diveStages,stageTimes:diveTimes,previewTime:5.6,
  recipe:['先给观众可识别的高度刻度，再释放下降速度。','视线比机位先抬起；轨迹保持地面与门洞净空。','拉起后留出舒展段，避免连续无休止翻滚。']},(t,o)=>{
  const time=localTime(t),phase=time/12,u=smooth(phase),position=diveRoute(u);
  const course=ahead(diveRoute,u),release=.78*smooth((u-.62)/.2);
  const direction=unit([course[0]*(1-release),course[1]*(1-release)-.12*(1-smooth(u/.18)),course[2]*(1-release)-release]);
  const camera=pose(position,direction,{fov:64+10*Math.sin(Math.PI*u)**2*o.intensity,roll:.18*Math.sin(TAU*u)*(.4+.6*o.intensity),focus:9});
  const scene=diveScene(o.theme),routeClearance=Math.min(position[1]-.22,...scene.obstacles.map(v=>clearanceToBox(position,v)));
  return {time,worldTime:time,phase,routeProgress:u,camera,routeClearance,clearanceRadius:.22,groundClearance:position[1]-.22,stage:stageAt(time,diveStages,diveTimes)};
},(ctx,t,w,h,o,s)=>drawFlightFrame(ctx,w,h,o.theme,s,{title:'先让高度成立，再放开俯冲',subtitle:'立面擦过 → 地面接近 → 视线提前抬起',detail:'在碰到地面之前，观众已经看见出口',scene:diveScene(o.theme)}));

const eyeRoute=u=>[2.1*Math.sin(TAU*u),1.67+.012*Math.sin(32*u*TAU/1.6),9-32*u];
function firstPersonScene(theme){
  return cachedWorld('eyes',theme,()=>{
  const ground=floor({color:'#33474a',step:4}),faces=[],obstacles=[];
  for(let i=0;i<8;i++)for(const side of [-1,1]){
    const center=[side*5.1,2.45,10-i*5.5],size=[.58,4.9,.8];faces.push(...box(center,size,'#8e9d99'));obstacles.push({center,size});
    faces.push(...box([side*5.1,4.92,10-i*5.5],[.85,.15,4.8],'#b1b6a9'));
    const pedestal=[side*4.1,.47,7.5-i*5.5];faces.push(...box(pedestal,[1.1,.94,1.1],'#536c70'));
    const sculpture=[side*4.1,1.38,7.5-i*5.5];faces.push(...box(sculpture,[.55,.9,.55],i%2?theme.gold:theme.cyan,{yaw:i*.7}));
    obstacles.push({center:pedestal,size:[1.1,.94,1.1]},{center:sculpture,size:[.8,.9,.8]});
    ground.push(...box([side*3.1,.022,7.5-i*5.5],[.07,.04,3.8],side<0?theme.gold:theme.cyan,{emissive:true}));
  }
  for(const z of [6,-7,-20]){faces.push(...box([0,4.8,z],[10.5,.25,.38],'#a3afa9'));}
  faces.push(...cylinder([0,1.3,-29],.8,2.6,theme.gold));
  ground.push(...ring([0,.018,-29],2.2,.05,theme.cyan));
  return {ground,faces,obstacles};});
}
const eyeStages=['站在人的高度','目光先看到转弯','经过近处展台','把视线交给终点'];
const eyeTimes=[0,2.4,5.4,9];
const firstPerson=candidate({...metadata,id:'camera-first-person',title:'视线先行的第一人称',description:'保持约1.67米眼高，在展台之间前行。目光提前朝向转弯，微小起伏与横滚只提供身体尺度。',
  usage:'适合带观众进入机构或建筑；第一人称不等于把摇晃幅度调大。尾帧停住，直接接下一个观察对象。',stages:eyeStages,stageTimes:eyeTimes,previewTime:6,
  recipe:['把眼高与可识别的门柱、展台放在同一单位里。','目光提前转向，位移随后到达；高频起伏小于两厘米。','保留前景视差，避免用二维画面平移伪装行走。']},(t,o)=>{
  const time=localTime(t),phase=time/12,u=smooth(phase),position=eyeRoute(u);
  const tangent=unit([2.1*TAU*Math.cos(TAU*(u+.045)),0,-32]);
  const camera=pose(position,tangent,{fov:62,roll:(.022*Math.sin(TAU*u)+.006*Math.sin(TAU*8*u))*(.45+.55*o.intensity),focus:6});
  const scene=firstPersonScene(o.theme),routeClearance=Math.min(position[1]-.22,...scene.obstacles.map(v=>clearanceToBox(position,v)));
  return {time,worldTime:time,phase,routeProgress:u,camera,routeClearance,clearanceRadius:.22,eyeHeight:1.67,stage:stageAt(time,eyeStages,eyeTimes)};
},(ctx,t,w,h,o,s)=>drawFlightFrame(ctx,w,h,o.theme,s,{title:'让镜头像一个有目的的人',subtitle:'眼高固定 · 目光提前 · 身体随后进入',detail:'转弯的预告来自视线，速度感来自身边的展台',scene:firstPersonScene(o.theme)}));

const EYES=[0,1.68,0];
function robotFaces(theme,headAlpha,worldTime){
  const faces=[];
  const put=(c,size,color,opts={})=>faces.push(...box(c,size,color,opts));
  put([0,.87,0],[.54,.25,.34],'#344b54');put([0,1.23,0],[.62,.55,.36],'#6f878b');
  put([0,1.31,-.191],[.42,.28,.025],theme.cyan,{emissive:true});
  put([0,1.06,-.202],[.32,.045,.025],theme.gold,{emissive:true});
  for(const side of [-1,1]){
    put([side*.185,.46,0],[.21,.6,.25],'#779095');put([side*.185,.12,-.08],[.24,.18,.45],'#344b54');
    put([side*.44,1.37,0],[.21,.24,.3],theme.gold);
    put([side*.48,1.04,0],[.19,.47,.23],'#5d767e');put([side*.48,.76,-.025],[.16,.15,.2],'#a0afaa');
  }
  if(headAlpha>0){put([0,1.69,0],[.38,.37,.33],'#abb8b3',{alpha:headAlpha});put([0,1.7,-.172],[.31,.1,.025],'#244957',{alpha:headAlpha});put([0,1.71,-.187],[.22,.025,.012],theme.cyan,{alpha:headAlpha,emissive:true});}
  return faces;
}
function soulArchitecture(theme){return cachedWorld('soul',theme,()=>{
  const ground=floor(),faces=[],obstacles=[];
  ground.push(...ring([0,.016,0],2.7,.065,theme.gold),...ring([0,.017,0],8,.035,theme.cyan));
  ground.push(face([[-.7,.021,-.5],[-.7,.021,.8],[.9,.021,1.8],[1,.021,1.2]],'#07141a',{alpha:.7}));
  for(let i=0;i<12;i++){
    const angle=i*TAU/12,r=19,height=5+(i%4)*2.1,center=[r*Math.sin(angle),height*.5,r*Math.cos(angle)],yaw=angle;
    faces.push(...architecture(center,[2.8,height,2.2],{accent:i%2?theme.cyan:theme.gold,yaw}));obstacles.push({center,size:[2.8,height,2.2],yaw});
    const g=gate([11*Math.sin(angle),0,11*Math.cos(angle)],2.7,3.6,i%2?theme.cyan:theme.gold,{yaw:angle,thickness:.2});faces.push(...g.faces);obstacles.push(...g.obstacles);
  }
  // A recognizable forward portal connects the first-person start and return.
  const portal=gate([0,0,-16],7.5,5.6,theme.gold,{thickness:.4});faces.push(...portal.faces);obstacles.push(...portal.obstacles);
  for(let z=-3;z>-16;z-=1.1)ground.push(...box([0,.021,z],[.09,.04,.55],theme.gold,{emissive:true}));
  return {ground,faces,obstacles};});
}
function soulScene(theme,s){
  const world=soulArchitecture(theme);return {...world,faces:[...world.faces,...robotFaces(theme,s.headAlpha,s.worldTime)]};
}
const soulStages=['从人物眼睛出发','迅速抽离身体','放慢环绕同一主体','回到同一双眼睛'];
const soulTimes=[0,.75,2,9.45];
const soul=candidate({...metadata,id:'camera-soul-drift',loop:true,title:'从视线抽离，再回到身体',description:'起点严格等于人物眼睛。视点迅速后撤升高，绕原人物慢速运行一周，最后回到同一眼位与朝向。',
  usage:'适合由个人体验揭示外部系统。局部玩家头部在贴近眼位时隐藏，避免镜头被自己的头包围。',stages:soulStages,stageTimes:soulTimes,previewTime:3.3,
  recipe:['把主体眼位作为唯一进出锚点，不能先切成另一个模型。','抽离段短，外部观察段长；速度差比持续高速更有张力。','返回时位置、朝向、横滚和视角都回到原值。'],
  parameters:{...metadata.parameters,intensity:{min:0,max:1,default:.65,meaning:'Changes external bank and field of view, never moves the eye anchor'}}},(t,o)=>{
  const time=((t%12)+12)%12,phase=time/12;
  const expansion=smooth((time-.75)/1.15)*smooth((11.6-time)/2.15);
  const angle=TAU*cruiseProgress((time-2)/7.45),radius=12*expansion;
  const position=expansion===0?[...EYES]:[radius*Math.sin(angle),EYES[1]+expansion*(4.2+1.3*Math.sin(angle)),radius*Math.cos(angle)];
  const attention=smooth((time-.8)/1.1)*smooth((11.35-time)/1.7);
  const target=[0,EYES[1]-.25*attention,-12*(1-attention)];
  const camera={position,target,fov:64+8*expansion*o.intensity,roll:.075*Math.sin(angle)*expansion*o.intensity,focusDistance:length3(sub(target,position)),principalPoint:[.5,.52]};
  const routeClearance=Math.min(position[1]-.22,...soulArchitecture(o.theme).obstacles.map(v=>clearanceToBox(position,v)));
  return {time,worldTime:time,phase,routeProgress:phase,camera,eyeAnchor:[...EYES],eyeDistance:length3(sub(position,EYES)),headAlpha:smooth((radius-.45)/.8),routeClearance,clearanceRadius:.22,stage:stageAt(time,soulStages,soulTimes)};
},(ctx,t,w,h,o,s)=>drawFlightFrame(ctx,w,h,o.theme,s,{title:'先成为主角，再看见整个世界',subtitle:'同一眼位出发 · 短促抽离 · 舒展环绕 · 原位返回',detail:s.eyeDistance<.5?'这就是主角正在看的方向':'主角仍在原地，改变的是我们理解他的尺度',scene:soulScene(o.theme,s)}));

export const candidates=[slalom,dive,firstPerson,soul];
export const candidateById=Object.fromEntries(candidates.map(c=>[c.id,c]));
export const cameraFlightInternals={slalomPoint,slalomScene,diveRoute,diveScene,eyeRoute,firstPersonScene,soulScene,eyeAnchor:EYES};
