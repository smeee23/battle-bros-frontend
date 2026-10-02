'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  // ---------- first-person companion'));
const group=new THREE.Group(),island=new THREE.Group();island.name='floating-fragment-flat';group.add(island);
let drift=0,mountain=false,disposed=0;const appearances=[];
const context=vm.createContext({THREE,fp:{active:true,pos:new THREE.Vector3()},explorationActive:true,
 explorationCompanion:{root:{userData:{form:4}}},SPECTER_HOVER_CLEARANCE:1,
 explorationTerrain:{group,worldToCell:(x,z)=>({x:Math.floor(x-drift),z:Math.floor(z)}),getCell:(x,z)=>({islandId:'flat',terrainFloors:mountain?20:3,kind:null}),
 cellToWorld:(x,z)=>({x:x+.5+drift,z:z+.5}),groundYAt:()=>.4},
 createBattleBroCharacter:appearance=>{appearances.push(appearance);const root=new THREE.Group();
 root.userData.rig={rig:new THREE.Group(),head:new THREE.Group(),torso:new THREE.Group()};return root;},
 battleBroYawDelta:v=>Math.atan2(Math.sin(v),Math.cos(v)),tickBattleBroWorldExpression(){},
 disposeGroup:()=>disposed++,tickBattleBroArenaActor:()=>{}});
vm.runInContext(source+'\nthis.residents=explorationResidents;',context);
for(let i=0;i<20;i++)vm.runInContext('tickExplorationResidents(1,1)',context);
assert(context.residents.size>1&&context.residents.size<=6,'Sparse bounded population');
for(const actor of context.residents.values()){
 assert(Math.hypot(actor.x+.5,actor.z+.5)>=10,'Avoid spawning beside the player');
 assert([3,4,5].includes(appearances[0].form),'Forms stay close to the companion');
}
assert(new Set(appearances.map(a=>a.variant)).size>1,'Varied skins');
assert(new Set(appearances.map(a=>a.colors.core)).size>1,'Varied cores');
const actor=context.residents.values().next().value,before=actor.root.position.x;
drift=.25;vm.runInContext('tickExplorationResidents(2,.01)',context);
assert.equal(actor.root.position.x,before+.25,'Residents ride island drift');
mountain=true;vm.runInContext('tickExplorationResidents(3,1)',context);
assert.equal(context.residents.size,0,'Reject mountains and remove invalid footing');
assert(disposed>0,'Release resident rigs');
mountain=false;
const flatGet=context.explorationTerrain.getCell;
context.explorationTerrain.getCell=(x,z)=>x===1?null:flatGet(x,z);
assert.equal(vm.runInContext('residentFlatCell(0,0)',context),false,'Reject cliff edges');
context.explorationTerrain.getCell=(x,z)=>({...flatGet(x,z),terrainFloors:x===1?4:3});
assert.equal(vm.runInContext('residentFlatCell(0,0)',context),false,'Reject slopes');
context.explorationTerrain.getCell=flatGet;
vm.runInContext('tickExplorationResidents(4,1)',context);
context.explorationActive=false;vm.runInContext('tickExplorationResidents(5,1)',context);
assert.equal(context.residents.size,0,'Clean up when leaving endless terrain');
console.log('exploration residents: sparse varied population, flat footing, drift and cleanup OK');

// Exercise real character animation: upper-arm motion requires a stationary mover.
const Module=require('node:module'),path=require('node:path');
const filename=path.resolve('tools/rock-battlebro.test.js');
let fixture=fs.readFileSync(filename,'utf8').split('const api = context.api;')[0];
fixture=fixture.replace('const M = {','const M_ANIMAL={hoof:new THREE.MeshLambertMaterial()};const M = {')
 .replace('globalThis.api = {','globalThis.api = {tickBattleBroArenaActor, battleBroYawDelta, lavaSupportScale, setLavaHandAnchor, beginJuggernautStride, tickJuggernautStride, solveLavaArmToAnchor, beginLongneckFootMotion, poseLongneckFeet, resetLongneckFeet, tickLongneckHead, tickFloatingRockArmGestures, tickBattleBroWorldExpression,');
