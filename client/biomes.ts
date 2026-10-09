import * as THREE from 'three';
import {getMap,type MapId} from '../shared/maps.ts';
import {CEL_GRADIENT,toonMaterial} from './materials.ts';
let illustrated:THREE.Texture|undefined;
export function illustratedStone():THREE.MeshToonMaterial {
  illustrated??=new THREE.TextureLoader().load('/textures/canyon-painted.png');illustrated.colorSpace=THREE.SRGBColorSpace;illustrated.wrapS=illustrated.wrapT=THREE.RepeatWrapping;illustrated.anisotropy=4;
  return new THREE.MeshToonMaterial({map:illustrated,gradientMap:CEL_GRADIENT,vertexColors:true});
}
function stamp(text:string,color:string):THREE.CanvasTexture {
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d')!;x.fillStyle=color;x.fillRect(0,0,256,256);x.strokeStyle='#fff1d1';x.lineWidth=8;x.strokeRect(14,14,228,228);x.fillStyle='#fff1d1';x.font='bold 31px sans-serif';x.textAlign='center';x.fillText(text,128,120);x.font='14px sans-serif';x.fillText('EXPEDITION / 06',128,156);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function floorTexture(kind:'soil'|'pavers'|'moss'):THREE.CanvasTexture {
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d')!;x.fillStyle={soil:'#a7835f',pavers:'#b9b1a0',moss:'#8da77e'}[kind];x.fillRect(0,0,256,256);
  for(let i=0;i<100;i++){x.fillStyle=i%2?'#ffffff14':'#2637441a';if(kind==='pavers'){x.strokeStyle='#716e6066';x.strokeRect((i%4)*64,Math.floor(i/4)*32,61,29);}else{x.beginPath();x.ellipse(i*37%256,i*59%256,4+i%9,2+i%4,i,0,7);x.fill();}}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,4);return t;
}
export function buildBiomes(scene:THREE.Scene,mapId:MapId):void {
  const waterMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0},night:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float time;uniform float night;void main(){float w=sin(vUv.x*35.+time)*sin(vUv.y*48.-time*.8);float foam=smoothstep(.72,1.,abs(w));vec3 c=mix(vec3(.20,.57,.55),vec3(.65,.88,.77),.3+foam*.5);c*=1.-night*.45;gl_FragColor=vec4(c,.75);}'});
  scene.userData.waterMaterial=waterMaterial;
  const river=new THREE.Mesh(new THREE.PlaneGeometry(118,5,40,4),waterMaterial);river.rotation.x=-Math.PI/2;river.position.set(0,0.075,-58);scene.add(river);
  // Shallow water overlays solid ground; no invisible holes or deep-water deaths.
  const waterfall=new THREE.Mesh(new THREE.PlaneGeometry(5,16),waterMaterial);waterfall.position.set(69,8,-24);waterfall.rotation.y=-Math.PI/2;scene.add(waterfall);
  for(const sign of [-1,1]){const pool=new THREE.Mesh(new THREE.CircleGeometry(3.3,32),waterMaterial);pool.rotation.x=-Math.PI/2;pool.scale.y=0.6;pool.position.set(sign*43,0.078,sign*20);scene.add(pool);}
  const biomes=[[-36,43,18,14,'pavers'],[39,-42,16,14,'pavers'],[0,36,14,7,'moss'],[0,-36,14,7,'moss'],[-36,-42,18,17,'soil'],[40,43,16,14,'soil']] as const;
  if(mapId==='canyon')for(const [x,z,w,h,kind]of biomes){const m=new THREE.MeshToonMaterial({map:floorTexture(kind),gradientMap:CEL_GRADIENT,transparent:true,opacity:0.78});const floor=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);floor.rotation.x=-Math.PI/2;floor.position.set(x,Math.abs(z)===36?2.46:0.037,z);scene.add(floor);}
  const plants=new THREE.Group();plants.name='biome-plants';scene.add(plants);
  const pose=new THREE.Object3D(),cactus=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22,0.28,1.5,6),toonMaterial(0x579778),32),ferns=new THREE.InstancedMesh(new THREE.ConeGeometry(0.45,0.5,5),toonMaterial(0x68b698),64);
  for(let i=0;i<32;i++){pose.position.set(-59+i%2*3,0.75,-46+i*3);pose.scale.set(1,0.7+i%4*0.2,1);pose.updateMatrix();cactus.setMatrixAt(i,pose.matrix);}
  for(let i=0;i<64;i++){const sign=i%2?1:-1;pose.position.set((34+i%5)*sign,0.25,(8+i%21)*sign);pose.scale.set(1,1,1);pose.rotation.y=i;pose.updateMatrix();ferns.setMatrixAt(i,pose.matrix);}plants.add(cactus,ferns);
  for(const b of getMap(mapId).boxes.filter(b=>b.zone==='grotto'&&b.h[0]>8))for(let i=0;i<5;i++){const vine=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.08,1.6+i%3,5),toonMaterial(0x5b9d78));vine.position.set(b.p[0]-5+i*2,b.p[1]-1.4,b.p[2]-10);plants.add(vine);}
  const mistTexture=stamp('','#d5e9df');const mistMaterial=new THREE.SpriteMaterial({map:mistTexture,color:0xc2dbd6,transparent:true,opacity:0.035,depthWrite:false});
  // Soft radial alpha avoids visible rectangles and keeps enemies readable.
  const c=mistTexture.image as HTMLCanvasElement,x=c.getContext('2d')!;x.clearRect(0,0,256,256);const gradient=x.createRadialGradient(128,128,0,128,128,128);gradient.addColorStop(0,'#ffffff');gradient.addColorStop(1,'#ffffff00');x.fillStyle=gradient;x.fillRect(0,0,256,256);mistTexture.needsUpdate=true;
  for(const sign of [-1,1])for(let i=0;i<4;i++){const mist=new THREE.Sprite(mistMaterial);mist.position.set(sign*(39+i*2),0.7,sign*(10+i*4));mist.scale.set(9,2,1);scene.add(mist);}
  const fauna=new THREE.Group();fauna.name='ambient-fauna';scene.add(fauna);
  for(let i=0;i<12;i++){const bird=new THREE.Group();for(const sign of [-1,1]){const wing=new THREE.Mesh(new THREE.ConeGeometry(0.18,1,3),toonMaterial(0x405864));wing.rotation.z=sign*0.9;wing.position.x=sign*0.3;bird.add(wing);}bird.userData.phase=i;fauna.add(bird);}
  for(const sign of [-1,1]){const rotor=new THREE.Group();rotor.name='turbine-'+sign;rotor.position.set(sign*9,5,sign*11);for(let i=0;i<3;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(0.25,1.4,0.12),toonMaterial(0xa4c8ba));blade.rotation.z=i*Math.PI*2/3;rotor.add(blade);}scene.add(rotor);}
  for(const [i,b]of getMap(mapId).boxes.filter(b=>b.zone==='village'&&b.h[2]<1).entries()){const poster=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.4),new THREE.MeshBasicMaterial({map:stamp(i%2?'RIFT CREW':'WATER / 01',i%2?'#a35571':'#3d8988'),side:THREE.DoubleSide}));poster.position.set(b.p[0]+2,2.4,b.p[2]+b.h[2]+0.012);scene.add(poster);}
  for(const sign of [-1,1]){const light=new THREE.PointLight(sign>0?0xffbe75:0x73d3eb,12,28,2);light.position.set(0,5,sign*20);light.name='night-lamp';scene.add(light);}
}
export function themeArena(scene:THREE.Scene,night:boolean):void {
  if(scene.userData.night===night)return;scene.userData.night=night;
  const sun=scene.getObjectByName('arena-sun') as THREE.DirectionalLight;if(sun){sun.color.setHex(night?0x91baff:0xffe2b0);sun.intensity=night?0.9:2.2;}
  scene.traverse(o=>{if(o instanceof THREE.HemisphereLight){o.intensity=night?0.6:1.05;o.color.setHex(night?0x8ba9df:0xfff3df);}if(o.name==='night-lamp')o.visible=night;});
  const sky=scene.getObjectByName('canyon-sky') as THREE.Mesh;if(sky)(sky.material as THREE.MeshBasicMaterial).color.setHex(night?0x273b78:0xffffff);
  scene.fog=new THREE.Fog(night?0x243454:0xdfcbb0,110,245);const water=scene.userData.waterMaterial as THREE.ShaderMaterial|undefined;if(water)water.uniforms.night.value=Number(night);
}
export function animateBiomes(scene:THREE.Scene,time:number,faunaVisible:boolean):void {
  const water=scene.userData.waterMaterial as THREE.ShaderMaterial|undefined;if(water)water.uniforms.time.value=time;
  const plants=scene.getObjectByName('biome-plants');if(plants)plants.rotation.z=Math.sin(time*0.7)*0.001;
  const fauna=scene.getObjectByName('ambient-fauna');if(fauna){fauna.visible=faunaVisible;fauna.children.forEach((bird,i)=>{const a=time*0.08+i*0.52;bird.position.set(Math.cos(a)*44,20+Math.sin(a*2+i)*2,Math.sin(a)*44);bird.rotation.y=-a;bird.children.forEach((w,k)=>w.rotation.z=(k?1:-1)*(0.9+Math.sin(time*5+i)*0.3));});}
  for(const sign of [-1,1]){const rotor=scene.getObjectByName('turbine-'+sign);if(rotor)rotor.rotation.z=time*1.4;}
}
