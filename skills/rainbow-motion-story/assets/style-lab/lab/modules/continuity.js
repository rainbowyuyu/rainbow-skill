/** Original continuity studies, informed by reviewed reference frames.
 * This is an illustrative inspection model, not an actual vehicle or flight solver.
 * All geometry, light and timing are functions of absolute time; arbitrary seek is safe.
 */
import {candidate, clamp, smooth, mix, begin, end, text, line, path, circle} from './common.js';
import {add, sub, mul, rotateY, face, box, cylinder, ring, viewFor, renderScene} from './camera-flight-common.js';

export const DURATION = 12;
export const VEHICLE_ID = 'inspection-probe-01';
export const NOZZLE_MOUNTS = Object.freeze([
    Object.freeze({id:'nozzle-front-left', local:Object.freeze([-1.36,-.20,.67])}),
    Object.freeze({id:'nozzle-front-right',local:Object.freeze([1.36,-.20,.67])}),
    Object.freeze({id:'nozzle-rear-left',local:Object.freeze([-1.36,-.20,-.67])}),
    Object.freeze({id:'nozzle-rear-right',local:Object.freeze([1.36,-.20,-.67])})
]);
const LIGHT = [-.4,.8,.3];
const time = t => clamp(Number.isFinite(t)?t:0,0,DURATION);
const progress = (t,a,b) => smooth((t-a)/(b-a));
const pulse = (t,a,b,c,d) => progress(t,a,b)*(1-progress(t,c,d));
const copy = p=>[...p];
const norm = p=>Math.hypot(...p);
const CAMERA_HOME = {position:[7.4,5.0,10.1],target:[0,2.35,0],fov:43,roll:0};
const CAMERA_LOW = {position:[7.8,1.05,10.3],target:[0,2.35,0],fov:43,roll:0};
const FORMULA_CAMERA={position:[5.8,3.5,11.5],target:[0,2.25,0],fov:39,roll:0};
const FORMULA_BASELINE=468;

/** Parent transform: roll in the local XY plane, then yaw, then translation. */
export function vehicleToWorld(local,vehicle) {
    const c=Math.cos(vehicle.roll),s=Math.sin(vehicle.roll);
    return add(vehicle.position,rotateY([local[0]*c-local[1]*s,local[0]*s+local[1]*c,local[2]],vehicle.yaw));
}
function cameraBetween(a,b,q) {
    const position=a.position.map((v,i)=>mix(v,b.position[i],q)), target=a.target.map((v,i)=>mix(v,b.target[i],q));
    return {position,target,fov:mix(a.fov,b.fov,q),roll:0,near:.12,focusDistance:norm(sub(position,target))};
}
export function shadowPoint(point) {
    const y=.014;
    return [point[0]-(point[1]-y)*LIGHT[0]/LIGHT[1],y,point[2]-(point[1]-y)*LIGHT[2]/LIGHT[1]];
}
export function projectContinuityPoint(point,camera,offsetX=0) {
    const p=viewFor(camera).point(point);
    return {point:p.point?[p.point[0]+offsetX,p.point[1]]:null,depth:p.depth};
}
function nozzlesFor(vehicle) {
    return NOZZLE_MOUNTS.map(n=>({id:n.id,parentId:vehicle.id,local:copy(n.local),world:vehicleToWorld(n.local,vehicle),
        exit:vehicleToWorld(add(n.local,[0,-.47,0]),vehicle),direction:sub(vehicleToWorld(add(n.local,[0,-1,0]),vehicle),vehicleToWorld(n.local,vehicle))}));
}

