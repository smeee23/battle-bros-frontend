'use strict';
// Equal-input comparison against the unmodified Arena tick pipeline. Native idle
// poses differ by mode, so supply an explicit common baseline at the combat boundary.
const assert=require('node:assert/strict');
const {api,context,THREE}=require('./longneck-fixture')();
const makeArena=require('../assets/battle-arena.js'),makeActions=require('../assets/character-battle-actions.js');
const makePractice=require('../assets/practice-battle.js'),encounter=require('../assets/battlebro-encounter.js');
const families=['juggernaut','monsters','specter','longneck'],counts=new Map();
const applyBody=context.applyTelekineticBody;
context.applyTelekineticBody=(root,mover)=>{counts.set(root,(counts.get(root)||0)+1);applyBody(root,mover);};
const actions=()=>makeActions(THREE,{config:{normalDamage:8,berserkerDamage:32,energyPerHit:20},throwRock:api.telekineticRockThrow,cancelThrow:api.cancelTelekineticRockThrow,restoreBody:api.restoreTelekineticBody,setExpression:api.setBattleBroExpression});
const practiceActions=actions(),arenaActions=actions();let pair=null;
function createCharacter(appearance){
  // Reproducible rig, stone and orbit inputs for the two independently created actors.
  const random=context.Math.random;let seed=1234+(families.indexOf(appearance.character)+1)*100+appearance.form;
  context.Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  try{const root=api.createBattleBroCharacter(appearance);root.userData.expressionCycleEnabled=false;return root;}
  finally{context.Math.random=random;}
}
function nodes(root){const out=[];root.traverse(node=>out.push(node));return out;}
function attached(node,root){for(let n=node;n;n=n.parent)if(n===root)return true;return false;}
function pose(node){return {p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()};}
function apply(node,base){node.position.copy(base.p);node.quaternion.copy(base.q);node.scale.copy(base.s);}
function rotationError(a,b){
  // Some authored stone transforms have slightly non-unit quaternions; angleTo
  // can report an angle even for identical values. Compare components up to sign.
  const sign=a.dot(b)<0?-1:1;
  return Math.hypot(a.x-sign*b.x,a.y-sign*b.y,a.z-sign*b.z,a.w-sign*b.w);
}
function referenceBaseline(entry){
  api.restoreTelekineticBody(entry.reference.root);
  for(const link of entry.links)if(link.active)apply(link.reference,link.baseline);
  entry.reference.root.updateMatrixWorld(true);
}
const arena=makeArena(THREE,createCharacter,(actor,t,dt)=>{
  if(!pair)return;
  const entry=pair[arena.actors.indexOf(actor)];
  referenceBaseline(entry);
  // Arena's original attachments/body update and attack/hit tick remain in order.
  api.tickLooseRockAttachments(actor.root,t,dt,actor.mover);
},{actions:arenaActions,wristHeight:context.LAVA_WRIST_ABOVE_GROUND});

