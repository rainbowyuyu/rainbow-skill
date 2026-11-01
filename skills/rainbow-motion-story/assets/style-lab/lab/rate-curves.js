/** Deterministic rate curves. No clock, state, randomness, or dependencies.
 * Derivatives are with respect to normalized time u, not seconds.
 * Physical springs continue for u > 1. Ideal impacts have velocity jumps.
 */

const fields = ['position', 'velocity', 'acceleration', 'jerk'];
const zero = position => ({position, velocity: 0, acceleration: 0, jerk: 0});
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const finite = (x, name) => { if (!Number.isFinite(x)) throw new TypeError(`${name} must be finite`); return x; };
const positive = (x, name) => { finite(x, name); if (x <= 0) throw new RangeError(`${name} must be positive`); return x; };
const parameter = (key, label, min, max, step, value) => ({key, label, min, max, step, default: value});
const preset = (id, title, feeling, useCase, risk, boundaryContinuity, parameters = [], extra = {}) =>
  Object.freeze({id, title, feeling, useCase, risk, boundaryContinuity, parameters: Object.freeze(parameters.map(Object.freeze)), domain: 'finite', ...extra});

export const PRESETS = Object.freeze([
  preset('linear', '匀速', '没有缓冲，距离等分', '机械匀速输送、计量刻度', '接入静止段时速度突变；不宜直接做镜头启停', 'C0 when joined to holds'),
  preset('ease-in', '逐渐加速', '先慢后快，推进到下一镜', '离场、进入遮挡物、需要延续运动的交接', '终点仍有速度；接静止画面会急停', 'C2 at start, C0 at end'),
  preset('ease-out', '减速抵达', '快速进入，逐渐看清', '标注入场、镜头抵达、对象归位', '起点已有速度；需从上一动作承接', 'C0 at start, C2 at end'),
  preset('ease-in-out', '余弦启停', '对称起落，峰值宽', '温和的位移与近景推拉', '接静止段时加速度有跳变', 'C1 when joined to holds'),
  preset('minimum-jerk', '最小跃度', '平稳启停，速度峰集中', '镜头接力、清晰的拆解、公式实体交接', '名称指固定时长端点约束下的最小积分平方jerk，不代表所有物体的物理规律', 'C2 when joined to holds'),
  preset('anticipate-release', '预备后释放', '先回撤，再推进', '蓄力、结构展开、强调一次因果动作', '有意回退；精确量值和相机使用需谨慎', 'C2; piecewise C3 is not guaranteed', [parameter('anticipation', '预备回撤', 0, .3, .01, .12)]),
  preset('overshoot-settle', '越过后归位', '先越界，再轻收', '软连接、弹性图形、非刚性文字强调', '设计曲线，不是弹簧方程；真实接触需改用约束', 'C2; piecewise C3 is not guaranteed', [parameter('overshoot', '越界比例', 0, .3, .01, .12)]),
  preset('spring-underdamped', '欠阻尼弹簧', '越过目标，逐次回稳', '弹性结构、控制响应、误差回稳', '目标仅渐近达到；不允许在u=1直接截成静止', 'C1 at force onset; analytic for u>0', [parameter('omega', '归一化固有角频率', 2, 24, .25, 12), parameter('zeta', '阻尼比', .1, .95, .01, .42)], {domain: 'settling'}),
  preset('spring-critical', '临界阻尼弹簧', '不越界，连续接近', '界面响应、平稳收敛、机械回正示意', '目标仅渐近达到；有限观察时长不等于完全停止', 'C1 at force onset; analytic for u>0', [parameter('omega', '归一化固有角频率', 2, 24, .25, 8.5)], {domain: 'settling'}),
  preset('hesitate-commit', '停一下再决定', '先试探，停留，再完成', '预测—观察—结果、两阶段讲解', '中间是明确停留，不能当连续物理惯性', 'C2; piecewise C3 is not guaranteed'),
  preset('impact-rebound', '碰撞与回弹', '落下、接触、逐次减小的跳起', '碰撞教学、柔性物体接触示意', '理想瞬时碰撞有速度跳变和冲量，不适合镜头；最后接触完全非弹性', 'C0 at contacts; ballistic between contacts', [parameter('rebound', '首跳高度比', .02, .3, .01, .16)]),
  preset('rush-hold-release', '快进—留白—交接', '快速建立状态，停住供阅读，再完成', '复杂图示、标题与主体的注意力交接', '停止位置是叙事设计；不是动力学求解', 'C2; piecewise C3 is not guaranteed'),
]);
export const curves = PRESETS;
const presetsById = new Map(PRESETS.map(p => [p.id, p]));

