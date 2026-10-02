'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
function element(){return {hidden:true,value:'',children:[],get options(){return this.children;},style:{},textContent:'',append(...items){this.children.push(...items);},add(item){this.children.push(item);},setAttribute(){},getAttribute(){},focus(){},querySelectorAll(){return [];},classList:{values:new Set(),contains(k){return this.values.has(k);},add(k){this.values.add(k);},remove(k){this.values.delete(k);},toggle(k,on){if(on)this.add(k);else this.remove(k);}}};}
const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
const document={body:element(),getElementById:get,createElement:element,createTextNode:text=>({textContent:text}),pointerLockElement:{},exitPointerLock(){this.pointerLockElement=null;}};
const materials=Object.fromEntries(['habitatShell','habitatTrim','habitatBand','habitatWindow'].map(k=>[k,new THREE.MeshBasicMaterial()]));
const facility=new THREE.Group();facility.scale.setScalar(4.5);facility.rotation.y=Math.PI/4;
const building=new THREE.Group();building.name='Training Center';facility.add(building);
const shell=new THREE.Mesh(new THREE.BoxGeometry(4.23,1.8,4.4),materials.habitatShell);building.add(shell);
const hatch=new THREE.Mesh(new THREE.BoxGeometry(2,1.48,.08),materials.habitatBand);building.add(hatch);
for(const side of [-1,1]){const panel=new THREE.Mesh(new THREE.BoxGeometry(.96,1.42,.04),materials.habitatTrim);panel.position.set(side*.5,.76,2.3);panel.userData.trainingDoorSide=side;building.add(panel);
 const handle=new THREE.Mesh(new THREE.BoxGeometry(.04,1.25,.03),materials.habitatWindow);handle.position.set(side*.09,.78,2.335);handle.userData.trainingDoorSide=side;building.add(handle);}
