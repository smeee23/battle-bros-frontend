'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const elements=new Map(), world=Array.from({length:20},()=>Array.from({length:20},()=>({terrain:'stone',terrainFloors:1})));
const palette=new THREE.MeshLambertMaterial({color:0x888888});
const fp={active:true,pos:new THREE.Vector3(.5,.48,1.6),grounded:true,yaw:0};
const camera=new THREE.PerspectiveCamera();camera.position.copy(fp.pos);
const mutations=[],sounds=[];
const height=(x,z)=>((world[x]?.[z]?.terrainFloors||1)-1)*.2;
const context=vm.createContext({THREE,world,GRID:20,TILE:1,TOP_H:.18,DIRT_H:.5,BUILDABLE_LAND_Y_OFFSET:-.18,
  fp,FP_EYE_H:.3,persCam:camera,scene:new THREE.Scene(),battleBroGroundHeight:height,
  terrainLevelForCell:c=>c?.terrainFloors||1,terrainConsumeLocks:new Map(),lavaMonsterMovers:[],
  canMutateActiveColony:()=>true,trainingFacilityOccupiesCell:(x,z)=>x===2&&z===2,
  getBoxGeometry:(...args)=>new THREE.BoxGeometry(...args),terrainVoxelMaterials:()=>({low:palette}),playSfx(group){sounds.push(group);},
  setCell(x,z,opts){mutations.push({x,z,opts});world[x][z]={...opts};},
  renderer:{domElement:{addEventListener(){}}},
  document:{addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,{addEventListener(){},setAttribute(){}});return elements.get(id);}},
  window:{addEventListener(){}}});
vm.runInContext(html.slice(html.indexOf('  // ---------- frontend excavation ----------'),html.indexOf('  // ---------- first-person walk ----------'))+
  '\nthis.api={excavation,validExcavationCell,createExcavationVisuals,equipExcavationTool,pickExcavationTarget,seedExcavationFind,startExcavationSwing,tickExcavationSwing,collectExcavationGem,leaveExcavation,clearExcavationFind,updateExcavationAxePose};',context);
const {excavation:e,validExcavationCell:valid,createExcavationVisuals:create,equipExcavationTool:equip,
  pickExcavationTarget:pick,seedExcavationFind:seed,startExcavationSwing:start,tickExcavationSwing:tick,
  collectExcavationGem:collect,leaveExcavation:leave,clearExcavationFind:clear}=context.api;
