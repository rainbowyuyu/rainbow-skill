/** Original symbolic title studies. Canvas2D graphic theatre, not reconstructed source footage. */
export const DURATION=20;
export const FPS=30;
export const PALETTE=Object.freeze({ink:'#101718',red:'#bc402e',paper:'#ead9b3',teal:'#1c454b',mist:'#76a5a5'});
export const variants=Object.freeze([
 {id:'outline-relay',name:'一页，成为远方',label:'轮廓接力',description:'书页展开成台阶；最后一页立成灯塔。灯窗的圆，成为海上的太阳。',use:'把几个概念连成一条因果或尺度线索。',tradeoff:'需要先设计形体对应；不能让相似轮廓替代真实因果。',beats:[['纸页展开',0,4.8],['台阶立成灯塔',4.8,9.8],['灯窗成为太阳',9.8,15.5],['片名落定',15.5,20]]},
 {id:'negative-space',name:'从门里，看见海',label:'负空间穿越',description:'门缝逐渐打开。镜头进入灯窗，窗内的海变成整片画面。',use:'先藏住全貌，再让观众主动追问空间里有什么。',tradeoff:'遮罩边缘必须有归属；没有前后景依据的黑块会像故障。',beats:[['一线光',0,4.8],['灯塔在门后',4.8,9.8],['穿过圆窗',9.8,15.5],['片名落定',15.5,20]]},
 {id:'dual-world',name:'同一条，未完的航线',label:'双世界对照',description:'同一纸舟从纸面驶入海上；一条线在两种世界里，保持同一个方向。',use:'观测与预测、模型与实体、过去与现在之间的对照。',tradeoff:'两侧必须共享对象和轨迹；色彩反转本身不等于叙事。',beats:[['航线写在纸上',0,4.8],['纸舟越过边界',4.8,9.8],['地图成为海',9.8,15.5],['片名落定',15.5,20]]}
]);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
const q=(t,a,b)=>ease((t-a)/(b-a));
const mix=(a,b,t)=>a+(b-a)*t;
export function sampleTitleSequence(input,variant='outline-relay',options={}){
 const t=clamp(Number.isFinite(input)?input:0,0,DURATION),v=variants.find(x=>x.id===variant)||variants[0];
 const phase=v.beats.find((b,i)=>t>=b[1]&&(t<b[2]||i===v.beats.length-1));
 const title=typeof options.title==='string'?options.title.trim().slice(0,36):'未写完的航线';
 const aperture=q(t,0.4,4.8),portal=q(t,9.8,13.4),reveal=q(t,14.7,16.7),windowPush=q(t,6.4,9);
 const worldReveal=1-Math.pow(1-clamp(portal/.25),3),windowScale=24*mix(1,3.3,windowPush)/450;
 return {t,variant:v.id,duration:DURATION,phase:phase[0],phaseProgress:clamp((t-phase[1])/(phase[2]-phase[1])),
  motifId:'route-01',screenAnchor:[.69,.38],pageSpread:q(t,.3,4.1),stair:q(t,3.1,7.6),tower:q(t,6.1,9.8),sun:q(t,9.8,13.2),sea:q(t,10.4,14.5),aperture,portal,windowPush,
  seam:mix(1.05,-.1,q(t,4,12.8)),boat:{x:mix(240,1090,q(t,1.5,14)),y:590+Math.sin(q(t,1.5,14)*Math.PI)*-30,angle:0},
  title:{text:title||'未写完的航线',alpha:reveal,x:800,y:440,maxFontSize:72,readWindow:[16.7,20],stable:t>=16.7},
  camera:{scale:v.id==='negative-space'?1:mix(1.04,1,q(t,0,15)),roll:0},
  mask:{center:[1104,342],radius:mix(24*mix(1,3.3,windowPush),1800,portal),kind:v.id==='negative-space'?'circle':'none'},
  incomingWorld:{scale:mix(windowScale,1,worldReveal),center:[mix(1104,800,worldReveal),mix(342,450,worldReveal)],sourceCenter:[800,450]},
  sounds:[{time:.5,kind:'paper-open',role:'物件起势'},{time:7.7,kind:'soft-impact',role:'结构落定'},{time:11.8,kind:'air-pass',role:'尺度进入'},{time:16.7,kind:'low-resolve',role:'片名落定'}],
  readWindow:t>=16.7,mode:'original-2d-graphic-theatre'};
}
function poly(c,p,fill,stroke,width=1){c.beginPath();p.forEach((a,i)=>i?c.lineTo(...a):c.moveTo(...a));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function line(c,p,color,w=1){c.beginPath();p.forEach((a,i)=>i?c.lineTo(...a):c.moveTo(...a));c.strokeStyle=color;c.lineWidth=w;c.stroke();}
function circle(c,x,y,r,color){c.beginPath();c.arc(x,y,Math.max(.01,r),0,Math.PI*2);c.fillStyle=color;c.fill();}
function rng(n){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
function grain(c,x,y,w,h,seed=0,strength=.1){const inheritedAlpha=c.globalAlpha;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();for(let i=0;i<520;i++){const px=x+rng(i+seed)*w,py=y+rng(i*3.1+seed)*h;c.globalAlpha=inheritedAlpha*strength*(.25+rng(i+8));c.strokeStyle=i%3?PALETTE.ink:PALETTE.paper;c.lineWidth=.6+rng(i+2);c.beginPath();c.moveTo(px,py);c.lineTo(px+2+rng(i+5)*9,py-rng(i+10)*2);c.stroke();}c.restore();}
function paperSheet(c,x,y,w,h,angle,color,seed){c.save();c.translate(x,y);c.rotate(angle);poly(c,[[-w/2,-h/2],[w/2,-h/2+3],[w/2+4,h/2],[-w/2,h/2+2]],color,PALETTE.ink,2);grain(c,-w/2,-h/2,w,h,seed,.16);for(let i=0;i<5;i++)line(c,[[-w*.34,-h*.27+i*h*.105],[w*.27,-h*.27+i*h*.105]],PALETTE.ink,1.1);c.restore();}
function boat(c,x,y,s,fill=PALETTE.paper){c.save();c.translate(x,y);c.scale(s,s);poly(c,[[-95,0],[0,-66],[84,0],[40,42],[-49,42]],fill,PALETTE.ink,2);poly(c,[[-95,0],[5,15],[0,-66]],PALETTE.red);poly(c,[[5,15],[84,0],[40,42]],PALETTE.teal);line(c,[[-95,0],[5,15],[40,42]],PALETTE.ink,2);grain(c,-85,-55,160,90,42,.13);c.restore();}
function bird(c,x,y,s){c.save();c.translate(x,y);c.scale(s,s);poly(c,[[-28,0],[-9,-10],[0,-2],[14,-13],[32,-7],[8,1],[2,7],[-8,1]],PALETTE.ink);c.restore();}
function lighthouse(c,x,y,s,lit=true,body=true){c.save();c.translate(x,y);c.scale(s,s);if(body){poly(c,[[-96,250],[-66,-113],[57,-113],[91,250]],PALETTE.paper,PALETTE.ink,3);poly(c,[[7,-113],[57,-113],[91,250],[20,250]],PALETTE.red);for(let i=0;i<9;i++){const yy=-75+i*36;line(c,[[-65-i*2,yy],[9+i*1.2,yy]],PALETTE.ink,2);}}poly(c,[[-83,-112],[-83,-155],[78,-155],[78,-112]],PALETTE.ink);poly(c,[[-98,-158],[-4,-220],[95,-158]],PALETTE.ink);circle(c,0,-132,30,lit?PALETTE.paper:PALETTE.ink);poly(c,[[-102,252],[102,252],[138,283],[-138,283]],PALETTE.ink);poly(c,[[-20,250],[-20,193],[10,176],[36,195],[36,250]],PALETTE.ink);grain(c,-92,-210,188,470,15,.19);c.restore();}
function islands(c,shift=0,paper=false){const ink=paper?PALETTE.red:PALETTE.ink;c.save();c.translate(shift,0);poly(c,[[-200,640],[90,608],[165,558],[249,564],[293,494],[316,515],[339,451],[370,521],[401,510],[433,557],[515,602],[600,650]],ink);poly(c,[[1180,650],[1276,570],[1331,576],[1370,490],[1420,519],[1480,463],[1520,533],[1650,588],[1780,650]],ink);for(let i=0;i<14;i++){const x=1280+i*25,h=15+rng(i)*55;c.fillStyle=ink;c.fillRect(x,555-h,10,h);}c.restore();}
function ocean(c,t,opts={}){const inheritedAlpha=c.globalAlpha;const {paper=false,sun=1,boatX=900,boatY=640,boatScale=1,showBoat=true}=opts;c.fillStyle=paper?PALETTE.paper:PALETTE.teal;c.fillRect(0,0,1600,900);circle(c,1104,342,132*sun,paper?PALETTE.red:PALETTE.paper);for(let i=0;i<6;i++){const yy=140+i*47;poly(c,[[80+i*13,yy],[340+i*45,yy-8],[295+i*37,yy+3],[505+i*25,yy+8],[100+i*11,yy+12]],paper?'#d6c29a':'#345a5d');}islands(c,0,paper);for(let j=0;j<25;j++){const y=551+j*14;const a=4+j*.38;c.beginPath();for(let x=-30;x<=1640;x+=14){const yy=y+Math.sin(x*.012+t*.3+j*.75)*a+Math.sin(x*.004-j)*a*.6;x===-30?c.moveTo(x,yy):c.lineTo(x,yy);}c.strokeStyle=paper?(j%5===0?PALETTE.red:'#bba780'):(j%4===0?PALETTE.paper:'#639294');c.globalAlpha=inheritedAlpha*(j%4===0?.65:.35);c.lineWidth=j%4===0?2.2:1.1;c.stroke();}c.globalAlpha=inheritedAlpha;
 for(let j=0;j<9;j++){const yy=560+j*32,w=160+j*14;line(c,[[1104-w,yy],[1104+w,yy+2]],paper?'#d2b987':PALETTE.paper,2);}
 if(showBoat)boat(c,boatX,boatY,boatScale,paper?PALETTE.ink:PALETTE.paper);
 bird(c,830,225,1);bird(c,762,255,.65);grain(c,0,0,1600,900,62,.12);
}
function bookStage(c,s){c.fillStyle=PALETTE.red;c.fillRect(0,0,1600,900);poly(c,[[0,728],[200,693],[390,670],[703,680],[1000,742],[1600,710],[1600,900],[0,900]],PALETTE.ink);grain(c,0,0,1600,900,1,.2);
 // The final page itself becomes the tower body, rather than hiding beneath another object.
 for(let i=0;i<11;i++){const u=i/10,fan=s.pageSpread,stair=s.stair;const bx=620+(u-.5)*220*fan,by=625-Math.sin(u*Math.PI)*170*fan;const x=mix(bx,300+u*780,stair),y=mix(by,710-u*300,stair),a=mix((u-.5)*.8*fan,-.025,stair),w=mix(250,153,stair),h=mix(160,62,stair);
  if(i<10){c.save();c.globalAlpha=1-q(s.t,7.2,9.8);paperSheet(c,x-70*q(s.t,7.2,9.8),y,w,h,a,i%3===0?'#d3bd92':PALETTE.paper,i+10);c.restore();continue;}
  const corners=[[-w/2,-h/2],[w/2,-h/2+3],[w/2+4,h/2],[-w/2,h/2+2]].map(([px,py])=>[x+px*Math.cos(a)-py*Math.sin(a),y+px*Math.sin(a)+py*Math.cos(a)]);
  const scale=.75,origin=342+132*scale,target=[[-66,-113],[57,-113],[91,250],[-96,250]].map(([px,py])=>[1104+px*scale,origin+py*scale]);
  const shape=corners.map((point,j)=>point.map((n,k)=>mix(n,target[j][k],s.tower)));
  poly(c,shape,PALETTE.paper,PALETTE.ink,2);c.save();c.beginPath();shape.forEach((p,j)=>j?c.lineTo(...p):c.moveTo(...p));c.closePath();c.clip();
  c.save();c.globalAlpha=s.tower;poly(c,[[1109,origin-84.75],[1147,origin-84.75],[1173,origin+187.5],[1119,origin+187.5]],PALETTE.red);c.restore();
  for(let j=0;j<8;j++){const f=(j+1)/9,l=shape[0].map((n,k)=>mix(n,shape[3][k],f)),r=shape[1].map((n,k)=>mix(n,shape[2][k],f));line(c,[[mix(l[0],r[0],.12),l[1]],[mix(l[0],r[0],.66),mix(l[1],r[1],.66)]],PALETTE.ink,1.3);}
  grain(c,Math.min(...shape.map(p=>p[0])),Math.min(...shape.map(p=>p[1])),200,400,20,.14);c.restore();
  c.save();c.globalAlpha=q(s.t,8,9.4);lighthouse(c,1104,origin,scale,true,false);c.restore();
 }
 c.save();c.globalAlpha=1-s.stair;poly(c,[[450,683],[790,683],[805,710],[438,710]],PALETTE.ink);line(c,[[458,688],[784,688]],PALETTE.paper,3);c.restore();
}
function relay(c,s){bookStage(c,s);if(s.sun>0){
 // The same circular lantern aperture grows; the next world is already inside it.
 c.save();c.beginPath();c.arc(1104,342,mix(22.5,1800,s.sun),0,Math.PI*2);c.clip();ocean(c,s.t,{sun:1,boatX:mix(630,900,s.sea),boatY:640,boatScale:.9});c.restore();
}}
function archPath(c,cx,cy,w,h){c.beginPath();c.moveTo(cx-w/2,cy+h/2);c.lineTo(cx-w/2,cy-h/2+w/2);c.arc(cx,cy-h/2+w/2,w/2,Math.PI,0);c.lineTo(cx+w/2,cy+h/2);c.closePath();}
function negative(c,s){
 // The doorway has an actual frame; the lantern stays at the same screen anchor.
 // Recognition holds: open door 4.8–6.4s, enlarged window 9–9.8s.
 const zoom=mix(1,3.3,s.windowPush),a=s.aperture,gap=mix(8,290,a);
 c.save();c.translate(1104,342);c.scale(zoom,zoom);c.translate(-1104,-342);
 c.fillStyle=PALETTE.red;c.fillRect(-2000,-2000,6000,5000);grain(c,0,0,1600,900,13,.22);
 c.save();archPath(c,1104,477,560,960);c.clip();ocean(c,s.t,{sun:.7,boatX:800,boatScale:.6});lighthouse(c,1104,342+132*.8,.8);c.restore();
 poly(c,[[804,-10],[1104-gap,-10],[1104-gap,960],[804,960]],PALETTE.ink);
 poly(c,[[1104+gap,-10],[1404,-10],[1404,960],[1104+gap,960]],PALETTE.ink);
 for(let i=0;i<7;i++){line(c,[[550+i*12,0],[550+i*12,900]],'#7d2f28',2);line(c,[[1500+i*12,0],[1500+i*12,900]],'#7d2f28',2);}
 line(c,[[1104-gap,-10],[1104-gap,960]],PALETTE.paper,3);line(c,[[1104+gap,-10],[1104+gap,960]],PALETTE.paper,3);c.restore();
 // Show a miniature sea/boat composition inside the lantern first. Sampling the
 // final world's coordinates here would show only its large, cream-colored sun.
 // The inner view expands continuously and reaches the final camera before the
 // aperture uncovers the frame edges; teal supplies the circular overscan.
 if(s.t>4.8){c.save();c.globalAlpha=q(s.t,4.8,5.2);c.beginPath();c.arc(1104,342,s.mask.radius,0,Math.PI*2);c.clip();c.fillStyle=PALETTE.teal;c.fillRect(0,0,1600,900);
 const inner=s.incomingWorld;c.translate(...inner.center);c.scale(inner.scale,inner.scale);c.translate(-inner.sourceCenter[0],-inner.sourceCenter[1]);ocean(c,s.t,{sun:1,boatX:750+60*q(s.t,9,15),boatScale:.7});c.restore();
 c.save();c.globalAlpha=(1-s.portal)*q(s.t,4.8,5.2);c.strokeStyle=PALETTE.paper;c.lineWidth=3*zoom;c.beginPath();c.arc(1104,342,s.mask.radius,0,Math.PI*2);c.stroke();c.restore();}
}
function mapWorld(c,s){c.fillStyle=PALETTE.paper;c.fillRect(0,0,1600,900);for(let i=0;i<14;i++){c.beginPath();const r=90+i*32;for(let a=0;a<=Math.PI*2+.01;a+=.05){const rr=r+Math.sin(a*4+i*.25)*28;const x=490+Math.cos(a)*rr*1.6,y=435+Math.sin(a)*rr*.66;a===0?c.moveTo(x,y):c.lineTo(x,y);}c.strokeStyle='#c3b18c';c.lineWidth=1;c.stroke();}circle(c,1104,342,132,PALETTE.red);for(let i=0;i<36;i++){const a=i*Math.PI/18;line(c,[[1104+Math.cos(a)*106,342+Math.sin(a)*106],[1104+Math.cos(a)*125,342+Math.sin(a)*125]],PALETTE.paper,i%3?1:3);}poly(c,[[1104,242],[1078,367],[1104,346],[1130,367]],PALETTE.ink);c.save();c.setLineDash([10,15]);c.strokeStyle=PALETTE.red;c.lineWidth=3;c.beginPath();c.moveTo(120,650);c.bezierCurveTo(450,375,730,735,1240,490);c.stroke();c.restore();boat(c,s.boat.x,s.boat.y,.8,PALETTE.ink);grain(c,0,0,1600,900,53,.14);}
function dual(c,s){mapWorld(c,s);const seam=s.seam*1600;c.save();c.beginPath();c.rect(seam,0,2000,900);c.clip();ocean(c,s.t,{boatX:s.boat.x,boatY:s.boat.y,boatScale:.8});c.restore();if(seam>0&&seam<1600){line(c,[[seam,0],[seam,900]],PALETTE.paper,3);line(c,[[seam+4,0],[seam+4,900]],PALETTE.ink,2);}
}
function fitTitle(c,txt,maxWidth){let size=72;c.font=`500 ${size}px "Microsoft YaHei",sans-serif`;while(c.measureText(txt).width>maxWidth&&size>28){size-=2;c.font=`500 ${size}px "Microsoft YaHei",sans-serif`;}return size;}
function titleCard(c,s){const a=s.title.alpha;if(!a)return null;c.save();c.globalAlpha=a;c.fillStyle=PALETTE.ink;c.fillRect(0,0,1600,900);grain(c,0,0,1600,900,80,.055);const rad=440;const g=c.createRadialGradient(800,760,15,800,760,rad);g.addColorStop(0,'#173b3d');g.addColorStop(1,PALETTE.ink);c.fillStyle=g;c.fillRect(0,450,1600,450);boat(c,800,724,.3,PALETTE.paper);c.textAlign='center';c.fillStyle=PALETTE.red;c.font='500 15px "Segoe UI",sans-serif';c.fillText('A STUDY IN SHAPE, SCALE & SECRETS',800,335);const size=fitTitle(c,s.title.text,1280);c.font=`500 ${size}px "Microsoft YaHei",sans-serif`;c.fillStyle=PALETTE.paper;c.fillText(s.title.text,s.title.x,s.title.y);const layout={x:s.title.x,y:s.title.y,fontSize:size,measuredWidth:c.measureText(s.title.text).width,alpha:a};c.font='400 16px "Segoe UI",sans-serif';c.fillStyle=PALETTE.mist;c.fillText('THE UNWRITTEN ROUTE',800,495);line(c,[[760,542],[840,542]],PALETTE.red,2);c.restore();return layout;}
export function drawTitleSequence(ctx,input,width,height,options={}){
 const s=sampleTitleSequence(input,options.variant,options);const c=ctx;c.save();c.clearRect(0,0,width,height);c.scale(width/1600,height/900);
 c.save();c.translate(1104,342);c.rotate(s.camera.roll);c.scale(s.camera.scale,s.camera.scale);c.translate(-1104,-342);if(s.variant==='negative-space')negative(c,s);else if(s.variant==='dual-world')dual(c,s);else relay(c,s);c.restore();const renderedTitle=titleCard(c,s);
 if(options.anchors){c.save();c.strokeStyle='#f7eb9e';c.lineWidth=1.6;c.setLineDash([5,6]);const [ax,ay]=s.screenAnchor.map((v,i)=>v*(i?900:1600));line(c,[[ax-35,ay],[ax+35,ay]],'#f7eb9e',2);line(c,[[ax,ay-35],[ax,ay+35]],'#f7eb9e',2);c.beginPath();c.arc(ax,ay,132,0,Math.PI*2);c.stroke();c.setLineDash([]);c.fillStyle='#101718df';c.fillRect(50,755,900,97);c.fillStyle=PALETTE.paper;c.font='22px "Microsoft YaHei",sans-serif';c.textAlign='left';c.fillText('同一圆心 · 灯窗 / 太阳 / 罗盘',74,793);c.font='16px "Microsoft YaHei",sans-serif';c.fillStyle=PALETTE.mist;c.fillText('同形是观众的接力线索；它不代表两个事物在物理上等价。',74,825);c.restore();}
 c.restore();return {...s,renderedTitle};
}
export function buildTitleSelection(t,variant,options={}){const s=sampleTitleSequence(t,variant,options),v=variants.find(v=>v.id===s.variant);return {schema:'motion-atelier.symbolic-titles/v1',title:s.title.text,direction:v.id,mechanism:v.label,question:'同一条线索，怎样从眼前通向一个更大的世界？',story:v.description,tradeoff:v.tradeoff,duration:DURATION,beats:v.beats.map(([label,start,end])=>({label,start,end})),motifId:s.motifId,screenAnchor:s.screenAnchor,readWindow:s.title.readWindow,colors:PALETTE,state:s,implementation:'lab/modules/symbolic-titles.js',source:'https://www.douyin.com/video/7696978272303492243',original:true,limitations:'Canvas2D图形预演，程序图形与固定纹理；不是原片复刻、真实三维仿真或光追。声音为事件建议，当前预演无音频。'};}
