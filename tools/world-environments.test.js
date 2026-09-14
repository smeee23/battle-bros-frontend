'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const context=vm.createContext({window:{},GRID:96,MAX_TERRAIN_FLOORS:64,activeEnvironment:'LUNAR',TRAINING_FACILITY_SCALE:4.5,coerceGridSize:()=>96});
vm.runInContext(section('  function seedHash(', '  // Re-normalise a percent dict')+section('  const WORLD_ENVIRONMENTS','  // Expose for tests / command palette.')+section('  function terrainRiseForLevel(', '  function terrainLevelForCell('),context);
const generate=context.window.__generateProceduralWorld || vm.runInContext('generateProceduralWorld',context);
const signatures=new Set();
for(const seed of ['review','battlebros','0','alternate']) {
  const data=generate({seed,environment:'LUNAR'}),layout=context.trainingFacilityLayout(96);
  assert.equal(data.environment,'LUNAR');assert.equal(data.cells.length,9216);
  assert.equal(new Set(data.cells.map(c=>c.x+','+c.z)).size,9216);
  assert.equal(JSON.stringify(data),JSON.stringify(generate({seed})));
  const cells=new Map(data.cells.map(c=>[c.x+','+c.z,c]));
  const at=(x,z)=>cells.get(x+','+z);
  assert(data.cells.every(c=>c.terrain === 'stone' && c.terrainFloors >= 1 && c.terrainFloors <= 4), 'Mountain replaced by low stone terrain');
  for (let x=0;x<96;x++) for(let z=0;z<96;z++) {
    if (context.trainingFacilityTerrainCell(x,z,96)) assert.equal(at(x,z).terrainFloors,3,'Level facility foundation and approach');
  }
  for(let x=44;x<=52;x++)for(let z=44;z<=52;z++)assert.equal(at(x,z).terrainFloors,3,'Clear central preview area');
  for(const variant of ['lava','sand','plant','ice','EARTH','DESERT'])
    assert.equal(JSON.stringify(generate({seed,environment:variant})),JSON.stringify(data),'One land for every character');
  signatures.add(data.cells.map(c=>c.terrainFloors).join(','));
}
assert.equal(signatures.size,4,'Seeds still vary the relief');
assert.equal(context.terrainRiseForLevel(64),12.600000000000001);
assert.equal(context.terrainRiseForLevel(100),context.terrainRiseForLevel(64));
assert.match(source,/const HOME_GRID_DEFAULT = 96;/);
assert.match(source,/const useBatchedTerrain = insideHome;/);
console.log('Lunar world: deterministic shared low terrain, permanent facility apron, mountain removal and center clearance passed.');
