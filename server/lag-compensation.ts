import { MOVE, type Vec3 } from '../shared/movement.ts';
export interface Hitbox {id:number;epoch:number;center:Vec3;half:number;radius:number;alive:boolean}
export interface HistoryFrame {time:number;boxes:readonly Hitbox[]}
export interface Timing {rttMs:number;interpolationMs:number;queueMs:number}
export const MAX_REWIND_MS=100;
export function rewindTime(now:number,t:Timing):number {
  if(![now,t.rttMs,t.interpolationMs,t.queueMs].every(Number.isFinite) || t.rttMs<0 || t.queueMs<0 || t.interpolationMs<0)
    throw new Error('Invalid timing');
  return now-Math.min(MAX_REWIND_MS,t.rttMs/2+t.interpolationMs+t.queueMs)/1000;
}
export class History {
  private frames:(HistoryFrame|undefined)[];
  private cursor=0;private count=0;
  constructor(readonly capacity=32){if(capacity<2)throw new Error('History size');this.frames=new Array(capacity);}
  push(frame:HistoryFrame):void {
    const previous=this.count?this.frames[(this.cursor-1+this.capacity)%this.capacity]:undefined;
    if(previous && frame.time<=previous.time)throw new Error('Nonmonotonic history');
    // Immutable copies; live physics is never mutated by a hit query.
    this.frames[this.cursor]={time:frame.time,boxes:frame.boxes.map(x=>({...x,center:{...x.center}}))};
    this.cursor=(this.cursor+1)%this.capacity;this.count=Math.min(this.count+1,this.capacity);
  }
  sample(time:number):Hitbox[]|null {
    if(!this.count||!Number.isFinite(time))return null;
    const ordered=Array.from({length:this.count},(_,i)=>this.frames[(this.cursor-this.count+i+this.capacity)%this.capacity]!);
    if(time<ordered[0].time || time>ordered.at(-1)!.time+1e-8)return null;
    const b=ordered.find(f=>f.time>=time)??ordered.at(-1)!;
    const bi=ordered.indexOf(b),a=bi?ordered[bi-1]:b;
    if(time===b.time||a===b)return b.boxes.map(x=>({...x,center:{...x.center}}));
    const alpha=(time-a.time)/(b.time-a.time),out:Hitbox[]=[];
    for(const x of a.boxes){
      const y=b.boxes.find(p=>p.id===x.id);
      // Never interpolate a death/respawn or a teleport represented by an epoch change.
      if(!y || x.epoch!==y.epoch || !x.alive || !y.alive)continue;
      out.push({...x,center:{x:x.center.x+(y.center.x-x.center.x)*alpha,
        y:x.center.y+(y.center.y-x.center.y)*alpha,z:x.center.z+(y.center.z-x.center.z)*alpha}});
    }return out;
  }
}
export function direction(yaw:number,pitch:number):Vec3 {
  const c=Math.cos(pitch);return {x:-Math.sin(yaw)*c,y:Math.sin(pitch),z:-Math.cos(yaw)*c};
}
function raySphere(o:Vec3,d:Vec3,c:Vec3,r:number):number|null {
  const x=o.x-c.x,y=o.y-c.y,z=o.z-c.z;
  const b=x*d.x+y*d.y+z*d.z,q=x*x+y*y+z*z-r*r;
  if(q<=0)return 0;
  const discriminant=b*b-q;if(discriminant<0)return null;
  const t=-b-Math.sqrt(discriminant);return t>=0?t:null;
}
// Upright capsule = vertical finite cylinder UNION both end spheres; d must be unit length.
export function rayCapsule(o:Vec3,d:Vec3,h:Hitbox):number|null {
  const x=o.x-h.center.x,z=o.z-h.center.z,lo=h.center.y-h.half,hi=h.center.y+h.half;
  if(x*x+z*z<=h.radius*h.radius && o.y>=lo && o.y<=hi)return 0;
  let best=Infinity;
  for(const y of [lo,hi]){const t=raySphere(o,d,{x:h.center.x,y,z:h.center.z},h.radius);if(t!==null)best=Math.min(best,t);}
  const a=d.x*d.x+d.z*d.z,b=x*d.x+z*d.z,c=x*x+z*z-h.radius*h.radius,disc=b*b-a*c;
  if(a>1e-12&&disc>=0){
    for(const t of [(-b-Math.sqrt(disc))/a,(-b+Math.sqrt(disc))/a]){
      const y=o.y+t*d.y;if(t>=0&&y>=lo&&y<=hi)best=Math.min(best,t);
    }
  }return Number.isFinite(best)?best:null;
}
export function rayBox(o:Vec3,d:Vec3,c:readonly number[],h:readonly number[]):number|null {
  let lo=0,hi=Infinity;const p=[o.x,o.y,o.z],v=[d.x,d.y,d.z];
  for(let k=0;k<3;k++){
    if(Math.abs(v[k])<1e-12){if(p[k]<c[k]-h[k]||p[k]>c[k]+h[k])return null;continue;}
    const a=(c[k]-h[k]-p[k])/v[k],b=(c[k]+h[k]-p[k])/v[k];
    lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return null;
  }return lo;
}
export function castHistorical(o:Vec3,d:Vec3,shooter:number,boxes:readonly Hitbox[],wallDistance:number,range=200):{id:number;epoch:number;distance:number}|null {
  if(![...Object.values(o),...Object.values(d),wallDistance,range].every(Number.isFinite)||Math.abs(Math.hypot(d.x,d.y,d.z)-1)>1e-5)
    throw new Error('Invalid ray');
  let best=Math.min(range,wallDistance),hit:null|{id:number;epoch:number;distance:number}=null;
  for(const box of boxes){if(box.id===shooter||!box.alive)continue;
    const distance=rayCapsule(o,d,box);if(distance!==null&&distance<best){best=distance;hit={id:box.id,epoch:box.epoch,distance};}
  }return hit;
}
export function bodyHitbox(id:number,epoch:number,p:Vec3,crouched:boolean,alive=true):Hitbox {
  return {id,epoch,center:p,half:crouched?MOVE.crouchHalf:MOVE.standHalf,radius:MOVE.radius,alive};
}
