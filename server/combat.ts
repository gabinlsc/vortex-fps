import {canDamage,type GameMode,type Team} from '../shared/match.ts';
import {TICK_HZ} from '../shared/input.ts';
export interface Combatant {
  id:number;epoch:number;mode:GameMode;team:Team;health:number;protectedUntil:number;
  kills:number;assists:number;deaths:number;hits:number;
  contributors:Map<number,{damage:number;time:number}>;
}
export function applyHit(target:Combatant,owner:Combatant,epoch:number,amount:number,tick:number,players:ReadonlyMap<number,Combatant>):'ignored'|'hit'|'kill' {
  if(owner.id===target.id||target.epoch!==epoch||target.health<=0||tick<target.protectedUntil||!canDamage(owner,target))return 'ignored';
  const dealt=Math.min(target.health,amount);target.health-=dealt;owner.hits++;
  const previous=target.contributors.get(owner.id);
  const accumulated=previous&&tick-previous.time<=10*TICK_HZ?previous.damage:0;
  target.contributors.set(owner.id,{damage:accumulated+dealt,time:tick});
  if(target.health>0)return 'hit';
  owner.kills++;target.deaths++;
  for(const [id,hit]of target.contributors){
    const helper=players.get(id);
    if(helper&&id!==owner.id&&canDamage(helper,target)&&hit.damage>=25&&tick-hit.time<=10*TICK_HZ)helper.assists++;
  }
  target.contributors.clear();return 'kill';
}
