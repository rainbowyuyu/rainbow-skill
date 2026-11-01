/** Presentation timing only. Physical trajectories remain saved simulation data. */
export const unit = (x:number) => Math.max(0, Math.min(1,x));

/** Zero velocity and acceleration at both ends: useful for a readable settle. */
export const settle = (x:number) => {
 const t=unit(x); return t*t*t*(t*(t*6-15)+10);
};

/** A real hold separates arrival from departure; this is not a repeating pulse. */
export function breathingWindow(frame:number,start:number,end:number,enter=18,leave=18):number {
 if(end<=start || frame<=start || frame>=end)return 0;
 const duration=end-start;
 const a=Math.max(0,Math.min(enter,duration/2)),b=Math.max(0,Math.min(leave,duration/2));
 return (a?settle((frame-start)/a):1)*(b?settle((end-frame)/b):1);
}

/** Sequential parts enter along their assembly axes; identity is never reset. */
export function staggerProgress(frame:number,start:number,travel:number,index:number,delay:number):number {
 return travel<=0?Number(frame>=start+index*delay):settle((frame-start-index*delay)/travel);
}

export type Point2=readonly[number,number];
/** One highlighted quantity can leave its physical anchor and arrive in a formula. */
export function tokenFlight(frame:number,start:number,end:number,from:Point2,to:Point2,bend=0):{x:number;y:number;progress:number} {
 const t=end<=start?Number(frame>=end):settle((frame-start)/(end-start));
 const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy)||1;
 const control:[number,number]=[(from[0]+to[0])/2-dy/length*bend,(from[1]+to[1])/2+dx/length*bend];
 const a=1-t;
 return{x:a*a*from[0]+2*a*t*control[0]+t*t*to[0],y:a*a*from[1]+2*a*t*control[1]+t*t*to[1],progress:t};
}

/** Fixed strong-beat event envelopes, with no Date.now or mutable playback state. */
export function eventEnvelope(frame:number,hit:number,anticipation=10,release=24):number {
 if(frame<hit)return anticipation>0?settle((frame-hit+anticipation)/anticipation):0;
 return release>0?1-settle((frame-hit)/release):0;
}
