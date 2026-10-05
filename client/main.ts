import * as THREE from 'three';
import './style.css';
import {createArena,RapierMotor,eye} from '../shared/physics.ts';
import {initialState} from '../shared/movement.ts';
import {DT,Button,canonical,encodeBatch,type Input} from '../shared/input.ts';
import {decodeSnapshot,type Snapshot} from '../shared/snapshot.ts';
import {BOXES,MAP_VERSION} from '../shared/map.ts';
import {Predictor,Interpolator,RenderClock,INTERPOLATION_MS} from './netcode.ts';
const canvas=document.querySelector<HTMLCanvasElement>('#scene')!,menu=document.querySelector<HTMLElement>('#menu')!;
const status=document.querySelector<HTMLElement>('#status')!,stats=document.querySelector<HTMLElement>('#stats')!;
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color('#101a2a');scene.fog=new THREE.Fog('#101a2a',25,75);
const camera=new THREE.PerspectiveCamera(90,innerWidth/innerHeight,0.05,100);camera.rotation.order='YXZ';camera.position.set(0,12,20);camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight('#b9e3ff','#203046',2));
const light=new THREE.DirectionalLight('#ffffff',2);light.position.set(8,16,8);scene.add(light);
const boxes=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:'#324968'}),BOXES.length);
const transform=new THREE.Object3D();BOXES.forEach((b,i)=>{transform.position.set(...b.p);transform.scale.set(b.h[0]*2,b.h[1]*2,b.h[2]*2);transform.updateMatrix();boxes.setMatrixAt(i,transform.matrix);});scene.add(boxes);
const grid=new THREE.GridHelper(48,48,'#2f846e','#263549');grid.position.y=0.01;scene.add(grid);
const world=await createArena(),motor=new RapierMotor(world,initialState(),new Set());
const predictor=new Predictor(motor,()=>world.step()),interpolator=new Interpolator(),clock=new RenderClock();
let ws:WebSocket|undefined,self=0,seq=0,yaw=0,pitch=0,weapon=0,buttons=0,latest:Snapshot|undefined;
let accumulator=0,lastFrame=performance.now(),rtt=0,send:Input[]=[],frameCount=0,fps=0,fpsTime=lastFrame;
const enemies=new Map<number,THREE.Mesh>(),enemyGeometry=new THREE.CapsuleGeometry(0.35,1.1,4,8),enemyMaterial=new THREE.MeshLambertMaterial({color:'#71ffe0'});
const keys=new Set<string>();
function updateButtons(){
  buttons=Number(keys.has('KeyW')||keys.has('KeyZ'))*Button.Forward|Number(keys.has('KeyS'))*Button.Back|
    Number(keys.has('KeyA')||keys.has('KeyQ'))*Button.Left|Number(keys.has('KeyD'))*Button.Right|
    Number(keys.has('Space'))*Button.Jump|Number(keys.has('ShiftLeft')||keys.has('ShiftRight'))*Button.Slide|
    (buttons&Button.Fire);
}
addEventListener('keydown',e=>{if(document.pointerLockElement!==canvas)return;e.preventDefault();keys.add(e.code);
  if(e.code==='Digit1')weapon=0;if(e.code==='Digit2')weapon=1;updateButtons();});
addEventListener('keyup',e=>{keys.delete(e.code);updateButtons();});
addEventListener('blur',()=>{keys.clear();buttons=0;});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas){keys.clear();buttons=0;menu.style.display='block';}else menu.style.display='none';});
addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas)return;yaw-=e.movementX*0.002;
  pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,pitch-e.movementY*0.002));});
