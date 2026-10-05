import * as THREE from 'three';
import './style.css';
import {createArena,RapierMotor} from '../shared/physics.ts';
import {initialState} from '../shared/movement.ts';
import {DT,Button,canonical,encodeBatch,type Input} from '../shared/input.ts';
import {decodeSnapshot,type Snapshot} from '../shared/snapshot.ts';
import {MAP_VERSION} from '../shared/map.ts';
import {Predictor,Interpolator,RenderClock,INTERPOLATION_MS} from './netcode.ts';
import {CHARACTERS} from '../shared/characters.ts';
import {WEAPONS} from '../shared/gunplay.ts';
import {buildArena,createAvatar,animateAvatar,ViewWeapon,Showroom} from './visuals.ts';
const canvas=document.querySelector<HTMLCanvasElement>('#scene')!,menu=document.querySelector<HTMLElement>('#menu')!;
const status=document.querySelector<HTMLElement>('#status')!,stats=document.querySelector<HTMLElement>('#stats')!;
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();buildArena(scene);
const camera=new THREE.PerspectiveCamera(90,innerWidth/innerHeight,0.05,150);camera.rotation.order='YXZ';
const showroom=new Showroom();
const viewWeapon=new ViewWeapon();viewWeapon.resize(innerWidth/innerHeight);
const world=await createArena(),motor=new RapierMotor(world,initialState(),new Set());
const predictor=new Predictor(motor,()=>world.step()),interpolator=new Interpolator(),clock=new RenderClock();
let ws:WebSocket|undefined,self=0,seq=0,yaw=0,pitch=0,weapon=0,buttons=0,latest:Snapshot|undefined;
let accumulator=0,lastFrame=performance.now(),rtt=0,send:Input[]=[],frameCount=0,fps=0,fpsTime=lastFrame;
const enemies=new Map<number,THREE.Group>();
const keys=new Set<string>();
let character=0;
try{const saved=JSON.parse(localStorage.getItem('vortex-loadout')??'{}');if(Number.isInteger(saved.character)&&saved.character>=0&&saved.character<CHARACTERS.length)character=saved.character;if(saved.weapon===0||saved.weapon===1)weapon=saved.weapon;}catch{/* Storage can be disabled. */}
const weaponOptions=document.querySelector<HTMLElement>('#weapon-options')!,characterOptions=document.querySelector<HTMLElement>('#character-options')!;
const silhouettes=[
  '<svg viewBox="0 0 180 50" aria-hidden="true"><path fill="currentColor" d="M12 14h75v5h78v4H87v5h78v4H77l-9 13H49l4-13H12z"/><path fill="#07121d" d="M30 20h36v5H30z"/></svg>',
  '<svg viewBox="0 0 180 50" aria-hidden="true"><path fill="currentColor" d="M24 10h70l16 8h35v21h-35l-16 5H59l-3-13H24z"/><circle cx="94" cy="27" r="9" fill="#07121d"/></svg>'
];
weaponOptions.innerHTML=WEAPONS.map((w,i)=>'<button type="button" class="option" data-weapon="'+i+'" aria-pressed="false">'+silhouettes[i]+'<strong>'+w.name.toUpperCase()+'</strong><small>'+(i?'Projectile · 35 dégâts · 4 tirs/s':'Hitscan · 100 dégâts · 1,33 tir/s')+'</small></button>').join('');
characterOptions.innerHTML=CHARACTERS.map((c,i)=>'<button type="button" class="option" data-character="'+i+'" aria-pressed="false"><span class="pilot-chip" style="--pilot:#'+c.accent.toString(16).padStart(6,'0')+'"></span><strong>'+c.name+'</strong><small>'+c.role+'</small></button>').join('');
function refreshLoadout():void {
  weaponOptions.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.weapon)===weapon)));
  characterOptions.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.setAttribute('aria-pressed',String(Number(b.dataset.character)===character));b.disabled=Boolean(self)||ws?.readyState===WebSocket.CONNECTING||ws?.readyState===WebSocket.OPEN;});
  document.querySelector('#character-description')!.textContent=Boolean(self)?'Pilote verrouillé pour cette session.':CHARACTERS[character].description;
  document.querySelector('#pilot-name')!.textContent=CHARACTERS[character].name.toUpperCase();
  document.querySelector('#weapon-hud')!.innerHTML=WEAPONS.map((w,i)=>'<span class="hud-weapon '+(weapon===i?'selected':'')+'">'+(i+1)+' / '+w.name.toUpperCase()+'<small>'+w.damage+' DMG</small></span>').join('');
  try{localStorage.setItem('vortex-loadout',JSON.stringify({weapon,character}));}catch{}
}
weaponOptions.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('[data-weapon]');if(b){weapon=Number(b.dataset.weapon);refreshLoadout();}});
characterOptions.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('[data-character]');if(b&&!self){character=Number(b.dataset.character);refreshLoadout();}});
refreshLoadout();
canvas.addEventListener('wheel',e=>{if(document.pointerLockElement!==canvas)return;e.preventDefault();weapon=1-weapon;refreshLoadout();},{passive:false});
function updateButtons(){
  buttons=Number(keys.has('KeyW')||keys.has('KeyZ'))*Button.Forward|Number(keys.has('KeyS'))*Button.Back|
    Number(keys.has('KeyA')||keys.has('KeyQ'))*Button.Left|Number(keys.has('KeyD'))*Button.Right|
    Number(keys.has('Space'))*Button.Jump|Number(keys.has('ShiftLeft')||keys.has('ShiftRight'))*Button.Slide|
    (buttons&Button.Fire);
}
addEventListener('keydown',e=>{if(document.pointerLockElement!==canvas)return;e.preventDefault();keys.add(e.code);
  if(e.code==='Digit1')weapon=0;if(e.code==='Digit2')weapon=1;if(e.code==='Digit1'||e.code==='Digit2')refreshLoadout();updateButtons();});
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
  ws.onopen=()=>{ws!.send(JSON.stringify({version:1,map:MAP_VERSION,character,ticket:document.querySelector<HTMLInputElement>('#ticket')!.value}));};
  ws.onmessage=e=>{
    try{
      if(!(e.data instanceof ArrayBuffer))throw new Error('Invalid server frame');
      const s=decodeSnapshot(new Uint8Array(e.data));latest=s;self=s.self;rtt=s.rttMs;
      clock.observe(s.time,performance.now()/1000,rtt);interpolator.add(s);
      const local=s.players.find(p=>p.id===self);if(!local)throw new Error('Missing authority');
      predictor.reconcile(local);
      if(seq===0){seq=local.ack;character=local.character??0;refreshLoadout();void canvas.requestPointerLock();status.textContent='Serveur autoritaire · 128 Hz · snapshots 32 Hz';}
      const alive=new Set(s.players.filter(p=>p.id!==self).map(p=>p.id));
      for(const [id,mesh]of enemies)if(!alive.has(id)){scene.remove(mesh);enemies.delete(id);}
      for(const id of alive)if(!enemies.has(id)){const mesh=createAvatar(s.players.find(p=>p.id===id)?.character??0);scene.add(mesh);enemies.set(id,mesh);}
    }catch(err){status.textContent=String(err);ws?.close();}
  };
  ws.onclose=e=>{status.textContent=`Déconnecté (${e.code}) — recharge la page pour une nouvelle session`;self=0;refreshLoadout();menu.style.display='block';};
  ws.onerror=()=>{status.textContent='Serveur inaccessible. Lance npm run server:dev.';};
};
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();viewWeapon.resize(camera.aspect);});
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
    for(const [id,mesh]of enemies){const state=interpolator.sample(id,renderTime);if(state){mesh.position.set(state.state.p.x,state.state.p.y,state.state.p.z);mesh.scale.y=state.state.crouched?0.61:1;mesh.rotation.y=state.yaw;mesh.visible=state.health>0;animateAvatar(mesh,now/1000,Math.hypot(state.state.v.x,state.state.v.z));}}
  }else {
    accumulator=0;const angle=now*0.00006;camera.position.set(Math.sin(angle)*19,12,Math.cos(angle)*19);camera.lookAt(0,0,0);
  }
  const active=Boolean(self)&&document.pointerLockElement===canvas;
  document.body.classList.toggle('playing',active);
  viewWeapon.update(elapsed,now/1000,Math.hypot(motor.state.v.x,motor.state.v.z),Boolean(buttons&Button.Fire),weapon,active);
  renderer.render(scene,camera);if(active)viewWeapon.render(renderer);else showroom.render(renderer,now/1000,character,weapon);frameCount++;
  if(now-fpsTime>=500){fps=Math.round(frameCount*1000/(now-fpsTime));frameCount=0;fpsTime=now;
    const me=latest?.players.find(p=>p.id===self),speed=Math.hypot(motor.state.v.x,motor.state.v.z);
    stats.textContent=`${fps} FPS / ${rtt.toFixed(1)} ms RTT\n${speed.toFixed(2)} m/s / ${predictor.pending.length} inputs\n${me?.health??100} HP / ${me?.hits??0} impacts / ${weapon?'Pulse':'Rail'}`;
  }
}
requestAnimationFrame(frame);
