'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const load=require('./longneck-fixture'),capture=require('./monster-reference-capture');
const expected=require('./fixtures/monster-home-reference.json'),actual=capture();
for(const key in expected)expected[key].forEach((row,i)=>row.forEach((v,j)=>
 assert(Math.abs(v-actual[key][i][j])<1e-7,`${key} ${i}/${j}: original Monster home pose`)));
const html=fs.readFileSync('index.html','utf8');
function setup(form,kind){
 const {api,context,THREE}=load();
 const originalFactory=context.createMonsterAnimationSystem;
 context.createMonsterAnimationSystem=(...args)=>{
  const system=originalFactory(...args),layer=system.layer;
  system.layer=(m,t)=>{m.root.userData.monsterLayerCalls=(m.root.userData.monsterLayerCalls||0)+1;return layer(m,t);};return system;
 };
 const terrain={group:api.worldGroup,groundYAt:()=>0,
  worldToCell:(x,z)=>({x:Math.floor(x),z:Math.floor(z),islandId:'test'}),
  cellToWorld:(x,z)=>({x:x+.5,z:z+.5}),getCell:()=>({terrain:'stone',terrainFloors:1,islandId:'test'})};
 Object.assign(context,{explorationTerrain:terrain,explorationActive:true,activeFPTerrain:()=>terrain});
 vm.runInContext(html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  function fpGroundYAt(')),context);
 const root=api.createBattleBroCharacter({character:'monsters',form,variant:'ice'});api.worldGroup.add(root);root.position.set(.5,0,.5);
 let mover,actor;
 if(kind==='home')mover=api.registerLavaMonsterMover(root,32,32);
 else{
  if(kind==='cube'){context.bindTransportBattleBro(root);actor=root.userData.transportActor;}
  else actor={root,character:'monsters',phase:0,x:0,z:0,islandId:'test',mover:{root}};
  context.tickExplorationResidentMotion(actor,0,0);mover=actor.mover;
 }
 mover.pauseRemaining=Infinity;mover.homeJumpWait=Infinity;
 if(actor)actor.motion.pause=Infinity;
 else api.tickLavaMonsterMovers(0,0); // Match the release/resident initialization frame and inertia history.
 assert.equal(mover.monsterAnimation,api.ensureMonsterAnimation(mover),'One bound Monster controller');
 assert.equal(mover.monsterAnimation.family,'monsters');assert(!mover.juggernautAnimation,'No second bound support controller');
 assert.equal(mover.parts,root.userData.locomotionRig,'Lower locomotion rig retained separately from upper rig');
 assert.notEqual(mover.parts,root.userData.rig);
 assert.equal([...api.lavaMonsterMovers].filter(m=>m.root===root).length,kind==='home'?1:0,'Exactly one context owns updates');
 return {root,mover,actor,api,context,THREE,animation:mover.monsterAnimation,
  tick(t,dt){if(actor)context.tickExplorationResidentMotion(actor,t,dt);else api.tickLavaMonsterMovers(t,dt);}};
}
function configure(a,state){
 const m=a.mover;
 Object.assign(m,{startX:.5,startZ:.5,startY:0,targetX:.5,targetZ:1.5,targetY:0,
  targetCellX:m.cellX,targetCellZ:m.cellZ+1,desiredYaw:state==='turn'?Math.PI/2:0});
 if(state==='turn')Object.assign(m,{targetX:1.5,targetZ:.5,targetCellX:m.cellX+1,targetCellZ:m.cellZ});
 // Production home terrain plan; flat resolved inputs match resident plans.
 m.terrainPlan=a.api.planLavaTerrainMove(m,m.targetCellX,m.targetCellZ,m.desiredYaw);
 assert(m.terrainPlan,`Form ${a.root.userData.form}, ${a.actor?'endless':'home'}, ${state}: supplied route has contacts`);
 if(state==='turn')m.state='TURNING';
 else if(state==='walk'||state==='run'){
  m.rightGoal.copy(m.terrainPlan.swings[0].end);m.leftGoal.copy(m.terrainPlan.swings[1].end);
  if(state==='run'){
   m.juggernautJog={support:0,total:1,remaining:1};a.context.testMover=m;
   vm.runInContext('beginJuggernautRun(testMover)',a.context);
   if(a.actor)m.animationNavigation.runTargetValid=()=>true;
  }else a.api.beginJuggernautStride(m);
 }
 if(a.actor)a.actor.motion.mode=state==='idle'?'idle':state==='turn'?'turn':'walk';
}
function pose(a){
 const p=a.mover.parts,u=a.root.userData.rig;
 return [a.root,p.rig,p.torso,p.leftArm.shoulder,p.leftArm.elbow,p.leftArm.hand,p.rightArm.shoulder,p.rightArm.elbow,p.rightArm.hand,
  u.torso,u.head,u.head2,u.shoulderWeaponSpin,...[u.leftUpperArm,u.rightUpperArm].filter(Boolean).flatMap(r=>[r.shoulder,r.arm,r.elbow,r.hand])]
  .filter(Boolean).flatMap(n=>[...n.position.toArray(),...n.quaternion.toArray()]);
}
for(let form=1;form<=7;form++)for(const state of ['idle','turn','walk','run']){
 const actors=['home','resident','cube'].map(kind=>setup(form,kind));actors.forEach(a=>configure(a,state));
 let airborne=false,landing=false;const previous=new Map();
 for(let frame=0;frame<90;frame++){
  for(const a of actors){
   const calls=a.root.userData.monsterLayerCalls||0;a.tick(frame/60,1/60);
   assert.equal(a.root.userData.monsterLayerCalls,calls+1,'Family layer is applied exactly once per frame');
   const m=a.mover,parts=m.parts;a.root.updateMatrixWorld(true);
   for(const [i,anchor] of [m.leftAnchor,m.rightAnchor].entries()){
    const hand=parts[i?'rightArm':'leftArm'].hand.getWorldPosition(new a.THREE.Vector3());
    const target=anchor.clone();target.y+=m.terrainContacts[i].sole;
    assert(hand.distanceTo(target)<1e-5,`${form} ${state}: articulated support reaches its persistent anchor`);
    const prev=previous.get(a)?.[i];
    if(prev?.planted&&m.supportContacts[i])assert(anchor.distanceTo(prev.position)<1e-6,`${form} ${state}: planted foot does not slide`);
   }
   previous.set(a,[m.leftAnchor,m.rightAnchor].map((v,i)=>({position:v.clone(),planted:m.supportContacts[i]})));
   if(m.juggernautRun?.phase==='FLIGHT'){airborne=true;assert(!m.grounded&&m.supportContacts.every(c=>!c));}
   if(m.juggernautRun?.phase==='LAND'){landing=true;assert(m.grounded);}
  }
  const ref=pose(actors[0]);for(const a of actors.slice(1))pose(a).forEach((v,i)=>
   assert(Math.abs(v-ref[i])<1e-7,`${form} ${state} ${frame}/${i}: equivalent inputs produce the same home/resident/cube pose`));
 }
 if(state==='run')assert(airborne&&landing,'Same run flight and landing contacts in every context');
 if(state==='idle'&&form===7)for(const a of actors){
  assert(Math.abs(a.root.userData.rig.shoulderWeaponSpin.rotation.y-(89/60)*Math.PI/12)<1e-8,'Form VII always uses its authored apex idle layer');
 }
}
// Rejected phases, turn cancellation, terrain transport and root ownership.
for(let form=1;form<=7;form++){
 const a=setup(form,'cube'),m=a.mover;configure(a,'turn');
 const rootPos=a.root.position.clone(),yaw=a.root.rotation.y;
 let p=a.animation.prepare({},1/60,0);assert(a.root.position.equals(rootPos));assert.equal(a.root.rotation.y,yaw);
 a.root.position.copy(p.position);a.root.rotation.y=p.yaw;a.animation.commit({grounded:true},0,1/60);
 const progress=m.turn.progress,upper={...m.upperTurn};
 a.animation.prepare({},1/60,1/60);a.animation.commit({accepted:0,grounded:true},1/60,1/60);
 assert.equal(m.turn.progress,progress);assert.deepEqual(m.upperTurn,upper,'Rejected turn rolls back upper-body anticipation too');
 const drift=new a.THREE.Vector3(.3,0,-.2);a.root.position.add(drift);a.animation.carry(drift);
 p=a.animation.prepare({blocked:true},1/60,2/60);a.root.position.copy(p.position);a.root.rotation.y=p.yaw;
 a.animation.commit({grounded:true},2/60,1/60);assert(m.actualSpeed<1e-8,'Island drift is not walking velocity');
 a.root.position.set(8,0,9);a.animation.reset();assert(!m.upperTurn&&!m.turn&&!m.terrainPlan);
 for(const v of [m.leftAnchor,m.rightAnchor])assert(v.distanceTo(a.root.position)<2,'Relocation rebuilds local contacts');
 if(form===7){a.root.userData.rig.torso.rotation.y=.2;}
 p=a.animation.prepare({blocked:true},0,0);a.animation.commit({grounded:true},0,0);
 assert.equal(a.root.userData.rig.torso.rotation.y,0,'Cancelled turn cannot leave upper torso yaw in idle');
 const motion=a.root.userData.upperArmMotion;
 if(motion){assert.equal(motion.acceleration,0);assert.equal(motion.turn,0);}
}
// Actual shared jump action is exclusive; home uses its existing scheduler.
for(let form=1;form<=7;form++)for(const kind of ['home','resident','cube']){
 const a=setup(form,kind),m=a.mover;let jump;
 if(kind==='home'){m.homeJumpWait=0;a.tick(0,1/60);jump=m.homeJump;assert(jump);}
 else jump=require('../assets/battlebro-jump')(a.THREE,a.root,{character:'monsters',groundY:()=>0,solveSupport:a.api.solveLavaTurnArm,poseJuvenile:a.api.poseDevelopingArms});
 const phases=new Set();let peak=0;
 for(let frame=1;frame<1000&&jump.active;frame++){
  if(kind!=='home')jump.tick(1/60,frame/60);
  const calls=a.root.userData.monsterLayerCalls||0;a.tick(frame/60,1/60);
  phases.add(jump.phase);peak=Math.max(peak,a.root.position.y);
  if(jump.active)assert.equal(a.root.userData.monsterLayerCalls||0,calls,'Locomotion cannot overwrite an active jump');
 }
 assert(!jump.active&&!a.root.userData.characterJumping,'Landing recovery completes');
 for(const phase of ['takeoff','ascent','descent','landing'])assert(phases.has(phase));
 assert(Math.abs(peak-2.9**2/(2*.6))<.02,'Low-gravity trajectory preserved');
 configure(a,'walk');for(let f=0;f<60;f++)a.tick(20+f/60,1/60);
 assert(a.root.position.z>.5,'Normal locomotion resumes after landing');
}
assert(html.includes("if(actor.character==='monsters')return tickSupportResidentMotion"),'Monster cannot enter simplified resident animation');
console.log('Monster: seven-form home references, identical home/resident/cube idle/walk/run/turn, planted supports, exclusive jumps, root ownership, cancellation and relocation passed.');
