import * as THREE from 'three';
export type PaintedSurface='sand'|'sandstone'|'rose-stone'|'ochre-stone'|'metal'|'cargo'|'ceramic'|'deck'|'bark';
const SIZE=512;
export const CEL_GRADIENT=new THREE.DataTexture(new Uint8Array([102,168,220,255]),4,1,THREE.RedFormat);
CEL_GRADIENT.minFilter=CEL_GRADIENT.magFilter=THREE.NearestFilter;CEL_GRADIENT.needsUpdate=true;
const textures=new Map<PaintedSurface,THREE.CanvasTexture>(),materials=new Map<string,THREE.MeshToonMaterial>();
const palettes={sand:['#d8bc90','#edd6aa','#bea27d'],sandstone:['#c28c6d','#e5b58a','#976953'],'rose-stone':['#aa8790','#d4a7a8','#816976'],'ochre-stone':['#c9a16a','#ead0a0','#9c794f'],metal:['#4b7c8a','#82aeb2','#294553'],cargo:['#d9a265','#f3c886','#825d42'],ceramic:['#eadfc7','#fff1d2','#bcb3a1'],deck:['#395362','#608491','#243947'],bark:['#97745c','#c49971','#725447']} as const;
function seeded(seed:number):()=>number{return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function panel(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,base:string,light:string,dark:string):void{
  ctx.fillStyle=dark;ctx.fillRect(x,y,w,h);ctx.fillStyle=base;ctx.fillRect(x+7,y+7,w-14,h-14);
  ctx.strokeStyle=light;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+9,y+h-10);ctx.lineTo(x+9,y+9);ctx.lineTo(x+w-10,y+9);ctx.stroke();
  ctx.strokeStyle=dark;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+16,y+h-12);ctx.lineTo(x+w-12,y+h-12);ctx.lineTo(x+w-12,y+16);ctx.stroke();
}
export function paintedTexture(kind:PaintedSurface):THREE.CanvasTexture {
  const cached=textures.get(kind);if(cached)return cached;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;const ctx=canvas.getContext('2d')!,random=seeded([...kind].reduce((sum,c)=>sum+c.charCodeAt(0)*103,42));
  const [base,light,dark]=palettes[kind];ctx.fillStyle=base;ctx.fillRect(0,0,SIZE,SIZE);
  // Large translucent brush patches are wrapped for seamless terrain tiles.
  for(let i=0;i<(kind==='sand'?110:45);i++){
    const x=random()*SIZE,y=random()*SIZE,w=35+random()*130,h=8+random()*35;
    for(const sx of [-SIZE,0,SIZE])for(const sy of [-SIZE,0,SIZE]){
      ctx.fillStyle=i%3?light:dark;ctx.globalAlpha=kind==='sand'?0.09:0.075;ctx.beginPath();ctx.moveTo(x+sx,y+sy);ctx.lineTo(x+w+sx,y-5+sy);ctx.lineTo(x+w*0.8+sx,y+h+sy);ctx.lineTo(x-w*0.1+sx,y+h*0.6+sy);ctx.closePath();ctx.fill();
    }
  }ctx.globalAlpha=1;
  if(kind.includes('stone')){
    for(let row=0;row<6;row++){
      const y=row*SIZE/6+18,thickness=7+random()*13;
      ctx.fillStyle=dark;ctx.globalAlpha=0.13;ctx.fillRect(0,y,SIZE,thickness);ctx.globalAlpha=1;
      ctx.strokeStyle=light;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(125,y+10,360,y-10,SIZE,y);ctx.stroke();
      ctx.strokeStyle=dark;ctx.globalAlpha=0.55;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,y+thickness);ctx.bezierCurveTo(125,y+thickness+8,360,y+thickness-8,SIZE,y+thickness);ctx.stroke();ctx.globalAlpha=1;
      for(let j=0;j<3;j++){const x=25+random()*450;ctx.strokeStyle=dark;ctx.globalAlpha=0.3;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(x,y+20);ctx.lineTo(x+18,y+35);ctx.lineTo(x+6,y+48);ctx.stroke();ctx.globalAlpha=1;}
    }
  }else if(kind==='bark'){
    ctx.lineWidth=3;ctx.strokeStyle=dark;for(let x=20;x<SIZE;x+=59){ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+12,180,x-10,350,x,SIZE);ctx.stroke();}
  }else if(kind==='sand'){
    for(let i=0;i<85;i++){
      const x=random()*SIZE,y=random()*SIZE;ctx.fillStyle=i%4?dark:light;ctx.globalAlpha=0.25;ctx.beginPath();ctx.ellipse(x,y,1+random()*3,0.7+random()*1.5,-0.25,0,Math.PI*2);ctx.fill();
    }ctx.globalAlpha=1;
  }else if(kind==='cargo'){
    panel(ctx,0,0,SIZE,SIZE,base,light,dark);
    ctx.fillStyle='#283f50';ctx.fillRect(17,112,478,85);ctx.fillRect(17,378,478,38);
    ctx.fillStyle='#f7d387';for(let x=-60;x<SIZE+60;x+=76){ctx.beginPath();ctx.moveTo(x,112);ctx.lineTo(x+36,112);ctx.lineTo(x+107,197);ctx.lineTo(x+71,197);ctx.fill();}
    panel(ctx,105,218,302,133,base,light,dark);
    ctx.fillStyle='#fff0c9';ctx.font='900 49px sans-serif';ctx.textAlign='center';ctx.fillText('VTX',256,275);ctx.fillStyle='#634c3a';ctx.font='bold 18px monospace';ctx.fillText('RIFT / SUPPLY',256,310);
    for(const x of [29,455]){ctx.fillStyle='#354956';ctx.fillRect(x,235,28,92);ctx.fillStyle='#667b80';ctx.fillRect(x+6,248,16,10);}
    for(const x of [28,483])for(const y of [28,483]){ctx.fillStyle='#ffe1a0';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();}
  }else if(kind==='metal'){
    for(const x of [0,256])for(const y of [0,256]){
      panel(ctx,x,y,256,256,base,light,dark);
      for(const dx of [20,236])for(const dy of [20,236]){ctx.fillStyle=dark;ctx.beginPath();ctx.arc(x+dx,y+dy,4,0,Math.PI*2);ctx.fill();ctx.fillStyle=light;ctx.fillRect(x+dx-2,y+dy-3,3,2);}
    }
    ctx.fillStyle=dark;for(let y=75;y<194;y+=22)ctx.fillRect(36,y,182,9);
    ctx.fillStyle='#d4ceb4';ctx.font='bold 18px monospace';ctx.fillText('VTX / 05',297,310);
    ctx.strokeStyle='#e4c085';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(311,430);ctx.lineTo(350,389);ctx.lineTo(389,430);ctx.stroke();
  }else if(kind==='deck'){
    panel(ctx,0,0,SIZE,SIZE,base,light,dark);
    ctx.lineWidth=6;ctx.strokeStyle=dark;
    for(let i=-SIZE;i<SIZE*2;i+=38){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+SIZE,SIZE);ctx.stroke();ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i-SIZE,SIZE);ctx.stroke();}
    ctx.strokeStyle=light;ctx.lineWidth=2;for(let i=-SIZE;i<SIZE*2;i+=38){ctx.beginPath();ctx.moveTo(i+3,0);ctx.lineTo(i+SIZE+3,SIZE);ctx.stroke();}
    ctx.fillStyle='#d5be8a';ctx.fillRect(0,0,512,12);ctx.fillRect(0,500,512,12);
  }else{
    panel(ctx,0,0,SIZE,SIZE,base,light,dark);
    ctx.strokeStyle='#d1c4ad';ctx.lineWidth=2;ctx.strokeRect(27,27,458,458);
    ctx.fillStyle='#63858b';ctx.fillRect(35,377,442,55);ctx.fillStyle='#263e51';ctx.font='bold 26px monospace';ctx.fillText('RIFT / O5',50,82);
    ctx.strokeStyle='#668f91';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(365,65);ctx.lineTo(427,65);ctx.lineTo(402,122);ctx.closePath();ctx.stroke();
    for(let i=0;i<3;i++){ctx.fillStyle='#ab9d86';ctx.fillRect(42,125+i*12,56-i*13,3);}
  }
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;textures.set(kind,t);return t;
}
export function paintedMaterial(kind:PaintedSurface,vertexColors=false):THREE.MeshToonMaterial {
  const key=kind+':'+vertexColors,cached=materials.get(key);if(cached)return cached;
  const m=new THREE.MeshToonMaterial({map:paintedTexture(kind),gradientMap:CEL_GRADIENT,vertexColors});materials.set(key,m);return m;
}
export function toonMaterial(color:number):THREE.MeshToonMaterial {
  const key='color:'+color,cached=materials.get(key);if(cached)return cached;
  const m=new THREE.MeshToonMaterial({color,gradientMap:CEL_GRADIENT});materials.set(key,m);return m;
}