const aim=(x,z)=>{camera.lookAt(x-9.5,height(x,z),z-9.5);camera.updateMatrixWorld();};
create();e.active=true;seed(2);assert.equal(e.find,null,'Never seed gems in base terrain');
world[10][10].terrainFloors=3;seed(2);assert(e.find);assert.equal(e.find.level,3,'Find belongs to removable layer');
assert(valid(10,10));
for(const [x,z] of [[0,10],[19,10],[-1,2],[2,2]])assert(!valid(x,z));
world[11][10].kind='house';assert(valid(10,10),'Adjacent clear cell remains freely diggable');delete world[11][10].kind;
for(const terrain of ['water','lava','path']){world[10][10].terrain=terrain;assert(!valid(10,10));}world[10][10].terrain='stone';
world[10][10].kind='house';assert(!valid(10,10));delete world[10][10].kind;
world[10][10].extras=['tuft'];assert(!valid(10,10));delete world[10][10].extras;
context.terrainConsumeLocks.set('10,10',{});assert(!valid(10,10));context.terrainConsumeLocks.clear();
// No scanner target is necessary for an axe hit.
clear();aim(10,10);assert.equal(pick().x,10);assert.equal(pick().z,10);
assert(!start(),'Scanner cannot remove terrain');equip('axe');assert(start());assert(!start(),'One swing at a time');
tick(.29);assert.equal(world[10][10].terrainFloors,3,'No removal before impact');
tick(.02);assert.equal(world[10][10].terrainFloors,2,'Impact removes an actual layer without a gem');
tick(.5);assert.equal(mutations.length,1,'Exactly one mutation per swing');assert(world[10][10].userEdited);
// A scanner find in another cell cannot restrict free excavation.
world[12][12].terrainFloors=2;
e.find={x:12,z:12,wx:2.5,wz:2.5,y:.2,level:2,cell:world[12][12],type:'blue',revealed:false,revealAge:0};
aim(10,10);assert(start());tick(.7);assert.equal(world[10][10].terrainFloors,1);assert(!e.find.revealed,'Wrong cell gives no gem');
aim(10,10);assert(start(),'Can swing at the base layer');tick(.7);
assert.equal(world[10][10].terrainFloors,1,'Base layer remains intact');assert.equal(sounds.at(-1),'ripple','Distinct no-break sound');
world[10][10].kind='house';assert(start(),'Can swing at a protected cell');tick(.7);delete world[10][10].kind;
assert.equal(world[10][10].terrainFloors,1);assert.equal(sounds.at(-1),'ripple');
camera.lookAt(5,5,5);camera.updateMatrixWorld();assert(start(),'Can swing into empty air');assert.equal(e.swing.target,null);tick(.7);
assert.equal(sounds.at(-1),'ripple');
// Plant one test find in the only local removable layer, then uncover and collect.
world[12][12].terrainFloors=1;world[10][10].terrainFloors=2;clear();seed(2);
assert.equal(e.find.x,10);assert.equal(e.find.z,10);aim(10,10);assert(start());tick(.31);
assert.equal(world[10][10].terrainFloors,1);assert(e.find.revealed,'Removing the gem layer uncovers its gem');
assert(!collect(),'Gem must be visible before collection');e.find.revealAge=1;
const type=e.find.type;assert(collect(),'Can collect on the newly exposed base layer');assert(!collect());assert.equal(e.gems[type],1);
assert.equal(world[10][10].terrainFloors,1,'Collection never restores removed terrain');tick(.5);
// Revalidate pending impact against movement, locks and replaced world data.
world[10][10].terrainFloors=3;aim(10,10);assert(start());world[10][10]={...world[10][10]};tick(.7);
assert.equal(world[10][10].terrainFloors,3,'Replaced world cancels stale hit');
assert(start());context.terrainConsumeLocks.set('10,10',{});tick(.7);context.terrainConsumeLocks.clear();assert.equal(world[10][10].terrainFloors,3);
assert(start());camera.lookAt(5,2,5);camera.updateMatrixWorld();tick(.7);assert.equal(world[10][10].terrainFloors,3,'Looking away cancels impact');
aim(10,10);assert(start());equip('scanner');tick(.7);assert.equal(world[10][10].terrainFloors,3,'Switching tools cancels pending hit');
equip('axe');assert(start());leave();tick(.7);assert.equal(world[10][10].terrainFloors,3,'Exit cancels pending hit');assert(!e.axe.visible);
assert.equal(mutations.length,3,'Only three valid impacts changed the world');
e.active=true;equip('axe');aim(10,10);assert(start());
const pose=context.api.updateExcavationAxePose;
const edgeWorld=()=>e.axeEdge.clone().applyQuaternion(e.axe.quaternion).add(e.axe.position);
e.swing.age=0;pose();assert(edgeWorld().y>e.axe.position.y,'Head rests above grip');
e.swing.age=.105;pose();const raised=edgeWorld();
e.swing.age=.20;pose();const descending=edgeWorld();
e.swing.age=.30;pose();const contact=edgeWorld();
assert(raised.y>descending.y && descending.y>contact.y,'Blade swings downward from overhead');
assert(contact.distanceTo(e.swing.contact)<1e-9,'Cutting edge reaches terrain exactly');
const handle=e.axe.getObjectByName('axe-handle'),head=e.axe.getObjectByName('axe-blade');
head.geometry.computeBoundingBox();assert(head.geometry.boundingBox.min.y>handle.position.y,'Blade is above handle in tool geometry');
assert(handle.material.metalness>.5,'Metal handle');
assert(e.axe.children.some(n=>n.material?.emissiveIntensity>1),'Plasma highlights');
leave();
console.log('excavation: scanner seeding above base, free axe targeting, impact-only layer removal, protected cells, gem reveal/collection and stale-hit cancellation passed');
