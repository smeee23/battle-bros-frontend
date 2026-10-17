'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const {api,context,THREE}=require('./longneck-fixture')();
const createJump=require('../assets/battlebro-jump');
for(const character of ['longneck','specter','juggernaut','monsters'])for(let form=1;form<=7;form++){
 const root=api.createBattleBroCharacter({character,form,variant:'ice'});api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover={root,parts:root.userData.rig,state:'IDLE',progress:0};
 const longneck=character==='longneck'?api.ensureLongneckAnimation(mover):null;
 const jump=createJump(THREE,root,{character,longneck,gravity:.6,velocity:2.9,solveSupport:api.solveLavaTurnArm,poseJuvenile:api.poseDevelopingArms});
 const phases=new Set();let maxY=0;
 for(let i=0;i<900&&jump.active;i++){
  jump.tick(1/60,i/60);phases.add(jump.phase);maxY=Math.max(maxY,root.position.y);
  assert.equal(root.position.x,.5);assert.equal(root.position.z,.5);
  root.traverse(n=>assert(Number.isFinite(n.position.length()+n.quaternion.length()+n.scale.length()),`${character} ${form}: finite jump`));
 }
 for(const phase of ['prepare','takeoff','ascent','descent','landing'])assert(phases.has(phase),phase);
 assert(Math.abs(maxY-2.9*2.9/(2*.6))<.02,'Uses player low-gravity physics');
 assert(!jump.active);assert.equal(root.userData.characterJumping,false,'Jump releases exclusive pose ownership');assert(Math.abs(root.position.y)<1e-9,'Lands on original support');
 api.worldGroup.remove(root);
}
// Production home scheduler dispatches the same action rather than another pose implementation.
for(const character of ['longneck','specter','juggernaut','monsters']){
 const root=api.createBattleBroCharacter({character,form:4,variant:'lava'});api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover={root,parts:root.userData.rig,state:character==='specter'?'IDLE_HOVER':'IDLE',cellX:32,cellZ:32,progress:0,homeJumpWait:0};
 context.jumpMover=mover;
 assert(vm.runInContext('tickHomeBattleBroJump(jumpMover,0,1/60)',context),'Home idle starts retained jump');
 assert(mover.homeJump);api.worldGroup.remove(root);
}
console.log('Home jumps: all four families and seven forms retain all jump phases, low-gravity motion and safe landing through one reusable action.');
// The actual shared support solver must preserve world contacts while the body
// compresses. Compare normal, shallow and deeper landings without changing launch physics.
for(const character of ['juggernaut','monsters'])for(let form=1;form<=7;form++){
 const results=[];
 for(const landingY of [6.5,0,-12]){
  const root=api.createBattleBroCharacter({character,form,variant:'ice'});api.worldGroup.add(root);
  root.position.set(2,0,3);root.rotation.y=.7;root.updateMatrixWorld(true);
  const parts=root.userData.rig,lower=root.userData.locomotionRig||parts;
  const supports=lower.leftArm?[lower.leftArm,lower.rightArm]:[];
  const feet=supports.length?supports.map(a=>a.hand):lower.limbs;
  const anchors=feet.map(n=>n.getWorldPosition(new THREE.Vector3()));
  const restY=parts.rig.position.y,initial=[];
  root.traverse(node=>{if(node!==root)initial.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});});
  const jump=createJump(THREE,root,{character,groundY:()=>landingY,solveSupport:api.solveLavaTurnArm,poseJuvenile:api.poseDevelopingArms});
  let apex=0,prepDepth=0,landDepth=0,prepBend=0,extensionBend=Infinity,landingFrames=0;
  for(let i=0;i<1800&&jump.active;i++){
   jump.tick(1/120,i/120);root.updateMatrixWorld(true);apex=Math.max(apex,root.position.y);
   const compression=restY-parts.rig.position.y;
   if(jump.phase==='prepare'){
    prepDepth=Math.max(prepDepth,compression);
    if(supports.length)prepBend=Math.max(prepBend,supports[0].elbow.quaternion.angleTo(new THREE.Quaternion()));
   }
   if(jump.phase==='takeoff'&&supports.length&&root.position.y>.02)
    extensionBend=Math.min(extensionBend,supports[0].elbow.quaternion.angleTo(new THREE.Quaternion()));
   if(jump.phase==='landing'){landDepth=Math.max(landDepth,compression);landingFrames++;}
   if(jump.phase==='prepare'||jump.phase==='landing'&&landingFrames<24){
    feet.forEach((foot,index)=>{
     const expected=anchors[index].clone();if(jump.phase==='landing')expected.y+=landingY;
     assert(foot.getWorldPosition(new THREE.Vector3()).distanceTo(expected)<1e-5,`${character} ${form}: planted ${jump.phase} foot`);
    });
   }
  }
  assert(!jump.active&&landingFrames>0,'Impact recovery completes');
  assert(Math.abs(apex-2.9**2/(2*.6))<.002,'Animation does not change ballistic apex');
  assert(prepDepth>.08,'Visible moderate preparation squat');
  if(supports.length)assert(extensionBend<prepBend*.6,`${character} ${form}: support joints extend during takeoff`);
  for(const v of initial){
   assert(v.node.position.distanceTo(v.p)<1e-9,'Restores local positions after landing');
   assert(v.node.quaternion.angleTo(v.q)<1e-7,'Restores all joint rotations including knees');
   assert(v.node.scale.distanceTo(v.s)<1e-9,'Restores scale');
  }
  results.push({depth:landDepth,speed:jump.impactSpeed});api.worldGroup.remove(root);
 }
 assert(results[0].speed<results[1].speed&&results[1].speed<results[2].speed,'Physical impact speed follows fall distance');
 assert(results[0].depth<results[1].depth&&results[1].depth<results[2].depth,'Higher impact produces deeper compression');
 assert(results[2].depth<=.22*1.35+1e-6,'Compression stays bounded');
}
console.log('Heavy jumps: all forms, planted support IK, launch extension, unchanged apex, impact-dependent compression and full pose restoration passed.');