export function sampleShellToForce(input) {
    const t=time(input),open=pulse(t,1.25,3.15,9.35,11.45), inspect=pulse(t,3.25,4.75,9.25,10.85);
    const vehicle={id:VEHICLE_ID,position:[0,2.35,0],yaw:-.08,roll:0};
    const camera=cameraBetween(CAMERA_HOME,CAMERA_LOW,inspect);
    const exhaust=pulse(t,5.1,5.8,8.75,9.3), force=pulse(t,5.9,6.45,8.8,9.25);
    const shells=[
        {id:'shell-port',local:[0,.10,.82],offset:[0,open*.73,open*1.4]},
        {id:'shell-starboard',local:[0,.10,-.82],offset:[0,open*.73,-open*1.4]},
        {id:'shell-canopy',local:[-.35,.43,0],offset:[0,open*1.37,0]}
    ].map(p=>({...p,parentId:vehicle.id,world:vehicleToWorld(add(p.local,p.offset),vehicle)}));
    const nozzles=nozzlesFor(vehicle);
    const labelAlpha=pulse(t,4.85,5.25,8.75,9.15), anchor=projectContinuityPoint(nozzles[1].exit,camera).point;
    const label={id:'nozzle-force-label',anchor,position:[1180,610],elbow:[1130,anchor[1]],alpha:labelAlpha,
        text:force>.1?'气体向下，反作用力向上':'四个喷口，始终连着底盘'};
    const stage=t<1.25?'先认出同一主体':t<3.25?'外壳让出观察位置':t<5.1?'镜头降到作用点':t<9.35?'看清喷口与力的方向':'回到完整轮廓';
    return {time:t,phase:t/DURATION,stage,evidence:'illustrative',vehicle,nozzles,shells,camera,open,inspect,exhaust,force,label,
        readWindow:t>=6.5&&t<=8.7,lightDirection:copy(LIGHT),groundY:0,
        shadows:[{id:'chassis-shadow',sourceId:vehicle.id,center:shadowPoint(vehicle.position)},...shells.map(p=>({id:`${p.id}-shadow`,sourceId:p.id,center:shadowPoint(p.world)}))]};
}

// Convex component shadows are projected from their real vertices onto one ground plane.
// This is a deterministic planar shadow approximation, not ray tracing.
function hullXZ(points) {
    const p=[...new Map(points.map(a=>[`${a[0].toFixed(8)},${a[2].toFixed(8)}`,a])).values()].sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
    if(p.length<3)return p;
    const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
    const lower=[],upper=[];
    for(const a of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),a)<=0)lower.pop();lower.push(a);}
    for(const a of p.reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),a)<=0)upper.pop();upper.push(a);}
    return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
