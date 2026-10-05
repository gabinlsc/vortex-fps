export const CHARACTERS=Object.freeze([
  {name:'Spectre',role:'Recon',color:0x8098ae,accent:0x64ffde,description:'Armure graphite, visière cyan et profil furtif.'},
  {name:'Ember',role:'Assault',color:0xc56e45,accent:0xffba67,description:'Plaques cuivrées, épaulières renforcées et réacteur orange.'},
  {name:'Prism',role:'Tech',color:0xc8cddd,accent:0xb395ff,description:'Coque céramique, antennes et cœur ultraviolet.'}
] as const);
// Admission validates cosmetics once. They never affect hitboxes or movement.
export function validateCharacter(value:unknown):number {
  if(!Number.isInteger(value)||Number(value)<0||Number(value)>=CHARACTERS.length)throw new Error('Invalid character');
  return Number(value);
}
