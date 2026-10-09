import * as THREE from 'three';
export {buildArena,animateArena} from './arena.ts';
import {CHARACTERS} from '../shared/characters.ts';

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
