import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {candidates,choiceProduct,outShuffle,CHOICE_IDS,CHOICE_ORDER,CHOICE_STARTS,
    SHUFFLE_IDS,SHUFFLE_ORDERS,SHUFFLE_ROUND_STARTS,sampleChoiceProduct,sampleOutShuffle} from '../lab/modules/shuffle-explanation.js';

let checks=0,samples=0,draws=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const near=(a,b,tolerance=1e-9,label='near')=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,`${label}: ${a}, ${b}`);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

// Independently enumerate the six-card tree. No formula implementation is used here.
const enumerate=(prefix,left)=>left.length?left.flatMap((id,i)=>enumerate([...prefix,id],left.filter((_,j)=>j!==i))):[prefix];
const allOrders=enumerate([],CHOICE_IDS);
check(allOrders.length===720&&new Set(allOrders.map(order=>order.join(''))).size===720,'six distinct cards have exactly 720 distinct permutations');
equal(choiceProduct(6),{factors:[6,5,4,3,2,1],product:720},'integer factors and final product');
equal(choiceProduct(6,0),{factors:[],product:1},'empty prefix is one unfilled arrangement');
assert.throws(()=>choiceProduct(19),RangeError);checks++;
assert.throws(()=>choiceProduct(6,7),RangeError);checks++;
equal(outShuffle([0,1,2,3,4,5,6,7]),[0,4,1,5,2,6,3,7],'exact outside interleave');
equal(SHUFFLE_ORDERS.map(order=>order.join('')),['ABCDEFGH','AEBFCGDH','ACEGBDFH','ABCDEFGH'],'three computed rounds');
const initial52=Array.from({length:52},(_,i)=>i);
check(outShuffle(outShuffle(outShuffle(initial52))).some((id,i)=>id!==i),'three rounds is not silently generalized to 52 cards');
assert.throws(()=>outShuffle([0,1,2]),RangeError);checks++;
const input=[0,1,2,3];outShuffle(input);equal(input,[0,1,2,3],'pure permutation never mutates caller');

for(const [i,start] of CHOICE_STARTS.entries()){
    const atStart=sampleChoiceProduct(start),atLand=sampleChoiceProduct(start+.9),atFactor=sampleChoiceProduct(start+1.3);
    equal(atStart.remainingIds,CHOICE_IDS.filter(id=>!CHOICE_ORDER.slice(0,i).includes(id)),'available identities match actual unused cards');
    check(atStart.remainingIds.length===atStart.choicesAtStart,'reported choice count is the number of remaining objects');
    check(atLand.chosenCount===i+1&&atLand.factorCount===i,'selection lands before its factor commits');
    check(atFactor.factorCount===i+1,'integer factor added after handoff');
    const subtrees=new Map();for(const order of allOrders){const key=order.slice(0,i+1).join('');subtrees.set(key,(subtrees.get(key)||0)+1);}
    check(subtrees.size===atFactor.formula.product,'prefix count agrees with independent enumerated permutations');
}

for(const c of candidates){
    check(c.loop===false&&c.previewTime>0&&c.previewTime<c.duration,'finite preview and held terminal state');
    check(c.stages.length===c.stageTimes.length,'one meaningful label per navigation stage');
    c.stageTimes.forEach((time,index)=>{
        check(Number.isFinite(time)&&time>=0&&time<c.duration&&(index===0||time>c.stageTimes[index-1]),'navigation stages strictly increase within timeline');
        check(typeof c.stages[index]==='string'&&c.stages[index].length>0,'each navigation stage has a usable label');
        check(c.sample(time).stageIndex===index,'exact stage boundary selects its own label');
    });
    equal(c.sample(-1),c.sample(0),'negative time clamps');equal(c.sample(NaN),c.sample(0),'invalid time clamps');equal(c.sample(99),c.sample(c.duration),'terminal state does not wrap');
    const times=[.8,14.4,3.21,c.duration,7.2,0,1.501];
    equal(times.map(t=>c.sample(t)),times.toReversed().map(t=>c.sample(t)).toReversed(),'arbitrary seeking has no history');
    for(let frame=0;frame<=c.duration*30;frame++){
        const s=c.sample(frame/30);samples++;
        const ids=s.cards.map(card=>card.id);equal([...ids].sort(),c.duration===20?[...CHOICE_IDS]:[...SHUFFLE_IDS],'identities never duplicate or disappear');
        check(s.annotation.length>0&&typeof s.phase==='string'&&Number.isInteger(s.stageIndex),'stage hooks available for script synchronization');
        check(typeof c.stages[s.stageIndex]==='string'&&c.stages[s.stageIndex].length>0,'every sampled stageIndex resolves a label');
        check(s.geometryStable===s.cards.every(card=>!card.moving),'geometryStable reflects actual object motion');
        if(s.readHold)check(s.geometryStable&&(s.resultAlpha===0||s.resultAlpha===1),'readHold excludes object motion and result fade');
        for(const card of s.cards){
            check(card.position.every(Number.isFinite)&&Number.isFinite(card.rotation)&&Number.isFinite(card.scale),'finite visible card geometry');
            const r=Math.hypot(card.width,card.height)*card.scale/2;
            check(card.position[0]-r>300&&card.position[0]+r<1330&&card.position[1]-r>205&&card.position[1]+r<650,'cards stay inside reserved stage and away from title/formula');
            const initial=c.sample(0).cards.find(p=>p.id===card.id);equal(card.color,initial.color,'color attached to identity, not slot');
        }
        if(c.duration===20){
            check(s.selectedIds.length+s.remainingIds.length===6,'chosen and unused identities partition deck');
            check(!s.selectedIds.some(id=>s.remainingIds.includes(id)),'chosen and remaining never overlap');
            check(s.factorCount<=s.chosenCount,'formula cannot get ahead of the selected card');
            const visibleFactors=s.factors.filter(f=>f.committed);equal(visibleFactors.map(f=>f.value),s.formula.factors,'visible settled factors are the computed factors');
            check(visibleFactors.reduce((p,f)=>p*f.value,1)===s.formula.product,'cumulative multiplication remains exact');
        }else{
            equal(outShuffle(s.sourceOrder),s.targetOrder,'every target order derives from the exact rule');
            for(const card of s.cards){
                check(s.sourceOrder[card.sourceIndex]===card.id&&s.targetOrder[card.targetIndex]===card.id,'identity follows computed source and target indices');
                check(card.targetIndex===(card.sourceIndex<4?2*card.sourceIndex:2*(card.sourceIndex-4)+1),'trajectory index is exactly the interleave permutation');
            }
        }
    }
}

