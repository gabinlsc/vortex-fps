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

export function buildArena(scene:THREE.Scene):void {
  scene.background=new THREE.Color(0x07121d);scene.fog=new THREE.Fog(0x07121d,35,100);
  scene.add(new THREE.HemisphereLight(0xc0eaff,0x192338,2.4));
  const sun=new THREE.DirectionalLight(0xbcdcff,3);sun.position.set(-12,30,16);scene.add(sun);
  const shells=new THREE.InstancedMesh(cube,metal,BOXES.length);
  const pose=new THREE.Object3D();
  BOXES.forEach((b,i)=>{
    pose.position.set(b.p[0],b.p[1],b.p[2]);pose.scale.set(b.h[0]*2,b.h[1]*2,b.h[2]*2);pose.updateMatrix();
    shells.setMatrixAt(i,pose.matrix);shells.setColorAt(i,new THREE.Color(i===0?0x172430:i<5?0x263443:0x425567));
    if(i>=5){
      box(scene,cyan,b.p[0],b.p[1]+b.h[1]+0.004,b.p[2],b.h[0]*1.9,0.006,0.09);
      box(scene,dark,b.p[0],b.p[1]+b.h[1]+0.001,b.p[2],b.h[0]*1.75,0.002,b.h[2]*1.75);
    }
  });
  shells.instanceMatrix.needsUpdate=true;scene.add(shells);
  const grid=new THREE.GridHelper(47,24,0x397c83,0x2b3c49);grid.position.y=0.003;scene.add(grid);
  for(const z of [-22.8,22.8])for(let x=-20;x<=20;x+=8){
    box(scene,cyan,x,0.015,z,3.2,0.02,0.08);
    box(scene,dark,x,3,z>0?23.45:-23.45,2.8,4.8,0.05);
    box(scene,amber,x,4.7,z>0?23.4:-23.4,1.8,0.06,0.04);
  }
  for(const x of [-23.4,23.4])for(let z=-20;z<=20;z+=8){
    box(scene,dark,x,3,z,0.08,5.8,0.5);box(scene,cyan,x+(x<0?0.05:-0.05),3,z,0.03,2.6,0.08);
  }
  // Skyline lives beyond the authoritative walls; deterministic generation, no textures.
  for(let i=0;i<40;i++){
    const angle=i/40*Math.PI*2,radius=48+(i%4)*4,height=8+(i*17%29);
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    box(scene,dark,x,height/2-2,z,4+(i%3),height,4);
    box(scene,i%3?cyan:amber,x,height-2,z,2,0.12,2);
  }
  const ring=new THREE.Mesh(new THREE.TorusGeometry(3.4,0.035,6,64),cyan);
  ring.rotation.x=-Math.PI/2;ring.position.set(0,1.212,0);scene.add(ring);
  for(const z of [-15,15])for(const x of [-14,0,14])box(scene,z<0?cyan:amber,x,0.009,z,0.16,0.01,6);
  for(const z of [-23.38,23.38]){
    const surface=document.createElement('canvas');surface.width=1024;surface.height=256;
    const ctx=surface.getContext('2d')!;ctx.fillStyle='#101c2a';ctx.fillRect(0,0,1024,256);
    ctx.fillStyle=z<0?'#64ffde':'#ffac55';ctx.font='900 140px sans-serif';ctx.textAlign='center';ctx.fillText('HELIX / '+(z<0?'NORTH':'SOUTH'),512,170);
    const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(12,3),new THREE.MeshBasicMaterial({map:texture}));
    sign.position.set(0,4,z);if(z>0)sign.rotation.y=Math.PI;scene.add(sign);
  }
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
