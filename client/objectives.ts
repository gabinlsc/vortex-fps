import * as THREE from 'three';
import type {Objectives} from '../shared/objectives.ts';
import {devices} from '../shared/traversal.ts';
import type {MapId} from '../shared/maps.ts';
export class ObjectiveView {
  readonly group=new THREE.Group();private markers=new Map<string,THREE.Mesh>();private pings:{mesh:THREE.Mesh;expires:number}[]=[];
  constructor(scene:THREE.Scene,mapId:MapId){scene.add(this.group);const d=devices(mapId);for(const pad of d.pads){const m=this.marker('pad'+pad.x,0x9ee38f,new THREE.CylinderGeometry(1.2,1.2,0.06,16));m.position.set(pad.x,0.08,pad.z);}for(const portal of d.portals){const m=this.marker('portal'+portal.x,0xae96ec,new THREE.TorusGeometry(1,0.14,8,24));m.position.set(portal.x,1.2,portal.z);}}
  private marker(id:string,color:number,g:THREE.BufferGeometry):THREE.Mesh {let m=this.markers.get(id);if(!m){m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.8}));this.group.add(m);this.markers.set(id,m);}else g.dispose();return m;}
  update(s:Objectives,mode:string,tick:number):void {
    for(const z of s.zones){const m=this.marker('zone'+z.name,0xe2d49c,new THREE.RingGeometry(3.8,4,32));m.rotation.x=-Math.PI/2;m.position.set(z.p.x,0.09,z.p.z);m.visible=mode==='domination';(m.material as THREE.MeshBasicMaterial).color.setHex(z.owner===1?0x73d7ec:z.owner===2?0xffb36d:0xe2d49c);}
    for(const f of s.flags){const m=this.marker('flag'+f.team,f.team===1?0x73d7ec:0xffb36d,new THREE.ConeGeometry(0.65,1.6,4));m.position.set(f.p.x,f.p.y+0.5,f.p.z);m.visible=mode==='ctf';}
    for(const p of s.pickups){const m=this.marker('pickup'+p.id,p.kind==='health'?0x87e6a7:p.kind==='rail'?0x70d8ed:0xffbd6e,new THREE.OctahedronGeometry(0.5));m.position.set(p.p.x,1,p.p.z);m.visible=tick>=p.readyAt;}
  }
  ping(p:{x:number;y:number;z:number},expires:number):void {if(this.pings.length>=8){const old=this.pings.shift()!;this.group.remove(old.mesh);old.mesh.geometry.dispose();(old.mesh.material as THREE.Material).dispose();}const m=new THREE.Mesh(new THREE.OctahedronGeometry(0.5),new THREE.MeshBasicMaterial({color:0xffe195,depthTest:false}));m.position.set(p.x,p.y+1,p.z);this.group.add(m);this.pings.push({mesh:m,expires});}
  animate(time:number):void {for(const [key,m]of this.markers)if(key.startsWith('pickup'))m.rotation.y=time;for(let i=this.pings.length-1;i>=0;i--)if(time>this.pings[i].expires){const m=this.pings.splice(i,1)[0].mesh;this.group.remove(m);m.geometry.dispose();(m.material as THREE.Material).dispose();}}
}
