'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
assert.match(html, /#arena-hud\s*\{[^}]*pointer-events:\s*none/, 'Arena background leaves camera input available');
assert.match(html, /\.arena-contender\s*\{[^}]*pointer-events:\s*auto/, 'Fighter controls receive pointer events instead of passing clicks to canvas');
const makeArena=require('../assets/battle-arena.js'),makeActions=require('../assets/character-battle-actions.js');
const file=path.resolve('tools/rock-battlebro.test.js');let source=fs.readFileSync(file,'utf8').split('const api = context.api;')[0];
source=source.replace('const M = {','const M_ANIMAL = {hoof: new THREE.MeshLambertMaterial({color: 0x241813})}; const M = {');
source=source.replace('globalThis.api = {','globalThis.api = {createBattleBroCharacter,createSpecterBattleBro,createLongNeckBattleBro,tickBattleBroArenaActor,LAVA_WRIST_ABOVE_GROUND,');
const fixture=new Module(file,module);fixture.filename=file;fixture.paths=Module._nodeModulePaths(path.dirname(file));fixture._compile(source+'module.exports={api:context.api,THREE};',file);
const {api,THREE}=fixture.exports;
const actions=makeActions(THREE,{throwRock:api.telekineticRockThrow,cancelThrow:api.cancelTelekineticRockThrow,setExpression:api.setBattleBroExpression,restoreBody:api.restoreTelekineticBody});
const arena=makeArena(THREE,appearance=>{const root=api.createBattleBroCharacter({...appearance,character:appearance.character||'monsters'});root.userData.expressionCycleEnabled=false;api.setBattleBroExpression(root,'mildAngry',{immediate:true});return root;},api.tickBattleBroArenaActor,{actions,wristHeight:api.LAVA_WRIST_ABOVE_GROUND});
let time=0;
function frame(){time+=1/60;arena.tick(time,1/60);}
for(const [character,forms] of [['juggernaut',[1,2,3,4,5,6,7]],['monsters',[1,2,3,4,5,6,7]],['specter',[1,2,3,4,5,6,7]],['longneck',[1,2,3,4,5,6,7]]])for(const variant of ['lava','sand','plant','ice'])for(const form of forms){
  assert(arena.setFighter(0,{character,variant,form}));
  assert(arena.setFighter(1,{character,variant,form:forms[forms.length-1-forms.indexOf(form)]}));frame();
  const attacker=arena.actors[0],defender=arena.actors[1],root=attacker.root;
  const foot=form===1&&character==='juggernaut'?root.userData.rig.limbs[1]:null;
  const parent=foot?.parent,position=foot?.position.clone(),quaternion=foot?.quaternion.clone();
  const debris=[...root.userData.looseRocks.debris];const phases=debris.map(p=>p.orbitPhase);
  const result=arena.attack(0);assert(result.ok,`${character}/${variant}/${form} starts`);assert.equal(arena.attack(1).ok,false,'Serialize conflicting attacks');
  if(foot)assert.notEqual(foot.parent,parent,'Actual support limb released');
  let hit=false,displaced=false,drift=false,frames=0;
  for(;frames<1800&&arena.isBusy();frames++){
    frame();hit ||= !!defender.root.userData.battleHit;
    displaced ||= defender.root.position.distanceTo(defender.home)>.15;
    drift ||= defender.root.userData.looseRocks.chunks.some(c=>c.node.position.distanceTo(c.target)>.12);
    for(const actor of arena.actors)actor.root.traverse(n=>assert(Number.isFinite(n.position.x+n.position.y+n.position.z+n.quaternion.w),`Finite transforms: ${character}/${variant}/${form}, ${n.name}, frame ${frames}`));
  }
  assert(frames<1800,`${character}/${variant}/${form}: returns and recovers`);
  assert(hit&&displaced&&drift,`${character}/${variant}/${form}: visible impact, stumble and stone separation`);
  assert.equal(defender.hitsReceived,1,'Exactly one hit');
  frame();assert(defender.root.position.distanceTo(defender.home)<1e-8,'Stumble returns to home');
  assert.equal(defender.root.userData.slots.face.userData.expression.name,'mildAngry','Expression restored');
  if(foot){assert.equal(foot.parent,parent);assert(foot.position.distanceTo(position)<1e-8);assert(foot.quaternion.angleTo(quaternion)<1e-7);assert.equal(root.userData.looseRocks.debris.length,0);}
  else {assert.equal(root.userData.looseRocks.debris.length,debris.length);for(let i=0;i<debris.length;i++){assert.equal(root.userData.looseRocks.debris[i],debris[i]);assert.notEqual(debris[i].orbitPhase,phases[i]);assert.equal(debris[i].action||null,null);}}
  assert.equal(api.lavaMonsterMovers.size,0,'No arena fighters enter training registry');
}
// Borrowed first-form stones must return even when an arena preview is interrupted.
for(const character of ['specter','longneck'])for(const stopFrame of [8,55,105]){
  arena.setFighter(0,{character,variant:'lava',form:1});frame();
  const root=arena.actors[0].root,chunks=[...root.userData.looseRocks.chunks];
  assert(arena.attack(0).ok);
  for(let i=0;i<stopFrame;i++)frame();
  arena.resetCombat();frame();
  assert.equal(root.userData.looseRocks.chunks.length,chunks.length);
  chunks.forEach((chunk,i)=>assert.equal(root.userData.looseRocks.chunks[i],chunk,'Interrupted throw restores every original body stone'));
  assert(!arena.isBusy());
}
// Interrupt Form I while airborne, while recalling, and during a hit reaction.
for(const frames of [8,55,105]){
  arena.setFighter(0,{character:'juggernaut',variant:'plant',form:1});arena.setFighter(1,{variant:'ice',form:7});frame();
  const root=arena.actors[0].root,foot=root.userData.rig.limbs[1],parent=foot.parent,p=foot.position.clone();
  assert(arena.attack(0).ok);for(let i=0;i<frames;i++)frame();
  arena.resetCombat();assert.equal(foot.parent,parent);assert(foot.position.distanceTo(p)<1e-8);assert(!arena.isBusy());
}
assert(arena.attack(0).ok);for(let i=0;i<55;i++)frame();
const old=arena.actors[0].root;assert(arena.setFighter(0,{variant:'sand',form:6}));assert.equal(old.parent,null);assert(!arena.isBusy());
assert(!arena.setFighter(0,{variant:'bad',form:0}));
assert(arena.setFighter(0,{character:'monsters',variant:'lava',form:4}));
assert(arena.setFighter(0,{character:'juggernaut',variant:'lava',form:5}));
assert(arena.hit(0));for(let i=0;i<200;i++)frame();assert(!arena.isBusy());
console.log('Battle actions: all 112 attackers, all defender forms/materials, one-hit timing, stumble/drift/recovery, orbit/limb return, interruption and arena isolation passed.');