function transformFaces(faces,vehicle) {return faces.map(f=>({...f,points:f.points.map(p=>vehicleToWorld(p,vehicle))}));}
function tube(center,rings,color,segments=24) {
    const out=[];
    for(let j=1;j<rings.length;j++)for(let i=0;i<segments;i++){
        const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
        const point=(r,k)=>add(center,[Math.cos(k)*r[1],r[0],Math.sin(k)*r[1]]);
        out.push(face([point(rings[j-1],a),point(rings[j-1],b),point(rings[j],b),point(rings[j],a)],color,{cull:false}));
    }return out;
}
function longitudinalHull(center,sections,color) {
    const faces=[];
    const ringAt=([x,halfWidth,bottom,top])=>[[x,bottom,-halfWidth],[x,bottom,halfWidth],[x,top,halfWidth*.78],[x,top,-halfWidth*.78]].map(p=>add(center,p));
    const loops=sections.map(ringAt);
    for(let j=1;j<loops.length;j++)for(let i=0;i<4;i++)faces.push(face([loops[j-1][i],loops[j-1][(i+1)%4],loops[j][(i+1)%4],loops[j][i]],color));
    faces.push(face([...loops[0]].reverse(),color),face(loops.at(-1),color));return faces;
}
function arrow3(base,tip,color,radius=.033) {
    // Vertical arrows use a stem and a broad head, both in the same depth queue.
    const up=Math.sign(tip[1]-base[1]),length=Math.abs(tip[1]-base[1]),head=Math.min(.21,length*.30);
    return [...cylinder([base[0],(base[1]+tip[1]-up*head)/2,base[2]],radius,Math.max(.01,length-head),color,{segments:12}),
        ...tube(tip,[[-up*head,radius*3.6],[0,.002]],color,16)].map(f=>({...f,emissive:true}));
}
export function buildVehicleGeometry(s,theme,{closed=false,showForces=true}={}) {
    const p=theme,vehicle=s.vehicle,groups=[];
    function group(id,faces,shadow=true) {groups.push({id,faces:transformFaces(faces,vehicle),shadow});}
    group('chassis',longitudinalHull([0,0,0],[[-2.1,.49,-.21,.02],[-1.55,.81,-.26,.13],[1.45,.81,-.26,.13],[2.15,.47,-.15,.02]],p.muted));
    group('spine',box([0,.15,0],[3.4,.22,.34],p.gold));
    group('battery',box([-.1,.14,0],[1.08,.48,.71],p.line));
    group('cap',box([-.1,.395,0],[.95,.035,.59],p.cyan));
    for(const n of NOZZLE_MOUNTS){
        const parts=[...cylinder(n.local,.22,.20,p.muted),
            ...tube(n.local,[[0,.18],[-.20,.12],[-.45,.25],[-.49,.25]],p.gold),
            ...tube(n.local,[[-.49,.25],[-.49,.20],[-.41,.18]],p.ink),
            ...cylinder(add(n.local,[0,-.405,0]),.17,.025,p.bg)];
        group(n.id,parts);
        group(`${n.id}-brace`,box(add(n.local,[0,.18,0]),[.17,.39,.17],p.muted));
        if(showForces&&s.exhaust>.001){
            const exit=add(n.local,[0,-.49,0]);
            for(let j=0;j<7;j++){
                const a=j/7,b=(j+1)/7, r0=.16+.17*a,r1=.16+.17*b;
                const length=.75*s.exhaust;
                const plume=tube(exit,[[-a*length,r0],[-b*length,r1]],p.cyan,18).map(f=>({...f,alpha:(1-a)*.12*s.exhaust,emissive:true}));
                group(`${n.id}-plume-${j}`,plume,false);
            }
        }
    }
    const shells=closed?[{id:'shell-port',local:[0,.10,.82],offset:[0,0,0]},{id:'shell-starboard',local:[0,.10,-.82],offset:[0,0,0]},{id:'shell-canopy',local:[-.35,.43,0],offset:[0,0,0]}]:s.shells;
    for(const shell of shells){
        const center=add(shell.local,shell.offset);
        if(shell.id==='shell-canopy'){
            group(shell.id,longitudinalHull(center,[[-1.07,.38,-.10,.05],[-.57,.58,-.10,.38],[.50,.51,-.10,.25],[1.05,.29,-.10,-.01]],p.line));
            group(`${shell.id}-glass`,longitudinalHull(add(center,[0,.018,0]),[[-.70,.39,.19,.20],[-.50,.47,.35,.36],[.46,.39,.23,.24]],p.cyan),false);
        }else{
            group(shell.id,longitudinalHull(center,[[-2.13,.10,-.20,-.06],[-1.5,.21,-.20,.26],[1.5,.21,-.20,.26],[2.17,.10,-.14,-.02]],p.ink));
            group(`${shell.id}-stripe`,box(add(center,[.05,.266,0]),[2.9,.028,.12],p.gold),false);
        }
    }
    if(showForces&&s.force>.001){
        // A front nozzle is the readable representative. The arrow ends at its exit.
        const n=NOZZLE_MOUNTS[1],tip=add(n.local,[.36,-.49,0]);
        group('reaction-force',arrow3(add(tip,[0,-.78*s.force,0]),tip,p.gold).map(f=>({...f,alpha:s.force})),false);
    }
    const ground=[face([[-12,0,-12],[-12,0,12],[12,0,12],[12,0,-12]],p.bg)];
    for(const g of groups.filter(g=>g.shadow)){
        const points=hullXZ(g.faces.flatMap(f=>f.points).map(shadowPoint));
        if(points.length>2)ground.push(face(points,'#02080e',{alpha:.12,emissive:true}));
    }
    ground.push(...ring([0,.018,0],3.8,.018,p.line,{alpha:.35}),...ring([0,.018,0],3.87,.009,p.line,{alpha:.18}));
    return {ground,faces:groups.flatMap(g=>g.faces),groups};
}

