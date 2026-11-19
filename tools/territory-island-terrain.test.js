'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('  // ---------- exploration terrain ----------'),html.indexOf('  const homeFPTerrain ='));
function setup(withTerritories=true){
 const scene=new THREE.Scene(),xrWorldRoot=new THREE.Group();scene.add(xrWorldRoot);
 const context=vm.createContext({EndlessTerritories:require('../assets/endless-territories'),THREE,persCam:new THREE.PerspectiveCamera(55,16/9,.02,1100),createBattleArena:require('../assets/battle-arena.js'),scene,xrWorldRoot,TILE:1,DIRT_H:.5,TOP_H:.18,BUILDABLE_LAND_Y_OFFSET:-.18,currentSkyBgHex:0,
 explorationActive:false,terrainRiseForLevel:n=>Math.max(0,(Math.min(64,n||1)-1)*.2),terrainLevelForCell:c=>c?.terrainFloors||1,
 applyDistanceMistSettings(){}});
 require('../tools/terrain-render-fixture')(context,html);
 // Inspect the actual solver without adding a production mutation/debug API.
 vm.runInContext(source.replace('return {group,getCell,','return {test:{islands,contact,simulate,celestialHeight,CELESTIAL},group,getCell,')+'\nthis.terrain=explorationTerrain;',context);
 if(withTerritories)context.terrain.setTerritories(['1','2','3','4'].map(locationId=>({locationId})));
 return {terrain:context.terrain,scene,xrWorldRoot,context};
}

const {terrain}=setup();terrain.activate();const bodies=[...terrain.territoryBodies()];
assert.equal(bodies.length,4);assert.deepEqual(new Set(bodies.map(b=>b.site.biome)),new Set(['LAVA','ICE','DESERT','EARTH']));
for(const b of bodies){
 assert.equal(b.site.part,0);assert.equal(b.site.sky,undefined);
 for(const e of b.entries){const c=terrain.getCell(e.x,e.z);assert(c.terrainFloors<=6,'Territory relief bounded');}
 const x=Math.floor(b.site.x),z=Math.floor(b.site.z),p=terrain.cellToWorld(x,z,b.site.id);
 assert.equal(terrain.canExcavate(x,z,b.site.id),false,'Landmark footprint protected');
 assert.equal(terrain.setCell(x,z,{terrainFloors:30},b.site.id),false);
 assert(terrain.blocksBodyAt(b.root.position.x,b.root.position.z,0,8,0),'Obelisk blocks traversal');
 assert.equal(terrain.residentSpawns,undefined,'Ordinary NPC spawning is absent');
 assert(b.entries.length>30);assert(b.site.polygon.length>=3);
}
console.log('Territory terrain: four near-spawn biomes, shared island hulls, gentle relief, protected/collidable landmarks and resident separation passed.');

// Published admin additions extend the native world and provide safe arrivals.
const fresh=setup(false);assert.equal(fresh.terrain.activate('1'),null);assert(!fresh.terrain.group.visible,'Unknown territories do not fall back to the origin');
const catalog=Array.from({length:104},(_,i)=>({locationId:String(i+1),enabled:true}));
const dynamic=setup(),before=dynamic.terrain.territoryArrival('1');
// Exercise catalog additions while the eventual island is already streamed.
const preview=setup(false);preview.terrain.setTerritories(catalog);
const previewArrival=preview.terrain.territoryArrival('5');assert(previewArrival);
const previewBody=[...preview.terrain.territoryBodies()].find(b=>b.site.territoryId==='5');
dynamic.terrain.ensureAround(previewBody.site.x,previewBody.site.z);
const native=dynamic.terrain.test.islands.get(previewBody.site.id)||dynamic.terrain.test.islands.get(dynamic.terrain.getCell(Math.floor(previewBody.site.x),Math.floor(previewBody.site.z)).islandId);
assert(native&&!native.site.territoryId,'A native island exists before the admin addition');
dynamic.terrain.setTerritories(catalog);
const converted=dynamic.terrain.test.islands.get(native.site.id);assert(converted.site.territoryId);assert.notEqual(converted.root,native.root,'Existing native terrain is rebuilt for the territory apron');
for(const id of catalog.map(l=>l.locationId)){
 const arrival=dynamic.terrain.activate(id,.6);assert(arrival,'Safe arrival exists for territory '+id);
 const body=[...dynamic.terrain.territoryBodies()].find(b=>b.site.territoryId===id);assert(body);
 assert(Math.hypot(arrival.x-body.root.position.x,arrival.z-body.root.position.z)<10,'Arrival is on the assigned territory');
 assert.equal(dynamic.terrain.getCell(dynamic.terrain.worldToCell(arrival.x,arrival.z).x,dynamic.terrain.worldToCell(arrival.x,arrival.z).z).islandId,body.site.id);
 assert(Math.abs(arrival.y-dynamic.terrain.groundYAt(arrival.x,arrival.z,.6))<1e-8,'Feet agree with the real streamed ground');
 assert(!dynamic.terrain.blocksBodyAt(arrival.x,arrival.z,arrival.y-.6,arrival.y+.1),'Arrival clears the landmark and overhead islands');
 assert.equal(dynamic.terrain.residentSpawns,undefined);
 assert(dynamic.terrain.diagnostics().islands<=100,'Arrival streams a bounded local window');
 dynamic.terrain.deactivate();
}
const after=dynamic.terrain.territoryArrival('1');assert.equal(after.x,before.x);assert.equal(after.z,before.z,'Admin additions preserve existing territory coordinates');
assert.equal(dynamic.terrain.setTerritories(catalog.slice().reverse()),false,'Publication order does not remap the world');
assert.equal(dynamic.terrain.setTerritories(catalog.map(l=>({...l,enabled:false}))),false,'Disabling locations preserves their islands');
const large=['9007199254740992','9007199254740993'];dynamic.terrain.setTerritories([...catalog,...large.map(locationId=>({locationId}))]);
const largeArrivals=large.map(id=>dynamic.terrain.territoryArrival(id));assert(largeArrivals.every(Boolean));assert.notEqual(largeArrivals[0].islandId,largeArrivals[1].islandId,'Large IDs have distinct islands');
dynamic.terrain.setTerritories(catalog);assert.equal(dynamic.terrain.territoryArrival(large[1]),null,'Removed publication entries lose their mapping');
console.log('Territory arrivals: catalog growth, native islands, safe footing/headroom, stable coordinates, disabled locations, large IDs and bounded streaming passed.');

