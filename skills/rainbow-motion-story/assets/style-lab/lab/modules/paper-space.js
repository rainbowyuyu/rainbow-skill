/** Original paper-space study. Fixed UV topology, analytic developable bend.
 * Material and contact shadows are deterministic Canvas approximations, not cloth or ray tracing.
 */
import {candidate,clamp,smooth,mix,text,line,path,circle} from './common.js';
import {add,sub,mul,dot3,cross3,unit,viewFor} from './camera-flight-common.js';

export const PAPER_DURATION=13;
export const PAPER_ID='porcelain-sheet-01';
export const GRID={columns:32,rows:20,width:6.4,depth:4.2};
export const LIGHT_DIRECTION=unit([-.55,1,.35]);
export const PAPER_PALETTE={background:'#e8ece9',paper:'#f8f4e9',ink:'#183b4a',muted:'#637e86',grid:'#7fa5ad',accent:'#be8053'};
const WIDTH=1600,HEIGHT=900;
const time=t=>clamp(Number.isFinite(t)?t:0,0,PAPER_DURATION);
const progress=(t,a,b)=>smooth((t-a)/(b-a));
const safeSinc=x=>Math.abs(x)<1e-4?1-x*x/6+x**4/120:Math.sin(x)/x;
const safeCosc=x=>Math.abs(x)<1e-4?x/2-x**3/24+x**5/720:(1-Math.cos(x))/x;
const copy=p=>[...p];
const lerp3=(a,b,q)=>a.map((v,i)=>mix(v,b[i],q));
const length=p=>Math.hypot(...p);
const rotateY=(p,a)=>[p[0]*Math.cos(a)+p[2]*Math.sin(a),p[1],-p[0]*Math.sin(a)+p[2]*Math.cos(a)];
export const TOPOLOGY=Object.freeze(Array.from({length:GRID.rows},(_,j)=>Array.from({length:GRID.columns},(_,i)=>{
    const a=j*(GRID.columns+1)+i,b=a+1,c=a+GRID.columns+2,d=a+GRID.columns+1;
    return [Object.freeze({id:`face-${i}-${j}-a`,vertices:Object.freeze([a,d,b])}),Object.freeze({id:`face-${i}-${j}-b`,vertices:Object.freeze([b,d,c])})];})).flat(2));
const CARD_SPECS=Object.freeze([
    {id:'card-orbit',origin:[-1.94,.045,-.80],target:[-4.4,.045,-.50],start:1.05,end:2.55,yaw:-.12,pattern:'orbit'},
    {id:'card-horizon',origin:[1.65,.045,-.80],target:[4.4,.045,-.55],start:1.42,end:2.92,yaw:.10,pattern:'horizon'},
    {id:'card-tide',origin:[.05,.045,1.02],target:[.15,.045,-3.45],start:1.79,end:3.29,yaw:-.05,pattern:'tide'}
]);
const parentToWorld=(p,parent)=>add(parent.position,rotateY(p,parent.yaw));

/** Arc-length-preserving cylindrical bend of an initially flat rectangle.
 * u/v are UV coordinates; theta is the total cross-sheet bend, in radians.
 * The bottom generatrix stays at local y=0. No vertex reindexing or random wrinkle.
 */
