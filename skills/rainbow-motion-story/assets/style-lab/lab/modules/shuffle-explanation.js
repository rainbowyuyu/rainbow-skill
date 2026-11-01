/** Original teaching scenes: counted choices and an exact eight-card out-shuffle.
 * Absolute-time state; no source footage, source meshes or physics claims. */
import {begin,end,text,line,roundRect,circle,clamp,mix,smooth,candidate} from './common.js';

const finiteTime=(t,d)=>clamp(Number.isFinite(t)?t:0,0,d);
const at=(t,a,b)=>smooth((t-a)/(b-a));
const IDs=Object.freeze(['A','B','C','D','E','F','G','H']);
const identityColors=Object.freeze(['#e8b56b','#e7c183','#c9c9a3','#97c8b7','#75babf','#7ca1be','#9a92b9','#bc8caa']);
const stageAt=(t,times)=>Math.max(0,times.findLastIndex(start=>t>=start));
export const CHOICE_IDS=Object.freeze(IDs.slice(0,6));
export const CHOICE_ORDER=Object.freeze(['C','F','A','E','B','D']);
export const CHOICE_STARTS=Object.freeze([1.5,3.65,5.8,7.95,10.1,12.25]);
export const CHOICE_STAGE_TIMES=Object.freeze([0,...CHOICE_STARTS,14.4,17]);
export const SHUFFLE_IDS=IDs;
export const SHUFFLE_ROUND_STARTS=Object.freeze([1.5,7.2,12.9]);
export const SHUFFLE_STAGE_TIMES=Object.freeze([0,1.5,3.2,5.4,7.2,8.9,11.1,12.9,14.6,16.8,18.6]);

/** Falling factorial, including its empty-product state. */
export function choiceProduct(n=6,selectedCount=n){
    if(!Number.isInteger(n)||n<1||n>18||!Number.isInteger(selectedCount)||selectedCount<0||selectedCount>n)
        throw new RangeError('Use an integer deck size 1–18 and a selected count from 0 to n.');
    const factors=Array.from({length:selectedCount},(_,i)=>n-i);
    return {factors,product:factors.reduce((product,n)=>product*n,1)};
}

/** Split equally, then interleave with the original first card on top. */
export function outShuffle(order){
    if(!Array.isArray(order)||order.length<2||order.length%2!==0)
        throw new RangeError('An out-shuffle requires an even array with at least two cards.');
    const half=order.length/2;
    return Array.from({length:order.length},(_,i)=>order[i%2===0?i/2:half+(i-1)/2]);
}

export const SHUFFLE_ORDERS=Object.freeze([0,1,2,3].reduce((orders,round)=>{
    orders.push(Object.freeze(round?outShuffle(orders.at(-1)):[...SHUFFLE_IDS]));return orders;
},[]));

const choiceSlot=i=>[420+152*i,555];
const choiceSource=id=>[420+152*CHOICE_IDS.indexOf(id),305];
export function sampleChoiceProduct(rawTime){
    const time=finiteTime(rawTime,20);
    const chosenCount=CHOICE_STARTS.filter(start=>time>=start+.9).length;
    const factorCount=CHOICE_STARTS.filter(start=>time>=start+1.3).length;
    const activeIndex=Math.min(5,Math.max(0,CHOICE_STARTS.findLastIndex(start=>time>=start)));
    const selectedIds=CHOICE_ORDER.slice(0,chosenCount),remainingIds=CHOICE_IDS.filter(id=>!selectedIds.includes(id));
    const final=time>=14.4,phase=time<1.5?'establish':final?'result':`choose-${activeIndex+1}`;
    const factors=CHOICE_STARTS.map((start,i)=>({
        index:i,value:6-i,sourceId:CHOICE_ORDER[i],committed:time>=start+1.3,
        alpha:at(time,start+.9,start+1.04),handoff:at(time,start+.9,start+1.3),
        position:[choiceSlot(i)[0],mix(665,736,at(time,start+.9,start+1.3))]
    }));
    const cards=CHOICE_IDS.map((id,i)=>{
        const selectedIndex=CHOICE_ORDER.indexOf(id),start=CHOICE_STARTS[selectedIndex];
        const progress=at(time,start,start+.9),source=choiceSource(id),target=choiceSlot(selectedIndex);
        const lift=Math.sin(Math.PI*progress);
        return {id,color:identityColors[i],originalIndex:i,selectedIndex,
            position:[mix(source[0],target[0],progress)+lift*(target[0]-source[0])*.1,mix(source[1],target[1],progress)-lift*26],
            rotation:-Math.sign(target[0]-source[0])*.045*lift,scale:1+.045*lift,
            width:98,height:138,progress,lift,moving:progress>0&&progress<1,selected:time>=start+.9};
    });
    const reading=time<1.5||final||(time>=CHOICE_STARTS[activeIndex]+1.3&&time<CHOICE_STARTS[activeIndex]+2.15);
    return {time,phase,stageIndex:stageAt(time,CHOICE_STAGE_TIMES),
        annotation:time<1.5?'六张不同的牌，第一位能放哪张？':final?'六个位置的选择数相乘：6! = 720。眼前这一排只是其中一种。':
            `第 ${activeIndex+1} 位有 ${6-activeIndex} 种选择；选定后，下一位少一种。`,
        cards,selectedIds,remainingIds,chosenCount,factorCount,activeIndex,
        choicesAtStart:6-activeIndex,factors,formula:choiceProduct(6,factorCount),
        resultAlpha:at(time,14.4,15.1),geometryStable:cards.every(card=>!card.moving),
        readHold:reading&&(!final||time>=15.1),originalOrder:[...CHOICE_IDS],selectionOrder:[...CHOICE_ORDER]};
}

