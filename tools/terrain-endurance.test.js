'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const filename=path.join(__dirname,'rock-battlebro.test.js'),fixture=new Module(filename,module);
fixture.filename=filename;fixture.paths=Module._nodeModulePaths(__dirname);
fixture._compile(fs.readFileSync(filename,'utf8').split('const api = context.api;')[0]+'module.exports={api:context.api,THREE};',filename);
const {api,THREE}=fixture.exports;
const heights=new Map();
for(let x=0;x<64;x++)for(let z=0;z<64;z++) {
  // Deliberately fragmented surfaces: few full foot-sized level landing areas.
  let n=((Math.imul(x+11,73856093)^Math.imul(z+5,19349663))>>>0);
  n=Math.imul(n^(n>>>13),1274126177)>>>0; n=(n^(n>>>16))>>>0;
  heights.set(x+','+z,(n%4)*.2);
}
api.setTerrainHeights([...heights]);
const movers=[];
for(let form=1;form<=7;form++) {
  const x=8+form*6,z=16,root=api.createRockBattleBro({variant:'lava',form});
  root.position.set(x-31.5,heights.get(x+','+z),z-31.5);root.rotation.y=Math.PI/4;api.worldGroup.add(root);
  const mover=api.registerLavaMonsterMover(root,x,z);mover.pauseRemaining=0;
  movers.push({mover,previous:root.position.clone(),minuteDistance:0,total:0,rough:0,lastProgress:0});
}
for(let frame=0;frame<6000;frame++) {
  const t=frame*.05; api.tickLavaMonsterMovers(t,.05);
  for(const record of movers) {
    const m=record.mover,p=m.root.position,d=Math.hypot(p.x-record.previous.x,p.z-record.previous.z);
    assert(Number.isFinite(p.y),'Finite body height throughout clambering');
    assert(p.distanceTo(record.previous)<.18,'No teleporting to escape');
    record.minuteDistance+=d;record.total+=d;if(d>.001)record.lastProgress=t;
    record.previous.copy(p);if(m.terrainPlan?.rough)record.rough++;
    assert(t-record.lastProgress<45,`Form ${m.root.userData.form}: sustained stall at ${t}s (${m.state})`);
    if((frame+1)%1200===0) {
      assert(record.minuteDistance>1,`Form ${m.root.userData.form}: makes progress in every minute`);
      record.minuteDistance=0;
    }
  }
}
for(const r of movers) {
  assert(r.rough>0,`Form ${r.mover.root.userData.form}: exercised uneven-contact fallback`);
  console.log(`Form ${r.mover.root.userData.form}: ${r.total.toFixed(1)} terrain units in five simulated minutes`);
}
// Hard exclusions still apply; relaxed contact rules are not obstacle bypasses.
const m=movers[0].mover,x=m.cellX,z=m.cellZ+1;
api.setBlocked([x+','+z]);
assert.equal(api.evaluateLavaTerrainStep(x,z,m).reason,'destination-obstacle');
api.setBlocked([]);api.setTerrainHeights([[x+','+z,3]]);
assert.equal(api.evaluateLavaTerrainStep(x,z,m).reason,'step-height');
console.log('terrain endurance: all seven simultaneous actors traverse fragmented terrain for five simulated minutes without sustained stalls');

// Waiting must never grant unlimited cliff-climbing reach.
for(let form=1;form<=7;form++) {
  api.lavaMonsterMovers.clear();api.setBlocked([]);
  api.setTerrainHeights([['32,32',0],['32,33',1.4]]);
  const root=api.createRockBattleBro({variant:'lava',form});root.position.set(.5,0,.5);api.worldGroup.add(root);
  const mover=api.registerLavaMonsterMover(root,32,32);
  mover.stationaryFor=30;mover.blockedAttempts=10;
  assert.equal(api.evaluateLavaTerrainStep(32,33,mover).reason,'step-height');
  api.worldGroup.remove(root);
}
console.log('terrain recovery: waiting does not bypass cliff height limits');
