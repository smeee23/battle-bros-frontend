'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('  // ---------- exploration terrain ----------'),html.indexOf('  const homeFPTerrain ='));
const location=id=>({locationId:id,enabled:true,occupant:'0',pendingChallengeId:'0',cooldownUntil:'0',minLevel:'1',maxLevel:'0'});
const documentFor=ids=>({snapshot:{timestamp:'100'},locations:ids.map(location),battleBros:[]});
const initial=documentFor(['1','2','3','4']);
function stream(terrain,point){
 const player={pos:new THREE.Vector3(point.x,point.y??10,point.z),grounded:false};
 for(let i=0;i<100&&terrain.diagnostics().pending;i++)terrain.tick(0,player,.6,null);
}
function setup(){
 const scene=new THREE.Scene(),xrWorldRoot=new THREE.Group();scene.add(xrWorldRoot);
 const context=vm.createContext({EndlessTerritories:require('../assets/endless-territories'),THREE,persCam:new THREE.PerspectiveCamera(55,16/9,.02,1100),createBattleArena:require('../assets/battle-arena.js'),scene,xrWorldRoot,TILE:1,DIRT_H:.5,TOP_H:.18,BUILDABLE_LAND_Y_OFFSET:-.18,currentSkyBgHex:0,
 explorationActive:false,terrainRiseForLevel:n=>Math.max(0,(Math.min(64,n||1)-1)*.2),terrainLevelForCell:c=>c?.terrainFloors||1,
 applyDistanceMistSettings(){}});
 require('../tools/terrain-render-fixture')(context,html);
 // Inspect the actual solver without adding a production mutation/debug API.
 vm.runInContext(source.replace('return {group,getCell,','return {test:{islands,contact,simulate,celestialHeight,CELESTIAL},group,getCell,')+'\nthis.terrain=explorationTerrain;',context);
 return {terrain:context.terrain,scene,xrWorldRoot,context};
}

const {terrain}=setup();const spawn=terrain.activate(null,.6,initial);stream(terrain,spawn);const bodies=[...terrain.territoryBodies()];
assert(bodies.length>=1&&bodies.length<=2,'Arrival shows one or two territory islands');
assert(!terrain.blocksBodyAt(spawn.x,spawn.z,spawn.y-.6,spawn.y+.1),'The selected spawn has safe headroom');
for(const b of bodies){
 assert.equal(b.site.part,0);assert.equal(b.site.sky,undefined);
 for(const e of b.entries){const c=terrain.getCell(e.x,e.z);assert(c.terrainFloors<=6,'Territory relief bounded');}
 const x=Math.floor(b.site.x),z=Math.floor(b.site.z),p=terrain.cellToWorld(x,z,b.site.id);
 assert.equal(terrain.canExcavate(x,z,b.site.id),false,'Landmark footprint protected');
 assert.equal(terrain.setCell(x,z,{terrainFloors:30},b.site.id),false);
 assert(!b.root.getObjectByName('obelisk'),'The island has no hardcoded obelisk');
 assert.equal(terrain.residentSpawns,undefined,'Ordinary NPC spawning is absent');
 assert(b.entries.length>30);assert(b.site.polygon.length>=3);
}
console.log('Territory terrain: up to two nearby slots, safe arrival, shared island hulls, gentle relief and protected claim center passed.');

const fresh=setup();
assert.equal(fresh.terrain.activate('1'),null);
assert(!fresh.terrain.group.visible,'Unknown defended territories do not fall back to the origin');
assert(fresh.terrain.activate());
assert.equal([...fresh.terrain.territoryBodies()].length,0,'Missing publication leaves scenery');

