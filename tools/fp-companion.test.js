'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('  // ---------- first-person companion ----------');
const end=html.indexOf('  function fpGroundYAt(',start);
assert(start>=0 && end>start);
const group=new THREE.Group(),fp={active:true,pos:new THREE.Vector3(0,.3,0),yaw:0};
const made=[],motions={head:0,rocks:0,arms:0},disposed=[];
function makeRoot(character,appearance){
 const root=new THREE.Group();
 const rig={rig:new THREE.Group(),torso:new THREE.Group(),head:new THREE.Group(),jaw:new THREE.Group(),
   leftEye:new THREE.Group(),rightEye:new THREE.Group()};
 if(character==='longneck')rig.minotaurLegs=Object.fromEntries(
   ['frontLeft','frontRight','rearLeft','rearRight'].map(name=>[name,new THREE.Group()]));
 if(character==='juggernaut'){
   rig.leftArm={shoulder:new THREE.Group()};rig.rightArm={shoulder:new THREE.Group()};
 }
 root.userData={rig,form:appearance.form,visualVariant:appearance.variant,kind:character,looseRocks:{}};
 made.push(root);return root;
}
const source=(kind,form=4,variant='lava',characterFamily)=>({userData:{kind,form,visualVariant:variant,characterFamily}});
const blocked=new Set();
const terrain={group,groundYAt:(x,z)=>Math.floor(x/5)*.2,
  worldToCell:(x,z)=>({x:Math.floor(x),z:Math.floor(z)}),
  getCell:(x,z)=>({terrain:'stone',kind:blocked.has(`${x},${z}`)?'obstacle':null})};
// Fix follow delays and target offsets without changing the application's randomness.
const companionMath=Object.create(Math);
companionMath.random=()=>.5;
const context=vm.createContext({THREE,fp,Math:companionMath,baseBattleBroPrototype:source('battlebro-longneck-prototype',2,'ice'),
  activeFPTerrain:()=>terrain,createLongNeckBattleBro:a=>makeRoot('longneck',a),
  createSpecterBattleBro:a=>makeRoot('specter',a),createRockBattleBro:a=>makeRoot('monsters',a),
  createJuggernautBattleBro:a=>makeRoot('juggernaut',a),
  SPECTER_HOVER_CLEARANCE:.5,MINOTAUR_MOVE_STATE:{IDLE:'IDLE',WALKING_FLAT:'WALKING_FLAT'},
  LAVA_MOVE_STATE:{IDLE:'IDLE',PULL_LEFT:'PULL_LEFT'},
  tickLooseRockAttachments(){motions.rocks++;},tickLongneckHead(){motions.head++;},
  tickFloatingRockArmGestures(){motions.arms++;},
  tickUpperArmMotion(){motions.arms++;},tickBattleBroWorldExpression(){},tickBattleBroExpression(){},
  disposeGroup(root){disposed.push(root);}});
vm.runInContext(html.slice(start,end)+'\nthis.api={explorationCompanion,startExplorationCompanion,stopExplorationCompanion,tickExplorationCompanion};',context);
const {explorationCompanion:pet,startExplorationCompanion:startPet,stopExplorationCompanion:stopPet,tickExplorationCompanion:tick}=context.api;
startPet();
assert.equal(pet.root.userData.kind,'longneck');
assert.equal(pet.root.userData.form,2);
assert.equal(pet.root.userData.visualVariant,'ice');
assert.equal(pet.root.parent,group);
assert(pet.root.position.z>fp.pos.z+4,'The pet starts at a comfortable distance');
const original=pet.root.position.clone();
fp.yaw=Math.PI;
for(let i=0;i<60;i++)tick(i/60,1/60);
assert(pet.root.position.distanceTo(original)<1e-9,'Turning in place does not reposition the pet');
fp.pos.x=1;
for(let i=0;i<60;i++)tick(1+i/60,1/60);
assert(pet.root.position.distanceTo(original)<1e-9,'Small player movements stay within the comfortable range');
fp.pos.x=7.5;
for(let i=0;i<20;i++)tick(2+i/60,1/60);
assert(pet.root.position.distanceTo(original)<1e-9,'The pet waits briefly before following');
for(let i=0;i<120;i++)tick(3+i/60,1/60);
assert(pet.root.position.distanceTo(original)>.5,'The pet begins catching up after its brief lag');
assert(pet.root.position.distanceTo(original)<12,'Ordinary catch-up does not teleport');
assert(motions.head>0 && motions.rocks>0,'Longneck rig motion continues while following');
for(let i=0;i<180;i++)tick(5+i/60,1/60);
assert(Math.hypot(pet.root.position.x-fp.pos.x,pet.root.position.z-fp.pos.z)<5,'The pet settles near the player');
assert(Math.abs(pet.root.position.y-terrain.groundYAt(pet.root.position.x,pet.root.position.z))<.02,
  'The pet follows Exploration terrain height');
fp.pos.x=pet.root.position.x;fp.pos.z=pet.root.position.z;
// Allow the reaction delay, turn, retreat and idle transition to finish.
for(let i=0;i<360;i++)tick(8+i/60,1/60);
assert(Math.hypot(pet.root.position.x-fp.pos.x,pet.root.position.z-fp.pos.z)>3,
  'The pet walks away when the player crowds it');
