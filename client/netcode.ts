import {DT,newer,type Input} from '../shared/input.ts';
import {copyState,type MotionState} from '../shared/movement.ts';
import type {PlayerSnapshot,Snapshot} from '../shared/snapshot.ts';
export interface Motor {state:MotionState;restore(s:MotionState):void;tick(i:Input):void}
export class Predictor {
  pending:Input[]=[];error={x:0,y:0,z:0};private epoch=-1;previous:{x:number;y:number;z:number};
  constructor(readonly motor:Motor,readonly afterTick:()=>void){this.previous={...motor.state.p};}
  predict(input:Input):void {
    if(this.pending.length>=256)throw new Error('Prediction window exhausted; resync required');
    this.pending.push(input);this.previous={...this.motor.state.p};this.motor.tick(input);this.afterTick();
  }
  reconcile(authority:PlayerSnapshot):void {
    const old={...this.motor.state.p},respawn=this.epoch!==authority.epoch;this.epoch=authority.epoch;
    this.pending=this.pending.filter(i=>newer(i.seq,authority.ack));
    this.motor.restore(authority.state);this.previous={...this.motor.state.p};this.afterTick();
    // Replay only kinematics, never sound, damage, muzzle flash or economy writes.
    for(const input of this.pending){this.previous={...this.motor.state.p};this.motor.tick(input);this.afterTick();}
    const p=this.motor.state.p,delta={x:old.x-p.x,y:old.y-p.y,z:old.z-p.z};
    if(respawn || Math.hypot(delta.x,delta.y,delta.z)>1.5)this.error={x:0,y:0,z:0};
    else{this.error.x+=delta.x;this.error.y+=delta.y;this.error.z+=delta.z;}
  }
  renderDecay(renderDt:number):void {
    const scale=Math.exp(-renderDt/0.045);this.error.x*=scale;this.error.y*=scale;this.error.z*=scale;
  }
  renderPosition(alpha:number):{x:number;y:number;z:number}{
    const p=this.motor.state.p,a=Math.max(0,Math.min(1,alpha));
    return {x:this.previous.x+(p.x-this.previous.x)*a+this.error.x,
      y:this.previous.y+(p.y-this.previous.y)*a+this.error.y,z:this.previous.z+(p.z-this.previous.z)*a+this.error.z};
  }
}
export const INTERPOLATION_MS=50;
export class Interpolator {
  private snapshots:Snapshot[]=[];
  add(s:Snapshot):void {
    if(this.snapshots.length && s.time<=this.snapshots.at(-1)!.time)return;
    this.snapshots.push(s);if(this.snapshots.length>32)this.snapshots.shift();
  }
  sample(id:number,renderTime:number):PlayerSnapshot|null {
    const a=[...this.snapshots].reverse().find(s=>s.time<=renderTime),b=this.snapshots.find(s=>s.time>=renderTime);
    const fallback=(a??b)?.players.find(p=>p.id===id);if(!fallback)return null;
    const x=a?.players.find(p=>p.id===id),y=b?.players.find(p=>p.id===id);
    if(!x||!y||a===b||x.epoch!==y.epoch)return {...fallback,state:copyState(fallback.state)};
    const alpha=Math.max(0,Math.min(1,(renderTime-a!.time)/(b!.time-a!.time)));
    const state=copyState(x.state);
    for(const k of ['x','y','z'] as const)state.p[k]=x.state.p[k]+(y.state.p[k]-x.state.p[k])*alpha;
    // Shortest arc avoids a full turn when yaw crosses 2pi.
    const dy=Math.atan2(Math.sin(y.yaw-x.yaw),Math.cos(y.yaw-x.yaw));
    return {...x,state,yaw:x.yaw+alpha*dy,pitch:x.pitch+alpha*(y.pitch-x.pitch)};
  }
}
// Snapshot time anchors server simulation to the local monotonic clock. Arrival jitter is smoothed.
// Production: use the authenticated four-timestamp exchange described in ARCHITECTURE.md.
export class RenderClock {
  private offset:number|null=null;
  observe(serverTime:number,localTime:number,rtt:number):void {
    const candidate=serverTime+rtt/2000-localTime;
    this.offset=this.offset===null?candidate:this.offset+Math.max(-0.005,Math.min(0.005,candidate-this.offset))*0.1;
  }
  serverNow(localTime:number):number{return localTime+(this.offset??0);}
}
