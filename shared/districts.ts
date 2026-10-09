import type {ArenaBox,VecTuple} from './map.ts';
export function expandCanyon(boxes:ArenaBox[]):void {
  const add=(p:VecTuple,h:VecTuple,kind:ArenaBox['kind']='stone',zone='district',shape?:ArenaBox['shape'],yaw=0)=>boxes.push({p,h,kind,zone,shape,yaw});
  // Clear cover inside the new districts, preserving the original routes and spawns.
  for(let i=boxes.length-1;i>=0;i--){const b=boxes[i];if(!b.zone&&b.kind!=='ground'&&Math.abs(b.p[0])>27&&Math.abs(b.p[2])>32)boxes.splice(i,1);}
  // Open village courtyards, roofed rooms with wide, legible doorways.
  for(const x of [-42,-29]){
    add([x,4.65,43],[5.5,0.35,5.5],'metal','village');
    for(const z of [38,48])add([x,2.15,z],[5,2.15,0.55],'stone','village','rock');
    for(const z of [39.5,46.5])add([x-5,2.15,z],[0.6,2.15,1.5],'stone','village','rock');
    add([x+5,2.15,43],[0.6,2.15,5],'stone','village','rock');
  }
  // Freight wagons: wall/roof shells rather than inaccessible solid cubes.
  for(const x of [-43,-31]){
    add([x,0.25,-42],[3,0.25,7],'metal','freight');
    add([x,3.75,-42],[3,0.25,7],'metal','freight');
    for(const side of [-1,1])add([x+side*2.8,2,-42],[0.2,1.5,6.8],'metal','freight');
    add([x,0.25,-32],[3,0.25,3],'metal','ramp', 'ramp',-Math.PI/2);
  }
  // Temple colonnade and a covered route to its crystal chamber.
  add([39,5.5,-42],[8,0.5,7],'stone','temple','rock');
  for(const x of [32,46])for(const z of [-47,-37])add([x,2.5,z],[0.9,2.5,0.9],'stone','temple','rock');
  add([39,0.25,-42],[4,0.25,4],'stone','temple');
  add([39,2.5,-49],[7,2.5,0.7],'stone','temple','rock');
  // Scaffold platform and walkable incline, with a sheltered lower passage.
  add([40,4.2,43],[7,0.2,5],'metal','construction');
  for(const x of [34,46])for(const z of [39,47])add([x,2,z],[0.25,2,0.25],'metal','construction');
  add([40,2,31],[3,2,7],'metal','construction-ramp','ramp',Math.PI/2);
  // Greenhouse on the garden: solid posts, glass as penetrable decor.
  for(const sign of [-1,1]){
    for(const x of [-7,7])for(const z of [33,39])add([x,4.1,z*sign],[0.16,1.7,0.16],'metal','greenhouse');
    add([0,5.9,36*sign],[7.4,0.15,3.7],'metal','greenhouse');
    // Canyon terraces reached by continuous inclines.
    add([56*sign,1.5,29*sign],[4,1.5,5],'stone','terrace','rock');
    add([56*sign,1.5,15*sign],[3,1.5,9],'stone','terrace-ramp','ramp',sign*Math.PI/2);
    // Suspended deck between the grotto and the terrace, accessed at both ends.
    add([47*sign,2.85,28*sign],[8,0.15,2],'metal','bridge');
    add([37*sign,1.5,28*sign],[2,1.5,4],'metal','bridge-ramp','ramp',sign>0?Math.PI:0);
    // Natural stone arch across a ground-level path.
    for(const z of [-6,6])add([47*sign,2.6,z],[1.4,2.6,1.4],'stone','arch','rock');
    add([47*sign,5.55,0],[2.2,0.45,7.3],'stone','arch','rock');
    // Covered grotto connector: no false decorative obstacles.
    add([31*sign,3.5,8*sign],[9,0.5,3],'stone','tunnel','rock');
    add([31*sign,1.5,11*sign],[9,1.5,0.7],'stone','tunnel','rock');
  }
}