canvas.addEventListener('mousedown',e=>{if(e.button===0&&document.pointerLockElement===canvas)buttons|=Button.Fire;});
addEventListener('mouseup',e=>{if(e.button===0)buttons&=~Button.Fire;});
document.querySelector<HTMLButtonElement>('#join')!.onclick=()=>{
  if(ws?.readyState===WebSocket.OPEN){void canvas.requestPointerLock();return;}
  // Local default; deployed HTTPS clients must set VITE_GAME_URL=wss://regional-endpoint/play.
  const url=import.meta.env.VITE_GAME_URL??'ws://127.0.0.1:8080/play';
  if(location.protocol==='https:'&&!url.startsWith('wss://')){status.textContent='Configure VITE_GAME_URL en wss://';return;}
  ws=new WebSocket(url);ws.binaryType='arraybuffer';status.textContent='Connexion…';
  ws.onopen=()=>{ws!.send(JSON.stringify({version:1,map:MAP_VERSION,ticket:document.querySelector<HTMLInputElement>('#ticket')!.value}));};
  ws.onmessage=e=>{
    try{
      if(!(e.data instanceof ArrayBuffer))throw new Error('Invalid server frame');
      const s=decodeSnapshot(new Uint8Array(e.data));latest=s;self=s.self;rtt=s.rttMs;
      clock.observe(s.time,performance.now()/1000,rtt);interpolator.add(s);
      const local=s.players.find(p=>p.id===self);if(!local)throw new Error('Missing authority');
      predictor.reconcile(local);
      if(seq===0){seq=local.ack;void canvas.requestPointerLock();status.textContent='Serveur autoritaire · 128 Hz · snapshots 32 Hz';}
      const alive=new Set(s.players.filter(p=>p.id!==self).map(p=>p.id));
      for(const [id,mesh]of enemies)if(!alive.has(id)){scene.remove(mesh);enemies.delete(id);}
      for(const id of alive)if(!enemies.has(id)){const mesh=new THREE.Mesh(enemyGeometry,enemyMaterial);scene.add(mesh);enemies.set(id,mesh);}
    }catch(err){status.textContent=String(err);ws?.close();}
  };
  ws.onclose=e=>{status.textContent=`Déconnecté (${e.code}) — recharge la page pour une nouvelle session`;self=0;menu.style.display='block';};
  ws.onerror=()=>{status.textContent='Serveur inaccessible. Lance npm run server:dev.';};
};
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
function frame(now:number):void {
  requestAnimationFrame(frame);
  const elapsed=(now-lastFrame)/1000;lastFrame=now;
  if(elapsed>0.25 && self){ws?.close(1000,'Simulation paused');self=0;return;}
  accumulator+=Math.min(elapsed,0.05);
  if(ws?.readyState===WebSocket.OPEN&&self){
    while(accumulator>=DT){
      const input=canonical({seq:seq=(seq+1)>>>0,yaw,pitch,buttons,weapon,phase:0});
      try{predictor.predict(input);}catch{ws.close(1000,'Resync required');return;}
      send.push(input);accumulator-=DT;
      if(send.length>=2){if(ws.bufferedAmount>16384){ws.close(1000,'Input backlog');return;}ws.send(encodeBatch(send));send=[];}
    }
    predictor.renderDecay(elapsed);const p=predictor.renderPosition(accumulator/DT),eyeHeight=motor.state.crouched?0.35:0.65;
    // Local position is predicted at fixed ticks; camera rotation updates at render rate.
    camera.position.set(p.x,p.y+eyeHeight,p.z);camera.rotation.set(pitch,yaw,0,'YXZ');
    const renderTime=clock.serverNow(now/1000)-INTERPOLATION_MS/1000;
    for(const [id,mesh]of enemies){const state=interpolator.sample(id,renderTime);if(state){mesh.position.set(state.state.p.x,state.state.p.y,state.state.p.z);mesh.scale.y=state.state.crouched?0.61:1;}}
  }else accumulator=0;
  renderer.render(scene,camera);frameCount++;
  if(now-fpsTime>=500){fps=Math.round(frameCount*1000/(now-fpsTime));frameCount=0;fpsTime=now;
    const me=latest?.players.find(p=>p.id===self),speed=Math.hypot(motor.state.v.x,motor.state.v.z);
    stats.textContent=`${fps} FPS / ${rtt.toFixed(1)} ms RTT\n${speed.toFixed(2)} m/s / ${predictor.pending.length} inputs\n${me?.health??100} HP / ${me?.hits??0} impacts / ${weapon?'Pulse':'Rail'}`;
  }
}
requestAnimationFrame(frame);
