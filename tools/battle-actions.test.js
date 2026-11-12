'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/#arena-hud\s*\{[^}]*pointer-events:\s*none/);assert.match(html,/\.arena-contender\s*\{[^}]*pointer-events:\s*auto/);
const {api,context,THREE}=require('./longneck-fixture')(),makeArena=require('../assets/battle-arena.js'),makeActions=require('../assets/character-battle-actions.js');
const actions=makeActions(THREE,{config:{maxHealth:10000},restoreBody:api.restoreTelekineticBody,setExpression:api.setBattleBroExpression});
const arena=makeArena(THREE,a=>{const root=api.createBattleBroCharacter({...a,character:a.character||'monsters'});root.userData.expressionCycleEnabled=false;api.setBattleBroExpression(root,'mildAngry',{immediate:true});return root;},context.tickBattleBroArenaActor,{actions,wristHeight:context.LAVA_WRIST_ABOVE_GROUND});
let time=0;const frame=()=>{time+=1/60;arena.tick(time,1/60);};
for(const character of ['juggernaut','monsters','specter','longneck'])for(const variant of ['lava','sand','plant','ice'])for(let form=1;form<=7;form++){
  assert(arena.setFighter(0,{character,variant,form}));assert(arena.setFighter(1,{character,variant,form:8-form}));frame();
  const [a,b]=arena.actors,rocks=[...a.root.userData.looseRocks.chunks],parents=rocks.map(c=>c.node.parent);
  assert(arena.attack(0).ok);assert(arena.attack(1).ok,'Both sides can attack in the same frame');assert(!arena.attack(0).ok,'Duplicate input obeys per-actor cooldown');
  let shots=1,frames=0,hit=false,displaced=false;
  for(;frames<240;frames++){
    if(shots<3&&arena.canAttack(0)){assert(arena.attack(0).ok);shots++;}
    frame();hit ||= !!b.root.userData.battleHit;displaced ||= b.root.position.distanceTo(b.home)>.02;
    for(const actor of arena.actors){actor.root.traverse(n=>assert(Number.isFinite(n.position.x+n.position.y+n.position.z+n.quaternion.w),`${character}/${variant}/${form}: finite animated pose`));const neck=actor.root.userData.rig.neckPivot;if(neck)assert(Math.abs(neck.rotation.x)<.8,'No accumulating Longneck pitch');}
    if(shots===3&&!arena.isBusy())break;
  }
  assert(frames<240,`${character}/${variant}/${form}: short attacks and recovery finish`);assert(hit&&displaced);assert.equal(b.hitsReceived,3);assert.equal(a.hitsReceived,1);
  assert.equal(arena.combat().fighters[1].health,10000-3*actions.config.normalDamage);assert.equal(arena.combat().fighters[0].health,10000-actions.config.normalDamage);
  frame();assert(b.root.position.distanceTo(b.home)<1e-8,'Stumble restores world position');
  rocks.forEach((c,i)=>assert.equal(c.node.parent,parents[i],'Fast throws never detach real support/body parts'));
  assert.equal(actions.stats().active,0);assert(actions.stats().allocated<=actions.config.maxProjectiles);assert.equal(api.lavaMonsterMovers.size,0,'Arena fighters stay outside world movement registry');
}
for(const character of ['juggernaut','monsters','specter','longneck'])for(const frames of [1,6,16]){
  arena.setFighter(0,{character,variant:'plant',form:1});arena.setFighter(1,{character,variant:'ice',form:7});frame();assert(arena.attack(0).ok);
  for(let i=0;i<frames;i++)frame();arena.resetCombat();assert(!arena.isBusy());assert.equal(actions.stats().active,0);assert.equal(arena.combat().fighters[0].health,10000);
}
arena.startCombat();for(let i=0;i<180;i++)frame();assert(arena.combat().shots>0,'Visible Arena battle starts opponent attacks');
arena.stopCombat();const shots=arena.combat().shots;for(let i=0;i<180;i++)frame();assert.equal(arena.combat().shots,shots,'Leaving Arena stops AI and projectiles');assert.equal(actions.stats().active,0);
assert(!arena.setFighter(0,{variant:'bad',form:0}));
console.log('Battle actions: all 112 family/form/material attackers, rapid concurrent shots, hit damage/recovery, pose stability, intact supports, pooled cleanup and Arena lifecycle passed.');
