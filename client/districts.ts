import * as THREE from 'three';
import {getMap,type MapId} from '../shared/maps.ts';
import {toonMaterial} from './materials.ts';
function mesh(scene:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,p:number[]):THREE.Mesh {const object=new THREE.Mesh(g,m);object.position.set(p[0],p[1],p[2]);scene.add(object);return object;}
export function buildDistricts(scene:THREE.Scene,mapId:MapId):void {
  const cream=toonMaterial(0xffdfb0),ink=toonMaterial(0x294e58),amber=toonMaterial(0xebad61),glass=new THREE.MeshBasicMaterial({color:0x8ee4cf,transparent:true,opacity:0.18,depthWrite:false,side:THREE.DoubleSide});
  for(const b of getMap(mapId).boxes){
    if(b.zone==='bridge'){
      for(const z of [-1.95,1.95]){const rope=mesh(scene,new THREE.CylinderGeometry(0.04,0.04,b.h[0]*2,6),cream,[b.p[0],b.p[1]+1.1,b.p[2]+z]);rope.rotation.z=Math.PI/2;}
      for(let i=-7;i<=7;i+=2)for(const z of [-1.95,1.95])mesh(scene,new THREE.BoxGeometry(0.1,1.4,0.1),ink,[b.p[0]+i,b.p[1]+0.65,b.p[2]+z]);
    }
    if(b.zone==='freight'&&b.h[1]===0.25&&b.p[1]<1){
      for(const x of [-2.8,2.8])for(const z of [-4,4]){const wheel=mesh(scene,new THREE.CylinderGeometry(0.4,0.4,0.15,10),ink,[b.p[0]+x,0.4,b.p[2]+z]);wheel.rotation.z=Math.PI/2;}
      for(const x of [-2,2])mesh(scene,new THREE.BoxGeometry(0.07,0.03,14),ink,[b.p[0]+x,0.04,b.p[2]]);
    }
    if(b.zone==='greenhouse'&&b.h[0]>7){for(const z of [-3.6,3.6])mesh(scene,new THREE.PlaneGeometry(14,3.2),glass,[0,4.2,b.p[2]+z]);}
    if(b.zone==='temple'&&b.h[0]>7){const crystal=mesh(scene,new THREE.OctahedronGeometry(1.2),toonMaterial(0xbdb2f7),[b.p[0],2,b.p[2]]);crystal.scale.y=1.5;}
    if(b.zone==='construction'&&b.h[0]>6){mesh(scene,new THREE.BoxGeometry(0.5,9,0.5),amber,[b.p[0]+5,8.5,b.p[2]]);mesh(scene,new THREE.BoxGeometry(12,0.4,0.4),amber,[b.p[0],13,b.p[2]]);}
    if(['village','temple','freight','construction'].includes(b.zone??'')&&b.h[1]<0.6&&b.p[1]>3){
      const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#23434c';ctx.fillRect(0,0,512,128);ctx.fillStyle='#ffe3ae';ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.fillText(b.zone!.toUpperCase(),256,79);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
      mesh(scene,new THREE.PlaneGeometry(5,1.25),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}),[b.p[0],b.p[1]-0.8,b.p[2]+b.h[2]+0.01]);
    }
  }
}
