import RAPIER from '@dimforge/rapier3d-compat';
import { Button, DT, type Input } from './input.ts';
import { MOVE, copyState, integrateVelocity, clipVelocity, type MotionState } from './movement.ts';
import { BOXES } from './map.ts';
let rapierReady:Promise<void>|undefined;
export async function createArena():Promise<RAPIER.World> {
  rapierReady??=RAPIER.init();
  await rapierReady;
  const world=new RAPIER.World({x:0,y:0,z:0}); world.timestep=DT;
  for (const box of BOXES) {
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      box.h[0], box.h[1], box.h[2]
    ).setTranslation(
      box.p[0], box.p[1], box.p[2]
    )
  );
}
  world.step(); return world;
}
export class RapierMotor {
  readonly collider:RAPIER.Collider;
  readonly controller:RAPIER.KinematicCharacterController;
  state:MotionState;
  private readonly solids = (c:RAPIER.Collider)=>c.handle!==this.collider.handle && !this.players.has(c.handle);
  constructor(readonly world:RAPIER.World, state:MotionState, private readonly players:Set<number>) {
    this.state=copyState(state);
    this.collider=world.createCollider(RAPIER.ColliderDesc.capsule(MOVE.standHalf,MOVE.radius)
      .setTranslation(state.p.x,state.p.y,state.p.z));
    players.add(this.collider.handle);
    this.controller=world.createCharacterController(MOVE.skin);
    this.controller.setMaxSlopeClimbAngle(Math.PI/4);
    this.controller.setMinSlopeSlideAngle(Math.PI/4);
    this.controller.disableAutostep(); // competitive blockout uses explicit ramps, no teleporting steps
    this.controller.enableSnapToGround(0.15);
    this.controller.setApplyImpulsesToDynamicBodies(false);
  }
  restore(state:MotionState):void {
    const changed=this.state.crouched!==state.crouched;
    this.state=copyState(state);
    if(changed)this.collider.setShape(new RAPIER.Capsule(state.crouched?MOVE.crouchHalf:MOVE.standHalf,MOVE.radius));
    this.collider.setTranslation(state.p);
  }
  private stance(crouched:boolean):void {
    const s=this.state;if(s.crouched===crouched)return;
    const oldHalf=s.crouched?MOVE.crouchHalf:MOVE.standHalf;
    const newHalf=crouched?MOVE.crouchHalf:MOVE.standHalf;
    // Keep feet fixed when resizing. Never expand into a ceiling.
    const target={x:s.p.x,y:s.p.y+newHalf-oldHalf,z:s.p.z};
    const shape=new RAPIER.Capsule(newHalf,MOVE.radius);
    if(!crouched && this.world.intersectionWithShape(target,{x:0,y:0,z:0,w:1},shape,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.collider,undefined,this.solids)) return;
    s.crouched=crouched;s.p=target;this.collider.setShape(shape);this.collider.setTranslation(target);
  }
  tick(input:Input):void {
    this.stance(Boolean(input.buttons&Button.Slide));
    integrateVelocity(this.state,input);
    const s=this.state,desired={x:s.v.x*DT,y:s.v.y*DT,z:s.v.z*DT};
    if(s.v.y>0) this.controller.disableSnapToGround(); else this.controller.enableSnapToGround(0.15);
    this.controller.computeColliderMovement(this.collider,desired,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,this.solids);
    const delta=this.controller.computedMovement();
    s.p.x+=delta.x;s.p.y+=delta.y;s.p.z+=delta.z;
    // normal1 is the world-space outward normal of the obstacle for this shape cast.
    for(let i=0;i<this.controller.numComputedCollisions();i++) {
      const hit=this.controller.computedCollision(i); if(hit) clipVelocity(s.v,hit.normal1);
    }
    s.grounded=this.controller.computedGrounded();
    if(s.grounded && s.v.y<0)s.v.y=0;
    this.collider.setTranslation(s.p);
    if(!Object.values(s.p).every(Number.isFinite)||!Object.values(s.v).every(Number.isFinite)) throw new Error('Invalid physics state');
  }
  dispose():void {
    this.players.delete(this.collider.handle);
    this.world.removeCharacterController(this.controller);
    this.world.removeCollider(this.collider,true);
  }
}
export function eye(s:MotionState) { return {x:s.p.x,y:s.p.y+(s.crouched?0.35:0.65),z:s.p.z}; }
