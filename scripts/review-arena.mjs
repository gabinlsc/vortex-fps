import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
const cwd=fileURLToPath(new URL('../',import.meta.url)),port=4185,url=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd,stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',d=>logs+=String(d));server.stderr.on('data',d=>logs+=String(d));
let browser;
try{
  const deadline=Date.now()+30000;
  while(true){try{if((await fetch(url)).ok)break;}catch{}if(Date.now()>deadline)throw new Error('Vite preview failed: '+logs);await new Promise(r=>setTimeout(r,150));}
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/arena-review',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0"><canvas id="review"></canvas></body>'}));
  await page.goto(url+'/arena-review');
  await page.evaluate(async()=>{
    const THREE=await import('/node_modules/.vite/deps/three.js');
    const {buildArena,animateArena}=await import('/client/arena.ts');
    const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('review'),antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,900);renderer.toneMapping=THREE.ACESFilmicToneMapping;
    const scene=new THREE.Scene();buildArena(scene);animateArena(scene,2);const camera=new THREE.PerspectiveCamera(70,1440/900,0.05,300);
    window.renderReview=(position,target)=>{camera.position.set(...position);camera.lookAt(...target);renderer.render(scene,camera);return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
  });
  await mkdir(new URL('../test-results/map-review/',import.meta.url),{recursive:true});
  for(const [name,position,target]of [['overview',[54,36,58],[0,3,0]],['plaza',[0,2,-26],[0,6,0]],['grotto',[42,1.7,5],[43,2.3,19]],['garden',[-7,5.2,-45],[0,3,-28]],['roof',[7,8.6,-7],[0,9,0]]]){
    const metrics=await page.evaluate(({position,target})=>window.renderReview(position,target),{position,target});
    await page.screenshot({path:`test-results/map-review/${name}.png`});console.log(name,metrics);
  }
  if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser?.close();server.kill();}
