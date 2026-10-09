import type {Snapshot} from '../shared/snapshot.ts';
import {MAP_VERSION} from '../shared/map.ts';
import {validateMap,type MapId} from '../shared/maps.ts';
export interface Replay {version:1;mapVersion:string;mapId:MapId;frames:Snapshot[]}
export class Recorder {
  private frames:Snapshot[]=[];private last=-Infinity;
  record(s:Snapshot):void {if(s.time-this.last<0.095&&s.time>=this.last)return;this.last=s.time;this.frames.push(structuredClone(s));if(this.frames.length>3000)this.frames.shift();}
  reset():void{this.frames=[];this.last=-Infinity;}
  export(mapId:MapId):Replay{return {version:1,mapVersion:MAP_VERSION,mapId,frames:this.frames};}
  get count():number{return this.frames.length;}
}
export function parseReplay(text:string):Replay {
  if(text.length>12_000_000)throw new Error('Relecture trop volumineuse (12 Mo max).');const value=JSON.parse(text);
  if(value.version!==1||value.mapVersion!==MAP_VERSION||!Array.isArray(value.frames)||!value.frames.length||value.frames.length>3000)throw new Error('Version ou durée de relecture incompatible.');
  let last=-Infinity;
  for(const s of value.frames){if(!Number.isFinite(s.time)||s.time<last||!Array.isArray(s.players)||s.players.length>16)throw new Error('Chronologie invalide.');last=s.time;for(const p of s.players){if(!Number.isInteger(p.id)||p.id<0||p.id>65535||![p.yaw,p.pitch,p.health,p.state?.p?.x,p.state?.p?.y,p.state?.p?.z].every(Number.isFinite)||Math.abs(p.state.p.x)>200||Math.abs(p.state.p.z)>200||Math.abs(p.state.p.y)>200)throw new Error('Pose invalide.');}}
  return {version:1,mapVersion:MAP_VERSION,mapId:validateMap(value.mapId),frames:value.frames};
}
export function download(data:Blob,name:string):void {const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export class AdaptiveResolution {
  private average=16;private samples=0;private window=0;scale=1;
  step(ms:number,time:number):number {if(!Number.isFinite(ms)||ms<=0||ms>100)return this.scale;this.average=this.average*0.96+ms*0.04;this.samples++;if(this.samples>90&&time-this.window>3000){if(this.average>24)this.scale=Math.max(0.5,this.scale-0.1);else if(this.average<15)this.scale=Math.min(1,this.scale+0.05);this.window=time;this.samples=0;}return this.scale;}
  reset():void{this.average=16;this.samples=0;this.window=0;this.scale=1;}
}
