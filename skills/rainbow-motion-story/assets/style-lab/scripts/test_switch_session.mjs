import assert from 'node:assert/strict';
import {planSwitchTransition,sampleSwitchTransition} from '../lab/modules/switch-session.js';
const origin={press:0,cut:1,explode:1,focus:0};
const down=planSwitchTransition(origin,{press:1},0);
for(let i=0;i<=1000;i++){const s=sampleSwitchTransition(down,i/1000);assert.ok(s.press*s.explode<1e-12,'never operate a disassembled switch');}
assert.deepEqual(sampleSwitchTransition(down,2),{press:1,cut:1,explode:0,focus:0});
const split=planSwitchTransition(sampleSwitchTransition(down,2),{explode:1},2);
for(let i=0;i<=1000;i++){const s=sampleSwitchTransition(split,2+i/1000);assert.ok(s.press*s.explode<1e-12);}
for(const t of [.01,.12,.32,.47,.65,.84]){
 const start=sampleSwitchTransition(down,t),reverse=planSwitchTransition(start,{explode:1},t);
 assert.deepEqual(sampleSwitchTransition(reverse,t),start,'reversal preserves current position');
 for(let i=0;i<=100;i++){const s=sampleSwitchTransition(reverse,t+i/100);assert.ok(s.press*s.explode<1e-12);}
}
const instant=planSwitchTransition(origin,{press:1},0,{reducedMotion:true});assert.equal(instant.end,0);assert.equal(sampleSwitchTransition(instant,0).press,1);
assert.deepEqual(sampleSwitchTransition(down,.7),sampleSwitchTransition(down,.7));
assert.throws(()=>planSwitchTransition(origin,{press:1},NaN));
console.log(JSON.stringify({status:'passed',checks:['assembly before activation','release before explosion','six mid-motion reversals','reduced motion','absolute time determinism'],claim:'state invariants, not browser pixels or mechanical dynamics'}));
