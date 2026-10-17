'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {api,context,THREE}=require('./longneck-fixture')();
const html=fs.readFileSync('index.html','utf8');
const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group,api.worldGroup);
const islandMesh=new THREE.Group();islandMesh.name='floating-fragment-test';group.add(islandMesh);
const camera=new THREE.PerspectiveCamera();camera.position.set(0,.6,0);
const fp={active:true,pos:new THREE.Vector3(0,.6,0),yaw:0};
let voidGround=false,blocked=false;
const terrain={group,groundYAt:()=>voidGround?-Infinity:0,
 worldToCell:(x,z)=>({x:Math.floor(x),z:Math.floor(z),islandId:'test'}),
 cellToWorld:(x,z)=>({x:x+.5,z:z+.5}),getCell:()=>voidGround?null:{terrain:'stone',terrainFloors:1,islandId:'test',kind:blocked?'house':null},
 blocksBodyAt:()=>blocked};
Object.assign(context,{scene,fp,persCam:camera,explorationActive:true,trainingAppearance:{active:false},
 excavation:{equipped:'transport-cube'},excavationStatus:{textContent:''},excavationHud:{hidden:true},
 baseBattleBroPrototype:null,
 explorationTerrain:terrain,activeFPTerrain:()=>context.explorationActive?terrain:homeTerrain,disposeGroup:()=>{},
 createTransportCube:require('../assets/transport-cube')});
const homeTerrain={...terrain,group:api.worldGroup,worldToCell:(x,z)=>({x:Math.floor(x+32),z:Math.floor(z+32)}),
 cellToWorld:api.tilePos,getCell:(x,z)=>x>=0&&z>=0&&x<64&&z<64?terrain.getCell(x,z):null};
