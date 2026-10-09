import {batchStatic} from './static-batch.ts';
import {buildBiomes,illustratedStone} from './biomes.ts';
import {buildDistricts} from './districts.ts';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BOXES,ROUTES,SPAWNS,type ArenaBox,type SurfaceKind} from '../shared/map.ts';
import {getMap,type MapId} from '../shared/maps.ts';
import {solidMesh} from '../shared/arena-geometry.ts';
import {buildLandscape,animateLandscape} from './landscape.ts';
import {CEL_GRADIENT,paintedMaterial,toonMaterial,type PaintedSurface} from './materials.ts';
const cube=new THREE.BoxGeometry(1,1,1);
const gradient=CEL_GRADIENT;
const palette={sand:0xebcd99,stone:0xca8d66,cream:0xf5e5bd,ink:0x263c52,metal:0x497681,teal:0x59cbb9,azure:0x5dbeda,ember:0xef9d5d};
const material=toonMaterial;
const materials={ink:material(palette.ink),cream:material(palette.cream),teal:material(palette.teal),metal:material(palette.metal),azure:material(palette.azure),ember:material(palette.ember)};
const glow=new THREE.MeshBasicMaterial({color:0x98f5dd});
function box(parent:THREE.Object3D,m:THREE.Material,p:readonly number[],s:readonly number[]):THREE.Mesh{
  const mesh=new THREE.Mesh(cube,m);mesh.position.set(p[0],p[1],p[2]);mesh.scale.set(s[0],s[1],s[2]);parent.add(mesh);return mesh;
}
export function arenaGeometry(solid:ArenaBox):THREE.BufferGeometry {
  const {vertices:v,indices:ix}=solidMesh(solid),positions:number[]=[],uv:number[]=[],colors:number[]=[];
  const scale=solid.kind==='ground'?14:solid.kind==='stone'?(solid.zone==='cliff'?18:10):solid.zone==='gallery'?3:6;
  for(let face=0;face<ix.length;face+=3){
    const a=ix[face]*3,b=ix[face+1]*3,c=ix[face+2]*3;
    const u=new THREE.Vector3(v[b]-v[a],v[b+1]-v[a+1],v[b+2]-v[a+2]),w=new THREE.Vector3(v[c]-v[a],v[c+1]-v[a+1],v[c+2]-v[a+2]);u.cross(w).normalize();
    const axes=Math.abs(u.y)>0.65?[0,2]:Math.abs(u.x)>Math.abs(u.z)?[2,1]:[0,1];
    const shade=solid.shape==='rock'?0.91+(Math.floor(face/6)%3)*0.055:1;
    for(let k=0;k<3;k++){const i=ix[face+k]*3;positions.push(v[i],v[i+1],v[i+2]);if(solid.kind==='crate')uv.push((v[i+axes[0]]/solid.h[axes[0]]+1)/2,(v[i+axes[1]]/solid.h[axes[1]]+1)/2);
      else uv.push(v[i+axes[0]]/scale,v[i+axes[1]]/scale);colors.push(shade,shade,shade);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  geometry.rotateY(solid.yaw??0);geometry.translate(...solid.p);return geometry;
}
function label(parent:THREE.Object3D,text:string,p:readonly number[],yaw=0,width=5):void {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#263c52';ctx.fillRect(0,0,512,128);ctx.fillStyle='#f5e5bd';ctx.font='bold 40px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,79);ctx.strokeStyle='#73c9be';ctx.lineWidth=5;ctx.strokeRect(8,8,496,112);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:t}));mesh.position.set(p[0],p[1],p[2]);mesh.rotation.y=yaw;parent.add(mesh);
}
function path(points:readonly (readonly [number,number])[],width:number,m:THREE.Material,y=0.025):THREE.Mesh {
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,y,z))),position:number[]=[],uv:number[]=[];
  for(let i=0;i<80;i++){
    const p=curve.getPoint(i/79),t=curve.getTangent(i/79),n=new THREE.Vector3(t.z,0,-t.x).multiplyScalar(width/2);
    position.push(p.x-n.x,y,p.z-n.z,p.x+n.x,y,p.z+n.z);uv.push(0,i/5,1,i/5);
  }
  const index:number[]=[];for(let i=0;i<79;i++)index.push(i*2,i*2+2,i*2+1,i*2+1,i*2+2,i*2+3);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();return new THREE.Mesh(geometry,m);
}
export function buildArena(scene:THREE.Scene,mapId:MapId='canyon'):void {
  const {boxes:BOXES,routes:ROUTES,spawns:SPAWNS}=getMap(mapId);scene.userData.mapId=mapId;
  scene.background=new THREE.Color(0xb8d9d7);scene.fog=new THREE.Fog(0xc8d5c6,100,250);
  scene.add(new THREE.HemisphereLight(0xfff3df,0x626e69,1.05));
  const sun=new THREE.DirectionalLight(0xffe2b0,2.2);sun.name='arena-sun';sun.position.set(-45,80,-35);scene.add(sun);
  const groups=new Map<PaintedSurface,ArenaBox[]>();
  for(const solid of BOXES){
    const seed=Math.round(Math.abs(solid.p[0]*17+solid.p[2]*11));
    const surface:PaintedSurface=solid.kind==='ground'?'sand':solid.kind==='crate'?'cargo':solid.kind==='stone'?(solid.zone==='tree'?'bark':seed%5===0?'rose-stone':seed%5===1?'ochre-stone':'sandstone'):solid.zone==='gallery'?'deck':'metal';
    const batch=groups.get(surface)??[];batch.push(solid);groups.set(surface,batch);
  }
  for(const [surface,batch]of groups){
    const parts=batch.map(arenaGeometry),geometry=mergeGeometries(parts)!;for(const part of parts)part.dispose();
    const mesh=new THREE.Mesh(geometry,surface==='sandstone'?illustratedStone():paintedMaterial(surface,true));mesh.name='arena-'+surface;mesh.castShadow=surface!=='sand';mesh.receiveShadow=true;scene.add(mesh);
  }
  const routeMaterial=new THREE.MeshToonMaterial({color:0xefd4a1,gradientMap:gradient});
  for(const points of ROUTES)scene.add(path(points,5.5,routeMaterial));
  const plaza=new THREE.Mesh(new THREE.CircleGeometry(16,48),routeMaterial);plaza.rotation.x=-Math.PI/2;plaza.position.y=0.032;scene.add(plaza);
  if(mapId==='canyon'){
  // Ceramic facade plates and graphite seams lie flush on solid walls.
  for(const sign of [-1,1]){
    for(const x of [-7,7]){
      box(scene,paintedMaterial('ceramic'),[x,2.8,10.61*sign],[5.6,4.5,0.045]);
      box(scene,materials.teal,[x,1.15,10.65*sign],[5.6,0.55,0.045]);
      box(scene,materials.ink,[x,0.35,10.66*sign],[5.8,0.45,0.05]);
    }
    for(const z of [-7,7]){
      box(scene,paintedMaterial('ceramic'),[10.61*sign,2.8,z],[0.045,4.5,5.6]);
      box(scene,materials.teal,[10.65*sign,1.15,z],[0.045,0.55,5.6]);
    }
    box(scene,materials.ink,[0,6.75,10.65*sign],[21.4,0.45,0.18]);
    box(scene,materials.cream,[0,5.65,10.66*sign],[21.4,0.35,0.18]);
    box(scene,glow,[0,5.38,10.71*sign],[6.4,0.08,0.05]);
    label(scene,'RIFT / REACTOR',[0,4.75,10.73*sign],sign>0?0:Math.PI,6);
    // Edge strips follow the exact slopes of the shared ramps.
    for(const ramp of BOXES.filter(b=>b.shape==='ramp'&&Math.sign(b.p[0])===sign)){
      const group=new THREE.Group();group.position.set(...ramp.p);group.rotation.y=ramp.yaw??0;
      const slope=ramp.h[1]/ramp.h[0],length=Math.hypot(ramp.h[0]*2,ramp.h[1]*2);
      for(const side of [-1,1]){const trim=box(group,sign<0?materials.azure:materials.ember,[0,0.035,side*(ramp.h[2]-0.12)],[length,0.045,0.1]);trim.rotation.z=-Math.atan(slope);}
      scene.add(group);
    }
    const accent=sign<0?materials.azure:materials.ember;
    box(scene,paintedMaterial('deck'),[0,2.425,36*sign],[15.7,0.035,7.7]);
    label(scene,sign<0?'AZURE / GARDEN':'EMBER / GARDEN',[0,1.4,40.035*sign],sign>0?0:Math.PI,6);
    for(const x of [-7.7,7.7])box(scene,materials.cream,[x,2.65,36*sign],[0.12,0.4,7.5]);
    label(scene,sign<0?'01 / CRYSTAL GROTTO':'02 / SUN GROTTO',[43*sign,4.25,5.55*sign],sign>0?Math.PI:0,6.5);
    // Gallery side trims, only low lips; they never pretend to block bullets.
    for(const z of [15.08,20.92])box(scene,accent,[26*sign,2.42,z*sign],[21.8,0.045,0.08]);
    for(let i=0;i<5;i++){
      const crystal=new THREE.Mesh(new THREE.ConeGeometry(0.22+i%2*0.12,0.9+i%3*0.35,5),material(sign>0?0x72d8cd:0xba9ded));
      crystal.position.set((37+i%2*1.4)*sign,0.45+i%3*0.2,(11+i*2.8)*sign);crystal.rotation.z=(i%3-1)*0.22;scene.add(crystal);
    }
  }
  const core=new THREE.Group();core.name='rift-core';core.position.set(0,9.2,0);
  const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(1.1),material(0x7de3c9));crystal.scale.y=1.6;core.add(crystal);
  const orbit=new THREE.Mesh(new THREE.TorusGeometry(2.1,0.08,8,64),glow);orbit.rotation.x=0.7;core.add(orbit);scene.add(core);
  }
  for(const [x,,z] of SPAWNS){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,0.04,5,32),z<0?materials.azure:materials.ember);ring.rotation.x=-Math.PI/2;ring.position.set(x,0.04,z);scene.add(ring);}
  // Far mesas extend the playable canyon's silhouette.
  const mountainMaterial=material(0xb39286);
  for(let i=0;i<(mapId==='canyon'?20:0);i++){
    const angle=i/20*Math.PI*2,height=20+i%5*5,mountain=new THREE.Mesh(new THREE.CylinderGeometry(6+i%4,16,height,6),mountainMaterial);
    mountain.position.set(Math.cos(angle)*130,height/2-3,Math.sin(angle)*130);scene.add(mountain);
  }
  buildLandscape(scene,BOXES,ROUTES);buildDistricts(scene,mapId);buildBiomes(scene,mapId);batchStatic(scene);
}
export function animateArena(scene:THREE.Scene,time:number):void {
  animateLandscape(scene,time);
  const core=scene.getObjectByName('rift-core');if(core){core.rotation.y=time*0.3;core.position.y=9.2+Math.sin(time*1.4)*0.12;}
}

export function clearArena(scene:THREE.Scene):void {const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();scene.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}if(o instanceof THREE.InstancedMesh)o.dispose();}if(o instanceof THREE.Sprite){materials.add(o.material);if(o.material.map)textures.add(o.material.map);}});for(const t of textures)t.dispose();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();for(const o of [...scene.children])scene.remove(o);}
