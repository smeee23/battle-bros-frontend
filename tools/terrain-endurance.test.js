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

// An actor surrounded by maximum-height normal terrain must eventually climb
// out, including after the selected route resets the failed-attempt counter.
for(let form=1;form<=7;form++) {
  api.lavaMonsterMovers.clear();api.setBlocked([]);
  api.setTerrainHeights(Array.from({length:15*15},(_,i)=>{
    const x=25+i%15,z=25+Math.floor(i/15);return [x+','+z,x===32&&z===32?0:1.4];
  }));
  const root=api.createRockBattleBro({variant:'lava',form});root.position.set(.5,0,.5);api.worldGroup.add(root);
  const mover=api.registerLavaMonsterMover(root,32,32);mover.pauseRemaining=0;
  let escaped=false,usedEmergency=false;
  for(let frame=0;frame<700;frame++) {
    api.tickLavaMonsterMovers(frame*.05,.05);
    usedEmergency ||= mover.terrainPlan?.clamberLimit>1.39;
    if(mover.cellX!==32||mover.cellZ!==32){escaped=true;break;}
  }
  assert(escaped&&usedEmergency,`Form ${form}: climbs out of maximum-height terrain pocket`);
  api.worldGroup.remove(root);
}
console.log('terrain emergency: all seven forms climb out of maximum-height terrain pockets');
