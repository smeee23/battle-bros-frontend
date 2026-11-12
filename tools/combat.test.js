'use strict';
const assert=require('node:assert/strict');
const {api,context,THREE}=require('./longneck-fixture')();
const makeCombat=require('../assets/character-battle-actions.js');
function fixture(config={},opponentEnabled=false){
  const actors=[0,1].map(i=>{const root=api.createBattleBroCharacter({character:'specter',form:4,variant:'ice'});api.worldGroup.add(root);root.position.set(i?10:-10,2,0);return {root,mover:{root,parts:root.userData.rig,state:'IDLE_HOVER',progress:0}};});
  const combat=makeCombat(THREE,{config:{normalDamage:8,berserkerDamage:32,energyPerHit:20,...config},setExpression:api.setBattleBroExpression,restoreBody:api.restoreTelekineticBody});combat.start(actors,{opponentEnabled});let time=0;
  const frame=(dt=.02)=>{time+=dt;for(const a of actors){combat.restore(a);api.restoreTelekineticBody(a.root);context.tickBattleBroArenaActor(a,time,dt);}for(const a of actors)combat.tick(a,time,dt);};
  const until=(fn,label,limit=500)=>{for(let i=0;i<limit&&!fn();i++)frame();assert(fn(),label);};
  const cleanup=()=>{combat.dispose();for(const a of actors)a.root.parent?.remove(a.root);};
  return {actors,combat,frame,until,cleanup,get time(){return time;}};
}
{
  const f=fixture({maxHealth:10000}),c=f.combat,b=c.combat(),ids=new Set();
  const first=c.attack(f.actors,0);assert(first.ok);ids.add(first.projectileId);assert.equal(b.fighters[1].health,10000,'Button press does not damage');assert.equal(b.fighters[0].energy,0);
  assert(!c.attack(f.actors,0).ok,'Cooldown rejects duplicate presses');
  f.until(()=>b.spawned===1,'Quick launch');assert(f.time<=c.config.windup+.021,'No orbital wind-up');
  f.until(()=>c.canAttack(0),'Short cooldown');assert(f.time<.36);assert(c.busy(f.actors[0]),'Cooldown ends with a projectile still in flight');
  const second=c.attack(f.actors,0);assert(second.ok);ids.add(second.projectileId);assert(b.activeProjectiles>=2,'Successive projectiles overlap');
  for(let i=0;i<250;i++){if(c.canAttack(0)){const result=c.attack(f.actors,0);assert(result.ok);assert(!ids.has(result.projectileId));ids.add(result.projectileId);}f.frame();}
  const shots=b.shots;f.until(()=>b.activeProjectiles===0&&!f.actors.some(c.busy),'All shots and reactions drain');
  assert.equal(b.spawned,shots,'Exactly one projectile per accepted attack');assert.equal(b.hits,shots,'Exactly one hit per projectile');assert.equal(b.fighters[1].health,10000-shots*c.config.normalDamage);
  const health=b.fighters[1].health;for(let i=0;i<100;i++)f.frame();assert.equal(b.fighters[1].health,health,'No duplicate or late damage');assert(c.stats().allocated<=c.config.maxProjectiles);f.cleanup();
}
{
  const f=fixture({maxHealth:1000}),c=f.combat,b=c.combat();assert(!c.attack(f.actors,0,{berserker:true}).ok,'Charge required');
  for(let n=1;n<=5;n++){f.until(()=>c.canAttack(0),'Normal ready');assert(c.attack(f.actors,0).ok);f.until(()=>b.hits===n,'Normal hit');}
  assert.equal(b.fighters[0].energy,100);f.until(()=>c.canAttack(0,true),'Berserker ready');
  const before=b.fighters[1].health;assert(c.attack(f.actors,0,{berserker:true}).ok);assert.equal(b.fighters[0].energy,0,'Charge consumed on accepted execution');assert(!c.attack(f.actors,0,{berserker:true}).ok);
  f.until(()=>b.spawned===6,'Special launch');const projectile=api.worldGroup.children.find(n=>n.name==='combatRock'&&n.visible);assert(projectile.children.some(n=>n.name==='berserkerGlow'&&n.visible),'Special has an orange aura');
  f.until(()=>b.hits===6,'Special impact');assert.equal(b.fighters[1].health,before-c.config.berserkerDamage);assert.equal(b.fighters[0].energy,0,'Special does not recharge itself');
  f.until(()=>c.canAttack(0),'Normal resumes after special');assert(c.attack(f.actors,0).ok);f.until(()=>b.hits===7,'Normal recharges after special');assert.equal(b.fighters[0].energy,20);f.cleanup();
}
{
  const f=fixture(),c=f.combat,b=c.combat();assert(c.attack(f.actors,0).ok);f.until(()=>b.spawned===1,'Launch before target discontinuity');f.actors[1].root.position.x+=12;f.frame();assert.equal(b.hits,0);assert.equal(b.fighters[0].energy,0);assert.equal(b.fighters[1].health,100);assert.equal(b.activeProjectiles,0,'A teleport misses and cleans up');f.cleanup();
}
{
  const f=fixture({hitDuration:.8,maxHealth:10000}),c=f.combat,b=c.combat();for(let i=0;i<100;i++)f.frame();assert.equal(b.shots,0,'Opponent disabled outside an active AI battle');
  c.start(f.actors,{opponentEnabled:true});f.until(()=>b.shots===1,'Opponent starts on cadence');assert.equal(b.fighters[1].gesture.active,true);assert(c.attack(f.actors,0).ok,'Both fighters can attack simultaneously');
  c.hit(f.actors[0],f.actors[1].root.position);f.until(()=>c.canAttack(0),'Receiving a hit does not lock attacks');assert(f.actors[0].root.userData.battleHit);assert(c.attack(f.actors,0).ok);
  f.until(()=>b.fighters[0].health<10000&&b.fighters[1].health<10000,'Both sides take actual projectile damage');
  assert(b.fighters[1].energy>0,'Opponent uses the same hit/energy mechanics');c.stop();const shots=b.shots,health=b.fighters[0].health;for(let i=0;i<200;i++)f.frame();assert.equal(b.shots,shots);assert.equal(b.fighters[0].health,health);assert.equal(b.activeProjectiles,0);f.cleanup();
}
for(const playerWins of [true,false]){
  const f=fixture({maxHealth:8},!playerWins),c=f.combat,b=c.combat();if(playerWins)assert(c.attack(f.actors,0).ok);f.until(()=>!b.running,'Lethal hit ends combat');
  assert.equal(b.winner,playerWins?0:1);assert.equal(c.state(f.actors[0]),playerWins?'Victory':'Defeat');assert.equal(b.activeProjectiles,0);assert(!c.attack(f.actors,0).ok);
  const hits=b.hits;for(let i=0;i<200;i++)f.frame();assert.equal(b.hits,hits,'No attacks/damage after completion');c.start(f.actors,{opponentEnabled:false});assert.equal(b.fighters[0].health,8);assert.equal(b.fighters[0].energy,0);f.cleanup();
}
{
  const f=fixture({maxHealth:10000,maxProjectiles:2,maxFlight:1,projectileLifetime:2}),c=f.combat,b=c.combat();f.actors[1].root.position.x=22;
  assert(c.attack(f.actors,0).ok);f.until(()=>c.canAttack(0),'Second pooled shot');assert(c.attack(f.actors,0).ok);assert.equal(b.activeProjectiles,2);assert(!c.attack(f.actors,1).ok,'Bounded pool rejects overflow');assert.equal(c.stats().allocated,2);
  c.stop();assert.equal(c.stats().active,0);assert(!api.worldGroup.children.some(n=>n.name==='combatRock'),'Projectiles detached on cleanup');assert(!f.actors.some(a=>a.root.userData.battleThrow||a.root.userData.battleHit));f.cleanup();
}
console.log('Shared combat: rapid/overlapping shots, launch timing, swept hits, exactly-once damage, Berserker, opponent cadence, concurrent reactions, victory/defeat, restart and bounded cleanup passed.');