function parametersFor(meta, options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be an object');
  const out = {};
  for (const p of meta.parameters) {
    const v = options[p.key] ?? p.default;
    finite(v, p.key);
    if (v < p.min || v > p.max) throw new RangeError(`${p.key} must be in [${p.min}, ${p.max}]`);
    out[p.key] = v;
  }
  return out;
}

function quintic(q) {
  return {
    position: q*q*q*(10 + q*(-15 + 6*q)),
    velocity: 30*q*q*(1-q)*(1-q),
    acceleration: 60*q*(1-q)*(1-2*q),
    jerk: 60 - 360*q + 360*q*q,
  };
}
function segment(u, a, b, from, to) {
  if (from === to) return zero(from);
  const q = quintic((u-a)/(b-a)), d = to-from, t = b-a;
  return {position: from+d*q.position, velocity: d*q.velocity/t,
    acceleration: d*q.acceleration/(t*t), jerk: d*q.jerk/(t*t*t)};
}
function piecewise(u, knots) {
  let i = knots.length-2;
  for (let j=0; j<knots.length-1; j++) if (u < knots[j+1][0]) {i=j; break;}
  return segment(u, knots[i][0], knots[i+1][0], knots[i][1], knots[i+1][1]);
}
function designKnots(id, p) {
  if (id === 'anticipate-release') return [[0,0],[.22,-p.anticipation],[1,1]];
  if (id === 'overshoot-settle') return [[0,0],[.72,1+p.overshoot],[1,1]];
  if (id === 'hesitate-commit') return [[0,0],[.34,.42],[.52,.42],[1,1]];
  if (id === 'rush-hold-release') return [[0,0],[.22,.68],[.7,.68],[1,1]];
  return null;
}

function impactPlan(rebound) {
  const restitution = Math.sqrt(rebound);
  const fallTime = 1/(1+2*(restitution+restitution**2+restitution**3));
  const gravity = 2/(fallTime*fallTime);
  const flights = [{start:0, end:fallTime, position:0, velocity:0}];
  let start = fallTime;
  for (let i=1; i<=3; i++) {
    const duration = 2*fallTime*restitution**i;
    const end = i===3 ? 1 : start+duration;
    flights.push({start, end, position:1, velocity:-gravity*fallTime*restitution**i});
    start = end;
  }
  return {restitution, fallTime, gravity, flights};
}
function flightSample(flight, gravity, u) {
  const dt = u-flight.start;
  return {position:flight.position+flight.velocity*dt+.5*gravity*dt*dt,
    velocity:flight.velocity+gravity*dt, acceleration:gravity, jerk:0};
}
function impact(u, p) {
  if (u >= 1) return zero(1);
  const plan=impactPlan(p.rebound);
  const f=plan.flights.find(f => u<f.end) ?? plan.flights.at(-1);
  return flightSample(f,plan.gravity,u);
}