// Actual resting geometry, not just an on-screen “read” label.
for(const start of CHOICE_STARTS){
    const a=sampleChoiceProduct(start+1.4),b=sampleChoiceProduct(start+2.05);
    equal(a.cards,b.cards,'choice cards hold while the new product is read');equal(a.formula,b.formula,'product holds for reading');
}
for(const start of SHUFFLE_ROUND_STARTS){
    const a=sampleOutShuffle(start+4.9),b=sampleOutShuffle(start+5.6);
    equal(a.cards,b.cards,'full post-shuffle rest window');
    equal(a.settledOrder,b.settledOrder,'permutation readable before next round');
    for(const card of a.cards){const index=a.settledOrder.indexOf(card.id);near(card.position[0],380+120*index,1e-9,'rested slot index');near(card.position[1],440);}
}
equal(sampleChoiceProduct(15.7).cards,sampleChoiceProduct(20).cards,'factorial ending holds');
equal(sampleOutShuffle(19.7).cards,sampleOutShuffle(22).cards,'shuffle ending holds');
for(const card of sampleOutShuffle(22).cards){const original=sampleOutShuffle(0).cards.find(p=>p.id===card.id);equal(card.position,original.position,'every identity returns to its starting position');}

// Numerical join continuity includes permutation round changes and formula handoffs.
const choiceJoins=CHOICE_STARTS.flatMap(start=>[start,start+.9,start+1.3]);
const shuffleJoins=SHUFFLE_ROUND_STARTS.flatMap(start=>[start,start+1.7,start+3.9,start+4.8,...[0,1,2,3].flatMap(i=>[start+1.7+i*.3,start+3+i*.3])]);
for(const [sample,joins] of [[sampleChoiceProduct,choiceJoins],[sampleOutShuffle,shuffleJoins]])for(const t of joins){
    const h=1e-4,a=sample(t-h),b=sample(t),c=sample(t+h);
    for(const card of b.cards){
        const l=a.cards.find(p=>p.id===card.id),r=c.cards.find(p=>p.id===card.id);
        check(distance(l.position,r.position)<.5,'no displacement jump at phase boundary');
        for(let axis=0;axis<2;axis++)near((card.position[axis]-l.position[axis])/h,(r.position[axis]-card.position[axis])/h,.15,'velocity continuous through phase boundary');
    }
}

// Record Canvas calls at representative stages; this is not browser appearance QA.
function recorder(){
    const calls=[],stack=[],state={globalAlpha:1};let gid=0;
    const ctx=new Proxy(state,{get(target,key){
        if(key in target)return target[key];
        if(key==='save')return()=>{stack.push({...target});calls.push(['save']);};
        if(key==='restore')return()=>{Object.assign(target,stack.pop());calls.push(['restore']);};
        if(key==='createLinearGradient'||key==='createRadialGradient')return(...args)=>{const id=gid++;calls.push([key,id,...args]);return {id,addColorStop:(...values)=>calls.push(['stop',id,...values])};};
        return(...args)=>{check(args.filter(v=>typeof v==='number').every(Number.isFinite),'finite Canvas draw arguments');calls.push([key,...args]);};
    },set(target,key,value){target[key]=value;calls.push(['set',key,value&&typeof value==='object'?value.id:value]);return true;}});
    return {ctx,calls};
}
for(const c of candidates)for(const palette of ['titanium','ember','porcelain'])for(const time of [0,2.1,4.2,7.5,14.8,c.duration]){
    const a=recorder(),b=recorder();c.draw(a.ctx,time,1600,900,{palette});c.draw(b.ctx,time,1600,900,{palette});equal(a.calls,b.calls,'identical draw stream on repeat');draws++;
}
const report={passed:true,checks,samples,draws,permutationsEnumerated:allOrders.length,
    verified:['Independent six-card enumeration','Count/identity/formula correspondence','Exact eight-card out-shuffle arithmetic','Three-round return only for the eight-card example','Fixed identities/colors','Continuous phase joins','Genuine reading holds','Arbitrary seeking','Finite Canvas geometry'],
    notVerified:['Source-code reconstruction','Real card contact physics','Randomness or mixing quality','Browser visual appearance','Narrated audio timing']};
writeFileSync(fileURLToPath(new URL('../qa/shuffle-explanation.json',import.meta.url)),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
