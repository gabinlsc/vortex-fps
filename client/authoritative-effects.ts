import * as THREE from 'three';
export interface ShotEvent {type:'shot';id:number;owner:number;weapon:number;from:{x:number;y:number;z:number};to:{x:number;y:number;z:number}}
export class AuthoritativeEffects {
  private beams:{mesh:THREE.Mesh;until:number}[]=[];private bolts=new Map<number,THREE.Mesh>();private particles:{m:THREE.Mesh;v:THREE.Vector3;until:number}[]=[];enabled=true;
  constructor(private scene:THREE.Scene){}
  shot(e:ShotEvent,time:number):void {
    if(!this.enabled||e.weapon!==0)return;while(this.beams.length>=32)this.remove(this.beams.shift()!.mesh);
    const a=new THREE.Vector3(e.from.x,e.from.y,e.from.z),b=new THREE.Vector3(e.to.x,e.to.y,e.to.z),delta=b.clone().sub(a),length=delta.length();if(length<0.001)return;
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.023,0.023,length,5),new THREE.MeshBasicMaterial({color:0x99fff0,transparent:true,opacity:0.9,depthWrite:false}));mesh.position.copy(a).add(b).multiplyScalar(0.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());this.scene.add(mesh);this.beams.push({mesh,until:time+0.14});
  }
  projectiles(rows:{id:number;p:{x:number;y:number;z:number}}[]):void {
    const ids=new Set(rows.map(r=>r.id));for(const [id,m]of this.bolts)if(!ids.has(id)||!this.enabled){this.remove(m);this.bolts.delete(id);}
    if(!this.enabled)return;for(const row of rows){let m=this.bolts.get(row.id);if(!m){m=new THREE.Mesh(new THREE.OctahedronGeometry(0.12),new THREE.MeshBasicMaterial({color:0xffd68d}));this.scene.add(m);this.bolts.set(row.id,m);}m.position.set(row.p.x,row.p.y,row.p.z);}
  }
  impact(p:{x:number;y:number;z:number},surface:string,time:number):void {
    if(!this.enabled)return;const color=surface==='metal'?0xffd58d:surface==='flesh'?0xff96ac:0xceae85;
    for(let i=0;i<8;i++){while(this.particles.length>=128)this.remove(this.particles.shift()!.m);const m=new THREE.Mesh(new THREE.IcosahedronGeometry(surface==='metal'?0.035:0.065,0),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.8,depthWrite:false}));m.position.set(p.x,p.y,p.z);this.scene.add(m);this.particles.push({m,v:new THREE.Vector3(Math.sin(i*2.4)*2,1+i%3,Math.cos(i*2.4)*2),until:time+0.5});}
    while(this.beams.length>=32)this.remove(this.beams.shift()!.mesh);const mark=new THREE.Mesh(new THREE.SphereGeometry(0.1,6,4),new THREE.MeshBasicMaterial({color:surface==='metal'?0x655d57:0x80624d}));mark.position.set(p.x,p.y,p.z);this.scene.add(mark);this.beams.push({mesh:mark,until:time+3});
  }
  update(dt:number,time:number):void {
    for(let i=this.beams.length-1;i>=0;i--)if(!this.enabled||time>this.beams[i].until)this.remove(this.beams.splice(i,1)[0].mesh);
    for(let i=this.particles.length-1;i>=0;i--){const s=this.particles[i];if(!this.enabled||time>s.until){this.remove(s.m);this.particles.splice(i,1);}else{s.v.y-=dt*8;s.m.position.addScaledVector(s.v,dt);(s.m.material as THREE.MeshBasicMaterial).opacity=Math.max(0,(s.until-time)*1.6);}}
  }
  clear():void {for(const b of this.beams)this.remove(b.mesh);for(const b of this.particles)this.remove(b.m);for(const b of this.bolts.values())this.remove(b);this.beams=[];this.particles=[];this.bolts.clear();}
  private remove(m:THREE.Mesh):void{this.scene.remove(m);m.geometry.dispose();(m.material as THREE.Material).dispose();}
}