function footer(ctx,s,p,copyText) {
    text(ctx,copyText,74,774,25,p.ink,600);
    text(ctx,'教学模型 · 参数为归一化示意',74,818,19,p.muted);
    text(ctx,s.stage,1525,818,20,p.gold,600,'right');
    line(ctx,[74,860],[1525,860],p.line,2);line(ctx,[74,860],[74+1451*s.phase,860],p.gold,3);
}
function drawNozzleLabel(ctx,s,p) {
    const l=s.label;if(l.alpha<=0||!l.anchor)return;
    ctx.save();ctx.globalAlpha=l.alpha;
    path(ctx,[l.anchor,l.elbow,[1148,l.position[1]-9]],p.gold,1.5);
    circle(ctx,l.anchor[0],l.anchor[1],5,p.bg,p.gold,2);
    text(ctx,l.text,l.position[0]-10,l.position[1],23,p.ink,650);
    if(s.force>.1)text(ctx,'同一喷口 · 同一作用点',l.position[0]-10,l.position[1]+36,19,p.muted);
    ctx.restore();
}
export const shellToForce=candidate({
    id:'continuity-shell-to-force',module:'mechanics',title:'沿着同一主体，看见力从哪里来',duration:DURATION,loop:false,
    codeFile:'./modules/continuity.js',referenceIds:['car-ignition'],previewTime:7.2,stageTimes:[0,1.25,3.25,5.1,9.35],
    description:'完整外形、连续拆壳、低机位看喷口、建立力的方向，最后回到同一外形；四个喷口始终刚性连接底盘。',
    usage:'适合先认物体，再解释内部作用点的段落；替换为真实资产前应保留父子坐标和装配约束。',
    stages:['完整外形','连续拆壳','降低观察高度','作用点读数','回到外形'],
    recipe:['外壳沿固定局部轨迹离开，底盘与四喷口保持同一父变换。','拆开后才降低镜头；作用点稳定后才出现标注。','所有不透明面进入统一深度队列；影子由实际顶点投向固定地面。','6.5–8.7 秒停住机位与机构，读方向；这是教学示意，不是汽车实测结构。']
},sampleShellToForce,(ctx,t,w,h,o,s)=>{
    const p=o.theme;begin(ctx,w,h,{title:'外壳让开，力的来处才看得见',subtitle:'同一载具 → 四个喷口 → 同一作用点',palette:p});
    ctx.save();ctx.beginPath();ctx.rect(58,155,1484,555);ctx.clip();renderScene(ctx,s.camera,buildVehicleGeometry(s,p));ctx.restore();
    drawNozzleLabel(ctx,s,p);
    footer(ctx,s,p,s.time<5.1?'不换模型，沿着它看进去。':s.time<9.35?'喷口向下排气，反作用力向上托住主体。':'看过作用点，再认回完整外形。');end(ctx);
});

