import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {roundRecord,fileResultSink,type RoundRecord} from '../server/results.ts';
const p=(name:string,team:0|1|2,kills:number,deaths:number,assists=0)=>({name,team,kills,deaths,assists});
test('FFA round: ranked by kills then deaths, only the top fragger wins, idle players dropped',()=>{
  const r=roundRecord([p('Lou',0,4,2),p('Max',0,9,5),p('Afk',0,0,0),p('Zoé',0,4,1)],'ffa','canyon',0,0,1_700_000_000_000)!;
  assert.deepEqual(r.players.map(x=>[x.name,x.rank,x.won]),[['Max',1,true],['Zoé',2,false],['Lou',3,false]]);
  assert.equal(r.t,1_700_000_000);assert.equal(r.game,'vortex');assert.equal(r.map,'canyon');
  assert.ok(r.players.every(x=>x.bot===false));
});
test('team round: the winning team wins, a draw gives no winner',()=>{
  const members=[p('A1',1,3,4),p('E1',2,8,1),p('A2',1,5,2),p('E2',2,1,6)];
  const azure=roundRecord(members,'tdm','canyon',12,7)!;
  assert.deepEqual(azure.players.filter(x=>x.won).map(x=>x.name),['A2','A1']);
  assert.deepEqual(azure.players.map(x=>x.rank),[1,2,3,4]);
  assert.deepEqual(azure.score,[12,7]);
  assert.equal(roundRecord(members,'tdm','canyon',5,5)!.players.filter(x=>x.won).length,0);
});
test('empty or idle room: nothing to record',()=>{
  assert.equal(roundRecord([],'ffa','canyon',0,0),null);
  assert.equal(roundRecord([p('Afk',0,0,0)],'ffa','canyon',0,0),null);
  assert.equal(roundRecord([p('Solo',0,0,0,0),p('Seul',0,0,0)],'ffa','canyon',0,0),null);
});
test('FFA round without any kill has no winner',()=>{
  assert.equal(roundRecord([p('A',0,0,2),p('B',0,0,1)],'ffa','canyon',0,0)!.players.filter(x=>x.won).length,0);
});
test('file sink appends one JSON line per round, in order, and survives write errors',async()=>{
  const file=join(await mkdtemp(join(tmpdir(),'vortex-')),'results.jsonl');
  const sink=fileResultSink(file);
  for(const t of [1,2,3])sink({...roundRecord([p('A',0,1,0)],'ffa','canyon',0,0)!,t});
  await new Promise(r=>setTimeout(r,50));
  assert.deepEqual((await readFile(file,'utf8')).trim().split('\n').map(l=>(JSON.parse(l) as RoundRecord).t),[1,2,3]);
  const logs:string[]=[];const broken=fileResultSink('/dossier-absent/results.jsonl',m=>logs.push(m));
  broken(roundRecord([p('A',0,1,0)],'ffa','canyon',0,0)!);
  await new Promise(r=>setTimeout(r,50));
  assert.match(logs[0]??'',/non enregistré/);
});
