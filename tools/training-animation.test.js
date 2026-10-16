'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const fixture=fs.readFileSync('tools/rock-battlebro.test.js','utf8').split('const api = context.api;')[0]
 .replace('const M = {','const M_ANIMAL={hoof:new THREE.MeshLambertMaterial({color:0x241813})};const M = {');
const {api,context}=new Function('require','__dirname',fixture+'return {api:context.api,context};')(require,__dirname);
context.disposeGroup=()=>{};
vm.runInContext(html.slice(html.indexOf('  function updateTrainingAppearanceVisuals('),html.indexOf('  function changeTrainingAppearance(')),context);
for(const character of ['juggernaut','monsters','longneck','specter'])for(const form of [2,4,6,7]) {
 const root=api.createBattleBroCharacter({character,form,variant:'lava'});
 api.worldGroup.add(root);
 const rig=root.userData.rig,loose=root.userData.looseRocks;
 // Give an active joint a non-rest pose to catch accidental animation resets.
 rig.head.rotation.y=.27;
 const parent=root.parent;
 for(const variant of ['ice','mushroom','gem','tiger','rainbow','lava']) {
  api.tickLooseRockAttachments(root,2,.016);
  api.tickBattleBroOrbitField(root,.016);
  const fresh=api.createBattleBroCharacter({character,form,variant,colors:{eye:'blue'}});
  context.updateTrainingAppearanceVisuals(root,fresh);
  assert.equal(root.userData.rig,rig);assert.equal(root.userData.looseRocks,loose);
  assert.equal(root.parent,parent);assert.equal(rig.head.rotation.y,.27);
  assert.equal(root.userData.visualVariant,variant);
  for(const entry of loose.chunks)assert(root.getObjectById(entry.node.id),'Animated stones remain attached');
  const seen=new Set();root.traverse(node=>seen.add(node));
  for(const node of [rig.rig,rig.head,rig.torso].filter(Boolean))assert(seen.has(node),'The original rig remains live');
  api.tickLooseRockAttachments(root,3,.016);api.tickBattleBroOrbitField(root,.016);
 }
 api.worldGroup.remove(root);
}
const root=api.createBattleBroCharacter({character:'juggernaut',form:4,variant:'lava'});
api.worldGroup.add(root);const mover=api.registerLavaMonsterMover(root,32,32);
mover.progress=.37;mover.pauseRemaining=1;
const parts=mover.parts,head=parts.head;
const fresh=api.createBattleBroCharacter({character:'juggernaut',form:4,variant:'ice'});
context.updateTrainingAppearanceVisuals(root,fresh);
assert(api.lavaMonsterMovers.has(mover));assert.equal(mover.parts,parts);assert.equal(parts.head,head);assert.equal(mover.progress,.37);
api.tickLavaMonsterMovers(4,1/60);assert(mover.pauseRemaining<1,'World animation advances after skin change');
console.log('Training skins: live rig, joint poses, loose rocks, orbit stones and mover progress persist across skins and all character families');
