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
  const source={tick:65536,time:512,self:2,rttMs:20,mode:1,score1:8,score2:5,remaining:123,players:[{id:2,ack:0xffffffff,state,yaw:1,pitch:0,health:75,epoch:4,hits:2,character:2,name:'Ã‰milie',team:2,kills:3,assists:2,deaths:1,weapon:1,magazines:[4,17],reloadWeapon:1,reloadLeft:42,respawnLeft:0,protectedLeft:12,shotIndex:9}]};
  assert.deepEqual(decodeSnapshot(encodeSnapshot(source)),source);
});

test('every spawn lands on solid ground and remains inside the map',async()=>{
  const {SPAWNS}=await import('../shared/map.ts');
  const world=await createArena();
  try{
    for(const spawn of SPAWNS){
      const motor=new RapierMotor(world,initialState(spawn[0],spawn[1],spawn[2]),new Set());
      try{
        world.step();
        for(let seq=1;seq<=256;seq++){motor.tick(canonical({seq,yaw:0,pitch:0,buttons:0,weapon:0,phase:0}));world.step();}
        assert.ok(motor.state.grounded,'spawn must land on ground');
        assert.ok(motor.state.p.y>0.85&&motor.state.p.y<1.2,'spawn must stay above the floor');
      }finally{motor.dispose();}
    }
  }finally{world.free();}
});
test('new arena creation cannot corrupt an existing WASM world',async()=>{
  const first=await createArena(),baseline=await createArena();
  const a=new RapierMotor(first,initialState(0,1,20),new Set()),b=new RapierMotor(baseline,initialState(0,1,20),new Set());
  const another=await createArena();
  try{
    for(let seq=1;seq<=64;seq++){
      const input=canonical({seq,yaw:0,pitch:0,buttons:Button.Jump,weapon:0,phase:0});
      a.tick(input);first.step();b.tick(input);baseline.step();assert.deepEqual(a.state,b.state);
    }
  }finally{a.dispose();b.dispose();first.free();baseline.free();another.free();}
});

test('both mirrored jump routes reach the reactor roof with the actual character motor',async()=>{
  for(const sign of [-1,1]){
    const world=await createArena(),motor=new RapierMotor(world,initialState(27*sign,1.05,0),new Set());
    let reached=false;
    try{
      for(let seq=1;seq<=2600;seq++){
        motor.tick(canonical({seq,yaw:sign*Math.PI/2,pitch:0,buttons:Button.Forward|Button.Jump,weapon:0,phase:0}));world.step();
        const p=motor.state.p;if(Math.abs(p.x)<10.3&&p.y>7.8){reached=true;break;}
      }
      assert.ok(reached,`roof jump route ${sign} is unreachable: ${JSON.stringify(motor.state.p)}`);
    }finally{motor.dispose();world.free();}
  }
});