let comparedFrames=0;
for(const family of families)for(let form=1;form<=7;form++){
  pair=null;
  const appearances=[{character:family,form,variant:'ice'},{character:family,form:8-form,variant:'ice'}];
  appearances.forEach((appearance,i)=>assert(arena.setFighter(i,appearance)));
  pair=appearances.map((appearance,i)=>{
    const reference=arena.actors[i],root=createCharacter(appearance);api.worldGroup.add(root);
    // Same close encounter positions in both modes, within the encounter radius.
    const shift=(i?3:-3)-reference.root.position.x;reference.root.position.x+=shift;
    for(const key of ['leftAnchor','rightAnchor'])if(reference.mover[key])reference.mover[key].x+=shift;
    root.position.copy(reference.root.position);root.quaternion.copy(reference.root.quaternion);
    const mover={root,parts:root.userData.locomotionRig||root.userData.rig,state:'IDLE',progress:0,ikTarget:new THREE.Vector3()};
    for(const key of ['leftAnchor','rightAnchor'])if(reference.mover[key])mover[key]=reference.mover[key].clone();
    const actor={root,mover,character:family};
    // Idle gaze is an independent randomized input; hold it equal while comparing
    // combat poses. Native randomized idle behavior is covered by the world test.
    for(const candidate of [root,reference.root])if(candidate.userData.juggernautLook)Object.assign(candidate.userData.juggernautLook,{wait:Infinity,elapsed:0,yaw:0,pitch:0});
    api.tickLooseRockAttachments(root,0,0,mover);api.tickLooseRockAttachments(reference.root,0,0,reference.mover);
    const actualNodes=nodes(root),referenceNodes=nodes(reference.root);assert.equal(actualNodes.length,referenceNodes.length);
    const links=actualNodes.map((actual,j)=>{
      if(j)assert.equal(actual.name,referenceNodes[j].name,'Equivalent rig topology');
      return {actual,reference:referenceNodes[j],rest:pose(actual),baseline:pose(actual),active:true};
    });
    return {actor,reference,links};
  });
  const actors=pair.map(e=>e.actor);let camera=new THREE.PerspectiveCamera(55,1,.02,2000),prompt=false,t=0;
  const practice=makePractice(THREE,{actions:practiceActions,combatOptions:{opponentEnabled:false},restoreBody:api.restoreTelekineticBody,
    camera:value=>{if(value)camera=value;return camera;},aspect:()=>1,show(){},status(){},
    attachments:(actor,t,dt)=>{
      const entry=pair[actors.indexOf(actor)];
      for(const link of entry.links){link.active=attached(link.actual,actor.root);if(link.active){link.baseline.p.copy(link.actual.position);link.baseline.q.copy(link.actual.quaternion);link.baseline.s.copy(link.actual.scale);}}
      context.advanceLooseRockAttachments(actor.root,t,dt,actor.mover);
    }});
  const system=encounter.create({player:()=>actors[0],npcs:()=>[actors[1]],enabled:()=>true,available:actor=>!!actor.root.parent,
    carry:()=>true,canTurn:()=>true,expressionName:()=> 'neutral',expression(){},tickExpression(){},menu:value=>prompt=value,
    controller:actor=>{
      const entry=pair[actors.indexOf(actor)];
      return {mover:actor.mover,reset(){},carry(){},syncEncounterHistory(){},
        encounterFrame(yaw,dt,t){
          // Equivalent, fixed native inputs make any accumulated combat offset
          // observable independently of idle gaze, terrain or encounter stance.
          for(const link of entry.links)if(attached(link.actual,actor.root))apply(link.actual,link.rest);
          api.tickLooseRockAttachments(actor.root,t,practice.active?dt:0,actor.mover);
          return {accepted:true,done:true};
        },
        encounterPose(){const p=encounter.createPose(actor.mover,family),capture=p.capture;
          p.capture=()=>{if(practice.active){
            assert.equal(counts.get(actor.root)||0,0,'Capture before any combat body application');
            assert.equal(actor.root.userData.rockThrowBodyBases?.length||0,0,'Captured baseline excludes throw rotations');
            for(const link of entry.links)if(attached(link.actual,actor.root)){
              assert(rotationError(link.actual.quaternion,link.rest.q)<1e-6,`${family}/${form} ${link.actual.name}: clean baseline rotation cannot accumulate across frames`);
              assert(link.actual.position.distanceTo(link.rest.p)<1e-8,'Clean baseline position excludes hit/support offsets');
            }
          }capture();};return p;
        }};
    },
    practice:{begin:s=>practice.begin(s),restore:()=>practice.restore(),tick:(t,dt)=>practice.tick(t,dt),finish:()=>practice.finish()}});
  const step=()=>{
    counts.clear();t+=.05;system.tick(t,.05);
    if(!practice.active)return;
    // Give both Arena targets the same current-frame baseline before its first
    // fighter samples the opponent. Do not copy attack/projectile state.
    for(const entry of pair){arenaActions.restore(entry.reference);referenceBaseline(entry);}
    arena.tick(t,.05);comparedFrames++;
    for(const entry of pair){
      assert.equal(counts.get(entry.actor.root),1,'Practice applies combat body animation once');
      assert.equal(counts.get(entry.reference.root),1,'Arena reference applies combat body animation once');
      assert.equal(practiceActions.state(entry.actor),arenaActions.state(entry.reference),'Equivalent attack/hit phase');
      assert.equal(entry.actor.hitsReceived||0,entry.reference.hitsReceived||0,'Equivalent impact count');
      const i=actors.indexOf(entry.actor);
      assert.equal(practiceActions.combat().fighters[i].health,arena.combat().fighters[i].health,'Equivalent damage');
      assert.equal(practiceActions.combat().fighters[i].energy,arena.combat().fighters[i].energy,'Equivalent Berserker charge');
      for(const link of entry.links)if(attached(link.actual,entry.actor.root)){
        const label=`${family}/${form} ${link.actual.name} frame ${comparedFrames}`;
        assert(link.actual.position.distanceTo(link.reference.position)<1e-6,label+' position parity');
        assert(rotationError(link.actual.quaternion,link.reference.quaternion)<1e-6,label+' rotation parity');
        assert(link.actual.scale.distanceTo(link.reference.scale)<1e-6,label+' scale parity');
      }
    }
  };
  for(let i=0;i<100&&!prompt;i++)step();assert(prompt);system.end('yes');
  for(let i=0;i<3;i++)step();
  // Five normal hits charge a Berserker; verify both combat profiles for every rig.
  for(let cycle=0;cycle<6;cycle++){
    const special=cycle===5;
    assert(practice.attack(special));assert(arena.attack(0,special).ok);let hit=false,recover=false;
    for(let i=0;i<1200&&actors.some(practiceActions.busy);i++){step();hit ||= !!actors[1].root.userData.battleHit;recover ||= practiceActions.state(actors[1])==='Recovering';}
    assert(!actors.some(practiceActions.busy));assert(!arena.isBusy());assert(hit&&recover,'Existing hit and recovery phases retained');
    assert.equal(actors[1].hitsReceived,cycle+1);for(let i=0;i<10;i++)step();
  }
  assert(practiceActions.hit(actors[0],actors[1].root.position));assert(arena.hit(0));
  for(let i=0;i<200&&actors.some(practiceActions.busy);i++)step();assert(!arena.isBusy());
  system.cancel();assert(!actors.some(practiceActions.busy));
  for(const {actor} of pair){assert.equal(actor.root.userData.deferLooseRockAttachments,undefined);actor.root.parent?.remove(actor.root);}
}
console.log(`Practice/Arena pose parity: ${comparedFrames} frames across all 28 family/forms; clean baselines, single combat application, repeated attacks, impacts, test-hit and recovery passed.`);
