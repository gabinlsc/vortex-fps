import {Builder,ByteBuffer} from 'flatbuffers';
import type {MotionState} from './movement.ts';
export interface PlayerSnapshot {id:number;ack:number;state:MotionState;yaw:number;pitch:number;health:number;epoch:number;hits:number;character?:number;name?:string;team?:number;kills?:number;assists?:number;deaths?:number;weapon?:number;magazines?:number[];reloadWeapon?:number;reloadLeft?:number;respawnLeft?:number;protectedLeft?:number;shotIndex?:number}
export interface Snapshot {tick:number;time:number;self:number;players:PlayerSnapshot[];rttMs:number;mode?:number;score1?:number;score2?:number;remaining?:number}
// Small checked-in schema binding using the official FlatBuffers runtime.
// Regenerate equivalent bindings with flatc --ts shared/snapshot.fbs before schema evolution.
export function encodeSnapshot(s:Snapshot):Uint8Array {
  const b=new Builder(2048);
  const offsets=s.players.map(p=>{
    const name=b.createString(p.name??'Pilot');
    b.startObject(30);
    b.addFieldInt16(0,p.id,0);b.addFieldInt32(1,p.ack,0);
    [p.state.p.x,p.state.p.y,p.state.p.z,p.state.v.x,p.state.v.y,p.state.v.z].forEach((v,i)=>b.addFieldFloat32(i+2,v,0));
    b.addFieldInt8(8,Number(p.state.grounded)|Number(p.state.crouched)<<1,0);
    b.addFieldInt16(9,p.state.slideTicks,0);b.addFieldInt8(10,p.state.lastButtons,0);
    b.addFieldFloat32(11,p.yaw,0);b.addFieldFloat32(12,p.pitch,0);
    b.addFieldInt16(13,p.health,0);b.addFieldInt32(14,p.epoch,0);b.addFieldInt32(15,p.hits,0);b.addFieldInt8(16,p.character??0,0);
    b.addFieldOffset(17,name,0);b.addFieldInt8(18,p.team??0,0);
    b.addFieldInt32(19,p.kills??0,0);b.addFieldInt32(20,p.assists??0,0);b.addFieldInt32(21,p.deaths??0,0);
    b.addFieldInt8(22,p.weapon??0,0);b.addFieldInt16(23,p.magazines?.[0]??0,0);b.addFieldInt16(24,p.magazines?.[1]??0,0);
    b.addFieldInt8(25,(p.reloadWeapon??-1)+1,0);b.addFieldInt16(26,p.reloadLeft??0,0);
    b.addFieldInt16(27,p.respawnLeft??0,0);b.addFieldInt16(28,p.protectedLeft??0,0);b.addFieldInt32(29,p.shotIndex??0,0);
    return b.endObject();
  });
  b.startVector(4,offsets.length,4);for(let i=offsets.length-1;i>=0;i--)b.addOffset(offsets[i]);
  const vector=b.endVector();b.startObject(9);
  b.addFieldInt32(0,s.tick,0);b.addFieldFloat64(1,s.time,0);b.addFieldInt16(2,s.self,0);b.addFieldOffset(3,vector,0);
  b.addFieldFloat32(4,s.rttMs,0);
  b.addFieldInt8(5,s.mode??0,0);b.addFieldInt32(6,s.score1??0,0);b.addFieldInt32(7,s.score2??0,0);b.addFieldInt16(8,s.remaining??0,0);
  b.finish(b.endObject(),'VTX2');return b.asUint8Array();
}
export function decodeSnapshot(bytes:Uint8Array):Snapshot {
  if(bytes.length<16 || bytes.length>65536)throw new Error('Snapshot bounds');
  const b=new ByteBuffer(bytes);if(!b.__has_identifier('VTX2'))throw new Error('Snapshot ABI');
  const root=b.readInt32(0);
  // Only server-origin frames are accepted by the client. FlatBuffers JS is not a hostile-buffer verifier.
  // Never reuse this reader for arbitrary client uploads; server ingress uses the strict fixed ABI.
  const field=(table:number,n:number)=>b.__offset(table,4+n*2);
  const u32=(t:number,n:number)=>{const o=field(t,n);return o?b.readUint32(t+o):0;};
  const u16=(t:number,n:number)=>{const o=field(t,n);return o?b.readUint16(t+o):0;};
  const u8=(t:number,n:number)=>{const o=field(t,n);return o?b.readUint8(t+o):0;};
  const str=(t:number,n:number)=>{const o=field(t,n);return o?String(b.__string(t+o)):'Pilot';};
  const f32=(t:number,n:number)=>{const o=field(t,n);return o?b.readFloat32(t+o):0;};
  const players:PlayerSnapshot[]=[],po=field(root,3),to=field(root,1);
  if(po) {
    const count=b.__vector_len(root+po),start=b.__vector(root+po);
    if(count>16)throw new Error('Entity count');
    for(let i=0;i<count;i++){
      const p=b.__indirect(start+i*4),flags=u8(p,8);
      const state:MotionState={p:{x:f32(p,2),y:f32(p,3),z:f32(p,4)},v:{x:f32(p,5),y:f32(p,6),z:f32(p,7)},
        grounded:Boolean(flags&1),crouched:Boolean(flags&2),slideTicks:u16(p,9),lastButtons:u8(p,10)};
      if(![...Object.values(state.p),...Object.values(state.v)].every(Number.isFinite))throw new Error('Invalid pose');
      players.push({id:u16(p,0),ack:u32(p,1),state,yaw:f32(p,11),pitch:f32(p,12),health:u16(p,13),epoch:u32(p,14),hits:u32(p,15),character:u8(p,16),name:str(p,17),team:u8(p,18),kills:u32(p,19),assists:u32(p,20),deaths:u32(p,21),weapon:u8(p,22),magazines:[u16(p,23),u16(p,24)],reloadWeapon:u8(p,25)-1,reloadLeft:u16(p,26),respawnLeft:u16(p,27),protectedLeft:u16(p,28),shotIndex:u32(p,29)});
    }
  }
  const time=to?b.readFloat64(root+to):0;if(!Number.isFinite(time))throw new Error('Invalid time');
  return {tick:u32(root,0),time,self:u16(root,2),players,rttMs:f32(root,4),mode:u8(root,5),score1:u32(root,6),score2:u32(root,7),remaining:u16(root,8)};
}
