import * as THREE from 'three';
import {CHARACTERS} from '../shared/characters.ts';
import {WEAPONS} from '../shared/gunplay.ts';
import {DT} from '../shared/input.ts';
import {BOXES} from '../shared/map.ts';

// Solid silhouettes follow collision boxes; thin surface decals add no gameplay obstacles.
// Shared geometry/materials avoid one GPU resource allocation per avatar.
const cube=new THREE.BoxGeometry(1,1,1);
const metal=new THREE.MeshStandardMaterial({color:0x293748,roughness:0.7,metalness:0.45});
const dark=new THREE.MeshStandardMaterial({color:0x101923,roughness:0.8,metalness:0.2});
const cyan=new THREE.MeshBasicMaterial({color:0x64ffde});
const amber=new THREE.MeshBasicMaterial({color:0xffac55});
function box(parent:THREE.Object3D,material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number):THREE.Mesh {
  const mesh=new THREE.Mesh(cube,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);parent.add(mesh);return mesh;
}

function surfaceTexture(kind:'stone'|'ground'|'metal'|'crate'):THREE.CanvasTexture {
  const surface=document.createElement('canvas');surface.width=surface.height=256;
  const ctx=surface.getContext('2d')!;let seed=kind.length*8127;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const base=kind==='stone'?[65,71,84]:kind==='ground'?[49,57,63]:kind==='crate'?[83,72,59]:[42,57,68];
  ctx.fillStyle='rgb('+base.join(',')+')';ctx.fillRect(0,0,256,256);
  for(let i=0;i<5500;i++){const tint=Math.floor(random()*50)-25;ctx.fillStyle='rgba('+base.map(v=>Math.max(0,v+tint)).join(',')+',0.55)';ctx.fillRect(random()*256,random()*256,2+random()*4,2+random()*4);}
  if(kind==='stone'){
    ctx.strokeStyle='#232b3a';ctx.lineWidth=2;
    for(let i=0;i<26;i++){ctx.beginPath();const x=random()*256,y=random()*256;ctx.moveTo(x,y);ctx.lineTo(x+random()*40,y+random()*30);ctx.lineTo(x+random()*70,y+random()*60);ctx.stroke();}
  }else if(kind==='metal'||kind==='crate'){
    ctx.strokeStyle='#121d25';ctx.lineWidth=5;ctx.strokeRect(5,5,246,246);
    for(const x of [16,240])for(const y of [16,240]){ctx.fillStyle='#9ba2a4';ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}
    if(kind==='crate'){ctx.fillStyle='#d59d45';ctx.fillRect(12,102,232,28);ctx.fillStyle='#25323c';for(let x=0;x<260;x+=32){ctx.beginPath();ctx.moveTo(x,102);ctx.lineTo(x+16,102);ctx.lineTo(x+38,130);ctx.lineTo(x+22,130);ctx.fill();}}
    else{ctx.strokeStyle='#536576';ctx.lineWidth=1;for(let y=42;y<230;y+=22){ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(216,y);ctx.stroke();}}
  }
  const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(kind==='ground'?32:2,kind==='ground'?32:2);texture.anisotropy=4;return texture;
}
function sign(scene:THREE.Scene,text:string,x:number,y:number,z:number,rotation=0):void {
  const surface=document.createElement('canvas');surface.width=512;surface.height=128;
  const ctx=surface.getContext('2d')!;ctx.fillStyle='#0d1c26';ctx.fillRect(0,0,512,128);ctx.fillStyle='#74ffdc';ctx.font='bold 46px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,82);
  const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(7,1.75),new THREE.MeshBasicMaterial({map:texture}));
  mesh.position.set(x,y,z);mesh.rotation.y=rotation;scene.add(mesh);
}
export function buildArena(scene:THREE.Scene):void {
  scene.background=new THREE.Color(0x304253);scene.fog=new THREE.Fog(0x304253,75,175);
  scene.add(new THREE.HemisphereLight(0xc9e6ff,0x44383a,2.4));
  const sun=new THREE.DirectionalLight(0xffe0b7,3.3);sun.position.set(-25,60,20);scene.add(sun);
  const kinds=['ground','stone','metal','crate'] as const,pose=new THREE.Object3D();
  for(const kind of kinds){
    const list=BOXES.filter(b=>b.kind===kind);
    const material=new THREE.MeshStandardMaterial({map:surfaceTexture(kind),roughness:kind==='metal'?0.55:0.95,metalness:kind==='metal'?0.55:0.05});
    const instances=new THREE.InstancedMesh(cube,material,list.length);
    list.forEach((b,i)=>{pose.position.set(b.p[0],b.p[1],b.p[2]);pose.scale.set(b.h[0]*2,b.h[1]*2,b.h[2]*2);pose.updateMatrix();instances.setMatrixAt(i,pose.matrix);});
    instances.instanceMatrix.needsUpdate=true;scene.add(instances);
  }
  for(const x of [-10,10])for(const z of [-7,7])box(scene,cyan,x+(x<0?0.61:-0.61),2.8,z,0.025,3.2,0.08);
  for(const z of [-10.65,10.65])sign(scene,'RIFT // OUTPOST',0,4.6,z,z>0?Math.PI:0);
  for(const direction of [-1,1]){
    sign(scene,direction<0?'01 / CAVERN':'02 / CAVERN',42*direction,4.5,18*direction-12.03,direction<0?0:Math.PI);
    for(const offset of [-7,7]){
      const x=42*direction,z=18*direction+offset;
      box(scene,amber,x,4.5,z,1.5,0.06,0.12);
      const torch=new THREE.PointLight(0xffaa59,18,14,2);torch.position.set(x,3.9,z);scene.add(torch);
    }
  }
  // Thin route markings and landing zones; all solid cover comes from shared collision data.
  for(const z of [-52,52])for(const x of [-54,0,54]){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,0.035,4,32),z<0?cyan:amber);ring.rotation.x=-Math.PI/2;ring.position.set(x,0.012,z);scene.add(ring);
  }
  for(let i=0;i<36;i++){
    const angle=i/36*Math.PI*2,radius=94+(i%5)*8,height=15+(i*13%24);
    const mountain=new THREE.Mesh(new THREE.ConeGeometry(12+(i%4)*2,height,5),new THREE.MeshLambertMaterial({color:i%2?0x3a4552:0x475460}));
    mountain.position.set(Math.cos(angle)*radius,height/2-2,Math.sin(angle)*radius);mountain.rotation.y=i;scene.add(mountain);
  }
  sign(scene,'AZURE // NORTH',0,8,-62.9);sign(scene,'EMBER // SOUTH',0,8,62.9,Math.PI);
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
const palettes=CHARACTERS.map(c=>({armor:new THREE.MeshStandardMaterial({color:c.color,roughness:0.5,metalness:0.55}),accent:new THREE.MeshBasicMaterial({color:c.accent})}));
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
  constructor(){this.scene.add(new THREE.HemisphereLight(0xffffff,0x24384a,3));for(const model of this.models)this.scene.add(model);}
  resize(aspect:number):void{this.camera.aspect=aspect;this.camera.updateProjectionMatrix();}
  update(dt:number,time:number,speed:number,firing:boolean,weapon:number,active:boolean):void {
    if(weapon!==this.selected){this.selected=weapon;this.kick=0;}
    if(active&&firing&&time-this.lastShot>=WEAPONS[weapon].cooldownTicks*DT){this.lastShot=time;this.kick=1;}
    this.kick*=Math.exp(-dt*18);
    this.models.forEach((model,i)=>{
      model.visible=i===weapon;model.getObjectByName('flash')!.visible=active&&time-this.lastShot<0.04;
      model.position.set(0.3+Math.sin(time*10)*Math.min(speed,12)*0.0008,-0.26+Math.cos(time*20)*Math.min(speed,12)*0.0006,-0.6+this.kick*0.06);
      model.rotation.x=this.kick*0.08;
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
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x52607a,3));
    const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(-2,3,3);this.scene.add(key);
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
