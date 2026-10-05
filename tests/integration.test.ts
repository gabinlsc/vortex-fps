import test from 'node:test';
import assert from 'node:assert/strict';
import {createArena,RapierMotor} from '../shared/physics.ts';
import {initialState,copyState} from '../shared/movement.ts';
import {Button,canonical} from '../shared/input.ts';
import {encodeSnapshot,decodeSnapshot} from '../shared/snapshot.ts';
test('same WASM simulation and restored replay produce matching positions',async()=>{
  const worlds=await Promise.all([createArena(),createArena()]);
  const motors=worlds.map(w=>new RapierMotor(w,initialState(0,1,10),new Set()));
  let saved=copyState(motors[0].state);
  for(let seq=1;seq<=256;seq++){
    const input=canonical({seq,yaw:seq/1000,pitch:0,buttons:Button.Forward|Button.Jump,weapon:0,phase:0});
    for(let k=0;k<2;k++){motors[k].tick(input);worlds[k].step();}
    assert.deepEqual(motors[0].state,motors[1].state);if(seq===128)saved=copyState(motors[0].state);
  }
  motors[1].restore(saved);worlds[1].step();
  for(let seq=129;seq<=256;seq++){motors[1].tick(canonical({seq,yaw:seq/1000,pitch:0,buttons:Button.Forward|Button.Jump,weapon:0,phase:0}));worlds[1].step();}
  assert.deepEqual(motors[0].state,motors[1].state);
  for(let k=0;k<2;k++){motors[k].dispose();worlds[k].free();}
});
test('FlatBuffers snapshot carries all movement state and ACK',()=>{
  const state=initialState(1,2,3);state.crouched=true;state.slideTicks=12;state.lastButtons=32;
  const source={tick:65536,time:512,self:2,rttMs:20,players:[{id:2,ack:0xffffffff,state,yaw:1,pitch:0,health:75,epoch:4,hits:2}]};
  assert.deepEqual(decodeSnapshot(encodeSnapshot(source)),source);
});