function bezier(a,b,c,d,q) {const z=1-q;return a.map((v,i)=>z**3*v+3*z*z*q*b[i]+3*z*q*q*c[i]+q**3*d[i]);}
export function sampleQuantityToTerm(input) {
    const t=time(input),v=mix(.3,.9,progress(t,1.2,2.75)),theta=mix(.1,.7,progress(t,5.25,6.8));
    const velocityHandoff=progress(t,3.15,4.15),angleHandoff=progress(t,7.2,8.3);
    const weights={velocity:.6,angle:.4},terms={velocity:weights.velocity*v*v,angle:weights.angle*theta*theta};
    const vehicle={id:VEHICLE_ID,position:[0,2.35,0],yaw:0,roll:theta*.54};
    const camera=cameraBetween(FORMULA_CAMERA,FORMULA_CAMERA,0),offsetX=-325;
    const sourceV=[710,280],targetV=[1154,365],sourceTheta=[800,650],targetTheta=[1396,365];
    const velocityLabel={id:'quantity-v',source:sourceV,target:targetV,position:bezier(sourceV,[880,260],[980,365],targetV,velocityHandoff),handoff:velocityHandoff,
        alpha:progress(t,.5,.9),width:160,height:34};
    // The angle takes the empty corridor above the formula. It never crosses its baseline
    // or the already-settled v label; the broad curve still has zero endpoint velocity.
    const angleLabel={id:'quantity-theta',source:sourceTheta,target:targetTheta,position:bezier(sourceTheta,[760,100],[1396,150],targetTheta,angleHandoff),handoff:angleHandoff,
        alpha:progress(t,5.05,5.25),width:168,height:34};
    const velocityArrow={base:vehicleToWorld([-2.45,.20,.6],vehicle),tip:null};
    velocityArrow.tip=add(velocityArrow.base,[0,-(.3+v*.95),0]);
    const angleAnchor=vehicleToWorld([2.15,.02,0],vehicle);
    const vScreen=projectContinuityPoint(velocityArrow.base,camera,offsetX).point;
    const thetaScreen=projectContinuityPoint(angleAnchor,camera,offsetX).point;
    return {time:t,phase:t/DURATION,evidence:'fixed-teaching-example',vehicle,nozzles:nozzlesFor(vehicle),camera,offsetX,
        shells:[],exhaust:0,force:0,v,theta,thetaRadians:vehicle.roll,weights,terms,J:terms.velocity+terms.angle,
        velocityArrow,angleAnchor,labels:{velocity:velocityLabel,angle:angleLabel},
        connectors:{velocity:{from:vScreen,to:sourceV,points:[vScreen,[vScreen[0],272],[625,272]],alpha:(1-velocityHandoff)*velocityLabel.alpha},
            angle:{from:thetaScreen,to:sourceTheta,points:[thetaScreen,[830,thetaScreen[1]],[830,610]],alpha:(1-angleHandoff)*angleLabel.alpha}},
        formula:{baseline:FORMULA_BASELINE,positions:{J:[955,FORMULA_BASELINE],velocity:[1090,FORMULA_BASELINE],plus:[1260,FORMULA_BASELINE],angle:[1318,FORMULA_BASELINE]},
            highlight:{velocity:progress(t,4.15,4.4),angle:progress(t,8.3,8.55)}},
        readWindow:(t>=4.4&&t<=5.05)||t>=8.6,
        stage:t<1.2?'建立两个量':t<3.15?'先改变速度':t<5.25?'速度接到第一项':t<7.2?'再改变倾角':t<8.6?'倾角接到第二项':'完整读懂这一式'};
}
function drawQuantityLabel(ctx,label,value,color) {
    if(label.alpha<.001)return;ctx.save();ctx.globalAlpha=label.alpha;
    text(ctx,value,...label.position,25,color,700,'center');ctx.restore();
}
export const quantityToTerm=candidate({
    id:'continuity-quantity-to-term',module:'visualization',title:'把实体的量，交到公式对应项',duration:DURATION,loop:false,
    codeFile:'./modules/continuity.js',referenceIds:['car-ignition'],previewTime:9,stageTimes:[0,1.2,3.15,5.25,7.2,8.6],
    description:'先用箭头呈现速度，再让速度标签落到第一项；停住读数后才改变实体倾角，接到第二项。公式基线固定。',
    usage:'适合讲代价、能量、误差或损失函数。每个量使用同一颜色和同一数据，逐项建立含义。',
    stages:['建立量','速度变化','第一项读数','倾角变化','第二项读数','合并理解'],
    recipe:['v 与 θ 是归一化教学参数；箭头编码速度读数，载具保持观察姿态，不声称求解飞行。','一次只改变一个参数，标签继承实体颜色；公式保持固定位置。','标签沿空白通道交接，倾角绕过已到位的速度标签和公式；连接线只在原位出现。','J = 0.6 v² + 0.4 θ² 的显示数值与样本使用同一算式。']
},sampleQuantityToTerm,(ctx,t,w,h,o,s)=>{
    const p=o.theme;begin(ctx,w,h,{title:'先看到变化，再读懂这一项',subtitle:'实体上的量 → 同一标签 → 对应公式项',palette:p});
    ctx.save();ctx.beginPath();ctx.rect(65,165,830,550);ctx.clip();ctx.translate(s.offsetX,0);
    const scene=buildVehicleGeometry(s,p,{closed:true,showForces:false});
    scene.faces.push(...arrow3(s.velocityArrow.base,s.velocityArrow.tip,p.cyan,.037));renderScene(ctx,s.camera,scene);ctx.restore();
    // Compact leaders stay in separate upper/lower lanes and vanish before label travel.
    for(const [key,color] of [['velocity',p.cyan],['angle',p.gold]]){
        const c=s.connectors[key];if(c.alpha>.001&&c.from){ctx.save();ctx.globalAlpha=c.alpha;
            path(ctx,c.points,color,1.5);circle(ctx,...c.from,4,p.bg,color,1.5);ctx.restore();}
    }
    // One small angle arc follows the actual body rotation; its baseline stays horizontal.
    const center=projectContinuityPoint(s.vehicle.position,s.camera,s.offsetX).point;
    ctx.save();ctx.globalAlpha=progress(s.time,5.05,5.25);
    line(ctx,[center[0],center[1]+190],[center[0]+135,center[1]+190],p.line,1.5);
    const a=s.thetaRadians;path(ctx,Array.from({length:25},(_,i)=>[center[0]+82*Math.cos(a*i/24),center[1]+190-82*Math.sin(a*i/24)]),p.gold,2);
    line(ctx,[center[0],center[1]+190],[center[0]+135*Math.cos(a),center[1]+190-135*Math.sin(a)],p.gold,1.8);ctx.restore();
    const f=s.formula.positions,hv=s.formula.highlight.velocity,ha=s.formula.highlight.angle;
    text(ctx,'J =',...f.J,46,p.ink,600);text(ctx,'wᵥ v²',...f.velocity,46,hv>0?p.cyan:p.muted,600);
    text(ctx,'+',...f.plus,40,p.muted,400);text(ctx,'wθ θ²',...f.angle,46,ha>0?p.gold:p.muted,600);
    if(hv>0){ctx.save();ctx.globalAlpha=hv;line(ctx,[1091,487],[1221,487],p.cyan,3);text(ctx,s.terms.velocity.toFixed(3),1155,534,27,p.cyan,650,'center');ctx.restore();}
    if(ha>0){ctx.save();ctx.globalAlpha=ha;line(ctx,[1319,487],[1472,487],p.gold,3);text(ctx,s.terms.angle.toFixed(3),1396,534,27,p.gold,650,'center');ctx.restore();}
    drawQuantityLabel(ctx,s.labels.velocity,`v = ${s.v.toFixed(2)}`,p.cyan);drawQuantityLabel(ctx,s.labels.angle,`θ = ${s.theta.toFixed(2)}`,p.gold);
    ctx.save();ctx.globalAlpha=progress(s.time,8.55,9.0);text(ctx,`J = ${s.J.toFixed(3)}`,1240,625,36,p.ink,700,'center');text(ctx,'两项相加，衡量这个姿态',1240,668,20,p.muted,500,'center');ctx.restore();
    footer(ctx,s,p,s.time<5.25?'箭头变长 → 速度值变大 → 第一项增加。':s.time<8.6?'机体倾斜 → 倾角值变大 → 第二项增加。':'速度与倾角，终于和公式一一对应。');
    text(ctx,'wᵥ = 0.6  ·  wθ = 0.4',1525,774,21,p.muted,500,'right');end(ctx);
});

export const candidates=[shellToForce,quantityToTerm];
