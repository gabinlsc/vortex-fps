import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const children=[];let stopping=false,exitCode=0;
function stop(code=0){
  if(stopping)return;stopping=true;exitCode=code;
  for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');
}
for(const args of [['--import','tsx','server/main.ts','--local-dev'],['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort']]){
  const child=spawn(process.execPath,args,{cwd,stdio:'inherit'});children.push(child);
  child.on('error',error=>{console.error(error.message);stop(1);});
  child.on('exit',code=>{if(!stopping)stop(code??1);if(children.every(c=>c.exitCode!==null||c.signalCode!==null))process.exitCode=exitCode;});
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
console.log('\nVortex local : http://127.0.0.1:5173 — Ctrl+C pour arrêter.\n');
