'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const load=require('./longneck-fixture'),capture=require('./specter-reference-capture');
const expected=require('./fixtures/specter-home-reference.json'),actual=capture();
for(const key in expected)expected[key].forEach((row,i)=>row.forEach((v,j)=>
 assert(Math.abs(v-actual[key][i][j])<1e-7,`${key} ${i}/${j}: original home Specter pose`)));
const html=fs.readFileSync('index.html','utf8');
function setup(form,kind){
 const {api,context,THREE}=load();
 const real=context.createSpecterAnimationSystem;
 context.createSpecterAnimationSystem=(...args)=>{
  const system=real(...args),create=system.create;
  system.create=m=>{const a=create(m),commit=a.commit;
   a.commit=(...args)=>{m.root.userData.poseCommits=(m.root.userData.poseCommits||0)+1;return commit(...args);};return a;};return system;
 };
 const terrain={group:api.worldGroup,worldToCell:(x,z)=>({x:Math.floor(x),z:Math.floor(z),islandId:'test'}),
  cellToWorld:(x,z)=>({x:x+.5,z:z+.5}),getCell:()=>({terrain:'stone',terrainFloors:1,islandId:'test'}),groundYAt:()=>0};
 Object.assign(context,{explorationTerrain:terrain,explorationActive:true,activeFPTerrain:()=>terrain});
 vm.runInContext(html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  function fpGroundYAt(')),context);
 const root=api.createBattleBroCharacter({character:'specter',form,variant:'ice'});api.worldGroup.add(root);root.position.set(.5,.72,.5);
 let actor,mover;
 if(kind==='home'){
  mover=api.registerSpecterMover(root,32,32,.72);mover.phase=.4;mover.homeJumpWait=Infinity;mover.idleRemaining=Infinity;
  api.tickSpecterMovers(0,0);
 }else{
  if(kind==='cube'){context.bindTransportBattleBro(root);actor=root.userData.transportActor;actor.phase=.4;}
  else actor={root,character:'specter',phase:.4,x:0,z:0,islandId:'test',mover:{root}};
  context.tickSpecterResidentMotion(actor,0,0);mover=actor.mover;actor.motion.pause=Infinity;
 }
 mover.idleRemaining=Infinity;mover.homeJumpWait=Infinity;
 assert.equal(mover.specterAnimation,api.ensureSpecterAnimation(mover));assert.equal(mover.specterAnimation.family,'specter');
 assert.equal([...api.specterMovers].filter(m=>m.root===root).length,kind==='home'?1:0,'One environment owns animation updates');
 return {root,mover,actor,api,context,THREE,animation:mover.specterAnimation,
  tick(t,dt){if(actor)context.tickExplorationResidentMotion(actor,t,dt);else api.tickSpecterMovers(t,dt);}};
}
function configure(a,state){
 const m=a.mover,turn=state==='START_FLOAT';
 Object.assign(m,{state:state==='FAST_FLOAT'?'FLOATING':state,progress:0,phase:.4,
  startX:.5,startZ:.5,startBaseY:.72,targetX:turn?1.5:.5,targetZ:turn?.5:1.5,targetBaseY:.72,
  targetCellX:m.cellX+(turn?1:0),targetCellZ:m.cellZ+(turn?0:1),
  startYaw:0,desiredYaw:turn?Math.PI/2:0,yawTravel:turn?Math.PI/2:0,curve:.08,
  fastFloat:state==='FAST_FLOAT',travelDuration:state==='FAST_FLOAT'?.9:3});
 if(a.actor)a.actor.motion.mode=state==='IDLE_HOVER'?'idle':state==='START_FLOAT'?'turn':'walk';
}
function pose(a){const p=a.mover.parts;
 return [a.root,p.rig,p.torso,p.spectralBody,p.head,...[p.leftArm,p.rightArm].flatMap(r=>[r.shoulder,r.elbow,r.hand,...r.jaws.map(j=>j.joint)])]
  .flatMap(n=>[...n.position.toArray(),...n.quaternion.toArray()]);}
for(let form=1;form<=7;form++)for(const state of ['IDLE_HOVER','START_FLOAT','FLOATING','SETTLING','FAST_FLOAT']){
 const actors=['home','resident','cube'].map(kind=>setup(form,kind));actors.forEach(a=>configure(a,state));
 let yawLag=0;
 for(let frame=0;frame<90;frame++){
  for(const a of actors){
   const count=a.root.userData.poseCommits;a.tick(frame/60,1/60);assert.equal(a.root.userData.poseCommits,count+1,'Exactly one layered pose commit per frame');
   const m=a.mover;assert(Number.isFinite(m.actualSpeed+m.yawRate+m.acceleration.length()));yawLag=Math.max(yawLag,Math.abs(m.robeYaw));
  }
  const reference=pose(actors[0]);for(const a of actors.slice(1))pose(a).forEach((v,i)=>
   assert(Math.abs(v-reference[i])<1e-7,`${form} ${state} ${frame}/${i}: identical actual movement has one home/resident/cube pose`));
 }
 if(state==='START_FLOAT'||state==='FLOATING')assert(yawLag>.001,'Turning/curved travel has directional robe lag');
 if(state==='FAST_FLOAT')assert.equal(actors[0].mover.state,'IDLE_HOVER','Fast floating naturally settles to idle');
 if(state==='FLOATING'){
  const speeds=actors.map(a=>({peak:a.mover.actualSpeed,final:Infinity}));
  for(let frame=90;frame<280;frame++){
   actors.forEach((a,i)=>{
    a.tick(frame/60,1/60);speeds[i].peak=Math.max(speeds[i].peak,a.mover.actualSpeed);
    if(a.mover.state==='IDLE_HOVER'){
      a.mover.idleRemaining=Infinity;if(a.actor)a.actor.motion.pause=Infinity;
      speeds[i].final=a.mover.actualSpeed;
    }
   });
  }
  actors.forEach((a,i)=>{
   assert.equal(a.mover.state,'IDLE_HOVER','Ordinary floating completes its settle phase');
   assert(speeds[i].peak>.4&&speeds[i].final<1e-8,'Actual float speed accelerates then decelerates to rest');
   assert(Math.abs(a.mover.parts.torso.rotation.x)<.01,'Settling recovers the upright torso');
  });
 }
}
for(let form=1;form<=7;form++){
 const a=setup(form,'cube'),m=a.mover;configure(a,'START_FLOAT');
 const position=a.root.position.clone(),yaw=a.root.rotation.y;
 let p=a.animation.prepare({},1/60,0);assert(a.root.position.equals(position));assert.equal(a.root.rotation.y,yaw);
 a.root.position.copy(p.position);a.root.rotation.y=p.yaw;
 const accepted=a.root.position.clone(),acceptedYaw=a.root.rotation.y;
 a.animation.commit({grounded:true},0,1/60);assert(a.root.position.equals(accepted));assert.equal(a.root.rotation.y,acceptedYaw,'Commit cannot move physical root');
 const progress=m.progress;
 a.animation.prepare({},1/60,1/60);a.animation.commit({accepted:0,grounded:true},1/60,1/60);
 assert.equal(m.progress,progress,'Blocked float/turn cannot consume animation phase');assert.equal(m.actualSpeed,0);
 const drift=new a.THREE.Vector3(.3,.1,-.2);a.root.position.add(drift);a.animation.carry(drift);
 p=a.animation.prepare({blocked:true},0,0);a.animation.commit({grounded:true},0,0);
 assert(m.velocity.length()<1e-8,'Moving terrain is excluded from float velocity');
 assert(a.root.userData.floatingArmGestures.travel<.01,'Island drift does not create a false arm stroke');
 a.root.position.set(10,2,10);a.animation.reset();
 assert(!a.root.userData.floatingArmGestures);assert.equal(m.robeYaw,0);assert.equal(m.progress,0);assert.equal(m.baseY,2);
 assert.equal(m.state,'IDLE_HOVER');assert.equal(m.startX,10);assert.equal(m.targetZ,10);
 // Exercise every authored gesture with production posing and form-specific jaw rigs.
 for(const gesture of ['shrug','reach','stretch',...(form<3?[]:['singleClasp','doubleClasp','sweep'])]){
  a.animation.prepare({},0,0);a.animation.commit({grounded:true},0,0);
  const g=a.root.userData.floatingArmGestures;g.kind=gesture;g.elapsed=0;
  for(let frame=0;frame<360;frame++){
   const p=a.animation.prepare({},1/60,frame/60);a.root.position.copy(p.position);a.root.rotation.y=p.yaw;
   a.animation.commit({grounded:true},frame/60,1/60);
   a.root.traverse(n=>assert(Number.isFinite(n.position.length()+n.quaternion.length()),'Finite gesture pose'));
  }
  assert.equal(g.kind,null,'Authored gesture completes without blocking hovering');
 }
}
for(let form=1;form<=7;form++)for(const kind of ['home','resident','cube']){
 const a=setup(form,kind),m=a.mover;let jump;
 if(kind==='home'){m.homeJumpWait=0;a.tick(0,1/60);jump=m.homeJump;assert(jump);}
 else jump=require('../assets/battlebro-jump')(a.THREE,a.root,{character:'specter',groundY:()=>.72});
 const phases=new Set();let peak=.72;
 for(let f=1;f<1000&&jump.active;f++){
  if(kind!=='home')jump.tick(1/60,f/60);
  const count=a.root.userData.poseCommits;a.tick(f/60,1/60);phases.add(jump.phase);peak=Math.max(peak,a.root.position.y);
  if(jump.active)assert.equal(a.root.userData.poseCommits,count,'Jump owns the pose exclusively');
 }
 assert(!jump.active&&!a.root.userData.characterJumping);assert(Math.abs(peak-.72-2.9**2/(2*.6))<.02);
 for(const phase of ['takeoff','ascent','descent','landing'])assert(phases.has(phase));
 configure(a,'FLOATING');for(let f=0;f<90;f++)a.tick(20+f/60,1/60);
 assert(a.root.position.z>.5,'Normal floating resumes after landing');
}
assert(html.includes("if(actor.character==='specter')return tickSpecterResidentMotion"),'Specter bypasses every generic resident pose');
console.log('Specter: seven-form home references, shared home/resident/cube phases, directional robe lag, gestures, fast float, rejected movement, support drift, reset and exclusive jump recovery passed.');
