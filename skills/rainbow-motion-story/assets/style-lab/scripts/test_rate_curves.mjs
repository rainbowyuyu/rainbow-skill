import assert from 'node:assert/strict';
import {PRESETS,curves,sampleCurve,sampleMotion,sampleBezier,buildTimeRemap,buildArcLengthTable,sampleArcLength}
  from '../lab/rate-curves.js';

let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const close=(a,b,absolute=1e-8,relative=1e-7,label='value')=>
  check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=absolute+relative*Math.max(Math.abs(a),Math.abs(b)),`${label}: ${a} vs ${b}`);
const throws=(f,label)=>{assert.throws(f,undefined,label);checks++;};

check(PRESETS.length===12&&new Set(PRESETS.map(p=>p.id)).size===12,'12 distinct preset IDs');
check(curves===PRESETS,'UI alias shares the same metadata');
let derivativeSamples=0,determinismSamples=0;
for(const p of PRESETS) {
  check(p.title&&p.feeling&&p.useCase&&p.risk&&p.boundaryContinuity,'complete applicability metadata');
  for(const param of p.parameters) check(param.default>=param.min&&param.default<=param.max,'parameter default in range');
  close(sampleCurve(p.id,0).position,0,1e-12,0,`${p.id} start`);
  if(p.domain==='finite')close(sampleCurve(p.id,1).position,1,2e-12,0,`${p.id} end`);
  close(sampleCurve(p.id,-1).position,0,0,0,'hold before start');
  if(p.domain==='finite')for(const key of ['velocity','acceleration','jerk'])close(sampleCurve(p.id,1.1)[key],0,0,0,'finite tail holds');
  for(let i=1;i<200;i++) {
    const u=i/200,h=1e-5,s=sampleCurve(p.id,u);
    assert.deepEqual(sampleCurve(p.id,u),s);determinismSamples++;
    for(const key of ['position','velocity','acceleration','jerk'])check(Number.isFinite(s[key]),`${p.id} ${key} finite`);
    if(s.discontinuities.some(e=>Math.abs(e.u-u)<h*2))continue;
    const a=sampleCurve(p.id,u-h),b=sampleCurve(p.id,u+h);
    close((b.position-a.position)/(2*h),s.velocity,1e-6,2e-6,`${p.id} analytic velocity`);
    close((b.velocity-a.velocity)/(2*h),s.acceleration,2e-5,2e-6,`${p.id} analytic acceleration`);
    close((b.acceleration-a.acceleration)/(2*h),s.jerk,4e-4,3e-6,`${p.id} analytic jerk`);
    derivativeSamples++;
  }
  // Random access includes reverse ordering. There is no integrator state to reset.
  const forward=Array.from({length:31},(_,i)=>sampleCurve(p.id,i/30));
  const reverse=Array.from({length:31},(_,i)=>sampleCurve(p.id,(30-i)/30)).reverse();
  assert.deepEqual(forward,reverse);checks++;
  for(const event of sampleCurve(p.id,.5).discontinuities) {
    close(event.left.position,event.right.position,1e-10,0,`${p.id} C0 at ${event.u}`);
    if(event.order>=2)close(event.left.velocity,event.right.velocity,1e-9,0,`${p.id} C1 at ${event.u}`);
    if(event.order>=3)close(event.left.acceleration,event.right.acceleration,1e-7,0,`${p.id} C2 at ${event.u}`);
    check(Math.abs(event.left[['position','velocity','acceleration','jerk'][event.order]]-event.right[['position','velocity','acceleration','jerk'][event.order]])>1e-8,'declared derivative discontinuity exists');
  }
  // Advertised parameter limits remain finite and deterministic, including tails.
  const edgeOptions=p.parameters.reduce((all,param)=>all.flatMap(o=>[{...o,[param.key]:param.min},{...o,[param.key]:param.max}]),[{}]);
  for(const options of edgeOptions)for(const u of [0,.1,.22,.5,.72,.99,1,1.5,20]) {
    const s=sampleCurve(p.id,u,options);
    for(const key of ['position','velocity','acceleration','jerk'])check(Number.isFinite(s[key]),`${p.id} ${key} finite at parameter limits`);
    assert.deepEqual(sampleCurve(p.id,u,options),s);checks++;
  }
}