vm.runInContext(html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  // ---------- transport cube ----------')),context);
const start=html.indexOf('  // ---------- transport cube ----------');
vm.runInContext(html.slice(start,html.indexOf('  function fpGroundYAt(',start))+
 '\nthis.transport={ensureTransportCube,throwTransportCube,resetTransportCube,tickTransportCube,transportLanding,transportCubeBlocked,pauseTransportBattleBro,bindTransportBattleBro,state:transportCube};',context);
const transport=context.transport;
// Use the production world-transition function, with the existing terrain fixtures.
terrain.activate=()=>{context.explorationActive=true;};terrain.deactivate=()=>{context.explorationActive=false;};
Object.assign(context,{fpKeys:new Set(),leaveExcavation(){},fpJourney:{home:null},fpGroundYAt:(x,z)=>context.activeFPTerrain().groundYAt(x,z)+.6});
vm.runInContext(html.slice(html.indexOf('  function switchFPWorld('),html.indexOf('  function cancelFPWarp(')),context);

let time=0;
function frames(count,homeMovement=false){for(let i=0;i<count;i++){
 time+=1/60;transport.tickTransportCube(time,1/60);
 if(homeMovement){api.tickLavaMonsterMovers(time,1/60);api.tickMinotaurMovers(time,1/60);api.tickSpecterMovers(time,1/60);}
}}
function registrations(root){return [api.lavaMonsterMovers,api.minotaurMovers,api.specterMovers].flatMap(set=>[...set].filter(m=>m.root===root));}

assert.equal(transport.state.root,null,'Entering a world never creates a follower');
assert.equal(transport.throwTransportCube(),false,'No selected character cannot throw');
for(const character of ['longneck','specter','juggernaut','monsters'])for(let form=1;form<=7;form++){
 const source=api.createBattleBroCharacter({character,form,variant:'ice',colors:{core:'cyan'}});
 context.baseBattleBroPrototype=source;transport.resetTransportCube();fp.pos.set(0,.6,0);camera.position.copy(fp.pos);camera.rotation.set(0,0,0);
 frames(1);assert.equal(transport.state.root,null,'Equipping does not deploy automatically');
 assert(transport.throwTransportCube(),`${character} ${form}: throws`);
 assert(!transport.throwTransportCube(),'Repeated click cannot create a duplicate projectile');
 frames(240);
 const root=transport.state.root;assert(root,`${character} ${form}: emerges on safe terrain`);
 assert.equal(root.userData.form,form);assert.equal(root.userData.visualVariant,'ice');assert.equal(root.userData.colors.core,'cyan');
 assert.equal(root,source,'Cube carries the original instance');
 assert(Math.hypot(root.position.x-fp.pos.x,root.position.z-fp.pos.z)>3,'Never deploy onto player');
 const actor=root.userData.transportActor;
 assert(actor?.motion,'Release initializes existing resident navigation');
 if(character==='juggernaut')assert.equal(actor.mover.juggernautAnimation?.mover,actor.mover,'Cube release binds the authoritative Juggernaut controller');
 if(character==='monsters')assert.equal(actor.mover.monsterAnimation?.mover,actor.mover,'Cube release binds the authoritative Monster controller');
 if(character==='specter')assert.equal(actor.mover.specterAnimation?.mover,actor.mover,'Cube release binds the authoritative Specter controller');
 assert.equal(registrations(root).length,0,'Endless instance has no home update registration');
 const residentStart=root.position.clone();actor.motion.pause=0;
 if(['juggernaut','monsters'].includes(character)){for(let i=0;i<1500&&root.position.distanceTo(residentStart)<=.05;i++)frames(1);}
 else frames(420);
 assert(root.position.distanceTo(residentStart)>.05,`${character} ${form}: resident resumes movement`);
 fp.pos.x=50;frames(60);assert(Math.abs(root.position.x-fp.pos.x)>20,'Bro never follows player');
 root.traverse(n=>assert(Number.isFinite(n.position.length()+n.quaternion.length()+n.scale.length()),'Real rig remains finite'));
 fp.pos.x=0;assert(transport.throwTransportCube(),'Throw again recalls the deployed bro');
 const controller=transport.ensureTransportCube(),originalScale=root.scale.clone();
 assert.equal(controller.phase,'recall-flight');
 frames(5);assert.equal(transport.state.root,root,'Bro remains visible while cube travels');
 assert(root.scale.equals(originalScale),'Bro does not shrink before cube arrives');
 assert(!transport.throwTransportCube(),'Recall cannot accept another throw');
 for(let i=0;i<180&&controller.phase!=='recall-opening';i++)frames(1);
 assert.equal(controller.phase,'recall-opening','Cube reaches bro before opening');
 assert(root.scale.equals(originalScale),'Bro remains full size while lid opens');
 frames(24);assert.equal(controller.phase,'recall');
 frames(15);assert(root.scale.x<originalScale.x&&root.scale.x>0,'Bro gradually shrinks into open cube');
 frames(240);assert.equal(transport.state.root,null,'Recall keeps Bro captured');
 assert.equal(controller.phase,'carried','Cube returns to hand after recall');
 frames(120);assert.equal(transport.state.root,null,'No automatic redeployment');
 assert.equal(group.children.filter(n=>n.userData.rig).length,0,'No deployed character after recall');
 assert(transport.throwTransportCube(),'A separate click deploys again');frames(240);
 assert.equal(transport.state.root,source,'Second click releases the same instance');
 transport.resetTransportCube();assert.equal(transport.state.root,null);assert.equal(source.parent,null,'Stored instance has no parent');
}
context.baseBattleBroPrototype=api.createBattleBroCharacter({character:'longneck',form:4,variant:'lava'});
assert.equal(transport.transportLanding(0,0),null,'Player exclusion radius applies to landing');
const originalGround=terrain.groundYAt;
terrain.groundYAt=()=>3;
assert(transport.transportCubeBlocked(new THREE.Vector3(0,1,0),new THREE.Vector3(1,1,0)),'Cube cannot pass through the side of raised terrain');
terrain.groundYAt=(x,z,eye,maxY)=>maxY>=4?4:0;
assert.equal(transport.transportLanding(5,0,4.11).y,4,'Landing selects a reachable upper layer');
assert.equal(transport.transportLanding(5,0,1).y,0,'Landing can select terrain below an overhead island');
terrain.groundYAt=originalGround;
blocked=true;transport.throwTransportCube();frames(240);assert.equal(transport.state.root,null,'Obstacle collision cannot deploy through geometry');blocked=false;
voidGround=true;transport.throwTransportCube();frames(480);assert.equal(transport.state.root,null,'Throw into void returns cube without losing/deploying actor');voidGround=false;
assert.equal(transport.ensureTransportCube().phase,'carried');
transport.throwTransportCube();frames(240);assert(transport.state.root);
const deployed=transport.state.root;context.excavation.equipped='hands';frames(30);
assert.equal(transport.state.root,deployed,'Unequipping cube keeps the deployment');context.excavation.equipped='transport-cube';
transport.resetTransportCube();transport.throwTransportCube();
for(let i=0;i<240&&transport.ensureTransportCube().phase!=='opening';i++)frames(1);
assert.equal(transport.ensureTransportCube().phase,'opening');
fp.pos.copy(transport.ensureTransportCube().cube.position);frames(90);
assert.equal(transport.state.root,null,'Moving into the landing area cancels emergence');
fp.pos.set(0,.6,0);transport.throwTransportCube();frames(240);assert(transport.state.root);
transport.resetTransportCube();context.explorationActive=false;frames(1);assert.equal(transport.state.root,null,'World exit cleans up deployment');

assert(!html.includes('function tickExplorationCompanion('));assert(!html.includes('function recoverCompanion('));
assert(html.includes("id:'transport-cube',label:'Transport cube',key:'2'"));
console.log('Transport cube: all 28 rigs, appearance preservation, Q tool, ballistic throw, recall, player clearance, invalid terrain, no following and cleanup passed.');
// Repeated cross-world cycles use actual home registration and animation loops.
for(const character of ['longneck','specter','juggernaut','monsters'])for(let form=1;form<=7;form++){
 transport.resetTransportCube();context.explorationActive=false;fp.pos.set(0,.6,0);camera.position.copy(fp.pos);
 const source=api.createBattleBroCharacter({character,form,variant:'ice',colors:{core:'cyan'}});
 source.userData.identity='test-'+character+form;source.userData.gameplay={health:73,training:9};
 source.position.set(.5,character==='specter'?vm.runInContext('SPECTER_HOVER_CLEARANCE',context):0,.5);api.worldGroup.add(source);
 context.baseBattleBroPrototype=source;frames(1);transport.bindTransportBattleBro(source);
 for(let cycle=0;cycle<2;cycle++){
   frames(30,true);const oldMover=registrations(source)[0];assert(oldMover);
   // Simulate capture during a planted step / turn: poison old world anchors.
   if(oldMover.leftAnchor)oldMover.leftAnchor.set(999,999,999);
   if(oldMover.anchors)oldMover.anchors.forEach(a=>a.set(999,999,999));
   assert(transport.throwTransportCube());assert.equal(registrations(source).length,0,'Capture immediately pauses home navigation');
   frames(240,true);assert.equal(source.parent,null);assert.equal(transport.state.root,null);
   assert.equal(registrations(source).length,0,'Stored rig has no animation registrations');
   for(const key of ['lavaMovement','newbornMovement','developingMovement','adolescentMovement','minotaurMovement','specterMovement','transportActor'])assert(!source.userData[key],'Stored rig retains no movement references');
   context.switchFPWorld(true);frames(1);
   assert.equal(transport.state.root,null,'World switch keeps Bro stored');
   assert(transport.throwTransportCube());frames(240);
   assert.equal(transport.state.root,source);assert.equal(source.parent,group);
   assert(source.userData.transportActor.motion,'Endless normal movement initialized');
   assert.equal(registrations(source).length,0);
   if(cycle===0&&['juggernaut','monsters'].includes(character)){
     // Endless residents do not schedule jumps; exercise the same action on
     // the released rig with resident updating paused for exclusive pose ownership.
     const ground=source.position.y,actor=source.userData.transportActor;
     const jump=require('../assets/battlebro-jump')(THREE,source,{character,groundY:()=>ground,
       solveSupport:api.solveLavaTurnArm,poseJuvenile:api.poseDevelopingArms});
     for(let frame=0;frame<900&&jump.active;frame++)jump.tick(1/60,time+frame/60);
     assert(!jump.active&&!source.userData.characterJumping,'Released endless rig completes shared jump');
     assert.equal(source.userData.transportActor,actor,'Jump preserves resident controller');
     const position=source.position.clone();actor.motion.pause=0;
     for(let frame=0;frame<900&&source.position.distanceTo(position)<=.01;frame++)frames(1);
     assert(source.position.distanceTo(position)>.01,`${character} ${form}: resident movement resumes after shared jump`);
   }
   transport.throwTransportCube();frames(240);assert.equal(source.parent,null);
   context.switchFPWorld(false);
   transport.throwTransportCube();
   for(let frame=0;frame<240&&transport.ensureTransportCube().phase!=='opening';frame++)frames(1);
   frames(20);
   assert.equal(registrations(source).length,0,'No gait/contact controller during emergence scaling');
   assert(source.scale.x<source.userData.transportRestScale.x,'Emergence starts below full size');
   frames(240);
   assert.equal(transport.state.root,source);assert.equal(source.parent,api.worldGroup);
   const mover=registrations(source)[0];assert.equal(registrations(source).length,1,'Exactly one home controller');
   if(character==='monsters'){assert.equal(mover.monsterAnimation?.mover,mover);assert(!mover.juggernautAnimation,'Monster has one actual support controller');}
   if(character==='specter')assert.equal(mover.specterAnimation?.mover,mover,'Home release binds the same Specter controller');
   assert.notEqual(mover,oldMover,'Location-dependent mover is rebuilt');
   assert.equal(mover.progress,0);assert(['IDLE','IDLE_HOVER'].includes(mover.state));
   const anchors=mover.anchors||[mover.leftAnchor,mover.rightAnchor].filter(Boolean);
   for(const anchor of anchors)assert(anchor.distanceTo(source.position)<8,'Planted contacts originate at release location');
   assert(!mover.turn&&!mover.juggernautStride&&!mover.longneckFootMotion,'No stale turn/stride contacts');
   if(cycle===0&&['juggernaut','monsters'].includes(character)){
     mover.homeJumpWait=0;frames(1,true);assert(mover.homeJump,'Released home rig starts existing jump scheduler');
     for(let frame=0;frame<900&&mover.homeJump;frame++)frames(1,true);
     assert(!mover.homeJump&&!source.userData.characterJumping,'Landing releases home animation ownership');
     assert.equal(registrations(source)[0],mover,'Jump preserves the home controller');
   }
   const before=source.position.clone();mover.pauseRemaining=0;mover.idleRemaining=0;
   for(let frame=0;frame<1800&&source.position.distanceTo(before)<=.01;frame++)frames(1,true);
   assert(source.position.distanceTo(before)>.01,`${character} ${form}: resumes home movement (${mover.state})`);
   source.traverse(n=>assert(Number.isFinite(n.position.length()+n.quaternion.length()+n.scale.length()),'Restored pose finite'));
   assert.equal(source.userData.identity,'test-'+character+form);assert.equal(source.userData.gameplay.health,73);
   assert.equal(source.userData.gameplay.training,9);assert.equal(source.userData.visualVariant,'ice');
 }
 transport.resetTransportCube();assert.equal(registrations(source).length,0);
}
context.explorationActive=false;fp.pos.set(0,.6,0);
transport.throwTransportCube();frames(240);const traveling=context.baseBattleBroPrototype;
assert.equal(traveling.parent,api.worldGroup);context.switchFPWorld(true);
assert.equal(traveling.parent,null,'Travel automatically packs an active home Bro');assert.equal(registrations(traveling).length,0);
frames(240);assert.equal(transport.state.root,null,'Travel never automatically releases');
transport.throwTransportCube();frames(240);assert.equal(traveling.parent,group);
context.switchFPWorld(false);assert.equal(traveling.parent,null,'Return packs active endless Bro');
assert.equal(transport.state.root,null);transport.throwTransportCube();frames(240);
assert.equal(traveling.parent,api.worldGroup);assert.equal(registrations(traveling).length,1);
const retainedHomeMover=registrations(traveling)[0];transport.ensureTransportCube().suspend(false);
fp.active=false;frames(30,true);assert.equal(traveling.parent,api.worldGroup,'Exiting home first person leaves Bro active');
assert.equal(registrations(traveling)[0],retainedHomeMover,'Leaving first person preserves active home controller');
fp.active=true;transport.resetTransportCube();
console.log('Home transport: 28 forms, repeated home/endless capture-release, same identity/gameplay, rebuilt contacts and normal movement passed.');
// Real streaming keeps the island supporting a deployed character, even when
// the player leaves its render window. Recall releases that retention.
const fixture=fs.readFileSync('tools/exploration-world.test.js','utf8').split('const {terrain,scene,xrWorldRoot,context}=setup();')[0];
const setup=new Function('require',fixture+'return setup;')(require);
const actual=setup();actual.terrain.activate();
const standing=new THREE.Group();standing.position.set(0,actual.terrain.groundYAt(0,0),0);
const island=actual.terrain.getCell(0,0).islandId;
const player={pos:new THREE.Vector3(0,standing.position.y+.6,0),grounded:true};
actual.terrain.tick(0,player,.6,standing);player.pos.x=300;actual.terrain.tick(0,player,.6,standing);
assert(actual.terrain.group.getObjectByName('floating-fragment-'+island),'Deployed support is retained outside player window');
player.pos.x=600;actual.terrain.tick(0,player,.6,null);
assert(!actual.terrain.group.getObjectByName('floating-fragment-'+island),'Recall releases retained island');
console.log('Transport streaming: deployed island retained and released after recall');