// Exercise the production territory/resident adapter on the generated terrain.
(async()=>{
 const {terrain,context}=setup(),characters=require('./longneck-fixture')().api;terrain.activate();
 const body=[...terrain.territoryBodies()].find(b=>b.site.territoryId==='1');
 let doc={snapshot:{timestamp:'100'},locations:[],battleBros:[]};
 Object.assign(context,characters,{fpJourney:{error:''},territoryClaimLocation:null,tickBattleBroWorldExpression(){},tickBattleBroExpression(){},tickLooseRockAttachments(){},EndlessTerritories:require('../assets/endless-territories'),window:{battleBrosReadTerritories:async()=>doc},document:{getElementById:()=>null},fp:{active:true,pos:new THREE.Vector3(body.root.position.x,0,body.root.position.z+7)},explorationActive:true,broEncounter:{active:null,cancel(){}},broEncounterMenu:{hidden:true},practiceBattle:{active:false},fpToolMenu:{hidden:true},trainingAppearance:{active:false},transportCube:{root:null},SPECTER_HOVER_CLEARANCE:.72,battleBroTerrain:require('../assets/battlebro-terrain'),disposeGroup(){},tickBattleBroArenaActor(){}});
 const residentsSource=html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  // ---------- transport cube'));
 vm.runInContext(residentsSource+'\nthis.territoryAdapter=endlessTerritories;this.residents=explorationResidents;',context);
 let time=0;
 for(const id of ['1','2','3','4'])for(let kind=0;kind<4;kind++)for(let level=1;level<=7;level++){
  doc.locations=['1','2','3','4'].map(locationId=>({locationId,enabled:true,pendingChallengeId:'0',occupant:locationId===id?'3':'0',cooldownUntil:'0',minLevel:'1',maxLevel:'0'}));
  doc.battleBros=[{tokenId:'3',locationId:id,kind:String(kind),level:String(level),active:true}];
  terrain.setTerritories(doc.locations);
  const arrival=terrain.territoryArrival(id);assert(arrival);
  context.fp.pos.set(arrival.x,arrival.y,arrival.z);
  context.territoryAdapter.refresh();await new Promise(setImmediate);time+=3;
  context.territoryAdapter.tick(time,.05);
  vm.runInContext(`tickExplorationResidents(${time},.05)`,context);
  const actor=context.residents.get('territory:'+id);assert(actor,`Territory ${id}: family ${kind}, form ${level} defender appears beside the arriving player`);
  assert.equal(actor.character,['juggernaut','monsters','specter','longneck'][kind]);assert.equal(actor.broTokenId,'3');assert.equal(actor.territoryLocationId,id);assert.equal(actor.patrolRadius,3);assert(actor.motion,'Existing navigation initialized');
  const arrivalCell=terrain.worldToCell(arrival.x,arrival.z);
  assert.equal(actor.islandId,terrain.getCell(arrivalCell.x,arrivalCell.z).islandId,'Player and defender occupy the same island');
  assert.equal(terrain.getCell(actor.x,actor.z).islandId,actor.islandId,'Defender placement cannot use an adjacent island');
  assert(actor.root.parent===terrain.group);assert(context.residentSupport(actor),'Real rig remains supported after its first navigation tick');
 }
 context.fp.active=false;context.territoryAdapter.tick(time+3,.05);assert(![...context.residents.keys()].some(key=>key.startsWith('territory:')));
 console.log('Real territory defenders: all 28 family/forms on all four original territories, player/defender island identity, supported navigation and removal passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