function raw(id,u,p) {
  const knots=designKnots(id,p);
  if(knots) return piecewise(u,knots);
  switch(id) {
    case 'linear': return {position:u, velocity:1, acceleration:0, jerk:0};
    case 'ease-in': return {position:u**3, velocity:3*u*u, acceleration:6*u, jerk:6};
    case 'ease-out': return {position:1-(1-u)**3, velocity:3*(1-u)**2, acceleration:-6*(1-u), jerk:6};
    case 'ease-in-out': return {position:.5-.5*Math.cos(Math.PI*u), velocity:.5*Math.PI*Math.sin(Math.PI*u), acceleration:.5*Math.PI**2*Math.cos(Math.PI*u), jerk:-.5*Math.PI**3*Math.sin(Math.PI*u)};
    case 'minimum-jerk': return quintic(u);
    case 'spring-underdamped': {
      const w=p.omega,z=p.zeta,b=w*Math.sqrt(1-z*z),a=z*w,decay=Math.exp(-a*u);
      const position=1-decay*(Math.cos(b*u)+(a/b)*Math.sin(b*u));
      const velocity=w*w/b*decay*Math.sin(b*u);
      const acceleration=w*w*(1-position)-2*a*velocity;
      return {position,velocity,acceleration,jerk:-w*w*velocity-2*a*acceleration};
    }
    case 'spring-critical': {
      const w=p.omega,decay=Math.exp(-w*u),position=1-(1+w*u)*decay;
      const velocity=w*w*u*decay,acceleration=w*w*(1-w*u)*decay;
      return {position,velocity,acceleration,jerk:w**3*(w*u-2)*decay};
    }
    case 'impact-rebound': return impact(u,p);
    default: throw new RangeError(`Unknown curve: ${id}`);
  }
}
function event(u, kind, left, right) {
  let order = fields.findIndex((key,i) => i>0 && Math.abs(left[key]-right[key])>1e-8);
  if(order<0) return null;
  return {u,order,kind,left,right,leftVelocity:left.velocity,rightVelocity:right.velocity};
}
function eventsFor(meta,p) {
  const id=meta.id, events=[];
  events.push(event(0,'motion-onset',zero(0),raw(id,0,p)));
  const knots=designKnots(id,p);
  if(knots) for(let i=1;i<knots.length-1;i++) {
    const [u,value]=knots[i], prev=knots[i-1], next=knots[i+1];
    events.push(event(u,'designed-phase',segment(u,prev[0],u,prev[1],value),segment(u,u,next[0],value,next[1])));
  }
  if(id==='impact-rebound') {
    const {flights,gravity}=impactPlan(p.rebound);
    for(let i=0;i<flights.length;i++) {
      const f=flights[i], u=f.end;
      const left=flightSample(f,gravity,u),right=i+1<flights.length ? flightSample(flights[i+1],gravity,u) : zero(1);
      events.push(event(u,i+1<flights.length?'ideal-impact':'final-inelastic-contact',left,right));
    }
  } else if(meta.domain==='finite') events.push(event(1,'motion-end',raw(id,1,p),zero(1)));
  return events.filter(Boolean);
}

/** Exact-event derivatives are right-sided at internal joins, left-sided at
 * a finite ordinary endpoint, and right-sided at all ideal impact events.
 * Consult discontinuities: a one-sided value is not a classical derivative.
 */
export function sampleCurve(id,u,options={}) {
  finite(u,'u');
  const meta=presetsById.get(id);
  if(!meta) throw new RangeError(`Unknown curve: ${id}`);
  const params=parametersFor(meta,options),discontinuities=eventsFor(meta,params);
  const before=u<0,after=meta.domain==='finite'&&u>1;
  const values=before?zero(0):after?zero(1):raw(id,u,params);
  const at=discontinuities.find(e=>e.u===u);
  let derivativeSide=at ? 'right' : 'two-sided';
  if(u===1&&meta.domain==='finite'&&id!=='impact-rebound') derivativeSide='left';
  if(before||after) derivativeSide='two-sided';
  return {...values,u,domain:meta.domain,parameters:params,derivativeSide,atDiscontinuity:Boolean(at),discontinuities};
}

