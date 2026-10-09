import type {Snapshot} from '../shared/snapshot.ts';
import {MAP_VERSION} from '../shared/map.ts';
import {validateMap,type MapId} from '../shared/maps.ts';
export interface ReplayEvent {time:number;data:Record<string,any>}
export interface Replay {version:1;mapVersion:string;mapId:MapId;frames:Snapshot[];events:ReplayEvent[]}
export class Recorder {
  private frames:Snapshot[]=[];private events:ReplayEvent[]=[];private last=-Infinity;private lastProjectile=-Infinity;
  record(s:Snapshot):void {if(s.time-this.last<0.09&&s.time>=this.last)return;this.last=s.time;this.frames.push(structuredClone(s));if(this.frames.length>3000)this.frames.shift();}
  event(data:Record<string,any>):void {if(!['shot','impact','projectiles','objectives','ping'].includes(data.type)||!Number.isFinite(data.time))return;if(data.type==='projectiles'){if(data.time-this.lastProjectile<0.09)return;this.lastProjectile=data.time;}this.events.push({time:data.time,data:structuredClone(data)});if(this.events.length>8192)this.events.shift();}
  reset():void{this.frames=[];this.events=[];this.last=this.lastProjectile=-Infinity;}
  export(mapId:MapId):Replay{let frames=this.frames,events=this.events.filter(e=>e.time>=(frames[0]?.time??Infinity));let out:Replay={version:1,mapVersion:MAP_VERSION,mapId,frames,events};while(new TextEncoder().encode(JSON.stringify(out)).length>10_000_000&&frames.length>1){frames=frames.slice(Math.max(1,Math.floor(frames.length*0.2)));events=events.filter(e=>e.time>=frames[0].time);out={...out,frames,events};}return out;}
  get count():number{return this.frames.length;}
}
export function parseReplay(text:string):Replay {
  if(text.length>12_000_000)throw new Error('Relecture trop volumineuse (12 Mo max).');const value=JSON.parse(text);
  if(value.version!==1||value.mapVersion!==MAP_VERSION||!Array.isArray(value.frames)||!value.frames.length||value.frames.length>3000)throw new Error('Version ou durée de relecture incompatible.');
  let last=-Infinity;
  for(const s of value.frames){if(!Number.isFinite(s.time)||s.time<last||!Array.isArray(s.players)||s.players.length>16)throw new Error('Chronologie invalide.');last=s.time;for(const p of s.players){if(!Number.isInteger(p.id)||p.id<0||p.id>65535||![p.yaw,p.pitch,p.health,p.state?.p?.x,p.state?.p?.y,p.state?.p?.z].every(Number.isFinite)||Math.abs(p.state.p.x)>200||Math.abs(p.state.p.z)>200||Math.abs(p.state.p.y)>200)throw new Error('Pose invalide.');}}
  const events:ReplayEvent[]=value.events??[];if(!Array.isArray(events)||events.length>8192)throw new Error('Événements invalides.');last=-Infinity;
  const point=(p:any)=>p&&[p.x,p.y,p.z].every((n:any)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=250);
  for(const e of events){if(!Number.isFinite(e.time)||e.time<last||!e.data)throw new Error('Chronologie des événements invalide.');last=e.time;const d=e.data;
    if(d.type==='shot'){if(!point(d.from)||!point(d.to)||![0,1].includes(d.weapon))throw new Error('Tir invalide.');}
    else if(d.type==='impact'||d.type==='ping'){if(!point(d.p))throw new Error('Impact invalide.');}
    else if(d.type==='projectiles'){if(!Array.isArray(d.rows)||d.rows.length>256||d.rows.some((q:any)=>!Number.isInteger(q.id)||!point(q.p)))throw new Error('Projectiles invalides.');}
    else if(d.type==='objectives'){const s=d.state;if(!s||!Array.isArray(s.zones)||s.zones.length!==3||!Array.isArray(s.flags)||s.flags.length!==2||!Array.isArray(s.pickups)||s.pickups.length!==4||s.zones.some((q:any)=>!['A','B','C'].includes(q.name)||!point(q.p))||s.flags.some((q:any)=>![1,2].includes(q.team)||!point(q.p))||s.pickups.some((q:any)=>![0,1,2,3].includes(q.id)||!point(q.p)))throw new Error('Objectifs invalides.');}
    else throw new Error('Événement inconnu.');
  }
  return {version:1,mapVersion:MAP_VERSION,mapId:validateMap(value.mapId),frames:value.frames,events};
}
export function download(data:Blob,name:string):void {const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export class AdaptiveResolution {
  private average=16;private samples=0;private window=0;scale=1;
  step(ms:number,time:number):number {if(!Number.isFinite(ms)||ms<=0||ms>100)return this.scale;this.average=this.average*0.96+ms*0.04;this.samples++;if(this.samples>90&&time-this.window>3000){if(this.average>24)this.scale=Math.max(0.5,this.scale-0.1);else if(this.average<15)this.scale=Math.min(1,this.scale+0.05);this.window=time;this.samples=0;}return this.scale;}
  reset():void{this.average=16;this.samples=0;this.window=0;this.scale=1;}
}
