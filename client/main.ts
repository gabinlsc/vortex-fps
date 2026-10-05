import * as THREE from 'three';
import './style.css';
import {createArena,RapierMotor} from '../shared/physics.ts';
import {initialState} from '../shared/movement.ts';
import {DT,Button,canonical,encodeBatch,type Input} from '../shared/input.ts';
import {decodeSnapshot,type Snapshot,type PlayerSnapshot} from '../shared/snapshot.ts';
import {MAP_VERSION,BOXES,SPAWNS} from '../shared/map.ts';
import {nickname,type GameMode} from '../shared/match.ts';
import {Predictor,Interpolator,RenderClock,INTERPOLATION_MS} from './netcode.ts';
import {CHARACTERS} from '../shared/characters.ts';
import {WEAPONS} from '../shared/gunplay.ts';
import {buildArena,createAvatar,animateAvatar,attachName,disposeName,ViewWeapon,Showroom} from './visuals.ts';
const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)! as T;
const canvas=element<HTMLCanvasElement>('scene'),menu=element('menu'),status=element('status');
let ws:WebSocket|undefined,self=0,seq=0,yaw=0,pitch=0,weapon=0,character=0,mode:GameMode='ffa',buttons=0,latest:Snapshot|undefined;
let edgeButtons=0;
let connected=false,accumulator=0,lastFrame=performance.now(),frames=0,fps=0,fpsTime=lastFrame;
let renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,showroom:Showroom,viewWeapon:ViewWeapon;
let world:Awaited<ReturnType<typeof createArena>>,motor:RapierMotor,predictor:Predictor,interpolator=new Interpolator(),clock=new RenderClock();
const keys=new Set<string>(),enemies=new Map<number,THREE.Group>();
const weaponOptions=element('weapon-options'),characterOptions=element('character-options'),join=element<HTMLButtonElement>('join');
const nameInput=element<HTMLInputElement>('nickname'),modeOptions=element('mode-options');
try{
  const saved=JSON.parse(localStorage.getItem('vortex-loadout')??'{}');
  if(Number.isInteger(saved.character)&&saved.character>=0&&saved.character<CHARACTERS.length)character=saved.character;
  if(saved.weapon===0||saved.weapon===1)weapon=saved.weapon;
  if(saved.mode==='ffa'||saved.mode==='tdm')mode=saved.mode;
  if(typeof saved.name==='string')nameInput.value=nickname(saved.name);
}catch{}
const silhouettes=[
  '<svg viewBox="0 0 180 50" aria-hidden="true"><path fill="currentColor" d="M12 14h75v5h78v4H87v5h78v4H77l-9 13H49l4-13H12z"/></svg>',
  '<svg viewBox="0 0 180 50" aria-hidden="true"><path fill="currentColor" d="M24 10h70l16 8h35v21h-35l-16 5H59l-3-13H24z"/><circle cx="94" cy="27" r="9" fill="#07121d"/></svg>'
];
weaponOptions.innerHTML=WEAPONS.map((w,i)=>'<button type="button" class="option" data-weapon="'+i+'" aria-pressed="false">'+silhouettes[i]+'<strong>'+w.name.toUpperCase()+'</strong><small>'+(i?'Projectile · 24 coups / chargeur':'Hitscan · 6 coups / chargeur')+'</small></button>').join('');
characterOptions.innerHTML=CHARACTERS.map((c,i)=>'<button type="button" class="option" data-character="'+i+'" aria-pressed="false"><span class="pilot-chip" style="--pilot:#'+c.accent.toString(16).padStart(6,'0')+'"></span><strong>'+c.name+'</strong></button>').join('');
function refreshLoadout():void{
  const locked=Boolean(ws);
  weaponOptions.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.weapon)===weapon)));
  characterOptions.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.setAttribute('aria-pressed',String(Number(b.dataset.character)===character));b.disabled=locked;});
  modeOptions.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.mode===mode));b.disabled=locked;});
  nameInput.disabled=locked;
  element('character-description').textContent=locked?'Pilote verrouillé pour la partie.':CHARACTERS[character].description;
  element('pilot-name').textContent=CHARACTERS[character].name.toUpperCase();
  element('weapon-hud').innerHTML=WEAPONS.map((w,i)=>'<span class="hud-weapon '+(weapon===i?'selected':'')+'">'+(i+1)+' / '+w.name.toUpperCase()+'<small id="mag-'+i+'">'+w.ammo+' / ∞</small></span>').join('');
  join.textContent=self?'REPRENDRE LA PARTIE ↗':'LANCER LA PARTIE ↗';
  element<HTMLButtonElement>('leave').hidden=!self;
  try{localStorage.setItem('vortex-loadout',JSON.stringify({weapon,character,mode,name:nameInput.value}));}catch{}
}
weaponOptions.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('[data-weapon]');if(b){weapon=Number(b.dataset.weapon);refreshLoadout();}});
characterOptions.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('[data-character]');if(b&&!ws){character=Number(b.dataset.character);refreshLoadout();}});
modeOptions.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('[data-mode]');if(b&&!ws){mode=b.dataset.mode as GameMode;refreshLoadout();}});
refreshLoadout();join.disabled=true;
function requestControl():void {
  try{const request=canvas.requestPointerLock();if(request)void request.catch(()=>{status.textContent='Clique sur Reprendre pour capturer la souris.';});}catch{status.textContent='La capture de la souris nécessite un clic.';}
}
function resetSession():void {
  self=0;connected=false;latest=undefined;seq=0;buttons=0;edgeButtons=0;keys.clear();accumulator=0;
  for(const mesh of enemies.values()){disposeName(mesh);scene?.remove(mesh);}enemies.clear();
  document.body.classList.remove('connected','playing');element('scoreboard').hidden=true;
  if(document.pointerLockElement===canvas)document.exitPointerLock();
  menu.hidden=false;join.disabled=false;refreshLoadout();
}
element('leave').addEventListener('click',()=>{const old=ws;ws=undefined;old?.close(1000,'Left match');resetSession();status.textContent='Prêt pour une nouvelle partie.';});
document.addEventListener('pointerlockchange',()=>{const active=document.pointerLockElement===canvas;menu.hidden=active;keys.clear();buttons=0;edgeButtons=0;});
function updateButtons():void {
  buttons=Number(keys.has('KeyW')||keys.has('KeyZ'))*Button.Forward|Number(keys.has('KeyS'))*Button.Back|
    Number(keys.has('KeyA')||keys.has('KeyQ'))*Button.Left|Number(keys.has('KeyD'))*Button.Right|
    Number(keys.has('Space'))*Button.Jump|Number(keys.has('ShiftLeft')||keys.has('ShiftRight'))*Button.Slide|
    Number(keys.has('KeyR'))*Button.Reload|(buttons&Button.Fire);
}
addEventListener('keydown',e=>{
  if(e.code==='Tab'&&self&&!(document.activeElement instanceof HTMLInputElement)){e.preventDefault();element('scoreboard').hidden=false;return;}
  if(document.pointerLockElement!==canvas||!self)return;e.preventDefault();keys.add(e.code);
  if(!e.repeat&&e.code==='KeyR')edgeButtons|=Button.Reload;if(!e.repeat&&e.code==='Space')edgeButtons|=Button.Jump;
  if(e.code==='Digit1')weapon=0;if(e.code==='Digit2')weapon=1;
  if(e.code==='Digit1'||e.code==='Digit2')refreshLoadout();updateButtons();
});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Tab')element('scoreboard').hidden=true;updateButtons();});
element('close-scores').onclick=()=>{element('scoreboard').hidden=true;};
addEventListener('blur',()=>{keys.clear();buttons=0;element('scoreboard').hidden=true;});
addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas||!self)return;yaw-=e.movementX*0.002;pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,pitch-e.movementY*0.002));});
canvas.addEventListener('wheel',e=>{if(document.pointerLockElement!==canvas||!self)return;e.preventDefault();weapon=1-weapon;refreshLoadout();},{passive:false});
canvas.addEventListener('mousedown',e=>{if(e.button===0&&document.pointerLockElement===canvas&&self){buttons|=Button.Fire;edgeButtons|=Button.Fire;}});
addEventListener('mouseup',e=>{if(e.button===0)buttons&=~Button.Fire;});
function feed(text:string):void {
  const row=document.createElement('div');row.className='feed-row';row.textContent=text;const list=element('killfeed');list.prepend(row);
  while(list.children.length>5)list.lastElementChild?.remove();setTimeout(()=>row.remove(),6000);
}
function scoreboard(s:Snapshot):void{
  const body=element('score-rows');body.replaceChildren();
  for(const p of s.players.slice().sort((a,b)=>(b.kills??0)-(a.kills??0)||(b.assists??0)-(a.assists??0))){
    const row=document.createElement('tr');if(p.id===self)row.className='self';
    const team=p.team===1?'AZURE':p.team===2?'EMBER':'SOLO';
    for(const value of [p.name??'Pilote',team,p.kills??0,p.assists??0,p.deaths??0]){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}
    row.children[1].className='team-'+(p.team??0);body.append(row);
  }
}
function hud(s:Snapshot,me:PlayerSnapshot):void{
  element('health').textContent=String(me.health);element('health-bar').style.width=me.health+'%';
  element('personal-stats').textContent=(me.kills??0)+' K · '+(me.assists??0)+' A · '+(me.deaths??0)+' D';
  element('ammo').textContent=String(me.magazines?.[weapon]??WEAPONS[weapon].ammo);
  element('weapon-name').textContent=WEAPONS[weapon].name.toUpperCase();
  for(let i=0;i<2;i++)element('mag-'+i).textContent=(me.magazines?.[i]??WEAPONS[i].ammo)+' / ∞';
  const loading=(me.reloadLeft??0)>0,slot=me.reloadWeapon??weapon;
  element('reload-status').textContent=loading?'RECHARGEMENT · '+((me.reloadLeft??0)*DT).toFixed(1)+' s':'R POUR RECHARGER';
  element<HTMLProgressElement>('reload-progress').value=loading?1-(me.reloadLeft??0)/WEAPONS[Math.max(0,slot)].reloadTicks:0;
  element('mode-label').textContent=s.mode?'TEAM DEATHMATCH':'FREE FOR ALL';
  element('players-count').textContent=s.players.length+' JOUEUR'+(s.players.length>1?'S':'');
  const remaining=s.remaining??600;element('match-clock').textContent=Math.floor(remaining/60).toString().padStart(2,'0')+':'+(remaining%60).toString().padStart(2,'0');
  element('team-score').textContent=s.mode?(s.score1??0)+' / '+(s.score2??0):'';
  element('death-screen').hidden=me.health>0;element('respawn-count').textContent=String(Math.ceil((me.respawnLeft??0)*DT));
  element('protection').hidden=(me.protectedLeft??0)<=0;
  scoreboard(s);minimap(s,me);
}
function minimap(s:Snapshot,me:PlayerSnapshot):void{
  const map=element<HTMLCanvasElement>('minimap'),ctx=map.getContext('2d')!,scale=170/128;
  ctx.fillStyle='#09151ded';ctx.fillRect(0,0,170,170);
  for(const b of BOXES){if(b.kind==='ground')continue;ctx.fillStyle=b.kind==='stone'?'#3b4b54':'#556b70';ctx.fillRect((b.p[0]-b.h[0]+64)*scale,(b.p[2]-b.h[2]+64)*scale,b.h[0]*2*scale,b.h[2]*2*scale);}
  for(const p of s.players){if(p.health<=0||p.id!==self&&(!s.mode||p.team!==me.team))continue;ctx.fillStyle=p.id===self?'#c4ff9d':'#74eaff';ctx.beginPath();ctx.arc((p.state.p.x+64)*scale,(p.state.p.z+64)*scale,p.id===self?3:2,0,Math.PI*2);ctx.fill();}
}
element<HTMLFormElement>('lobby').onsubmit=e=>{
  e.preventDefault();if(!motor)return;
  if(self&&ws?.readyState===WebSocket.OPEN){requestControl();return;}
  if(ws)return;
  let name:string;try{name=nickname(nameInput.value);}catch(err){status.textContent=String(err);return;}
  const url=import.meta.env.VITE_GAME_URL??'ws://127.0.0.1:8080/play';
  if(location.protocol==='https:'&&!url.startsWith('wss://')){status.textContent='Configure VITE_GAME_URL en wss:// pour ce site HTTPS.';return;}
  predictor=new Predictor(motor,()=>world.step());interpolator=new Interpolator();clock=new RenderClock();seq=0;accumulator=0;
  const socket=new WebSocket(url);ws=socket;socket.binaryType='arraybuffer';join.disabled=true;refreshLoadout();status.textContent='Connexion au serveur…';requestControl();
  socket.onopen=()=>{socket.send(JSON.stringify({version:2,map:MAP_VERSION,name,mode,character,ticket:element<HTMLInputElement>('ticket').value}));};
  socket.onmessage=e=>{
    if(ws!==socket)return;
    try{
      if(typeof e.data==='string'){
        const message=JSON.parse(e.data);if(message.type==='kill')feed(String(message.killer)+' → '+String(message.victim));
        if(message.type==='round')feed('FIN DE MANCHE · '+String(message.winner));return;
      }
      if(!(e.data instanceof ArrayBuffer))throw new Error('Invalid server frame');
      const s=decodeSnapshot(new Uint8Array(e.data)),me=s.players.find(p=>p.id===s.self);if(!me)throw new Error('Missing local authority');
      latest=s;self=s.self;clock.observe(s.time,performance.now()/1000,s.rttMs);interpolator.add(s);predictor.reconcile(me);
      if(!connected){connected=true;seq=me.ack;character=me.character??0;yaw=Math.atan2(me.state.p.x,me.state.p.z);pitch=0;refreshLoadout();join.disabled=false;status.textContent='Partie prête. Clique sur Reprendre si la souris est libre.';}
      document.body.classList.add('connected');hud(s,me);
      const ids=new Set(s.players.filter(p=>p.id!==self).map(p=>p.id));
      for(const [id,mesh]of enemies)if(!ids.has(id)){disposeName(mesh);scene.remove(mesh);enemies.delete(id);}
      for(const p of s.players)if(p.id!==self&&!enemies.has(p.id)){const mesh=createAvatar(p.character??0);attachName(mesh,p.name??'Pilote',p.team??0);scene.add(mesh);enemies.set(p.id,mesh);}
    }catch(err){status.textContent=String(err);socket.close(1002,'Protocol mismatch');}
  };
  socket.onclose=e=>{if(ws!==socket)return;ws=undefined;resetSession();status.textContent=e.code===1000?'Partie quittée.':e.code===1008?'Connexion refusée : pseudo, ticket ou version incompatibles.':'Connexion interrompue ('+e.code+'). Tu peux relancer la partie.';};
  socket.onerror=()=>{status.textContent='Serveur inaccessible. Démarre npm run server:dev puis relance la partie.';};
};
addEventListener('resize',()=>{if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();viewWeapon.resize(camera.aspect);});
function frame(now:number):void{
  requestAnimationFrame(frame);const elapsed=Math.min((now-lastFrame)/1000,0.05);lastFrame=now;
  accumulator+=elapsed;
  if(ws?.readyState===WebSocket.OPEN&&self){
    const me=latest?.players.find(p=>p.id===self);
    while(accumulator>=DT){
      const input=canonical({seq:seq=(seq+1)>>>0,yaw,pitch,buttons:me&&me.health>0?(buttons|edgeButtons):0,weapon,phase:0});
      try{predictor.predict(input);}catch{ws.close(1000,'Prediction backlog');return;}
      edgeButtons=0;send.push(input);accumulator-=DT;
      if(send.length>=2){if(ws.bufferedAmount>16384){ws.close(1000,'Input backlog');return;}ws.send(encodeBatch(send));send=[];}
    }
    predictor.renderDecay(elapsed);const p=predictor.renderPosition(accumulator/DT);
    camera.position.set(p.x,p.y+(motor.state.crouched?0.35:0.65),p.z);camera.rotation.set(pitch,yaw,0,'YXZ');
    const time=clock.serverNow(now/1000)-INTERPOLATION_MS/1000;
    for(const [id,mesh]of enemies){const p=interpolator.sample(id,time);if(p){mesh.position.set(p.state.p.x,p.state.p.y,p.state.p.z);mesh.scale.y=p.state.crouched?0.61:1;mesh.rotation.y=p.yaw;mesh.visible=p.health>0;animateAvatar(mesh,now/1000,Math.hypot(p.state.v.x,p.state.v.z));}}
  }else{
    accumulator=0;send=[];const angle=now*0.000022;camera.position.set(Math.sin(angle)*48,25,Math.cos(angle)*48);camera.lookAt(0,2,0);
  }
  const active=Boolean(self)&&document.pointerLockElement===canvas,me=latest?.players.find(p=>p.id===self);
  document.body.classList.toggle('playing',active);
  viewWeapon.update(elapsed,now/1000,Math.hypot(motor.state.v.x,motor.state.v.z),Boolean(buttons&Button.Fire)&&Boolean(me&&me.health>0&&(me.magazines?.[weapon]??0)>0&&!me.reloadLeft),weapon,active);
  if(document.hidden)return;
  renderer.render(scene,camera);if(active&&me&&me.health>0)viewWeapon.render(renderer);else if(!self)showroom.render(renderer,now/1000,character,weapon);
  frames++;if(now-fpsTime>=500){fps=Math.round(frames*1000/(now-fpsTime));frames=0;fpsTime=now;element('performance').textContent=fps+' FPS · '+(latest?.rttMs??0).toFixed(0)+' ms';}
}
let send:Input[]=[];
async function boot():Promise<void>{
  renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(new URLSearchParams(location.search).get('quality')==='low'?0.6:Math.min(devicePixelRatio,1.25));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  scene=new THREE.Scene();buildArena(scene);camera=new THREE.PerspectiveCamera(90,innerWidth/innerHeight,0.05,220);camera.rotation.order='YXZ';
  showroom=new Showroom();viewWeapon=new ViewWeapon();viewWeapon.resize(camera.aspect);
  world=await createArena();const start=SPAWNS[0];motor=new RapierMotor(world,initialState(start[0],start[1],start[2]),new Set());world.step();
  predictor=new Predictor(motor,()=>world.step());join.disabled=false;status.textContent='Prêt. Choisis ton pseudo, ton mode et ton équipement.';lastFrame=performance.now();requestAnimationFrame(frame);
}
void boot().catch(err=>{status.textContent='Le moteur ne peut pas démarrer : '+String(err);join.disabled=true;});
