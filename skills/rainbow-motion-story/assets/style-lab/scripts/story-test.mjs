import assert from 'node:assert/strict';
import {inspectStory} from './inspect_story.mjs';
const base={title:'结构检查样例',duration:2,centralQuestion:'会停在哪？',answer:'还会前进一段距离',terms:[{id:'speed'}],sources:[{id:'physics'}],beats:[{id:'a',start:0,end:1,question:'是否到线才刹车？',beforeBelief:'到线即可停止',afterBelief:'仍有速度',visual:'显示位置和速度',anchorIn:'cart',anchorOut:'cart',narration:'小车到线后仍在运动。',evidence:'illustrative',sourceIds:[],introduces:['speed']},{id:'b',start:1,end:2,question:'怎么提前判断？',beforeBelief:'只看位置',afterBelief:'也要看速度',visual:'制动距离',anchorIn:'cart',anchorOut:'cart',narration:'速度越大，需要的制动距离越长。',evidence:'derived',sourceIds:['physics'],uses:['speed'],dependsOn:['a'],readingWindow:{start:1.2,end:1.8}}]};
assert(inspectStory(base).passed);
const cases=[['dependency',s=>s.beats[0].dependsOn=['b']],['unintroduced',s=>s.beats[0].introduces=[]],['coverage',s=>s.beats[1].start=1.2],['source',s=>s.beats[1].sourceIds=['unknown']],['reading',s=>s.beats[1].readingWindow.end=3],['id',s=>s.beats[1].id='a']];
for(const [code,breakIt]of cases){const s=structuredClone(base);breakIt(s);assert(inspectStory(s).issues.some(i=>i.code===code),code)}
console.log(JSON.stringify({passed:true,validStory:true,rejectedFaults:cases.map(c=>c[0])}));
