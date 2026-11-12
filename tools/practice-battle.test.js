'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const encounter=require('../assets/battlebro-encounter.js'),makePractice=require('../assets/practice-battle.js'),makeActions=require('../assets/character-battle-actions.js');
const {api,context,THREE}=require('./longneck-fixture')();
const html=fs.readFileSync('index.html','utf8');
const terrain={group:api.worldGroup,worldToCell:(x,z)=>({x:Math.floor(x),z:Math.floor(z),islandId:'test'}),cellToWorld:(x,z)=>({x:x+.5,z:z+.5}),getCell:()=>({terrain:'stone',terrainFloors:1,islandId:'test'}),groundYAt:()=>0};
Object.assign(context,{explorationTerrain:terrain,explorationActive:true,activeFPTerrain:()=>terrain});
vm.runInContext(html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  function fpGroundYAt(')),context);
function actor(character,form,x){
  const root=api.createBattleBroCharacter({character,form,variant:'ice'});api.worldGroup.add(root);root.position.set(x+.5,character==='specter'?.72:0,.5);
  const a={root,character,phase:.4,x,z:0,islandId:'test',mover:{root,parts:root.userData.locomotionRig||root.userData.rig,state:'IDLE',progress:0,ikTarget:new THREE.Vector3()}};
  context.tickExplorationResidentMotion(a,0,0);a.motion.pause=Infinity;return a;
}
const actions=makeActions(THREE,{throwRock:api.telekineticRockThrow,cancelThrow:api.cancelTelekineticRockThrow,restoreBody:api.restoreTelekineticBody,setExpression:api.setBattleBroExpression});
const bodyApplications=new Map(),applyBody=context.applyTelekineticBody;
context.applyTelekineticBody=(root,mover)=>{bodyApplications.set(root,(bodyApplications.get(root)||0)+1);applyBody(root,mover);};
const families=['juggernaut','monsters','specter','longneck'];
const sightRay=new THREE.Raycaster(),sightDirection=new THREE.Vector3(),sightPoint=new THREE.Vector3();
function unobstructed(camera,point,blocker){
  sightDirection.subVectors(point,camera.position);const distance=sightDirection.length();
  sightRay.set(camera.position,sightDirection.normalize());sightRay.far=Math.max(0,distance-.1);
  blocker.updateMatrixWorld(true);
  return !sightRay.intersectObject(blocker,true).some(hit=>{
    if(hit.object.material?.visible===false)return false;
    for(let node=hit.object;node;node=node.parent){if(!node.visible)return false;if(node===blocker)break;}
    return true;
  });
}
// Real encounter controllers, arbitrary headings, simultaneous rapid attacks and
// Arena hit reactions. Fixed-baseline parity alone cannot catch native turn jitter.
const makeArena=require('../assets/battle-arena.js');
const referenceActions=makeActions(THREE,{config:{maxHealth:10000},restoreBody:api.restoreTelekineticBody,setExpression:api.setBattleBroExpression});
let referenceArena=null,referenceHeadings=[0,0],referencePositions=null;
referenceArena=makeArena(THREE,api.createBattleBroCharacter,(actor,t,dt)=>{
  if(!referencePositions)return;
  const i=referenceArena.actors.indexOf(actor);actor.root.position.copy(referencePositions[i]);actor.root.rotation.set(0,referenceHeadings[i],0);
  context.tickBattleBroArenaActor(actor,t,dt);
},{actions:referenceActions,wristHeight:context.LAVA_WRIST_ABOVE_GROUND});
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x)),direction=new THREE.Vector3();
const edgeHeadings=[2.3,-2.3,Math.PI-.001,-Math.PI+.001,Math.PI/2+.001,-Math.PI/2-.001,1.1];
for(const family of families)for(let form=1;form<=7;form++)for(const heading of [.6,edgeHeadings[form-1]]){
  const actors=[actor(family,form,0),actor(family,form,8)];
  actors[1].root.position.x=actors[0].root.position.x+Math.sin(heading)*8;
  actors[1].root.position.z=actors[0].root.position.z+Math.cos(heading)*8;
  actors[0].root.rotation.y=-2.1;actors[1].root.rotation.y=.4;
  const originals=actors.map(a=>a.root.quaternion.clone()),originalMovers=actors.map(a=>a.mover);
  const combat=makeActions(THREE,{config:{maxHealth:10000},restoreBody:api.restoreTelekineticBody,setExpression:api.setBattleBroExpression});
  let camera=new THREE.PerspectiveCamera(),prompt=false,t=0,checking=false,drift=0;
  const positions=actors.map(a=>a.root.position.clone());referencePositions=null;
  for(let i=0;i<2;i++)referenceArena.setFighter(i,{character:family,form,variant:'ice'});
  referenceHeadings=[heading,angle(heading+Math.PI)];referencePositions=positions;
  referenceActions.start(referenceArena.actors,{opponentEnabled:false});
  const practice=makePractice(THREE,{actions:combat,combatOptions:{opponentEnabled:false},restoreBody:api.restoreTelekineticBody,
    attachments:(actor,t,dt)=>context.advanceLooseRockAttachments(actor.root,t,dt,actor.mover),
    camera:value=>{if(value)camera=value;return camera;},aspect:()=>1,show(){},status(){}});
  const controller=actor=>{
    const core=actor.character==='longneck'?api.ensureLongneckAnimation(actor.mover):actor.character==='specter'?api.ensureSpecterAnimation(actor.mover):api.ensureSupportAnimation(actor.mover);
    return {...core,encounterFrame(yaw,dt,t,canTurn){
      const result=core.encounterFrame(yaw,dt,t,canTurn);
      if(checking){
        actor.root.getWorldDirection(direction);const actual=Math.atan2(direction.x,direction.z),i=actors.indexOf(actor);
        assert(Math.abs(angle(actual-referenceHeadings[i]))<.005,`${family}/${form} heading ${heading}: clean facing cannot change during repeated hits`);
        assert(!['TURNING','START_FLOAT'].includes(actor.mover.state),'Hit restoration must not restart a native turn');
      }
      return result;
    }};
  };
  const system=encounter.create({player:()=>actors[0],npcs:()=>[actors[1]],enabled:()=>true,available:()=>true,controller,
    expressionName:()=> 'neutral',expression(){},tickExpression(){},canTurn:()=>true,
    carry:(actor,session)=>{if(drift){const delta=new THREE.Vector3(drift,0,0);actor.root.position.add(delta);session.carry(delta);}return true;},menu:value=>prompt=value,
    practice:{begin:s=>practice.begin(s),restore:()=>practice.restore(),tick:(t,dt)=>practice.tick(t,dt),finish:()=>practice.finish()}});
  const received=[0,0],shots=[0,0];let reactions=0;
  const tick=()=>{
    t+=.02;system.tick(t,.02);if(!checking)return;
    for(let i=0;i<2;i++)if((actors[i].hitsReceived||0)>received[i]){
      assert(referenceArena.hit(i),'Arena accepts the equivalent impact');received[i]=actors[i].hitsReceived;reactions++;
    }
    for(const fighter of combat.combat().fighters){
      const p=fighter.gesture.projectile;if(!p?.launched)continue;
      p.mesh.geometry.computeBoundingBox();
      const size=p.mesh.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(p.mesh.getWorldScale(new THREE.Vector3()));
      assert(Math.abs(Math.max(size.x,size.y,size.z)-.504)<1e-6,`${family}/${form}: both Practice throwers use the Form I Juggernaut rock size`);
    }
    referenceArena.tick(t,.02);
    for(let i=0;i<2;i++)assert(1-Math.abs(actors[i].root.quaternion.dot(referenceArena.actors[i].root.quaternion))<1e-8,'Practice and Arena retain equivalent root hit tilt and recovery');
  };
  for(let i=0;i<100&&!prompt;i++)tick();assert(prompt);system.end('yes');checking=true;
  for(let frame=0;frame<200;frame++){
    drift=frame>=100&&frame<110?.002:0;
    if(drift)positions.forEach(p=>p.x+=drift);
    for(let i=0;i<2;i++)if(shots[i]<8&&combat.canAttack(i)){assert(combat.attack(actors,i).ok);shots[i]++;}
    tick();
  }
  drift=0;assert.equal(reactions,16,'Both BROs receive all eight rapid attacks');
  assert(actors.every(a=>!a.root.userData.battleHit),'Both hit reactions recover');
  actors.forEach((a,i)=>assert(a.root.position.distanceTo(positions[i])<1e-6,'No hit-position drift, including moving-island carry'));
  for(let i=0;i<2;i++)assert(combat.attack(actors,i).ok);
  for(let i=0;i<80&&!actors.some(a=>a.root.userData.battleHit);i++)tick();
  assert(actors.some(a=>a.root.userData.battleHit),'Cancel during a live hit reaction');checking=false;
  // Recall/removal uses immediate cancellation; authored exit turns are covered
  // separately by the navigation fixtures below with their original cell routes.
  system.cancel();assert(!system.active);
  actors.forEach((a,i)=>{assert(1-Math.abs(a.root.quaternion.dot(originals[i]))<1e-8,'Exit restores the original physical orientation');assert.equal(a.mover,originalMovers[i]);assert(a.root.position.distanceTo(positions[i])<1e-6);});
  combat.dispose();for(const a of actors){const field=a.root.userData.looseRocks.orbitField;field?.parent?.remove(field);a.root.parent?.remove(a.root);}
}
referencePositions=null;referenceActions.dispose();
for(const family of families)for(let form=1;form<=7;form++){
  const a=actor(family,form,0),b=actor(families[(families.indexOf(family)+1)%families.length],8-form,8),actors=[a,b];
  const normalCamera=new THREE.PerspectiveCamera(55,16/9,.02,2000);normalCamera.position.set(0,3,-5);
  let currentCamera=normalCamera,hud=false,disabled=false,prompt=false,t=0,drift=0;
  const healthLabels=[{},{}];
  const practice=makePractice(THREE,{actions,combatOptions:{opponentEnabled:false},restoreBody:api.restoreTelekineticBody,attachments:(actor,t,dt)=>context.advanceLooseRockAttachments(actor.root,t,dt,actor.mover),camera:value=>{if(value)currentCamera=value;return currentCamera;},aspect:()=>form%2?.6:16/9,healthAnchor:(i,x,y,visible)=>Object.assign(healthLabels[i],{x,y,visible}),show:value=>hud=value,status:(state,busy)=>disabled=busy});
  const controller=actor=>{
    const core=actor.character==='longneck'?api.ensureLongneckAnimation(actor.mover):actor.character==='specter'?api.ensureSpecterAnimation(actor.mover):api.ensureSupportAnimation(actor.mover);
    return {...core,encounterPose:()=>{
      const pose=core.encounterPose(),capture=pose.capture;
      pose.capture=()=>{if(practice.active){
        assert.equal(bodyApplications.get(actor.root)||0,0,'Capture precedes combat attachment/body application');
        assert.equal(actor.root.userData.rockThrowBodyBases?.length||0,0,'No throw offsets in captured baseline');
        assert(![...(actor.battlePoses?.values()||[])].some(p=>p.active),'No attack/hit offsets in captured baseline');
      }capture();};return pose;
    }};
  };
  const system=encounter.create({player:()=>a,npcs:()=>[b],enabled:()=>true,available:actor=>!!actor.root.parent,
    controller,expressionName:()=> 'neutral',expression:()=>{},tickExpression:()=>{},canTurn:()=>true,
    carry:(actor,session)=>{if(drift){const delta=new THREE.Vector3(drift,0,0);actor.root.position.add(delta);session.carry(delta);}return true;},menu:value=>prompt=value,
    practice:{begin:session=>{
      for(const side of session.sides){
        const other=session.sides.find(s=>s!==side).actor.root.position,root=side.actor.root;
        const yaw=Math.atan2(other.x-root.position.x,other.z-root.position.z);
        assert(Math.abs(Math.atan2(Math.sin(yaw-root.rotation.y),Math.cos(yaw-root.rotation.y)))<.04,'Both BROs face their opponent before combat begins');
      }
      assert.equal(session.squareAge,1.1,'Battle-ready pose is available immediately');
      return practice.begin(session);},restore:()=>practice.restore(),tick:(t,dt)=>practice.tick(t,dt),finish:()=>practice.finish()}});
  const tick=()=>{bodyApplications.clear();t+=.05;system.tick(t,.05);if(practice.active)for(const actor of actors){
    const other=actors.find(a=>a!==actor).root.position,yaw=Math.atan2(other.x-actor.root.position.x,other.z-actor.root.position.z);
    actor.root.getWorldDirection(direction);
    assert(Math.abs(angle(yaw-Math.atan2(direction.x,direction.z)))<.04,'Combat facing stays stable throughout attacks and hit recovery');
    assert.equal(bodyApplications.get(actor.root),1,'Each BRO receives the shared attachment/body layer exactly once per frame');
    // The authored neck wind-up/release is at most .34 rad plus .09 rad ready
    // stance. This catches the observed full spins in real native controllers.
    const neck=actor.root.userData.rig.neckPivot;
    if(neck)assert(Math.abs(neck.rotation.x)<.8,`${actor.character}/${actor.root.userData.form}: bounded authored neck pitch`);
  }};
  for(let i=0;i<18&&!prompt;i++)tick();assert(prompt,`${family}/${form}: encounter prompt`);
  const positions=actors.map(a=>a.root.position.clone()),movers=actors.map(a=>a.mover),pauses=actors.map(a=>a.motion.pause);
  system.end('yes');assert(practice.active&&hud&&!prompt,'Yes enters combat immediately, including during a native turn');assert.equal(currentCamera,practice.camera);
  const initialOffset=currentCamera.position.clone().sub(a.root.position);
  assert(initialOffset.dot(new THREE.Vector3(1,0,0).applyQuaternion(a.root.quaternion))>0,'Right-shoulder camera switches immediately on Yes');
  for(let i=0;i<60;i++)tick();
  actors.forEach((actor,i)=>assert(actor.root.position.distanceTo(positions[i])<1e-6,'Entering practice keeps the same world position'));
  const f=b.root.position.clone().sub(a.root.position);f.y=0;f.normalize();const right=new THREE.Vector3(1,0,0).applyQuaternion(a.root.quaternion);right.y=0;right.normalize();const offset=currentCamera.position.clone().sub(a.root.position);
  assert(offset.dot(right)>0,'Camera over the right shoulder');assert(offset.dot(f)<0,'Camera behind the player');assert(offset.y>.5,'Camera above the player');
  assert(currentCamera.position.y>new THREE.Box3().setFromObject(a.root).max.y+.1,'Camera clears the player BRO height');
  for(const label of healthLabels){assert(Number.isFinite(label.x+label.y));assert(label.visible,`${family}/${form}: health anchor remains visible in the combat view`);}
  currentCamera.updateMatrixWorld(true);
  for(const actor of actors){const center=new THREE.Box3().setFromObject(actor.root).getCenter(new THREE.Vector3()).project(currentCamera);assert(Math.abs(center.x)<1&&Math.abs(center.y)<1,`${family}/${form}: both BRO centers visible (${center.x}, ${center.y})`);}
  new THREE.Box3().setFromObject(b.root).getCenter(sightPoint);
  assert(unobstructed(currentCamera,sightPoint,a.root),`${family}/${form}: player must not obscure the opponent`);
  assert(practice.attack(),`${family}/${form}: uses arena attack`);assert(!practice.attack(),'Repeated input cannot interrupt');assert(disabled);assert.equal(b.hitsReceived||0,0,'No reaction before impact');
  let hit=false,visibleFlight=0;const rock=a.root.userData.battleThrow.projectile;
  for(let i=0;i<1200&&actors.some(actions.busy);i++){
    tick();hit ||= !!b.root.userData.battleHit;
    if(rock.active&&rock.launched&&rock.age/rock.duration>=.55){
      assert(unobstructed(currentCamera,rock.position,a.root),`${family}/${form}: foreground BRO does not hide the outgoing rock`);
      sightPoint.copy(rock.position).project(currentCamera);
      assert(Math.abs(sightPoint.x)<1&&Math.abs(sightPoint.y)<1,'Outgoing rock remains in the viewport');visibleFlight++;
    }
    if(!practice.canAttack())assert(!practice.attack(),'Per-BRO cooldown protects the short gesture');
  }
  assert(visibleFlight>0,'Outgoing rock has visible flight samples');
  assert(hit,`${family}/${form}: shared arena hit reaction`);assert.equal(b.hitsReceived,1);assert(!actors.some(actions.busy),'Both return to ready');tick();assert(!disabled);
  if(form===4){drift=.005;for(let i=0;i<20;i++)tick();drift=0;for(let i=0;i<2;i++){positions[i].x+=.1;assert(actors[i].root.position.distanceTo(positions[i])<1e-6,'Practice stays attached to the drifting island');}}
  system.end('exit');assert(!practice.active&&!hud);assert.equal(currentCamera,normalCamera);
  for(let i=0;i<800&&system.active;i++)tick();assert(!system.active);
  actors.forEach((actor,i)=>{assert.equal(actor.mover,movers[i]);assert.equal(actor.motion.pause,pauses[i]);assert(actor.root.position.distanceTo(positions[i])<1e-6,'Exit does not teleport or reset the BRO');assert(!actor.encounter);assert.equal(actor.root.userData.deferLooseRockAttachments,undefined);});
  // Cancellation mid-attack must return borrowed limbs/projectiles before NPC removal.
  system.resetDeployment(a.root);for(let i=0;i<800&&!prompt;i++)tick();system.end('yes');assert(practice.active);assert(practice.attack());tick();if(form===4){b.root.parent.remove(b.root);tick();}else system.cancel();assert(!practice.active&&!hud);assert(!actors.some(actions.busy));
  for(const actor of actors){const field=actor.root.userData.looseRocks.orbitField;field?.parent?.remove(field);actor.root.parent?.remove(actor.root);}
}
// Extreme size mismatches and two large rigs, in both screen orientations.
for(const family of families)for(const forms of [[7,7],[7,1],[1,7]])for(const aspect of [.6,16/9]){
  const actors=[actor(family,forms[0],0),actor(family,forms[1],8)];
  actors[0].root.rotation.y=Math.PI/2;actors[1].root.rotation.y=-Math.PI/2;
  let camera=new THREE.PerspectiveCamera();
  const combat=makeActions(THREE,{restoreBody:api.restoreTelekineticBody});
  const practice=makePractice(THREE,{actions:combat,combatOptions:{opponentEnabled:false},restoreBody:api.restoreTelekineticBody,
    camera:value=>{if(value)camera=value;return camera;},aspect:()=>aspect,show(){},status(){},attachments(){}});
  practice.begin({sides:actors.map(actor=>({actor,session:{run:fn=>fn()}}))});camera.updateMatrixWorld(true);
  for(const actor of actors){
    new THREE.Box3().setFromObject(actor.root).getCenter(sightPoint);sightPoint.project(camera);
    assert(Math.abs(sightPoint.x)<1&&Math.abs(sightPoint.y)<1,`${family}/${forms}/${aspect}: both sizes remain framed`);
  }
  for(const point of [new THREE.Box3().setFromObject(actors[1].root).getCenter(new THREE.Vector3()),actors[1].root.userData.rig.head.getWorldPosition(new THREE.Vector3())]){
    assert(unobstructed(camera,point,actors[0].root),`${family}/${forms}: opponent head and body have clear sightlines`);
    point.project(camera);assert(Math.abs(point.x)<1&&Math.abs(point.y)<1,'Opponent head and body remain in frame');
  }
  practice.finish();combat.dispose();for(const actor of actors){const field=actor.root.userData.looseRocks.orbitField;field?.parent?.remove(field);actor.root.parent?.remove(actor.root);}
}
// Finish real projectile fights in both directions for every rig. Result camera
// presentation must never change combat poses, actor positions or saved cameras.
for(const family of families)for(let form=1;form<=7;form++)for(const winner of [0,1]){
  const actors=[actor(family,form,0),actor('specter',4,8)],player=actors[0];
  api.setBattleBroExpression(player.root,'littleSmile',{immediate:true});
  const combat=makeActions(THREE,{config:{maxHealth:2,normalDamage:2},restoreBody:api.restoreTelekineticBody,setExpression:api.setBattleBroExpression});
  const savedCamera=new THREE.PerspectiveCamera(55,1,.02,2000);savedCamera.position.set(0,3,-5);
  let currentCamera=savedCamera,t=0,prompt=false,expressionCalls=0,completions=0;
  const practice=makePractice(THREE,{actions:combat,combatOptions:{opponentEnabled:false},restoreBody:api.restoreTelekineticBody,
    complete:()=>completions++,
    expression:(actor,name)=>{expressionCalls++;api.setBattleBroExpression(actor.root,name,{automatic:true});},
    attachments:(actor,t,dt)=>context.advanceLooseRockAttachments(actor.root,t,dt,actor.mover),
    camera:value=>{if(value)currentCamera=value;return currentCamera;},aspect:()=>form%2?.6:16/9,floor:()=>0,show(){},status(){}});
  const system=encounter.create({player:()=>player,npcs:()=>[actors[1]],enabled:()=>true,available:actor=>!!actor.root.parent,
    controller:actor=>actor.character==='longneck'?api.ensureLongneckAnimation(actor.mover):actor.character==='specter'?api.ensureSpecterAnimation(actor.mover):api.ensureSupportAnimation(actor.mover),
    expressionName:actor=>actor.root.userData.slots.face.userData.expression?.name||'neutral',
    expression:(actor,name,immediate)=>api.setBattleBroExpression(actor.root,name,{automatic:true,immediate}),
    tickExpression:(actor,dt)=>api.tickBattleBroExpression(actor.root,dt),carry:()=>true,canTurn:()=>true,menu:value=>prompt=value,
    practice:{begin:s=>practice.begin(s),restore:()=>practice.restore(),tick:(t,dt)=>practice.tick(t,dt),finish:()=>practice.finish()}});
  const tick=()=>{t+=.05;system.tick(t,.05);};
  for(let i=0;i<30&&!prompt;i++)tick();assert(prompt);system.end('yes');
  const positions=actors.map(a=>a.root.position.clone());
  assert(combat.attack(actors,winner).ok);
  for(let i=0;i<100&&combat.combat().running;i++)tick();
  assert.equal(combat.combat().winner,winner);assert.equal(completions,0,'Automatic exit waits for the result display');
  const expected=winner===0?'bigSmile':'sad';
  assert.equal(player.root.userData.slots.face.userData.expression.name,expected);
  const face=player.root.userData.slots.face,focus=new THREE.Vector3(),front=new THREE.Vector3(),offset=new THREE.Vector3();
  const previous=currentCamera.position.clone();
  for(let i=0;i<70;i++){
    tick();if(i===58)assert.equal(completions,0,'Result stays for the full three seconds');
    if(i===59)assert.equal(completions,1,'Automatic close fires at three seconds');
    face.getWorldPosition(focus);offset.subVectors(currentCamera.position,focus);
    assert(offset.length()>1,'Pivot stays outside the BRO');
    assert(currentCamera.position.distanceTo(previous)<10,'Camera pivots continuously');previous.copy(currentCamera.position);
    assert(currentCamera.position.y>=.3,'Result camera respects terrain clearance');
  }
  face.getWorldDirection(front);front.y=0;front.normalize();
  face.getWorldPosition(focus);offset.subVectors(currentCamera.position,focus);offset.y=0;offset.normalize();
  assert(offset.dot(front)>.95,`${family}/${form}: result camera sees the front of the face`);
  currentCamera.updateMatrixWorld(true);focus.project(currentCamera);
  assert(Math.abs(focus.x)<.25&&Math.abs(focus.y)<.35,'Face stays framed in portrait and landscape');
  const expression=face.userData.expression;
  assert.equal(expression.name,expected);expression.pose.forEach((value,i)=>assert(Math.abs(value-api.BATTLEBRO_EXPRESSIONS[expected][i])<1e-9,'Existing expression finishes blending'));
  assert.equal(expressionCalls,1,'Outcome expression is applied once, without restarting its blend');
  assert.equal(completions,1,'Completion callback fires once');assert(!practice.attack());
  actors.forEach((a,i)=>assert(a.root.position.distanceTo(positions[i])<1e-6,'Result pivot does not move either BRO'));
  system.cancel();assert.equal(currentCamera,savedCamera);assert.equal(face.userData.expression.name,'littleSmile','Original expression is restored');
  combat.dispose();for(const a of actors){const field=a.root.userData.looseRocks.orbitField;field?.parent?.remove(field);a.root.parent?.remove(a.root);}
}
assert(html.includes('if(practiceBattle.active){'),'Practice owns pointer-lock changes while the combat UI is active');
assert(html.includes("document.getElementById('practice-shield').onclick=()=>{}"),'Shield is explicitly inert');
assert(html.includes('event.stopImmediatePropagation();'),'Practice captures exploration controls');
console.log('Practice battle: all 28 forms, shoulder and result cameras, happy/sad outcomes, portrait/landscape face framing, shared attacks/hits, automatic return timing, cancellation and restored cameras/expressions passed.');
