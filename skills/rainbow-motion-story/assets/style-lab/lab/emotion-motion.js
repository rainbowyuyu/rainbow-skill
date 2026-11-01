/** Original motion/emotion studies. Absolute-time sampling; no wall clock.
 * Source references informed questions, not geometry, palette or audio samples.
 * This is a graphic motion study, not measured material or camera physics.
 */
import {sampleCurve} from './rate-curves.js';
import {synthesizeSound} from './sound-design.js';

const TAU=2*Math.PI,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const finite=(v,name)=>{if(!Number.isFinite(v))throw new TypeError(`${name} must be finite`);return v;};
const S=u=>{const q=clamp(u);return q*q*q*(10+q*(-15+6*q));};
const Q=u=>({p:u*u*u*(10+u*(-15+6*u)),v:30*u*u*(1-u)*(1-u),a:60*u*(1-u)*(1-2*u)});
const STILL=(x,y)=>({x,y,vx:0,vy:0,ax:0,ay:0});
const X0=.18,X1=.78,Y=.55,R=.055,FLOOR=Y+R;
const BOUNCE_START=.3,BOUNCE_DURATION=2.35,BOUNCE_TOP=.22,BOUNCE_DISTANCE=Y-BOUNCE_TOP;
const bounceSource=sampleCurve('impact-rebound',0,{rebound:.3});
const bounceContacts=bounceSource.discontinuities.filter(e=>e.kind==='ideal-impact'||e.kind==='final-inelastic-contact');
const bounceGravity=bounceSource.acceleration;
const bounceFlights=[{u:0,p:0,v:0},...bounceContacts.filter(e=>e.u<1).map(e=>({u:e.u,p:e.right.position,v:e.right.velocity}))];
const THEMES=Object.freeze({background:'#101c25',ink:'#f1e7d5',muted:'#9cb1b5',accent:'#8bd0c3',warm:'#dca971',line:'#3b535c',shadow:'#030a10'});