const mainSlot=i=>[380+120*i,440];
const halfSlot=i=>[566+156*(i%4),i<4?330:550];
export function sampleOutShuffle(rawTime){
    const time=finiteTime(rawTime,22);
    const round=Math.min(2,Math.max(0,SHUFFLE_ROUND_STARTS.findLastIndex(start=>time>=start)));
    const start=SHUFFLE_ROUND_STARTS[round],elapsed=time-start;
    const before=SHUFFLE_ORDERS[round],after=SHUFFLE_ORDERS[round+1];
    const split=at(time,start,start+1.7),gather=at(time,start+3.9,start+4.8);
    const completedRounds=SHUFFLE_ROUND_STARTS.filter(start=>time>=start+4.8).length;
    const terminal=time>=18.6;
    const phase=time<1.5?'establish':terminal?'compare':elapsed<1.7?`split-${round+1}`:elapsed<3.9?`interleave-${round+1}`:elapsed<4.8?`gather-${round+1}`:`read-${round+1}`;
    const cards=SHUFFLE_IDS.map((id,i)=>{
        const sourceIndex=before.indexOf(id),targetIndex=after.indexOf(id),pairIndex=sourceIndex%4;
        const source=mainSlot(sourceIndex),half=halfSlot(sourceIndex),target=mainSlot(targetIndex);
        const weave=at(time,start+1.7+pairIndex*.3,start+3+pairIndex*.3);
        const halfPosition=source.map((v,j)=>mix(v,half[j],split));
        const lift=Math.sin(Math.PI*weave);
        const position=[mix(halfPosition[0],target[0],weave),mix(halfPosition[1],target[1]+(sourceIndex<4?-10:10)*(1-gather),weave)];
        return {id,color:identityColors[i],originalIndex:i,sourceIndex,targetIndex,pairIndex,
            position,rotation:(sourceIndex<4?-1:1)*.035*lift,scale:1+.035*lift,
            width:88,height:118,lift,moving:(split>0&&split<1)||(weave>0&&weave<1)||(gather>0&&gather<1),
            split,weave,gather,half:sourceIndex<4?'upper':'lower'};
    });
    return {time,phase,stageIndex:stageAt(time,SHUFFLE_STAGE_TIMES),round:time<1.5?0:round+1,completedRounds,
        annotation:time<1.5?'给八张牌固定编号，盯住它们的位置。':terminal?'三轮后，八张牌回到原序。这是固定重排的周期。':
            elapsed<1.7?`第 ${round+1} 轮：从中间分成两半。`:elapsed<3.9?'上下各取一张，严格交替放入；先取上半叠。':elapsed<4.8?'把牌列合齐，再看同一张牌去了哪里。':`第 ${round+1} 轮完成，停一下，看清顺序。`,
        cards,sourceOrder:[...before],targetOrder:[...after],settledOrder:[...SHUFFLE_ORDERS[completedRounds]],originalOrder:[...SHUFFLE_IDS],
        split,weaveAlpha:at(time,start+1.7,start+1.95)*(1-gather),gather,
        halfLabelAlpha:split*(1-at(time,start+1.7,start+2.15)),
        resultAlpha:at(time,18.6,19.3),geometryStable:cards.every(card=>!card.moving),
        readHold:(time<1.5||elapsed>=4.8||terminal)&&(!terminal||time>=19.3),
        correctPositionCount:SHUFFLE_ORDERS[completedRounds].filter((id,i)=>id===SHUFFLE_IDS[i]).length};
}

