'use strict';
// Use the same extracted production rig fixture as the morphology suite.
const fs=require('fs'),path=require('path'),Module=require('module');
const file=path.join(__dirname,'rock-battlebro.test.js');
const source=fs.readFileSync(file,'utf8').split('const api = context.api;')[0];
const fixture=new Module(file,module);fixture.filename=file;fixture.paths=Module._nodeModulePaths(__dirname);
fixture._compile(source+'module.exports={api:context.api,THREE,assert};',file);
const {api,THREE,assert}=fixture.exports;
for(const form of [2,3,4,5,6,7]) for(const failure of ['none','windup','flight','return-moving','removed','miss','fast-plane','reverse-orbit']) {
  api.lavaMonsterMovers.clear();
  const root=api.createRockBattleBro({variant:'lava',form}); root.position.set(.5,0,.5);api.worldGroup.add(root);
  const mover=api.registerLavaMonsterMover(root,32,32);mover.pauseRemaining=1000;
  api.tickLavaMonsterMovers(0,1/60);
  const debris=root.userData.looseRocks.debris, original=debris.map(r=>r.node), parents=debris.map(r=>r.node.parent);
  if(failure==='reverse-orbit') for(const rock of debris) rock.speed=-Math.abs(rock.speed);
  const phases=debris.map(r=>r.orbitPhase);
  let alive=true,hits=0;
  const position=new THREE.Vector3(7,6,9), velocity=new THREE.Vector3(failure==='fast-plane' ? -12.4 : -.4,0,.2);
  const target={isActive:()=>alive,getPosition:out=>out.copy(position),getVelocity:out=>out.copy(velocity),onImpact:p=>{hits++;assert(p.distanceTo(position)<1e-6);}};
  api.setBattleBroExpression(root,'littleSmile');
  const positions=original.map(node=>node.getWorldPosition(new THREE.Vector3()));
  const action=api.telekineticRockThrow(root,target);assert(action);
  const selected=debris.indexOf(action.rock), before=positions[selected];
  assert(before.distanceTo(action.position)<1e-8,'Acquisition preserves current position');
  assert.equal(api.telekineticRockThrow(root,target),false,'One owner per rock/action');
  let coastAngle=0, lastCoastSpeed=Infinity, coastFrames=0, fastestAngularSpeed=0, recallAngularSpeed=0;
  const states=new Set(); let previous=before.clone(), previousVelocity=new THREE.Vector3(), previousState=action.state, frames=0, fastest=0, returned=false;
  for(;frames<1500;frames++) {
    const dt=1/60;
    position.addScaledVector(velocity,dt);
    if(failure==='windup'&&action.state==='WINDUP'&&action.elapsed>.6) alive=false;
    if(failure==='miss'&&action.state==='THROWN'&&!action.cancelled) position.x+=100;
    if(failure==='flight'&&action.state==='THROWN'&&action.elapsed>.15) alive=false;
    if(failure==='removed'&&action.state==='THROWN') {api.worldGroup.remove(root);api.worldGroup.add(root);}
    if(failure==='return-moving'&&['RETURNING','REJOINING','COASTING'].includes(action.state)) {
      root.position.x+=dt*.35; root.position.z-=dt*.2;root.rotation.y+=dt*.8;
      const anchors=mover.anchors||[mover.leftAnchor,mover.rightAnchor];
      for(const anchor of anchors){anchor.x+=dt*.35;anchor.z-=dt*.2;}
    }
    const previousPhase=action.rock.orbitPhase;
    states.add(action.state);
    api.tickLavaMonsterMovers((frames+1)*dt,dt);
    const current=original[selected].getWorldPosition(new THREE.Vector3());
    assert(current.distanceTo(previous)<1.3,`Form ${form} ${failure} ${action.state}: no positional jump`);
    fastest=Math.max(fastest,action.multiplier);
    fastestAngularSpeed=Math.max(fastestAngularSpeed,Math.abs(action.rock.speed)*action.multiplier);
    if(action.state==='COASTING') {
      if(coastFrames===0)recallAngularSpeed=Math.abs(action.rock.speed)*action.multiplier;
      assert(action.multiplier<=lastCoastSpeed+1e-8,'Returning rock continuously slows in orbit');
      lastCoastSpeed=action.multiplier; coastFrames++;
      coastAngle+=Math.abs(action.rock.orbitPhase-previousPhase);
    }
    if(action.state==='SETTLE'&&action.releaseCount) assert.equal(action.multiplier,1,'Rejoining does not restart wind-up speed');
    if(action.state==='THROWN'&&form>=5) {
      const arm=root.userData.rig.leftUpperArm, shoulder=arm.shoulder.getWorldPosition(new THREE.Vector3());
      const direction=arm.hand.getWorldPosition(new THREE.Vector3()).sub(shoulder).normalize();
      assert(direction.dot(position.clone().sub(shoulder).normalize())>.99,'Directing arm points at target on release');
    }
    const measuredVelocity=current.clone().sub(previous).multiplyScalar(60);
    if(previousState==='IMPACT') {
      assert(measuredVelocity.distanceTo(action.impactVelocity)<1e-6,'Rock keeps incoming speed and heading through plane');
    }
    if(previousState==='THROWN' && action.state==='IMPACT') {
      assert(measuredVelocity.distanceTo(action.impactVelocity)<1e-6,'Impact preserves measured incoming momentum');
    }
    if(previousState==='RETURNING' && action.returnElapsed<.05) {
      assert(measuredVelocity.dot(action.impactVelocity || measuredVelocity)>0,'Recall starts forward before banking around');
    }
    if(previousState==='REJOINING' && action.state==='COASTING') assert(measuredVelocity.distanceTo(previousVelocity)<1,'Tangential re-entry matches orbit velocity');
    previousVelocity.copy(measuredVelocity); previousState=action.state;
    previous.copy(current);
    debris.forEach((rock,i)=>{assert.equal(rock.node,original[i]);assert.equal(rock.node.parent,parents[i]);
      if(i!==selected) assert(Math.abs(rock.orbitPhase-(phases[i]+rock.speed*(frames+1)*dt))<1e-8,'Other orbital phases unaffected');});
    if(!root.userData.rockThrow){returned=true;break;}
  }
  assert(returned,`Form ${form} ${failure} returns and settles`);
  assert.equal(debris[selected].action,null);
  assert.equal(root.userData.slots.face.userData.expression.name,'littleSmile');
  if(failure==='none'||failure==='return-moving'||failure==='fast-plane'||failure==='reverse-orbit') {
    assert.equal(hits,1);assert.equal(action.releaseCount,1);assert.equal(action.impactCount,1);
    for(const state of ['NOTICE','WINDUP','RELEASE','THROWN','IMPACT','RETURNING','REJOINING','COASTING','SETTLE'])assert(states.has(state),state);
    assert(fastest>5,'Visible spin-up');
    assert(Math.abs(fastestAngularSpeed-5.5)<1e-8,'Spin-up reaches the same angular speed for slow and reverse orbits');
    assert(Math.abs(recallAngularSpeed-(form===7?2.2:2.8))<1e-8,'Recall angular speed is independent of base orbit speed');
    assert(coastFrames>200 && coastAngle>5.5,`Form ${form}: rock circles before settling (${coastFrames} frames, ${coastAngle} radians)`);
  } else assert.equal(hits,0);
  const end=original[selected].getWorldPosition(new THREE.Vector3());
  api.tickLavaMonsterMovers((frames+2)/60,1/60);
  assert(original[selected].getWorldPosition(new THREE.Vector3()).distanceTo(end)<.06,'Smooth normal orbit after rejoin');
  api.worldGroup.remove(root);
}
console.log('telekinetic rock: II/III/IV/V/VI/VII same-object lifecycle, moving intercept/return, phase isolation, cancellation/removal and normal-orbit handoff OK');