export const presets=Object.freeze([
  {id:'fast',title:'快 · 先抢一步',description:'短预备、快速横移、清楚落定。',feeling:'急促但有目标',useCase:'揭示结果、视线交接、短距离进入',risk:'速度不是越高越好；先让终点可读。',duration:4},
  {id:'slow',title:'慢 · 把过程留住',description:'长推进、低速度、从柔焦到清楚。',feeling:'从容、靠近、给细节时间',useCase:'材质观察、关系建立、渐近揭示',risk:'柔焦只是图形表现；慢尾不能无限拖延。',duration:4},
  {id:'stop',title:'停 · 让结果说话',description:'逐渐启动、匀速靠近止挡、接触后真正静止。',feeling:'明确、克制、落定',useCase:'关键结论、接触状态、阅读窗口',risk:'这是理想非弹性接触，速度有跳变，不是假装C2。',duration:4},
  {id:'bounce',title:'弹 · 留一点回响',description:'先落下，再越弹越轻，最后安稳停住。',feeling:'轻快、有接触的余动',useCase:'碰撞时机、弹性表意、一次确认',risk:'理想瞬时接触；参数不是某种真实材料的测量。',duration:4},
].map(Object.freeze));
const BY_ID=new Map(presets.map(p=>[p.id,p]));
export function durationFor(id){if(id==='reel')return 15;if(BY_ID.has(id))return 4;throw new RangeError(`Unknown emotion motion: ${id}`);}
function validateVisual(options){const mode=options.mode??'object';if(!['object','type'].includes(mode))throw new RangeError('mode must be object or type');return mode;}
function validateAudio(options){const soundStyle=options.soundStyle??'matched',gain=options.gain??.65,sampleRate=options.sampleRate??48000;
  if(!['matched','neutral'].includes(soundStyle))throw new RangeError('soundStyle must be matched or neutral');
  if(!Number.isFinite(gain)||gain<0||gain>1)throw new RangeError('gain must be in [0,1]');
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw new RangeError('sampleRate must be an integer in [8000,192000]');
  return {soundStyle,gain,sampleRate};
}
function smoothMove(t,start,end,from,to){
  if(t<start)return {p:from,v:0,a:0};if(t>=end)return {p:to,v:0,a:0};
  const d=end-start,q=Q((t-start)/d),delta=to-from;
  return {p:from+delta*q.p,v:delta*q.v/d,a:delta*q.a/(d*d)};
}
function basePose(id,t){
  if(id==='fast'){
    const s=t<.37?smoothMove(t,.12,.37,X0,.14):smoothMove(t,.37,1.18,.14,X1);
    return {x:s.p,y:Y,vx:s.v,vy:0,ax:s.a,ay:0};
  }
  if(id==='slow'){
    const s=smoothMove(t,.35,3.2,X0,X1);return {x:s.p,y:Y,vx:s.v,vy:0,ax:s.a,ay:0};
  }
  if(id==='stop'){
    const start=.35,ramp=.25,end=1.45,topVelocity=(X1-X0)/(end-start-ramp/2);
    if(t<start)return STILL(X0,Y);if(t>=end)return STILL(X1,Y);
    if(t<start+ramp){const q=(t-start)/ramp,integral=2.5*q**4-3*q**5+q**6;
      return {x:X0+topVelocity*ramp*integral,y:Y,vx:topVelocity*S(q),vy:0,ax:topVelocity*Q(q).v/ramp,ay:0};}
    return {x:X0+topVelocity*(t-start-ramp/2),y:Y,vx:topVelocity,vy:0,ax:0,ay:0};
  }
  if(id==='bounce'){
    if(t<BOUNCE_START)return STILL(.5,BOUNCE_TOP);if(t>=BOUNCE_START+BOUNCE_DURATION)return STILL(.5,Y);
    let f=bounceFlights[0];for(const flight of bounceFlights)if(BOUNCE_START+flight.u*BOUNCE_DURATION<=t)f=flight;
    const dt=(t-(BOUNCE_START+f.u*BOUNCE_DURATION))/BOUNCE_DURATION,p=f.p+f.v*dt+.5*bounceGravity*dt*dt;
    return {x:.5,y:BOUNCE_TOP+BOUNCE_DISTANCE*p,vx:0,vy:BOUNCE_DISTANCE*(f.v+bounceGravity*dt)/BOUNCE_DURATION,ax:0,ay:BOUNCE_DISTANCE*bounceGravity/(BOUNCE_DURATION**2)};
  }
  throw new RangeError(`Unknown base motion: ${id}`);
}
const e=(id,kind,time,anchor,priority=1,extra={})=>({id,kind,time,anchor,priority,...extra});
const BASE_EVENTS={
  fast:[e('prepare','onset',.12,'onset',.4),e('release','release',.37,'onset',.7),e('fastest','peak',.775,'peak',.5),e('arrive','arrival',1.18,'end',1),e('read','reading',1.42,'onset',0)],
  slow:[e('start','onset',.35,'onset',.4),e('fastest','peak',1.775,'peak',.4),e('arrive','arrival',3.2,'end',1),e('read','reading',3.52,'onset',0)],
  stop:[e('start','onset',.35,'onset',.4),e('cruise','peak',.6,'peak',.4),e('contact','contact',1.45,'contact',1,{incomingVelocity:(X1-X0)/(1.45-.35-.25/2),outgoingVelocity:0}),e('read','reading',1.68,'onset',0)],
  bounce:[e('release','onset',BOUNCE_START,'onset',.4),...bounceContacts.map((c,i)=>e(`contact-${i+1}`,'contact',BOUNCE_START+c.u*BOUNCE_DURATION,'contact',1,{incomingVelocity:c.left.velocity*BOUNCE_DISTANCE/BOUNCE_DURATION,outgoingVelocity:c.right.velocity*BOUNCE_DISTANCE/BOUNCE_DURATION,strength:Math.sqrt(.3)**i})),e('read','reading',2.84,'onset',0)],
};
const READ_START=Object.fromEntries(Object.entries(BASE_EVENTS).map(([id,es])=>[id,es.find(e=>e.kind==='reading').time]));
const MOTION_END={fast:1.18,slow:3.2,stop:1.45,bounce:2.65};
const MOTION_START={fast:.12,slow:.35,stop:.35,bounce:.3};
function eventSheet(id){
  durationFor(id);
  if(id!=='reel')return BASE_EVENTS[id].map(event=>({...event,id:`${id}:${event.id}`,sourceId:id,localTime:event.time,timeScale:1}));
  const events=[];
  presets.forEach((p,index)=>{
    const offset=index*3,scale=4/3;
    if(index)events.push(e(`cut-${index}`,'cut',offset,'onset',0,{from:presets[index-1].id,to:p.id,continuity:'explicit editorial cut'}));
    for(const event of BASE_EVENTS[p.id])events.push({...event,id:`${p.id}:${event.id}`,sourceId:p.id,localTime:event.time,timeScale:scale,time:offset+event.time/scale,
      ...(event.incomingVelocity!==undefined?{incomingVelocity:event.incomingVelocity*scale,outgoingVelocity:event.outgoingVelocity*scale}:{})});
  });
  events.push(e('cut-overview','cut',12,'onset',0,{from:'bounce',to:'overview',continuity:'explicit editorial cut'}));
  events.push(e('overview-read','reading',12.3,'onset',0));
  return events;
}
function timeline(id,t){
  if(id!=='reel')return {activeId:id,localTime:t,timeScale:1,offset:0};
  if(t>=12)return {activeId:'overview',localTime:t-12,timeScale:1,offset:12};
  const index=Math.min(3,Math.floor(t/3));return {activeId:presets[index].id,localTime:(t-index*3)*4/3,timeScale:4/3,offset:index*3};
}
function scaledPose(p,scale){return {...p,vx:p.vx*scale,vy:p.vy*scale,ax:p.ax*scale*scale,ay:p.ay*scale*scale};}

