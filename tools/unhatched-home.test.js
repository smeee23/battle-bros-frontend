'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const hatch=require('../assets/unhatched-home.js'),transport=require('../assets/transport-cube.js');
const element=()=>({hidden:true,value:'',textContent:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}});
const controls={section:element(),name:element(),character:element(),weights:[element(),element(),element()],status:element()};
const values=new Map(),group=new THREE.Group(),modes=[];
let home=true,ground=2,created=0;
const boxCache=new Map();
const box=(...args)=>{const key=args.join(',');if(!boxCache.has(key))boxCache.set(key,new THREE.BoxGeometry(...args));return boxCache.get(key);};
const controller=hatch.create(THREE,{controls,group,storage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},
 makeCube:()=>{created++;return transport.createModel(THREE,box);},characterSize:()=>5,
 isHome:()=>home,center:()=>({x:0,z:0,cellX:24.5,cellZ:24.5}),ground:()=>ground,onModeChange:active=>modes.push(active)});
const scope={chainId:'31337',deploymentId:'0x'+'a'.repeat(40)};
const model={identity:{tokenId:7n,hatched:false,active:true}};
controller.update(null,scope);assert(!controller.active);assert.equal(created,0);
controller.update(model,scope);
assert(controller.active);assert(!controls.section.hidden);assert.equal(created,1);
const cube=controller.cube,bounds=new THREE.Box3().setFromObject(cube),size=bounds.getSize(new THREE.Vector3());
assert(size.x>=5-1e-6&&size.y>=4.8,'Cube contains a full-sized character');
assert(Math.abs(bounds.min.y-ground)<1e-6,'Cube rests above existing terrain without modifying it');
assert.equal(cube.position.x,0);assert.equal(cube.position.z,0);
assert.equal(cube.children[0].material.color.getHex(),0x582d80,'Distinct violet shell');
assert.equal(cube.children[2].material.color.getHex(),0xff3030,'Red seam');
assert.equal(cube.children[2].material.emissive.getHex(),0xff0808,'Red glow');
controller.tick(.5);const bright=cube.children[2].material.emissiveIntensity;
controller.tick(1.5);assert(cube.children[2].material.emissiveIntensity<bright,'Light fades smoothly');
controller.tick(2.5);assert.equal(cube.children[2].material.emissiveIntensity,bright,'Pulse repeats every two seconds');
assert(controller.occupies(24,24));assert(!controller.occupies(10,10),'Building outside cube remains available');
assert.match(controls.status.textContent,/Enter a name/);
controls.name.value='Nova 🌙';controls.character.value='specter';
controls.weights.forEach((input,i)=>input.value=['40','35','25'][i]);controls.name.listeners.input();
assert.deepEqual(hatch.weights(controller.getDraft().weights),[4000,3500,2500]);
assert.equal(controller.getDraft().character,'specter');assert.match(controls.status.textContent,/ready/);
assert(controller.active,'Entering choices never hatches locally');
controls.weights[0].value='90';controls.weights[0].listeners.input();assert.match(controls.status.textContent,/total 100%/);
assert.equal(hatch.weights(['33.333','33.33','33.34']),null);
assert.equal(hatch.weights(['-1','51','50']),null);
assert.equal(hatch.weights(['1e2','0','0']),null);
assert.match(hatch.validate({name:'🌙'.repeat(33),character:'specter',weights:['100','0','0']}),/128/);
controls.weights[0].value='40';controls.weights[0].listeners.input();
controller.update(model,scope);assert.equal(created,1);assert.deepEqual(modes,[true],'Repeated publications do not recreate the actor/cube');
controller.update(null,scope);assert(controller.active,'Read errors do not unlock travel');
home=false;controller.refresh();assert(!cube.visible);assert(!controller.occupies(24,24));
home=true;ground=3;controller.refresh();assert(cube.visible);assert.equal(created,1);
assert(Math.abs(new THREE.Box3().setFromObject(cube).min.y-ground)<1e-6,'World rebuilds reposition the same cube');
controller.update({identity:{...model.identity,tokenId:8n}},scope);assert.equal(controls.name.value,'','Separate NFT drafts');
controller.update(model,scope);assert.equal(controls.name.value,'Nova 🌙');assert.equal(controls.character.value,'specter');
controller.update({...model,identity:{...model.identity,hatched:true}},scope);
assert(!controller.active);assert(controls.section.hidden);assert(!cube.visible);assert.deepEqual(modes,[true,false]);

// Execute production entry guards, collision and safe walk spawning.
const html=fs.readFileSync('index.html','utf8');
const section=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const context=vm.createContext({THREE,unhatchedHome:controller,explorationActive:false,territoryWorldState:{active:false},
 homeFPTerrain:{worldToCell:(x,z)=>({x:Math.floor(x),z:Math.floor(z)}),groundYAt:()=>3.6},
 trainingFacilityOccupiesCell:(x,z)=>x===-10&&z===-10,
 fp:{active:true,pos:new THREE.Vector3(0,3.6,0),vy:0},fpEyeHeight:()=>.6,
 cancelFPWarp(){context.cancelled=true;}});
