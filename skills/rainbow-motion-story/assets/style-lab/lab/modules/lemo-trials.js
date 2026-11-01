// Original studies of selected Lemo-Opuscar techniques. No upstream demo code/assets.
// All motion is sampled from absolute time; Canvas material effects are previews.
export const trials = [
 {id:'caption-news',name:'数字先落地',family:'剪辑与纪实',title:'59 种风格，59 种讲法',note:'先落数字，再展示目录依据；字幕跨镜保留。仅试做字幕新闻的图文语法。',limit:'未使用新闻实拍，也不伪造报道页面。'},
 {id:'blueprint',name:'尺寸解释动作',family:'图形与排版',title:'滑块走了多远，弹簧就短了多少',note:'尺寸线与运动件读取同一位移，揭示装配关系。',limit:'原创理想弹簧示意，尺寸为设定值，非实测 CAD。'},
 {id:'watercolor',name:'从枝到叶',family:'手绘与绘画',title:'光，先落在一片叶子上',note:'枝干先行，叶片逐笔生长；透明颜料交叠，纸白留作光。',limit:'程序笔触研究，不是流体颜料仿真。'},
 {id:'ink-wash',name:'留白中的行舟',family:'手绘与绘画',title:'水不必画满，船也能向前',note:'五级墨色、飞白和一枚朱红；远近景差速，水面由空白构成。',limit:'表现性水墨，不描述实际水动力。'},
 {id:'risograph',name:'两种油墨，第三种颜色',family:'印刷与版画',title:'叠印，让两种颜色多说一句',note:'两张色版独立移动，交叠产生第三色；套印偏移保持固定。',limit:'Canvas 乘色近似，不是印刷色彩管理。'},
 {id:'swiss-motion',name:'秩序中的例外',family:'图形与排版',title:'先建立秩序，再看见偏差',note:'严格网格、单一强调色；剪切显字，偏差对象脱离网格。',limit:'图形编排练习，不给科学数据施加装饰性变形。'},
 {id:'data-physical',name:'数字一片片长出来',family:'实证影像',title:'每一片，都有分量',note:'一片代表一个单位；计数只在落稳后增加，材质区分两组。',limit:'8 与 12 是教学设定；2.5D 投影与阴影，不是光追产品渲染。'},
 {id:'rubber-hose',name:'小球也有小脾气',family:'卡通与动画',title:'先憋住，再弹起来',note:'预备、释放、回弹；软管肢体与黑白剪影让蓄力变得可感。',limit:'拟人化表演，不是弹簧动力学解。'},
 {id:'pixel-rpg',name:'信号抵达下一站',family:'游戏',title:'把抽象流程，变成可走的路',note:'低分辨率栅格、离散步态、状态框；同一信号走完整路径。',limit:'低分辨率画布试作，未复刻原游戏或完整索引调色板引擎。'},
 {id:'silent-film',name:'一镜看清惯性',family:'电影与时代',title:'车停了，球还想往前',note:'先用全景演出动作，再给短字卡；不用旁白解释已经看见的结果。',limit:'运动学示意；未启用胶片闪烁，避免阅读和观看不适。'},
 {id:'paper-popup',name:'把结构翻出来',family:'材质与 3D',title:'一个铰链，立起一座小世界',note:'纸卡绕底边立起，远层先行，影子随纸卡高度变化。',limit:'Canvas 2.5D 折叠预演，正式成片需实体纸厚、灯光和景深。'},
 {id:'glass-product',name:'光沿结构走一遍',family:'材质与 3D',title:'先看轮廓，再看内部',note:'暗场、窄条高光、缓慢分层；光脉冲穿过装置后回装。',limit:'图形材质预演；高光和反射为绘制近似，不称物理折射或光追。'},
 {id:'shadow-puppet',name:'一盏灯，一层幕',family:'东方传统',title:'看见影子，也看见连接',note:'剪影绕可见铆接点旋转；镂空透光，动作保持平面性。',limit:'平面皮影结构练习，非皮革透射光学仿真。'},
 {id:'dataviz',name:'把差异留在同一把尺上',family:'信息与发布',title:'同一组数值，换一个观察距离',note:'先见原始点，再连成趋势；保留轴、原点和数据身份。',limit:'教学设定序列 2、3、3、5、8，非真实观测。'},
];
export const duration=12;
const clamp=x=>Math.min(1,Math.max(0,x));
const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
const ramp=(t,a,b)=>ease((t-a)/(b-a));
const lerp=(a,b,t)=>a+(b-a)*t;
const hash=i=>{const x=Math.sin(i*127.1+17.7)*43758.5453;return x-Math.floor(x)};
export function inertiaState(t){t=Math.max(0,t);const q=Math.min(1,Math.max(0,t-2)),tau=Math.min(4,Math.max(0,t-2));return {car:300+80*Math.min(t,2)+80*(q-q*q/2),ball:395+80*Math.min(t,2)+80*(tau-tau*tau/8),carVelocity:t<2?80:t<3?80*(1-q):0,ballVelocity:t<2?80:t<6?80*(1-tau/4):0}}
export function foldCard(u,v,angle){return [u,v*Math.sin(angle),-v*Math.cos(angle)]}
let pixelSurface;
export function sample(t,options={}){
 t=Math.min(duration,Math.max(0,Number.isFinite(t)?t:0));
 return {t,phase:t<2?'建立对象':t<6?'动作与变化':t<9?'看清关系':'收束与交接',reveal:ramp(t,0,2),action:ramp(t,2,6),settle:ramp(t,6,9),exit:ramp(t,10,12),seed:41,id:options.id||trials[0].id};
}
function rect(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(x,y,w,h)}
function line(c,pts,col,w=2){c.strokeStyle=col;c.lineWidth=w;c.lineJoin='round';c.lineCap='round';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke()}
function curve(c,start,control,end,col,w=2){c.beginPath();c.moveTo(...start);c.quadraticCurveTo(...control,...end);c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.stroke()}
function poly(c,p,col,edge){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=col;c.fill();if(edge){c.strokeStyle=edge;c.lineWidth=2;c.stroke()}}
function circle(c,x,y,r,col,edge){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(col){c.fillStyle=col;c.fill()}if(edge){c.strokeStyle=edge;c.lineWidth=2;c.stroke()}}
function text(c,str,x,y,size,col='#17222a',weight=500,font='"Microsoft YaHei",sans-serif'){c.fillStyle=col;c.font=`${weight} ${size}px ${font}`;c.fillText(str,x,y)}
function grain(c,color,alpha=.06){c.save();c.globalAlpha=alpha;for(let i=0;i<650;i++){c.fillStyle=color;c.fillRect(hash(i)*1280,hash(i+700)*720,1+hash(i+1300)*2,1)}c.restore()}
function caption(c,title,sub,dark=false){text(c,title,68,620,32,dark?'#f1eee4':'#182830',700);text(c,sub,70,663,18,dark?'#a3b7bb':'#596863',400)}
function label(c,txt,x,y,dark=false){text(c,txt,x,y,17,dark?'#b9d1d6':'#50616a',500)}
function spring(c,x0,x1,y,color){const pts=[[x0,y],[x0+15,y]];for(let i=0;i<=32;i++)pts.push([lerp(x0+20,x1-20,i/32),y+(i%2?-24:24)]);pts.push([x1-15,y],[x1,y]);line(c,pts,color,5)}
function dimension(c,x0,x1,y,txt){line(c,[[x0,y-8],[x0,y+8],[x0,y],[x1,y],[x1,y-8],[x1,y+8]],'#f2b86c',2);text(c,txt,(x0+x1)/2-55,y-12,21,'#f2b86c')}
const painters={
'shadow-puppet':(c,s)=>{
 rect(c,0,0,1280,720,'#3b302b');const g=c.createRadialGradient(640,300,20,640,340,650);g.addColorStop(0,'#f3d894');g.addColorStop(1,'#a88251');rect(c,100,40,1080,640,g);grain(c,'#735d34',.09);
 const angle=-.7+1.5*Math.sin(Math.PI*s.action);const pivot=[615,310],tip=[615+Math.cos(angle)*170,310+Math.sin(angle)*170];
 poly(c,[[525,250],[625,250],[660,450],[500,450]],'#6e3028');circle(c,570,194,61,'#392c27');line(c,[[570,250],[570,130],[617,164]],'#392c27',17);line(c,[pivot,tip],'#60382a',24);circle(c,...pivot,7,'#e6bc6e');circle(c,...tip,7,'#e6bc6e');line(c,[tip,[tip[0]+45,620]],'#726148',3);line(c,[[535,450],[515,541]],'#392c27',18);line(c,[[620,450],[650,541]],'#392c27',18);
 for(let i=0;i<5;i++)for(let j=0;j<6;j++)circle(c,535+i*19,285+j*25,3,'#e9c879');rect(c,0,580,1280,140,'#3b302b');caption(c,'手臂绕铆点转，操纵杆跟着走','透光幕 · 镂空纹样 · 共享铰链位置',true);
},
'dataviz':(c,s)=>{
 rect(c,0,0,1280,720,'#f2eee3');const vals=[2,3,3,5,8];line(c,[[230,120],[230,500],[1100,500]],'#b4b5a4',2);
 for(let v=0;v<=8;v+=2){const y=500-v*42;line(c,[[230,y],[1110,y]],'#d8d6c6',1);label(c,String(v),190,y+6)}
 const pts=vals.map((v,i)=>[300+i*180,500-v*42]);for(let i=0;i<5;i++){const p=ramp(s.t,i*.35,.7+i*.35);circle(c,pts[i][0],pts[i][1],8*p,'#377d78');label(c,String(i+1),pts[i][0]-5,535);if(s.t>3&&i>0){const q=ramp(s.t,3+(i-1)*.5,3.5+(i-1)*.5);line(c,[pts[i-1],[lerp(pts[i-1][0],pts[i][0],q),lerp(pts[i-1][1],pts[i][1],q)]],'#377d78',3)}if(s.t>6)text(c,String(vals[i]),pts[i][0]-6,pts[i][1]-23,26,'#284a48',600)}
 caption(c,'先读到点，再看见趋势','坐标不跳、尺度不变 · 序列为教学设定 · 连接不等于因果');
},
'caption-news':(c,s)=>{
 rect(c,0,0,1280,720,'#18272d');for(let i=0;i<9;i++){rect(c,70+i*134,100,112,360, i%2?'#2b4046':'#25383e');for(let j=0;j<5;j++)rect(c,84+i*134,126+j*60,84,4,'#3f5559')}
 const cut=s.t<4;const n=Math.round(59*ramp(s.t,0,.35));
 if(cut){text(c,String(n),80,365,220,'#efebdf',800);text(c,'种可用风格',385,354,65,'#efebdf',700)}else{
 const x=80+30*(1-ramp(s.t,4,4.4));rect(c,x,120,730,335,'#f2eee5');text(c,'CATALOG / 目录摘要',x+35,175,24);text(c,'59 ready-to-use styles',x+35,245,36,'#1d3537',700);rect(c,x+30,272,640*ramp(s.t,4.6,5.2),57,'#e8bb4d');text(c,'+ 98 film-style archive entries',x+35,314,32);text(c,'两类目录，分别选择与使用。',x+35,399,24);}
 rect(c,70,516,Math.min(1140,1070*ramp(s.t,.15,.55)),70,'#f3c75d');text(c,'让材料、动作和故事一起改变',90,565,44,'#162629',800);text(c,'来源：lemomo-ai/lemo-opuscar · 固定提交 3961ddb · 2026-10-22',72,661,18,'#c7d7d5');
},
'blueprint':(c,s)=>{
 rect(c,0,0,1280,720,'#123344');for(let x=0;x<1280;x+=32)line(c,[[x,0],[x,720]],'#1a4051',1);for(let y=0;y<720;y+=32)line(c,[[0,y],[1280,y]],'#1a4051',1);
 const dx=200*Math.sin(Math.PI*ramp(s.t,2,10))**2,x=800-dx;
 rect(c,195,235,25,245,'#7c9aab');line(c,[[210,455],[1030,455]],'#a5bec8',8);spring(c,220,x,340,'#d3e3e3');rect(c,x,264,115,163,'#264d60');line(c,[[x,264],[x+115,264],[x+115,427],[x,427],[x,264]],'#f0f3e7',3);
 dimension(c,220,x,210,`${((x-220)/58).toFixed(2)} cm`);dimension(c,x,800,488,`Δx ${(dx/58).toFixed(2)}`);label(c,'固定端',155,530,true);label(c,'移动件',x+25,530,true);text(c,'F = k · Δx',865,175,32,'#f2b86c',600);caption(c,'压缩多少，尺寸线就缩短多少','原创理想机构 · 位移与标注共用一份状态',true);
},
'watercolor':(c,s)=>{
 rect(c,0,0,1280,720,'#f0e8d8');grain(c,'#746144');const progress=ramp(s.t,0,8);
 c.save();c.translate(620,505);c.rotate(-.04+.03*s.action);
 const trunk=[];for(let i=0;i<=80*progress;i++){const p=i/80;trunk.push([Math.sin(p*2.7)*30,-p*365])}line(c,trunk,'#77734b',4);
 for(let i=1;i<11;i++){const p=i/11,amount=ramp(progress,p-.1,p+.1);if(!amount)continue;const side=i%2?1:-1,x=Math.sin(p*2.7)*30,y=-p*365;
 c.save();c.translate(x,y);c.scale(side*amount,amount);c.rotate(-.48);c.globalCompositeOperation='multiply';
 for(let layer=0;layer<5;layer++){c.beginPath();c.moveTo(0,0);c.bezierCurveTo(24,-22-layer,65,-24,95,0);c.bezierCurveTo(64,22+layer,23,17,0,0);c.fillStyle=layer%2?'#7f956b':'#bac087';c.globalAlpha=.14;c.fill()}
 for(let k=0;k<7;k++){c.globalAlpha=.1;curve(c,[3,k-3],[45,(k-3)*5],[90,0],'#526e4b',.8)}
 c.globalAlpha=.28;curve(c,[0,0],[45,2],[95,0],'#4d6a48',1);c.restore()}
 c.restore();text(c,'01 / 光与叶',100,160,28,'#66705b',400,'serif');line(c,[[260,205],[375,205],[516,285]],'#9a9b80',1);text(c,'结构 → 铺色 → 细节',865,340,22,'#60735a',500,'serif');caption(c,'一笔先长出枝，下一笔才是叶','半透明笔触叠加 · 纸白留光 · 完成的笔触保持稳定');
},
'ink-wash':(c,s)=>{
 rect(c,0,0,1280,720,'#f2ecde');grain(c,'#524e45',.035);
 for(let layer=0;layer<4;layer++){const base=350+layer*25,shift=s.t*(layer+1)*4;const ridge=[];for(let j=0;j<=100;j++){const x=j*17-200-shift;const k=(j*17+layer*143)/180;const y=base-(50+42*Math.sin(k)+27*Math.sin(k*2.1)+12*Math.sin(k*4.7))*(1+layer*.05);ridge.push([x,y])}
 const g=c.createLinearGradient(0,base-160,0,base+20);g.addColorStop(0,`rgba(56,67,58,${.13+layer*.05})`);g.addColorStop(.7,`rgba(66,73,64,${.10+layer*.025})`);g.addColorStop(1,'rgba(80,82,71,0)');c.beginPath();c.moveTo(-500,base+30);c.lineTo(...ridge[0]);for(let j=1;j<ridge.length-1;j++)c.quadraticCurveTo(...ridge[j],(ridge[j][0]+ridge[j+1][0])/2,(ridge[j][1]+ridge[j+1][1])/2);c.lineTo(1500,base+30);c.closePath();c.fillStyle=g;c.fill();
 c.save();c.globalAlpha=.035;for(let k=0;k<12;k++)line(c,ridge.map(([x,y],i)=>[x+k*.7,y+hash(i+k)*12]),'#3d493f',.65);c.restore()}
 c.save();c.globalAlpha=.3;for(let i=0;i<12;i++){const x=hash(i)*1280-s.t*9;curve(c,[x,438+i*8],[x+40,435+i*8],[x+60+hash(i+30)*65,438+i*8],'#74766e',.8)}c.restore();
 const bx=250+s.t*34,by=451+Math.sin(s.t*1.2)*2;poly(c,[[bx-42,by],[bx+48,by],[bx+25,by+16],[bx-25,by+16]],'#343c37');line(c,[[bx,by],[bx-3,by-52],[bx+3,by-50]],'#343c37',3);poly(c,[[bx+3,by-48],[bx+3,by-5],[bx+37,by-5]],'#c4c2b5');rect(c,bx-4,by-43,7,13,'#a9442e');text(c,'留白',1070,140,42,'#444b40',400,'serif');caption(c,'画少一点，空间就多一点','远山缓行 · 近水掠过 · 朱红只留给船上的人');
},
'risograph':(c,s)=>{
 rect(c,0,0,1280,720,'#ede5cf');const d=180*(1-s.action);c.save();c.globalCompositeOperation='multiply';circle(c,610-d,325,153,'#df694c');circle(c,670+d,325,153,'#4d99ad');c.restore();
 c.save();c.beginPath();c.arc(610-d,325,153,0,7);c.arc(670+d,325,153,0,7);c.clip();for(let y=140;y<510;y+=9)for(let x=280;x<1040;x+=9)circle(c,x+2,y,1.4,'#f0e8d2');c.restore();grain(c,'#65543d',.10);
 text(c,'A',610-d-18,345,42,'#f8efdc',700);text(c,'B',670+d-18,345,42,'#f8efdc',700);line(c,[[643,490],[643,535]],'#2b4546');text(c,'同一张纸，叠出的第三色',478,568,24);caption(c,'两张色版，各自运动','固定套印偏移 · 乘色叠印 · 没有全屏随机闪烁');
},
'swiss-motion':(c,s)=>{
 rect(c,0,0,1280,720,'#efeee9');for(let col=0;col<8;col++)line(c,[[80+col*140,80],[80+col*140,535]],'#d7d7cf',1);
 text(c,'01',80,234,170,'#162126',800);text(c,'秩序',83,340,74,'#162126',800);
 for(let i=0;i<5;i++){const x=510+i*123,y=270;const dy=i===2?-125*s.action:0;rect(c,x,y+dy,90,90,i===2?'#df4c32':'#162126')}
 c.save();c.beginPath();c.rect(510,410,660,85);c.clip();text(c,'偏差，让问题显形。',510,480+90*(1-ramp(s.t,4,5)),52,'#162126',700);c.restore();line(c,[[80,550],[1200,550]],'#162126',2);caption(c,'对象偏离，网格留下证据','切边显字 · 精确落定 · 不使用装饰性弹跳');
},
'data-physical':(c,s)=>{
 rect(c,0,0,1280,720,'#dfd8cb');const g=c.createLinearGradient(0,0,0,570);g.addColorStop(0,'#ebe7df');g.addColorStop(1,'#c8bfae');rect(c,0,0,1280,580,g);
 poly(c,[[240,460],[890,460],[1080,533],[430,533]],'#75685c');poly(c,[[430,533],[1080,533],[1080,546],[430,546]],'#574d44');
 for(let group=0;group<2;group++){const n=group?12:8;const x=410+group*355;let settled=0;for(let i=0;i<n;i++){const p=ramp(s.t,.5+i*.26+group*.3,1+i*.26+group*.3);if(!p)continue;if(p===1)settled++;const y=450-i*20-(1-p)*120;
 c.save();c.globalAlpha=p;poly(c,[[x,y],[x+115,y],[x+150,y+15],[x+35,y+15]],i%5===4?'#c79c4d':group?'#91bdb7':'#dce0df');poly(c,[[x+35,y+15],[x+150,y+15],[x+150,y+28],[x+35,y+28]],group?'#587d78':'#9babae');poly(c,[[x,y],[x+35,y+15],[x+35,y+28],[x,y+13]],group?'#6e9991':'#bac6c5');c.restore()}
 text(c,String(settled),x+20,145,64,'#263533',400);label(c,group?'方案 B':'方案 A',x+10,574)}caption(c,'数值增长，是一片片放上去','1 片 = 1 单位 · A = 8 / B = 12 · 教学设定数据');
},
'rubber-hose':(c,s)=>{
 rect(c,0,0,1280,720,'#131817');rect(c,160,0,960,720,'#c8cbc3');for(let i=0;i<9;i++)line(c,[[160,500+i*24],[1120,500+i*24]],'#a7aca3',1);
 const prep=ramp(s.t,.5,2),release=ramp(s.t,2,3.2),recover=ramp(s.t,4,6);const squash=1-.3*prep+.3*release;const jump=Math.sin(Math.PI*clamp((s.t-2)/2))*140;const y=420-jump;const sw=Math.sin(s.t*3)*8;
 curve(c,[590,y-10],[520,y-115+sw],[485,y-10],'#1e2827',12);curve(c,[690,y-10],[765,y-115-sw],[795,y-15],'#1e2827',12);circle(c,484,y-10,20,'#f5f5eb','#1e2827');circle(c,795,y-15,20,'#f5f5eb','#1e2827');
 curve(c,[608,y+20],[625,y+65],[580,500-jump*.65],'#1e2827',10);curve(c,[675,y+20],[650,y+65],[710,500-jump*.65],'#1e2827',10);circle(c,575,502-jump*.65,13,'#1c2423');circle(c,715,502-jump*.65,13,'#1c2423');c.save();c.translate(640,y-50);c.scale(1/squash,squash);circle(c,0,0,72,'#f0f1e8','#1c2423');circle(c,-22,-10,11,'#1c2423');circle(c,22,-10,11,'#1c2423');line(c,[[-25,24],[0,34],[25,24]],'#1c2423',4);c.restore();rect(c,0,580,1280,140,'#1d2926');caption(c,'先蓄力，再释放','拟人表演 · 肢体预备 → 动作 → 跟随 · 不当作真实力学曲线',true);
},
'pixel-rpg':(c,s)=>{
 if(!pixelSurface){pixelSurface=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(320,180):document.createElement('canvas');pixelSurface.width=320;pixelSurface.height=180}const surface=pixelSurface,p=surface.getContext('2d');rect(p,0,0,320,180,'#102d38');for(let y=10;y<140;y+=8)for(let x=0;x<320;x+=8)rect(p,x,y,7,7,hash(x+y)> .5?'#1e454e':'#20434a');
 const route=[[20,110],[90,110],[90,55],[190,55],[190,105],[292,105]];line(p,route,'#83a89c',10);line(p,route,'#496b68',6);const prog=s.action*(route.length-1),seg=Math.min(route.length-2,Math.floor(prog)),f=prog-seg;const x=Math.round(lerp(route[seg][0],route[seg+1][0],f)),y=Math.round(lerp(route[seg][1],route[seg+1][1],f));
 rect(p,x-4,y-7,9,11,'#f4c368');rect(p,x-4,y-8,9,3,'#f8e2a4');rect(p,x-5,y+4,4,3,'#162b32');rect(p,x+2,y+4,4,3,'#162b32');for(let i=0;i<5;i++)rect(p,24+i*10,18,7,5,i<Math.floor(prog)?'#f4c368':'#3d5c60');rect(p,14,142,292,29,'#e3dab5');text(p,s.t<6?'SIGNAL / FOLLOW THE ROUTE':'ARRIVED / STATE COMMITTED',23,161,9,'#203d44',700,'monospace');c.imageSmoothingEnabled=false;c.drawImage(surface,0,0,1280,720);
},
'silent-film':(c,s)=>{
 rect(c,0,0,1280,720,'#222520');rect(c,160,0,960,720,'#e3dfd1');for(let i=0;i<32;i++)line(c,[[160+i*32,520],[240+i*32,475]],'#c1beaf',1);
 const state=inertiaState(s.t),train=state.car;rect(c,train,370,300,90,'#49504b');circle(c,train+40,477,25,'#222b27');circle(c,train+250,477,25,'#222b27');circle(c,state.ball,347,22,'#c2bba9','#414b43');line(c,[[200,506],[1080,506]],'#697168',4);
 if(s.t>6){rect(c,290,90,700,115,'#263029');line(c,[[303,102],[977,102],[977,193],[303,193],[303,102]],'#d1d1be',1);text(c,'车停下，运动不会立刻消失。',333,159,33,'#e5dfce',500,'serif')}
 rect(c,0,580,1280,140,'#242c25');caption(c,'先看动作，再给名字','同初速 · 小车先制动 · 小球在滑动摩擦下逐渐停住 · 运动学示意',true);
},
'paper-popup':(c,s)=>{
 rect(c,0,0,1280,720,'#7d928f');const grd=c.createLinearGradient(0,180,0,600);grd.addColorStop(0,'#a2b1a2');grd.addColorStop(1,'#667c77');rect(c,0,0,1280,720,grd);
 poly(c,[[180,440],[630,380],[1110,450],[650,563]],'#d3b999');poly(c,[[180,440],[650,535],[650,560],[180,464]],'#635448');poly(c,[[190,427],[640,367],[640,530]],'#f0e6ca');poly(c,[[640,367],[1095,438],[640,530]],'#e7d8b7');
 for(let i=0;i<5;i++){const a=ramp(s.t,i*.35,2+i*.35)*(1-ramp(s.t,10,12))*Math.PI/2,x=335+i*134,y=405+i*11,h=70+i%3*40,w=60;const world=[[0,0],[w,0],[w,h],[w*.5,h+20],[0,h]].map(([u,v])=>foldCard(u,v,a));const proj=([u,v,z])=>[x+u+.3*z,y+.22*u+.25*z-v];poly(c,world.map(([u,v,z])=>[x+u+.3*z+v*.45,y+.22*u+.25*z+v*.2]),'#6c7665');poly(c,world.map(proj),['#587d75','#cf875f','#b4af6f','#5e8e91','#b5745c'][i],'#f4ead4');line(c,[[x,y],[x+w,y+w*.22]],'#c8bfa4',3)}
 rect(c,0,580,1280,140,'#354f49');caption(c,'平面绕着铰链，站进了空间','同一底边 · 由远及近立起 · 折回时保留连接',true);
},
'glass-product':(c,s)=>{
 rect(c,0,0,1280,720,'#10191f');const spread=Math.sin(Math.PI*ramp(s.t,1,10))*115;
 for(let i=0;i<5;i++){const x=640+(i-2)*(60+spread),y=320+(i-2)*13;const grd=c.createLinearGradient(x-50,y-120,x+65,y+120);grd.addColorStop(0,'#9cbabd');grd.addColorStop(.13,'#1c323e');grd.addColorStop(.48,'#304d58');grd.addColorStop(.8,'#14232e');grd.addColorStop(1,'#afc6c9');poly(c,[[x-40,y-110],[x+40,y-133],[x+63,y+95],[x-17,y+118]],grd,'#78939b');line(c,[[x-36,y-108],[x+36,y-129]],'#e2ebdf',2);const py=lerp(y+90,y-95,clamp((s.t-3-i*.15)/2));if(s.t>3+i*.15&&s.t<7)circle(c,x+7,py,6,'#d3edcc')}
 const shine=c.createRadialGradient(640,480,10,640,480,280);shine.addColorStop(0,'#385755');shine.addColorStop(1,'#10191f');c.save();c.globalAlpha=.55;c.scale(1,.3);circle(c,640,1700,320,shine);c.restore();caption(c,'壳体分开，光的路径才看得见','轮廓 → 分层 → 传播 → 回装 · Canvas 材质预演',true);
}
};
export function draw(c,t,w,h,options={}){
 const s=sample(t,options),id=painters[s.id]?s.id:trials[0].id;c.save();c.setTransform(w/1280,0,0,h/720,0,0);c.clearRect(0,0,1280,720);painters[id](c,s);c.restore();return s;
}
export function creationBrief(style,topic='当前讲解主题'){
 const a=style.analysis||{};
 return {schemaVersion:1,source:'lemomo-ai/lemo-opuscar',commit:'3961ddb3d24d8876e0e2754f7790d66908acee51',styleId:style.id,topic,look:a.look,motion:a.motion,camera:a.camera,type:a.type,story:a.story,avoid:a.avoid,exercise:a.exercise,trial:trials.some(t=>t.id===style.slug)?'lab/modules/lemo-trials.js':null,requirements:['先写三个不同的故事结构，再选择风格。','为当前主题写开场—变化—结果；同一对象贯穿镜头。','先验三个实际代码静帧和最难连续动作。','采用当前用户的 TTS 与音乐工作流；音效只跟有意义的动作。','原始资料、示意和计算结果分开标记。','原片未逐片听审；候选需在当前项目重新校验。']};
}