export function sample(id,t,options={}){
  const duration=durationFor(id),mode=validateVisual(options),time=clamp(finite(t,'time'),0,duration),clock=timeline(id,time),events=eventSheet(id);
  const exactEvent=events.find(e=>e.time===time&&e.sourceId===clock.activeId);
  if(exactEvent)clock.localTime=exactEvent.localTime;
  const overview=clock.activeId==='overview',pose=overview?STILL(.5,Y):scaledPose(basePose(clock.activeId,clock.localTime),clock.timeScale),speed=Math.hypot(pose.vx,pose.vy);
  const reading=overview?clock.localTime>=.3:clock.localTime>=READ_START[clock.activeId];
  const stage=overview?'整合观察':reading?'留给阅读':clock.localTime<MOTION_START[clock.activeId]?'准备':clock.localTime>=MOTION_END[clock.activeId]?'落定':clock.activeId==='fast'&&clock.localTime<.37?'预备后撤':'动作';
  const axis=clock.activeId==='bounce'?'y':'x';
  const nearbyContacts=events.filter(e=>e.kind==='contact'&&time>=e.time&&time-e.time<.18);
  return {id,time,duration,mode,...clock,stage,reading,cut:events.some(e=>e.kind==='cut'&&e.time===time),events,
    object:{x:pose.x,y:pose.y,rotation:0,scaleX:clock.activeId==='fast'?1+.08*Math.min(speed/1.5,1):1,scaleY:1,radius:R,
      velocity:{x:pose.vx,y:pose.vy},acceleration:{x:pose.ax,y:pose.ay},speed},
    motion:{signedVelocity:axis==='x'?pose.vx:pose.vy,speed,axis,unit:'normalized-canvas/s',acceleration:axis==='x'?pose.ax:pose.ay},
    floor:FLOOR,target:{x:clock.activeId==='bounce'?.5:X1,y:Y},contactPulses:nearbyContacts.map(e=>({eventId:e.id,time:e.time,age:time-e.time,strength:e.strength??1})),
    theme:{...THEMES},overview:overview?presets.map(p=>({id:p.id,title:p.title,word:({fast:'抵达',slow:'靠近',stop:'落定',bounce:'回响'})[p.id]})):null};
}

function mappedCue(id,baseId,offset,scale,event,kind,duration,gain,index){
  const anchorTime=offset+event.time/scale,start=kind==='air-motion'?offset+MOTION_START[baseId]/scale:anchorTime;
  const end=kind==='air-motion'?offset+MOTION_END[baseId]/scale:start+duration/scale;
  return {id:`${id}:${baseId}:${event.id}:${kind}`,eventId:`${baseId}:${event.id}`,sound:kind,sourceId:baseId,anchor:event.anchor,anchorTime,
    anchorOffset:anchorTime-start,start,end,duration:end-start,priority:event.priority,gain,seed:3707+index*7919,
    clock:{offset,scale},pan:kind==='air-motion'?'follows-object':0,
    ...(kind==='air-motion'?{speedReference:1.6,envelope:'actual speed / speedReference, clamped; 8ms edge ramps and 6ms contact gates',attackSeconds:.008,releaseSeconds:.008,
      contactTimes:BASE_EVENTS[baseId].filter(e=>e.kind==='contact').map(e=>offset+e.time/scale)}:{attackSeconds:kind==='ui-confirm'?.007:.0015})};
}

