/** Original explanatory model. Units, layout and signal timing are illustrative. */
export const duration=24;
export const candidates=[
 {id:'metal',title:'金属 · 让高光说话',description:'缓慢转动同一封装，以宽窄反射、倒角和粗糙度区分铜、硅与介质。'},
 {id:'stack',title:'层级 · 拆开仍能对上',description:'先看整体，再沿装配轴分离；导通孔与每层中心保持同一坐标。'},
 {id:'route',title:'互连 · 从一端追到另一端',description:'剖开一角，让信号标记沿上层铜线、通孔、下层铜线连续行进。'},
];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
const s=x=>{x=clamp(x);return x*x*x*(x*(6*x-15)+10)};
export const packageVias=[[-.95,-.65],[.95,-.65],[-2,1],[0,1],[2,1]].map(([x,z])=>({x,z,copperRadius:.115,holeRadius:.155}));
export const cutawayVias=[[-.95,-.65,.1156],[.95,-.65,.1156],[-1.9,-1.3,.09],[0,-1.3,.09],[1.9,-1.3,.09]].map(([x,z,copperRadius])=>({x,z,copperRadius,holeRadius:.155}));
export const contactPlanes={boardTop:.08,glassBottom:.18,solderCenter:.13,solderRadius:.05};
export const routePoints=[[-2.55,.99,-.65],[-.95,.99,-.65],[-.95,.12,-.65],[.95,.12,-.65],[.95,.99,-.65],[2.55,.99,-.65]];
export function pointOnRoute(progress){
 const lengths=routePoints.slice(1).map((p,i)=>Math.hypot(...p.map((v,k)=>v-routePoints[i][k]))),total=lengths.reduce((a,b)=>a+b,0);let d=clamp(progress)*total;
 for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1){const u=clamp(d/lengths[i]);return {position:routePoints[i].map((v,k)=>mix(v,routePoints[i+1][k],u)),segment:i,progress:clamp(progress),distance:clamp(progress)*total};}d-=lengths[i];}
}
export function sample(time,{id='metal',roughness=.27,orbit=0}={}){
 if(!Number.isFinite(time))throw new TypeError('time must be finite');if(!candidates.some(c=>c.id===id))throw new RangeError('unknown candidate');
 if(!Number.isFinite(roughness)||!Number.isFinite(orbit))throw new TypeError('finite controls required');
 const t=clamp(time,0,duration),cameraTime=id==='stack'?(t<8?t:t<18?8:t-10):t,u=s(cameraTime/(id==='stack'?14:duration)),theta=mix(.64,1.24,u)+orbit;
 const separation=id==='stack'?s((t-3)/5)*(1-s((t-18)/5)):0;
 let focus,caption,phase;
 if(id==='metal'){phase=t<7?'01 · 先读轮廓':t<16?'02 · 反射经过表面':'03 · 看见材料差别';caption=t<7?'先让倒角接住光':t<16?'同一束光，经过不同表面':'金属反射环境，介质保留自己的颜色';focus='die';}
 else if(id==='stack'){phase=t<3?'01 · 先看整体':t<8?'02 · 沿装配轴拆开':t<18?'03 · 对齐观察':'04 · 沿原路装回';caption=t<8?'结构分开，位置关系还在':t<18?'玻璃芯、布线层与芯片，各有一层位置':'沿原来的轴回到装配状态';focus='glass';}
 else {phase=t<5?'01 · 看清通路':t<19?'02 · 沿导体追踪':'03 · 到达另一端';caption=t<5?'铜负责连接，玻璃负责隔开':t<19?'上层 → 通孔 → 下层 → 通孔 → 上层':'路径连通之后，再看整体';focus='via';}
 const target=id==='stack'?[0,1.2+separation*1.1,0]:id==='route'?[0,.64,-.3]:[0,.65,0];
 const radius=id==='stack'?mix(10.2,12,separation):id==='route'?7.48:9.7;
 const camera={position:[Math.sin(theta)*radius,target[1]+(id==='stack'?5.3:id==='route'?3.91:5.8),Math.cos(theta)*radius],target,fov:id==='route'?37:38,near:.1,far:80};
 if(id==='route'){const a=mix(.25,.55,u)+orbit;camera.position=[Math.sin(a)*radius,3.1,Math.cos(a)*radius-.8];camera.target=[0,.53,-.8];}
 if(id==='metal'){const macro=s((t-3)/5)*(1-s((t-17)/6)),slide=s((t-8)/9);const close=[4.2+orbit*.7,2.35,3.1-slide*.9];camera.position=camera.position.map((v,k)=>mix(v,close[k],macro));camera.target=camera.target.map((v,k)=>mix(v,[1.9,1.02,.55-slide*.55][k],macro));camera.fov=mix(38,42,macro);}
 const groups={base:0,glass:separation*.8,redistribution:separation*1.75,chips:separation*3.0};
 const labels=id==='route'?[{id:'copper',text:'铜互连',anchor:[-2.0,1.04,-.65]},{id:'via',text:'TGV 通孔',anchor:[.95,.57,-.52]},{id:'glass',text:'玻璃芯',anchor:[2.5,.63,-.67]}]:id==='stack'?[{id:'chips',text:'芯片',anchor:[1.45,1.43+groups.chips,0]},{id:'rdl',text:'布线层',anchor:[2.4,1.0+groups.redistribution,.7]},{id:'glass',text:'玻璃芯',anchor:[2.8,.67+groups.glass,0]},{id:'base',text:'连接焊点',anchor:[2.25,.14,1.5]}]:[{id:'die',text:'硅芯片',anchor:[.8,1.44,0]},{id:'copper',text:'铜互连',anchor:[1.8,1.06,1.2]}];
 const pulseProgress=s((t-5)/14),pulse=pointOnRoute(pulseProgress);
 return {id,time:t,phase,caption,focus,camera,separation,groups,roughness:clamp(roughness,.12,.68),labels,pulse:{...pulse,visible:id==='route'&&t>=5&&t<=22,opacity:s((t-5)/.6)*(1-s((t-21)/1)),semantic:'信号传播位置标记（示意，非电子漂移速度）'},reading:id==='stack'&&t>=8&&t<=18,units:'illustrative'};
}
