'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const elements=new Map(),world=Array.from({length:20},()=>Array.from({length:20},()=>({terrain:'stone',terrainFloors:1})));
function element(id){
  if(!elements.has(id))elements.set(id,{id,hidden:true,children:[],dataset:{},attributes:{},
    addEventListener(){},setAttribute(name,value){this.attributes[name]=value;},
    appendChild(child){this.children.push(child);},querySelectorAll(){return id==='fp-tool-menu'?element('fp-tool-options').children:this.children;},querySelector(){return this.querySelectorAll()[0];}});
  return elements.get(id);
}
const palette=new THREE.MeshLambertMaterial({color:0x888888});
const fp={active:true,pos:new THREE.Vector3(.5,.48,1.6),grounded:true,yaw:0};
const camera=new THREE.PerspectiveCamera();camera.position.copy(fp.pos);
const mutations=[],sounds=[],locks=new Map();
const height=(x,z)=>((world[x]?.[z]?.terrainFloors||1)-1)*.2;
const terrain={getCell:(x,z)=>world[x]?.[z],
  setCell(x,z,opts){mutations.push({x,z,opts});world[x][z]={...opts};return true;},
  worldToCell:(x,z)=>({x:Math.floor(x+10),z:Math.floor(z+10)}),
  cellToWorld:(x,z)=>({x:x-9.5,z:z-9.5}),
  groundYAt:(x,z)=>height(Math.floor(x+10),Math.floor(z+10)),
  canExcavate(x,z){const cell=world[x]?.[z];return x>=1&&z>=1&&x<19&&z<19&&!(x===2&&z===2)
    &&!locks.has(x+','+z)&&!!cell&&!cell.kind&&!cell.buildingType&&!cell.extras?.length
    &&['grass','dirt','stone','rock','sand','snow','plant'].includes(cell.terrain);}};
let random=.5;
const math=Object.create(Math);math.random=()=>random;
const handlers={},fpKeys=new Set();
const dom={pointerLockElement:null,exitPointerLock(){this.pointerLockElement=null;},
  addEventListener(){},createElement:tagName=>({tagName,children:[],dataset:{},appendChild(child){this.children.push(child);},setAttribute(){},focus(){dom.activeElement=this;},blur(){dom.activeElement=null;},addEventListener(name,fn){this[name==='click'?'clickHandler':name]=fn;},click(){this.clickHandler?.();}}),
  getElementById:element,querySelectorAll:()=>element('fp-tool-options').children};
const renderer={domElement:{addEventListener(){},requestPointerLock(){dom.pointerLockElement=this;}}};
const thumbnails=[];
const context=vm.createContext({THREE,Math:math,setTimeout:fn=>fn(),buildToolThumb:(tool,canvas)=>thumbnails.push({tool,canvas}),world,GRID:20,TILE:1,TOP_H:.18,DIRT_H:.5,BUILDABLE_LAND_Y_OFFSET:-.18,
  explorationActive:false,fp,FP_EYE_H:.3,persCam:camera,scene:new THREE.Scene(),battleBroGroundHeight:height,
  terrainLevelForCell:c=>c?.terrainFloors||1,terrainConsumeLocks:locks,lavaMonsterMovers:[],activeFPTerrain:()=>terrain,
  canMutateActiveColony:()=>true,battleArenaView:{active:false},trainingFacilityOccupiesCell:(x,z)=>x===2&&z===2,
  getBoxGeometry:(...args)=>new THREE.BoxGeometry(...args),terrainVoxelMaterials:()=>({low:palette}),playSfx(group){sounds.push(group);},
  fpKeys,renderer,document:dom,window:{addEventListener(name,fn){handlers[name]=fn;}}});
vm.runInContext(html.slice(html.indexOf('  // ---------- frontend excavation ----------'),html.indexOf('  // ---------- first-person walk ----------'))+
  '\nthis.api={excavation,validExcavationCell,createExcavationVisuals,equipExcavationTool,pickExcavationTarget,startExcavationSwing,tickExcavationSwing,leaveExcavation,updateExcavationAxePose,rollExcavationGem,toggleFPToolMenu};',context);
const {excavation:e,validExcavationCell:valid,createExcavationVisuals:create,equipExcavationTool:equip,
  pickExcavationTarget:pick,startExcavationSwing:start,tickExcavationSwing:tick,
  leaveExcavation:leave,toggleFPToolMenu:menu}=context.api;