// Real normal-world adapter: retain the turret's existing hostile-plane policy
// and invalidate a captured target when the aircraft starts a different run.
const vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('  function canTurretsEngageActivePlane()');
const end=html.indexOf('  function canTurretsEngageInspectionCamera()',start);
const plane=new THREE.Group(),bro=new THREE.Group(),world=new THREE.Group();world.add(plane,bro);
plane.position.set(10,5,0);bro.userData={visualVariant:'lava',form:4,rockThrowCooldown:0};
const state={phase:'flying',isHostile:false,willLandAtAirCommand:false,curve:{},velocity:new THREE.Vector3(1,0,2)};
let acquired=null,shots=0;
const fixtureContext={THREE,cropDusterState:state,cropDusterRoot:plane,cropDusterModel:{},
  lavaMonsterMovers:new Set([{root:bro,state:'IDLE'}]),ANTI_AIR_MIN_RANGE:3,ANTI_AIR_MAX_RANGE:42,
  spawnPlaneHitSmoke:()=>{},telekineticRockThrow:(root,target)=>{acquired=target;shots++;return true;}};
vm.runInNewContext(html.slice(start,end)+'globalThis.update=tickBattleBroPlaneAttacks;',fixtureContext);
fixtureContext.update(.1);assert.equal(shots,0,'Friendly planes are never targeted');
state.isHostile=true;state.willLandAtAirCommand=true;fixtureContext.update(.1);assert.equal(shots,0,'Landing aircraft are excluded');
state.willLandAtAirCommand=false;fixtureContext.update(.1);assert.equal(shots,0,'Characters without loose rocks cannot acquire a plane');
bro.userData.looseRocks={phase:0};fixtureContext.update(.1);assert.equal(shots,1,'Existing hostile eligibility acquires a plane');
assert(acquired.getVelocity(new THREE.Vector3()).equals(state.velocity));
state.curve={};assert.equal(acquired.isActive(),false,'Reused aircraft object is not confused with previous flight');
console.log('plane adapter: shared turret eligibility, velocity, landing exclusions and flight identity OK');