const dynamic=setup(),catalog=documentFor(['1','2','3','4','5','6','9007199254740992','9007199254740993','9']);
const firstSpawn=dynamic.terrain.activate(null,.6,catalog);
stream(dynamic.terrain,firstSpawn);
const nearby=[...dynamic.terrain.territoryBodies()];
assert(nearby.length>=1&&nearby.length<=2);
const id=nearby[0].site.territoryId;
const before=dynamic.terrain.territoryArrival(id);
// This neighborhood has enough suitable islands regardless of the random arrival.
const distant={x:24*9,z:24*4};
dynamic.terrain.ensureAround(distant.x,distant.z);
dynamic.terrain.placeNearbyTerritories(distant,catalog);
stream(dynamic.terrain,distant);
const newBodies=[...dynamic.terrain.territoryBodies()];
assert(newBodies.length>=1&&newBodies.length<=2,'Wide exploration fills another neighborhood with up to two territories');
assert(newBodies.every(body=>nearby.every(old=>old.site.territoryId!==body.site.territoryId)),'Neighborhoods never duplicate a territory ID');
const beforeRadar=dynamic.terrain.diagnostics();
const unstreamed=dynamic.terrain.minimapTerritories(before.x,before.z,96).find(point=>point.id===id);
assert(unstreamed,'An assigned territory stays discoverable while its island is unloaded');
const distance=Math.hypot(unstreamed.x-before.x,unstreamed.z-before.z);
assert(!dynamic.terrain.minimapTerritories(before.x,before.z,distance-.01).some(point=>point.id===id),'Radar uses actual circular range');
assert.deepEqual(dynamic.terrain.diagnostics(),beforeRadar,'Radar reads placements without building terrain');
const found=catalog.locations.find(l=>[...nearby,...newBodies].every(b=>b.site.territoryId!==l.locationId)).locationId;
const placement=dynamic.terrain.placeTerritoryForVisit(found,distant);
assert(placement,'Lookup reserves a free slot for a specific ID');
assert(dynamic.terrain.territoryArrival(found),'Lookup supports safe arrivals with decimal string IDs');
assert.equal(dynamic.terrain.placeTerritoryForVisit(found,{x:1000,z:1000}),placement,'Lookup preserves an existing location');
dynamic.terrain.ensureAround(1000,1000);
const placedIds=new Set([...nearby.map(body=>body.site.territoryId),...newBodies.map(body=>body.site.territoryId),found]);
const exhausted={...catalog,locations:catalog.locations.filter(l=>placedIds.has(l.locationId))};
dynamic.terrain.placeNearbyTerritories({x:1000,z:1000},exhausted);
assert.equal([...dynamic.terrain.territoryBodies()].length,0,'Exhausted territory catalogs leave scenery');
const updated={...catalog,locations:catalog.locations.map(l=>({...l,enabled:false})).reverse()};
dynamic.terrain.placeNearbyTerritories({x:1000,z:1000},updated);
const after=dynamic.terrain.territoryArrival(id);
assert.equal(after.islandId,before.islandId,'Updates and restreaming preserve the original island');
assert(dynamic.terrain.diagnostics().islands<=100,'The local streaming window stays bounded');
dynamic.terrain.deactivate();
const secondSpawn=dynamic.terrain.activate(null,.6,catalog);
assert.equal(secondSpawn.islandId,firstSpawn.islandId,'Trips Home preserve the session spawn');
console.log('Territory arrivals: nearby placement, exploration, lookup, catalog exhaustion and stable streaming passed.');

