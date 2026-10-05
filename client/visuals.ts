import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CHARACTERS} from '../shared/characters.ts';
import {BOXES} from '../shared/map.ts';

const ramp=new THREE.DataTexture(new Uint8Array([95,180,255]),3,1,THREE.RedFormat);
ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
const toon=(color:number)=>new THREE.MeshToonMaterial({color,gradientMap:ramp});

// Solid silhouettes follow collision boxes; thin surface decals add no gameplay obstacles.
// Shared geometry/materials avoid one GPU resource allocation per avatar.
const cube=new THREE.BoxGeometry(1,1,1);
const metal=toon(0x537e9b);
const dark=toon(0x25344e);
const cyan=new THREE.MeshBasicMaterial({color:0x64ffde});
const amber=new THREE.MeshBasicMaterial({color:0xffac55});
function box(parent:THREE.Object3D,material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number):THREE.Mesh {
  const mesh=new THREE.Mesh(cube,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);parent.add(mesh);return mesh;
}

﻿function surfaceTexture(kind:'stone'|'ground'|'metal'|'crate'):THREE.CanvasTexture {
  const surface=document.createElement('canvas');surface.width=surface.height=256;
  const ctx=surface.getContext('2d')!;let seed=kind.length*8127;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const colors={ground:['#93b69a','#a4c3a0','#739d85'],stone:['#a5abc4','#bac0d6','#858ca8'],metal:['#628daa','#80abc1','#385b78'],crate:['#efb96d','#ffce89','#ad7047']}[kind];
  ctx.fillStyle=colors[0];ctx.fillRect(0,0,256,256);
  // Broad painted patches, clean panel seams: no photorealistic noise.
  for(let i=0;i<(kind==='ground'?32:12);i++){
    const x=random()*256,y=random()*256;ctx.fillStyle=colors[1];ctx.globalAlpha=0.45;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+15+random()*45,y-8);ctx.lineTo(x+40,y+20);ctx.lineTo(x-10,y+26);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.strokeStyle=colors[2];ctx.lineWidth=5;
  if(kind==='stone'){
    for(let y=0;y<256;y+=64)for(let x=-64;x<256;x+=128){const offset=y%128?64:0;ctx.strokeRect(x+offset,y,128,64);ctx.strokeStyle=colors[1];ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+offset+8,y+8);ctx.lineTo(x+offset+110,y+8);ctx.stroke();ctx.strokeStyle=colors[2];ctx.lineWidth=5;}
  }else if(kind==='ground'){
    ctx.strokeStyle=colors[2];ctx.lineWidth=2;
    for(let i=0;i<28;i++){const x=random()*256,y=random()*256;ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x,y-5);ctx.lineTo(x+3,y);ctx.stroke();}
  }else{
    ctx.strokeRect(5,5,246,246);ctx.strokeStyle=colors[1];ctx.lineWidth=4;ctx.strokeRect(12,12,232,232);
    for(const x of [22,234])for(const y of [22,234]){ctx.fillStyle=colors[2];ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff0cd';ctx.fillRect(x-2,y-3,3,2);}
    if(kind==='crate'){
      ctx.fillStyle='#38536b';ctx.fillRect(10,104,236,46);ctx.fillStyle='#ffe69a';
      for(let x=-20;x<260;x+=40){ctx.beginPath();ctx.moveTo(x,104);ctx.lineTo(x+20,104);ctx.lineTo(x+55,150);ctx.lineTo(x+35,150);ctx.fill();}
    }else{ctx.fillStyle=colors[2];for(let y=72;y<190;y+=24)ctx.fillRect(60,y,136,9);}
  }
  const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  // Physical repeats are assigned per box below; panels never stretch across cliffs.
  texture.anisotropy=4;return texture;
}
function sign(scene:THREE.Scene,text:string,x:number,y:number,z:number,rotation=0):void {
  const surface=document.createElement('canvas');surface.width=512;surface.height=128;
  const ctx=surface.getContext('2d')!;ctx.fillStyle='#263c59';ctx.fillRect(0,0,512,128);
  ctx.strokeStyle='#fff0bf';ctx.lineWidth=8;ctx.strokeRect(8,8,496,112);
  ctx.fillStyle='#fff0bf';ctx.font='bold 40px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,80);
  const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(7,1.75),new THREE.MeshBasicMaterial({map:texture}));
  mesh.position.set(x,y,z);mesh.rotation.y=rotation;scene.add(mesh);
}
export function buildArena(scene:THREE.Scene):void {
  scene.background=new THREE.Color(0xb6dbea);scene.fog=new THREE.Fog(0xb6dbea,90,210);
  scene.add(new THREE.HemisphereLight(0xfff4df,0x738b98,1.2));
  const sun=new THREE.DirectionalLight(0xffead1,1.5);sun.position.set(-25,60,20);scene.add(sun);
  const kinds=['ground','stone','metal','crate'] as const,pose=new THREE.Object3D();
  const outline=new THREE.MeshBasicMaterial({color:0x34445e,side:THREE.BackSide});
  for(const kind of kinds){
    const list=BOXES.filter(b=>b.kind===kind),texture=surfaceTexture(kind);
    const faces=[[2,1],[2,1],[0,2],[0,2],[0,1],[0,1]];
    // Bake world-scale UVs and batch each surface into a single draw call.
    const pieces=list.map(b=>{
      const geometry=cube.clone(),uv=geometry.getAttribute('uv');
      for(let face=0;face<6;face++)for(let vertex=0;vertex<4;vertex++){
        const i=face*4+vertex,[u,v]=faces[face];uv.setXY(i,uv.getX(i)*b.h[u]*2/4,uv.getY(i)*b.h[v]*2/4);
      }
      geometry.scale(b.h[0]*2,b.h[1]*2,b.h[2]*2);geometry.translate(...b.p);return geometry;
    });
    const geometry=mergeGeometries(pieces)!;geometry.clearGroups();for(const part of pieces)part.dispose();
    scene.add(new THREE.Mesh(geometry,new THREE.MeshToonMaterial({map:texture,gradientMap:ramp})));
    if(kind!=='ground'){
      const edges=new THREE.InstancedMesh(cube,outline,list.length);
      list.forEach((b,i)=>{pose.position.set(...b.p);pose.scale.set(b.h[0]*2+0.045,b.h[1]*2+0.045,b.h[2]*2+0.045);pose.updateMatrix();edges.setMatrixAt(i,pose.matrix);});
      scene.add(edges);
    }
  }
  // Painted cross routes guide players between cover without adding invisible obstacles.
  const sand=toon(0xe8d8aa),blue=toon(0x74d9eb),orange=toon(0xffbd7b);
  box(scene,sand,0,0.006,0,7,0.01,124);box(scene,sand,0,0.008,0,124,0.01,6);
  for(const direction of [-1,1]){
    const accent=direction<0?blue:orange;
    box(scene,accent,0,0.017,49*direction,7,0.012,0.4);
    for(let z=14;z<=54;z+=5){
      const arrow=new THREE.Mesh(new THREE.ConeGeometry(0.45,0.9,3),accent);
      arrow.rotation.x=-Math.PI/2*direction;arrow.position.set(0,0.025,z*direction);arrow.scale.z=0.02;scene.add(arrow);
    }
    sign(scene,direction<0?'01 / BLUE GROTTO':'02 / SUN GROTTO',42*direction,4.5,18*direction-12.03,direction<0?0:Math.PI);
    sign(scene,direction<0?'AZURE / GARDEN':'EMBER / GARDEN',0,1.8,40.03*direction,direction<0?Math.PI:0);
    for(const offset of [-7,7])box(scene,amber,42*direction,4.65,18*direction+offset,1.5,0.06,0.12);
    // Roof access labels and terrace lip paint are attached to real collision surfaces.
    for(let i=0;i<7;i++)box(scene,accent,(24-i*2)*direction,i+1.015,0,1.8,0.025,4.8);
    sign(scene,'ROOF / JUMP ROUTE',21*direction,2.3,-2.43);
  }
  for(const z of [-10.65,10.65])sign(scene,'RIFT / REACTOR',0,4.6,z,z>0?Math.PI:0);
  for(const x of [-10,10])for(const z of [-7,7])box(scene,cyan,x+(x<0?0.61:-0.61),2.8,z,0.025,3.2,0.08);
  const core=new THREE.Group();core.name='rift-core';core.position.set(0,3.9,0);
  const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(0.9),toon(0x8af1dc));core.add(crystal);
  const orbit=new THREE.Mesh(new THREE.TorusGeometry(1.2,0.045,6,40),cyan);orbit.rotation.x=1.1;core.add(orbit);scene.add(core);
  // Landing rings, thin grass tufts and painted contact shadows.
  const shadow=new THREE.MeshBasicMaterial({color:0x385968,transparent:true,opacity:0.16,depthWrite:false});
  for(const b of BOXES){if(b.kind==='ground'||b.h[1]>5)continue;const patch=new THREE.Mesh(new THREE.PlaneGeometry(b.h[0]*2+0.5,b.h[2]*2+0.5),shadow);patch.rotation.x=-Math.PI/2;patch.position.set(b.p[0]+0.3,0.025,b.p[2]+0.3);scene.add(patch);}
  for(const [x,,z] of [[-54,0,-54],[54,0,54],[54,0,-54],[-54,0,54],[0,0,-52],[0,0,52]]){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.8,0.06,5,32),z<0?cyan:amber);ring.rotation.x=-Math.PI/2;ring.position.set(x,0.035,z);scene.add(ring);
  }
  const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(0.18,0.45,3),toon(0x629d83),200);
  for(let i=0;i<200;i++){
    const x=((i*79)%119)-59,z=((i*47+13)%119)-59;
    pose.position.set(x,0.15,z);pose.scale.set(1,0.7+i%3*0.25,1);pose.rotation.y=i;pose.updateMatrix();grass.setMatrixAt(i,pose.matrix);
  }scene.add(grass);
  const mountainMaterials=[toon(0x8da2b9),toon(0xa5b5c9)];
  for(let i=0;i<36;i++){
    const angle=i/36*Math.PI*2,radius=104+(i%5)*8,height=15+(i*13%24);
    const mountain=new THREE.Mesh(new THREE.ConeGeometry(12+(i%4)*2,height,5),mountainMaterials[i%2]);
    mountain.position.set(Math.cos(angle)*radius,height/2-2,Math.sin(angle)*radius);mountain.rotation.y=i;scene.add(mountain);
  }
  // Stylized trees stay beyond the solid perimeter, never misleading traversable cover.
  for(let i=0;i<22;i++){
    const a=i/22*Math.PI*2,x=Math.cos(a)*81,z=Math.sin(a)*81;
    box(scene,toon(0x98755d),x,3,z,1,6,1);
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(4.5,0),toon(i%2?0x82bb9e:0x6aa99c));crown.position.set(x,7,z);scene.add(crown);
  }
  const cloudMaterial=new THREE.MeshBasicMaterial({color:0xfff4e4});
  const cloudGeometry=new THREE.SphereGeometry(1,10,6);
  for(let i=0;i<14;i++)for(let k=0;k<3;k++){
    const cloud=new THREE.Mesh(cloudGeometry,cloudMaterial);const a=i/14*Math.PI*2;
    cloud.position.set(Math.cos(a)*145+k*6,45+(i%4)*5,Math.sin(a)*145);cloud.scale.set(9,3+k%2,4);scene.add(cloud);
  }
  sign(scene,'AZURE / NORTH',0,8,-62.9);sign(scene,'EMBER / SOUTH',0,8,62.9,Math.PI);
}
export function animateArena(scene:THREE.Scene,time:number):void {
  const core=scene.getObjectByName('rift-core');if(core){core.rotation.y=time*0.6;core.position.y=3.9+Math.sin(time*1.8)*0.13;}
}
export function attachName(avatar:THREE.Group,name:string,team:number):void {
  const surface=document.createElement('canvas');surface.width=256;surface.height=64;
  const ctx=surface.getContext('2d')!;ctx.fillStyle='#07131dde';ctx.fillRect(0,0,256,64);
  ctx.fillStyle=team===1?'#74eaff':team===2?'#ffb277':'#e9f3fa';ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillText(name,128,41);
  const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true,depthWrite:false}));label.position.y=1.25;label.scale.set(1.8,0.45,1);avatar.add(label);
  avatar.userData.label=label;
}
export function disposeName(avatar:THREE.Group):void {
  const label=avatar.userData.label as THREE.Sprite|undefined;if(label){label.material.map?.dispose();label.material.dispose();}
}
const helmet=new THREE.SphereGeometry(0.27,12,8);
const palettes=CHARACTERS.map(c=>({armor:toon(c.color),accent:new THREE.MeshBasicMaterial({color:c.accent})}));
export function createAvatar(character=0):THREE.Group {
  const index=character>=0&&character<CHARACTERS.length?character:0,{armor,accent}=palettes[index];
  const avatar=new THREE.Group();
  box(avatar,armor,0,0.05,0,0.52,0.65,0.32);
  const head=new THREE.Mesh(helmet,armor);head.position.y=0.58;avatar.add(head);
  box(avatar,accent,0,0.6,-0.25,0.38,0.09,0.035);
  box(avatar,accent,0,0.18,-0.17,0.27,0.055,0.03);
  box(avatar,dark,0,0.12,0.23,0.3,0.45,0.14);
  for(const side of [-1,1]){
    const leg=box(avatar,dark,side*0.16,-0.56,0,0.2,0.55,0.23);leg.name=side<0?'leg-left':'leg-right';
    box(avatar,armor,side*0.16,-0.4,-0.12,0.19,0.16,0.04);
    box(avatar,armor,side*0.37,0.02,0,0.17,0.52,0.2);
    if(index===1)box(avatar,armor,side*0.36,0.3,0,0.27,0.2,0.3);
    if(index===2)box(avatar,accent,side*0.2,0.91,0.05,0.035,0.23,0.035);
  }
  box(avatar,dark,0.22,-0.08,-0.42,0.16,0.14,0.7);
  avatar.userData.character=index;return avatar;
}
export function animateAvatar(avatar:THREE.Group,time:number,speed:number):void {
  const swing=Math.sin(time*12)*Math.min(speed/10,1)*0.25;
  avatar.getObjectByName('leg-left')!.rotation.x=swing;
  avatar.getObjectByName('leg-right')!.rotation.x=-swing;
}
function createWeapon(weapon:number):THREE.Group {
  const model=new THREE.Group();
  box(model,dark,0,-0.07,0.15,0.12,0.24,0.14);
  if(weapon===0){
    box(model,metal,0,0,0,0.18,0.14,0.58);
    for(const x of [-0.075,0.075]){
      box(model,metal,x,0,-0.38,0.045,0.08,0.5);
      box(model,cyan,x,0.043,-0.36,0.024,0.01,0.45);
    }
    box(model,dark,0,0.11,0,0.07,0.07,0.25);
    box(model,cyan,0,0.11,-0.13,0.06,0.045,0.01);
  }else{
    box(model,metal,0,0,0,0.26,0.22,0.4);
    const core=new THREE.Mesh(new THREE.CylinderGeometry(0.105,0.105,0.3,12),amber);
    core.rotation.x=Math.PI/2;core.position.z=-0.25;model.add(core);
    for(const x of [-0.14,0.14])box(model,dark,x,0,-0.18,0.065,0.26,0.4);
    box(model,metal,0,0,-0.46,0.18,0.16,0.13);
  }
  const flash=new THREE.Mesh(new THREE.OctahedronGeometry(0.09),weapon?amber:cyan);
  flash.name='flash';flash.position.z=weapon?-0.56:-0.65;flash.visible=false;model.add(flash);
  return model;
}
export class ViewWeapon {
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(70,1,0.01,10);
  private readonly models=[createWeapon(0),createWeapon(1)];
  private kick=0;private lastShot=-Infinity;private selected=-1;
  constructor(){this.scene.add(new THREE.HemisphereLight(0xffffff,0x24384a,1.8));for(const model of this.models)this.scene.add(model);}
  resize(aspect:number):void{this.camera.aspect=aspect;this.camera.updateProjectionMatrix();}
  shot(time:number):void{this.lastShot=time;this.kick=1;}
  update(dt:number,time:number,speed:number,weapon:number,active:boolean,reloading=false,reducedMotion=false):void {
    if(weapon!==this.selected){this.selected=weapon;this.kick=0;}
    this.kick*=Math.exp(-dt*18);
    this.models.forEach((model,i)=>{
      model.visible=i===weapon;model.getObjectByName('flash')!.visible=active&&time-this.lastShot<0.04;
      model.position.set(0.3+(reducedMotion?0:Math.sin(time*10)*Math.min(speed,12)*0.0008),-0.26+(reducedMotion?0:Math.cos(time*20)*Math.min(speed,12)*0.0006),-0.6+this.kick*0.06);
      model.rotation.x=(reducedMotion?0:this.kick*0.08)+(reloading?-0.5:0);
      model.rotation.z=reloading?-0.25:0;
    });
  }
  render(renderer:THREE.WebGLRenderer):void {
    const auto=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(this.scene,this.camera);renderer.autoClear=auto;
  }
}
export class Showroom {
  private readonly scene=new THREE.Scene();
  private readonly camera=new THREE.PerspectiveCamera(35,1,0.1,20);
  private readonly avatars=CHARACTERS.map((_,i)=>createAvatar(i));
  private readonly weapons=[createWeapon(0),createWeapon(1)];
  constructor(){
    this.camera.position.set(0,0.4,4.3);this.camera.lookAt(0,0,0);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x52607a,1.5));
    const key=new THREE.DirectionalLight(0xffffff,1.8);key.position.set(-2,3,3);this.scene.add(key);
    for(const avatar of this.avatars)this.scene.add(avatar);
    for(const weapon of this.weapons){weapon.position.set(0.9,-0.35,0);weapon.scale.setScalar(0.9);this.scene.add(weapon);}
    const platform=new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.85,0.1,32),metal);
    platform.position.set(-0.35,-0.94,0);this.scene.add(platform);
  }
  render(renderer:THREE.WebGLRenderer,time:number,character:number,weapon:number):void {
    if(innerWidth<900)return;
    this.avatars.forEach((model,i)=>{model.visible=i===character;model.position.x=-0.35;model.rotation.y=Math.PI+Math.sin(time*0.4)*0.45;animateAvatar(model,time,0);});
    this.weapons.forEach((model,i)=>{model.visible=i===weapon;model.rotation.set(-0.15,time*0.25,0.2);});
    const w=Math.floor(innerWidth*0.44),h=Math.floor(innerHeight*0.7),x=innerWidth-w-20,y=Math.floor(innerHeight*0.12);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
    const auto=renderer.autoClear;renderer.autoClear=false;renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.setScissorTest(true);
    renderer.clearDepth();renderer.render(this.scene,this.camera);renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.autoClear=auto;
  }
}
