import {BOXES,SPAWNS,ROUTES,type ArenaBox,type VecTuple} from './map.ts';
export type MapId='canyon'|'harbor';
export interface ArenaMap {id:MapId;name:string;boxes:ArenaBox[];spawns:readonly VecTuple[];routes:readonly (readonly [number,number][])[]}
const harbor:ArenaBox[]=[{p:[0,-0.5,0],h:[64,0.5,64],kind:'ground'}];
for(const sign of [-1,1]){
  harbor.push({p:[64*sign,3,0],h:[1,3,64],kind:'stone',zone:'boundary'},{p:[0,3,64*sign],h:[64,3,1],kind:'stone',zone:'boundary'});
  for(const x of [-36,-12,12,36])harbor.push({p:[x,2,24*sign],h:[5,2,9],kind:'metal',zone:'freight'});
  harbor.push({p:[0,2,0],h:[10,2,8],kind:'metal',zone:'harbor'},{p:[20*sign,2,0],h:[10,2,3],kind:'metal',shape:'ramp',yaw:sign>0?0:Math.PI,zone:'harbor-ramp'});
  for(const x of [-46,-24,24,46])harbor.push({p:[x,0.65,45*sign],h:[2,0.65,2],kind:'crate'});
}
export const MAP_IDS:readonly MapId[]=['canyon','harbor'];
export function validateMap(value:unknown):MapId {if(value===undefined||value==='canyon')return 'canyon';if(value==='harbor')return value;throw new Error('Invalid map');}
export function getMap(id:MapId='canyon'):ArenaMap {return id==='harbor'?{id,name:'Tidal Harbor',boxes:harbor,spawns:SPAWNS,routes:[[[0,-60],[0,60]],[[-60,0],[60,0]]]}:{id,name:'Rift Canyon',boxes:BOXES,spawns:SPAWNS,routes:ROUTES};}
