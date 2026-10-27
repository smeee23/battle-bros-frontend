'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const M=Object.fromEntries(['habitatShell','habitatTrim','habitatBand','habitatWindow','habitatPanel','greenhouseGlass'].map(k=>[k,new THREE.MeshBasicMaterial()]));
const portals=new Set(),boxes=new Map();
const context=vm.createContext({THREE,M,GRID:50,TRAINING_FACILITY_SCALE:4.5,geomCache:new Map(),
 worldGroup:new THREE.Group(),tilePos:(x,z)=>({x:x-24.5,z:z-24.5}),BUILDABLE_LAND_Y_OFFSET:-.18,TOP_H:.18,
 terrainRiseForLevel:n=>(n-1)*.2,getBoxGeometry:(...args)=>{const key=args.join(',');if(!boxes.has(key))boxes.set(key,new THREE.BoxGeometry(...args));return boxes.get(key);},castReceive(){},
 registerRuntimeObject:root=>portals.add(root),disposeGroup:root=>portals.delete(root)});
vm.runInContext(section('  function roundedBox(', '  // -------- materials --------')
 +section('  function makeTransporter(', '  const CRYSTAL_RIG_MAX_LEVEL')
 +section('  function stargateLayout(', '  function generateProceduralWorld(')
 +section('  let stargateLandmark =', '  async function generateWorld('),context);
const layout=context.stargateLayout();
assert.equal(layout.x,47.5);assert.equal(layout.z,1.5);
assert.equal(context.stargateTerrainLevel(layout.x,layout.z),7);
for(let distance=4;distance<=7;distance++)assert.equal(context.stargateTerrainLevel(layout.x-distance,layout.z),10-distance);
context.syncStargate();
const root=context.worldGroup.children[0],placed=context.makeTransporter();
assert.equal(root.name,'permanentHomeTransporter');
assert.equal(root.rotation.y,-Math.PI/4,'Faces map center');
assert.equal(root.userData.buildingType,'transporter');
assert(root.userData.nonInteractive&&root.userData.permanentEnvironment);
assert(root.getObjectByName('transporter-roof-cap'));
assert(!root.getObjectByName('gate-shell'),'The circular stargate has been replaced');
assert(new THREE.Box3().setFromObject(placed).max.y<1.5);
for(let i=0;i<root.children.length;i++)assert.equal(root.children[i].geometry,placed.children[i].geometry,'Default fixture reuses the normal transporter model');
context.syncStargate();
assert.equal(context.worldGroup.children.length,1,'Reload does not duplicate the fixture');
assert.equal(root.parent,null);assert.equal(portals.size,1,'Travel registry follows fixture replacement');
// Execute the actual mutation guard used by erase, bulk edits, move and terrain edits.
Object.assign(context,{terrainConsumeLocks:new Map(),neighborInspectionState:{active:false},setCellMutationAuthority:'ui',trainingFacilityOccupiesCell:()=>false});
const guard=section('  function setCell(x, z, opts) {','    const prev = ensureWorldCell(x, z);');
vm.runInContext(guard+'return true;\n}',context);
assert.equal(context.setCell(48,1,{kind:null}),false,'Corner fixture cannot be deleted');
assert.equal(context.setCell(48,1,{terrainFloors:1}),false,'Corner foundation cannot be excavated or overwritten');
assert.equal(context.setCell(25,25,{kind:null}),true,'Protection does not extend to player-built transporters');
console.log('Corner transporter: shared model, stepped foundation, permanent edit/delete protection, reload deduplication and travel registry passed.');
// Territory uses the same permanent model and protection in its ice corner.
context.territoryWorldState={active:true};
context.BattleBrosTerritoryWorld=require('../assets/territory-world');
context.syncStargate();
const territoryGate=context.worldGroup.children[0];
assert.equal(territoryGate.name,'permanentTerritoryTransporter');
assert(Math.abs(territoryGate.position.y-1.4)<1e-10);
assert.equal(portals.size,1,'Switching worlds keeps exactly one default portal registered');
assert.equal(context.setCell(48,1,{kind:null}),false,'Territory default cannot be erased');
assert.equal(context.setCell(48,1,{terrainFloors:1}),false,'Territory footing is protected');
context.syncStargate();assert.equal(context.worldGroup.children.length,1,'Territory reload deduplicates');
context.territoryWorldState.active=false;context.syncStargate();
assert.equal(context.worldGroup.children[0].name,'permanentHomeTransporter');
console.log('Territory ice transporter: shared model, level snow footing, protected removal/terrain and independent Home restoration passed.');
