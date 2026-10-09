export const MAP_VERSION='rift-canyon-5';
export const MAP_SIZE=128;
export type VecTuple=readonly [number,number,number];
export type SurfaceKind='ground'|'stone'|'metal'|'crate';
export interface ArenaBox {p:VecTuple;h:VecTuple;kind:SurfaceKind;shape?:'rock'|'ramp';yaw?:number;zone?:string}
export const BOXES:ArenaBox[]=[];
const add=(p:VecTuple,h:VecTuple,kind:SurfaceKind='metal',shape?:ArenaBox['shape'],yaw=0,zone?:string)=>BOXES.push({p,h,kind,shape,yaw,zone});
const pair=(p:VecTuple,h:VecTuple,kind:SurfaceKind='metal',shape?:ArenaBox['shape'],yaw=0,zone?:string)=>{
  add(p,h,kind,shape,yaw,zone);add([-p[0],p[1],-p[2]],h,kind,shape,shape==='ramp'?yaw+Math.PI:yaw,zone);
};
add([0,-0.5,0],[64,0.5,64],'ground');
// Solid canyon limits have a faceted skyline rather than a visible fortress wall.
for(const x of [-64,64])add([x,2,0],[1,2,64],'stone',undefined,0,'boundary');
for(const z of [-64,64])add([0,2,z],[64,2,1],'stone',undefined,0,'boundary');
for(let i=0;i<5;i++){
  const offset=-48+i*24,height=11+(i%3)*3;
  pair([75,height,offset],[12,height,15],'stone','rock',0,'cliff');
  pair([offset,height,75],[15,height,12],'stone','rock',0,'cliff');
}
// Four porticoes frame a sheltered plaza, with a roof reached by two continuous ramps.
for(const x of [-10,10])for(const z of [-7,7])add([x,3,z],[0.6,3,3]);
for(const z of [-10,10])for(const x of [-7,7])add([x,3,z],[3,3,0.6]);
add([0,6.65,0],[10.6,0.35,10.6]);
add([0,1.3,0],[1.6,1.3,1.6]);
add([0,7.45,0],[1.7,0.45,1.7]);
pair([-4,0.65,-3],[1.8,0.65,1.2],'crate');
pair([20,3.5,0],[10,3.5,2.6],'metal','ramp',0,'roof-ramp');
// Low parapets allow movement across the roof without an unrestricted firing platform.
pair([7.8,7.55,-7.8],[2.1,0.55,0.65],'crate');
pair([-7.8,7.55,-7.8],[0.65,0.55,2.1],'crate');
// Garden overlooks, gentle access ramps and a sheltered gallery into each grotto.
pair([0,1.2,36],[8,1.2,4],'metal',undefined,0,'garden');
pair([18,1.2,36],[10,1.2,3],'metal','ramp',0,'garden-ramp');
pair([18,2.2,26],[3,0.2,7],'metal',undefined,0,'gallery');
pair([26,2.2,18],[11,0.2,3],'metal',undefined,0,'gallery');
pair([18,1,24],[0.6,1,0.6]);
pair([28,1,18],[0.6,1,0.6]);
pair([0,2.95,36],[1.8,0.55,1],'crate');
pair([-5,2.95,37],[1.2,0.55,1.2],'crate');
// Real planter and trunk colliders anchor the garden vegetation.
for(const x of [-5,5]){
  pair([x,2.8,34],[1,0.4,1],'metal',undefined,0,'planter');
  pair([x,4.75,34],[0.28,1.55,0.28],'stone','rock',0,'tree');
}
// Caves are convex stone shells with two side exits and a broad front entrance.
for(const sign of [-1,1]){
  const x=43*sign,z=18*sign;
  add([x,5.45,z],[10,0.85,12],'stone','rock',0,'grotto');
  for(const side of [-1,1])for(const offset of [-9,9])add([x+side*8*sign,2.4,z+offset*sign],[2.5,2.4,4],'stone','rock',0,'grotto');
  add([x,2.4,z+11*sign],[6,2.4,2],'stone','rock',0,'grotto');
  add([x+3*sign,0.7,z],[1.5,0.7,1.5],'crate');
}
// Deliberately placed cover breaks long sightlines while leaving the main paths open.
for(const [x,z,w,h,d] of [[-26,-22,4.5,3.8,3.7],[24,-16,4.5,4,3.5],[34,42,4.2,3,5],[-28,12,4.5,2.4,3.3],[-38,-39,5,3.5,4],[44,-35,4,2.2,3],[18,48,3,1.8,3],[-16,42,3,2.8,3],[6,23,2.5,1.3,2]]){
  pair([x,h,z],[w,h,d],'stone','rock');
}
for(const [x,z] of [[-18,-32],[34,-8],[46,49],[-48,-46],[0,25],[-25,43],[-40,3]]){
  pair([x,0.65,z],[1.8,0.65,1.3],'crate');
}
export const SPAWNS:readonly VecTuple[]=[
  [-54,1.05,-54],[54,1.05,54],[54,1.05,-54],[-54,1.05,54],
  [-42,1.05,0],[42,1.05,0],[0,1.05,-52],[0,1.05,52],
  [-58,1.05,-12],[58,1.05,12],[-12,1.05,54],[12,1.05,-54]
];
export const ROUTES:readonly (readonly [number,number][])[]=[
  [[0,-60],[0,-44],[-10,-28],[0,-16],[0,16],[10,28],[0,44],[0,60]],
  [[-60,0],[-38,0],[-30,-10],[-18,-15],[-12,-28],[0,-44]],
  [[60,0],[38,0],[30,10],[18,15],[12,28],[0,44]],
  [[-52,-52],[-50,-32],[-43,-18],[-36,-8],[-38,0]],
  [[52,52],[50,32],[43,18],[36,8],[38,0]],
  [[52,-52],[48,-42],[36,-28],[24,-28],[12,-28]],
  [[-52,52],[-48,42],[-36,28],[-24,28],[-12,28]]
];
export function arenaZone(x:number,y:number,z:number):string {
  if(Math.abs(x)<=11&&Math.abs(z)<=11)return y>7?'TOIT / RIFT CORE':'RIFT / PLAZA';
  if(Math.abs(x)>32&&Math.abs(z)>4&&Math.abs(z)<33&&x*z>0)return 'GROTTES / CRISTAL';
  if(Math.abs(z)>30&&Math.abs(z)<42&&Math.abs(x)<29)return z<0?'JARDIN / AZURE':'JARDIN / EMBER';
  if(x*z>0&&Math.abs(x)>14&&Math.abs(x)<37&&Math.abs(z)>15&&Math.abs(z)<33&&y>2.5)return 'GALERIE / PASSERELLE';
  return z<0?'CANYON / AZURE':'CANYON / EMBER';
}