export function getCueSheet(id,options={}){
  durationFor(id);const {soundStyle,gain}=validateAudio(options),cues=[];
  const sources=id==='reel'?presets.map((p,i)=>({id:p.id,offset:i*3,scale:4/3})):[{id,offset:0,scale:1}];
  for(const source of sources){
    const events=BASE_EVENTS[source.id];
    if(soundStyle==='matched'){
      const peak=events.find(e=>e.kind==='peak')??events.find(e=>e.kind==='onset');
      // A single continuous noise field reads the actual signed trajectory's speed.
      cues.push(mappedCue(id,source.id,source.offset,source.scale,peak,'air-motion',0,.15*gain,cues.length));
    }
    for(const event of events.filter(e=>e.kind==='arrival'||e.kind==='contact')){
      const sound=soundStyle==='neutral'?'ui-confirm':({fast:'wood-contact',slow:'metal-contact',stop:'low-impact',bounce:'wood-contact'})[source.id];
      const duration=soundStyle==='neutral'?.12:({fast:.16,slow:.28,stop:.16,bounce:.14})[source.id];
      const strength=soundStyle==='neutral'?1:(event.strength??1);
      const cueGain=(soundStyle==='neutral'?.16:source.id==='slow'?.12:source.id==='stop'?.26:.23)*strength*gain;
      const cue=mappedCue(id,source.id,source.offset,source.scale,event,sound,duration,cueGain,cues.length);
      // Neutral is the exact same dry source every time, at identical event anchors.
      cue.seed=soundStyle==='neutral'?9109:4309+Math.round(event.time*1000);
      cue.params=source.id==='slow'&&soundStyle==='matched'?{decay:.09}:{};
      cues.push(cue);
    }
  }
  return cues.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
}

/** Public control trace for auditing. Gain uses actual absolute-time speed.
 * This maps graphic motion to sound; it is not measured airflow or Doppler.
 */
export function audioControlAt(cue,time){
  finite(time,'time');
  const local=(time-cue.clock.offset)*cue.clock.scale;
  const p=scaledPose(basePose(cue.sourceId,local),cue.clock.scale),speed=Math.hypot(p.vx,p.vy);
  const inside=time>=cue.start&&time<cue.end;
  let edge=inside?S((time-cue.start)/.008)*S((cue.end-time)/.008):0;
  // Ideal contact has a velocity jump; mute airflow at the event so filtered
  // noise cannot add an unrelated digital click to the intentional impact cue.
  for(const contactTime of cue.contactTimes??[])edge*=S(Math.abs(time-contactTime)/.006);
  return {speed,pan:clamp((p.x-.5)*1.6,-.8,.8),envelope:cue.sound==='air-motion'?clamp(speed/cue.speedReference)*edge:edge,
    frequency:450+2400*clamp(speed/(cue.speedReference??1.6)),unit:'normalized-canvas/s'};
}
function rng(seed){let state=seed>>>0;return()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296*2-1;};}
function lowpass(freq,sampleRate){return 1-Math.exp(-TAU*freq/sampleRate);}