const aim=(x,z)=>{camera.lookAt(x-9.5,height(x,z),z-9.5);camera.updateMatrixWorld();};
create();assert(!e.tool,'No scanner is created');
const options=element('fp-tool-options').children;
assert.equal(options.length,2,'Tool menu has None and Axe');
assert.equal(options[0].children[0].textContent,'None');
assert(!options[0].children.some(child=>child.tagName==='canvas'),'None has no thumbnail');
assert.equal(thumbnails.length,1);
assert.equal(thumbnails[0].tool.kind,'walking-axe');
assert.equal(thumbnails[0].canvas,options[1].children[0],'Axe uses the shared toolbar thumbnail renderer');
menu(true);assert.equal(element('fp-tool-menu').hidden,false);menu(false);assert.equal(element('fp-tool-menu').hidden,true);
const press=(key,code='')=>handlers.keydown({key,code,preventDefault(){},stopImmediatePropagation(){}});
fpKeys.add('w');press('q');
assert.equal(element('fp-tool-menu').hidden,false,'Q opens menu even without a physical key code');
assert.equal(dom.pointerLockElement,null,'Menu releases mouse pointer');
assert.equal(fpKeys.size,0,'Opening menu stops held movement');
press('Tab');assert.equal(dom.activeElement.dataset.tool,'axe');
press('Enter');assert.equal(e.equipped,'axe');
assert.equal(element('fp-tool-menu').hidden,true,'Selecting tool closes menu');
assert.equal(dom.pointerLockElement,renderer.domElement,'Selection restores mouse look');
press('q','KeyQ');press('Escape');assert(element('fp-tool-menu').hidden,'Escape resumes walk');
equip('hands');
world[10][10].terrainFloors=3;assert(valid(10,10));
for(const [x,z] of [[0,10],[19,10],[-1,2],[2,2]])assert(!valid(x,z));
for(const kind of ['water','lava','path']){world[10][10].terrain=kind;assert(!valid(10,10));}world[10][10].terrain='stone';
world[10][10].kind='house';assert(!valid(10,10));delete world[10][10].kind;
locks.set('10,10',{});assert(!valid(10,10));locks.clear();
aim(10,10);assert(!start(),'Hands cannot dig');equip('axe');assert.equal(e.active,true);assert.equal(pick().x,10);
assert(start());assert(!start(),'One swing at a time');tick(.29);assert.equal(world[10][10].terrainFloors,3);
tick(.02);assert.equal(world[10][10].terrainFloors,2);assert.equal(e.gems.blue,0,'A losing roll awards nothing');
tick(.5);assert.equal(mutations.length,1);
random=.099;aim(10,10);assert(start());tick(.31);
assert.equal(world[10][10].terrainFloors,1);assert.equal(e.gems.blue,1,'A successful 10% roll awards a gem immediately');
assert.deepEqual(Object.keys(e.gems),['blue'],'Only one gem type is collected');
assert.equal(e.gem.material.color.getHexString(),'62b5ff','Discovered gems are blue');
assert.match(element('excavation-inventory').innerHTML,/Gems: <b>1<\/b>/,'Inventory shows one gem total');
assert.equal(element('excavation-status').textContent,'Blue gem collected!');
assert.equal(e.gemAge,0);tick(.5);
random=.1;world[10][10].terrainFloors=2;aim(10,10);assert(start());tick(.31);
assert.equal(e.gems.blue,1,'The probability boundary does not award a gem');tick(.5);
aim(10,10);assert(start(),'Base layer can be struck');tick(.7);
assert.equal(world[10][10].terrainFloors,1);assert.equal(sounds.at(-1),'ripple');
world[10][10].terrainFloors=3;aim(10,10);assert(start());world[10][10]={...world[10][10]};tick(.7);
assert.equal(world[10][10].terrainFloors,3,'Replaced cell cancels stale impact');
assert(start());locks.set('10,10',{});tick(.7);locks.clear();assert.equal(world[10][10].terrainFloors,3);
assert(start());equip('hands');tick(.7);assert.equal(world[10][10].terrainFloors,3,'Unequipping cancels a swing');
equip('axe');assert(start());leave();tick(.7);assert.equal(world[10][10].terrainFloors,3,'Leaving walk mode cancels a swing');
assert.equal(mutations.length,3,'Only three valid impacts changed terrain');
assert(!e.axe.visible);
console.log('excavation: tool menu, random gem rolls, protected layers and stale-hit cancellation passed');