// Curve semantics: non-monotone motion is intentional, not an easing bug.
for(const id of ['linear','ease-in','ease-out','ease-in-out','minimum-jerk','spring-critical','hesitate-commit','rush-hold-release'])
  for(let i=1;i<500;i++)check(sampleCurve(id,i/500).velocity>=-1e-12,`${id} monotone`);
check(sampleCurve('anticipate-release',.1).position<0,'anticipation intentionally goes backwards');
check(sampleCurve('overshoot-settle',.72).position>1,'designed overshoot exceeds target');
close(sampleCurve('hesitate-commit',.45).position,.42,0,0,'hesitation holds');
close(sampleCurve('hesitate-commit',.45).velocity,0,0,0,'hesitation has a true hold');
close(sampleCurve('rush-hold-release',.5).position,.68,0,0,'rush holds a different phase');
for(const id of ['minimum-jerk','anticipate-release','overshoot-settle','hesitate-commit','rush-hold-release'])
  check(sampleCurve(id,.1).discontinuities.every(e=>e.order===3),`${id} is C2 joined to holds`);
check(sampleCurve('ease-in-out',.1).discontinuities.every(e=>e.order===2),'cosine joins are C1, not C2');
check(sampleCurve('linear',.1).discontinuities.every(e=>e.order===1),'linear joins are C0, not C1');

// Physical spring solves p'' + 2*zeta*omega*p' + omega^2*(p-1)=0.
for(const id of ['spring-underdamped','spring-critical'])for(const u of [.01,.2,.7,1,1.1,1.7,3]) {
  const s=sampleCurve(id,u),w=s.parameters.omega,z=s.parameters.zeta??1;
  close(s.acceleration+2*z*w*s.velocity+w*w*(s.position-1),0,5e-12,0,'spring ODE residual');
}
check(sampleCurve('spring-underdamped',1.01).velocity!==0,'underdamped tail is not cut at u=1');
check(sampleCurve('spring-critical',1.01).velocity>0,'critical tail continues beyond u=1');
check(sampleCurve('spring-underdamped',.3).position>1,'underdamped overshoots');
close(sampleCurve('spring-critical',20).position,1,1e-12,0,'critical converges');
for(const id of ['spring-underdamped','spring-critical']) {
  const a=sampleCurve(id,1-1e-7),b=sampleCurve(id,1+1e-7);
  close(a.position,b.position,1e-6,0,'spring has no splice at u=1');
  close(a.velocity,b.velocity,1e-5,0,'spring velocity continuous at u=1');
}

// All free flights share one acceleration; velocity flips via restitution.
for(const rebound of [.02,.16,.3]) {
  const s=sampleCurve('impact-rebound',.3,{rebound}),g=sampleCurve('impact-rebound',.001,{rebound}).acceleration;
  const impacts=s.discontinuities.filter(e=>e.kind==='ideal-impact');
  check(impacts.length===3,'three elastic contacts before final rest');
  for(const e of impacts) {
    close(e.right.velocity,-Math.sqrt(rebound)*e.left.velocity,1e-11,0,'impact coefficient of restitution');
    close(e.left.acceleration,g,1e-10,0,'same gravity before contact');
    close(e.right.acceleration,g,1e-10,0,'same gravity after contact');
    const exact=sampleCurve('impact-rebound',e.u,{rebound});
    close(exact.velocity,e.right.velocity,1e-9,0,'impact event takes declared right side');
    check(exact.derivativeSide==='right'&&exact.atDiscontinuity,'impact derivative is explicitly one-sided');
  }
  const first=impacts[0],second=impacts[1],top=sampleCurve('impact-rebound',(first.u+second.u)/2,{rebound});
  close(1-top.position,rebound,1e-10,0,'rebound parameter equals first bounce height ratio');
  close(top.velocity,0,1e-10,0,'ballistic apex velocity zero');
  const final=s.discontinuities.find(e=>e.kind==='final-inelastic-contact');
  check(final.left.velocity>0&&final.right.velocity===0&&final.order===1,'last collision absorbs remaining momentum');
}