export function renderAudio(id,options={}){
  const duration=durationFor(id),{sampleRate}=validateAudio(options),cues=getCueSheet(id,options),n=Math.round(duration*sampleRate),left=new Float32Array(n),right=new Float32Array(n);
  for(const cue of cues){
    const start=Math.round(cue.start*sampleRate),count=Math.max(2,Math.round(cue.duration*sampleRate));
    if(cue.sound==='air-motion'){
      const random=rng(cue.seed);let low=0,slow=0;
      for(let j=0;j<count;j++){
        const i=start+j;if(i<0||i>=n)continue;
        const t=i/sampleRate,control=audioControlAt(cue,t),noise=random();low+=lowpass(control.frequency,sampleRate)*(noise-low);slow+=lowpass(170,sampleRate)*(low-slow);
        const exactEdge=S(j/(sampleRate*.008))*S((count-1-j)/(sampleRate*.008));
        const value=(low-slow)*control.envelope*exactEdge*cue.gain,angle=(control.pan+1)*Math.PI/4;
        left[i]+=value*Math.cos(angle);right[i]+=value*Math.sin(angle);
      }
    }else{
      const pcm=synthesizeSound(cue.sound,{sampleRate,duration:cue.duration,seed:cue.seed,params:cue.params});
      const sourcePan=clamp((basePose(cue.sourceId,(cue.anchorTime-cue.clock.offset)*cue.clock.scale).x-.5)*1.6,-.8,.8),angle=(sourcePan+1)*Math.PI/4;
      for(let j=0;j<pcm.length;j++){const i=start+j;if(i<0||i>=n)continue;left[i]+=pcm[j]*cue.gain*Math.cos(angle);right[i]+=pcm[j]*cue.gain*Math.sin(angle);}
    }
  }
  // No ambient bed, normalization or hidden limiter. Declared holds can be quiet.
  left[0]=right[0]=left[n-1]=right[n-1]=0;
  return {left,right,sampleRate,duration,cues};
}

function text(ctx,value,x,y,size,color,weight=500,align='left'){
  ctx.font=`${weight} ${size}px "Microsoft YaHei", "Segoe UI", sans-serif`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(value,x,y);
}
function line(ctx,x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();}
function roundRect(ctx,x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();}
function disc(ctx,x,y,r,opacity=1){
  ctx.save();ctx.globalAlpha*=opacity;
  const gradient=ctx.createRadialGradient(x-r*.35,y-r*.42,r*.03,x,y,r);gradient.addColorStop(0,'#fff5df');gradient.addColorStop(.25,'#e8dbc2');gradient.addColorStop(.65,'#a5b5ab');gradient.addColorStop(1,'#425e68');
  ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=gradient;ctx.fill();ctx.strokeStyle='#dce2cb77';ctx.lineWidth=1;ctx.stroke();
  ctx.beginPath();ctx.ellipse(x-r*.17,y-r*.22,r*.44,r*.22,-.5,0,TAU);ctx.strokeStyle='#fff8e44d';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
}
function subject(ctx,state,alpha=1){
  const {object:o,mode}=state,x=o.x*1200,y=o.y*675,r=o.radius*675;
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.rotate(o.rotation);ctx.scale(o.scaleX,o.scaleY);
  if(mode==='type'){
    ctx.font='650 74px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle=THEMES.ink;
    const metrics=ctx.measureText('此刻'),ascent=metrics.actualBoundingBoxAscent||60,descent=metrics.actualBoundingBoxDescent||0;
    ctx.scale(1,2*r/(ascent+descent));ctx.fillText('此刻',0,(ascent-descent)/2);
  }else disc(ctx,0,0,r);
  ctx.restore();
}
function subjectRightExtent(ctx,mode){
  if(mode!=='type')return R*675;
  ctx.save();ctx.font='650 74px "Microsoft YaHei",sans-serif';ctx.textAlign='center';
  const metrics=ctx.measureText('此刻'),right=metrics.actualBoundingBoxRight||metrics.width/2;ctx.restore();return right;
}
function drawOverview(ctx,state){
  text(ctx,'同一对象，四种语气。',77,111,39,THEMES.ink,600);
  text(ctx,'选择让观众看清什么，再决定怎么动。',79,155,20,THEMES.muted);
  const fade=S(state.localTime/.28);
  for(let i=0;i<4;i++){
    const x=85+i*285;ctx.save();ctx.globalAlpha=fade;
    line(ctx,x,412,x+225,412,THEMES.line,1);
    const p=presets[i];if(state.mode==='type')text(ctx,'此刻',x+112,323,36,THEMES.ink,600,'center');else disc(ctx,x+112,310,26);
    text(ctx,p.title.split(' · ')[0],x+112,476,29,THEMES.accent,650,'center');
    text(ctx,state.overview[i].word,x+112,510,18,THEMES.muted,450,'center');ctx.restore();
  }
  text(ctx,'快给方向 · 慢给过程 · 停给阅读 · 弹给接触',600,594,21,THEMES.ink,500,'center');
}

