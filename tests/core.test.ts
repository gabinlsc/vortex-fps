import test from 'node:test';
import assert from 'node:assert/strict';
import {Button,DT,INPUT_BYTES,encodeInput,decodeInput,encodeBatch,decodeBatch,newer,canonical,type Input} from '../shared/input.ts';
import {initialState,accelerate,integrateVelocity,clipVelocity,MOVE} from '../shared/movement.ts';
import {History,rewindTime,rayCapsule,rayBox,castHistorical,bodyHitbox,direction} from '../server/lag-compensation.ts';
import {projectileStep,recoil} from '../shared/gunplay.ts';
import {signTicket,verifyTicket} from '../server/tickets.ts';
import {chooseRegion,elo,ratingCompatible} from '../api/matchmaker.ts';
import {Predictor,Interpolator} from '../client/netcode.ts';
const input:Input={seq:1,yaw:0,pitch:0,buttons:Button.Forward,weapon:0,phase:0};
const close=(a:number,b:number,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
test('input ABI is 12 bytes, exact flags and wrap boundary',()=>{
  const x={...input,seq:0xffffffff,buttons:127,weapon:1,phase:65535};
  const encoded=encodeInput(x);assert.equal(encoded.byteLength,INPUT_BYTES);assert.deepEqual(decodeInput(new Uint8Array(encoded)),x);
  assert.ok(newer(0,0xffffffff));assert.ok(!newer(0xffffffff,0));assert.ok(!newer(12,12));
});
test('angle quantization stays within half a unit over 10000 seeded samples',()=>{
  let seed=42;for(let k=0;k<10000;k++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const yaw=seed/0xffffffff*Math.PI*12-Math.PI*6;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const pitch=seed/0xffffffff*Math.PI-Math.PI/2;
    const x=canonical({...input,yaw,pitch}),diff=Math.atan2(Math.sin(x.yaw-yaw),Math.cos(x.yaw-yaw));
    assert.ok(Math.abs(diff)<=Math.PI/65536+1e-10);assert.ok(Math.abs(x.pitch-pitch)<=Math.PI/4/32767+1e-10);
  }
});
test('codec honors nonzero Uint8Array byteOffset',()=>{
  const b=new Uint8Array(64);b.set(new Uint8Array(encodeInput(input)),17);assert.deepEqual(decodeInput(b.subarray(17,29)),input);
});
test('batches reject truncation, padding, reserved bits and invalid weapons',()=>{
  const b=new Uint8Array(encodeBatch([input,{...input,seq:2}]));assert.equal(decodeBatch(b).length,2);
  assert.throws(()=>decodeBatch(b.subarray(0,b.length-1)));const padded=new Uint8Array(b.length+1);padded.set(b);assert.throws(()=>decodeBatch(padded));
  const reserved=b.slice();reserved[3]=1;assert.throws(()=>decodeBatch(reserved));const bad=b.slice();bad[13]=9;assert.throws(()=>decodeBatch(bad));
  assert.throws(()=>encodeInput({...input,yaw:NaN}));assert.throws(()=>encodeInput({...input,buttons:128}));
});
test('air acceleration caps projection and can increase total speed',()=>{
  const v={x:10,y:0,z:0};accelerate(v,0,-1,8,1.2,12);
  close(-v.z,0.75);assert.ok(Math.hypot(v.x,v.z)>10);
  for(let i=0;i<10;i++)accelerate(v,0,-1,8,1.2,12);close(-v.z,1.2);close(v.x,10);
});
test('forward/back and left/right cancel; diagonal is normalized',()=>{
  const a=initialState(),b=initialState();integrateVelocity(a,{...input,buttons:Button.Forward|Button.Right});integrateVelocity(b,input);
  close(Math.hypot(a.v.x,a.v.z),Math.hypot(b.v.x,b.v.z));
  const c=initialState();integrateVelocity(c,{...input,buttons:15});close(c.v.x,0);close(c.v.z,0);
});
test('perfect fresh jump skips ground friction, holding jump adds no timing bonus',()=>{
  const s=initialState();s.grounded=true;s.v.x=10;integrateVelocity(s,{...input,buttons:Button.Jump});close(s.v.x,10.25);assert.ok(s.v.y>0);
  const held=initialState();held.grounded=true;held.v.x=10;held.lastButtons=Button.Jump;integrateVelocity(held,{...input,buttons:Button.Jump});close(held.v.x,10);
});
test('slide is bounded in ticks and friction differs from ground running',()=>{
  const sliding=initialState(),walking=initialState();for(const s of [sliding,walking]){s.grounded=true;s.v.x=12;}
  integrateVelocity(sliding,{...input,buttons:Button.Slide});integrateVelocity(walking,{...input,buttons:0});
  assert.equal(sliding.slideTicks,63);assert.ok(sliding.v.x>walking.v.x);
});
test('wall clipping removes only inward velocity',()=>{
  const v={x:-2,y:3,z:4};clipVelocity(v,{x:1,y:0,z:0});assert.deepEqual(v,{x:0,y:3,z:4});clipVelocity(v,{x:0,y:1,z:0});assert.equal(v.y,3);
});
test('rewind budget includes one-way delay, approved interpolation and queued input',()=>{
  close(rewindTime(10,{rttMs:20,interpolationMs:50,queueMs:8}),9.932);
  close(rewindTime(10,{rttMs:500,interpolationMs:50,queueMs:80}),9.9);
  assert.throws(()=>rewindTime(10,{rttMs:-1,interpolationMs:50,queueMs:0}));
});
test('history interpolation is immutable and rejects unavailable time',()=>{
  const history=new History(4),pos={x:0,y:1,z:0};history.push({time:1,boxes:[bodyHitbox(1,0,pos,false)]});pos.x=100;
  history.push({time:2,boxes:[bodyHitbox(1,0,{x:2,y:1,z:0},false)]});
  close(history.sample(1.5)![0].center.x,1);assert.equal(history.sample(0.5),null);assert.equal(history.sample(3),null);
  assert.throws(()=>history.push({time:2,boxes:[]}));
});
test('ring wrap and spawn epochs prevent phantom hits through respawns',()=>{
  const history=new History(3);for(let i=0;i<5;i++)history.push({time:i,boxes:[bodyHitbox(1,i<4?0:1,{x:i,y:1,z:0},false)]});
  assert.equal(history.sample(1),null);assert.equal(history.sample(3.5)!.length,0);assert.equal(history.sample(4)![0].epoch,1);
});
test('capsule side, cap, axial, tangent, inside and miss intersections',()=>{
  const box=bodyHitbox(2,0,{x:0,y:0,z:0},false);
  close(rayCapsule({x:0,y:0,z:3},{x:0,y:0,z:-1},box)!,2.65);
  close(rayCapsule({x:0,y:3,z:0},{x:0,y:-1,z:0},box)!,2.1);
  close(rayCapsule({x:0.35,y:0,z:3},{x:0,y:0,z:-1},box)!,3);
  close(rayCapsule({x:0,y:0,z:0},{x:1,y:0,z:0},box)!,0);
  assert.equal(rayCapsule({x:1,y:0,z:3},{x:0,y:0,z:-1},box),null);
});
test('static cover occludes historical target and nearest hit wins',()=>{
  const origin={x:0,y:1,z:5},d={x:0,y:0,z:-1};
  const wall=rayBox(origin,d,[0,1,2],[1,1,0.5])!;close(wall,2.5);
  const targets=[bodyHitbox(2,0,{x:0,y:1,z:0},false),bodyHitbox(3,0,{x:0,y:1,z:3},false)];
  assert.equal(castHistorical(origin,d,1,[targets[0]],wall),null);assert.equal(castHistorical(origin,d,1,targets,wall)!.id,3);
});
test('aim direction is unit length and respects camera convention',()=>{
  close(direction(0,0).z,-1);close(direction(Math.PI/2,0).x,-1);
  for(let k=0;k<100;k++){const d=direction(k,k*0.01);close(Math.hypot(d.x,d.y,d.z),1);}
});
test('projectiles provide swept segments and deterministic recoil repeats',()=>{
  const p={owner:1,ownerEpoch:0,p:{x:0,y:0,z:0},v:{x:40,y:0,z:0},life:10,damage:35};
  const step=projectileStep(p,DT);close(step.distance,40*DT);assert.equal(p.life,9);assert.deepEqual(recoil(0),recoil(8));
});
test('tickets verify scope, signature and mutation',()=>{
  const secret='a'.repeat(64),ticket=signTicket('user1','match1',secret);assert.equal(verifyTicket(ticket,'match1',secret).sub,'user1');
  assert.throws(()=>verifyTicket(ticket,'other',secret));assert.throws(()=>verifyTicket(ticket.slice(0,-2)+'xx','match1',secret));
});
test('minimax matchmaking rejects unreachable 30ms region and Elo is zero-sum',()=>{
  const a={id:'a',rating:1500,waitSeconds:0,rtt:{eu:15,us:95}},b={id:'b',rating:1520,waitSeconds:0,rtt:{eu:25,us:10}};
  assert.equal(chooseRegion([a,b],['eu','us']),'eu');assert.equal(chooseRegion([a,{...b,rtt:{eu:80,us:10}}],['eu','us']),null);
  assert.ok(ratingCompatible(a,b));const ratings=elo(1500,1500,1);assert.deepEqual(ratings,[1512,1488]);
});
test('reconciliation restores state then replays only unacknowledged commands',()=>{
  const motor={state:initialState(),restore(s:ReturnType<typeof initialState>){this.state=structuredClone(s);},tick(i:Input){this.state.p.x+=i.seq;}};
  const p=new Predictor(motor,()=>{});p.predict(input);p.predict({...input,seq:2});p.predict({...input,seq:3});
  const auth=initialState();auth.p.x=10;
  p.reconcile({id:1,ack:2,state:auth,yaw:0,pitch:0,health:100,epoch:0,hits:0});close(motor.state.p.x,13);assert.deepEqual(p.pending.map(i=>i.seq),[3]);
});
test('interpolation brackets time and does not sweep through an epoch change',()=>{
  const interpolate=new Interpolator(),s0=initialState(),s1=initialState();s1.p.x=10;
  const player=(state:typeof s0,epoch=0)=>({id:2,ack:0,state,yaw:0,pitch:0,health:100,epoch,hits:0});
  interpolate.add({tick:1,time:1,self:1,players:[player(s0)],rttMs:0});interpolate.add({tick:2,time:2,self:1,players:[player(s1)],rttMs:0});
  close(interpolate.sample(2,1.5)!.state.p.x,5);
  interpolate.add({tick:3,time:3,self:1,players:[player(s0,1)],rttMs:0});close(interpolate.sample(2,2.5)!.state.p.x,10);
});
