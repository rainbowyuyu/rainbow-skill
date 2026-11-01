/** Interruptible presentation controller. Operation requires assembly. */
const keys=['press','cut','explode','focus'];
const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ease=x=>{const t=clamp(x);return t*t*t*(10+t*(-15+6*t));};
export function switchControls(state){return Object.fromEntries(keys.map(k=>[k,clamp(state[k])]));}
export function sampleSwitchTransition(plan,now){
 if(!plan)return null;
 let state={...plan.from};
 for(const segment of plan.segments){
  if(now<segment.start)return state;
  const u=segment.duration?ease((now-segment.start)/segment.duration):1;
  state=Object.fromEntries(keys.map(k=>[k,segment.from[k]+(segment.to[k]-segment.from[k])*u]));
  if(now<segment.start+segment.duration)return state;
 }
 return {...plan.to};
}
export function planSwitchTransition(from,patch,now,{duration=.45,reducedMotion=false}={}){
 if(!Number.isFinite(now)||!Number.isFinite(duration)||duration<0)throw new TypeError('finite time and nonnegative duration required');
 const start=switchControls(from),target=switchControls({...start,...patch}),segments=[];
 if(target.press>0&&target.explode>0){if(patch.explode>0)target.press=0;else target.explode=0;}
 let cursor=now,current={...start};
 const append=to=>{if(keys.every(k=>Math.abs(to[k]-current[k])<1e-10))return;const d=reducedMotion?0:duration;segments.push({from:{...current},to:{...to},start:cursor,duration:d});cursor+=d;current={...to};};
 // Resolve the physical precondition before starting the requested change.
 if(target.press>0&&current.explode>0)append({...current,explode:0});
 if(target.explode>0&&current.press>0)append({...current,press:0});
 append(target);
 return{from:start,to:target,start:now,end:cursor,segments};
}
