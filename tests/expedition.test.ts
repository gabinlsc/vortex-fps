import test from 'node:test';
import assert from 'node:assert/strict';
import {newObjectives,updateObjectives,validatePing,bases,type ObjectivePlayer} from '../shared/objectives.ts';
import {validateMap,getMap} from '../shared/maps.ts';
import {applyTraversal} from '../shared/traversal.ts';
import {initialState} from '../shared/movement.ts';
import {navigation} from '../shared/navigation.ts';
import {Recorder,parseReplay,AdaptiveResolution} from '../client/replay.ts';
const pilot=(id=1,team:1|2=1):ObjectivePlayer=>({id,team,health:100,p:{x:-18,y:1,z:-18},magazines:[1,1]});
test('domination captures after three seconds, blocks contested progress and scores once per second',()=>{
  const s=newObjectives(),a=pilot(),b=pilot(2,2);
  for(let t=1;t<=64;t++)updateObjectives(s,[a,b],'domination',t,32);assert.equal(s.zones[0].owner,0);assert.equal(s.zones[0].progress,0);
  for(let t=65;t<=160;t++)updateObjectives(s,[a],'domination',t,32);assert.equal(s.zones[0].owner,1);assert.equal(s.score1,1);
  for(let t=161;t<=192;t++)updateObjectives(s,[a],'domination',t,32);assert.equal(s.score1,2);
});
test('CTF requires home flag, drops on death and returns after its timeout',()=>{
  const s=newObjectives(),a=pilot();a.p={...bases[2]};updateObjectives(s,[a],'ctf',1,32);assert.equal(s.flags[1].carrier,1);
  a.p={...bases[1]};updateObjectives(s,[a],'ctf',2,32);assert.equal(s.score1,1);assert.equal(s.flags[1].carrier,0);
  a.p={...bases[2]};updateObjectives(s,[a],'ctf',3,32);a.health=0;updateObjectives(s,[a],'ctf',4,32);assert.equal(s.flags[1].returnAt,484);
  updateObjectives(s,[],'ctf',484,32);assert.equal(s.flags[1].returnAt,0);assert.deepEqual(s.flags[1].p,bases[2]);
});
test('pickups heal only living players, replenish magazines and respect cooldown',()=>{
  const s=newObjectives(),a=pilot();a.health=30;a.p={...s.pickups[0].p};updateObjectives(s,[a],'ffa',1,32);assert.equal(a.health,65);assert.equal(s.pickups[0].readyAt,641);
  updateObjectives(s,[a],'ffa',2,32);assert.equal(a.health,65);a.p={...s.pickups[2].p};updateObjectives(s,[a],'ffa',3,32);assert.equal(a.magazines[0],6);
});
test('map and ping admission reject hostile values',()=>{
  assert.equal(validateMap(undefined),'canyon');assert.equal(validateMap('harbor'),'harbor');assert.throws(()=>validateMap('else'));
  assert.throws(()=>validatePing({x:Infinity,y:0,z:0},{x:0,y:1,z:0}));assert.throws(()=>validatePing({x:63,y:0,z:63},{x:-60,y:1,z:-60}));assert.deepEqual(validatePing({x:4,y:1,z:3},{x:0,y:1,z:0}),{x:4,y:1,z:3});
});
test('devices launch grounded players and teleports exit outside the return trigger',()=>{
  const s=initialState(-20,1,12);s.grounded=true;applyTraversal(s,'canyon');assert.equal(s.v.y,15);assert.equal(s.grounded,false);
  s.p={x:-40,y:1,z:0};applyTraversal(s,'canyon');assert.deepEqual(s.p,{x:40,y:1.05,z:3});const p={...s.p};applyTraversal(s,'canyon');assert.deepEqual(s.p,p);
});
test('bounded navigation finds ground routes on both maps',()=>{
  for(const id of ['canyon','harbor'] as const){const p=getMap(id).spawns;const path=navigation(id)({x:p[0][0],y:1,z:p[0][2]},{x:p[1][0],y:1,z:p[1][2]});assert.ok(path.length>5);assert.ok(path.length<1600);}
});
test('replays isolate snapshots and reject invalid versions, chronology and poses',()=>{
  const r=new Recorder(),s={tick:1,time:1,self:1,rttMs:0,players:[{id:1,ack:0,state:initialState(),yaw:0,pitch:0,health:100,epoch:0,hits:0}]};r.record(s);s.players[0].health=0;const out=r.export('canyon');assert.equal(out.frames[0].players[0].health,100);assert.equal(parseReplay(JSON.stringify(out)).frames.length,1);
  assert.throws(()=>parseReplay(JSON.stringify({...out,version:5})));out.frames[0].players[0].state.p.x=999;assert.throws(()=>parseReplay(JSON.stringify(out)));
});
test('adaptive resolution degrades gradually and stays within its bounds',()=>{
  const a=new AdaptiveResolution();for(let i=0;i<2000;i++)a.step(35,i*35);assert.equal(a.scale,0.5);for(let i=2000;i<5000;i++)a.step(10,i*35);assert.equal(a.scale,1);
});
