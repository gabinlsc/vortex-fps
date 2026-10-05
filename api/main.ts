import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {Module,Controller,Post,Get,Body,Req,Inject,Injectable,UseGuards,UnauthorizedException,BadRequestException,type CanActivate,type ExecutionContext} from '@nestjs/common';
import {PrismaClient} from '@prisma/client';
import {createRemoteJWKSet,jwtVerify} from 'jose';
const REGION_IDS=new Set(['eu-paris','eu-frankfurt','eu-london','us-ashburn','us-chicago','us-dallas','us-losangeles']);
@Injectable()
class IdentityGuard implements CanActivate {
  private jwks:ReturnType<typeof createRemoteJWKSet>;
  constructor(){
    if(!process.env.OIDC_JWKS_URL||!process.env.OIDC_ISSUER||!process.env.OIDC_AUDIENCE)throw new Error('OIDC configuration required');
    const url=new URL(process.env.OIDC_JWKS_URL);if(url.protocol!=='https:')throw new Error('HTTPS JWKS required');
    this.jwks=createRemoteJWKSet(url);
  }
  async canActivate(context:ExecutionContext):Promise<boolean>{
    const req=context.switchToHttp().getRequest();
    const token=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9._-]{20,4096})$/)?.[1];
    if(!token)throw new UnauthorizedException();
    try{
      const {payload}=await jwtVerify(token,this.jwks,{issuer:process.env.OIDC_ISSUER,audience:process.env.OIDC_AUDIENCE,algorithms:['RS256','ES256']});
      if(!payload.sub)throw new Error('Missing subject');req.subject=payload.sub;return true;
    }catch{throw new UnauthorizedException();}
  }
}
@Controller('v1')
@UseGuards(IdentityGuard)
class QueueController {
  constructor(@Inject(PrismaClient)private db:PrismaClient){}
  @Post('queue')
  async enqueue(@Req()req:{subject:string},@Body()body:{regions:unknown}){
    if(!body||typeof body.regions!=='object'||body.regions===null||Array.isArray(body.regions))throw new BadRequestException('regions required');
    const regions=body.regions as Record<string,number>,entries=Object.entries(regions);
    if(entries.length<1||entries.length>7||entries.some(([k,v])=>!REGION_IDS.has(k)||!Number.isFinite(v)||v<0||v>1000))
      throw new BadRequestException('Invalid latency reports');
    // Reports choose region only; game-server measured RTT alone controls rewind.
    const user=await this.db.user.upsert({where:{oidcSubject:req.subject},update:{},create:{oidcSubject:req.subject}});
    const ticket=await this.db.queueTicket.upsert({where:{userId:user.id},update:{regions},create:{userId:user.id,rating:user.rating,regions}});
    return {id:ticket.id,status:ticket.status};
  }
  @Get('queue')
  async queue(@Req()req:{subject:string}){
    const user=await this.db.user.findUnique({where:{oidcSubject:req.subject}});
    if(!user)return {status:'ABSENT'};
    const ticket=await this.db.queueTicket.findUnique({where:{userId:user.id}});return ticket?{id:ticket.id,status:ticket.status,matchId:ticket.matchId}:{status:'ABSENT'};
  }
}
@Module({controllers:[QueueController],providers:[IdentityGuard,{provide:PrismaClient,useFactory:()=>new PrismaClient()}]})
class AppModule{}
const app=await NestFactory.create(AppModule,{bodyParser:false});
// Explicitly bounded body parser and HTTPS reverse proxy. No ticket issuer exposed on public routes.
const express=await import('express');app.use(express.json({limit:'4kb'}));
app.enableShutdownHooks();await app.listen(Number(process.env.API_PORT??3000),'127.0.0.1');