const moduleFixture=new Module(filename,module);
moduleFixture.filename=filename;moduleFixture.paths=Module._nodeModulePaths(path.dirname(filename));
moduleFixture._compile(fixture+'module.exports=context.api;',filename);
const api=moduleFixture.exports;
Object.assign(context,api);
context.createBattleBroCharacter=api.createBattleBroCharacter;
context.tickBattleBroArenaActor=api.tickBattleBroArenaActor;
context.explorationActive=true;
for(let i=0;i<20;i++)vm.runInContext('tickExplorationResidents(1,1)',context);
assert(context.residents.size>1,'Real residents spawn and animate without stopping the loop');
const example=context.residents.values().next().value;
for(const character of ['monsters','juggernaut','longneck','specter'])for(let form=1;form<=7;form++){
 const root=api.createBattleBroCharacter({character,form,variant:'ice',colors:{core:'cyan'}});
 const mover={...example.mover,root,parts:root.userData.locomotionRig||root.userData.rig};
 for(let frame=0;frame<3;frame++)api.tickBattleBroArenaActor({root,mover},frame/60,1/60);
}
console.log('exploration residents: real stationary animation works for every character and form');

// Actual generated terrain must have visible, animated residents near its entry.
const terrainFixture=fs.readFileSync('tools/exploration-world.test.js','utf8')
 .split('const {terrain,scene,xrWorldRoot,context}=setup();')[0];
const setupTerrain=new Function('require',terrainFixture+'return setup;')(require);
const actual=setupTerrain();actual.terrain.activate();
Object.assign(actual.context,api,{fp:{active:true,pos:new THREE.Vector3(),yaw:0},
 explorationCompanion:{root:{userData:{form:4}}},SPECTER_HOVER_CLEARANCE:1,
 disposeGroup(){},createBattleBroCharacter:api.createBattleBroCharacter,
 tickBattleBroArenaActor:api.tickBattleBroArenaActor});
vm.runInContext(source+'\nthis.residents=explorationResidents;',actual.context);
for(let frame=0;frame<360;frame++)vm.runInContext(`tickExplorationResidents(${frame/60},1/60)`,actual.context);
assert(actual.context.residents.size>=2,'Populate actual endless terrain rather than an ideal flat fixture');
assert([...actual.context.residents.values()].some(a=>Math.hypot(a.root.position.x,a.root.position.z)<25),
 'At least one bro is near the endless-world entry');
const resident=actual.context.residents.values().next().value;
const head=resident.root.userData.rig.head,beforePose=head.quaternion.clone();
for(let frame=360;frame<420;frame++)vm.runInContext(`tickExplorationResidents(${frame/60},1/60)`,actual.context);
assert(head.quaternion.angleTo(beforePose)>1e-5,'Resident head visibly animates over time');
console.log('exploration residents: actual terrain entry populated with continuously animated bros');

const roaming=[...actual.context.residents.values()].map(actor=>({actor,x:actor.x,z:actor.z}));
for(let frame=420;frame<1800;frame++)vm.runInContext(`tickExplorationResidents(${frame/60},1/60)`,actual.context);
assert(roaming.some(({actor,x,z})=>actor.x!==x||actor.z!==z),'Residents roam on the actual terrain');
for(const actor of actual.context.residents.values()) {
 assert(actual.context.residentFlatCell(actor.x,actor.z),'Roaming stays on broad flat patches');
 assert(Math.hypot(actor.x-actor.motion.homeX,actor.z-actor.motion.homeZ)<=5,'Roaming remains local');
}
assert.equal(api.lavaMonsterMovers.size,0,'Residents do not join home terrain controllers');
console.log('exploration residents: shared home gaits, local roaming and flat-ground boundaries OK');
context.residents.clear();
for(const character of ['monsters','juggernaut','longneck','specter'])for(let form=1;form<=7;form++) {
 const root=api.createBattleBroCharacter({character,form,variant:'ice'});group.add(root);
 const actor={root,mover:{root,parts:root.userData.locomotionRig||root.userData.rig,
  state:'IDLE',progress:0,ikTarget:new THREE.Vector3()},x:200,z:200,character,phase:0};
 context.actor=actor;
 let completedStep=false;
 for(let frame=0;frame<600;frame++) {
  vm.runInContext(`tickExplorationResidentMotion(actor,${frame/60},1/60)`,context);
  completedStep ||= actor.x!==200||actor.z!==200;
 }
 assert(Number.isFinite(root.position.x)&&Number.isFinite(root.position.y),`${character} ${form}: finite roaming pose`);
 assert(completedStep,`${character} ${form}: completes an animated step`);
 group.remove(root);
}
console.log('exploration residents: all four families and seven forms complete animated roaming steps');
