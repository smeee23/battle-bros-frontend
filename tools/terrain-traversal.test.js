'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
// Exercise the production inline planner and the real Three.js rigs.
const filename = path.join(__dirname, 'rock-battlebro.test.js');
const fixture = new Module(filename, module);
fixture.filename = filename; fixture.paths = Module._nodeModulePaths(__dirname);
fixture._compile(fs.readFileSync(filename,'utf8').split('const api = context.api;')[0]
  + 'module.exports={api:context.api,THREE};',filename);
const {api, THREE} = fixture.exports;
function terrain(height) {
  api.setBlocked([]); api.lavaMonsterMovers.clear();
  api.setTerrainHeights(Array.from({length:21*21},(_,i)=>{
    const x=22+i%21,z=22+Math.floor(i/21); return [x+','+z,height(x,z)];
  }));
}
function actor(form,y=0) {
  const root=api.createRockBattleBro({variant:'lava',form});
  root.position.set(.5,y,.5); api.worldGroup.add(root);
  return api.registerLavaMonsterMover(root,32,32);
}
function clean(m) { api.lavaMonsterMovers.delete(m); api.worldGroup.remove(m.root); }
function checkPlan(m,plan) {
  assert(plan);
  for(const swing of [...plan.turn.plans.flat(),...plan.swings]) {
    const point=new THREE.Vector3();
    for(let i=0;i<=100;i++) {
      const travel=api.sampleLavaContactSwing(point,swing,i/100);
      const yaw=swing.startYaw+(swing.yaw-swing.startYaw)*travel;
      const e=api.lavaContactExtent(m,swing.index,yaw);
      const top=api.lavaTerrainRectangle(point.x+e.x-e.hx,point.x+e.x+e.hx,point.z+e.z-e.hz,point.z+e.z+e.hz);
      assert(point.y>=top-1e-7,`Form ${m.root.userData.form}: swept contact clears terrain (${i} / ${point.y} / ${top})`);
      if(i===100) assert(Number.isFinite(api.lavaTerrainRectangle(point.x+e.x-e.hx,point.x+e.x+e.hx,
        point.z+e.z-e.hz,point.z+e.z+e.hz,point.y)),'Entire planted footprint supported');
    }
  }
}
for(const form of [1,2,3,4,5,6,7]) {
  for(const type of ['flat','up','down','diagonal','along-wall','passage']) {
    terrain((x,z)=>type==='up'?(z>=33?.2:0):type==='down'?(z<33?.2:0):type==='diagonal'?(x+z>=66?.2:0)
      :type==='along-wall'?(x>=34?1.2:0):type==='passage'?(x<32||x>33?1.2:0):0);
    const m=actor(form,type==='down'?.2:0);
    const result=api.evaluateLavaTerrainStep(32,33,m);
    assert.notEqual(result.grade,'BLOCKED',`Form ${form}: ${type} traversable (${result.reason})`);
    checkPlan(m,result.plan);
    if(type==='flat') assert.equal(result.grade,'IDEAL');
    if(type==='up'||type==='down') assert.equal(result.grade,'CLIMBABLE');
    clean(m);
  }
  // Previously three turn directions were rejected next to this modest terrace.
  terrain((x,z)=>z>=33?.2:0);
  let m=actor(form);
  for(const [dx,dz] of [[1,0],[-1,0],[0,-1],[1,1],[-1,1]]) {
    const result=api.evaluateLavaTerrainStep(32+dx,32+dz,m);
    assert.notEqual(result.grade,'BLOCKED',`Form ${form}: local terrace alternative ${dx},${dz}`);
    checkPlan(m,result.plan);
  }
  clean(m);
  // Sustained runtime progress from a wall/pocket; normal escape is preferred
  // when available, otherwise wait, back up and use a preflighted new heading.
  terrain((x,z)=>z>=33||x<=30||x>=34?1.2:0);
  m=actor(form); m.pauseRemaining=0;
  let backed=false, escaped=false, previous=m.root.position.clone(), maxDelta=0;
  for(let frame=0;frame<3000;frame++) {
    api.tickLavaMonsterMovers(frame/60,1/60);
    maxDelta=Math.max(maxDelta,m.root.position.distanceTo(previous)); previous.copy(m.root.position);
    if(frame%8===0) {
      m.root.updateMatrixWorld(true);
      const anchors=m.anchors||[m.leftAnchor,m.rightAnchor];
      for(let i=0;i<2;i++) {
        const node=form<4?m.parts.limbs[i]:m.parts[i?'rightArm':'leftArm'].hand;
        const expected=anchors[i].clone();expected.y+=m.terrainContacts[i].sole;
        assert(node.getWorldPosition(new THREE.Vector3()).distanceTo(expected)<1e-5,
          `Form ${form}: actual support reaches planned contact in ${m.state}`);
      }
    }
    backed ||= m.recoveryState==='BACKUP';
    if(m.cellZ<=30 || m.cellX!==32) {escaped=true;break;}
  }
  assert(escaped,`Form ${form}: leaves pocket instead of remaining stuck`);
  assert(maxDelta<.08,`Form ${form}: no root teleport during escape`);
  if(form>=4) assert(backed,`Form ${form}: dead end uses recovery`);
  clean(m);
}
// Recovery cannot be triggered by two immediate calls; elapsed immobility matters.
terrain((x,z)=>z>=33?1.2:0);
let m=actor(7);
assert.equal(api.selectLavaWalkRoute(m),null);
assert.equal(api.selectLavaWalkRoute(m),null);
m.stationaryFor=4; m.traversalClock=4;
let route=api.selectLavaWalkRoute(m);
assert(route?.reverse,'Sustained obstruction triggers checked retreat');
assert(m.recoveryExit,'Exit planned before backing');
assert(m.failedTerrain.has('32,32'),'Old pocket temporarily penalized');
m.recoveryExit=null;
assert.equal(api.selectLavaWalkRoute(m),null,'Cooldown prevents immediate repeat recovery');
clean(m);
// Genuine enclosure stays blocked, with useful reasons and no stale plan.
terrain(()=>0); m=actor(7);
assert(api.lavaCellIsWalkable(32,33,m));
api.setBlocked(['31,32','33,32','32,31','32,33','31,31','33,31','31,33','33,33']);
assert(!api.lavaCellIsWalkable(32,33,m)); assert.equal(m.candidateTerrainPlan,null);
assert.equal(m.lastTraversal.reason,'destination-obstacle');
m.stationaryFor=10;m.traversalClock=10;
for(let i=0;i<4;i++) assert.equal(api.selectLavaWalkRoute(m),null);
clean(m);
// Occupancy is diagnosed independently from contact clearance.
terrain(()=>0); m=actor(1);
const other={root:new THREE.Group(),cellX:32,cellZ:33,targetCellX:32,targetCellZ:33};
api.worldGroup.add(other.root);api.lavaMonsterMovers.add(other);
assert.equal(api.evaluateLavaTerrainStep(32,33,m).reason,'destination-occupied');
api.lavaMonsterMovers.delete(other);api.worldGroup.remove(other.root);clean(m);
// Failed targets are rechecked after becoming available; diagnostic memory expires.
terrain((x,z)=>z===33?1.2:0); m=actor(1);
assert.equal(api.evaluateLavaTerrainStep(32,33,m).grade,'BLOCKED');
m.failedTerrain=new Map([['32,33',14]]);
api.setTerrainHeights([]);
route=api.selectLavaWalkRoute(m);assert(route?.plan,'Choose a currently safe step');
m.traversalClock=20;
route=api.selectLavaWalkRoute(m);assert(!m.failedTerrain.has('32,33'),'Failure memory expires');
clean(m);
console.log('terrain traversal: graded landings, terrace turns, diagonal arcs, narrow passage, pockets, timed recovery, cooldown, occupancy and failure expiry OK');

// Landing reach and swing clearance are separate: a raised obstacle between
// two low landings can be cleared without permitting a landing on a tall wall.
terrain((x,z)=>x===33?.8:0); m=actor(7);
const swing=api.planLavaContactSwing(m,new THREE.Vector3(.5,0,.5),new THREE.Vector3(2.5,0,.5),0,0,.16);
assert(swing?.raised,'Explicit higher arc clears an intervening obstacle');
checkPlan(m,{turn:{plans:[]},swings:[swing]});
assert(api.evaluateLavaTerrainStep(33,32,m).plan?.rough,'Higher landing uses mobility-first clamber');
clean(m);
