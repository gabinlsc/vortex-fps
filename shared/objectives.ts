import type {Vec3} from './movement.ts';
import type {Team,GameMode} from './match.ts';
export interface ObjectivePlayer {id:number;team:Team;health:number;p:Vec3;magazines:number[]}
export interface Flag {team:1|2;p:Vec3;carrier:number;returnAt:number}
export interface Zone {name:string;p:Vec3;owner:Team;progress:number;capturing:Team}
export interface Pickup {id:number;kind:'health'|'rail'|'pulse';p:Vec3;readyAt:number}
export interface Objectives {zones:Zone[];flags:Flag[];pickups:Pickup[];score1:number;score2:number}
export const bases:Record<1|2,Vec3>={1:{x:0,y:1,z:-52},2:{x:0,y:1,z:52}};
const near=(a:Vec3,b:Vec3,r:number)=>Math.hypot(a.x-b.x,a.z-b.z)<r&&Math.abs(a.y-b.y)<3;
export function newObjectives():Objectives {return {score1:0,score2:0,zones:[{name:'A',p:{x:-18,y:1,z:-18},owner:0,progress:0,capturing:0},{name:'B',p:{x:0,y:1,z:0},owner:0,progress:0,capturing:0},{name:'C',p:{x:18,y:1,z:18},owner:0,progress:0,capturing:0}],flags:([1,2] as const).map(team=>({team,p:{...bases[team]},carrier:0,returnAt:0})),pickups:[[-20,0,'health'],[20,0,'health'],[0,-24,'rail'],[0,24,'pulse']].map(([x,z,kind],id)=>({id,kind:kind as Pickup['kind'],p:{x:Number(x),y:1,z:Number(z)},readyAt:0}))};}
export function updateObjectives(state:Objectives,players:ObjectivePlayer[],mode:GameMode,tick:number,hz=128):void {
  const alive=players.filter(p=>p.health>0);
  if(mode==='domination')for(const zone of state.zones){
    const teams=new Set(alive.filter(p=>near(p.p,zone.p,4)).map(p=>p.team));teams.delete(0);
    if(teams.size===1){const team=[...teams][0];if(zone.owner!==team){if(zone.capturing!==team){zone.capturing=team;zone.progress=0;}zone.progress++;if(zone.progress>=3*hz){zone.owner=team;zone.progress=0;}}}else if(teams.size===0){zone.progress=Math.max(0,zone.progress-1);}
    if(tick%hz===0){if(zone.owner===1)state.score1++;if(zone.owner===2)state.score2++;}
  }
  if(mode==='ctf')for(const flag of state.flags){
    const carrier=players.find(p=>p.id===flag.carrier);
    if(flag.carrier){if(!carrier||carrier.health<=0){flag.carrier=0;flag.returnAt=tick+15*hz;}else{flag.p={...carrier.p};const own=state.flags.find(f=>f.team===carrier.team)!;if(near(carrier.p,bases[carrier.team as 1|2],3)&&!own.carrier&&!own.returnAt){if(carrier.team===1)state.score1++;else state.score2++;flag.carrier=0;flag.returnAt=0;flag.p={...bases[flag.team]};}}}
    if(!flag.carrier){if(flag.returnAt&&tick>=flag.returnAt){flag.returnAt=0;flag.p={...bases[flag.team]};}
      for(const p of alive){if(!near(p.p,flag.p,1.6))continue;if(p.team!==flag.team){flag.carrier=p.id;flag.returnAt=0;break;}if(flag.returnAt){flag.returnAt=0;flag.p={...bases[flag.team]};}}
    }
  }
  for(const item of state.pickups){if(tick<item.readyAt)continue;const p=alive.find(p=>near(p.p,item.p,1.4)&&(item.kind==='health'?p.health<100:p.magazines[item.kind==='rail'?0:1]<(item.kind==='rail'?6:24)));if(!p)continue;
    if(item.kind==='health')p.health=Math.min(100,p.health+35);else p.magazines[item.kind==='rail'?0:1]=item.kind==='rail'?6:24;item.readyAt=tick+20*hz;
  }
}
export function validatePing(value:unknown,p:Vec3):Vec3 {
  if(!value||typeof value!=='object')throw new Error('Invalid ping');const q=value as Vec3;
  if(![q.x,q.y,q.z].every(n=>typeof n==='number'&&Number.isFinite(n))||Math.abs(q.x)>63||Math.abs(q.z)>63||q.y<0||q.y>30||Math.hypot(q.x-p.x,q.z-p.z)>80)throw new Error('Ping bounds');return {x:q.x,y:q.y,z:q.z};
}