const worldGroup=new THREE.Group();worldGroup.add(facility);
const make=appearance=>{const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(2,3,1),materials.habitatTrim));root.userData={form:appearance.form,visualVariant:appearance.variant,characterFamily:appearance.character,colors:appearance.colors};return root;};
const source=make({character:'juggernaut',form:4,variant:'lava',colors:{core:'blue',glow:'default',eye:'green'}});source.position.set(20,1,20);worldGroup.add(source);
const camera=new THREE.PerspectiveCamera(70,1,.03,1100);camera.position.set(10,3,10);
const noop=()=>{};let resumed=0;
const previewEvents=new Map(),captures=new Set();
const previewCanvas={requestPointerLock:noop,addEventListener:(name,handler)=>previewEvents.set(name,handler),setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
const context={THREE,document,window:{addEventListener:noop},Option:function(title,value){this.value=value;this.text=title;},
 M:materials,worldGroup,trainingFacility:facility,baseBattleBroPrototype:source,persCam:camera,
 fp:{active:true,grounded:true,pos:new THREE.Vector3(),yaw:0,pitch:0},explorationActive:false,fpKeys:new Set(['w']),
 fpToolMenu:element(),renderer:{domElement:previewCanvas},BATTLEBRO_COLORS:{blue:0,green:0,black:0},
 battleBroCharacterPreviewPanel:null,lavaMonsterMovers:new Set([{root:source}]),specterMovers:new Set(),minotaurMovers:new Set(),
 createBattleBroCharacter:make,applyBattleBroColors:(root,colors)=>{root.userData.colors=colors;},
 getBoxGeometry:(...args)=>new THREE.BoxGeometry(...args),geomCache:new Map(),disposeGroup:noop,
 tickLooseRockAttachments:noop,stopExplorationCompanion:noop,startExplorationCompanion:()=>resumed++,leaveExcavation:noop,
 tickFP:noop,fpGroundYAt:()=>2.5,markCameraMoving:noop,worldToCellCoord:Math.floor,finishTerrainConsume:noop,cancelTelekineticRockThrow:noop,
 registerLavaMonsterMover:(root)=>context.lavaMonsterMovers.add({root}),registerSpecterMover:noop,registerMinotaurMover:noop};
vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('  // Training-center appearance mode'),html.indexOf('  function applyLightingSettings()')),context);
const run=code=>vm.runInContext(code,context);
function point(x,y,z){facility.updateMatrixWorld(true);return facility.localToWorld(new THREE.Vector3(x,y,z));}
context.fp.pos.copy(point(0,.5,2.6));
assert(run('trainingDoorApproach(fp.pos,trainingFacility)'));
context.fp.pos.copy(point(1.5,.5,2.6));assert(!run('trainingDoorApproach(fp.pos,trainingFacility)'),'Side walls do not trigger entry');
context.fp.pos.copy(point(0,.5,2.6));context.explorationActive=true;run('tickTrainingAppearance(.05,0)');assert(!run('trainingAppearance.active'),'Endless world never enters');
context.explorationActive=false;run('tickTrainingAppearance(.05,0)');assert(run('trainingAppearance.active'));
assert.equal(document.pointerLockElement,null);assert.equal(shell.visible,true);assert.equal(context.fpKeys.size,0);
assert.equal(get('training-appearance-controls').hidden,false);assert(facility.getObjectByName('appearancePedestal'));
assert.equal(run('trainingAppearance.controls.skin.value'),'lava');
assert.equal(run('trainingAppearance.room.children.filter(mesh=>mesh.material===M.habitatShell).length'),1,'Only the floor is added; original exterior stays visible');
assert.deepEqual(Object.keys(run('trainingAppearance.controls')),['skin','core','glow','eye'],'Only skins and colors are editable');
for(let i=0;i<30;i++)run('tickTrainingAppearance(.05,1)');
assert(camera.position.distanceTo(run('trainingAppearance.end'))<1e-8,'Camera settles just inside doorway');
for(const side of [-1,1]) {
 const leaf=building.children.find(mesh=>mesh.userData.trainingDoorSide===side && mesh.geometry.parameters.width===.96);
 const handle=building.children.find(mesh=>mesh.userData.trainingDoorSide===side && mesh.geometry.parameters.width===.04);
 assert(Math.abs((leaf.position.x-handle.position.x)-side*.41)<1e-8,'Handle stays attached to sliding leaf despite cached geometry rounding');
}
const fire=(name,extra={})=>previewEvents.get(name)({pointerId:1,button:0,clientX:0,deltaY:0,deltaMode:0,preventDefault:noop,stopImmediatePropagation:noop,...extra});
const originalYaw=run('trainingAppearance.display.rotation.y');
fire('pointerdown',{clientX:100});fire('pointermove',{clientX:150});
assert.equal(run('trainingAppearance.display.rotation.y'),originalYaw+.5,'Dragging rotates the preview');
assert.equal(context.baseBattleBroPrototype.rotation.y,0,'Preview rotation preserves the world character');
fire('pointerup');assert.equal(captures.size,0,'Release clears pointer capture');
const originalDistance=camera.position.distanceTo(run('trainingAppearance.look'));
fire('wheel',{deltaY:-300});run('tickTrainingAppearance(.05,1)');
assert(camera.position.distanceTo(run('trainingAppearance.look'))<originalDistance,'Scroll up zooms in');
for(let i=0;i<20;i++)fire('wheel',{deltaY:1000});assert.equal(run('trainingAppearance.zoom'),1.6);
for(let i=0;i<20;i++)fire('wheel',{deltaY:-1000});assert.equal(run('trainingAppearance.zoom'),.35);
run("trainingAppearance.controls.skin.value='ice';changeTrainingAppearance()");
assert.equal(context.baseBattleBroPrototype.userData.characterFamily,'juggernaut');assert.equal(context.baseBattleBroPrototype.userData.form,4);
assert.equal(run('trainingAppearance.display.rotation.y'),originalYaw+.5,'Appearance changes preserve preview rotation');
assert.equal(context.baseBattleBroPrototype.userData.visualVariant,'ice');assert.deepEqual(context.baseBattleBroPrototype.position,source.position,'Changing skin preserves home location');
run("trainingAppearance.controls.eye.value='blue';changeTrainingAppearance()");assert.equal(context.baseBattleBroPrototype.userData.colors.eye,'blue');
run('leaveTrainingAppearance()');assert.equal(shell.visible,true);assert.equal(get('training-appearance-controls').hidden,true);assert.equal(resumed,1);
assert.equal(facility.getObjectByName('appearancePedestal'),undefined);
for(const mesh of building.children.filter(mesh=>mesh.userData.trainingDoorSide))
 assert(Math.abs(mesh.position.x-mesh.userData.trainingDoorSide*(mesh.geometry.parameters.width===.96?.5:.09))<1e-8,'Door and handle return to closed positions');assert(!run('trainingDoorApproach(fp.pos,trainingFacility)'),'Exit lands outside trigger');
for(let i=0;i<60;i++)run('tickTrainingAppearance(.05,3)');assert(!run('trainingAppearance.active'),'Standing outside does not re-enter');
console.log('training appearance: doorway-only home entry, smooth camera, pedestal, fixed type/form, live skin/colors, cleanup and safe exit passed');
