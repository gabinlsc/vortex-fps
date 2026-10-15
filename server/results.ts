// Résultats de manche pour le classement de games.glsc.fr : une ligne JSON par manche dans RESULTS_FILE.
import {appendFile} from 'node:fs/promises';
import type {GameMode,Team} from '../shared/match.ts';
import type {MapId} from '../shared/maps.ts';

export interface RoundPlayer {name:string;bot:false;rank:number;won:boolean;team:Team;kills:number;deaths:number;assists:number}
export interface RoundRecord {v:1;t:number;game:'vortex';mode:GameMode;map:MapId;score:[number,number];players:RoundPlayer[]}
type Member={name:string;team:Team;kills:number;deaths:number;assists:number};

/** Fin de manche → résultat ; null si personne n'a joué (salle vide ou joueurs restés inactifs). */
export function roundRecord(members:readonly Member[],mode:GameMode,map:MapId,score1:number,score2:number,now=Date.now()):RoundRecord|null {
  const active=members.filter(p=>p.kills+p.deaths+p.assists>0);
  if(!active.length)return null;
  const winningTeam:Team=mode==='ffa'?0:score1>score2?1:score2>score1?2:0;
  const ranked=active.slice().sort((a,b)=>
    (mode==='ffa'?0:Number(b.team===winningTeam)-Number(a.team===winningTeam))||b.kills-a.kills||a.deaths-b.deaths||b.assists-a.assists);
  const players=ranked.map((p,i):RoundPlayer=>({name:p.name,bot:false,rank:i+1,
    won:mode==='ffa'?i===0&&p.kills>0:winningTeam!==0&&p.team===winningTeam,
    team:p.team,kills:p.kills,deaths:p.deaths,assists:p.assists}));
  return {v:1,t:Math.floor(now/1000),game:'vortex',mode,map,score:[score1,score2],players};
}

/** Ajoute chaque résultat au fichier, dans l'ordre ; une erreur d'écriture est journalisée sans gêner la partie. */
export function fileResultSink(file:string,log:(message:string)=>void=console.error):(record:RoundRecord)=>void {
  let queue=Promise.resolve();
  return record=>{
    const line=JSON.stringify(record)+'\n';
    queue=queue.then(()=>appendFile(file,line,{mode:0o640})).catch((e:unknown)=>log(`[vortex] résultat non enregistré : ${e instanceof Error?e.message:String(e)}`));
  };
}