/** Canvas drawing is a graphic material/focus study, not a 3D renderer.
 * The same sample drives all subjects. Letterboxing preserves object geometry.
 */
export function draw(ctx,id,t,width,height,options={}){
  if(!ctx||typeof ctx.save!=='function')throw new TypeError('A Canvas 2D context is required');
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new RangeError('Canvas size must be positive');
  const state=sample(id,t,options),scale=Math.min(width/1200,height/675),ox=(width-1200*scale)/2,oy=(height-675*scale)/2;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle=THEMES.background;ctx.fillRect(0,0,width,height);ctx.translate(ox,oy);ctx.scale(scale,scale);
  const bg=ctx.createRadialGradient(800,260,10,650,330,850);bg.addColorStop(0,'#203740');bg.addColorStop(.65,'#13252f');bg.addColorStop(1,THEMES.background);ctx.fillStyle=bg;ctx.fillRect(0,0,1200,675);
  if(state.activeId==='overview'){drawOverview(ctx,state);ctx.restore();return state;}
  const p=BY_ID.get(state.activeId);text(ctx,'同一对象 · 四种语气',76,61,15,THEMES.muted,500);
  text(ctx,p.title,74,116,39,THEMES.ink,650);text(ctx,p.description,77,154,19,THEMES.muted);
  const floor=FLOOR*675;
  line(ctx,102,floor,1096,floor,'#60767b77',1);
  const x=state.object.x*1200,y=state.object.y*675,r=R*675,heightAboveFloor=Math.max(0,Y-state.object.y),rightExtent=subjectRightExtent(ctx,state.mode);
  ctx.save();ctx.globalAlpha=.31/(1+heightAboveFloor*3);const shadow=ctx.createRadialGradient(x,floor,0,x,floor,80);shadow.addColorStop(0,'#02070bcc');shadow.addColorStop(1,'#02070b00');ctx.fillStyle=shadow;ctx.translate(x,floor+2);ctx.scale(1,.18);ctx.fillRect(-100,-100,200,200);ctx.restore();
  if(state.activeId==='stop'){
    const wall=X1*1200+rightExtent;line(ctx,wall,floor-127,wall,floor+1,THEMES.accent,3);line(ctx,wall,floor+1,wall+27,floor+1,THEMES.accent,3);
  }
  if(state.activeId==='fast'&&state.object.speed>.02){
    // Actual earlier poses, not invented speed lines or a fake derivative.
    for(let i=5;i>=1;i--){const earlier=sample(id,Math.max(state.offset,state.time-i*.009),options);if(earlier.activeId!==state.activeId)continue;ctx.save();ctx.filter=`blur(${2+i*.7}px)`;subject(ctx,earlier,.08*(1-i/7));ctx.restore();}
  }
  const focusBlur=state.activeId==='slow'?5*(1-S((state.localTime-.35)/2.85)):0;
  ctx.save();if(focusBlur>.05)ctx.filter=`blur(${focusBlur.toFixed(3)}px)`;subject(ctx,state);ctx.restore();
  for(const pulse of state.contactPulses){
    const q=pulse.age/.18,alpha=(1-S(q))*.65*pulse.strength;
    const cx=state.activeId==='stop'?X1*1200+rightExtent:.5*1200,cy=state.activeId==='stop'?Y*675:floor;
    ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=THEMES.warm;ctx.lineWidth=1.8;ctx.beginPath();ctx.ellipse(cx,cy,6+q*35,(state.activeId==='stop'?1:.3)*(6+q*35),0,0,TAU);ctx.stroke();ctx.restore();
  }
  text(ctx,state.stage,77,524,23,THEMES.accent,550);
  const explain={fast:'短预备，把注意力交到终点。',slow:'过程可见，抵达之后再读。',stop:'接触发生，动作与声音一起收住。',bounce:'先有接触，才有反向与余动。'};
  text(ctx,explain[state.activeId],77,560,20,THEMES.ink,450);
  text(ctx,'同一对象 / 原创程序声音',77,623,14,THEMES.muted,400);
  text(ctx,id==='reel'?`片段 ${presets.findIndex(p=>p.id===state.activeId)+1} / 4`:'4 秒动作观察',1122,623,14,THEMES.muted,400,'right');
  ctx.restore();return state;
}