export function surfacePoint(u,v,theta) {
    const x=(u-.5)*GRID.width,a=(u-.5)*theta;
    return [x*safeSinc(a),x*safeCosc(a),(v-.5)*GRID.depth];
}
export function surfaceNormal(u,theta) {const a=(u-.5)*theta;return [-Math.sin(a),Math.cos(a),0];}
export function shadowProjection(point,receiverY=.014) {
    const h=point[1]-receiverY;
    return [point[0]-h*LIGHT_DIRECTION[0]/LIGHT_DIRECTION[1],receiverY,point[2]-h*LIGHT_DIRECTION[2]/LIGHT_DIRECTION[1]];
}
export function samplePaperSpace(input) {
    const t=time(input),bend=1.8*progress(t,3.5,6.2)+2.7*progress(t,7.15,9.6);
    const parent={id:PAPER_ID,position:[0,.10,0],yaw:.08};
    const vertices=[];
    for(let j=0;j<=GRID.rows;j++)for(let i=0;i<=GRID.columns;i++){
        const uv=[i/GRID.columns,j/GRID.rows],local=surfacePoint(...uv,bend),world=parentToWorld(local,parent),normal=rotateY(surfaceNormal(uv[0],bend),parent.yaw);
        vertices.push({id:`vertex-${i}-${j}`,index:vertices.length,parentId:PAPER_ID,uv,local,world,normal,shadow:shadowProjection(world)});
    }
    const cards=CARD_SPECS.map(spec=>{
        const q=progress(t,spec.start,spec.end),travel=progress(t,spec.start+.23,spec.end-.13);
        // Lift -> slide -> settle. The bump has zero endpoint velocity and acceleration.
        const lift=.54*64*q**3*(1-q)**3;
        const local=add(lerp3(spec.origin,spec.target,travel),[0,lift,0]),yaw=spec.yaw*(1-travel)+spec.yaw*.3*travel;
        const localCorners=[[-.58,0,-.42],[.58,0,-.42],[.58,0,.42],[-.58,0,.42]].map(p=>add(local,rotateY(p,yaw)));
        return {...spec,parentId:PAPER_ID,progress:q,travel,lift,local,yaw,world:parentToWorld(local,parent),corners:localCorners.map(p=>parentToWorld(p,parent))};
    });
    const orbit=.42*progress(t,3.5,6.2)+.58*progress(t,7.15,9.6),angle=mix(.42,-.63,orbit),radius=mix(12.1,11.7,orbit),cameraHeight=mix(8.0,5.7,orbit);
    const target=[0,mix(.45,1.05,orbit),0],position=[Math.sin(angle)*radius,cameraHeight,Math.cos(angle)*radius];
    const camera={position,target,fov:42,roll:0,near:.12,focusDistance:length(sub(position,target))};
    const stage=t<1.05?'在纸面上建立关系':t<3.5?'小卡片依次让位':t<6.2?'平面先弯成曲面':t<7.15?'停一下，看清这道弯':t<9.6?'绕到空间另一侧':'还是这张纸，同一套坐标';
    return {time:t,duration:PAPER_DURATION,phase:t/PAPER_DURATION,evidence:'illustrative',parent,vertices,topology:TOPOLOGY,cards,bend,
        camera,orbit,stage,axisAlpha:progress(t,9.7,10.4),reading:(t>=6.2&&t<=7.15)||t>=10.4,
        cardClear:t>=3.29,light:copy(LIGHT_DIRECTION),fixedAnchor:parentToWorld([0,0,0],parent)};
}