// World units must account for duration powers, including direction reversal.
for(const duration of [.5,2.4,5])for(const distance of [-7,0,12]) {
  const u=.37,s=sampleCurve('minimum-jerk',u),m=sampleMotion('minimum-jerk',u*duration,{duration,distance,origin:4});
  close(m.position,4+distance*s.position,1e-12,0,'world position');
  close(m.velocity,distance/duration*s.velocity,1e-12,0,'world velocity');
  close(m.acceleration,distance/duration**2*s.acceleration,1e-11,0,'world acceleration');
  close(m.jerk,distance/duration**3*s.jerk,1e-10,0,'world jerk');
}

// CSS timing functions must solve x(s)=u, not substitute s=u.
const controls=[.25,.1,.25,1];
const mid=sampleBezier(.5,controls);
close(mid.position,.802403387584857,1e-12,0,'CSS ease known midpoint');
check(Math.abs(mid.parameter-.5)>.1,'CSS inversion changes the curve parameter');
for(const c of [controls,[.42,0,1,1],[0,0,.58,1],[.2,-.3,.8,1.3]])for(let i=1;i<100;i++) {
  const u=i/100,h=1e-5,s=sampleBezier(u,c),a=sampleBezier(u-h,c),b=sampleBezier(u+h,c);
  check(s.solveError<1e-13,'Bezier inverse has bounded residual');
  close((b.position-a.position)/(2*h),s.velocity,3e-6,2e-6,'Bezier velocity chain rule');
  close((b.velocity-a.velocity)/(2*h),s.acceleration,5e-5,4e-6,'Bezier acceleration chain rule');
  close((b.acceleration-a.acceleration)/(2*h),s.jerk,8e-4,8e-6,'Bezier jerk chain rule');
}
for(const c of [[0,0,1,1],[1,1,0,0]])for(const u of [0,.1,.5,.99,1]) {
  const s=sampleBezier(u,c);close(s.position,u,0,0,'removable diagonal singularity');close(s.velocity,1,0,0,'diagonal slope');
}
const singular=sampleBezier(0,[0,.3,.5,1]);
check(singular.singular&&singular.velocity===null&&singular.acceleration===null,'singular inverse derivatives are not fabricated');
check(sampleBezier(.5,[1,0,0,1]).singular,'internal vertical tangent is marked singular');

// Source clock must be the area under speed, never t*instantaneousSpeed(t).
const remap=buildTimeRemap([{time:0,speed:0},{time:2,speed:2},{time:3,speed:2},{time:4,speed:0}],{sourceOffset:5});
close(remap.sourceDuration,5,0,0,'integrated source duration');
close(remap.sample(1).sourceTime,5.5,0,0,'ramp area');
close(remap.sample(2).sourceTime,7,0,0,'first ramp complete');
close(remap.sample(3).sourceTime,9,0,0,'constant speed segment');
close(remap.sample(4).sourceTime,10,0,0,'final source time');
close(remap.sample(10).sourceTime,10,0,0,'time remap holds after end');
close(remap.sample(-1).sourceTime,5,0,0,'time remap holds before start');
for(const t of [.1,.9,1.5,2.3,3.2,3.9]) {
  const h=1e-5,a=remap.sample(t-h),b=remap.sample(t+h),s=remap.sample(t);
  close((b.sourceTime-a.sourceTime)/(2*h),s.speed,1e-9,0,'sourceTime derivative is speed');
  close((b.speed-a.speed)/(2*h),s.acceleration,1e-9,0,'speed derivative is acceleration');
}
const hold=buildTimeRemap([{time:0,speed:1},{time:1,speed:0},{time:2,speed:0},{time:3,speed:1}]);
close(hold.sample(1.2).sourceTime,hold.sample(1.8).sourceTime,0,0,'speed zero genuinely freezes source time');
const constant=buildTimeRemap([{time:0,speed:.5},{time:10,speed:.5}]);
close(constant.sourceDuration,5,0,0,'constant slow motion area');

