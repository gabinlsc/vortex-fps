import * as THREE from 'three';
import {BOXES} from '../shared/map.ts';

// All decoration stays inside collision boxes or outside the playable arena.
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
    pose.position.set(...b.p);pose.scale.set(b.h[0]*2,b.h[1]*2,b.h[2]*2);pose.updateMatrix();
    shells.setMatrixAt(i,pose.matrix);shells.setColorAt(i,new THREE.Color(i===0?0x172430:i<5?0x263443:0x425567));
    if(i>=5){
      box(scene,cyan,b.p[0],b.p[1]+b.h[1]-0.025,b.p[2],b.h[0]*1.9,0.03,0.09);
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
  ring.rotation.x=-Math.PI/2;ring.position.set(0,0.012,0);scene.add(ring);
}

const armor=new THREE.MeshStandardMaterial({color:0x8ba9bc,roughness:0.55,metalness:0.45});
const helmet=new THREE.SphereGeometry(0.27,12,8);
export function createAvatar():THREE.Group {
  const avatar=new THREE.Group();
  box(avatar,armor,0,0.05,0,0.52,0.65,0.32);
  const head=new THREE.Mesh(helmet,armor);head.position.y=0.58;avatar.add(head);
  box(avatar,amber,0,0.6,-0.25,0.38,0.09,0.035);
  box(avatar,cyan,0,0.18,-0.17,0.27,0.055,0.03);
  for(const side of [-1,1]){
    box(avatar,dark,side*0.16,-0.56,0,0.2,0.55,0.23);
    box(avatar,armor,side*0.37,0.02,0,0.17,0.52,0.2);
  }
  box(avatar,dark,0.22,-0.08,-0.42,0.16,0.14,0.7);
  return avatar;
}

export class ViewWeapon {
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(70,1,0.01,10);
  private readonly model=new THREE.Group();
  private readonly barrel:THREE.Mesh;
  private readonly flash:THREE.Mesh;
  private kick=0;
  private lastShot=-Infinity;
  constructor(){
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x24384a,3));
    this.scene.add(this.model);this.model.position.set(0.3,-0.26,-0.6);
    box(this.model,dark,0,-0.03,0.13,0.12,0.24,0.14);
    box(this.model,metal,0,0,0,0.22,0.17,0.55);
    box(this.model,cyan,-0.112,0.02,-0.05,0.005,0.025,0.32);
    box(this.model,dark,0,0.12,0,0.06,0.06,0.2);
    this.barrel=box(this.model,cyan,0,0,-0.4,0.07,0.07,0.28);
    this.flash=new THREE.Mesh(new THREE.OctahedronGeometry(0.09),amber);
    this.flash.position.z=-0.57;this.flash.visible=false;this.model.add(this.flash);
  }
  resize(aspect:number):void{this.camera.aspect=aspect;this.camera.updateProjectionMatrix();}
  update(dt:number,time:number,speed:number,firing:boolean,weapon:number,active:boolean):void {
    // Cosmetic prediction only: damage/hits remain server-confirmed.
    const cooldown=weapon?0.25:0.75;
    if(active&&firing&&time-this.lastShot>=cooldown){this.lastShot=time;this.kick=1;}
    this.kick*=Math.exp(-dt*18);this.flash.visible=active&&time-this.lastShot<0.04;
    this.barrel.material=weapon?amber:cyan;
    this.model.position.set(0.3+Math.sin(time*10)*Math.min(speed,12)*0.0008,-0.26+Math.cos(time*20)*Math.min(speed,12)*0.0006,-0.6+this.kick*0.06);
    this.model.rotation.x=this.kick*0.08;
  }
  render(renderer:THREE.WebGLRenderer):void {
    const auto=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(this.scene,this.camera);renderer.autoClear=auto;
  }
}
