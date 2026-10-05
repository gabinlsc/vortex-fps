export const MAP_VERSION='arena-blockout-1';
// Authoritative collision assets. Production builds hash this list and all shared simulation assets.
export const BOXES = [
  {p:[0,-0.5,0],h:[24,0.5,24]},
  {p:[-24,3,0],h:[0.5,3,24]}, {p:[24,3,0],h:[0.5,3,24]},
  {p:[0,3,-24],h:[24,3,0.5]}, {p:[0,3,24],h:[24,3,0.5]},
  {p:[-5,1,-4],h:[3,1,2]}, {p:[7,1,5],h:[2,1,4]},
  {p:[0,0.4,8],h:[3,0.4,2]}, {p:[4,2,-9],h:[1,2,2]}
] as const;
