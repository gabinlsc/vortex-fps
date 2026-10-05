export interface Candidate {id:string;rating:number;waitSeconds:number;rtt:Record<string,number>}
export function chooseRegion(players:readonly Candidate[],eligible:readonly string[],maxRtt=30):string|null {
  let best:string|null=null,bestScore=Infinity;
  for(const region of eligible){
    const rtts=players.map(p=>p.rtt[region]);
    if(rtts.some(x=>!Number.isFinite(x)||x<0||x>maxRtt))continue;
    // Minimax first: never minimize mean at the expense of a remote party member.
    const score=Math.max(...rtts)*1000+rtts.reduce((a,b)=>a+b,0);
    if(score<bestScore){bestScore=score;best=region;}
  }return best;
}
export function ratingCompatible(a:Candidate,b:Candidate):boolean {
  const width=Math.min(300,50+Math.min(a.waitSeconds,b.waitSeconds)*5);
  return Math.abs(a.rating-b.rating)<=width;
}
export function elo(a:number,b:number,score:0|0.5|1,k=24):[number,number] {
  const expected=1/(1+10**((b-a)/400)),delta=Math.round(k*(score-expected));return [a+delta,b-delta];
}
export interface Allocation {state:string;gameServerName?:string;address?:string;ports?:{name:string;port:number}[]}
// Call from a region-specific worker with mTLS + RBAC-limited credentials.
// The caller persists a match lease before I/O. After a timeout, query GameServers by vortex.dev/match.
// GameServerAllocation itself must not be treated as a durable idempotency ledger. No blind POST retry.
export async function allocate(base:string,bearer:string,namespace:string,name:string,build:string):Promise<Allocation>{
  const url=`${base}/apis/allocation.agones.dev/v1/namespaces/${encodeURIComponent(namespace)}/gameserverallocations`;
  const r=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${bearer}`,'content-type':'application/json'},
    body:JSON.stringify({apiVersion:'allocation.agones.dev/v1',kind:'GameServerAllocation',metadata:{name},spec:{
      selectors:[{matchLabels:{'agones.dev/fleet':`vortex-${build}`},gameServerState:'Ready'}],
      metadata:{labels:{'vortex.dev/match':name}}
    }}),signal:AbortSignal.timeout(3000)});
  if(!r.ok)throw new Error(`Allocation failed: ${r.status}`);
  const result=await r.json() as {status:Allocation};
  if(result.status.state!=='Allocated')throw new Error('No Ready server; replenish fleet and requeue');
  return result.status;
}
