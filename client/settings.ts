export interface Settings {fov:number;sensitivity:number;volume:number;quality:'low'|'medium'|'high';effects:boolean;reducedMotion:boolean}
export const DEFAULT_SETTINGS:Settings={fov:90,sensitivity:1,volume:25,quality:'medium',effects:true,reducedMotion:false};
export function normalizeSettings(value:unknown):Settings {
  const v=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const number=(key:'fov'|'sensitivity'|'volume',min:number,max:number)=>typeof v[key]==='number'&&Number.isFinite(v[key])?Math.max(min,Math.min(max,v[key] as number)):DEFAULT_SETTINGS[key];
  return {fov:number('fov',75,110),sensitivity:number('sensitivity',0.3,3),volume:number('volume',0,100),quality:v.quality==='low'||v.quality==='high'?v.quality:'medium',effects:typeof v.effects==='boolean'?v.effects:true,reducedMotion:typeof v.reducedMotion==='boolean'?v.reducedMotion:false};
}
export function loadSettings():Settings{try{return normalizeSettings(JSON.parse(localStorage.getItem('vortex-settings')??'{}'));}catch{return {...DEFAULT_SETTINGS};}}
export function saveSettings(value:Settings):void{try{localStorage.setItem('vortex-settings',JSON.stringify(value));}catch{}}
