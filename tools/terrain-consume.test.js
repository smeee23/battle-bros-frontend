'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const filename=path.join(__dirname,'rock-battlebro.test.js');
let fixture=fs.readFileSync(filename,'utf8').split('const api = context.api;')[0];
fixture=fixture.replace("const terrainRiseForLevel = level => (level - 1) * 0.2;", "${section('  function terrainRiseForLevel(', '  function tileLevelForCell(')}");
fixture=fixture.replace("const getWorldCell = (x,z) => ({terrain: blocked.has(x+','+z) ? 'water' : 'grass'});", `const cells=new Map();
  const getWorldCell=(x,z)=>cells.get(x+','+z)||{terrain:'stone',terrainFloors:1};
  const withSetCellMutationAuthority=(authority,fn)=>fn();
  const setCell=(x,z,c)=>{cells.set(x+','+z,c);heights.set(x+','+z,terrainRiseForLevel(c.terrainFloors));};`);
fixture=fixture.replace('globalThis.api = {','globalThis.api = {consumeTerrain, validateTerrainConsume, selectTerrainConsumeTarget, terrainConsumePool, terrainConsumeLocks, setCell, getWorldCell, battleBroGroundHeight,');
fixture+='\nmodule.exports={api:context.api,THREE};';
const Module=require('node:module'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(__dirname);m._compile(fixture,filename);
const {api,THREE}=m.exports;
for(const variant of ['lava','sand','plant','ice']) for(const form of [1,2,3,4,5,6,7]) for(const material of (variant==='lava'?['stone','sand','lava','grass']:['stone'])) for(const neighbor of [1,5]) {
  api.lavaMonsterMovers.clear();
  api.setCell(32,32,{terrain:'stone',terrainFloors:1});
  api.setCell(32,33,{terrain:material,terrainFloors:4});
  api.setCell(32,34,{terrain:'stone',terrainFloors:neighbor});
  const root=api.createRockBattleBro({variant,form});root.position.set(.5,0,.5);api.worldGroup.add(root);
  const mover=api.registerLavaMonsterMover(root,32,32);mover.state='IDLE';mover.turn=null;
  const target={x:32,z:33};
  assert.equal(api.consumeTerrain(mover,{x:55,z:55}).ok,false);
  assert.equal(api.consumeTerrain(mover,{x:31,z:32}).ok,false);
  for(let level=4;level>1;level--) {
    const result=api.consumeTerrain(mover,target);assert(result.ok,`${form}/${material}: ${result.reason}`);
    const a=result.action;assert.equal(api.consumeTerrain(mover,target).ok,false);
    assert.equal(api.validateTerrainConsume(mover,target).reason,'cell-busy');
    for(let i=0;root.userData.terrainConsume && i<400;i++) {
      api.tickLavaMonsterMovers(i/60,1/60);
      assert.equal(api.getWorldCell(32,33).terrainFloors,a.impacted?level-1:level,'Exact impact timing');
      assert(Math.abs(api.battleBroGroundHeight(32,33)-(a.impacted?level-2:level-1)*.2)<1e-9);
      root.traverse(n=>assert(Number.isFinite(n.position.x+n.position.y+n.position.z),'Finite poses'));
    }
    assert.equal(root.userData.terrainConsume,null);assert.equal(api.terrainConsumeLocks.size,0);
    assert.equal(api.getWorldCell(32,34).terrainFloors,neighbor);
    assert.equal(api.getWorldCell(32,32).terrainFloors,1);
    assert.equal(a.batch.busy,false);
  }
  assert.equal(api.consumeTerrain(mover,target).ok,false);
  api.worldGroup.remove(root);
}
assert(api.terrainConsumePool.length<=4);
console.log('Terrain consume: materials, forms, neighbors, impact timing, live heights, repeat/base rejection and cleanup passed.');
// Interrupted wind-up must not mutate, and releases its pooled resources.
api.lavaMonsterMovers.clear();
api.setCell(32,33,{terrain:'stone',terrainFloors:3});
const root=api.createRockBattleBro({variant:'lava',form:4});root.position.set(.5,0,.5);api.worldGroup.add(root);
const actor=api.registerLavaMonsterMover(root,32,32);actor.state='IDLE';actor.turn=null;
assert.equal(api.consumeTerrain(null).ok,false);
assert.equal(api.consumeTerrain(actor,{x:-1,z:33}).ok,false);
assert.equal(api.consumeTerrain(actor,{x:32.5,z:33}).ok,false);
let a=api.consumeTerrain(actor,{x:32,z:33}).action;assert(a);
api.worldGroup.remove(root);api.tickLavaMonsterMovers(0,1/60);
assert.equal(api.getWorldCell(32,33).terrainFloors,3);assert.equal(api.terrainConsumeLocks.size,0);assert.equal(a.batch.busy,false);
api.worldGroup.add(root);api.lavaMonsterMovers.add(actor);
api.setCell(32,33,{terrain:'water',terrainFloors:3});assert.equal(api.consumeTerrain(actor,{x:32,z:33}).ok,false);
api.setCell(32,33,{terrain:'stone',terrainFloors:3,kind:'rock'});assert.equal(api.consumeTerrain(actor,{x:32,z:33}).ok,false);
api.setCell(32,33,{terrain:'stone',terrainFloors:3});a=api.consumeTerrain(actor,{x:32,z:33}).action;assert(a);
// Simulate wholesale world replacement bypassing setCell; impact revalidates identity.
api.setCell(32,33,{terrain:'sand',terrainFloors:3});
for(let i=0;i<120;i++)api.tickLavaMonsterMovers(i/60,1/60);
assert.equal(api.getWorldCell(32,33).terrainFloors,3);assert.equal(a.cancelled,true);assert.equal(api.terrainConsumeLocks.size,0);
console.log('Terrain consume: invalid inputs, occupied terrain, removal and stale-world cancellation passed.');
