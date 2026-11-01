/** Original 18-second shuffle/rhythm study. No source-video images or sound samples.
 * One fixed card/contact timeline drives all pictures and the three sound arrangements.
 * This is designed graphic motion, not a collision simulation or random-shuffle proof.
 */
import {synthesizeSound,measureSignal} from './sound-design.js';

export const duration=18;
export const chapters=Object.freeze([
    {time:0,title:'建立'},{time:.7,title:'分开'},{time:2.46,title:'交织'},{time:6.15,title:'合拢'},
    {time:6.95,title:'安静'},{time:8.55,title:'摊开'},{time:11.2,title:'三次快变'},{time:16.4,title:'读定'}
].map(Object.freeze));
export const modes=[
    {id:'restrained',title:'克制 · 听见关键接触',description:'精选交织、归拢与翻开，读数时完全安静。'},
    {id:'dense',title:'密集 · 每张牌都有声',description:'每次卡片抵达都触发短声，用较低单声增益控制密度。'},
    {id:'legato',title:'连贯 · 纸面摩擦接力',description:'连续柔和摩擦串起运动，只留少量落定声。'}
];
export const readHolds=Object.freeze([{start:6.95,end:8.45,label:'归拢后读数'},{start:16.4,end:18,label:'最终顺序阅读'}].map(Object.freeze));
const W=1600,H=900,TAU=Math.PI*2;
const C={background:'#0d1b28',ink:'#f5eddc',muted:'#98aab4',gold:'#d4b27a',cyan:'#82bbc6',line:'#334b5b',paper:'#f1eadc'};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const S=x=>{const q=clamp(x);return q*q*q*(10+q*(-15+6*q));};
const mix=(a,b,q)=>a+(b-a)*q;
const progress=(t,a,b)=>S((t-a)/(b-a));
const clone=x=>JSON.parse(JSON.stringify(x));
const time=t=>{if(!Number.isFinite(t))throw new TypeError('time must be finite');return clamp(t,0,duration);};
const range=Array.from({length:52},(_,i)=>i);
export const cardIds=Object.freeze(range.map(i=>`card-${String(i+1).padStart(2,'0')}`));
const INDEX=new Map(cardIds.map((id,i)=>[id,i]));
const initial=[...cardIds];
const interleaved=Array.from({length:26},(_,i)=>[cardIds[i],cardIds[26+i]]).flat();
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function permute(order,seed){const out=[...order],random=rng(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
const orders=[interleaved];for(const seed of [1837,5521,9481])orders.push(permute(orders.at(-1),seed));
const orderIndices=orders.map(order=>new Map(order.map((id,i)=>[id,i])));
const rounds=[{start:11.2,end:12.3},{start:12.5,end:13.6},{start:13.8,end:14.9}];
const interleaveContact=k=>2.80+Math.floor(k/4)*.24+(k%4)*.035;
const quickContact=(round,k)=>rounds[round].start+.67+(k%13)*.017+Math.floor(k/13)*.03;
const fanContact=k=>9.50+k*.013;
const splitPose=i=>({x:i<26?535:1065,y:475,z:12+(i%26)*.62,rotation:i<26?-.07:.07,width:180,height:250,flip:0});
const stacked=k=>({x:800,y:475,z:12+k*.62,rotation:0,width:180,height:250,flip:0});
const fanPose=k=>{const a=(k/51-.5)*1.36;return {x:800+570*Math.sin(a),y:430+175*(1-Math.cos(a)),z:12+k*.025,rotation:a*.68,width:137,height:194,flip:1};};
function lerpPose(a,b,q){return Object.fromEntries(Object.keys(a).map(k=>[k,mix(a[k],b[k],q)]));}
function lift(q,height){return height*64*q*q*q*(1-q)**3;}
function pose(id,t){
    const i=INDEX.get(id),k=orderIndices[0].get(id),base=stacked(i),split=splitPose(i),arrival=interleaveContact(k);
    if(t<2.1)return lerpPose(base,split,progress(t,.7,2.1));
    const target={...stacked(k),x:800+(k%2?17:-17)};
    if(t<6.15){const q=progress(t,arrival-.34,arrival),p=lerpPose(split,target,q);p.z+=lift(q,100);p.rotation+=Math.sin(Math.PI*q)*(i<26?.14:-.14);return p;}
    const deck=stacked(k);
    if(t<8.55)return lerpPose(target,deck,progress(t,6.15,6.7));
    if(t<10.45){const q=progress(t,8.55+k*.008,fanContact(k));return lerpPose(deck,fanPose(k),q);}
    if(t<11.2)return lerpPose(fanPose(k),deck,progress(t,10.45,11.0));
    for(let round=0;round<3;round++){
        const r=rounds[round],from=stacked(orderIndices[round].get(id)),targetIndex=orderIndices[round+1].get(id),to=stacked(targetIndex);
        if(t<r.end){
            const contact=quickContact(round,targetIndex),q=progress(t,contact-.56,contact),p=lerpPose(from,to,q);
            const lane=((i+round)%3)-1,side=i%2?-1:1;
            p.x+=side*lift(q,240+40*lane);p.y+=lift(q,34*lane);p.z+=lift(q,91+24*(lane+1));p.rotation+=side*Math.sin(Math.PI*q)*.23;
            return p;
        }
    }
    const rank=orderIndices[3].get(id);
    return lerpPose(stacked(rank),fanPose(rank),progress(t,15.2+rank*.002,16.1+rank*.002));
}
function event(id,kind,t,{cardId=null,start=t,priority=1,...rest}={}){
    const p=cardId?pose(cardId,t):{x:800,y:475,z:12};
    return {id,kind,time:t,contact:t,start,cardId,position:[p.x,p.y,p.z],priority,...rest};
}
const CONTACTS=[];
CONTACTS.push(event('split-left','split-seat',2.1,{cardId:cardIds[25],start:.7}),event('split-right','split-seat',2.1,{cardId:cardIds[51],start:.7}));
interleaved.forEach((id,k)=>CONTACTS.push(event(`interleave-${k}`,'card-seat',interleaveContact(k),{cardId:id,start:interleaveContact(k)-.34,index:k,priority:k%4===3?.65:.3})));
CONTACTS.push(event('gather','stack-gather',6.7,{start:6.15}));
interleaved.forEach((id,k)=>CONTACTS.push(event(`fan-${k}`,'fan-seat',fanContact(k),{cardId:id,start:8.55+k*.008,index:k,priority:.3})));
CONTACTS.push(event('fold','stack-gather',11.0,{start:10.45}));
rounds.forEach((r,round)=>orders[round+1].forEach((id,k)=>CONTACTS.push(event(`reorder-${round}-${k}`,'reorder-seat',quickContact(round,k),{cardId:id,start:quickContact(round,k)-.56,round,index:k,priority:.35}))));
orders[3].forEach((id,k)=>CONTACTS.push(event(`final-${k}`,'final-seat',16.1+k*.002,{cardId:id,start:15.2+k*.002,index:k,priority:.3})));
CONTACTS.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
export const motionContacts=Object.freeze(CONTACTS.map(c=>Object.freeze({...c,position:Object.freeze(c.position)})));
export const permutationStages=Object.freeze([initial,...orders].map(order=>Object.freeze([...order])));

function partialOrder(previous,target,contacts,t){
    const landed=new Set(contacts.filter(e=>t>=e.time).map(e=>e.cardId));
    return [...target.filter(id=>landed.has(id)),...previous.filter(id=>!landed.has(id))];
}
function permutationAt(t){
    if(t<interleaveContact(0))return [...initial];
    if(t<6.15)return partialOrder(initial,interleaved,motionContacts.filter(e=>e.kind==='card-seat'),t);
    for(let r=0;r<3;r++)if(t<rounds[r].end){if(t<rounds[r].start)return [...orders[r]];return partialOrder(orders[r],orders[r+1],motionContacts.filter(e=>e.round===r),t);}
    return [...orders[3]];
}
export function sample(input){
    const t=time(input),permutation=permutationAt(t),rank=new Map(permutation.map((id,i)=>[id,i]));
    const cards=cardIds.map((id,i)=>{const p=pose(id,t);return {id,rank:rank.get(id),suit:['♠','♥','♣','♦'][Math.floor(i/13)],value:['A','2','3','4','5','6','7','8','9','10','J','Q','K'][i%13],position:[p.x,p.y,p.z],rotation:p.rotation,width:p.width,height:p.height,flip:p.flip,faceUp:p.flip>=.5};});
    const stage=t<.7?'看清这一叠':t<2.1?'分成两叠':t<6.15?'分批交织':t<6.95?'归拢落定':t<8.55?'留出安静':t<10.45?'顺着纸面摊开':t<11.2?'收回同一叠':t<15.2?'三次快速重排':t<16.4?'打开新顺序':'停住，读清结果';
    return {time:t,duration,phase:t/duration,stage,reading:readHolds.some(w=>t>=w.start&&t<=w.end),cards,permutation,motionContacts,
        contactPulses:motionContacts.filter(e=>t>=e.time&&t-e.time<.13).map(e=>({eventId:e.id,cardId:e.cardId,age:t-e.time,strength:e.priority})),
        round:t<11.2?0:t<12.5?1:t<13.8?2:3,completedReorders:rounds.filter(r=>t>=r.end).length,
        permutationMeaning:'Settled cards in target order, followed by cards still in transit in their previous order. Position is the authority during a handoff.',evidence:'illustrative'};
}

function modeValid(mode){if(!modes.some(m=>m.id===mode))throw new RangeError('mode must be restrained, dense or legato');return mode;}
export function readHoldGain(t){
    let gain=1;for(const hold of readHolds){if(t>=hold.start&&t<=hold.end)return 0;const before=t<hold.start?S((hold.start-t)/.07):S((t-hold.end)/.07);gain=Math.min(gain,before);}return gain;
}
function panAt(id,t){return clamp((pose(id,t).x-800)/620,-.85,.85);}
function panTrace(e,start,end){const n=Math.ceil((end-start)*60);return Array.from({length:n+1},(_,i)=>{const t=mix(start,end,i/n);return [t,e.cardId?panAt(e.cardId,t):0];});}
function makeCue(e,{sound='paper-contact',gain=.14,duration=.11,start=e.time,kind='contact'}={}){
    const end=Math.min(18,start+duration);
    return {id:`${e.id}:${sound}`,eventId:e.id,anchor:'contact',anchorTime:e.time,anchorOffset:e.time-start,start,end,duration:end-start,sound,kind,gain,
        seed:1709+motionContacts.indexOf(e)*7919,cardId:e.cardId,panTrack:panTrace(e,start,end),params:{mapping:true,peakFraction:.5}};
}
export function buildPlan(mode='restrained'){
    modeValid(mode);const cues=[];
    const byKind=kind=>motionContacts.filter(e=>e.kind===kind);
    const critical=[...byKind('split-seat'),...byKind('stack-gather')];
    if(mode==='dense'){
        for(const e of motionContacts)cues.push(makeCue(e,{gain:e.kind==='stack-gather'?.15:.085,duration:e.kind==='stack-gather'?.15:.075}));
    }else{
        critical.forEach(e=>cues.push(makeCue(e,{gain:mode==='restrained'?.17:.115,duration:.15})));
        const chosen=mode==='restrained'?[0,3,8,15,23,31,39,47,51]:[7,23,39,51];
        byKind('card-seat').filter(e=>chosen.includes(e.index)).forEach(e=>cues.push(makeCue(e,{gain:mode==='restrained'?.16:.105,duration:.10})));
        for(let r=0;r<3;r++){
            const contacts=motionContacts.filter(e=>e.round===r),last=contacts.at(-1);
            cues.push(makeCue(last,{gain:mode==='restrained'?.18:.11,duration:.13}));
        }
        for(const kind of ['fan-seat','final-seat'])cues.push(makeCue(byKind(kind).at(-1),{gain:.12,duration:.12}));
    }
    // Continuous gestures end at real contact events and use the same motion interval.
    const sweeps=[motionContacts.find(e=>e.id==='split-left'),byKind('card-seat').at(-1),byKind('fan-seat').at(-1),motionContacts.find(e=>e.id==='fold'),
        ...rounds.map((_,r)=>motionContacts.filter(e=>e.round===r).at(-1)),byKind('final-seat').at(-1)];
    if(mode!=='dense')for(const e of sweeps){
        const start=e.kind==='card-seat'?2.45:e.kind==='fan-seat'?8.55:e.kind==='final-seat'?15.2:e.round!==undefined?rounds[e.round].start:e.start;
        const end=e.time+.025;
        cues.push(makeCue(e,{sound:'paper-friction',kind:'friction',gain:mode==='legato'?.115:.043,duration:end-start,start}));
    }
    cues.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
    return {mode,duration,cues,contacts:clone(motionContacts),readHolds:clone(readHolds),masterGain:.86,
        soundOrigin:'Original deterministic synthesis using sound-design.js; paper-like design, not recorded paper.',levelPolicy:'Fixed gains; no hidden normalization, compression or clipping. Modes are not loudness matched.'};
}
export function audioControlAt(cue,t){
    const track=cue.panTrack,n=track.length-1,q=clamp((t-cue.start)/cue.duration)*n,index=Math.min(n-1,Math.floor(q));
    return {pan:mix(track[index][1],track[index+1][1],q-index),readGain:readHoldGain(t),active:t>=cue.start&&t<cue.end};
}
function sourceFor(cue,sampleRate){
    if(cue.sound==='paper-friction')return synthesizeSound('air-passby',{duration:cue.duration,sampleRate,seed:cue.seed,params:cue.params});
    const wood=synthesizeSound('wood-contact',{duration:cue.duration,sampleRate,seed:cue.seed}),air=synthesizeSound('air-passby',{duration:cue.duration,sampleRate,seed:cue.seed+307,params:{peakFraction:.08,mapping:true}});
    return wood.map((value,i)=>value*.48+air[i]*.75);
}
export function renderAudio(mode='restrained',sampleRate=48000){
    modeValid(mode);if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw new RangeError('sampleRate must be an integer from 8000 through 192000');
    const plan=buildPlan(mode),n=Math.round(duration*sampleRate),left=new Float32Array(n),right=new Float32Array(n);
    for(const cue of plan.cues){
        const pcm=sourceFor(cue,sampleRate),start=Math.round(cue.start*sampleRate);
        for(let j=0;j<pcm.length;j++){
            const i=start+j;if(i<0||i>=n)continue;const t=i/sampleRate,control=audioControlAt(cue,t),angle=(control.pan+1)*Math.PI/4;
            const value=pcm[j]*cue.gain*plan.masterGain*control.readGain;
            left[i]+=value*Math.cos(angle);right[i]+=value*Math.sin(angle);
        }
    }
    left[0]=right[0]=left[n-1]=right[n-1]=0;
    return {left,right,sampleRate,duration,plan,cues:plan.cues,metrics:measureSignal(left,right,sampleRate)};
}

function text(ctx,value,x,y,size,color=C.ink,weight=500,align='left'){ctx.font=`${weight} ${size}px "Microsoft YaHei", "Segoe UI", sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(value,x,y);}
function rounded(ctx,x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();}
function cardDraw(ctx,card,shadow=false){
    const [x,y,z]=card.position,width=card.width,height=card.height,flipScale=Math.max(.025,Math.abs(Math.cos(card.flip*Math.PI)));
    ctx.save();ctx.translate(x+(shadow?z*.28:0),y-z+(shadow?z*.47+18:0));ctx.rotate(card.rotation);ctx.scale(flipScale,1);
    if(shadow){ctx.globalAlpha=.055;rounded(ctx,-width/2,-height/2,width,height,10,'#00060b');ctx.restore();return;}
    // The narrow cream edge is opaque: no stacked transparent layers turn into black seams.
    rounded(ctx,-width/2,-height/2+2,width,height,10,'#a6a79d');
    const paper=ctx.createLinearGradient(-width/2,-height/2,width/2,height/2);paper.addColorStop(0,'#faf5e9');paper.addColorStop(.5,'#eee6d7');paper.addColorStop(1,'#d7d3c9');
    rounded(ctx,-width/2,-height/2,width,height-2,10,paper);
    if(card.faceUp){
        const red=card.suit==='♥'||card.suit==='♦',ink=red?'#9b4f43':'#18394a';
        // The fan exposes only a narrow left strip. Keep identification inside it,
        // rather than placing every rank under the next card. Original suit ink stays.
        const edgeColors=['#759cbe','#c88c77','#78beb6','#d6bc7c'];
        ctx.fillStyle=edgeColors[Math.floor(INDEX.get(card.id)/13)];
        ctx.fillRect(-width/2+2,-height/2+12,2.4,height-26);
        text(ctx,card.value,-width/2+9,-height/2+19,11,ink,700,'center');text(ctx,card.suit,-width/2+9,-height/2+34,11,ink,550,'center');
        // Small edge ticks distinguish cards within the same thirteen-card group.
        ctx.fillStyle=ink+'85';const ticks=INDEX.get(card.id)%13+1;
        for(let tick=0;tick<ticks;tick++)ctx.fillRect(-width/2+6,-height/2+48+tick*5.5,5,1);
        text(ctx,card.suit,0,0,44,ink,500,'center');
        ctx.save();ctx.rotate(Math.PI);text(ctx,card.value,-width/2+16,-height/2+22,18,ink,700);ctx.restore();
    }else{
        const navy=ctx.createLinearGradient(0,-height/2,width/2,height/2);navy.addColorStop(0,'#274754');navy.addColorStop(.55,'#17313f');navy.addColorStop(1,'#0b2432');
        rounded(ctx,-width/2+7,-height/2+7,width-14,height-16,6,navy);
        ctx.strokeStyle='#cdb588b0';ctx.lineWidth=.9;ctx.beginPath();ctx.roundRect(-width/2+12,-height/2+12,width-24,height-26,4);ctx.stroke();
        ctx.save();ctx.beginPath();ctx.roundRect(-width/2+15,-height/2+15,width-30,height-32,4);ctx.clip();ctx.strokeStyle='#9eb1af30';
        for(let k=-4;k<=4;k++){ctx.beginPath();ctx.ellipse(0,k*23,width*.37,height*.12,.4,0,TAU);ctx.stroke();}ctx.restore();
        ctx.save();ctx.rotate(Math.PI/4);ctx.strokeStyle=C.gold;ctx.lineWidth=1.4;ctx.strokeRect(-20,-20,40,40);ctx.strokeStyle='#d9cfb380';ctx.strokeRect(-14,-14,28,28);ctx.restore();
        text(ctx,String(INDEX.get(card.id)+1).padStart(2,'0'),0,0,15,C.ink,550,'center');
        const edge=ctx.createLinearGradient(-width/2,0,width/2,0);['#b894bc','#759cbe','#78beb6','#d6bc7c','#c88c77'].forEach((c,i)=>edge.addColorStop(i/4,c));
        ctx.fillStyle=edge;ctx.fillRect(-width/2+17,height/2-16,width-34,1.4);
    }
    ctx.restore();
}
export function draw(ctx,input,width,height,options={}){
    if(!ctx||typeof ctx.save!=='function')throw new TypeError('Canvas 2D context required');
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new RangeError('Positive canvas dimensions required');
    const s=sample(input),scale=Math.min(width/W,height/H),ox=(width-W*scale)/2,oy=(height-H*scale)/2;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle=C.background;ctx.fillRect(0,0,width,height);ctx.translate(ox,oy);ctx.scale(scale,scale);
    const bg=ctx.createRadialGradient(800,440,30,800,440,880);bg.addColorStop(0,'#263e49');bg.addColorStop(.58,'#142a38');bg.addColorStop(1,C.background);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    text(ctx,'52 张牌，一次有节奏的重排',74,76,36,C.ink,700);text(ctx,'分开 · 交织 · 合拢 · 安静 · 再展开',76,120,21,C.muted);
    text(ctx,s.stage,1524,78,23,C.gold,600,'right');
    ctx.save();ctx.beginPath();ctx.rect(55,160,1490,550);ctx.clip();
    const sorted=[...s.cards].sort((a,b)=>a.position[2]-b.position[2]||a.rank-b.rank);
    ctx.save();ctx.filter='blur(5px)';sorted.filter((c,i)=>i%4===0).forEach(c=>cardDraw(ctx,c,true));ctx.restore();sorted.forEach(c=>cardDraw(ctx,c));ctx.restore();
    const caption=s.reading?'52 张都还在，只是顺序变了。':s.time<6.15?'看清交接，再听见落定。':s.time<11.2?'把动作收住，才有空间读懂。':'短促重排之后，让结果留下来。';
    text(ctx,caption,76,756,27,C.ink,600);
    const first=s.permutation.slice(0,10).map(id=>String(INDEX.get(id)+1).padStart(2,'0')).join('  ');
    text(ctx,(s.reading?'落定顺序  ':'交接顺序  ')+first+'  …',76,803,19,C.muted,500);
    text(ctx,s.reading?'阅读窗口 · 声音让位':'原创程序声 · 同一动画三种配法',1524,803,19,s.reading?C.gold:C.muted,500,'right');
    ctx.strokeStyle=C.line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(76,856);ctx.lineTo(1524,856);ctx.stroke();ctx.strokeStyle=C.gold;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(76,856);ctx.lineTo(76+1448*s.phase,856);ctx.stroke();
    ctx.restore();return s;
}
