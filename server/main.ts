import {applyHit} from './combat.ts';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {createArena,RapierMotor,eye} from '../shared/physics.ts';
import {initialState,copyState} from '../shared/movement.ts';
import {Button,DT,TICK_HZ,decodeBatch,type Input} from '../shared/input.ts';
import {encodeSnapshot,type PlayerSnapshot} from '../shared/snapshot.ts';
import {BOXES,MAP_VERSION,SPAWNS} from '../shared/map.ts';
import {solidQuery,traceSolids} from '../shared/arena-geometry.ts';
import {getMap,validateMap,MAP_IDS,type MapId} from '../shared/maps.ts';
const mapQueries=new Map(MAP_IDS.map(id=>[id,getMap(id).boxes.map(solidQuery)]));
import {newInventory,updateInventory,consumeRound,type Inventory,WEAPONS,recoil,projectileStep,type Projectile} from '../shared/gunplay.ts';
import {History,bodyHitbox,direction,rewindTime,castHistorical} from './lag-compensation.ts';
import {nickname,validateMode,assignTeam,canDamage,chooseSpawn,type GameMode,type Team} from '../shared/match.ts';
import {validateCharacter} from '../shared/characters.ts';
import {verifyTicket} from './tickets.ts';
import {AgonesLifecycle} from './agones.ts';

const dev=process.argv.includes('--local-dev'),secret=process.env.TICKET_SECRET??'',match=process.env.MATCH_ID??'local-match';
if(!dev && secret.length<32)throw new Error('TICKET_SECRET required. Local development: npm run server:dev');
const host=dev?'127.0.0.1':process.env.HOST??'0.0.0.0',port=Number(process.env.PORT??8080);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid port');
const origins=new Set((process.env.ALLOWED_ORIGINS??'http://localhost:5173,http://127.0.0.1:5173').split(','));
const worlds=new Map(await Promise.all(MAP_IDS.map(async id=>[id,await createArena(id)] as const)));
const world=worlds.get('canyon')!,handles=new Set<number>(),history=new History(32),lifecycle=new AgonesLifecycle();
let tick=0,nextId=1,running=true;
interface Queued {input:Input;receiptTick:number}
interface Peer {
  id:number;mapId:MapId;character:number;name:string;mode:GameMode;team:Team;kills:number;assists:number;deaths:number;respawnAt:number;protectedUntil:number;contributors:Map<number,{damage:number;time:number}>;inventory:Inventory;sub:string;ws:WebSocket;motor:RapierMotor;queue:Queued[];head:number;
  received:number;ack:number;last:Input;epoch:number;health:number;hits:number;nextShot:number;shotIndex:number;
  rtt:number;rttSamples:number[];nonce:Buffer|null;pingTime:number;authTime:number;
  budget:number;budgetTime:number;lastPacket:number;
}
const peers=new Map<number,Peer>(),subjects=new Set<string>(),redeemed=new Map<string,number>();
const projectiles:Projectile[]=[];
const rooms=new Map<string,{end:number;score1:number;score2:number}>();
function room(mode:GameMode,mapId:MapId){const key=mapId+':'+mode;let value=rooms.get(key);if(!value){value={end:tick+600*TICK_HZ,score1:0,score2:0};rooms.set(key,value);}return value;}
function targets(owner:Peer){
  return [...peers.values()].filter(p=>p.mapId===owner.mapId&&p.id!==owner.id&&p.health>0&&canDamage(owner,p));
}
function respawn(p:Peer):void {
  const spawn=chooseSpawn(p.team,targets(p).map(e=>e.motor.state.p),p.id+p.epoch,getMap(p.mapId).spawns);
  p.epoch++;p.health=100;p.respawnAt=0;p.protectedUntil=tick+TICK_HZ;
  p.shotIndex=0;p.inventory=newInventory();p.nextShot=tick+TICK_HZ;p.contributors.clear();
  p.motor.restore(initialState(spawn[0],spawn[1],spawn[2]));p.last={...p.last,buttons:0};
}
function event(mode:GameMode,data:Record<string,unknown>,mapId:MapId='canyon'):void {
  const message=JSON.stringify(data);for(const p of peers.values())if(p.mode===mode&&p.mapId===mapId&&p.ws.readyState===WebSocket.OPEN&&p.ws.bufferedAmount<65536)p.ws.send(message);
}

