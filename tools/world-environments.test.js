'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const context=vm.createContext({window:{},GRID:50,MAX_TERRAIN_FLOORS:64,activeEnvironment:'LUNAR',TRAINING_FACILITY_SCALE:4.5,coerceGridSize:()=>50});
vm.runInContext(section('  function seedHash(', '  // Re-normalise a percent dict')+section('  const WORLD_ENVIRONMENTS','  // Expose for tests / command palette.')+section('  function terrainRiseForLevel(', '  function terrainLevelForCell('),context);
const generate=context.window.__generateProceduralWorld || vm.runInContext('generateProceduralWorld',context);
const signatures=new Set();
for(const seed of ['review','battlebros','0','alternate']) {
  const data=generate({seed,environment:'LUNAR'}),layout=context.trainingFacilityLayout(50);
  assert.equal(data.environment,'LUNAR');assert.equal(data.cells.length,2500);
  assert.equal(new Set(data.cells.map(c=>c.x+','+c.z)).size,2500);
  assert.equal(JSON.stringify(data),JSON.stringify(generate({seed})));
  const at=(x,z)=>data.cells.find(c=>c.x===x&&c.z===z);
  assert(data.cells.every(c=>c.terrain === 'stone' && c.terrainFloors >= 1 && c.terrainFloors <= (context.stargateTerrainLevel(c.x,c.z,50) || 4)), 'Low stone terrain with a stepped portal corner');
  for (let x=0;x<50;x++) for(let z=0;z<50;z++) {
    if (context.trainingFacilityTerrainCell(x,z,50)) assert.equal(at(x,z).terrainFloors,3,'Level facility foundation and approach');
  }
  for(let x=21;x<=29;x++)for(let z=21;z<=29;z++)assert.equal(at(x,z).terrainFloors,3,'Clear central preview area');
  for(const variant of ['lava','sand','plant','ice','EARTH','DESERT'])
    assert.equal(JSON.stringify(generate({seed,environment:variant})),JSON.stringify(data),'One land for every character');
  signatures.add(data.cells.map(c=>c.terrainFloors).join(','));
}
assert.equal(signatures.size,4,'Seeds still vary the relief');
assert.equal(context.terrainRiseForLevel(64),12.600000000000001);
assert.equal(context.terrainRiseForLevel(100),context.terrainRiseForLevel(64));
assert.match(source,/const HOME_GRID_DEFAULT = 50;/);
assert.match(source,/const useBatchedTerrain = insideHome;/);
console.log('Lunar world: deterministic shared low terrain, permanent facility apron, mountain removal and center clearance passed.');
