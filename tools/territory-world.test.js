'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const terrain=require('../assets/territory-world');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
for(const seed of ['territory-v1','ice','lava']) {
  const world=terrain.generate(seed),cells=world.cells,at=(x,z)=>cells[x*50+z];
  assert.deepEqual(world,terrain.generate(seed));assert.equal(cells.length,2500);
  assert(cells.every(c=>c.terrainFloors>=1&&c.terrainFloors<=160));
  assert(Math.max(...cells.map(c=>c.terrainFloors))>100,'Major mountain exceeds Home limit');
  for(const material of ['sand','snow','grass','stone','water','lava','dirt'])assert(cells.some(c=>c.terrain===material),material);
  assert(cells.filter(c=>c.kind).length<180,'Sparse shared scenery');
  assert(!cells.some(c=>c.kind==='house'),'No training building');
  const center=cells.filter(c=>Math.hypot(c.x-24.5,c.z-24.5)<9);
  assert(new Set(center.map(c=>c.terrainFloors)).size>30,'Irregular mountain relief');
  // A real traversable connected route reaches all staging clearings.
  const seen=new Set(),queue=[[10,10]];
  while(queue.length){const [x,z]=queue.shift(),key=x+','+z;if(seen.has(key))continue;seen.add(key);
    for(const [nx,nz] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){
      if(nx<0||nz<0||nx>=50||nz>=50)continue;
      const a=at(x,z),b=at(nx,nz);
      if(!b.kind&&!['water','lava'].includes(b.terrain)&&Math.abs(b.terrainFloors-a.terrainFloors)<=3&&!seen.has(nx+','+nz))queue.push([nx,nz]);
    }
  }
  assert(seen.has('47,2'),'Ice transporter approach connects to all staging areas');
  for(const cell of cells.filter(c=>terrain.portalTerrainLevel(c.x,c.z))) {assert.equal(cell.terrain,'snow');assert.equal(cell.terrainFloors,8);assert.equal(cell.kind,null);}
  for(const area of world.defenderAreas){assert(seen.has(area.x+','+area.z),'Connected defender area');assert.equal(at(area.x,area.z).terrainFloors,8);}
}
const THREE=require('../vendor/three/three.r128.min.js');
const home={v:4,gridSize:50,cells:[{x:9,z:9,terrain:'stone',kind:'rock',terrainFloors:3}],seed:'unchanged'};
let board=structuredClone(home),saves=0,rejectNext=false;
const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false});return nodes.get(id);};
const ctx=vm.createContext({console,Promise,Math,JSON,clearTimeout,saveTimer:0,
  territoryWorldState:{active:false,switching:false,home:null,territory:null,cameras:{}},MAX_TERRAIN_FLOORS:64,
  neighborInspectionState:{active:false},explorationActive:false,trainingAppearance:{active:false},fp:{active:false},flight:{active:false},
  target:new THREE.Vector3(2,3,4),viewSize:28,azimuth:1,polar:.7,cameraMode:'ortho',renderVisibleDistance:2,
  disposeAllCellMeshes:()=>{},clearGhostWorld:()=>{},world:{},document:{getElementById:node},window:{},BattleBrosTerritoryWorld:terrain,STORAGE_KEY:'home',
  localStorage:{setItem:()=>saves++},saveLocalGameState:()=>saves++,getSerializableWorldState:()=>structuredClone(board),
  applyState:(data,opts)=>{if(rejectNext){rejectNext=false;return false;}board=structuredClone(data);assert(opts.territorySwitch);opts.onDone();return true;},
  setCameraMode:mode=>{ctx.cameraMode=mode;},resetCameraDefaults:()=>{},updateCamera:()=>{},ensureGhostBoardsAroundTarget:()=>{},findActiveWorld:()=>null
});
vm.runInContext(section('  async function toggleTerritoryWorld()', '  window.__toggleTerritoryWorld'),ctx);
vm.runInContext(section('  function canPersistActiveColony()', '  function selectedNeighborColonyContext()'),ctx);
(async()=>{
  await ctx.toggleTerritoryWorld();assert(ctx.territoryWorldState.active);assert.equal(ctx.MAX_TERRAIN_FLOORS,160);assert.equal(ctx.canPersistActiveColony(),false);
  assert.equal(saves,2);board.cells[0].kind='rock';const edited=structuredClone(board);
  ctx.target.set(8,9,10);
  await ctx.toggleTerritoryWorld();assert.deepEqual(board,home);assert.deepEqual(ctx.target.toArray(),[2,3,4]);assert.equal(ctx.MAX_TERRAIN_FLOORS,64);assert(ctx.canPersistActiveColony());
  await ctx.toggleTerritoryWorld();assert.deepEqual(board,edited);assert.deepEqual(ctx.target.toArray(),[8,9,10]);
  await ctx.toggleTerritoryWorld();assert.deepEqual(board,home);
  rejectNext=true;await assert.rejects(ctx.toggleTerritoryWorld(),/rejected/);assert.deepEqual(board,home);assert.equal(ctx.territoryWorldState.active,false);assert.equal(ctx.territoryWorldState.switching,false);
  ctx.neighborInspectionState.active=true;assert.equal(await ctx.toggleTerritoryWorld(),false);
  const accounting=vm.createContext({BATTLEBROS_MIGRATION_MODE:false,territoryWorldState:{active:true},setCell:()=>true});
  vm.runInContext(section('  function applyCatalogCellMutation(', '  function resourceToneForRule('),accounting);
  assert.equal(accounting.applyCatalogCellMutation(1,1,{kind:'house'}),true,'Dev placement does not enter Home resource accounting');
  const heights=vm.createContext({MAX_TERRAIN_FLOORS:160});
  vm.runInContext(section('  function terrainRiseForLevel(', '  function terrainLevelForCell('),heights);
  assert.equal(heights.terrainRiseForLevel(160),31.8);heights.MAX_TERRAIN_FLOORS=64;
  assert.equal(heights.terrainRiseForLevel(160),heights.terrainRiseForLevel(64),'Home height cap unchanged');
  assert.match(source,/Home-only landmark foundations/);
  assert.match(source,/function addTerraformGreenhouseBox[^]*?territoryWorldState.active\) return null/);
  console.log('Territory World: deterministic biomes, tall mountain, connected staging areas, independent edits/cameras, Home persistence isolation and switch guards passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
