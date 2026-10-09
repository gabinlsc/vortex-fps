import {getMap,type MapId} from './maps.ts';
import type {Vec3} from './movement.ts';
// Bounded ground navigation grid. Rapier remains authoritative for every step.
export function navigation(mapId:MapId){
  const n=40,step=3,blocked=new Set<number>();const boxes=getMap(mapId).boxes.filter(b=>b.kind!=='ground'&&b.p[1]-b.h[1]<1.6&&b.p[1]+b.h[1]>0.2);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){const px=-58.5+x*step,pz=-58.5+z*step;if(boxes.some(b=>Math.abs(px-b.p[0])<b.h[0]+0.7&&Math.abs(pz-b.p[2])<b.h[2]+0.7))blocked.add(z*n+x);}
  return (from:Vec3,to:Vec3):Vec3[]=>{
    const cell=(p:Vec3)=>Math.max(0,Math.min(n-1,Math.round((p.z+58.5)/step)))*n+Math.max(0,Math.min(n-1,Math.round((p.x+58.5)/step)));
    const start=cell(from),goal=cell(to),queue=[start],parent=new Map<number,number>([[start,-1]]);let closest=start,dist=Infinity;
    for(let head=0;head<queue.length&&head<1600;head++){const id=queue[head],x=id%n,z=Math.floor(id/n),d=(x-goal%n)**2+(z-Math.floor(goal/n))**2;if(d<dist){dist=d;closest=id;}if(id===goal)break;
      for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,next=nz*n+nx;if(nx<0||nz<0||nx>=n||nz>=n||blocked.has(next)||parent.has(next))continue;parent.set(next,id);queue.push(next);}}
    const path:Vec3[]=[];for(let id=closest;id!==start&&id>=0;id=parent.get(id)??-1)path.push({x:-58.5+id%n*step,y:1,z:-58.5+Math.floor(id/n)*step});return path.reverse();
  };
}
