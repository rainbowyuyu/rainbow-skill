/**
 * Original concept bridge informed by static source-frame observation of
 * Motionface Mindset, 5.583333–6.583333s. No source image, brain model, voice,
 * watermark or repository code is included. Canvas 2D, not a physics/AI run.
 */
import {candidate, clamp, mix, smooth} from './common.js';
import {normalizeMotionfaceOptions, motionfacePalettes} from './motionface-type.js';

export const MOTIONFACE_CONCEPT_DURATION = 14;
export const motionfaceConceptDefaults = {
    'mf-concept-bridge': {
        headline: '看见，然后判断。',
        kicker: '一个对象，接住两个问题',
        result: '同一个观测，换一个问题。'
    }
};
const ID = 'mf-concept-bridge';
const FONT = '"Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const finite = (v, fallback) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const at = (t,a,b) => smooth((t-a)/(b-a));
const clean = (v,fallback) => typeof v === 'string' && v.trim()
    ? v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').trim().slice(0,180) || fallback : fallback;
const definitions = [
    ['identity','认出同一个对象',0],
    ['observe','先把观测说清楚',2.7],
    ['handoff','对象让位，问题接力',5.1],
    ['judge','用同一观测读出差距',6.8],
    ['read','留下完整阅读窗口',8.7]
];

export function normalizeConceptBridgeOptions(options = {}) {
    const d = motionfaceConceptDefaults[ID];
    // The shared normalizer only knows its own four IDs. Resolve our copy
    // here first, so an unknown-ID fallback never borrows a different title.
    const resolved = {
        ...options,
        headline: clean(options.headline,d.headline),
        kicker: clean(options.kicker,d.kicker),
        result: clean(options.result,d.result)
    };
    return normalizeMotionfaceOptions(resolved,'mf-card-convergence');
}

export function sampleConceptBridge(t, options = {}) {
    const o=normalizeConceptBridgeOptions(options);
    const time=clamp(finite(t,0),0,MOTIONFACE_CONCEPT_DURATION),u=time*o.tempo;
    const timings=definitions.map((d,i)=>({id:d[0],label:d[1],start:d[2]/o.tempo,
        end:i+1<definitions.length?definitions[i+1][2]/o.tempo:14,reading:i===definitions.length-1}));
    const phaseIndex=Math.max(0,timings.findLastIndex(p=>time>=p.start));
    const recognize=at(u,.65,2.55),handoff=at(u,5.1,6.65);
    const [x,y,radius]=o.reducedMotion?[390,446,108]:[
        mix(800,390,handoff),mix(mix(458,446,recognize),446,handoff),mix(mix(48,116,recognize),108,handoff)
    ];
    const angle=o.reducedMotion?0:mix(mix(-.18,.12,recognize),-.08,handoff)*(0.55+.45*o.intensity);
    const introAlpha=1-at(u,.8,2.3);
    const rail={x:760,y:507,width:650};
    // These are fixed teaching inputs. Layout moves; the measurement does not.
    const measurement={id:'observation-72',current:72,target:100,unit:'cm'};
    measurement.error=measurement.target-measurement.current;
    measurement.currentX=rail.x+rail.width*measurement.current/measurement.target;
    measurement.targetX=rail.x+rail.width;
    measurement.gapMidX=(measurement.currentX+measurement.targetX)/2;
    const guideAlpha=at(u,2.65,3.25)*(1-at(u,5.0,5.6));
    const readHold=phaseIndex===definitions.length-1;
    return {
        id:ID,time,phaseTime:u,phase:timings[phaseIndex].label,phaseIndex,timings,
        readHold,readingHold:readHold,options:o,
        copy:{headline:o.headline,kicker:o.kicker,result:o.result},
        entity:{id:'observation-entity',x,y,radius,rotation:angle,opacity:1,
            markerAngles:[-.9,.7,2.65],recognize,handoff},
        intro:{alpha:introAlpha,words:[
            {id:'look',text:'看见',x:o.reducedMotion?1010:605,y:458},
            {id:'judge',text:'判断',x:o.reducedMotion?1290:995,y:458}
        ]},
        observation:{labels:[
            {id:'current',text:'当前位置 72 cm',x,y:y+radius+62,alpha:at(u,2.7,3.35)*mix(1,.7,handoff)},
            {id:'target',text:'参照目标 100 cm',x,y:y+radius+101,alpha:at(u,3.15,3.85)*mix(1,.7,handoff)}
        ],guideAlpha,identityAlpha:at(u,2.45,3.15),guideRadius:radius+34},
        measurement,rail,
        judgement:{headingAlpha:at(u,6.8,7.3),rulerProgress:at(u,6.85,7.65),
            rulerAlpha:at(u,6.85,7.25),gapAlpha:at(u,7.45,8.05),equationAlpha:at(u,8.05,8.7),
            bridgeAlpha:at(u,6.7,7.15),bridgeProgress:at(u,6.7,7.5)},
        resultAlpha:at(u,8.05,8.7),
        background:{arcAlpha:.09+.035*o.intensity,offset:o.reducedMotion?1:handoff}
    };
}