function drawCard(ctx,card,p){
    ctx.save();ctx.translate(...card.position);ctx.rotate(card.rotation||0);ctx.scale(card.scale||1,card.scale||1);
    const {width:w,height:h}=card;
    ctx.shadowColor='#00000055';ctx.shadowBlur=10+card.lift*10;ctx.shadowOffsetY=6+card.lift*6;
    const face=ctx.createLinearGradient(-w/2,-h/2,w/2,h/2);face.addColorStop(0,'#fffdf5');face.addColorStop(.65,'#f1eadb');face.addColorStop(1,'#d8d0c1');
    roundRect(ctx,-w/2,-h/2,w,h,9,face,'#fff5dc99');ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    roundRect(ctx,-w/2+7,-h/2+7,w-14,8,4,card.color);
    text(ctx,card.id,0,-4,w*.49,'#213943',750,'center');
    text(ctx,`0${card.originalIndex+1}`,0,h/2-22,14,'#52646a',600,'center');
    line(ctx,[-w/2+9,h/2-5],[w/2-9,h/2-5],'#b3a68f70',1);
    ctx.restore();
}
function drawProgress(ctx,marks,time,duration,p){
    line(ctx,[92,857],[1508,857],p.line,2);line(ctx,[92,857],[92+1416*time/duration,857],p.gold,3);
    marks.forEach(t=>circle(ctx,92+1416*t/duration,857,3,t<=time?p.gold:p.line));
}

export const choiceProductCandidate=candidate({
    id:'visualization-choice-product',module:'visualization',title:'一位一位选，乘法自己长出来',
    duration:20,loop:false,previewTime:15.7,stageTimes:[...CHOICE_STAGE_TIMES],
    codeFile:'modules/shuffle-explanation.js',referenceIds:['shuffle'],controls:{intensity:false},
    description:'六张固定身份的牌逐个落位；每次可选数量成为同一位置下的乘积项，最后得到 6! = 720。',
    usage:'排列计数、组合问题的第一步。牌列只展示一个具体排列；乘积计算全部可能的排列。',
    stages:['六张不同牌','第一位：6 种','第二位：5 种','第三位：4 种','第四位：3 种','第五位：2 种','第六位：1 种','完整乘积：720','保留一种排法'],
    recipe:['少量实体先站稳，不从巨大的阶乘数字开始。','每次只选一张；已选牌留下，剩余选择会少一。','落位之后才引入该位的因子；最后保留公式和完整牌列。']
},sampleChoiceProduct,(ctx,t,w,h,o,s)=>{
    const p=o.theme;begin(ctx,w,h,{title:'六张牌，能排出多少种顺序？',subtitle:'先摆一个位置，再数下一步有多少种选择',palette:p});
    text(ctx,s.time<1.5?'先看清：六张牌，各不相同':s.time<14.4?`第 ${s.activeIndex+1} 位，${s.choicesAtStart} 种选择`:'6 个位置，依次选完',800,200,32,p.ink,650,'center');
    text(ctx,'还没选',110,292,23,p.muted,600);text(ctx,`${s.remainingIds.length} 张`,110,325,20,p.muted);
    text(ctx,'已落位',110,540,23,p.muted,600);text(ctx,`${s.chosenCount} 张`,110,573,20,p.muted);
    for(let i=0;i<6;i++){
        const [x,y]=choiceSlot(i);roundRect(ctx,x-52,y-73,104,146,10,null,p.line);
        text(ctx,`位置 ${i+1}`,x,y-100,19,p.muted,500,'center');
        const source=choiceSource(CHOICE_IDS[i]);circle(ctx,source[0],source[1],3,p.line);
        if(s.time>=CHOICE_STARTS[i]&&s.time<CHOICE_STARTS[i]+.9){
            ctx.save();ctx.globalAlpha=.7;roundRect(ctx,x-56,y-77,112,154,13,null,p.gold);ctx.restore();
        }
    }
    [...s.cards].sort((a,b)=>a.lift-b.lift).forEach(card=>drawCard(ctx,card,p));
    text(ctx,'选择数',110,736,23,p.muted,600);
    s.factors.forEach((factor,i)=>{
        if(factor.alpha<=0)return;ctx.save();ctx.globalAlpha=factor.alpha;
        if(i>0)text(ctx,'×',factor.position[0]-76,736,28,p.muted,500,'center');
        text(ctx,factor.value,...factor.position,42,p.gold,700,'center');ctx.restore();
    });
    if(s.factorCount>0&&!s.factors.some(f=>f.alpha>0&&!f.committed))text(ctx,`= ${s.formula.product}`,1335,736,39,p.ink,700,'center');
    if(s.resultAlpha>0){ctx.save();ctx.globalAlpha=s.resultAlpha;text(ctx,'6! = 720 种顺序；眼前只是其中一种。',800,806,28,p.ink,600,'center');ctx.restore();}
    else text(ctx,'每选走一张，下一位就少一种选择。',800,806,26,p.muted,500,'center');
    drawProgress(ctx,CHOICE_STARTS,s.time,20,p);end(ctx);
});