assert.equal(pet.mode,'idle','The pet settles after backing away');
const beforeBarrier=pet.root.position.clone();
const barrierX=Math.floor(beforeBarrier.x)+1;
for(let z=-10;z<=10;z++)blocked.add(`${barrierX},${z}`);
fp.pos.x=beforeBarrier.x+8;fp.pos.z=beforeBarrier.z;
for(let i=0;i<120;i++){
 tick(14+i/60,1/60);
 // Deceleration may move the pet on clear ground; entering the wall is the failure.
 assert(pet.root.position.x<barrierX,'The pet does not cross an obstacle to follow');
}
blocked.clear();
for(let i=0;i<120;i++)tick(16+i/60,1/60);
assert(pet.root.position.x>beforeBarrier.x+1,'The pet resumes following when terrain opens');
context.baseBattleBroPrototype=source('battlebro-lava-juggernaut-form-6',6,'lava','juggernaut');
tick(18,1/60);
fp.pos.x=pet.root.position.x+12;fp.pos.z=pet.root.position.z;
let maxRunLook=0,maxRunTurnStep=0,previousRunYaw=pet.root.rotation.y;
for(let i=0;i<45;i++){
 tick(18+i/60,1/60);
 maxRunLook=Math.max(maxRunLook,Math.abs(pet.parts.head.rotation.y-pet.rests.headYaw));
 maxRunTurnStep=Math.max(maxRunTurnStep,Math.abs(Math.atan2(Math.sin(pet.root.rotation.y-previousRunYaw),Math.cos(pet.root.rotation.y-previousRunYaw))));
 previousRunYaw=pet.root.rotation.y;
}
assert.equal(pet.character,'juggernaut');
assert(pet.runBlend>.35 && pet.locomotion==='run','A distant Juggernaut blends into its catch-up run');
assert(maxRunLook>.02,'The running Juggernaut looks around independently of its travel heading');
assert(maxRunTurnStep<.08,'The running Juggernaut turns progressively instead of snap-spinning');
const runningBlend=pet.runBlend;
fp.pos.x=pet.root.position.x+6;fp.pos.z=pet.root.position.z;
for(let i=0;i<45;i++)tick(19+i/60,1/60);
assert(pet.runBlend<runningBlend,'Juggernaut blends back toward its walk near the comfortable range');
context.baseBattleBroPrototype=source('battlebro-floating-rock-prototype',5,'sand');
tick(20,1/60);
assert.equal(pet.root.userData.kind,'specter','Changing the active character changes the companion');
assert.equal(pet.root.userData.visualVariant,'sand');
assert.equal(group.children.length,1,'Only one companion is present');
context.baseBattleBroPrototype=source('battlebro-rock-prototype',7,'plant');
tick(21,1/60);
assert.equal(pet.root.userData.kind,'monsters');
assert(motions.arms>0,'Monster arm motion remains active');
stopPet();
assert.equal(group.children.length,0,'Exiting Exploration removes the companion');
assert.equal(disposed.length,4,'Each companion rig is cleaned up');

// Run the same follower against the real character factories and rig helpers.
const path=require('node:path'),Module=require('node:module');
const file=path.join(__dirname,'rock-battlebro.test.js');
let fixture=fs.readFileSync(file,'utf8').split('const api = context.api;')[0];
fixture=fixture.replace('const M = {','const M_ANIMAL={hoof:new THREE.MeshLambertMaterial({color:0x241813})}; const M = {');
fixture=fixture.replace('globalThis.api = {',`
  let baseBattleBroPrototype=null;
  const fp={active:true,pos:new THREE.Vector3(0,.3,0),yaw:0};
  const companionTerrain={group:new THREE.Group(),groundYAt:(x,z)=>0.4,
    worldToCell:(x,z)=>({x:Math.floor(x),z:Math.floor(z)}),getCell:()=>({terrain:'stone'})};
  worldGroup.add(companionTerrain.group);
  function activeFPTerrain(){return companionTerrain;}
  function disposeGroup(){}
  ${html.slice(start,end)}
  globalThis.petApi={startExplorationCompanion,tickExplorationCompanion,stopExplorationCompanion,
    setSource:root=>{baseBattleBroPrototype=root;},getRoot:()=>explorationCompanion.root};
  globalThis.api = {createBattleBroCharacter,createLongNeckBattleBro,createSpecterBattleBro,createRockBattleBro,`);
const moduleFixture=new Module(file,module);moduleFixture.filename=file;moduleFixture.paths=Module._nodeModulePaths(__dirname);
moduleFixture._compile(fixture+'module.exports={api:context.petApi,THREE:context.THREE,characters:context.api};',file);
const real=moduleFixture.exports;
for(const [character,form,variant] of [['longneck',2,'ice'],['juggernaut',6,'lava'],['monsters',2,'ice'],['monsters',7,'plant'],['specter',5,'sand']]){
 const appearance={form,variant};
 const sourceRoot=character==='longneck'?real.characters.createLongNeckBattleBro(appearance)
  :character==='specter'?real.characters.createSpecterBattleBro(appearance)
  :real.characters.createBattleBroCharacter({...appearance,character});
 real.api.setSource(sourceRoot);
 real.api.startExplorationCompanion();
 for(let i=0;i<30;i++)real.api.tickExplorationCompanion(i/60,1/60);
 const companion=real.api.getRoot();
 assert(companion && companion.userData.form===form && companion.userData.visualVariant===variant);
 if(character==='longneck'){
  real.api.tickExplorationCompanion(4.49,1/60);
  assert(companion.userData.rig.leftEye.scale.y<.5,'The companion keeps its Longneck blink');
 }
 companion.traverse(node=>assert(Number.isFinite(node.position.x+node.rotation.x),character+' rig stays finite'));
}
real.api.stopExplorationCompanion();
console.log('first-person companion: loose follow, backing away, terrain height, animations, live switching and cleanup OK');
