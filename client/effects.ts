import * as THREE from 'three';
import {BOXES} from '../shared/map.ts';
import {solidQuery,traceSolids} from '../shared/arena-geometry.ts';
import {recoil} from '../shared/gunplay.ts';
import type {PlayerSnapshot} from '../shared/snapshot.ts';

interface Streak {mesh:THREE.Group;core:THREE.Mesh;glow:THREE.Mesh;head:THREE.Mesh;origin:THREE.Vector3;direction:THREE.Vector3;age:number;distance:number;weapon:number;active:boolean;impact:boolean}
interface Spark {mesh:THREE.Mesh;velocity:THREE.Vector3;age:number;active:boolean}
const up=new THREE.Vector3(0,1,0);
export class CombatEffects {
  private streaks:Streak[]=[];private cursor=0;
  private sparks:Spark[]=[];private sparkCursor=0;
  private walls=BOXES.map(solidQuery);
  private point=new THREE.Vector3();
  enabled=true;
  constructor(scene:THREE.Scene){
    const beam=new THREE.CylinderGeometry(1,1,1,6),headGeometry=new THREE.OctahedronGeometry(0.11),sparkGeometry=new THREE.BoxGeometry(0.045,0.045,0.045);
    for(let i=0;i<64;i++){
      const mesh=new THREE.Group(),core=new THREE.Mesh(beam,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false}));
      const glow=new THREE.Mesh(beam,new THREE.MeshBasicMaterial({color:0x72ffeb,transparent:true,opacity:0.25,depthWrite:false,blending:THREE.AdditiveBlending}));
      const head=new THREE.Mesh(headGeometry,new THREE.MeshBasicMaterial({color:0xffdf84}));mesh.add(glow,core,head);mesh.visible=false;scene.add(mesh);
      this.streaks.push({mesh,core,glow,head,origin:new THREE.Vector3(),direction:new THREE.Vector3(),age:0,distance:0,weapon:0,active:false,impact:false});
    }
    for(let i=0;i<96;i++){const mesh=new THREE.Mesh(sparkGeometry,new THREE.MeshBasicMaterial({color:0xffdc93,transparent:true,depthWrite:false}));mesh.visible=false;scene.add(mesh);this.sparks.push({mesh,velocity:new THREE.Vector3(),age:0,active:false});}
  }
  shot(p:PlayerSnapshot,local=false):void {
    if(!this.enabled)return;
    const s=this.streaks[this.cursor++%this.streaks.length],pattern=recoil(Math.max(0,(p.shotIndex??1)-1));
    const pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,p.pitch+pattern.pitch)),yaw=p.yaw+pattern.yaw;
    s.origin.set(p.state.p.x,p.state.p.y+(p.state.crouched?0.35:0.65),p.state.p.z);
    s.direction.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    s.distance=traceSolids(s.origin,s.direction,this.walls,200);s.impact=s.distance<200;
    if(local&&s.distance>0.5){
      // Start the cosmetic streak beside the view weapon, converging on the
      // eye ray's wall contact. Damage still uses the server's original ray.
      this.point.copy(s.origin).addScaledVector(s.direction,s.distance);
      s.origin.x+=Math.cos(yaw)*0.25;s.origin.z-=Math.sin(yaw)*0.25;s.origin.y-=0.18;
      s.direction.copy(this.point).sub(s.origin);s.distance=s.direction.length();s.direction.normalize();
      s.distance=traceSolids(s.origin,s.direction,this.walls,s.distance);
    }
    s.weapon=p.weapon??0;s.age=0;s.active=true;s.mesh.visible=true;
    (s.glow.material as THREE.MeshBasicMaterial).color.setHex(s.weapon?0xffbd65:0x65ffea);
    s.mesh.quaternion.setFromUnitVectors(up,s.direction);
    // Wall impact is cosmetic. Hit markers use only the server's hits counter.
    if(!s.weapon&&s.impact)this.impact(s.origin.clone().addScaledVector(s.direction,s.distance));
  }
  private impact(position:THREE.Vector3):void {
    for(let i=0;i<6;i++){
      const s=this.sparks[this.sparkCursor++%this.sparks.length];s.active=true;s.age=0;s.mesh.visible=true;s.mesh.position.copy(position);
      s.velocity.set(Math.sin(i*2.4)*2,1.4+i%3,Math.cos(i*2.4)*2);s.mesh.scale.setScalar(1);
    }
  }
  update(dt:number):void {
    for(const s of this.streaks){if(!s.active)continue;s.age+=dt;
      const travel=s.weapon?s.age*40:s.distance;
      if(s.age>(s.weapon?3:0.18)||s.weapon&&travel>=s.distance){
        if(s.weapon&&s.impact&&s.distance<=120)this.impact(s.origin.clone().addScaledVector(s.direction,s.distance));
        s.active=false;s.mesh.visible=false;continue;
      }
      const end=Math.min(s.distance,travel),start=s.weapon?Math.min(end,Math.max(0.45,end-2.8)):Math.min(0.45,end),length=Math.max(0.001,end-start);
      s.mesh.position.copy(s.origin).addScaledVector(s.direction,(start+end)/2);
      s.core.scale.set(s.weapon?0.028:0.016,length,s.weapon?0.028:0.016);
      s.glow.scale.set(s.weapon?0.09:0.065,length,s.weapon?0.09:0.065);
      s.head.visible=Boolean(s.weapon);s.head.position.y=length/2;
      (s.core.material as THREE.MeshBasicMaterial).opacity=s.weapon?1:Math.max(0,1-s.age/0.18);
      (s.glow.material as THREE.MeshBasicMaterial).opacity=s.weapon?0.3:0.32*(1-s.age/0.18);
    }
    for(const s of this.sparks){if(!s.active)continue;s.age+=dt;if(s.age>0.35){s.active=false;s.mesh.visible=false;continue;}s.velocity.y-=dt*9;s.mesh.position.addScaledVector(s.velocity,dt);(s.mesh.material as THREE.MeshBasicMaterial).opacity=1-s.age/0.35;}
  }
  clear():void{for(const s of this.streaks){s.active=false;s.mesh.visible=false;}for(const s of this.sparks){s.active=false;s.mesh.visible=false;}}
}

export class GameAudio {
  private context:AudioContext|undefined;volume=0.25;
  unlock():void{try{this.context??=new AudioContext();void this.context.resume().catch(()=>{});}catch{}}
  play(kind:'rail'|'pulse'|'hit'|'hurt'):void {
    const ctx=this.context;if(!ctx||ctx.state!=='running'||this.volume<=0)return;
    const oscillator=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
    const values={rail:[800,90,0.14],pulse:[330,110,0.09],hit:[1100,1600,0.065],hurt:[130,50,0.16]}[kind];
    oscillator.type=kind==='hit'?'sine':'triangle';oscillator.frequency.setValueAtTime(values[0],now);oscillator.frequency.exponentialRampToValueAtTime(values[1],now+values[2]);
    gain.gain.setValueAtTime(this.volume*0.17,now);gain.gain.exponentialRampToValueAtTime(0.001,now+values[2]);
    oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(now);oscillator.stop(now+values[2]);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
}
