/** Piecewise constant shaft speed. Editing a speed preserves the angle at that time. */
export const TAU=Math.PI*2;
export const DEFAULT_MOTOR=[{time:0,rpm:10,angle:0}];
const finite=(v,name)=>{if(!Number.isFinite(v))throw new TypeError(name+' must be finite');return v;};
export function validateMotor(events){
 if(!Array.isArray(events)||!events.length||events[0].time!==0)throw new RangeError('Motor events must begin at zero');
 for(let i=0;i<events.length;i++){
  const e=events[i];finite(e.time,'time');finite(e.rpm,'rpm');finite(e.angle,'angle');
  if(e.time<0||e.rpm<0||e.rpm>30||(i&&e.time<=events[i-1].time))throw new RangeError('Invalid motor event');
  if(i){const p=events[i-1],expected=p.angle+(e.time-p.time)*p.rpm*TAU/60;if(Math.abs(expected-e.angle)>1e-8)throw new RangeError('Discontinuous motor angle');}
 }
 return events;
}
export function motorAt(events,t){
 finite(t,'time');validateMotor(events);t=Math.max(0,t);
 let e=events[0];for(const next of events){if(next.time>t)break;e=next;}
 return {angle:e.angle+(t-e.time)*e.rpm*TAU/60,rpm:e.rpm};
}
export function setMotorSpeed(events,t,rpm){
 finite(t,'time');finite(rpm,'rpm');if(t<0||rpm<0||rpm>30)throw new RangeError('Speed outside demo range');
 const angle=motorAt(events,t).angle;
 const next=events.filter(e=>e.time<t).map(e=>({...e}));next.push({time:t,rpm,angle});return validateMotor(next);
}
export function resumeSpeedAt(events,t){
 finite(t,'time');validateMotor(events);let rpm=10;
 for(const e of events){if(e.time>Math.max(0,t))break;if(e.rpm>0)rpm=e.rpm;}
 return rpm;
}
