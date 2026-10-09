import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BOXES,ROUTES,type ArenaBox} from '../shared/map.ts';
import {toonMaterial} from './materials.ts';
const sphere=new THREE.IcosahedronGeometry(1,1);
const materials={leaves:toonMaterial(0x6eb497),leafLight:toonMaterial(0x95cba6),leafDark:toonMaterial(0x498974),soil:toonMaterial(0x76634f)};
function canvasTexture(paint:(ctx:CanvasRenderingContext2D)=>void,size=128):THREE.CanvasTexture{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;paint(canvas.getContext('2d')!);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function routeDistance(x:number,z:number,routes=ROUTES):number{
  let distance=Infinity;
  for(const route of routes)for(let i=1;i<route.length;i++){
    const [ax,az]=route[i-1],[bx,bz]=route[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
    distance=Math.min(distance,Math.hypot(x-ax-t*dx,z-az-t*dz));
  }return distance;
}
export function buildLandscape(scene:THREE.Scene,solids:ArenaBox[]=BOXES,routes=ROUTES):void{
  const skyTexture=canvasTexture(ctx=>{
    const gradient=ctx.createLinearGradient(0,0,0,128);gradient.addColorStop(0,'#5a9eb9');gradient.addColorStop(0.45,'#acd2d1');gradient.addColorStop(0.63,'#e7d4b1');gradient.addColorStop(1,'#efd3ae');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  });
  const sky=new THREE.Mesh(new THREE.SphereGeometry(185,32,16),new THREE.MeshBasicMaterial({map:skyTexture,side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false}));sky.renderOrder=-10;sky.name='canyon-sky';scene.add(sky);
  scene.fog=new THREE.Fog(0xdfcbb0,110,245);
  const haloTexture=canvasTexture(ctx=>{const g=ctx.createRadialGradient(64,64,8,64,64,64);g.addColorStop(0,'#fff3c6bb');g.addColorStop(0.3,'#ffdda566');g.addColorStop(1,'#ffdda500');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);});
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture,depthWrite:false,toneMapped:false,fog:false}));halo.position.set(-95,84,-72);halo.scale.set(42,42,1);scene.add(halo);
  const sun=new THREE.Sprite(new THREE.SpriteMaterial({map:canvasTexture(ctx=>{ctx.fillStyle='#fff0c4';ctx.beginPath();ctx.arc(64,64,62,0,Math.PI*2);ctx.fill();}),depthWrite:false,toneMapped:false,fog:false}));sun.position.copy(halo.position);sun.scale.set(13,13,1);scene.add(sun);
  const cloudParts:THREE.BufferGeometry[]=[];
  for(let i=0;i<12;i++)for(let k=0;k<3;k++){
    const a=i/12*Math.PI*2,geometry=sphere.clone();geometry.scale(7+k%2*4,2.2+k%2,4);geometry.translate(Math.cos(a)*125+k*5,43+i%4*5,Math.sin(a)*125);cloudParts.push(geometry);
  }
  const cloudGeometry=mergeGeometries(cloudParts)!;for(const g of cloudParts)g.dispose();
  const clouds=new THREE.Mesh(cloudGeometry,new THREE.MeshBasicMaterial({color:0xffeed5,transparent:true,opacity:0.6,depthWrite:false}));clouds.name='canyon-clouds';scene.add(clouds);
  // One instanced contact-shadow layer keeps low quality readable without shadow maps.
  const contactTexture=canvasTexture(ctx=>{const g=ctx.createRadialGradient(64,64,12,64,64,62);g.addColorStop(0,'#253b45b3');g.addColorStop(0.6,'#253b454d');g.addColorStop(1,'#253b4500');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);});
  const grounded=solids.filter(s=>s.kind!=='ground'&&s.zone!=='boundary'&&s.zone!=='cliff'&&Math.abs(s.p[1]-s.h[1])<0.02);
  const shadows=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,opacity:0.32,depthWrite:false}),grounded.length),pose=new THREE.Object3D();
  grounded.forEach((s,i)=>{pose.position.set(s.p[0],0.045,s.p[2]);pose.rotation.set(-Math.PI/2,0,s.yaw??0);pose.scale.set(s.h[0]*2.6,s.h[2]*2.6,1);pose.updateMatrix();shadows.setMatrixAt(i,pose.matrix);});scene.add(shadows);
  const foliage=new THREE.Group();foliage.name='canyon-foliage';scene.add(foliage);
  // Garden trees have shared solid trunks; leaves are soft, penetrable foliage.
  for(const tree of solids.filter(s=>s.zone==='tree')){
    for(let i=0;i<3;i++){
      const canopy=new THREE.Mesh(sphere,i%2?materials.leafLight:materials.leaves);canopy.position.set(tree.p[0]+(i-1)*0.85,6.5+i%2*0.75,tree.p[2]+(i%2?0.45:-0.1));canopy.scale.set(1.4,1.25,1.35);canopy.castShadow=true;canopy.receiveShadow=true;foliage.add(canopy);
    }
    const soil=new THREE.Mesh(new THREE.BoxGeometry(1.92,0.035,1.92),materials.soil);soil.position.set(tree.p[0],3.21,tree.p[2]);foliage.add(soil);
  }
  // Scatter small plants on the margins; preserve the plazas and route visibility.
  const positions:THREE.Vector3[]=[];let seed=9431;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let attempt=0;positions.length<420&&attempt<5000;attempt++){
    const x=random()*120-60,z=random()*120-60;
    if(Math.hypot(x,z)<17||routeDistance(x,z,routes)<3.3)continue;
    if(solids.some(s=>s.kind!=='ground'&&Math.abs(x-s.p[0])<s.h[0]+0.5&&Math.abs(z-s.p[2])<s.h[2]+0.5))continue;
    positions.push(new THREE.Vector3(x,0,z));
  }
  const leafGeometry=new THREE.ConeGeometry(0.24,0.75,4),grass=new THREE.InstancedMesh(leafGeometry,materials.leafDark,positions.length);
  grass.name='canyon-grass';positions.forEach((p,i)=>{pose.position.copy(p);pose.position.y=0.28;pose.rotation.set(0,i*1.3,0);pose.scale.set(0.7+i%4*0.16,0.6+i%3*0.15,1);pose.updateMatrix();grass.setMatrixAt(i,pose.matrix);});foliage.add(grass);
  const shrubGeometry=new THREE.IcosahedronGeometry(0.5,0),shrubs=new THREE.InstancedMesh(shrubGeometry,materials.leaves,Math.floor(positions.length/4));
  shrubs.name='canyon-shrubs';for(let i=0;i<shrubs.count;i++){pose.position.copy(positions[i*4]);pose.position.y=0.25;pose.scale.set(1.1,0.65,0.9);pose.updateMatrix();shrubs.setMatrixAt(i,pose.matrix);}foliage.add(shrubs);
  const petals=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.11,0),new THREE.MeshBasicMaterial({color:0xffffff}),80);
  for(let i=0;i<80;i++){pose.position.copy(positions[i*3]);pose.position.y=0.55;pose.scale.set(1,0.65,1);pose.updateMatrix();petals.setMatrixAt(i,pose.matrix);petals.setColorAt(i,new THREE.Color(i%2?0xdba7e4:0xffd17e));}foliage.add(petals);
  // Shallow reflective mineral pools stay flush with the walkable grotto floor.
  for(const sign of [-1,1]){
    const pool=new THREE.Mesh(new THREE.CircleGeometry(3.2,40),new THREE.MeshBasicMaterial({color:sign>0?0x64b8b0:0x8d91c0,transparent:true,opacity:0.58,depthWrite:false}));pool.rotation.x=-Math.PI/2;pool.scale.y=0.6;pool.position.set(43*sign,0.055,20*sign);scene.add(pool);
    const ripple=new THREE.Mesh(new THREE.RingGeometry(1.45,1.48,48),new THREE.MeshBasicMaterial({color:0xc3f5df,transparent:true,opacity:0.35,depthWrite:false}));ripple.rotation.x=-Math.PI/2;ripple.position.copy(pool.position);ripple.position.y=0.065;ripple.name='pool-ripple-'+sign;scene.add(ripple);
    const light=new THREE.PointLight(sign>0?0x8ce7d2:0xba9ce9,8,16,2);light.position.set(40*sign,2.2,16*sign);scene.add(light);
  }
  // Faceted upland trees live beyond the playable border.
  for(const cliff of solids.filter(s=>s.zone==='cliff').filter((_,i)=>i%3===0)){
    const top=cliff.p[1]+cliff.h[1];
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.65,4,6),toonMaterial(0x8d705a));trunk.position.set(cliff.p[0],top+2,cliff.p[2]);foliage.add(trunk);
    const crown=new THREE.Mesh(sphere,materials.leafDark);crown.position.set(cliff.p[0],top+5,cliff.p[2]);crown.scale.set(3.4,4.4,3.4);foliage.add(crown);
  }
}
export function configureArenaQuality(renderer:THREE.WebGLRenderer,scene:THREE.Scene,quality:'low'|'medium'|'high'):void{
  if(scene.userData.quality===quality)return;scene.userData.quality=quality;
  scene.traverse(object=>{if(object instanceof THREE.Mesh&&object.castShadow){const list=Array.isArray(object.material)?object.material:[object.material];for(const material of list)material.shadowSide=THREE.FrontSide;}});
  renderer.shadowMap.enabled=quality!=='low';renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const sun=scene.getObjectByName('arena-sun') as THREE.DirectionalLight|undefined;
  if(sun){sun.castShadow=quality!=='low';sun.shadow.mapSize.setScalar(quality==='high'?2048:1024);sun.shadow.camera.left=sun.shadow.camera.bottom=-85;sun.shadow.camera.right=sun.shadow.camera.top=85;sun.shadow.camera.near=5;sun.shadow.camera.far=210;sun.shadow.bias=quality==='high'?-0.001:-0.0015;sun.shadow.normalBias=0.18;sun.shadow.camera.updateProjectionMatrix();sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.needsUpdate=true;}
  const grass=scene.getObjectByName('canyon-grass') as THREE.InstancedMesh|undefined;if(grass)grass.count=quality==='low'?160:quality==='medium'?300:420;
  const shrubs=scene.getObjectByName('canyon-shrubs') as THREE.InstancedMesh|undefined;if(shrubs)shrubs.count=quality==='low'?40:105;
  renderer.shadowMap.needsUpdate=true;
}
export function animateLandscape(scene:THREE.Scene,time:number):void{
  const clouds=scene.getObjectByName('canyon-clouds');if(clouds)clouds.rotation.y=time*0.0018;
  for(const sign of [-1,1]){
    const ripple=scene.getObjectByName('pool-ripple-'+sign) as THREE.Mesh|undefined;if(!ripple)continue;
    const progress=(time*0.18+(sign+1)*0.25)%1;ripple.scale.setScalar(0.5+progress*1.6);(ripple.material as THREE.MeshBasicMaterial).opacity=(1-progress)*0.35;
  }
}