/** duration is the normalized response time scale, not a spring cutoff. */
export function sampleMotion(id,timeSeconds,options={}) {
  finite(timeSeconds,'timeSeconds');
  const {duration=2.4,distance=1,origin=0,...curveOptions}=options;
  positive(duration,'duration');finite(distance,'distance');finite(origin,'origin');
  const normalized=sampleCurve(id,timeSeconds/duration,curveOptions);
  return {...normalized,position:origin+distance*normalized.position,
    velocity:distance/duration*normalized.velocity,
    acceleration:distance/(duration*duration)*normalized.acceleration,
    jerk:distance/(duration**3)*normalized.jerk,
    normalized,timeSeconds,duration,distance,origin};
}

function cubic(t,a,b) {
  return {value:3*(1-t)**2*t*a+3*(1-t)*t*t*b+t**3,
    d1:3*a+6*(b-2*a)*t+3*(1-3*b+3*a)*t*t,
    d2:6*(b-2*a)+6*(1-3*b+3*a)*t,d3:6*(1-3*b+3*a)};
}

/** CSS cubic-bezier: invert x(s)=u first; y(u) is not y(s=u).
 * Degenerate inverse derivatives are null rather than guessed or clamped.
 */
export function sampleBezier(u,controls) {
  finite(u,'u');
  if(u<0||u>1) throw new RangeError('Bezier u must be in [0,1]');
  if(!Array.isArray(controls)||controls.length!==4) throw new TypeError('Bezier controls must be [x1,y1,x2,y2]');
  controls.forEach((x,i)=>finite(x,`controls[${i}]`));
  const [x1,y1,x2,y2]=controls;
  if(x1<0||x1>1||x2<0||x2>1) throw new RangeError('CSS Bezier x controls must be in [0,1]');
  let low=0,high=1,t=u;
  if(u!==0&&u!==1) for(let i=0;i<60;i++) {t=(low+high)/2;if(cubic(t,x1,x2).value<u)low=t;else high=t;}
  const x=cubic(t,x1,x2),y=cubic(t,y1,y2),side=u===0?'right':u===1?'left':'two-sided';
  const extra={u,parameter:t,solveError:Math.abs(x.value-u),derivativeSide:side};
  if(x1===y1&&x2===y2) return {...zero(u),velocity:1,singular:false,...extra};
  if(Math.abs(x.d1)<1e-9) return {position:y.value,velocity:null,acceleration:null,jerk:null,singular:true,...extra};
  const velocity=y.d1/x.d1;
  const acceleration=(y.d2*x.d1-y.d1*x.d2)/x.d1**3;
  const jerk=(y.d3*x.d1*x.d1-y.d1*x.d3*x.d1-3*y.d2*x.d1*x.d2+3*y.d1*x.d2*x.d2)/x.d1**5;
  return {position:y.value,velocity,acceleration,jerk,singular:false,...extra};
}

/** Integrate piecewise-linear, non-negative speed exactly. Knots use seconds.
 * sourceTime = sourceOffset + integral(speed(t) dt); no hidden normalization.
 */
