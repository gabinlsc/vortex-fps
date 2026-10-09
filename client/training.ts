import * as THREE from 'three';
import {RapierMotor,eye} from '../shared/physics.ts';
import {initialState,copyState} from '../shared/movement.ts';
import {Button,type Input,DT} from '../shared/input.ts';
import {getMap,type MapId} from '../shared/maps.ts';
import {navigation} from '../shared/navigation.ts';
import {solidQuery,traceSolids} from '../shared/arena-geometry.ts';
import {direction,rayCapsule,bodyHitbox} from '../server/lag-compensation.ts';
import {newInventory,updateInventory,consumeRound,WEAPONS,recoil,projectileStep,type Projectile} from '../shared/gunplay.ts';
import type {Snapshot} from '../shared/snapshot.ts';
import {createAvatar,animateAvatar,attachName,disposeName} from './visuals.ts';
import {AuthoritativeEffects} from './authoritative-effects.ts';
export type OfflineMode='visit'|'range'|'bots'|'course';
export class Training {
  readonly group=new THREE.Group();readonly inventory=newInventory();health=100;kills=0;shots=0;hits=0;reaction=0;checkpoint=0;courseStart=0;finished=0;
  private lastInput:Input={seq:0,yaw:0,pitch:0,buttons:0,weapon:0,phase:0};
  set effectsEnabled(value:boolean){this.effects.enabled=value;}
  private tick=0;private nextShot=0;private nextId=1;private shotIndex=0;private pathfind:ReturnType<typeof navigation>;private queries;private projectiles:Projectile[]=[];
  private targets:{mesh:THREE.Mesh;spawned:number}[]=[];private bots:{motor:RapierMotor;mesh:THREE.Group;health:number;respawn:number;path:{x:number;y:number;z:number}[];nextFire:number}[]=[];
  private effects:AuthoritativeEffects;private checkpoints=[[0,1,-44],[-18,1,-18],[0,8,0],[18,1,18],[0,1,44]];
  constructor(private world:RapierMotor['world'],private player:RapierMotor,private scene:THREE.Scene,readonly mapId:MapId,readonly mode:OfflineMode,readonly difficulty=1){
    if(mapId==='harbor')this.checkpoints[2][1]=5;scene.add(this.group);this.effects=new AuthoritativeEffects(scene);this.queries=getMap(mapId).boxes.map(solidQuery);this.pathfind=navigation(mapId);player.restore(initialState(0,1.05,-44));world.step();
    if(mode==='range')for(let i=0;i<5;i++){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,0.15,16),new THREE.MeshToonMaterial({color:0xef9d79}));mesh.rotation.x=Math.PI/2;mesh.position.set(-8+i*4,2,-56);this.group.add(mesh);this.targets.push({mesh,spawned:0});}
    if(mode==='bots')for(let i=0;i<difficulty+1;i++){const p=getMap(mapId).spawns[i+1],motor=new RapierMotor(world,initialState(...p),new Set(),mapId),mesh=createAvatar(i%3);attachName(mesh,'BOT '+(i+1),2);this.group.add(mesh);this.bots.push({motor,mesh,health:100,respawn:0,path:[],nextFire:128});}
    if(mode==='course')for(const [i,p]of this.checkpoints.entries()){const ring=new THREE.Mesh(new THREE.TorusGeometry(2,0.09,6,24),new THREE.MeshBasicMaterial({color:0x7fe8c3}));ring.position.set(p[0],p[1]+0.5,p[2]);ring.name='checkpoint-'+i;this.group.add(ring);}
  }
  step(input:Input):void {
    this.tick++;this.lastInput=input;this.player.tick(input);updateInventory(this.inventory,this.tick,input.weapon,Boolean(input.buttons&Button.Reload));
    if(this.health<=0){this.health=100;this.player.restore(initialState(0,1.05,-44));}
    if(this.player.state.p.y<-5||Math.abs(this.player.state.p.x)>63||Math.abs(this.player.state.p.z)>63)this.player.restore(initialState(0,1.05,-44));
    const time=this.tick*DT;
    if(this.mode==='course'&&!this.finished){const p=this.checkpoints[this.checkpoint],pos=this.player.state.p;if(Math.hypot(pos.x-p[0],pos.z-p[2])<2.5&&Math.abs(pos.y-p[1])<2){if(!this.checkpoint)this.courseStart=time;this.group.getObjectByName('checkpoint-'+this.checkpoint)!.visible=false;this.checkpoint++;if(this.checkpoint===this.checkpoints.length){this.finished=time-this.courseStart;const key='vortex-course-'+this.mapId,previous=Number(localStorage.getItem(key))||Infinity;localStorage.setItem(key,String(Math.min(previous,this.finished)));}}}
    for(const [i,b]of this.bots.entries()){
      if(b.health<=0){b.mesh.visible=false;if(this.tick>=b.respawn){const p=getMap(this.mapId).spawns[i+1];b.motor.restore(initialState(...p));b.health=100;}else continue;}b.mesh.visible=true;
      if(this.tick%64===i*8)b.path=this.pathfind(b.motor.state.p,this.player.state.p);const target=b.path[0]??this.player.state.p;
      const dx=target.x-b.motor.state.p.x,dz=target.z-b.motor.state.p.z,yaw=Math.atan2(-dx,-dz);if(Math.hypot(dx,dz)<1.2)b.path.shift();b.motor.tick({...input,buttons:Button.Forward|(this.tick%96<8?Button.Jump:0),yaw,pitch:0});
      const p=b.motor.state.p;b.mesh.position.set(p.x,p.y,p.z);b.mesh.rotation.y=yaw;animateAvatar(b.mesh,time,8);
      if(this.tick>=b.nextFire){b.nextFire=this.tick+Math.floor(160/this.difficulty);const from=eye(b.motor.state),to=eye(this.player.state),length=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z),d={x:(to.x-from.x)/length,y:(to.y-from.y)/length,z:(to.z-from.z)/length};
        if(length>0&&traceSolids(from,d,this.queries,length)>=length&&this.tick%(5-this.difficulty)!==0){this.health=Math.max(0,this.health-8*this.difficulty);this.effects.shot({type:'shot',id:0,owner:i+2,weapon:0,from,to},time);}}
    }
    this.world.step();
    if(input.buttons&Button.Fire&&this.tick>=this.nextShot&&consumeRound(this.inventory,input.weapon)){this.nextShot=this.tick+WEAPONS[input.weapon].cooldownTicks;this.shots++;const r=recoil(this.shotIndex++),from=eye(this.player.state),d=direction(input.yaw+r.yaw,input.pitch+r.pitch);
      if(input.weapon===1)this.projectiles.push({id:this.nextId++,owner:1,ownerEpoch:0,p:{...from},v:{x:d.x*40,y:d.y*40,z:d.z*40},damage:35,life:384});else this.cast(from,d,200,100,time);
    }
    for(let i=this.projectiles.length-1;i>=0;i--){const q=this.projectiles[i],s=projectileStep(q,DT);if(this.cast(s.from,s.direction,s.distance,q.damage,time)||q.life<=0)this.projectiles.splice(i,1);}
    this.effects.projectiles(this.projectiles.map(q=>({id:q.id!,p:q.p})));this.effects.update(DT,time);
  }
  private cast(from:{x:number;y:number;z:number},d:{x:number;y:number;z:number},range:number,damage:number,time:number):boolean {
    let distance=traceSolids(from,d,this.queries,range),hit:typeof this.bots[number]|undefined,target:typeof this.targets[number]|undefined;
    for(const b of this.bots){if(b.health<=0)continue;const t=rayCapsule(from,d,bodyHitbox(0,0,b.motor.state.p,false));if(t!==null&&t<distance){distance=t;hit=b;target=undefined;}}
    for(const t of this.targets){const p=t.mesh.position,distanceHit=rayCapsule(from,d,{id:0,epoch:0,alive:true,center:{x:p.x,y:p.y,z:p.z},radius:0.6,half:0.1});if(distanceHit!==null&&distanceHit<distance){distance=distanceHit;target=t;hit=undefined;}}
    const to={x:from.x+d.x*distance,y:from.y+d.y*distance,z:from.z+d.z*distance};if(range>10)this.effects.shot({type:'shot',id:0,owner:1,weapon:0,from,to},time);
    if(hit||target){this.hits++;this.effects.impact(to,'flesh',time);if(hit){hit.health-=damage;if(hit.health<=0){this.kills++;hit.respawn=this.tick+256;}}if(target){this.reaction=(time-target.spawned)*1000;target.spawned=time;target.mesh.position.x=-8+(this.hits*7%17);target.mesh.position.y=1.3+(this.hits%3)*0.6;}return true;}
    if(distance<range){this.effects.impact(to,'stone',time);return true;}return false;
  }
  snapshot():Snapshot {return {tick:this.tick,time:this.tick*DT,self:1,rttMs:0,mode:0,remaining:600,players:[{id:1,ack:0,state:copyState(this.player.state),yaw:this.lastInput.yaw,pitch:this.lastInput.pitch,weapon:this.lastInput.weapon,health:this.health,epoch:0,hits:this.hits,name:'Entraînement',kills:this.kills,magazines:this.inventory.magazines,reloadLeft:Math.max(0,this.inventory.reloadUntil-this.tick),reloadWeapon:this.inventory.reloadWeapon,shotIndex:this.shotIndex},...this.bots.map((b,i)=>({id:i+2,ack:0,state:copyState(b.motor.state),yaw:b.mesh.rotation.y,pitch:0,health:Math.max(0,b.health),epoch:0,hits:0,name:'BOT '+(i+1),character:i%3}))]};}
  label():string {if(this.mode==='range')return `${this.hits} touches / ${this.shots} tirs · réaction ${Math.round(this.reaction)} ms`;if(this.mode==='course')return this.finished?`Arrivée ${this.finished.toFixed(2)} s · record ${Number(localStorage.getItem('vortex-course-'+this.mapId)).toFixed(2)} s`:`Porte ${this.checkpoint+1}/5 · ${this.courseStart?(this.tick*DT-this.courseStart).toFixed(2):'0.00'} s`;return this.mode==='bots'?`${this.kills} éliminations · difficulté ${this.difficulty}`:'Visite libre · Échap : menu';}
  dispose():void {this.effects.clear();for(const b of this.bots){b.motor.dispose();disposeName(b.mesh);}this.group.traverse(o=>{if(o instanceof THREE.Mesh&&this.targets.some(t=>t.mesh===o)){o.geometry.dispose();(o.material as THREE.Material).dispose();}});for(const object of this.group.children)if(object instanceof THREE.Mesh&&!this.targets.some(t=>t.mesh===object)){object.geometry.dispose();(object.material as THREE.Material).dispose();}this.scene.remove(this.group);}
}