// Mature juggernauts finish both steps before throwing and remain planted
// through recall/settle, even when their walking pause has already expired.
for (const form of [4,5,6,7]) {
  api.lavaMonsterMovers.clear();
  const root=api.createBattleBroCharacter({character:'juggernaut',variant:'lava',form});
  root.position.set(.5,0,.5);api.worldGroup.add(root);
  const mover=api.registerLavaMonsterMover(root,32,32);
  mover.pauseRemaining=1000;api.tickLavaMonsterMovers(0,1/60);
  const target={isActive:()=>true,getPosition:out=>out.set(7,6,9),getVelocity:out=>out.set(0,0,0),onImpact:()=>{}};
  mover.targetX=mover.startX+.5;mover.targetZ=mover.startZ;
  mover.leftGoal.copy(mover.leftAnchor).add(new THREE.Vector3(.5,0,0));
  mover.rightGoal.copy(mover.rightAnchor).add(new THREE.Vector3(.5,0,0));
  api.beginJuggernautStride(mover);
  const start=root.position.clone();
  api.tickJuggernautStride(mover,.05);
  assert(root.position.distanceTo(start)<1e-9,'Body waits for reaching support');
  assert.equal(api.telekineticRockThrow(root,target),false,'Cannot interrupt a stride');
  for(let i=0;i<150 && mover.juggernautStride;i++)api.tickJuggernautStride(mover,.05);
  assert.equal(mover.state,'IDLE');
  assert(mover.leftAnchor.distanceTo(mover.leftGoal)<1e-9,'Trailing support completes its step');
  const action=api.telekineticRockThrow(root,target);assert(action);
  const planted=root.position.clone();mover.pauseRemaining=-1;
  for(let i=0;i<1800 && root.userData.rockThrow;i++) {
    api.tickLavaMonsterMovers(i/60,1/60);
    assert.equal(mover.state,'IDLE','Throw owns stance through settling');
    assert(root.position.distanceTo(planted)<1e-8,'Body stays above planted supports');
  }
  assert.equal(root.userData.rockThrow,null,'Stance lock releases after throw');
  api.worldGroup.remove(root);
}
console.log('juggernaut: complete stride before throw and hold stance through recall/settle OK');
