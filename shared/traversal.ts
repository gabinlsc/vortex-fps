import type {MotionState} from './movement.ts';
import type {MapId} from './maps.ts';
export function devices(mapId:MapId){return {pads:[{x:-20,y:0,z:12},{x:20,y:0,z:-12}],portals:[{x:-40,y:0,z:0},{x:40,y:0,z:0}]};}
export function applyTraversal(s:MotionState,mapId:MapId):void {
  const d=devices(mapId);
  for(const pad of d.pads)if(s.grounded&&Math.hypot(s.p.x-pad.x,s.p.z-pad.z)<1.2&&s.p.y<1.5){s.v.y=15;s.grounded=false;}
  for(const [i,portal]of d.portals.entries())if(Math.hypot(s.p.x-portal.x,s.p.z-portal.z)<0.85&&s.p.y<2.4){const exit=d.portals[1-i];s.p={x:exit.x,y:1.05,z:exit.z+(i===0?3:-3)};s.v={x:0,y:0,z:i===0?5:-5};s.grounded=false;}
}