function wallDistance(o:{x:number;y:number;z:number},d:{x:number;y:number;z:number},range=200,mapId:MapId='canyon'):number {
  return traceSolids(o,d,mapQueries.get(mapId)!,range);
}
function damage(id:number,epoch:number,amount:number,owner:Peer):void {
  const target=peers.get(id);if(!target)return;
  if(applyHit(target,owner,epoch,amount,tick,peers)!=='kill')return;
  target.respawnAt=tick+2*TICK_HZ;target.last={...target.last,buttons:0};
  if(owner.team===1)room(owner.mode,owner.mapId).score1++;if(owner.team===2)room(owner.mode,owner.mapId).score2++;
  event(owner.mode,{type:'kill',killer:owner.name,victim:target.name,weapon:owner.last.weapon},owner.mapId);
}
function shoot(p:Peer,queued:Queued|undefined):void {
  const input=p.last;if(!(input.buttons&Button.Fire)||tick<p.nextShot||p.health<=0||tick<p.protectedUntil)return;
  const weapon=WEAPONS[input.weapon];if(!weapon||!consumeRound(p.inventory,input.weapon))return;p.nextShot=tick+weapon.cooldownTicks;
  const pattern=recoil(p.shotIndex++),d=direction(input.yaw+pattern.yaw,
    Math.max(-Math.PI/2,Math.min(Math.PI/2,input.pitch+pattern.pitch))),o=eye(p.motor.state);
  if(input.weapon===1){
    if(projectiles.length<256)projectiles.push({owner:p.id,ownerEpoch:p.epoch,p:{...o},
      v:{x:d.x*40,y:d.y*40,z:d.z*40},life:3*TICK_HZ,damage:weapon.damage});return;
  }
  // Historical targets; source is the server-simulated position of this command, never a client origin.
  const now=tick*DT,query=rewindTime(now,{rttMs:p.rtt,interpolationMs:50,
    queueMs:queued?(tick-queued.receiptTick)*DT*1000:0});
  const historical=history.sample(query);if(!historical)return;
  const ids=new Set(targets(p).map(e=>e.id)),boxes=historical.filter(b=>ids.has(b.id));
  const hit=castHistorical(o,d,p.id,boxes,wallDistance(o,d,200,p.mapId),weapon.range);
  if(hit)damage(hit.id,hit.epoch,weapon.damage,p);
}
function fixedTick():void {
  const commands=new Map<number,Queued|undefined>();tick++;
  for(const p of peers.values()){
    const cmd=p.queue[p.head++];
    if(cmd){p.last=cmd.input;p.ack=cmd.input.seq;}else p.head=Math.max(0,p.head-1);
    if(p.head>32){p.queue=p.queue.slice(p.head);p.head=0;}
    // Missing commands may hold movement/fire at server rate, never advance time or create extra edges.
    if(performance.now()-p.lastPacket>150)p.last={...p.last,buttons:0};
    if(p.health<=0&&tick>=p.respawnAt)respawn(p);
    if(p.health>0&&(p.motor.state.p.y<-5||Math.abs(p.motor.state.p.x)>63||Math.abs(p.motor.state.p.z)>63))respawn(p);
    if(p.health<=0)p.last={...p.last,buttons:0};
    updateInventory(p.inventory,tick,p.last.weapon,Boolean(p.last.buttons&Button.Reload));
    p.motor.tick(p.last);commands.set(p.id,cmd);
  }
  world.step();
  history.push({time:tick*DT,boxes:[...peers.values()].map(p=>bodyHitbox(p.id,p.epoch,{...p.motor.state.p},p.motor.state.crouched))});
  for(const p of peers.values())shoot(p,commands.get(p.id));
  const boxes=[...peers.values()].map(p=>bodyHitbox(p.id,p.epoch,p.motor.state.p,p.motor.state.crouched));
  for(let i=projectiles.length-1;i>=0;i--){
    const projectile=projectiles[i],segment=projectileStep(projectile,DT),owner=peers.get(projectile.owner);
    const wall=wallDistance(segment.from,segment.direction,segment.distance,owner?.mapId);
    const ids=new Set(owner?targets(owner).map(e=>e.id):[]);
    const hit=castHistorical(segment.from,segment.direction,projectile.owner,boxes.filter(b=>ids.has(b.id)),wall,segment.distance);
    if(hit&&owner&&owner.epoch===projectile.ownerEpoch)damage(hit.id,hit.epoch,projectile.damage,owner);
    if(hit||wall<segment.distance||projectile.life<=0)projectiles.splice(i,1);
  }
  if(tick%4===0){ // 32 snapshots/s independent from 128 physics ticks/s
    for(const mapId of MAP_IDS)for(const mode of ['ffa','tdm'] as const){
      const currentRoom=room(mode,mapId),members=[...peers.values()].filter(p=>p.mode===mode&&p.mapId===mapId);
      if(currentRoom.end&&tick>=currentRoom.end){
        const winners=members.slice().sort((a,b)=>b.kills-a.kills);
        event(mode,{type:'round',winner:mode==='ffa'?(winners[0]?.name??'Personne'):currentRoom.score1===currentRoom.score2?'Égalité':currentRoom.score1>currentRoom.score2?'Équipe Azure':'Équipe Ember'});
        currentRoom.end=tick+600*TICK_HZ;currentRoom.score1=0;currentRoom.score2=0;
        for(const p of members){p.kills=0;p.assists=0;p.deaths=0;respawn(p);}
      }
      const players:PlayerSnapshot[]=members.map(p=>({id:p.id,ack:p.ack,state:copyState(p.motor.state),
        yaw:p.last.yaw,pitch:p.last.pitch,health:p.health,epoch:p.epoch,hits:p.hits,character:p.character,
        name:p.name,team:p.team,kills:p.kills,assists:p.assists,deaths:p.deaths,weapon:p.last.weapon,
        magazines:p.inventory.magazines,reloadWeapon:p.inventory.reloadWeapon,reloadLeft:Math.max(0,p.inventory.reloadUntil-tick),
        respawnLeft:p.health<=0?Math.max(0,p.respawnAt-tick):0,protectedLeft:Math.max(0,p.protectedUntil-tick),shotIndex:p.shotIndex}));
      for(const p of members){
        if(p.ws.bufferedAmount>64*1024){p.ws.close(1013,'Slow consumer');continue;}
        p.ws.send(encodeSnapshot({tick,time:tick*DT,self:p.id,players,rttMs:p.rtt,mode:mode==='tdm'?1:0,score1:currentRoom.score1,score2:currentRoom.score2,remaining:Math.ceil(Math.max(0,currentRoom.end-tick)/TICK_HZ)}),{binary:true});
      }
    }
  }
}
const http=createServer((_req,res)=>{res.writeHead(200,{'content-type':'text/plain'});res.end('vortex game server\n');});
const wss=new WebSocketServer({noServer:true,maxPayload:1024,perMessageDeflate:false});
const upgradeBudget=new Map<string,{time:number;count:number}>();
http.on('upgrade',(req,socket,head)=>{
  const address=req.socket.remoteAddress??'';
  const now=performance.now(),previous=upgradeBudget.get(address);
  const b=previous&&now-previous.time<10000?previous:{time:now,count:0};b.count++;upgradeBudget.set(address,b);
  if(upgradeBudget.size>4096){for(const [ip,v]of upgradeBudget)if(now-v.time>10000)upgradeBudget.delete(ip);}
  // Edge must rate-limit distinct IPs too; do not trust arbitrary X-Forwarded-For headers here.
  if(b.count>16||upgradeBudget.size>8192||wss.clients.size>=32||req.url!=='/play'||!origins.has(req.headers.origin??'')){
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
  }
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
});
wss.on('connection',ws=>{
  let peer:Peer|undefined;
  const timeout=setTimeout(()=>ws.close(1008,'Authentication timeout'),3000);
  ws.on('error',()=>{});
  ws.on('message',(raw,binary)=>{
    try{
      if(!peer){
        if(binary)throw new Error('Auth first');
        const auth=JSON.parse(raw.toString());
        const mapId=validateMap(auth.mapId);
        const character=validateCharacter(auth.character??0),name=nickname(auth.name),mode=validateMode(auth.mode);
        if(auth.version!==2||auth.map!==MAP_VERSION||peers.size>=16||nextId>65535)throw new Error('Build/capacity mismatch');
        let sub:string;
        if(dev)sub=`local-${nextId}`;
        else{
          const claims=verifyTicket(auth.ticket,match,secret);
          if(redeemed.has(claims.jti)||subjects.has(claims.sub))throw new Error('Replay');
          for(const [key,expiry]of redeemed)if(expiry<Date.now()/1000)redeemed.delete(key);
          redeemed.set(claims.jti,claims.exp);sub=claims.sub;
        }
        const id=nextId++,now=performance.now(),team=assignTeam(mode,[...peers.values()].filter(p=>p.mode===mode&&p.mapId===mapId).map(p=>p.team));
        const spawn=chooseSpawn(team,[...peers.values()].filter(p=>p.mode===mode&&p.mapId===mapId&&(mode==='ffa'||p.team!==team)&&p.health>0).map(p=>p.motor.state.p),id,getMap(mapId).spawns);
        room(mode,mapId);
        peer={id,mapId,character,name,mode,team,kills:0,assists:0,deaths:0,respawnAt:0,protectedUntil:tick+TICK_HZ,contributors:new Map(),inventory:newInventory(),sub,ws,motor:new RapierMotor(worlds.get(mapId)!,initialState(spawn[0],spawn[1],spawn[2]),handles),queue:[],head:0,
          received:0,ack:0,last:{seq:0,yaw:0,pitch:0,buttons:0,weapon:0,phase:0},epoch:0,health:100,hits:0,
          nextShot:tick,shotIndex:0,rtt:0,rttSamples:[],nonce:null,pingTime:0,
          authTime:now,budget:16,budgetTime:now,lastPacket:now};
        subjects.add(sub);peers.set(id,peer);clearTimeout(timeout);return;
      }
      if(!binary)throw new Error('Binary input required');
      const bytes=Buffer.isBuffer(raw)?raw:Buffer.concat(raw as Buffer[]),batch=decodeBatch(bytes),now=performance.now();
      peer.budget=Math.min(16,peer.budget+(now-peer.budgetTime)*TICK_HZ/1000);peer.budgetTime=now;
      if(batch.length>peer.budget || peer.queue.length-peer.head+batch.length>16)throw new Error('Input flood');
      for(const input of batch){
        if(input.seq!==((peer.received+1)>>>0))throw new Error('Input sequence');
        peer.received=input.seq;peer.queue.push({input,receiptTick:tick});
      }
      peer.budget-=batch.length;peer.lastPacket=now;
    }catch(err){console.warn('Rejected command:',err instanceof Error?err.message:'Invalid');ws.close(1008,'Invalid command');}
  });
  ws.on('pong',data=>{
    if(!peer||!peer.nonce||!data.equals(peer.nonce))return;
    const rtt=performance.now()-peer.pingTime;peer.nonce=null;
    peer.rttSamples.push(rtt);if(peer.rttSamples.length>16)peer.rttSamples.shift();
    // Lower quartile reduces a client's ability to buy extra rewind with selectively delayed pongs.
    const sorted=[...peer.rttSamples].sort((a,b)=>a-b);peer.rtt=sorted[Math.floor(sorted.length/4)];
  });
  ws.on('close',()=>{clearTimeout(timeout);if(peer){peers.delete(peer.id);subjects.delete(peer.sub);peer.motor.dispose();}});
});
await new Promise<void>(resolve=>http.listen(port,host,resolve));
await lifecycle.ready();
console.log(`Vortex ${dev?'LOCAL DEVELOPMENT':'authenticated'} on ${host}:${port}, ${TICK_HZ} Hz`);
const pingTimer=setInterval(()=>{
  for(const p of peers.values()){
    if(p.nonce){if(performance.now()-p.pingTime>5000)p.ws.close(1001,'Heartbeat timeout');continue;}
    p.nonce=randomBytes(8);p.pingTime=performance.now();p.ws.ping(p.nonce);
  }
},1000);
let deadline=performance.now()+DT*1000,timer:ReturnType<typeof setTimeout>;
function pump():void {
  if(!running)return;
  const now=performance.now();let steps=0;
  while(now>=deadline && steps<4){fixedTick();deadline+=DT*1000;steps++;}
  // Never drop simulation time or spiral into an unbounded catch-up. Terminate an unhealthy match.
  if(now-deadline>250){console.error('Tick deadline missed >250ms');void shutdown(1);return;}
  timer=setTimeout(pump,Math.max(0,deadline-performance.now()));
}
timer=setTimeout(pump,DT*1000);
async function shutdown(code=0):Promise<void>{
  if(!running)return;running=false;clearTimeout(timer);clearInterval(pingTimer);
  for(const p of peers.values())p.ws.terminate();http.close();wss.close();
  await lifecycle.shutdown().catch(console.error);for(const w of worlds.values())w.free();process.exit(code);
}
process.on('SIGTERM',()=>void shutdown());process.on('SIGINT',()=>void shutdown());
