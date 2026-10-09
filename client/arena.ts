import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BOXES,ROUTES,SPAWNS,type ArenaBox,type SurfaceKind} from '../shared/map.ts';
import {solidMesh} from '../shared/arena-geometry.ts';
const cube=new THREE.BoxGeometry(1,1,1);
const gradient=new THREE.DataTexture(new Uint8Array([110,180,255]),3,1,THREE.RedFormat);
gradient.minFilter=gradient.magFilter=THREE.NearestFilter;gradient.needsUpdate=true;
const palette={sand:0xebcd99,stone:0xca8d66,cream:0xf5e5bd,ink:0x263c52,metal:0x497681,teal:0x59cbb9,azure:0x5dbeda,ember:0xef9d5d};
const material=(color:number)=>new THREE.MeshToonMaterial({color,gradientMap:gradient});
const materials={ink:material(palette.ink),cream:material(palette.cream),teal:material(palette.teal),metal:material(palette.metal),azure:material(palette.azure),ember:material(palette.ember)};
const glow=new THREE.MeshBasicMaterial({color:0x98f5dd});
function box(parent:THREE.Object3D,m:THREE.Material,p:readonly number[],s:readonly number[]):THREE.Mesh{
  const mesh=new THREE.Mesh(cube,m);mesh.position.set(p[0],p[1],p[2]);mesh.scale.set(s[0],s[1],s[2]);parent.add(mesh);return mesh;
}
function texture(kind:SurfaceKind):THREE.CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;
  const colors={ground:['#d3b386','#ecd2a4'],stone:['#bd7d59','#d7a071'],metal:['#517c84','#75999a'],crate:['#daa462','#f0c381']}[kind];
  ctx.fillStyle=colors[0];ctx.fillRect(0,0,256,256);
  for(let i=0;i<24;i++){ctx.fillStyle=colors[1];ctx.globalAlpha=0.18;ctx.fillRect(i*47%256,i*83%256,25+i%5*9,3+i%4);}
  ctx.globalAlpha=1;ctx.strokeStyle=kind==='stone'?'#a26d50':'#32525f';ctx.lineWidth=3;
  if(kind==='stone'){for(let y=30;y<256;y+=54){ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(80,y+10,160,y-10,256,y);ctx.stroke();}}
  if(kind==='metal'||kind==='crate'){ctx.strokeRect(8,8,240,240);ctx.fillStyle='#283e50';ctx.fillRect(22,103,212,35);if(kind==='crate'){ctx.fillStyle='#f6cf84';for(let x=12;x<240;x+=40){ctx.beginPath();ctx.moveTo(x,103);ctx.lineTo(x+18,103);ctx.lineTo(x+43,138);ctx.lineTo(x+25,138);ctx.fill();}}}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
}
export function arenaGeometry(solid:ArenaBox):THREE.BufferGeometry {
  const {vertices:v,indices:ix}=solidMesh(solid),positions:number[]=[],uv:number[]=[],colors:number[]=[];
  for(let face=0;face<ix.length;face+=3){
    const a=ix[face]*3,b=ix[face+1]*3,c=ix[face+2]*3;
    const u=new THREE.Vector3(v[b]-v[a],v[b+1]-v[a+1],v[b+2]-v[a+2]),w=new THREE.Vector3(v[c]-v[a],v[c+1]-v[a+1],v[c+2]-v[a+2]);u.cross(w).normalize();
    const axes=Math.abs(u.y)>0.65?[0,2]:Math.abs(u.x)>Math.abs(u.z)?[2,1]:[0,1];
    const shade=solid.shape==='rock'?0.91+(Math.floor(face/6)%3)*0.055:1;
    for(let k=0;k<3;k++){const i=ix[face+k]*3;positions.push(v[i],v[i+1],v[i+2]);uv.push(v[i+axes[0]]/4,v[i+axes[1]]/4);colors.push(shade,shade,shade);}
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
export function buildArena(scene:THREE.Scene):void {
  scene.background=new THREE.Color(0xb8d9d7);scene.fog=new THREE.Fog(0xc8d5c6,100,250);
  scene.add(new THREE.HemisphereLight(0xfff3df,0x626e69,1.4));
  const sun=new THREE.DirectionalLight(0xffe2b0,1.9);sun.name='arena-sun';sun.position.set(-45,80,-35);scene.add(sun);
  for(const kind of ['ground','stone','metal','crate'] as const){
    const parts=BOXES.filter(b=>b.kind===kind).map(arenaGeometry),geometry=mergeGeometries(parts)!;for(const part of parts)part.dispose();
    const mesh=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({map:texture(kind),gradientMap:gradient,vertexColors:true}));mesh.name='arena-'+kind;mesh.castShadow=kind!=='ground';mesh.receiveShadow=true;scene.add(mesh);
  }
  const routeMaterial=new THREE.MeshToonMaterial({color:0xefd4a1,gradientMap:gradient});
  for(const points of ROUTES)scene.add(path(points,5.5,routeMaterial));
  const plaza=new THREE.Mesh(new THREE.CircleGeometry(16,48),routeMaterial);plaza.rotation.x=-Math.PI/2;plaza.position.y=0.032;scene.add(plaza);
  // Ceramic facade plates and graphite seams lie flush on solid walls.
  for(const sign of [-1,1]){
    for(const x of [-7,7]){
      box(scene,materials.cream,[x,2.8,10.61*sign],[5.6,4.5,0.045]);
      box(scene,materials.teal,[x,1.15,10.65*sign],[5.6,0.55,0.045]);
      box(scene,materials.ink,[x,0.35,10.66*sign],[5.8,0.45,0.05]);
    }
    for(const z of [-7,7]){
      box(scene,materials.cream,[10.61*sign,2.8,z],[0.045,4.5,5.6]);
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
    box(scene,accent,[0,2.425,36*sign],[15.7,0.035,7.7]);
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
  for(const [x,,z] of SPAWNS){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,0.04,5,32),z<0?materials.azure:materials.ember);ring.rotation.x=-Math.PI/2;ring.position.set(x,0.04,z);scene.add(ring);}
  // Far mesas extend the playable canyon's silhouette.
  const mountainMaterial=material(0xb39286);
  for(let i=0;i<20;i++){
    const angle=i/20*Math.PI*2,height=20+i%5*5,mountain=new THREE.Mesh(new THREE.CylinderGeometry(6+i%4,16,height,6),mountainMaterial);
    mountain.position.set(Math.cos(angle)*130,height/2-3,Math.sin(angle)*130);scene.add(mountain);
  }
  const shrubGeometry=new THREE.IcosahedronGeometry(0.35,0),shrubs=new THREE.InstancedMesh(shrubGeometry,material(0x76a68b),150),pose=new THREE.Object3D();
  for(let i=0;i<150;i++){const x=(i*73%119)-59,z=(i*41%119)-59;pose.position.set(x,0.2,z);pose.scale.set(0.9+i%3*0.2,0.8,0.9);pose.updateMatrix();shrubs.setMatrixAt(i,pose.matrix);}scene.add(shrubs);
}
export function animateArena(scene:THREE.Scene,time:number):void {
  const core=scene.getObjectByName('rift-core');if(core){core.rotation.y=time*0.3;core.position.y=9.2+Math.sin(time*1.4)*0.12;}
}
