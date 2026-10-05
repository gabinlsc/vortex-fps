// REST sidecar, not the public allocator. No Kubernetes credentials in the game process.
export class AgonesLifecycle {
  private healthTimer:ReturnType<typeof setInterval>|undefined;
  readonly base=`http://127.0.0.1:${process.env.AGONES_SDK_HTTP_PORT??9358}`;
  private async post(path:string):Promise<void>{
    const r=await fetch(this.base+path,{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(1500)});
    if(!r.ok)throw new Error(`Agones ${path}: ${r.status}`);
  }
  async ready():Promise<void>{
    if(process.env.AGONES!=='true')return;
    // Sidecar may start after the game container. Bounded retry before declaring Ready.
    const deadline=Date.now()+20000;
    for(;;){try{await this.post('/ready');break;}catch(error){if(Date.now()>=deadline)throw error;
      await new Promise(resolve=>setTimeout(resolve,250));}}
    this.healthTimer=setInterval(()=>void this.post('/health').catch(()=>{console.error('Agones sidecar health failed');}),2000);
  }
  async shutdown():Promise<void>{
    if(this.healthTimer)clearInterval(this.healthTimer);
    if(process.env.AGONES==='true')await this.post('/shutdown');
  }
}
