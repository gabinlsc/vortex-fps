import {SPAWNS,type VecTuple} from './map.ts';
export type GameMode='ffa'|'tdm';
export type Team=0|1|2;
export function validateMode(value:unknown):GameMode {
  if(value!=='ffa'&&value!=='tdm')throw new Error('Invalid game mode');
  return value;
}
export function nickname(value:unknown):string {
  if(typeof value!=='string')throw new Error('Nickname required');
  const name=value.trim().normalize('NFKC');
  if(!/^[\p{L}\p{N}_ .-]{2,18}$/u.test(name))throw new Error('Nickname must contain 2–18 letters, digits or spaces');
  return name;
}
export function assignTeam(mode:GameMode,teams:readonly Team[]):Team {
  if(mode==='ffa')return 0;
  return teams.filter(t=>t===1).length<=teams.filter(t=>t===2).length?1:2;
}
export function canDamage(a:{mode:GameMode;team:Team},b:{mode:GameMode;team:Team}):boolean {
  return a.mode===b.mode&&(a.mode==='ffa'||a.team!==b.team);
}
export function chooseSpawn(team:Team,enemies:readonly {x:number;y:number;z:number}[],seed=0,spawns:readonly VecTuple[]=SPAWNS):VecTuple {
  const pool=spawns.filter(p=>team===0||(team===1?p[2]<0:p[2]>0));
  let best=pool[seed%pool.length],score=-Infinity;
  for(let i=0;i<pool.length;i++){
    const p=pool[(i+seed)%pool.length];
    const distance=enemies.length?Math.min(...enemies.map(e=>(p[0]-e.x)**2+(p[2]-e.z)**2)):0;
    if(distance>score){score=distance;best=p;}
  }
  return best;
}