export function buildTimeRemap(speedKnots,{sourceOffset=0}={}) {
  finite(sourceOffset,'sourceOffset');
  if(!Array.isArray(speedKnots)||speedKnots.length<2) throw new TypeError('At least two speed knots are required');
  const knots=speedKnots.map((k,i)=>{
    const time=finite(k.time,`knots[${i}].time`),speed=finite(k.speed,`knots[${i}].speed`);
    if(speed<0)throw new RangeError('Negative playback speed is not supported');
    if((i===0&&time!==0)||(i>0&&time<=speedKnots[i-1].time))throw new RangeError('Knot times must start at zero and strictly increase');
    return {time,speed};
  });
  const areas=[0];
  for(let i=1;i<knots.length;i++)areas.push(areas[i-1]+(knots[i].time-knots[i-1].time)*(knots[i].speed+knots[i-1].speed)/2);
  const duration=knots.at(-1).time,sourceDuration=areas.at(-1);
  const sample=time=>{
    finite(time,'time');
    if(time<0)return {time,sourceTime:sourceOffset,speed:0,acceleration:0,segment:0,clamped:true,derivativeSide:'two-sided'};
    if(time>duration)return {time,sourceTime:sourceOffset+sourceDuration,speed:0,acceleration:0,segment:knots.length-2,clamped:true,derivativeSide:'two-sided'};
    let i=knots.length-2;
    for(let j=0;j<knots.length-1;j++)if(time<knots[j+1].time){i=j;break;}
    const a=knots[i],b=knots[i+1],dt=time-a.time,slope=(b.speed-a.speed)/(b.time-a.time);
    return {time,sourceTime:sourceOffset+areas[i]+a.speed*dt+.5*slope*dt*dt,
      speed:a.speed+slope*dt,acceleration:slope,segment:i,clamped:false,
      derivativeSide:time===duration?'left':knots.some(k=>k.time===time)?'right':'two-sided'};
  };
  return {knots,duration,sourceDuration,sourceOffset,sample};
}

/** Uniform parameter sampling builds an approximate polyline arc-length table.
 * Increase segments until arc-length and pose errors meet the project's needs.
 */
export function buildArcLengthTable(path,{segments=512}={}) {
  if(typeof path!=='function')throw new TypeError('path must be a function');
  if(!Number.isInteger(segments)||segments<2||segments>100000)throw new RangeError('segments must be an integer in [2,100000]');
  const points=[],lengths=[0];let dimensions;
  for(let i=0;i<=segments;i++) {
    const point=path(i/segments);
    if(!Array.isArray(point)||(point.length!==2&&point.length!==3))throw new TypeError('path must return a 2D or 3D array');
    dimensions??=point.length;
    if(point.length!==dimensions)throw new TypeError('path dimensions must remain constant');
    point.forEach((x,j)=>finite(x,`path[${i}][${j}]`));points.push([...point]);
    if(i>0)lengths.push(lengths[i-1]+Math.hypot(...point.map((x,j)=>x-points[i-1][j])));
  }
  return {segments,dimensions,points,lengths,totalLength:lengths.at(-1),method:'polyline-chord-approximation'};
}

/** point and tangent refer to the table's polyline. Evaluate your analytic path
 * at the returned parameter if a curved (rather than chord) position is needed.
 */
export function sampleArcLength(table,fraction) {
  finite(fraction,'fraction');
  if(!table||!Array.isArray(table.points)||!Array.isArray(table.lengths)||table.points.length!==table.lengths.length||table.points.length<3||table.segments!==table.points.length-1||!Number.isFinite(table.totalLength)||table.totalLength<0)throw new TypeError('Invalid arc-length table');
  const f=clamp(fraction,0,1),distance=f*table.totalLength;
  if(table.totalLength===0)return {point:[...table.points[0]],parameter:0,distance:0,totalLength:0,tangent:table.points[0].map(()=>0),degenerate:true};
  let low=0,high=table.lengths.length-1;
  while(high-low>1){const mid=(low+high)>>1;if(table.lengths[mid]<=distance)low=mid;else high=mid;}
  if(distance===table.totalLength){low=table.lengths.length-2;high=low+1;while(low>0&&table.lengths[high]===table.lengths[low])low--;}
  const span=table.lengths[high]-table.lengths[low],q=span?(distance-table.lengths[low])/span:0;
  const a=table.points[low],b=table.points[high],delta=b.map((v,i)=>v-a[i]),magnitude=Math.hypot(...delta);
  return {point:a.map((v,i)=>v+q*delta[i]),parameter:(low+q*(high-low))/table.segments,
    distance,totalLength:table.totalLength,tangent:delta.map(v=>magnitude?v/magnitude:0),degenerate:false};
}