// Procedural material is cached per drawing context; no time-based texture state exists.
const materialCache=new WeakMap();
function canvas(width,height) {
    if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(width,height);
    const c=document.createElement('canvas');c.width=width;c.height=height;return c;
}
function seeded(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function paperTexture({back=false,pattern=null}={}) {
    const w=1024,h=672,c=canvas(w,h),ctx=c.getContext('2d'),rng=seeded(pattern?3271:14731);
    const base=ctx.createLinearGradient(0,0,w,h);base.addColorStop(0,'#fcf9ef');base.addColorStop(.45,'#f3efe3');base.addColorStop(1,'#e8e5da');ctx.fillStyle=base;ctx.fillRect(0,0,w,h);
    // Fine fibres are fixed in UV coordinates, rather than screen-space noise.
    for(let i=0;i<6500;i++){
        const x=rng()*w,y=rng()*h,span=.5+rng()*2.8;ctx.strokeStyle=i%2?'#73847d10':'#ffffff24';ctx.lineWidth=.35+rng()*.45;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+span,y+(rng()-.5)*.65);ctx.stroke();
    }
    ctx.strokeStyle='#bcbfb352';ctx.lineWidth=3;ctx.strokeRect(2,2,w-4,h-4);
    if(!pattern){
        ctx.globalAlpha=back?.45:1;
        for(let i=0;i<=16;i++){ctx.strokeStyle=i%4===0?'#7e9ea48c':'#9eb4b65c';ctx.lineWidth=i%4===0?2.0:1.2;ctx.beginPath();ctx.moveTo(i*w/16,0);ctx.lineTo(i*w/16,h);ctx.stroke();}
        for(let j=0;j<=10;j++){ctx.strokeStyle=j%5===0?'#7e9ea48c':'#9eb4b65c';ctx.lineWidth=j%5===0?2:1.2;ctx.beginPath();ctx.moveTo(0,j*h/10);ctx.lineTo(w,j*h/10);ctx.stroke();}
        // One ink ribbon crosses the same UV cells throughout the whole transformation.
        ctx.strokeStyle='#244e65';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();
        for(let i=0;i<=140;i++){const u=.08+i/140*.84,v=.50+.16*Math.sin((u-.1)*Math.PI*2);if(i===0)ctx.moveTo(u*w,v*h);else ctx.lineTo(u*w,v*h);}ctx.stroke();
        for(const [u,v] of [[.20,.50+.16*Math.sin(.1*Math.PI*2)],[.50,.50+.16*Math.sin(.4*Math.PI*2)],[.80,.50+.16*Math.sin(.7*Math.PI*2)]]){
            ctx.fillStyle='#b77f54';ctx.beginPath();ctx.arc(u*w,v*h,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f8f4e9';ctx.beginPath();ctx.arc(u*w,v*h,3,0,Math.PI*2);ctx.fill();
        }
        ctx.globalAlpha=1;
    }else{
        // Original geometric image cards. No copied image, logo or external dependency.
        const margin=52;ctx.fillStyle='#193c4b';ctx.fillRect(margin,margin,w-margin*2,h-margin*2-40);
        if(pattern==='horizon'){
            const g=ctx.createLinearGradient(0,80,0,560);g.addColorStop(0,'#dfb78e');g.addColorStop(1,'#6a8c99');ctx.fillStyle=g;ctx.fillRect(margin,margin,w-margin*2,h-margin*2-40);
            ctx.fillStyle='#f5d4a2';ctx.beginPath();ctx.arc(722,206,65,0,Math.PI*2);ctx.fill();
            for(let k=0;k<3;k++){ctx.fillStyle=['#7b999d','#486c7f','#274e63'][k];ctx.beginPath();ctx.moveTo(52,550);for(let x=52;x<=972;x+=20)ctx.lineTo(x,320+k*63+Math.sin(x*.009+k)*35+Math.cos(x*.015)*18);ctx.lineTo(972,580);ctx.closePath();ctx.fill();}
        }else if(pattern==='orbit'){
            ctx.strokeStyle='#a5bdbe';ctx.lineWidth=6;
            for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(512,307,285-i*56,150-i*25,-.45+i*.45,0,Math.PI*2);ctx.stroke();}
            for(const [x,y,r,color]of [[512,307,44,'#ddb583'],[771,181,17,'#f5f2e6'],[328,409,23,'#8cb5bf']]){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
        }else{
            for(let k=0;k<9;k++){ctx.strokeStyle=k%3===0?'#d8ba92':'#7ba1ad';ctx.lineWidth=7;ctx.beginPath();for(let x=70;x<957;x+=8){const y=143+k*43+Math.sin(x*.008+k*.22)*31;if(x===70)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
        }
        ctx.fillStyle='#54727d';ctx.fillRect(68,607,154,5);ctx.fillStyle='#c4a17a';ctx.fillRect(68,621,62,4);
    }
    return c;
}
function resources(ctx) {
    let r=materialCache.get(ctx);if(r)return r;
    r={front:paperTexture(),back:paperTexture({back:true}),shadedFront:canvas(1024,672),shadedBack:canvas(1024,672),cards:Object.fromEntries(['orbit','horizon','tide'].map(pattern=>[pattern,paperTexture({pattern})])),
        shadow:canvas(WIDTH,HEIGHT),contact:canvas(WIDTH,HEIGHT)};materialCache.set(ctx,r);return r;
}
function fillPolygon(ctx,points,fill) {if(points.length<3)return;ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function shadeMaterial(r,s) {
    // One continuous light field in UV space. Shading triangle edges individually
    // composites antialiasing twice and exposes the diagonal mesh as a fish-scale pattern.
    // Two persistent atlases avoid both per-face alpha edges and a growing shade cache.
    for(const back of [false,true]){
        const target=back?r.shadedBack:r.shadedFront,ctx=target.getContext('2d');
        ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,target.width,target.height);
        ctx.drawImage(back?r.back:r.front,0,0);
        const gradient=ctx.createLinearGradient(0,0,target.width,0);
        for(let i=0;i<=64;i++){
            const normal=rotateY(surfaceNormal(i/64,s.bend),s.parent.yaw),n=back?mul(normal,-1):normal;
            const light=.62+.36*Math.max(0,dot3(n,LIGHT_DIRECTION)),level=Math.round(light*255);
            gradient.addColorStop(i/64,`rgb(${level},${level},${level})`);
        }
        ctx.globalCompositeOperation='multiply';ctx.fillStyle=gradient;ctx.fillRect(0,0,target.width,target.height);ctx.globalCompositeOperation='source-over';
    }
}
function expandedTriangle(points,pixels=.62) {
    // Tiny conservative raster overlap seals clipping antialias cracks. The image's
    // affine UV transform uses the original vertices, so this adds no texture stretch.
    const center=mul(points.reduce(add,[0,0]),1/3);
    return points.map(p=>{const d=sub(p,center),n=length(d)||1;return add(p,mul(d,pixels/n));});
}
function triangleMap(ctx,texture,uv,screen) {
    const [p0,p1,p2]=screen,[t0,t1,t2]=uv.map(p=>[p[0]*texture.width,p[1]*texture.height]);
    const ux=t1[0]-t0[0],uy=t1[1]-t0[1],vx=t2[0]-t0[0],vy=t2[1]-t0[1],det=ux*vy-uy*vx;
    if(Math.abs(det)<1e-7)return;
    const dx=p1[0]-p0[0],dy=p1[1]-p0[1],ex=p2[0]-p0[0],ey=p2[1]-p0[1];
    const a=(dx*vy-ex*uy)/det,b=(dy*vy-ey*uy)/det,c=(ex*ux-dx*vx)/det,d=(ey*ux-dy*vx)/det,e=p0[0]-a*t0[0]-c*t0[1],f=p0[1]-b*t0[0]-d*t0[1];
    const clip=expandedTriangle(screen);
    ctx.save();ctx.beginPath();ctx.moveTo(...clip[0]);ctx.lineTo(...clip[1]);ctx.lineTo(...clip[2]);ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,e,f);ctx.drawImage(texture,0,0);ctx.restore();
}
export function projectedPaperScene(s) {
    const view=viewFor(s.camera),triangles=[];
    for(const f of s.topology){
        const vs=f.vertices.map(i=>s.vertices[i]),world=vs.map(v=>v.world),normal=unit(vs.reduce((a,v)=>add(a,v.normal),[0,0,0]));
        const center=mul(world.reduce(add,[0,0,0]),1/3),back=dot3(normal,sub(s.camera.position,center))<0;
        const screen=world.map(p=>view.point(p));
        const normalLit=back?mul(normal,-1):normal;
        triangles.push({id:f.id,world,uv:vs.map(v=>v.uv),screen:screen.map(p=>p.point),depth:screen.reduce((v,p)=>v+p.depth,0)/3,
            normal,back,light:.62+.36*Math.max(0,dot3(normalLit,LIGHT_DIRECTION)),type:'paper'});
    }
    for(const card of s.cards){
        const uv=[[0,0],[1,0],[1,1],[0,1]];
        for(const ids of [[0,3,1],[1,3,2]]){
            const world=ids.map(i=>card.corners[i]),screen=world.map(p=>view.point(p));
            triangles.push({id:`${card.id}-${ids[0]}`,world,uv:ids.map(i=>uv[i]),screen:screen.map(p=>p.point),depth:screen.reduce((v,p)=>v+p.depth,0)/3,
                light:.94,type:'card',pattern:card.pattern});
        }
    }
    triangles.sort((a,b)=>b.depth-a.depth);
    // Mean triangle depth is not a valid ordering for nearly coplanar surfaces:
    // a large card triangle can be sorted behind one of the many smaller paper
    // triangles even though the complete card is physically above the sheet.
    // While the sheet is flat and the camera is above every card, the supporting
    // plane gives an exact occlusion relation: all paper, then all cards.
    // Once bent, this override stops; cards do NOT become permanent HUD layers.
    const paperTop=Math.max(...s.vertices.map(v=>v.world[1]));
    const cardHeights=s.cards.flatMap(c=>c.corners.map(p=>p[1]));
    const supportPlaneOrder=s.bend===0&&Math.min(...cardHeights)>paperTop&&s.camera.position[1]>Math.max(...cardHeights);
    const drawTriangles=supportPlaneOrder?[...triangles.filter(tr=>tr.type==='paper'),...triangles.filter(tr=>tr.type==='card')]:triangles;
    return {view,triangles,drawTriangles,occlusionMode:supportPlaneOrder?'support-plane':'spatial-depth'};
}
function drawShadows(ctx,s,view,r) {
    const full=r.shadow.getContext('2d'),contact=r.contact.getContext('2d');
    for(const target of [full,contact]){target.setTransform(1,0,0,1,0,0);target.clearRect(0,0,WIDTH,HEIGHT);target.fillStyle='#142837';}
    for(const f of s.topology){
        const vertices=f.vertices.map(i=>s.vertices[i]),projected=vertices.map(v=>view.point(v.shadow).point);
        if(projected.some(p=>!p))continue;fillPolygon(full,projected,'#142837');
        if(Math.max(...vertices.map(v=>v.world[1]))<.30)fillPolygon(contact,projected,'#142837');
    }
    for(const card of s.cards){const p=card.corners.map(v=>view.point(shadowProjection(v)).point);if(p.every(Boolean)){fillPolygon(full,p,'#142837');if(card.lift<.08)fillPolygon(contact,p,'#142837');}}
    ctx.save();ctx.globalAlpha=.13;ctx.filter='blur(9px)';ctx.drawImage(r.shadow,0,0);ctx.filter='blur(1.6px)';ctx.globalAlpha=.21;ctx.drawImage(r.contact,0,0);ctx.restore();
}
function drawRoom(ctx,view) {
    const g=ctx.createLinearGradient(0,110,0,780);g.addColorStop(0,'#edf0ec');g.addColorStop(1,'#dfe5df');ctx.fillStyle=g;ctx.fillRect(0,135,1600,620);
    const ground=view.polygon([[-10,0,-8],[-10,0,8],[10,0,8],[10,0,-8]]);
    if(ground)fillPolygon(ctx,ground.points,'#e0e4dc');
    // A low-contrast window-shaped light pool gives the paper a calm physical context.
    for(let i=0;i<3;i++){
        const x=-5.9+i*2.4,p=view.polygon([[x,.008,-5.1],[x+2.1,.008,-5.1],[x+4.2,.008,4.6],[x+2.1,.008,4.6]]);
        if(p){ctx.save();ctx.globalAlpha=.22;fillPolygon(ctx,p.points,'#fff9df');ctx.restore();}
    }
}
function drawAxis(ctx,s,view,p) {
    if(s.axisAlpha<=0)return;
    const origin=[-2.45,.065,2.9],ends=[add(origin,[1.1,0,0]),add(origin,[0,1.1,0]),add(origin,[0,0,-1.1])],o=view.point(origin).point;
    if(!o)return;ctx.save();ctx.globalAlpha=s.axisAlpha*.88;
    ends.forEach((endpoint,i)=>{const q=view.point(endpoint).point;if(!q)return;line(ctx,o,q,i===1?p.accent:p.ink,1.8);circle(ctx,...q,3,p.paper,i===1?p.accent:p.ink,1.2);text(ctx,['x','y','z'][i],q[0]+9,q[1]-10,18,p.muted,500);});ctx.restore();
}
export const paperSpace=candidate({
    id:'visualization-paper-space',module:'visualization',title:'一张纸，慢慢拥有空间',duration:PAPER_DURATION,loop:false,
    codeFile:'./modules/paper-space.js',referenceIds:['ai-draw'],previewTime:10.6,stageTimes:[0,1.05,3.5,6.2,7.15,9.6],
    description:'瓷白纸面上三张原创小卡片依次离开，同一 UV 网格先弯成曲面，再卷成开口纸拱；镜头围绕固定中心，末段保留阅读。',
    usage:'适合从二维关系进入空间、展示嵌入或连续形变。它表达拓扑连续，不表示数学降维或真实布料求解。',
    stages:['纸面关系','依次让位','曲面中间态','停住观察','绕入空间','坐标接力'],
    recipe:['纸张使用固定顶点 ID、UV 和面索引；圆柱弯曲保持解析弧长。','图片卡片先抬离再滑走、最后落定，主体3.5秒后才折弯。','纹理、墨线和标点随 UV 走，不另贴屏幕网格；接触影子来自实际网格顶点投影。','13秒单次动画，6.2–7.15秒停形、10.4秒后完全停机位供阅读；非物理布料仿真。'],
    controls:{palette:false,intensity:false},
    parameters:{palette:{values:['porcelain'],default:'porcelain'}}
},samplePaperSpace,(ctx,t,w,h,o,s)=>{
    const p=PAPER_PALETTE,r=resources(ctx),scene=projectedPaperScene(s);
    shadeMaterial(r,s);
    ctx.save();ctx.setTransform(w/WIDTH,0,0,h/HEIGHT,0,0);ctx.globalAlpha=1;ctx.filter='none';ctx.clearRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle=p.background;ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.save();ctx.beginPath();ctx.rect(48,145,1504,590);ctx.clip();drawRoom(ctx,scene.view);drawShadows(ctx,s,scene.view,r);
    for(const tr of scene.drawTriangles){
        if(tr.screen.some(v=>!v))continue;
        const tex=tr.type==='card'?r.cards[tr.pattern]:tr.back?r.shadedBack:r.shadedFront;
        // No per-triangle fill, outline or alpha shading: rectangular UV lines are the
        // only visible grid. Conservative clip overlap prevents diagonal raster seams.
        triangleMap(ctx,tex,tr.uv,tr.screen);
    }
    // No screen-space wireframe overlay: fine boundary thickness is part of paper material.
    drawAxis(ctx,s,scene.view,p);ctx.restore();
    const top=ctx.createLinearGradient(0,120,0,190);top.addColorStop(0,p.background);top.addColorStop(1,'#e8ece900');ctx.fillStyle=top;ctx.fillRect(0,120,WIDTH,70);
    text(ctx,'同一张纸，走进三维空间',74,71,35,p.ink,700);
    text(ctx,'纸面 → 曲面 → 空间对象',76,113,22,p.muted,500);
    text(ctx,s.stage,1524,72,22,p.accent,650,'right');
    const caption=s.time<3.5?'先把图片移开，给接下来的变化留出位置。':s.time<7.15?'每个格子都还在，弯曲有看得见的中间态。':'边界、墨线与坐标，跟着同一张纸走。';
    text(ctx,caption,76,779,27,p.ink,600);
    text(ctx,'固定网格 · 解析形变 · 原创纸面材质',76,824,19,p.muted);
    text(ctx,'空间形变示意',1524,824,19,p.muted,500,'right');
    line(ctx,[76,866],[1524,866],'#b7c7c8',2);line(ctx,[76,866],[76+1448*s.phase,866],p.ink,3);
    ctx.restore();
});
export const candidates=[paperSpace];
