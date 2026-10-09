import {Training,type OfflineMode} from './training.ts';
import {Recorder,parseReplay,download,AdaptiveResolution,type Replay} from './replay.ts';
import {AuthoritativeEffects} from './authoritative-effects.ts';
import {Ambience} from './ambience.ts';
import {ObjectiveView} from './objectives.ts';
import {solidQuery,traceSolids} from '../shared/arena-geometry.ts';
import {themeArena,animateBiomes} from './biomes.ts';
import * as THREE from 'three';
import './style.css';
import {createArena,RapierMotor} from '../shared/physics.ts';
import {initialState} from '../shared/movement.ts';
import {DT,Button,canonical,encodeBatch,type Input} from '../shared/input.ts';
import {decodeSnapshot,type Snapshot,type PlayerSnapshot} from '../shared/snapshot.ts';
import {MAP_VERSION,BOXES,SPAWNS,ROUTES,arenaZone} from '../shared/map.ts';
import {getMap,type MapId} from '../shared/maps.ts';
import {nickname,type GameMode} from '../shared/match.ts';
import {Predictor,Interpolator,RenderClock,INTERPOLATION_MS} from './netcode.ts';
import {CHARACTERS} from '../shared/characters.ts';
import {WEAPONS} from '../shared/gunplay.ts';
import {buildArena,animateArena,createAvatar,animateAvatar,attachName,disposeName,ViewWeapon,Showroom} from './visuals.ts';
import {CombatEffects,GameAudio} from './effects.ts';
import {ShotTracker} from './shot-tracker.ts';
import {loadSettings,saveSettings} from './settings.ts';
import {configureArenaQuality} from './landscape.ts';
const settings=loadSettings(),shotTracker=new ShotTracker(),audio=new GameAudio();
let effects:CombatEffects,hitUntil=0,hurtUntil=0;
const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)! as T;
const canvas=element<HTMLCanvasElement>('scene'),menu=element('menu'),status=element('status');
let ws:WebSocket|undefined,self=0,seq=0,yaw=0,pitch=0,weapon=0,character=0,mode:GameMode='ffa',buttons=0,latest:Snapshot|undefined;
const ambience=new Ambience();let serverEffects:AuthoritativeEffects;
let training:Training|undefined,photo=false,spectatorId=0,replay:Replay|undefined,replayStart=0;const recorder=new Recorder(),adaptive=new AdaptiveResolution();
let objectiveView:ObjectiveView;
let selectedMap:MapId='canyon',mapBusy=false;
let ignoreLook=true;
let edgeButtons=0,authority:PlayerSnapshot|undefined,hudTime=0;
let connected=false,accumulator=0,lastFrame=performance.now(),frames=0,fps=0,fpsTime=lastFrame;
let renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,showroom:Showroom,viewWeapon:ViewWeapon;
let world:Awaited<ReturnType<typeof createArena>>,motor:RapierMotor,predictor:Predictor,interpolator=new Interpolator(),clock=new RenderClock();
const keys=new Set<string>(),enemies=new Map<number,THREE.Group>();
const weaponOptions=element('weapon-options'),characterOptions=element('character-options'),join=element<HTMLButtonElement>('join');
const nameInput=element<HTMLInputElement>('nickname'),modeOptions=element('mode-options');
function applySettings():void {
  audio.volume=settings.volume/100;
  document.body.classList.toggle('reduced-motion',settings.reducedMotion);
  if(camera){camera.fov=settings.fov;camera.updateProjectionMatrix();}
  if(effects){effects.enabled=settings.effects;if(!settings.effects)effects.clear();}
  if(renderer){
    const quality=new URLSearchParams(location.search).get('quality')==='low'?'low':settings.quality;
    if(scene){configureArenaQuality(renderer,scene,quality);themeArena(scene,document.getElementById('theme-select')?.getAttribute('data-night')==='true');}
    renderer.setPixelRatio(quality==='low'?0.6:Math.min(devicePixelRatio,quality==='high'?1.75:1.25));renderer.setSize(innerWidth,innerHeight);
  }
  for(const key of ['fov','sensitivity','volume'] as const){
    element<HTMLInputElement>('setting-'+key).value=String(settings[key]);
    element('value-'+key).textContent=key==='fov'?settings[key]+'°':key==='volume'?settings[key]+'%':settings[key].toFixed(2);
  }
  element<HTMLSelectElement>('setting-quality').value=settings.quality;
  element<HTMLInputElement>('setting-effects').checked=settings.effects;
  element<HTMLInputElement>('setting-motion').checked=settings.reducedMotion;
}
for(const key of ['fov','sensitivity','volume'] as const)element('setting-'+key).addEventListener('input',e=>{settings[key]=Number((e.target as HTMLInputElement).value);saveSettings(settings);applySettings();});
element('setting-quality').addEventListener('change',e=>{settings.quality=(e.target as HTMLSelectElement).value as typeof settings.quality;saveSettings(settings);applySettings();});
element('setting-effects').addEventListener('change',e=>{settings.effects=(e.target as HTMLInputElement).checked;saveSettings(settings);applySettings();});
element('setting-motion').addEventListener('change',e=>{settings.reducedMotion=(e.target as HTMLInputElement).checked;saveSettings(settings);applySettings();});
applySettings();
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
  const locked=Boolean(ws)||Boolean(training)||Boolean(replay);
  weaponOptions.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.weapon)===weapon)));
  characterOptions.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.setAttribute('aria-pressed',String(Number(b.dataset.character)===character));b.disabled=locked;});
  modeOptions.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.mode===mode));b.disabled=locked;});
  nameInput.disabled=locked;if(document.getElementById('map-select'))(document.getElementById('map-select') as HTMLSelectElement).disabled=locked;
  element('character-description').textContent=locked?'Pilote verrouillé pour la partie.':CHARACTERS[character].description;
  element('pilot-name').textContent=CHARACTERS[character].name.toUpperCase();
  element('weapon-hud').innerHTML=WEAPONS.map((w,i)=>'<span class="hud-weapon '+(weapon===i?'selected':'')+'">'+(i+1)+' / '+w.name.toUpperCase()+'<small id="mag-'+i+'">'+w.ammo+' / ∞</small></span>').join('');
  join.textContent=self?'REPRENDRE LA PARTIE ↗':'LANCER LA PARTIE ↗';
  element<HTMLButtonElement>('leave').hidden=!self;element<HTMLButtonElement>('open-scores').hidden=!self;
  try{localStorage.setItem('vortex-loadout',JSON.stringify({weapon,character,mode,name:nameInput.value}));}catch{}
}
weaponOptions.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('[data-weapon]');if(b){weapon=Number(b.dataset.weapon);refreshLoadout();}});
characterOptions.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('[data-character]');if(b&&!ws){character=Number(b.dataset.character);refreshLoadout();}});
modeOptions.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('[data-mode]');if(b&&!ws){mode=b.dataset.mode as GameMode;refreshLoadout();}});
for(const [id,label]of [['domination','DOMINATION'],['ctf','DRAPEAU']]){const b=document.createElement('button');b.type='button';b.className='option';b.dataset.mode=id;b.textContent=label;modeOptions.append(b);}
refreshLoadout();join.disabled=true;
function requestControl():void {
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();canvas.focus({preventScroll:true});
  try{const request=canvas.requestPointerLock();if(request)void request.catch(()=>{status.textContent='Clique sur Reprendre pour capturer la souris.';});}catch{status.textContent='La capture de la souris nécessite un clic.';}
}
function resetSession():void {
  training?.dispose();training=undefined;photo=false;replay=undefined;if(document.getElementById('training-status'))element('training-status').textContent='';document.body.classList.remove('photo-mode');shotTracker.clear();effects?.clear();serverEffects?.clear();hitUntil=hurtUntil=0;send=[];
  self=0;connected=false;latest=undefined;authority=undefined;seq=0;buttons=0;edgeButtons=0;keys.clear();accumulator=0;
  for(const mesh of enemies.values()){disposeName(mesh);scene?.remove(mesh);}enemies.clear();
  document.body.classList.remove('connected','playing');element('scoreboard').hidden=true;
  if(document.pointerLockElement===canvas)document.exitPointerLock();
  menu.hidden=false;join.disabled=false;refreshLoadout();
}
element('leave').addEventListener('click',()=>{const old=ws;ws=undefined;old?.close(1000,'Left match');resetSession();status.textContent='Prêt pour une nouvelle partie.';});
document.addEventListener('pointerlockchange',()=>{const active=document.pointerLockElement===canvas;menu.hidden=active;ignoreLook=true;keys.clear();buttons=0;edgeButtons=0;});
function updateButtons():void {
  buttons=Number(keys.has('KeyW')||keys.has('KeyZ'))*Button.Forward|Number(keys.has('KeyS'))*Button.Back|
    Number(keys.has('KeyA')||keys.has('KeyQ'))*Button.Left|Number(keys.has('KeyD'))*Button.Right|
    Number(keys.has('Space'))*Button.Jump|Number(keys.has('ShiftLeft')||keys.has('ShiftRight'))*Button.Slide|
    Number(keys.has('KeyR'))*Button.Reload|(buttons&Button.Fire);
}
addEventListener('keydown',e=>{
  if(e.code==='Escape'&&replay){resetSession();return;}
  if(e.code==='Tab'&&self&&(document.pointerLockElement===canvas||!(document.activeElement instanceof HTMLInputElement))){e.preventDefault();element('scoreboard').hidden=false;return;}
  if(document.pointerLockElement!==canvas||!self)return;e.preventDefault();keys.add(e.code);
  if(!e.repeat&&e.code==='KeyR')edgeButtons|=Button.Reload;if(!e.repeat&&e.code==='Space')edgeButtons|=Button.Jump;
  if(e.code==='KeyG'&&!e.repeat&&(latest?.players.find(p=>p.id===self)?.team??0)>0&&ws?.readyState===WebSocket.OPEN){const d=new THREE.Vector3();camera.getWorldDirection(d);const range=traceSolids(camera.position,d,getMap(selectedMap).boxes.map(solidQuery),60),p=camera.position.clone().addScaledVector(d,range);p.y=Math.max(0,Math.min(30,p.y));if(Math.abs(p.x)<=63&&Math.abs(p.z)<=63)ws.send(JSON.stringify({type:'ping',p:{x:p.x,y:p.y,z:p.z}}));}
  if(e.code==='KeyP'&&photo){renderer.render(scene,camera);canvas.toBlob(blob=>{if(blob)download(blob,'vortex-photo.png');},'image/png');}
  if((e.code==='ArrowRight'||e.code==='ArrowLeft')&&latest?.players.find(p=>p.id===self)?.health===0){const ids=latest.players.filter(p=>p.id!==self&&p.health>0).map(p=>p.id),index=ids.indexOf(spectatorId);spectatorId=ids[(index+(e.code==='ArrowRight'?1:ids.length-1)+ids.length)%ids.length]??0;}
  if(e.code==='Digit1')weapon=0;if(e.code==='Digit2')weapon=1;
  if(e.code==='Digit1'||e.code==='Digit2')refreshLoadout();updateButtons();
});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Tab')element('scoreboard').hidden=true;updateButtons();});
element('open-scores').onclick=()=>{element('scoreboard').hidden=false;};
element('close-scores').onclick=()=>{element('scoreboard').hidden=true;};
addEventListener('blur',()=>{keys.clear();buttons=0;element('scoreboard').hidden=true;});
addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas||!self)return;if(ignoreLook){ignoreLook=false;return;}yaw-=e.movementX*0.002*settings.sensitivity;pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,pitch-e.movementY*0.002*settings.sensitivity));});
canvas.addEventListener('wheel',e=>{if(document.pointerLockElement!==canvas||!self)return;e.preventDefault();weapon=1-weapon;refreshLoadout();},{passive:false});
canvas.addEventListener('mousedown',e=>{if(e.button===0&&!photo&&document.pointerLockElement===canvas&&self){buttons|=Button.Fire;edgeButtons|=Button.Fire;}});
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
  element('mode-label').textContent=['FREE FOR ALL','TEAM DEATHMATCH','DOMINATION','CAPTURE DU DRAPEAU'][s.mode??0];
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

  ctx.strokeStyle='#e6d8ad';ctx.lineWidth=4;
  for(const route of getMap(selectedMap).routes){ctx.beginPath();route.forEach(([x,z],i)=>{if(i===0)ctx.moveTo((x+64)*scale,(z+64)*scale);else ctx.lineTo((x+64)*scale,(z+64)*scale);});ctx.stroke();}
  // Draw solid cover over the navigation paths.
  for(const b of getMap(selectedMap).boxes){if(b.kind==='ground')continue;ctx.fillStyle=b.zone==='tree'?'#78b496':b.kind==='stone'?'#b28c76':b.kind==='crate'?'#e6b370':'#558da4';ctx.fillRect((b.p[0]-b.h[0]+64)*scale,(b.p[2]-b.h[2]+64)*scale,b.h[0]*2*scale,b.h[2]*2*scale);}
  ctx.fillStyle='#d9eef0';ctx.font='bold 9px sans-serif';ctx.fillText('N',82,12);
  const px=(me.state.p.x+64)*scale,pz=(me.state.p.z+64)*scale;
  ctx.save();ctx.translate(px,pz);ctx.rotate(-yaw);ctx.fillStyle='#c4ff9d';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(-4,-3);ctx.lineTo(4,-3);ctx.closePath();ctx.fill();ctx.restore();
  for(const p of s.players){if(p.health<=0||p.id!==self&&(!s.mode||p.team!==me.team))continue;ctx.fillStyle=p.id===self?'#c4ff9d':'#74eaff';ctx.beginPath();ctx.arc((p.state.p.x+64)*scale,(p.state.p.z+64)*scale,p.id===self?3:2,0,Math.PI*2);ctx.fill();}
}
element<HTMLFormElement>('lobby').onsubmit=e=>{
  e.preventDefault();if(!motor||mapBusy)return;audio.unlock();ambience.unlock();if(training){requestControl();return;}
  if(self&&ws?.readyState===WebSocket.OPEN){requestControl();return;}
  if(ws)return;
  let name:string;try{name=nickname(nameInput.value);}catch(err){status.textContent=String(err);return;}
  const url=import.meta.env.VITE_GAME_URL??'ws://127.0.0.1:8080/play';
  if(location.protocol==='https:'&&!url.startsWith('wss://')){status.textContent='Configure VITE_GAME_URL en wss:// pour ce site HTTPS.';return;}
  predictor=new Predictor(motor,()=>world.step());interpolator=new Interpolator();clock=new RenderClock();seq=0;accumulator=0;
  const socket=new WebSocket(url);ws=socket;socket.binaryType='arraybuffer';join.disabled=true;refreshLoadout();status.textContent='Connexion au serveur…';requestControl();
  socket.onopen=()=>{socket.send(JSON.stringify({version:2,map:MAP_VERSION,name,mode,mapId:selectedMap,character,ticket:element<HTMLInputElement>('ticket').value}));};
  socket.onmessage=e=>{
    if(ws!==socket)return;
    try{
      if(typeof e.data==='string'){
        const message=JSON.parse(e.data);if(message.type==='shot')serverEffects.shot(message,performance.now()/1000);if(message.type==='projectiles')serverEffects.projectiles(message.rows);if(message.type==='impact')serverEffects.impact(message.p,message.surface,performance.now()/1000);
        if(message.type==='kill')feed(String(message.killer)+' → '+String(message.victim));
        if(message.type==='objectives')objectiveView.update(message.state,message.mode,message.tick);
        if(message.type==='ping')objectiveView.ping(message.p,performance.now()/1000+6);
        if(message.type==='round')feed('FIN DE MANCHE · '+String(message.winner));return;
      }
      if(!(e.data instanceof ArrayBuffer))throw new Error('Invalid server frame');
      const s=decodeSnapshot(new Uint8Array(e.data)),me=s.players.find(p=>p.id===s.self);if(!me)throw new Error('Missing local authority');
      const previousMe=latest?.players.find(p=>p.id===s.self),time=performance.now()/1000;
      if(previousMe&&previousMe.epoch===me.epoch){
        if(me.hits>previousMe.hits){hitUntil=time+0.18;audio.play('hit');}
        if(me.health<previousMe.health){hurtUntil=time+0.3;audio.play('hurt');}
      }
      for(const shooter of shotTracker.observe(s.players)){
        // Online visual trajectories come exclusively from authoritative events.
        if(shooter.id===s.self){viewWeapon.shot(time);if(document.pointerLockElement===canvas)audio.play(shooter.weapon?'pulse':'rail');}
      }
      recorder.record(s);latest=s;self=s.self;clock.observe(s.time,performance.now()/1000,s.rttMs);interpolator.add(s);authority=me;
      if(!connected){connected=true;seq=me.ack;character=me.character??0;yaw=Math.atan2(me.state.p.x,me.state.p.z);pitch=0;refreshLoadout();join.disabled=false;status.textContent='Partie prête. Clique sur Reprendre si la souris est libre.';}
      document.body.classList.add('connected');
      const ids=new Set(s.players.filter(p=>p.id!==self).map(p=>p.id));
      for(const [id,mesh]of enemies)if(!ids.has(id)){disposeName(mesh);scene.remove(mesh);enemies.delete(id);}
      for(const p of s.players)if(p.id!==self&&!enemies.has(p.id)){const mesh=createAvatar(p.character??0);attachName(mesh,p.name??'Pilote',p.team??0);scene.add(mesh);enemies.set(p.id,mesh);}
    }catch(err){status.textContent=String(err);socket.close(1002,'Protocol mismatch');}
  };
  socket.onclose=e=>{console.warn('Vortex session closed',e.code,e.reason);if(ws!==socket)return;ws=undefined;resetSession();status.textContent=e.code===1000?'Partie quittée.':e.code===1008?'Connexion refusée : pseudo, ticket ou version incompatibles.':'Connexion interrompue ('+e.code+'). Tu peux relancer la partie.';};
  socket.onerror=()=>{status.textContent='Serveur inaccessible. Démarre npm run server:dev puis relance la partie.';};
};
addEventListener('resize',()=>{if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();viewWeapon.resize(camera.aspect);});
function frame(now:number):void{
  requestAnimationFrame(frame);const started=performance.now();const elapsed=Math.min((now-lastFrame)/1000,0.05);lastFrame=now;
  accumulator+=elapsed;
  if(ws?.readyState===WebSocket.OPEN&&self){
    const me=latest?.players.find(p=>p.id===self);
    // Coalesce network bursts: restore/replay only the newest authority each frame.
    if(authority){predictor.reconcile(authority);authority=undefined;}
    if(latest&&me&&now-hudTime>=100){hud(latest,me);hudTime=now;}
    while(accumulator>=DT){
      // Bound prediction work and yield to network tasks instead of disconnecting.
      if(predictor.pending.length>=64){accumulator=0;if(send.length){ws.send(encodeBatch(send));send=[];}break;}
      const input=canonical({seq:seq=(seq+1)>>>0,yaw,pitch,buttons:me&&me.health>0?(buttons|edgeButtons):0,weapon,phase:0});
      try{predictor.predict(input);}catch(err){console.error('Vortex prediction failed',String(err),JSON.stringify({pending:predictor.pending.length,seq,ack:me?.ack}));ws.close(1000,'Simulation error');return;}
      edgeButtons=0;send.push(input);accumulator-=DT;
      if(send.length>=2){if(ws.bufferedAmount>16384){ws.close(1000,'Input backlog');return;}ws.send(encodeBatch(send));send=[];}
    }
    predictor.renderDecay(elapsed);const p=predictor.renderPosition(accumulator/DT);
    camera.position.set(p.x,p.y+(motor.state.crouched?0.35:0.65),p.z);camera.rotation.set(pitch,yaw,0,'YXZ');
    const time=clock.serverNow(now/1000)-INTERPOLATION_MS/1000;
    for(const [id,mesh]of enemies){const p=interpolator.sample(id,time);if(p){mesh.position.set(p.state.p.x,p.state.p.y,p.state.p.z);mesh.scale.y=p.state.crouched?0.61:1;mesh.rotation.y=p.yaw;mesh.visible=p.health>0;animateAvatar(mesh,now/1000,Math.hypot(p.state.v.x,p.state.v.z));}}
  }else{
    accumulator=0;send=[];const angle=now*0.000022;camera.position.set(Math.sin(angle)*52,32,Math.cos(angle)*52);camera.lookAt(0,3,0);
  }
  if(photo&&training&&document.pointerLockElement===canvas){camera.rotation.set(pitch,yaw,0,'YXZ');const d=new THREE.Vector3(Number(keys.has('KeyD'))-Number(keys.has('KeyA')||keys.has('KeyQ')),Number(keys.has('Space'))-Number(keys.has('KeyC')),Number(keys.has('KeyS'))-Number(keys.has('KeyW')||keys.has('KeyZ')));d.applyEuler(camera.rotation);camera.position.addScaledVector(d,elapsed*(keys.has('ShiftLeft')?20:8));}
  const active=Boolean(self)&&document.pointerLockElement===canvas,me=latest?.players.find(p=>p.id===self);
  document.body.classList.toggle('playing',active);
  const speed=Math.hypot(motor.state.v.x,motor.state.v.z),time=now/1000;
  element('speed').textContent=speed.toFixed(1);
  const position=motor.state.p;
  element('location-label').textContent=me?.health===0?'SPECTATEUR / ? ? pour changer':arenaZone(position.x,position.y,position.z);
  element('hitmarker').classList.toggle('visible',active&&time<hitUntil);
  element('damage-flash').classList.toggle('visible',active&&time<hurtUntil);
  element('vitals').classList.toggle('critical',Boolean(me&&me.health>0&&me.health<=35));
  const targetFov=settings.fov+(active&&!settings.reducedMotion?Math.min(8,Math.max(0,speed-8)*0.6):0);
  if(!photo&&Math.abs(camera.fov-targetFov)>0.01){camera.fov+=(targetFov-camera.fov)*(1-Math.exp(-elapsed*8));camera.updateProjectionMatrix();}
  viewWeapon.update(elapsed,time,speed,weapon,active,Boolean(me?.reloadLeft),settings.reducedMotion);
  serverEffects.enabled=settings.effects;serverEffects.update(elapsed,time);effects.update(elapsed);
  const floor=getMap(selectedMap).boxes.find(b=>b.kind!=='ground'&&Math.abs(position.x-b.p[0])<b.h[0]&&Math.abs(position.z-b.p[2])<b.h[2]&&Math.abs(position.y-1-b.p[1]-b.h[1])<0.6);ambience.update(time,speed,motor.state.grounded,arenaZone(position.x,position.y,position.z),floor?.kind??'ground',settings.volume/100,active);
  objectiveView?.animate(time);if(!settings.reducedMotion){animateArena(scene,time);animateBiomes(scene,time,(document.getElementById('fauna-toggle') as HTMLInputElement)?.checked!==false);}
  if(document.hidden)return;
  renderer.render(scene,camera);if(active&&me&&me.health>0)viewWeapon.render(renderer);else if(!self&&!replay)showroom.render(renderer,now/1000,character,weapon);
  if(performance.now()-started>1000)console.warn('Vortex slow frame',Math.round(performance.now()-started),predictor.pending.length);
  if((document.getElementById('adaptive-toggle') as HTMLInputElement)?.checked&&!document.hidden){const scale=adaptive.step(elapsed*1000,now),base=settings.quality==='low'?0.6:Math.min(devicePixelRatio,settings.quality==='high'?1.75:1.25);if(Math.abs(renderer.getPixelRatio()-base*scale)>0.02)renderer.setPixelRatio(base*scale);}
  frames++;if(now-fpsTime>=500){fps=Math.round(frames*1000/(now-fpsTime));frames=0;fpsTime=now;element('performance').textContent=fps+' FPS · '+(latest?.rttMs??0).toFixed(0)+' ms'+(predictor.pending.length>=64?' · SYNCHRONISATION':'');}
}
let send:Input[]=[];
async function boot():Promise<void>{
  renderer=new THREE.WebGLRenderer({canvas,antialias:settings.quality!=='low'&&new URLSearchParams(location.search).get('quality')!=='low',powerPreference:'high-performance'});
  renderer.setPixelRatio(new URLSearchParams(location.search).get('quality')==='low'?0.6:Math.min(devicePixelRatio,1.25));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  const subtitle=menu.querySelector('.map-card small');if(subtitle)subtitle.textContent='128 × 128 m · canyon · jardins · galeries · grottes';
  const intro=menu.querySelector('.intro');if(intro)intro.textContent='Sous les falaises, à travers les jardins. Prends les rampes, domine les toits.';
  const brand=document.querySelector('#brand span');if(brand)brand.textContent=' / 05';
  scene=new THREE.Scene();buildArena(scene,selectedMap);camera=new THREE.PerspectiveCamera(settings.fov,innerWidth/innerHeight,0.05,260);camera.rotation.order='YXZ';
  effects=new CombatEffects(scene,getMap(selectedMap).boxes);objectiveView=new ObjectiveView(scene,selectedMap);serverEffects=new AuthoritativeEffects(scene);showroom=new Showroom();viewWeapon=new ViewWeapon();viewWeapon.resize(camera.aspect);applySettings();
  world=await createArena(selectedMap);const start=getMap(selectedMap).spawns[0];motor=new RapierMotor(world,initialState(start[0],start[1],start[2]),new Set(),selectedMap);world.step();
  predictor=new Predictor(motor,()=>world.step());join.disabled=false;status.textContent='Prêt. Choisis ton pseudo, ton mode et ton équipement.';lastFrame=performance.now();requestAnimationFrame(frame);
}
const mapSelect=document.createElement('select');mapSelect.id='map-select';mapSelect.setAttribute('aria-label','Carte');for(const id of ['canyon','harbor'] as const){const option=document.createElement('option');option.value=id;option.textContent=getMap(id).name;mapSelect.append(option);}modeOptions.before(mapSelect);
mapSelect.onchange=async()=>{if(ws||training||replay||mapBusy)return;mapBusy=true;join.disabled=true;try{selectedMap=mapSelect.value as MapId;motor.dispose();world.free();for(const object of [...scene.children])scene.remove(object);scene.userData.quality=undefined;buildArena(scene,selectedMap);effects=new CombatEffects(scene,getMap(selectedMap).boxes);world=await createArena(selectedMap);const p=getMap(selectedMap).spawns[0];motor=new RapierMotor(world,initialState(...p),new Set(),selectedMap);world.step();predictor=new Predictor(motor,()=>world.step());applySettings();status.textContent=getMap(selectedMap).name+' pr?te.';}finally{mapBusy=false;join.disabled=false;}};
const theme=document.createElement('select');theme.id='theme-select';theme.setAttribute('aria-label','Ambiance');theme.innerHTML='<option value="day">Jour</option><option value="night">Nuit</option>';theme.value=localStorage.getItem('vortex-theme')==='night'?'night':'day';theme.setAttribute('data-night',String(theme.value==='night'));theme.onchange=()=>{localStorage.setItem('vortex-theme',theme.value);theme.setAttribute('data-night',String(theme.value==='night'));themeArena(scene,theme.value==='night');};document.getElementById('settings')!.append(theme);
const fauna=document.createElement('label');fauna.className='setting-choice';fauna.textContent='Faune d?ambiance';const toggle=document.createElement('input');toggle.type='checkbox';toggle.id='fauna-toggle';toggle.checked=localStorage.getItem('vortex-fauna')!=='off';toggle.onchange=()=>{localStorage.setItem('vortex-fauna',toggle.checked?'on':'off');const group=scene.getObjectByName('ambient-fauna');if(group)group.visible=toggle.checked;};fauna.append(toggle);document.getElementById('settings')!.append(fauna);
const tools=document.createElement('details');tools.id='training-tools';tools.innerHTML='<summary>Exploration et entra?nement hors ligne</summary><div class="tool-grid"></div><label class="setting-choice">Difficult? bots<select id="bot-difficulty"><option value="1">Facile</option><option value="2" selected>Normal</option><option value="3">Difficile</option></select></label><button type="button" id="photo-toggle">Mode photo ? P pour exporter</button><label class="setting-row">Focale photo<input id="photo-fov" type="range" min="35" max="110" value="70"></label><button type="button" id="replay-export">Exporter la relecture</button><label class="field">Ouvrir une relecture<input id="replay-import" type="file" accept=".json,application/json"></label>';document.getElementById('lobby')!.append(tools);
const trainingStatus=document.createElement('div');trainingStatus.id='training-status';document.body.append(trainingStatus);
for(const [id,label]of [['visit','Visite libre'],['range','Stand de tir'],['bots','Bots'],['course','Parcours chrono']] as const){const b=document.createElement('button');b.type='button';b.id='offline-'+id;b.textContent=label;tools.querySelector('.tool-grid')!.append(b);b.onclick=()=>{if(ws||!motor||mapBusy)return;resetSession();recorder.reset();audio.unlock();ambience.unlock();training=new Training(world,motor,scene,selectedMap,id,Number((document.getElementById('bot-difficulty') as HTMLSelectElement).value));self=1;document.body.classList.add('connected');latest=training.snapshot();refreshLoadout();requestControl();};}
document.getElementById('photo-toggle')!.onclick=()=>{if(!training){status.textContent='Lance une visite hors ligne pour utiliser le mode photo.';return;}photo=!photo;document.body.classList.toggle('photo-mode',photo);camera.fov=Number((document.getElementById('photo-fov') as HTMLInputElement).value);camera.updateProjectionMatrix();requestControl();};
document.getElementById('photo-fov')!.oninput=e=>{if(photo){camera.fov=Number((e.target as HTMLInputElement).value);camera.updateProjectionMatrix();}};
document.getElementById('replay-export')!.onclick=()=>{if(!recorder.count){status.textContent='Joue une partie ou un entra?nement avant d?exporter.';return;}download(new Blob([JSON.stringify(recorder.export(selectedMap))],{type:'application/json'}),'vortex-replay.json');};
document.getElementById('replay-import')!.onchange=async e=>{if(ws||training||mapBusy)return;const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;try{if(file.size>12000000)throw new Error('12 Mo maximum.');const loaded=parseReplay(await file.text());if(loaded.mapId!==selectedMap){status.textContent='Choisis '+getMap(loaded.mapId).name+' avant cette relecture.';return;}resetSession();replay=loaded;replayStart=performance.now();menu.hidden=true;document.body.classList.add('connected');element('leave').hidden=false;}catch(err){status.textContent=String(err);}};
const adaptiveLabel=document.createElement('label');adaptiveLabel.className='setting-choice';adaptiveLabel.textContent='R?solution adaptative';const adaptiveToggle=document.createElement('input');adaptiveToggle.id='adaptive-toggle';adaptiveToggle.type='checkbox';adaptiveToggle.checked=localStorage.getItem('vortex-adaptive')==='on';adaptiveToggle.onchange=()=>{localStorage.setItem('vortex-adaptive',adaptiveToggle.checked?'on':'off');adaptive.reset();applySettings();};adaptiveLabel.append(adaptiveToggle);document.getElementById('settings')!.append(adaptiveLabel);
void boot().catch(err=>{status.textContent='Le moteur ne peut pas démarrer : '+String(err);join.disabled=true;});
