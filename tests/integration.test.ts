import test from 'node:test';
import assert from 'node:assert/strict';
import {createArena,RapierMotor} from '../shared/physics.ts';
import {initialState,copyState} from '../shared/movement.ts';
import {Button,canonical} from '../shared/input.ts';
import {encodeSnapshot,decodeSnapshot} from '../shared/snapshot.ts';
import {getMap} from '../shared/maps.ts';
test('actual motor activates jump pads and portals without repeated teleporting',async()=>{
  const world=await createArena(),m=new RapierMotor(world,initialState(-20,1.05,12),new Set());try{let launched=false;for(let seq=1;seq<=64;seq++){m.tick(canonical({seq,yaw:0,pitch:0,buttons:0,weapon:0,phase:0}));world.step();if(m.state.v.y>10)launched=true;}assert.ok(launched);assert.ok(m.state.p.y>2);m.restore(initialState(-40,1.05,0));world.step();m.tick(canonical({seq:65,yaw:0,pitch:0,buttons:0,weapon:0,phase:0}));world.step();assert.equal(m.state.p.x,40);m.tick(canonical({seq:66,yaw:0,pitch:0,buttons:0,weapon:0,phase:0}));assert.ok(m.state.p.x>39);}finally{m.dispose();world.free();}
});
test('Expedition bridges, terraces, freight and scaffold ramps are physically reachable',async()=>{
  const paths=[{p:[34,1.05,34],yaw:-Math.PI/2,axis:'x',goal:54,height:3.7},{p:[-34,1.05,-34],yaw:Math.PI/2,axis:'x',goal:-54,height:3.7},{p:[54,1.05,4],yaw:Math.PI,axis:'z',goal:26,height:3.7},{p:[62,1.05,43],yaw:Math.PI/2,axis:'x',goal:40,height:5.1},{p:[-43,1.05,-62],yaw:Math.PI,axis:'z',goal:-51,height:1.3}];
  for(const path of paths){const world=await createArena(),motor=new RapierMotor(world,initialState(path.p[0],path.p[1],path.p[2]),new Set());try{let reached=false;for(let seq=1;seq<=1400;seq++){motor.tick(canonical({seq,yaw:path.yaw,pitch:0,buttons:Button.Forward,weapon:0,phase:0}));world.step();const p=motor.state.p;if(Math.abs((path.axis==='x'?p.x:p.z)-path.goal)<1&&p.y>path.height){reached=true;break;}}assert.ok(reached,JSON.stringify({path,p:motor.state.p}));}finally{motor.dispose();world.free();}}
});
test('Harbor spawns and its raised central deck have real shared collisions',async()=>{
  const world=await createArena('harbor');try{for(const spawn of getMap('harbor').spawns){const m=new RapierMotor(world,initialState(...spawn),new Set(),'harbor');for(let seq=1;seq<=128;seq++){m.tick(canonical({seq,yaw:0,pitch:0,buttons:0,weapon:0,phase:0}));world.step();}assert.ok(m.state.grounded);m.dispose();}const m=new RapierMotor(world,initialState(33,1.05,0),new Set(),'harbor');for(let seq=1;seq<=400;seq++){m.tick(canonical({seq,yaw:Math.PI/2,pitch:0,buttons:Button.Forward,weapon:0,phase:0}));world.step();if(m.state.p.x<9&&m.state.p.y>4.7)break;}assert.ok(m.state.p.y>4.7);m.dispose();}finally{world.free();}
});
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

test('roof and garden ramps can be walked in both directions without jumping',async()=>{
  for(const sign of [-1,1])for(const garden of [false,true]){
    const world=await createArena(),motor=new RapierMotor(world,initialState((garden?30:33)*sign,1.05,garden?36*sign:0),new Set());
    let reached=false;
    try{
      for(let seq=1;seq<=1000;seq++){
        motor.tick(canonical({seq,yaw:sign*Math.PI/2,pitch:0,buttons:Button.Forward,weapon:0,phase:0}));world.step();
        const p=motor.state.p;if(Math.abs(p.x)<(garden?7.5:9.5)&&p.y>(garden?3.2:7.8)){reached=true;break;}
      }
      assert.ok(reached,`walkable ramp ${garden?'garden':'roof'} ${sign}: ${JSON.stringify(motor.state.p)}`);
    }finally{motor.dispose();world.free();}
  }
});

test('map raycasts match Rapier convex geometry including sloped and beveled faces',async()=>{
  const {default:RAPIER}=await import('@dimforge/rapier3d-compat');
  const {BOXES}=await import('../shared/map.ts'),{solidQuery,traceSolids}=await import('../shared/arena-geometry.ts');
  const queries=BOXES.map(solidQuery),world=await createArena();
  try{
    for(let i=0;i<80;i++){
      const origin={x:(i*23%120)-60,y:10+i%15,z:(i*37%120)-60};
      const raw={x:Math.sin(i*1.4),y:-0.6,z:Math.cos(i*1.1)},length=Math.hypot(raw.x,raw.y,raw.z),d={x:raw.x/length,y:raw.y/length,z:raw.z/length};
      const hit=world.castRay(new RAPIER.Ray(origin,d),200,true),expected=traceSolids(origin,d,queries,200);
      assert.ok(Math.abs((hit?.timeOfImpact??200)-expected)<0.003,`ray ${i} disagrees: ${hit?.timeOfImpact} vs ${expected}`);
    }
  }finally{world.free();}
});
