import { Button, DT, type Input } from './input.ts';
export interface Vec3 { x:number; y:number; z:number }
export interface MotionState {
  p:Vec3; v:Vec3; grounded:boolean; crouched:boolean; slideTicks:number; lastButtons:number;
}
export const MOVE = Object.freeze({ walk:8, groundAccel:14, airAccel:12, airWishCap:1.2,
  gravity:24, jump:8.5, friction:6, stopSpeed:2.5, slideFriction:0.7, maxSpeed:40,
  radius:0.35, standHalf:0.55, crouchHalf:0.2, skin:0.015 });
export function initialState(x=0,y=1,z=0):MotionState {
  return {p:{x,y,z},v:{x:0,y:0,z:0},grounded:false,crouched:false,slideTicks:0,lastButtons:0};
}
export function copyState(s:MotionState):MotionState { return {...s,p:{...s.p},v:{...s.v}}; }
// Projection cap, never clamp total horizontal velocity to wishSpeed.
export function accelerate(v:Vec3,wx:number,wz:number,wishSpeed:number,projectionCap:number,accel:number,dt=DT):void {
  const add=projectionCap-(v.x*wx+v.z*wz);
  if (add<=0) return;
  const delta=Math.min(add,accel*wishSpeed*dt);
  v.x+=delta*wx; v.z+=delta*wz;
}
export function friction(v:Vec3,k:number,dt=DT):void {
  const speed=Math.hypot(v.x,v.z); if(speed<1e-8) {v.x=0;v.z=0;return;}
  const scale=Math.max(0,speed-Math.max(speed,MOVE.stopSpeed)*k*dt)/speed;
  v.x*=scale;v.z*=scale;
}
// Called exactly once per fixed simulation tick. Stance collision fitting belongs to RapierMotor.
export function integrateVelocity(s:MotionState,input:Input):void {
  const b=input.buttons, pressed=b & ~s.lastButtons;
  const forward=Number(Boolean(b&Button.Forward))-Number(Boolean(b&Button.Back));
  const side=Number(Boolean(b&Button.Right))-Number(Boolean(b&Button.Left));
  const len=Math.hypot(forward,side), sy=Math.sin(input.yaw),cy=Math.cos(input.yaw);
  const wx=len ? (cy*side-sy*forward)/len : 0;
  const wz=len ? (-sy*side-cy*forward)/len : 0;
  if(s.grounded && (pressed&Button.Slide) && Math.hypot(s.v.x,s.v.z)>6) s.slideTicks=64;
  if(!(b&Button.Slide)) s.slideTicks=0;
  const jump=s.grounded && Boolean(b&Button.Jump);
  if(jump) {
    s.v.y=MOVE.jump; s.grounded=false; s.slideTicks=0;
    // Vortex tuning: a fresh press on this grounded simulation tick grants +0.25 m/s.
    // Auto-bhop (holding Jump) retains momentum but does not grant this timing bonus.
    const speed=Math.hypot(s.v.x,s.v.z);
    if((pressed&Button.Jump) && speed>0.001) {s.v.x*=1+0.25/speed;s.v.z*=1+0.25/speed;}
  }
  if(s.grounded) friction(s.v,s.slideTicks?MOVE.slideFriction:MOVE.friction);
  if(len) {
    const wish=MOVE.walk*(s.crouched && !s.slideTicks?0.5:1);
    if(s.grounded) accelerate(s.v,wx,wz,wish,wish,s.slideTicks?3:MOVE.groundAccel);
    else accelerate(s.v,wx,wz,wish,Math.min(wish,MOVE.airWishCap),MOVE.airAccel);
  }
  // Hard game safety cap; not Quake's wish-speed projection cap.
  const speed=Math.hypot(s.v.x,s.v.z);
  if(speed>MOVE.maxSpeed) {s.v.x*=MOVE.maxSpeed/speed;s.v.z*=MOVE.maxSpeed/speed;}
  s.v.y-=MOVE.gravity*DT;
  if(s.slideTicks) s.slideTicks--;
  s.lastButtons=b;
}
export function clipVelocity(v:Vec3,n:Vec3):void {
  const inward=v.x*n.x+v.y*n.y+v.z*n.z;
  if(inward<0) {v.x-=inward*n.x;v.y-=inward*n.y;v.z-=inward*n.z;}
}
