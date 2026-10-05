import type {Vec3} from './movement.ts';
export const WEAPONS = Object.freeze([
  {name:'Rail',cooldownTicks:96,damage:100,ammo:20,range:200},
  {name:'Pulse',cooldownTicks:32,damage:35,ammo:80,range:200}
]);
// Server owns shotIndex; neither recoil index nor damage is accepted from the client.
const PATTERN=Object.freeze([[0,0],[1,4],[-2,7],[3,8],[-3,9],[2,10],[0,11],[-1,12]] as const);
export function recoil(index:number):{yaw:number;pitch:number} {
  const p=PATTERN[index%PATTERN.length],unit=Math.PI/180*0.12;return {yaw:p[0]*unit,pitch:p[1]*unit};
}
export interface Projectile {owner:number;ownerEpoch:number;p:Vec3;v:Vec3;life:number;damage:number}
// The caller sweeps from p0 to p1 each tick against map and current hitboxes. Never use only end-point overlap.
export function projectileStep(p:Projectile,dt:number,gravity=0):{from:Vec3;to:Vec3;distance:number;direction:Vec3} {
  const from={...p.p};p.v.y-=gravity*dt;
  const delta={x:p.v.x*dt,y:p.v.y*dt,z:p.v.z*dt},distance=Math.hypot(delta.x,delta.y,delta.z);
  p.p={x:from.x+delta.x,y:from.y+delta.y,z:from.z+delta.z};p.life--;
  return {from,to:p.p,distance,direction:distance?{x:delta.x/distance,y:delta.y/distance,z:delta.z/distance}:{x:0,y:0,z:-1}};
}