// Exercise the production territory/resident adapter on the generated terrain.
(async()=>{
 const {terrain,context}=setup(),characters=require('./longneck-fixture')().api;
 const defenders=documentFor(['1','2']);
 const spawn=terrain.activate('1',.6,defenders);
 assert(terrain.placeTerritoryForVisit('2',spawn));
 const body=[...terrain.territoryBodies()].find(b=>b.site.territoryId==='1');
 const appearance={v:1,skin:'ice',colors:{core:'purple',glow:'cyan',eye:'green'}};
 let doc={snapshot:{timestamp:'100'},locations:[],battleBros:[]};
 Object.assign(context,characters,{fpJourney:{error:''},territoryClaimLocation:null,tickBattleBroWorldExpression(){},tickBattleBroExpression(){},tickLooseRockAttachments(){},EndlessTerritories:require('../assets/endless-territories'),window:{battleBrosReadTerritories:async()=>doc},document:{getElementById:()=>null},fp:{active:true,pos:new THREE.Vector3(body.root.position.x,0,body.root.position.z+7)},explorationActive:true,broEncounter:{active:null,cancel(){}},broEncounterMenu:{hidden:true},practiceBattle:{active:false},fpToolMenu:{hidden:true},trainingAppearance:{active:false},transportCube:{root:null},SPECTER_HOVER_CLEARANCE:.72,battleBroTerrain:require('../assets/battlebro-terrain'),disposeGroup(){},tickBattleBroArenaActor(){}});
 const residentsSource=html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  // ---------- transport cube'));
 let appearanceReads=0;
 context.window.battleBrosReadDefenderAppearance=async descriptor=>{
  assert.equal(descriptor.id,'3');appearanceReads++;return appearance;
 };
 vm.runInContext(residentsSource+'\nthis.territoryAdapter=endlessTerritories;this.residents=explorationResidents;',context);
 let time=0;
 for(const id of ['1','2'])for(let kind=0;kind<4;kind++)for(let level=1;level<=7;level++){
  doc.locations=['1','2'].map(locationId=>({locationId,enabled:true,pendingChallengeId:'0',occupant:locationId===id?'3':'0',cooldownUntil:'0',minLevel:'1',maxLevel:'0'}));
  doc.battleBros=[{tokenId:'3',locationId:id,kind:String(kind),level:String(level),active:true}];
  const hasAppearance=kind===0&&level===1;
  doc.worlds=hasAppearance?[{kind:'appearance',id:'3',revision:'1',path:'worlds/appearance/3/1-published.json'}]:[];
  const arrival=terrain.territoryArrival(id);assert(arrival);
  context.fp.pos.set(arrival.x,arrival.y,arrival.z);
  context.territoryAdapter.refresh();await new Promise(setImmediate);time+=3;
  context.territoryAdapter.tick(time,.05);
  if(hasAppearance){
   await new Promise(setImmediate);time+=.1;
   context.territoryAdapter.tick(time,.05);
  }
  vm.runInContext(`tickExplorationResidents(${time},.05)`,context);
  const actor=context.residents.get('territory:'+id);assert(actor,`Territory ${id}: family ${kind}, form ${level} defender appears beside the arriving player`);
  assert.equal(actor.character,['juggernaut','monsters','specter','longneck'][kind]);assert.equal(actor.broTokenId,'3');assert.equal(actor.territoryLocationId,id);assert.equal(actor.patrolRadius,3);assert(actor.motion,'Existing navigation initialized');
  if(hasAppearance){
   assert.equal(actor.root.userData.visualVariant,appearance.skin);
   assert.deepEqual({...actor.root.userData.colors},appearance.colors,'The spawned rig applies every published color');
  }
  const arrivalCell=terrain.worldToCell(arrival.x,arrival.z);
  assert.equal(actor.islandId,terrain.getCell(arrivalCell.x,arrivalCell.z).islandId,'Player and defender occupy the same island');
  assert.equal(terrain.getCell(actor.x,actor.z).islandId,actor.islandId,'Defender placement cannot use an adjacent island');
  assert(actor.root.parent===terrain.group);assert(context.residentSupport(actor),'Real rig remains supported after its first navigation tick');
 }
 assert.equal(appearanceReads,1,'Both islands reuse the same immutable appearance document');
 context.fp.active=false;context.territoryAdapter.tick(time+3,.05);assert(![...context.residents.keys()].some(key=>key.startsWith('territory:')));
 console.log('Real territory defenders: all 28 family/forms on spaced session slots, player/defender island identity, supported navigation and removal passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
