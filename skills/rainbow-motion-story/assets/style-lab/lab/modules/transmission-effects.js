/** Original transport illustrations; temporal integration is a display-space preview. */
import {begin,end,text,line,path,circle,roundRect,clamp,mix,smooth,candidate,optionsFor} from './common.js';
export const TRACKING_DURATION=18,RELAY_DURATION=20;
const timeAt=(t,d)=>clamp(Number.isFinite(t)?t:0,0,d);
const progress=(t,a,b)=>smooth((t-a)/(b-a));
const slope=q=>q<=0||q>=1?0:30*q*q*(q-1)*(q-1);
const stageIndex=(t,times)=>Math.max(0,times.findLastIndex(start=>t>=start));
export const TRACKING_STAGES=Object.freeze([0,1.4,3.4,5.2,7.2,9.2,11.2,13.4,15.2]);
export const TRACKING_MOVES=Object.freeze([
    {start:1.4,end:2.4,from:-4,to:0},{start:3.4,end:4.15,from:0,to:5},
    {start:5.2,end:6.25,from:5,to:-5},{start:9.2,end:9.95,from:-5,to:4.5},
    {start:11.2,end:12.1,from:4.5,to:-3.5},{start:13.4,end:15.2,from:-3.5,to:0}
].map(Object.freeze));
export function trackingOptions(options={}){
    return {...optionsFor(options),fps:options.fps===60?60:30,
        shutterAngle:clamp(Number.isFinite(options.shutterAngle)?options.shutterAngle:180,0,360),
        samples:Math.round(clamp(Number.isFinite(options.samples)?options.samples:16,4,64)),
        cameraMode:options.cameraMode==='follow'?'follow':'fixed',
        blurMode:['none','temporal','spatial'].includes(options.blurMode)?options.blurMode:'temporal'};
}
/** Midpoint quadrature on the clipped exposure interval, weights always sum to one. */
export function sampleExposureTimes(rawTime,options={}){
    const time=timeAt(rawTime,TRACKING_DURATION),o=trackingOptions(options),span=o.shutterAngle/360/o.fps;
    if(span===0)return [{time,weight:1}];
    const start=Math.max(0,time-span/2),end=Math.min(TRACKING_DURATION,time+span/2);
    return Array.from({length:o.samples},(_,i)=>({time:start+(i+.5)/o.samples*(end-start),weight:1/o.samples}));
}
function motionAt(time){
    let x=-4,velocity=0;
    for(const move of TRACKING_MOVES){
        if(time<move.start)break;
        const q=clamp((time-move.start)/(move.end-move.start));x=mix(move.from,move.to,smooth(q));
        velocity=(move.to-move.from)/(move.end-move.start)*slope(q);
    }
    return {x,velocity};
}
const TRACK_SCALE=89;
function trackingState(rawTime,options){
    const time=timeAt(rawTime,TRACKING_DURATION),motion=motionAt(time),follow=options.cameraMode==='follow';
    const camera={x:follow?motion.x:0,velocity:follow?motion.velocity:0,scale:TRACK_SCALE,mode:options.cameraMode};
    const packets=Array.from({length:5},(_,i)=>{
        const x=motion.x+(i-2)*1.15,y=-(i%2)*.09;
        return {id:`data-${i+1}`,world:[x,y,0],position:[700+(x-camera.x)*TRACK_SCALE,210+y*TRACK_SCALE],width:78,height:116,
            worldVelocity:[motion.velocity,0,0],screenVelocity:[(motion.velocity-camera.velocity)*TRACK_SCALE,0],lead:i===2};
    });
    return {time,world:{leadX:motion.x,leadVelocity:motion.velocity},camera,packets,
        projected:packets.map(p=>({id:p.id,position:p.position})),screenVelocity:packets[2].screenVelocity,
        backgroundScreenVelocity:-camera.velocity*TRACK_SCALE};
}
export function sampleTracking(rawTime,options={}){
    const o=trackingOptions(options),s=trackingState(rawTime,o),exposure=sampleExposureTimes(s.time,o);
    const states=exposure.map(sample=>trackingState(sample.time,o));
    const shutterSeconds=o.shutterAngle/360/o.fps;
    const maxScreenVelocity=Math.max(Math.abs(s.screenVelocity[0]),Math.abs(s.backgroundScreenVelocity));
    return {...s,stageIndex:stageIndex(s.time,TRACKING_STAGES),phase:s.time>=15.2?'result':s.world.leadVelocity===0?'hold':'motion',
        annotation:o.cameraMode==='follow'?'跟住同一组数据：主体可停在屏幕里，背景仍在移动。':'固定机位：数据跨过屏幕，背景留在原地。',
        options:{fps:o.fps,shutterAngle:o.shutterAngle,samples:o.samples,cameraMode:o.cameraMode,blurMode:o.blurMode},
        shutterSeconds,exposure,sampleStates:states,
        spatialPixels:Math.min(24,maxScreenVelocity*shutterSeconds/Math.sqrt(12)),
        geometryStable:s.world.leadVelocity===0,readHold:states.every(state=>state.world.leadVelocity===0)};
}

