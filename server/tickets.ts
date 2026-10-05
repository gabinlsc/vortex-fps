import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
export interface Claims {sub:string;match:string;exp:number;jti:string}
export function signTicket(sub:string,match:string,secret:string):string {
  if(secret.length<32)throw new Error('Ticket secret too short');
  const body=Buffer.from(JSON.stringify({sub,match,exp:Math.floor(Date.now()/1000)+30,jti:randomUUID()})).toString('base64url');
  return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
export function verifyTicket(token:string,match:string,secret:string):Claims {
  if(token.length>1024 || secret.length<32)throw new Error('Invalid ticket');
  const parts=token.split('.');if(parts.length!==2)throw new Error('Invalid ticket');
  const signature=Buffer.from(parts[1],'base64url'),expected=createHmac('sha256',secret).update(parts[0]).digest();
  if(signature.length!==expected.length||!timingSafeEqual(signature,expected))throw new Error('Invalid signature');
  const c=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')) as Claims;
  const now=Math.floor(Date.now()/1000);
  if(typeof c.sub!=='string'||!c.sub||c.sub.length>100||c.match!==match||
    !Number.isInteger(c.exp)||c.exp<=now||c.exp>now+60||typeof c.jti!=='string'||c.jti.length>64)throw new Error('Invalid claims');
  return c;
}
