import type {PlayerSnapshot} from '../shared/snapshot.ts';

// A newly observed player/respawn establishes a baseline, never replays old shots.
export class ShotTracker {
  private previous=new Map<number,{epoch:number;index:number}>();
  observe(players:readonly PlayerSnapshot[]):PlayerSnapshot[]{
    const fired:PlayerSnapshot[]=[],present=new Set<number>();
    for(const p of players){
      present.add(p.id);const last=this.previous.get(p.id),index=p.shotIndex??0;
      if(last&&last.epoch===p.epoch&&index>last.index)fired.push(p);
      this.previous.set(p.id,{epoch:p.epoch,index});
    }
    for(const id of this.previous.keys())if(!present.has(id))this.previous.delete(id);
    return fired;
  }
  clear():void{this.previous.clear();}
}
