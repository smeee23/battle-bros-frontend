'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict'),vm=require('node:vm');
const file=path.resolve('tools/rock-battlebro.test.js');
let source=fs.readFileSync(file,'utf8').split('const api = context.api;')[0];
source=source.replace('const M = {','const M_ANIMAL={hoof:new THREE.MeshLambertMaterial()}; const M = {')
 .replace('globalThis.api = {','globalThis.api = {registerSpecterMover,registerMinotaurMover,tickSpecterMovers,tickMinotaurMovers,specterMovers,minotaurMovers,');
const fixture=new Module(file,module);fixture.filename=file;fixture.paths=Module._nodeModulePaths(path.dirname(file));
fixture._compile(source+'module.exports={api:context.api,THREE};',file);
const {api,THREE}=fixture.exports;
for(const character of ['specter','longneck'])for(const form of [2,3,4,5,6,7])for(const cancelAt of [null,'WINDUP','THROWN']) {
  api.specterMovers.clear();api.minotaurMovers.clear();
  const root=api.createBattleBroCharacter({character,variant:form%2?'ice':'lava',form});api.worldGroup.add(root);
  const spectral=character==='specter';
  const mover=spectral?api.registerSpecterMover(root,32,32,.72):api.registerMinotaurMover(root,32,32);
  root.position.set(.5,spectral?.72:0,.5);
  const tick=spectral?api.tickSpecterMovers:api.tickMinotaurMovers;
  mover.pauseRemaining=mover.idleRemaining=mover.rearingCooldown=1000;
  tick(0,1/60);
  const idle=mover.state;let hits=0;
  const destination=new THREE.Vector3(7,6,9);
  const target={isActive:()=>true,getPosition:out=>out.copy(destination),getVelocity:out=>out.set(0,0,0),onImpact:()=>hits++};
  mover.state=spectral?'FLOATING':'WALKING_FLAT';
  assert.equal(api.telekineticRockThrow(root,target),false,'Moving characters finish their move before throwing');
  mover.state=idle;
  const action=api.telekineticRockThrow(root,target);assert(action,`${character} ${form} starts`);
  const original=action.rock.node,parent=original.parent;
  mover.pauseRemaining=mover.idleRemaining=mover.rearingCooldown=-1;
  let cancelled=false,pointed=false,windNeck=Infinity,releaseNeck=-Infinity;
  const rig=root.userData.rig,plant=root.position.clone();
  for(let frame=1;frame<=1800&&root.userData.rockThrow;frame++) {
    if(cancelAt===action.state&&!cancelled){api.cancelTelekineticRockThrow(root);cancelled=true;}
    tick(frame/60,1/60);
    assert.equal(mover.state,idle,'Throw holds the stance through recall and settling');
    assert.equal(root.position.x,plant.x);assert.equal(root.position.z,plant.z);
    assert.equal(action.rock.node,original);assert.equal(original.parent,parent);
    for(const node of [rig.torso,rig.head,...(spectral?[rig.leftArm.shoulder,rig.leftArm.elbow,rig.leftArm.hand]:[rig.neckPivot,rig.jaw])])
      assert(Number.isFinite(node.quaternion.x+node.quaternion.y+node.quaternion.z+node.quaternion.w),'Finite throw pose');
    if(spectral&&action.state==='THROWN') {
      const shoulder=rig.leftArm.shoulder.getWorldPosition(new THREE.Vector3());
      const direction=rig.leftArm.hand.getWorldPosition(new THREE.Vector3()).sub(shoulder).normalize();
      assert(direction.dot(destination.clone().sub(shoulder).normalize())>.97,'Specter extends the casting arm toward the target');
      pointed=true;
    }
    if(!spectral&&action.state==='WINDUP')windNeck=Math.min(windNeck,rig.neckPivot.rotation.x);
    if(!spectral&&action.state==='THROWN')releaseNeck=Math.max(releaseNeck,rig.neckPivot.rotation.x);
  }
  assert.equal(root.userData.rockThrow,null,`${character} ${form}: finishes`);
  assert.equal(action.rock.action,null,'Orbit ownership returns');
  assert.equal(root.userData.rockThrowBodyBases.length,0,'Pose offsets are fully restored');
  assert.equal(hits,cancelAt?0:1,'One impact for a completed throw; none for a cancelled throw');
  if(!cancelAt){if(spectral)assert(pointed);else assert(releaseNeck-windNeck>.25,'Longneck has a visible neck wind-up and forward snap');}
  api.worldGroup.remove(root);
}
console.log('Specter/Longneck home throws: forms II–VII, directed arm cast, neck wind-up, planted stance, recall and cancellation OK');
// All three mover registries share the same two-projectile limit and plane policy.
const html=fs.readFileSync('index.html','utf8');
const plane=new THREE.Group(),scene=new THREE.Group();scene.add(plane);
const state={phase:'flying',isHostile:true,willLandAtAirCommand:false,curve:{},velocity:new THREE.Vector3()};
const groups=[new Set(),new Set(),new Set()];
for(const [i,group] of groups.entries()) {
  const root=new THREE.Group();root.position.set(8+i,0,0);root.userData={form:4,rockThrowCooldown:0,looseRocks:{phase:0}};scene.add(root);
  group.add({root,state:i===1?'IDLE_HOVER':'IDLE'});
}
const fired=[];
const context={THREE,cropDusterState:state,cropDusterRoot:plane,cropDusterModel:{},lavaMonsterMovers:groups[0],specterMovers:groups[1],minotaurMovers:groups[2],
 ANTI_AIR_MIN_RANGE:3,ANTI_AIR_MAX_RANGE:42,spawnPlaneHitSmoke(){},telekineticRockThrow:(root)=>{fired.push(root);return true;}};
const start=html.indexOf('  function canTurretsEngageActivePlane()'),end=html.indexOf('  function canTurretsEngageInspectionCamera()',start);
vm.runInNewContext(html.slice(start,end)+'\nthis.tick=tickBattleBroPlaneAttacks;',context);
context.tick(.1);assert.equal(fired.length,2,'Global cap spans mover families');
assert.equal(fired[1],groups[1].values().next().value.root,'Idle hovering Specter can target hostile planes');
groups[0].clear();groups[1].clear();fired.length=0;context.tick(.1);
assert.equal(fired[0],groups[2].values().next().value.root,'Idle Longneck can target hostile planes');
state.isHostile=false;fired.length=0;context.tick(.1);assert.equal(fired.length,0,'Friendly plane policy is unchanged');
console.log('Specter/Longneck plane throws: all mover registries, shared concurrency limit and hostile eligibility OK');