function opacity(ctx,a,fn){if(a<.00001)return;ctx.save();ctx.globalAlpha*=clamp(a);fn();ctx.restore();}
function line(ctx,points,color,width=2){if(points.length<2)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();ctx.restore();}
function circle(ctx,x,y,r,fill,stroke,width=1.5){ctx.save();ctx.beginPath();ctx.arc(x,y,Math.max(.001,r),0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}ctx.restore();}
function type(ctx,value,x,y,size,color,align='left',weight=600){ctx.save();ctx.font=`${weight} ${size}px ${FONT}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(value),x,y);ctx.restore();}
function wrapped(ctx,value,width,size,weight){ctx.font=`${weight} ${size}px ${FONT}`;let current='';const lines=[];for(const c of Array.from(value)){if(c==='\n'||(current&&ctx.measureText(current+c).width>width)){lines.push(current);current=c==='\n'?'':c;}else current+=c;}if(current)lines.push(current);return lines.length?lines:[''];}
export function layoutConceptCopy(ctx,value,{width=1440,height=114,maxSize=56,minSize=18,weight=650}={}){
    let size=maxSize,lines=wrapped(ctx,value,width,size,weight);
    while(lines.length*size*1.24>height&&size>minSize){size-=1;lines=wrapped(ctx,value,width,size,weight);}
    return {size,lines:lines.slice(),lineHeight:size*1.24,height:lines.length*size*1.24,weight};
}
function block(ctx,value,x,y,width,height,maxSize,color,{align='left',weight=650}={}){
    ctx.save();const l=layoutConceptCopy(ctx,value,{width,height,maxSize,weight});
    l.lines.forEach((v,i)=>type(ctx,v,x,y+i*l.lineHeight,l.size,color,align,weight));ctx.restore();return l;
}

function drawOrb(ctx,e,p){
    ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.rotation);
    const r=e.radius;
    // Original finite 2D shaded geometry. The same marker pattern is kept
    // throughout the change of composition; no copied bitmap is used.
    const shadow=ctx.createRadialGradient(0,r*.86,r*.04,0,r*.86,r*1.15);
    shadow.addColorStop(0,p.ink+'1c');shadow.addColorStop(1,p.ink+'00');
    ctx.save();ctx.translate(0,r*.95);ctx.scale(1,.18);circle(ctx,0,0,r*1.2,shadow);ctx.restore();
    const g=ctx.createRadialGradient(-r*.4,-r*.48,r*.08,0,0,r*1.15);
    g.addColorStop(0,p.paper);g.addColorStop(.30,p.accent);g.addColorStop(1,p.ink);
    circle(ctx,0,0,r,g,p.ink,1.4);
    ctx.save();ctx.beginPath();ctx.arc(0,0,r-.8,0,Math.PI*2);ctx.clip();
    ctx.strokeStyle=p.paper+'90';ctx.lineWidth=1.4;
    for(const f of [-.42,0,.42]){ctx.beginPath();ctx.ellipse(0,f*r,r*Math.sqrt(1-f*f),r*.22,0,0,Math.PI*2);ctx.stroke();}
    ctx.beginPath();ctx.ellipse(0,0,r*.36,r,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();
    e.markerAngles.forEach((a,i)=>{const mx=Math.cos(a)*r*.61,my=Math.sin(a)*r*.61;circle(ctx,mx,my,r*.055,p.paper,p.ink,1.2);if(i===0)circle(ctx,mx,my,r*.11,null,p.paper+'b0',1.3);});
    ctx.restore();
}

export function drawConceptBridge(ctx,t,w,h,options={},supplied){
    const s=supplied||sampleConceptBridge(t,options),p=s.options.theme,e=s.entity,m=s.measurement,j=s.judgement;
    ctx.save();ctx.setTransform(finite(w,1600)/1600,0,0,finite(h,900)/900,0,0);
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
    ctx.fillStyle=p.bg;ctx.fillRect(0,0,1600,900);
    opacity(ctx,s.background.arcAlpha,()=>{ctx.strokeStyle=p.line;ctx.lineWidth=45;ctx.beginPath();ctx.arc(mix(1520,1400,s.background.offset),-190,970,.45,2.45);ctx.stroke();});
    line(ctx,[[80,80],[116,80]],p.accent,4);
    block(ctx,s.copy.kicker,133,81,1370,52,21,p.muted,{weight:500});
    block(ctx,s.copy.headline,80,164,1440,112,56,p.ink);
    opacity(ctx,s.intro.alpha,()=>{
        s.intro.words.forEach(v=>type(ctx,v.text,v.x,v.y,70,p.ink,'center',650));
        if(s.options.reducedMotion)line(ctx,[[1130,458],[1170,458]],p.line,2);
        else{line(ctx,[[700,458],[729,458]],p.line,2);line(ctx,[[871,458],[900,458]],p.line,2);}
    });
    opacity(ctx,s.observation.guideAlpha,()=>{
        const a=s.observation.guideRadius;
        line(ctx,[[e.x-a,e.y-a+22],[e.x-a,e.y-a],[e.x-a+22,e.y-a]],p.line,2);
        line(ctx,[[e.x+a-22,e.y+a],[e.x+a,e.y+a],[e.x+a,e.y+a-22]],p.line,2);
    });
    drawOrb(ctx,e,p);
    opacity(ctx,s.observation.identityAlpha,()=>type(ctx,'同一观测 · 01',e.x,e.y-e.radius-42,21,p.muted,'center',500));
    s.observation.labels.forEach(l=>opacity(ctx,l.alpha,()=>type(ctx,l.text,l.x,l.y,25,p.ink,'center',500)));
    opacity(ctx,j.bridgeAlpha,()=>{
        const a=[e.x+e.radius+22,e.y],b=[700,e.y];
        const end=[mix(a[0],b[0],j.bridgeProgress),e.y];
        line(ctx,[a,end],p.line,1.8);circle(ctx,end[0],end[1],3,p.secondary);
    });
    opacity(ctx,j.headingAlpha,()=>{type(ctx,'看见位置',760,365,24,p.muted,'left',500);type(ctx,'再问：还差多少？',760,411,40,p.ink,'left',650);});
    opacity(ctx,j.rulerAlpha,()=>{
        const {x,y,width}=s.rail;
        // Reduced motion reveals whole geometry with opacity, not a sweep.
        const progress=s.options.reducedMotion?1:j.rulerProgress;
        line(ctx,[[x,y],[x+width*progress,y]],p.line,2);
        for(let i=0;i<=10;i++){const px=x+width*i/10;if(i/10<=progress)line(ctx,[[px,y-6],[px,y+6]],p.line,1.3);}
        if(progress>=m.current/100){circle(ctx,m.currentX,y,7,p.accent,p.paper,1.6);type(ctx,'72 cm',m.currentX,y-34,24,p.ink,'center',600);}
        if(progress>=.9999){circle(ctx,m.targetX,y,8,p.bg,p.secondary,2);type(ctx,'100 cm',m.targetX,y-34,24,p.ink,'center',600);}
    });
    opacity(ctx,j.gapAlpha,()=>{
        const y=s.rail.y+47;line(ctx,[[m.currentX,y],[m.targetX,y]],p.accent,3);
        [m.currentX,m.targetX].forEach(x=>line(ctx,[[x,y-7],[x,y+7]],p.accent,2));
        type(ctx,'差距',m.gapMidX,y+30,22,p.muted,'center',500);
    });
    opacity(ctx,j.equationAlpha,()=>{
        type(ctx,'100 − 72 =',760,665,38,p.ink,'left',600);
        type(ctx,String(m.error),1100,655,85,p.accent,'left',700);
        type(ctx,'cm',1230,665,30,p.muted,'left',500);
    });
    opacity(ctx,s.resultAlpha,()=>block(ctx,s.copy.result,800,738,1400,70,34,p.ink,{align:'center',weight:600}));
    line(ctx,[[80,807],[1520,807]],p.line,1);
    type(ctx,s.phase,80,845,19,p.muted,'left',500);
    type(ctx,s.readHold?'停下来，读完整':'对象不变，问题向前',1520,845,19,p.muted,'right',500);
    ctx.restore();
}

export const conceptBridge=candidate({
    id:ID,module:'visualization',title:'同一个物体，把概念接起来',duration:14,loop:false,previewTime:9.1,
    description:'基于 Mindset 逐帧可见的同物换位机制原创：观测球从词间进入解释区，再让位给差距判断。',
    usage:'适合现象→解释、观测→判断、构件→作用。固定教学数据，不代表真实模型推理或物理仿真。',
    codeFile:'./modules/motionface-concepts.js',referenceIds:['motionface','motionface-mindset'],
    parameters:{intensity:{min:0,max:1,default:.65},palette:{values:Object.keys(motionfacePalettes),default:'paper'},tempo:{min:.75,max:1.35,default:1},reducedMotion:{default:false},headline:{type:'string',maxLength:180},kicker:{type:'string',maxLength:180},result:{type:'string',maxLength:180}},
    stages:definitions.map(d=>d[1]),stageTimes:definitions.map(d=>d[2]),
    audio:'无声原创方法研究；没有复现来源音轨。',
    recipe:[
        '同一对象保留唯一 ID、球面标记与固定观测值；词间、中央、侧边连续交接。',
        '对象先让位，新问题后进入；旧标签随对象移动并降为次级，不穿过新文字。',
        '位置72cm、目标100cm、差距28cm和标尺使用同一数据；布局改变不改观测。',
        '14秒有限序列，最后稳定阅读；低动态模式固定对象，只保留信息淡入。'
    ]
},sampleConceptBridge,drawConceptBridge);
export const candidates=[conceptBridge];
