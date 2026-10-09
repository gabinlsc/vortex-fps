import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {WebSocket} from 'ws';
import {MAP_VERSION} from '../shared/map.ts';
import {decodeSnapshot,type Snapshot} from '../shared/snapshot.ts';
import {Button,encodeBatch} from '../shared/input.ts';
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(predicate:()=>boolean,timeout=8000):Promise<void>{
  const deadline=Date.now()+timeout;while(!predicate()){if(Date.now()>deadline)throw new Error('Network assertion timed out');await delay(20);}
}
test('real server isolates modes, balances teams, transmits names and replenishes magazines',{timeout:25000},async()=>{
  const probe=createServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const port=(probe.address() as {port:number}).port;await new Promise<void>(resolve=>probe.close(()=>resolve()));
  const server=spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','server/main.ts','--local-dev'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  let output='';server.stdout.on('data',data=>{output+=String(data);});server.stderr.on('data',data=>{output+=String(data);});
  const clients:{ws:WebSocket;latest:Snapshot|undefined;seq:number;events:any[]}[]=[];
  try{
    await waitFor(()=>output.includes('LOCAL DEVELOPMENT'));
    async function connect(name:string,mode:string,mapId='canyon'){
      const client={ws:new WebSocket('ws://127.0.0.1:'+port+'/play',{origin:'http://localhost:5173'}),latest:undefined as Snapshot|undefined,seq:0,events:[] as any[]};
      clients.push(client);client.ws.on('error',()=>{});
      client.ws.on('message',(data,binary)=>{if(binary)client.latest=decodeSnapshot(new Uint8Array(data as Buffer));else client.events.push(JSON.parse(data.toString()));});
      await new Promise<void>((resolve,reject)=>{client.ws.once('open',()=>resolve());client.ws.once('error',reject);});
      client.ws.send(JSON.stringify({version:2,map:MAP_VERSION,name,mode,mapId,character:0,ticket:''}));
      await waitFor(()=>Boolean(client.latest));return client;
    }
    const alpha=await connect('Alpha','ffa'),bravo=await connect('Bravo','ffa');
    const red=await connect('Red','tdm'),blue=await connect('Blue','tdm');
    await waitFor(()=>alpha.latest?.players.length===2&&red.latest?.players.length===2);
    assert.deepEqual(alpha.latest!.players.map(p=>p.name).sort(),['Alpha','Bravo']);
    assert.deepEqual(red.latest!.players.map(p=>p.team).sort(),[1,2]);
    assert.ok(alpha.latest!.players.every(p=>p.team===0));
    const local=()=>alpha.latest!.players.find(p=>p.id===alpha.latest!.self)!;
    await waitFor(()=>local().protectedLeft===0);
    alpha.ws.send(encodeBatch([{seq:++alpha.seq,yaw:0,pitch:0,buttons:Button.Fire,weapon:0,phase:0}]));
    await waitFor(()=>local().magazines?.[0]===5);
    alpha.ws.send(encodeBatch([{seq:++alpha.seq,yaw:0,pitch:0,buttons:Button.Reload,weapon:0,phase:0}]));
    await waitFor(()=>Boolean(local().reloadLeft));assert.equal(local().reloadWeapon,0);
    await waitFor(()=>local().magazines?.[0]===6&&local().reloadLeft===0);
    assert.ok(local().state.p.y>0.85);
    assert.equal(alpha.ws.readyState,WebSocket.OPEN);
    const harbor=await connect('Harbor','ffa','harbor'),dom=await connect('Dominant','domination'),ctf=await connect('Flag','ctf');
    assert.equal(harbor.latest!.players.length,1);assert.equal(dom.latest!.mode,2);assert.equal(ctf.latest!.mode,3);assert.equal(dom.latest!.players[0].team,1);
    const p=red.latest!.players.find(p=>p.id===red.latest!.self)!.state.p;red.ws.send(JSON.stringify({type:'ping',p}));await waitFor(()=>red.events.some(e=>e.type==='ping'));assert.ok(!blue.events.some(e=>e.type==='ping'));assert.ok(!harbor.events.some(e=>e.type==='ping'));
    alpha.ws.send(encodeBatch([{seq:++alpha.seq,yaw:0,pitch:0,buttons:Button.Fire,weapon:1,phase:0}]));await waitFor(()=>alpha.events.some(e=>e.type==='projectiles'&&e.rows.length));const frame=alpha.events.find(e=>e.type==='projectiles'&&e.rows.length);assert.ok(frame.rows.every((q:any)=>Number.isInteger(q.id)&&Number.isFinite(q.p.x)));assert.ok(alpha.events.some(e=>e.type==='shot'));assert.ok(!harbor.events.some(e=>e.type==='shot'));
    void bravo;
  }catch(err){throw new Error(String(err)+'\nServer output:\n'+output);}
  finally{
    for(const client of clients)client.ws.terminate();server.kill('SIGTERM');
    await new Promise<void>(resolve=>{if(server.exitCode!==null)resolve();else {server.once('exit',()=>resolve());setTimeout(()=>{server.kill('SIGKILL');resolve();},3000).unref();}});
  }
});
