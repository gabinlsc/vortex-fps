export const MAP_VERSION='rift-outpost-3';
export const MAP_SIZE=128;
export type VecTuple=readonly [number,number,number];
export interface ArenaBox {p:VecTuple;h:VecTuple;kind:'ground'|'stone'|'metal'|'crate'}
export const BOXES:ArenaBox[]=[];
const add=(p:VecTuple,h:VecTuple,kind:ArenaBox['kind']='metal')=>BOXES.push({p,h,kind});
add([0,-0.5,0],[64,0.5,64],'ground');
add([-64,6,0],[1,6,64],'stone');add([64,6,0],[1,6,64],'stone');
add([0,6,-64],[64,6,1],'stone');add([0,6,64],[64,6,1],'stone');
for(const x of [-10,10])for(const z of [-7,7])add([x,3,z],[0.6,3,3]);
for(const z of [-10,10])for(const x of [-7,7])add([x,3,z],[3,3,0.6]);
add([0,6.5,0],[10.6,0.5,10.6]);
add([-4,0.65,-3],[2,0.65,1.5],'crate');add([4,0.65,3],[2,0.65,1.5],'crate');
for(const sign of [-1,1]){
  const x=42*sign,z=18*sign;
  add([x,5.4,z],[9,0.6,12],'stone');
  add([x-7*sign,2.4,z],[2,2.4,12],'stone');
  for(const offset of [-8,8])add([x+7*sign,2.4,z+offset],[2,2.4,4],'stone');
  add([x+13*sign,2.4,z],[2,2.4,5],'stone');
  for(const offset of [-5,5])add([x+10*sign,2.4,z+offset],[3,2.4,1],'stone');
  add([x,0.8,z],[1.4,0.8,1.4],'crate');
}
for(const sign of [-1,1]){
  for(const [x,z,w,h,d] of [[22,18,3,2.2,4],[26,-12,4,3.5,2],[14,34,3,2,3],[36,42,3,2.5,4],[6,45,2,1.5,3],[-20,38,3,2,3],[-28,-30,3,3,4],[-14,-22,2,1.5,4]]){
    add([x*sign,h,z*sign],[w,h,d],'stone');
    add([(x+w+2)*sign,0.6,(z+3)*sign],[1.8,0.6,1.8],'crate');
  }
  for(const [x,z] of [[18,0],[24,30],[-24,12],[0,25],[48,-30],[-40,-42]]){
    add([x*sign,0.7,z*sign],[2,0.7,1.5],'crate');
    add([(x+3)*sign,0.35,z*sign],[1,0.35,1.5],'crate');
  }
}
export const SPAWNS:readonly VecTuple[]=[
  [-54,1.05,-54],[54,1.05,54],[54,1.05,-54],[-54,1.05,54],
  [-42,1.05,0],[42,1.05,0],[0,1.05,-52],[0,1.05,52],
  [-58,1.05,-12],[58,1.05,12],[-12,1.05,54],[12,1.05,-54]
];