// Only canvas allocations are cached. Both sample and sum pixels are rebuilt for every draw.
const exposureCache=new WeakMap();
function exposureBuffers(ctx,width){
    const actualWidth=Math.max(350,Math.min(1400,Math.round(width*1400/1600))),actualHeight=Math.round(actualWidth*420/1400);
    let buffer=exposureCache.get(ctx);
    if(!buffer||buffer.width!==actualWidth){
        const make=()=>{const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(actualWidth,actualHeight):document.createElement('canvas');canvas.width=actualWidth;canvas.height=actualHeight;return canvas;};
        buffer={width:actualWidth,height:actualHeight,sample:make(),sum:make()};exposureCache.set(ctx,buffer);
    }
    return buffer;
}
function drawTrackingScene(ctx,s,p,width=1400,height=420){
    ctx.setTransform(width/1400,0,0,height/420,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
    ctx.fillStyle=p.bg;ctx.fillRect(0,0,1400,420);
    const floor=ctx.createLinearGradient(0,70,0,420);floor.addColorStop(0,p.bg);floor.addColorStop(1,p.panel);ctx.fillStyle=floor;ctx.fillRect(0,0,1400,420);
    // Broad structural patches survive small A/B preview sizes; no full-screen luminous grid.
    for(let i=-12;i<=12;i++){
        const x=700+(i*2.7-s.camera.x)*TRACK_SCALE*.68;if(x<-180||x>1580)continue;
        const wide=i%2===0?66:36;
        roundRect(ctx,x-wide/2,89,wide,91,5,p.line+'88');
        roundRect(ctx,x-wide/2+6,95,wide-12,10,2,i%3===0?p.gold+'99':p.muted+'77');
        line(ctx,[x,180],[x,284],p.line+'70',9);
    }
    // Three static depth layers. Their displacement is recomputed from the current camera.
    for(const layer of [{scale:.43,y:105,alpha:.3},{scale:.72,y:150,alpha:.48},{scale:1,y:335,alpha:.7}]){
        ctx.save();ctx.globalAlpha=layer.alpha;
        for(let i=-22;i<=22;i++){
            const x=700+(i-s.camera.x)*TRACK_SCALE*layer.scale;if(x<-100||x>1500)continue;
            if(layer.scale<1){line(ctx,[x,layer.y-65],[x,layer.y+17],p.line,2);line(ctx,[x,layer.y-65],[x+26,layer.y-65],p.line,2);}
            else {line(ctx,[x,layer.y],[x,layer.y+12],p.muted,1.5);text(ctx,i,x,layer.y+31,15,p.muted,500,'center');}
        }ctx.restore();
    }
    line(ctx,[0,333],[1400,333],p.line,2);line(ctx,[0,262],[1400,262],p.line,1);
    for(let i=-18;i<=18;i++){
        const x=700+(i*1.8-s.camera.x)*TRACK_SCALE*1.18;if(x<-80||x>1480)continue;
        const width=i%3===0?64:34;
        path(ctx,[[x-width/2,384],[x+width/2,384],[x+width/2+13,395],[x-width/2-13,395]],p.line,1,true,i%3===0?p.gold+'a0':p.muted+'70');
        if(i%3===0)roundRect(ctx,x-30,65,60,8,3,p.cyan+'aa');
    }
    // Packets remain rigid and retain ID markings at every exposure sample.
    for(const packet of s.packets){
        const [x,y]=packet.position;ctx.save();ctx.translate(x,y);
        ctx.fillStyle='#00000030';ctx.beginPath();ctx.ellipse(8,89,48,9,0,0,Math.PI*2);ctx.fill();
        const g=ctx.createLinearGradient(-39,-58,39,58);g.addColorStop(0,packet.lead?p.gold:p.cyan);g.addColorStop(.52,packet.lead?'#d4a261':'#6dafb4');g.addColorStop(1,packet.lead?'#987d56':'#35616a');
        path(ctx,[[39,-58],[51,-69],[51,47],[39,58]],p.line,1,true,packet.lead?'#8f704a':'#31545e');
        path(ctx,[[-39,-58],[-27,-69],[51,-69],[39,-58]],p.ink+'55',1,true,packet.lead?'#e8bf82':'#91d2d0');
        roundRect(ctx,-39,-58,78,116,8,g,p.ink+'88');line(ctx,[-25,-38],[24,-38],p.ink+'cc',3);
        line(ctx,[-25,42],[24,42],p.bg+'77',4);text(ctx,packet.id.slice(-1),0,3,38,p.bg,750,'center');ctx.restore();
    }
}
export function drawTracking(ctx,t,w,h,options={}){
    const o=trackingOptions(options),s=sampleTracking(t,o),p=o.theme;
    begin(ctx,w,h,{title:'镜头追上数据时，谁应该变模糊？',subtitle:'同一场景 · 同一当前时刻 · 每个曝光子样本重新计算物体和相机',palette:p});
    const buffers=exposureBuffers(ctx,w),sample=buffers.sample.getContext('2d'),sum=buffers.sum.getContext('2d');
    const drawOne=state=>drawTrackingScene(sample,state,p,buffers.width,buffers.height);
    sum.setTransform(1,0,0,1,0,0);sum.globalAlpha=1;sum.globalCompositeOperation='source-over';sum.filter='none';sum.clearRect(0,0,buffers.width,buffers.height);
    if(o.blurMode==='temporal'){
        let accumulated=0;
        s.exposure.forEach((sampleTime,i)=>{drawOne(s.sampleStates[i]);accumulated+=sampleTime.weight;sum.globalAlpha=sampleTime.weight/accumulated;sum.drawImage(buffers.sample,0,0);});
    }else{drawOne(s);sum.globalAlpha=1;sum.filter=o.blurMode==='spatial'?`blur(${s.spatialPixels*buffers.width/1400}px)`:'none';sum.drawImage(buffers.sample,0,0);sum.filter='none';}
    sum.globalAlpha=1;
    ctx.save();ctx.beginPath();ctx.roundRect(100,255,1400,420,12);ctx.clip();ctx.fillStyle=p.bg;ctx.fillRect(100,255,1400,420);ctx.drawImage(buffers.sum,100,255,1400,420);ctx.restore();
    // This HUD is intentionally outside the exposure accumulation and spatial filter.
    const mode={none:'单一时刻 · 不模糊',temporal:'时间采样 · 多状态均值',spatial:'空间滤镜 · 匹配运动量级的高斯对照'}[o.blurMode];
    text(ctx,mode,100,210,30,p.ink,650);text(ctx,o.cameraMode==='follow'?'跟随机位':'固定机位',1500,210,25,p.gold,650,'right');
    text(ctx,`数据速度  ${s.world.leadVelocity.toFixed(2)} 单位/s`,120,720,22,p.muted,500);
    text(ctx,`屏幕相对速度  ${s.screenVelocity[0].toFixed(0)} px/s`,770,720,22,p.cyan,600,'center');
    text(ctx,`${s.time.toFixed(3)} s`,1480,720,23,p.ink,650,'right');
    text(ctx,`${o.fps} fps  ·  ${o.shutterAngle}°  ·  ${(s.shutterSeconds*1000).toFixed(2)} ms  ·  ${o.blurMode==='temporal'?s.exposure.length:1} 个新状态`,800,774,24,p.ink,500,'center');
    text(ctx,o.blurMode==='spatial'?'对照滤镜会一并软化主体；它没有计算曝光期间的新位置。':o.cameraMode==='follow'?'主体相对屏幕静止，背景留下位移；模糊来自相对运动。':'快速位移留下曝光宽度，停住后恢复清晰；文字单独绘制。',800,826,22,p.muted,500,'center');
    end(ctx);return s;
}

export const RELAY_STAGE_TIMES=Object.freeze([0,1.4,3.1,4.7,6.5,8.8,9.4,11.2,14,15.6]);
export const PACKET_EVENTS=Object.freeze([4.7,5.1,5.5,9.4,9.8,10.2].map((sentAt,i)=>Object.freeze({
    id:`P${i+1}`,index:i,byteStart:i*100,byteEnd:(i+1)*100,sentAt,receivedAt:sentAt+1.8,
    ackDepartAt:sentAt+1.8+.2,ackArrivedAt:[8.8,9.2,9.6,14,14.4,14.8][i]
})));
export function sampleWindowRelay(rawTime){
    const time=timeAt(rawTime,RELAY_DURATION),confirmed=PACKET_EVENTS.filter(event=>time>=event.ackArrivedAt).length;
    const visualBase=PACKET_EVENTS.reduce((n,event)=>n+progress(time,event.ackArrivedAt,event.ackArrivedAt+.55),0);
    const zoom=1+.2*progress(time,1.4,3.1)*(1-progress(time,15.6,17.1));
    const camera={zoom,center:mix(3,clamp(2.1+visualBase*.32,2.1,3.7),progress(time,1.4,3.1)*(1-progress(time,15.6,17.1)))};
    const project=x=>800+(x-camera.center)*155*camera.zoom;
    const packets=PACKET_EVENTS.map(event=>{
        const sent=time>=event.sentAt,received=time>=event.receivedAt,acked=time>=event.ackArrivedAt;
        return {...event,state:acked?'acknowledged':received?'received':sent?'in-flight':'queued',
            eligible:event.index>=confirmed&&event.index<Math.min(6,confirmed+3),
            slot:[project(event.index+.5),398],transport:clamp((time-event.sentAt)/(event.receivedAt-event.sentAt)),
            ackProgress:clamp((time-event.ackDepartAt)/(event.ackArrivedAt-event.ackDepartAt)),
            flying:sent&&!received,ackFlying:time>=event.ackDepartAt&&!acked};
    });
    const phase=time<1.4?'overview':time<3.1?'push-in':time<4.7?'read-window':time<8.8?'send-and-wait':time<14?'acknowledge-and-relay':time<15.6?'final-acknowledgment':time<17.1?'pullback':'result';
    const window={capacityBytes:300,byteStart:confirmed*100,byteEnd:Math.min(600,confirmed*100+300),visualStart:visualBase,visualEnd:Math.min(6,visualBase+3),
        left:project(visualBase),right:project(Math.min(6,visualBase+3)),alpha:1-progress(time,15.2,15.6)};
    const geometryStable=(time<1.4||(time>=3.1&&time<4.7)||time>=17.1);
    return {time,phase,stageIndex:stageIndex(time,RELAY_STAGE_TIMES),camera,packets,window,
        sentCount:packets.filter(p=>p.state!=='queued').length,receivedCount:packets.filter(p=>p.state==='received'||p.state==='acknowledged').length,confirmedCount:confirmed,
        ticks:Array.from({length:7},(_,i)=>({byte:i*100,x:project(i)})),
        annotation:time<4.7?'同一个框，最多保留三包尚未确认的数据。':time<8.8?'包已发出，窗口仍等确认返回。':time<15.6?'确认到达后，窗口才向前；新包从腾出的空间接力。':'六包均已确认，发送记录与接收结果一致。',
        geometryStable,readHold:geometryStable,finalAlpha:progress(time,15.6,17.1)};
}
function packetShape(ctx,id,x,y,color,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);roundRect(ctx,-38,-25,76,50,7,color);text(ctx,id,0,0,24,'#14252d',750,'center');ctx.restore();}
export function drawWindowRelay(ctx,t,w,h,options={}){
    const o=optionsFor(options),p=o.theme,s=sampleWindowRelay(t);
    begin(ctx,w,h,{title:'窗口什么时候，才该向前？',subtitle:'6 包 × 100 B · 容量 300 B · 简化发送与确认示意',palette:p});
    text(ctx,'发送端',165,222,24,p.ink,650);text(ctx,'接收端',1435,222,24,p.ink,650,'right');
    line(ctx,[190,278],[1410,278],p.line,2);line(ctx,[190,584],[1410,584],p.line,2);
    text(ctx,'数据 →',800,235,20,p.gold,600,'center');text(ctx,'← 确认',800,620,20,p.cyan,600,'center');
    roundRect(ctx,140,251,50,54,8,p.panel,p.line);roundRect(ctx,1410,251,50,54,8,p.panel,p.line);
    // Physical travelling token and sequence ledger are two named views of the same event.
    for(const packet of s.packets){
        if(packet.flying)packetShape(ctx,packet.id,mix(215,1385,packet.transport),278,p.gold,.7);
        if(packet.ackFlying){const x=mix(1385,215,packet.ackProgress);circle(ctx,x,584,15,p.cyan);text(ctx,packet.id,x,584,13,p.bg,750,'center');}
    }
    ctx.save();ctx.beginPath();ctx.rect(100,323,1400,190);ctx.clip();
    for(const packet of s.packets){
        const color=packet.state==='acknowledged'?p.cyan:packet.state==='queued'?p.line:p.gold;
        roundRect(ctx,packet.slot[0]-54,packet.slot[1]-36,108,72,9,packet.state==='queued'?p.panel:color+'28',color);
        text(ctx,packet.id,...packet.slot,27,packet.state==='queued'?p.muted:color,700,'center');
        if(packet.state==='acknowledged')text(ctx,'✓',packet.slot[0]+33,packet.slot[1]-22,17,p.cyan,700,'center');
    }
    ctx.save();ctx.globalAlpha=s.window.alpha;
    if(s.window.right-s.window.left>14){roundRect(ctx,s.window.left+7,346,s.window.right-s.window.left-14,105,10,null,p.gold);line(ctx,[s.window.left+7,447],[s.window.right-7,447],p.gold,3);}
    ctx.restore();
    s.ticks.forEach(tick=>{line(ctx,[tick.x,469],[tick.x,480],p.muted,1.5);text(ctx,tick.byte,tick.x,499,18,p.muted,500,'center');});
    line(ctx,[s.ticks[0].x,470],[s.ticks.at(-1).x,470],p.line,1.5);ctx.restore();
    text(ctx,'序号记录 / B',100,536,19,p.muted,500);text(ctx,`当前窗口  ${s.window.byteStart}—${s.window.byteEnd} B`,1500,536,22,p.gold,650,'right');
    const labels=[['已发送',s.sentCount,p.gold],['接收端已到',s.receivedCount,p.ink],['发送端已确认',s.confirmedCount,p.cyan]];
    labels.forEach(([label,value,color],i)=>{const x=330+i*470;text(ctx,label,x,705,22,p.muted,500,'center');text(ctx,`${value} / 6`,x,750,38,color,700,'center');});
    text(ctx,s.annotation,800,824,24,p.ink,550,'center');
    end(ctx);return s;
}
export const trackingCandidate=candidate({id:'look-tracking-exposure',module:'look',title:'跟上数据：相机也参与曝光',duration:18,loop:false,previewTime:9.575,
    stageTimes:[...TRACKING_STAGES],stages:['建立数据','短距离推进','快速横移','反向横移','停住观察','快速返回','再次穿行','减速落定','稳定读定'],controls:{intensity:false},
    codeFile:'modules/transmission-effects.js',referenceIds:['transmission'],
    description:'每个曝光子时刻重新计算数据和相机；比较无模糊、多状态均值与单帧空间滤镜。',
    usage:'用相同场景比较固定/跟随机位的屏幕相对速度。Canvas显示空间平均是预览近似，不等同线性HDR渲染。',
    recipe:['快门时长由角度和帧率推得。','每个子样本重新求相机与物体，不缓存旧帧。','HUD在均值合成后绘制；静止时保留阅读窗口。']
},sampleTracking,(ctx,t,w,h,o)=>drawTracking(ctx,t,w,h,o));
export const windowRelayCandidate=candidate({id:'visualization-window-relay',module:'visualization',title:'同一个窗口，等确认再向前',duration:20,loop:false,previewTime:9.55,
    stageTimes:[...RELAY_STAGE_TIMES],stages:['两端全景','同一框推近','看清窗口','第一组三包','接收后回确认','确认后才移动','新三包接力','等待确认返回','末组确认','回到完整读定'],controls:{intensity:false},
    codeFile:'modules/transmission-effects.js',referenceIds:['transmission'],
    description:'固定六包身份，发送、接收、确认和窗口位置共享一个事件表；推近后刻度仍保留原单位。',
    usage:'容量固定的简化确认机制，不代表完整TCP，也未模拟丢包、拥塞或重传。',
    recipe:['先建立完整数据带，再推近同一个窗口。','包发出并不移动窗口，确认到达才腾出空间。','状态标签读取事件，最终回全景核对。']
},sampleWindowRelay,(ctx,t,w,h,o)=>drawWindowRelay(ctx,t,w,h,o));
export const candidates=[trackingCandidate,windowRelayCandidate];