// Arc length: nonuniform parameterization cannot masquerade as uniform speed.
const straight=buildArcLengthTable(u=>[u*u*10,0,0],{segments:512});
for(const f of [0,.1,.25,.5,.9,1]) {
  const s=sampleArcLength(straight,f);close(s.point[0],10*f,1e-12,0,'uniform physical distance on nonuniform parameter path');
  close(s.parameter,Math.sqrt(f),.0001,0,'arc length recovers nonlinear parameter');
  close(Math.hypot(...s.tangent),1,1e-12,0,'arc tangent normalized');
}
const circle=buildArcLengthTable(u=>[Math.cos(u*Math.PI*2),Math.sin(u*Math.PI*2)],{segments:2048});
close(circle.totalLength,2*Math.PI,3e-6,0,'circle circumference converges');
let steps=[];
for(let i=0;i<100;i++){const a=sampleArcLength(circle,i/100),b=sampleArcLength(circle,(i+1)/100);steps.push(Math.hypot(...a.point.map((v,j)=>v-b.point[j])));}
check(Math.max(...steps)-Math.min(...steps)<2e-7,'circle equal arc fractions have uniform chord spacing');
const coarse=buildArcLengthTable(u=>[Math.cos(u*Math.PI*2),Math.sin(u*Math.PI*2)],{segments:32});
check(Math.abs(circle.totalLength-2*Math.PI)<Math.abs(coarse.totalLength-2*Math.PI),'arc-length resolution improves approximation');
const stopped=buildArcLengthTable(()=>[3,4]);
check(sampleArcLength(stopped,.4).degenerate,'zero-length path explicitly declared');
assert.deepEqual(sampleArcLength(stopped,.4).point,[3,4]);checks++;
const repeats=buildArcLengthTable(u=>u<.5?[0,0]:[2*u-1,0],{segments:64});
close(sampleArcLength(repeats,0).point[0],0,0,0,'repeated vertices supported');

// Invalid inputs should fail early rather than leak NaN into a renderer.
throws(()=>sampleCurve('missing',.5),'unknown preset');
throws(()=>sampleCurve('linear',NaN),'nonfinite time');
throws(()=>sampleCurve('spring-underdamped',.2,{zeta:1}),'wrong damping regime');
throws(()=>sampleCurve('spring-critical',.2,{omega:0}),'invalid spring frequency');
throws(()=>sampleMotion('linear',1,{duration:0}),'zero duration');
throws(()=>sampleBezier(.5,[-1,0,1,1]),'invalid CSS x control');
throws(()=>sampleBezier(1.5,[0,0,1,1]),'Bezier outside domain');
throws(()=>buildTimeRemap([{time:0,speed:1},{time:0,speed:2}]),'repeated knot time');
throws(()=>buildTimeRemap([{time:1,speed:1},{time:2,speed:2}]),'missing initial knot');
throws(()=>buildTimeRemap([{time:0,speed:1},{time:1,speed:-1}]),'reverse speed unsupported');
throws(()=>buildArcLengthTable(()=>[NaN,0]),'invalid path point');
throws(()=>buildArcLengthTable(()=>[0,0],{segments:1}),'insufficient path resolution');
throws(()=>sampleArcLength({},.4),'invalid arc table');

console.log(JSON.stringify({passed:true,presets:PRESETS.length,checks,derivativeSamples,determinismSamples,
  cssEaseMidpoint:mid.position,integratedSourceDuration:remap.sourceDuration,
  circleLengthError:Math.abs(circle.totalLength-2*Math.PI),
  limitations:['Analytic and numerical checks do not certify perceptual comfort.','Ideal impact acceleration includes impulses at contacts.','Arc-length table approximates a path with chords.']},null,2));