vm.runInContext(section('  function isHomeBroUnhatched()', '  function setupUnhatchedHome()'),context);
controller.update(model,scope);
assert(context.unhatchedHomeBlocksBody(0,0,3,4));assert(context.unhatchedHomeBlocksBody(-10,-10,3,4));
assert(!context.unhatchedHomeBlocksBody(10,10,3,4));
context.placeOutsideUnhatchedCube();assert(context.fp.pos.length()>5,'Walk mode never spawns trapped inside the cube');
for(const [start,end,name,args] of [
 ['  function enterTrainingAppearance()', '  function leaveTrainingAppearance(', 'enterTrainingAppearance',[]],
 ['  function switchFPWorld(', '  function cancelFPWarp(', 'switchFPWorld',[true]],
 ['  function throwTransportCube()', '  let transportMinimapUpdatedAt', 'throwTransportCube',[]],
 ['  function enterFlightMode(', '  function exitFlightMode(', 'enterFlightMode',[]],
 ['  function enterBattleArena()', '  function exitBattleArena()', 'enterBattleArena',[]],
 ['  async function toggleTerritoryWorld()', '  window.__toggleTerritoryWorld', 'toggleTerritoryWorld',[]],
]){
 vm.runInContext(section(start,end),context);
 const result=context[name](...args);
 if(result?.then)result.then(value=>assert.equal(value,false));else assert.equal(result,false,name+' is blocked');
}
vm.runInContext(section('  function tickFPJourney(', '  // ---------- frontend excavation'),context);
assert.equal(context.tickFPJourney(.1),false);assert(context.cancelled);
controller.update({identity:{...model.identity,hatched:true}},scope);
assert(!context.unhatchedHomeBlocksBody(0,0,3,4));
assert(!context.unhatchedHomeBlocksBody(-10,-10,3,4),'Training collision unlocks on a confirmed hatch');

// Exercise the production scene bridge: the existing actor is parked, not cloned.
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
const sceneGroup=new THREE.Group(),actor=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial());
actor.userData.looseRocks={orbitField:new THREE.Group()};sceneGroup.add(actor,actor.userData.looseRocks.orbitField);
let paused=0,bound=0;
Object.assign(context,{window:{},document:{getElementById:node,body:{classList:{toggle(){}}}},
 localStorage:{getItem:()=>null,setItem(){}},BattleBrosUnhatchedHome:hatch,createTransportCube:transport,
 worldGroup:sceneGroup,baseBattleBroPrototype:actor,getBoxGeometry:box,GRID:50,
 tilePos:(x,z)=>({x:x-24.5,z:z-24.5}),getWorldCell:()=>({kind:null}),battleBroGroundHeight:()=>2,
 battleArenaView:{active:false},trainingAppearance:{active:false},flight:{active:false},fpKeys:new Set(),
 resetTransportCube(){},pauseTransportBattleBro(){paused++;},bindTransportBattleBro(){bound++;}});
vm.runInContext(section('  function setupUnhatchedHome()', '  // -------- boot --------'),context);
context.setupUnhatchedHome();context.window.updateUnhatchedHome(model,scope);
assert.equal(actor.parent,null);assert(!actor.visible);assert(!actor.userData.looseRocks.orbitField.visible);assert.equal(paused,1);
context.window.updateUnhatchedHome(model,scope);assert.equal(paused,1,'Refresh does not repeatedly reset animations');
context.window.updateUnhatchedHome({identity:{...model.identity,hatched:true}},scope);
assert.equal(actor.parent,sceneGroup);assert(actor.visible);assert(actor.userData.looseRocks.orbitField.visible);assert.equal(bound,1);
assert(node('unhatched-home-controls').hidden);

// The testing button can preview without S3, while publications remain authoritative on exit.
const preview=hatch.create(THREE,{group:new THREE.Group(),makeCube:()=>transport.createModel(THREE,box),
 isHome:()=>true,center:()=>({x:0,z:0,cellX:0,cellZ:0}),ground:()=>0,onModeChange(){}});
preview.setPreview(true);assert(preview.active&&preview.previewing,'Preview needs no publication or wallet');
preview.setPreview(false);assert(!preview.active&&!preview.previewing,'Exit restores the original no-publication state');
preview.update(model,scope);preview.setPreview(true);
preview.update({identity:{...model.identity,hatched:true}},scope);
assert(preview.active,'A refresh cannot unexpectedly dismiss an active preview');
preview.setPreview(false);assert(!preview.active,'Exit uses the latest confirmed publication');
preview.setPreview(true);preview.update(model,scope);preview.setPreview(false);
assert(preview.active&&!preview.previewing,'Exiting preview never bypasses a real unhatched record');
assert.equal(model.identity.hatched,false,'Preview never mutates published data');
console.log('Unhatched Home: confirmed status, cube sizing/placement/reuse, protected footprint, drafts/validation, travel/training guards and safe walk spawn passed.');
