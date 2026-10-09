import type {ArenaBox} from './map.ts';
import type {Vec3} from './movement.ts';
export interface SolidMesh {vertices:number[];indices:number[]}
// Local convex meshes are the single source for Rapier, rendering and raycasts.
export function solidMesh(s:ArenaBox):SolidMesh {
  const [x,y,z]=s.h;
  if(s.shape==='ramp')return {vertices:[-x,-y,-z,x,-y,-z,x,-y,z,-x,-y,z,-x,y,-z,-x,y,z],indices:[0,1,2,0,2,3,0,4,1,3,2,5,5,1,4,5,2,1,0,5,4,0,3,5]};
  const corners=s.shape==='rock'?[[1,0.62],[0.62,1],[-0.62,1],[-1,0.62],[-1,-0.62],[-0.62,-1],[0.62,-1],[1,-0.62]]:[[1,1],[-1,1],[-1,-1],[1,-1]];
  const rings=s.shape==='rock'?[[0.92,-1],[1,-0.15],[0.73,1]]:[[1,-1],[1,1]];
  const vertices:number[]=[],indices:number[]=[],n=corners.length;
  for(const [scale,height]of rings)for(const [u,v]of corners)vertices.push(u*x*scale,height*y,v*z*scale);
  for(let ring=0;ring<rings.length-1;ring++)for(let i=0;i<n;i++){
    const a=ring*n+i,b=ring*n+(i+1)%n,c=(ring+1)*n+i,d=(ring+1)*n+(i+1)%n;
    indices.push(a,c,b,b,c,d);
  }
  for(let i=1;i<n-1;i++){indices.push(0,i,i+1);const top=(rings.length-1)*n;indices.push(top,top+i+1,top+i);}
  return {vertices,indices};
}
export interface ConvexPlane {x:number;y:number;z:number;w:number}
export interface SolidQuery {solid:ArenaBox;planes:ConvexPlane[];cos:number;sin:number}
export function solidQuery(solid:ArenaBox):SolidQuery {
  const {vertices:v,indices:ix}=solidMesh(solid),planes:ConvexPlane[]=[];
  // Orient faces outward using the interior vertex centroid, even for wedges.
  const center=[0,0,0];for(let i=0;i<v.length;i++)center[i%3]+=v[i]/(v.length/3);
  for(let i=0;i<ix.length;i+=3){
    const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;
    const ux=v[b]-v[a],uy=v[b+1]-v[a+1],uz=v[b+2]-v[a+2],vx=v[c]-v[a],vy=v[c+1]-v[a+1],vz=v[c+2]-v[a+2];
    let x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;
    const length=Math.hypot(x,y,z);x/=length;y/=length;z/=length;
    let w=x*v[a]+y*v[a+1]+z*v[a+2];
    if(x*center[0]+y*center[1]+z*center[2]>w){x=-x;y=-y;z=-z;w=-w;}
    if(!planes.some(p=>Math.abs(p.x-x)+Math.abs(p.y-y)+Math.abs(p.z-z)+Math.abs(p.w-w)<1e-6))planes.push({x,y,z,w});
  }
  const yaw=solid.yaw??0;return {solid,planes,cos:Math.cos(yaw),sin:Math.sin(yaw)};
}
export function raySolid(origin:Vec3,direction:Vec3,q:SolidQuery):number|null {
  const px=origin.x-q.solid.p[0],py=origin.y-q.solid.p[1],pz=origin.z-q.solid.p[2];
  const x=q.cos*px-q.sin*pz,z=q.sin*px+q.cos*pz;
  const dx=q.cos*direction.x-q.sin*direction.z,dz=q.sin*direction.x+q.cos*direction.z;
  let enter=0,leave=Infinity;
  for(const p of q.planes){
    const distance=p.w-p.x*x-p.y*py-p.z*z,rate=p.x*dx+p.y*direction.y+p.z*dz;
    if(Math.abs(rate)<1e-10){if(distance<-1e-7)return null;continue;}
    const t=distance/rate;if(rate<0)enter=Math.max(enter,t);else leave=Math.min(leave,t);
    if(enter>leave+1e-7)return null;
  }
  return leave>=0?enter:null;
}
export function traceSolids(origin:Vec3,direction:Vec3,queries:readonly SolidQuery[],range=200):number {
  let nearest=range;for(const q of queries){const hit=raySolid(origin,direction,q);if(hit!==null&&hit<nearest)nearest=hit;}return nearest;
}