export const outShuffleCandidate=candidate({
    id:'storytelling-perfect-shuffle',module:'storytelling',title:'盯住同一张牌：三轮归位',
    duration:22,loop:false,previewTime:19.7,stageTimes:[...SHUFFLE_STAGE_TIMES],
    codeFile:'modules/shuffle-explanation.js',referenceIds:['shuffle'],controls:{intensity:false},
    description:'八张固定编号与颜色的牌，按精确外洗规则交织三次。运动轨迹由计算出的目标索引生成。',
    usage:'说明固定重排可以有周期；不把“看起来乱”当作随机，也不把八张牌的三轮周期推广到五十二张。',
    stages:['固定八张身份','第一轮：分半','第一轮：交织','第一轮：合齐','第二轮：分半','第二轮：交织','第二轮：合齐','第三轮：分半','第三轮：交织','第三轮：合齐','核对原序'],
    recipe:['用八张牌让每张身份可辨。','先分半，再交织，再合齐；每轮留一个停顿。','底部原序一直保留，最终逐一对应；说明这是固定规则的周期。']
},sampleOutShuffle,(ctx,t,w,h,o,s)=>{
    const p=o.theme;begin(ctx,w,h,{title:'看起来乱了，顺序真的丢了吗？',subtitle:'8 张牌 · 精确外洗：平分后交替放入，先取上半叠',palette:p});
    text(ctx,s.time<1.5?'给每张牌一个固定身份':s.time<18.6?`第 ${s.round} 轮 / 共 3 轮`:'第 3 轮，回到原来的顺序',800,200,31,p.ink,650,'center');
    if(s.halfLabelAlpha>0){ctx.save();ctx.globalAlpha=s.halfLabelAlpha;text(ctx,'上半叠',288,330,22,p.gold,600,'right');text(ctx,'下半叠',288,550,22,p.cyan,600,'right');ctx.restore();}
    for(let i=0;i<8;i++){
        const [x,y]=mainSlot(i);ctx.save();ctx.globalAlpha=.35;roundRect(ctx,x-47,y-62,94,124,10,null,p.line);ctx.restore();
    }
    [...s.cards].sort((a,b)=>a.lift-b.lift||a.position[1]-b.position[1]).forEach(card=>drawCard(ctx,card,p));
    text(ctx,'原顺序',190,699,22,p.muted,600,'center');
    SHUFFLE_IDS.forEach((id,i)=>{
        const x=mainSlot(i)[0];roundRect(ctx,x-33,672,66,54,8,o.palette==='porcelain'?'#f7f2e8':'#1c2b35',identityColors[i]);
        text(ctx,id,x,699,27,p.ink,700,'center');
        if(s.resultAlpha>0){ctx.save();ctx.globalAlpha=s.resultAlpha;line(ctx,[x,508],[x,658],identityColors[i]+'88',1.5,[4,7]);circle(ctx,x,654,3,identityColors[i]);ctx.restore();}
    });
    const caption=s.time<1.5?'身份不换，位置可以变。':s.phase.startsWith('split')?'从中间分开，每半叠的内部顺序不变。':s.phase.startsWith('interleave')?'上、下、上、下……按同一个规则交替放入。':s.phase.startsWith('gather')?'合齐牌列，再读一次顺序。':s.time<18.6?'停一下，看看同一张牌去了哪里。':'固定重排有周期；周期不等于随机。';
    text(ctx,caption,800,799,27,p.ink,600,'center');drawProgress(ctx,SHUFFLE_ROUND_STARTS,s.time,22,p);end(ctx);
});

export const candidates=[choiceProductCandidate,outShuffleCandidate];
