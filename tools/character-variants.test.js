'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.join(__dirname,'rock-battlebro.test.js');
let fixture=fs.readFileSync(file,'utf8').split('const api = context.api;')[0];
fixture=fixture.replace('const M = {', 'const M_ANIMAL={hoof:new THREE.MeshLambertMaterial({color:0x241813})}; const M = {');
fixture=fixture.replace('const worldGroup = new THREE.Group();','const worldGroup = new THREE.Group(); let baseBattleBroPrototype=null; function disposeGroup() {}');
fixture=fixture.replace('globalThis.api = {','globalThis.api = {minotaurMovers, tickMinotaurMovers, specterMovers, tickSpecterMovers, selectBattleBroCharacterPreview, getPreview:()=>baseBattleBroPrototype,');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(fixture+'module.exports={api:context.api,THREE};',file);
const {api,THREE}=m.exports;
for(const form of [1,2,3,4,5,6,7]) {
  const reference=api.createRockBattleBro({variant:'lava',form});
  for(const variant of ['sand','plant','ice']) {
    api.lavaMonsterMovers.clear();
    const root=api.createRockBattleBro({variant,form});
    assert.equal(root.userData.visualVariant,variant);assert.equal(root.userData.form,form);
    assert.equal(root.userData.looseRocks.chunks.length,reference.userData.looseRocks.chunks.length);
    assert.equal(root.userData.looseRocks.debris.length,reference.userData.looseRocks.debris.length);
    for(const source of reference.userData.looseRocks.chunks) {
      const target=root.userData.looseRocks.chunks.find(c=>c.node.name===source.node.name);assert(target);
      assert.equal(target.node.geometry,source.node.geometry,'Shared edited body geometry');
      assert.deepEqual(target.anchor.position.toArray(),source.anchor.position.toArray(),'Shared rock placement');
      assert.deepEqual(target.anchor.quaternion.toArray(),source.anchor.quaternion.toArray(),'Shared rock rotation');
    }
    let details=0;root.traverse(n=>{if(n.userData.variantDecoration)details++;});assert(details>0 && details<=25);
    root.position.set(.5,0,.5);api.worldGroup.add(root);const mover=api.registerLavaMonsterMover(root,32,32);
    assert(mover.terrainContacts,'All materials use terrain contact solving');
    for(const expression of Object.keys(api.BATTLEBRO_EXPRESSIONS))assert(api.setBattleBroExpression(root,expression));
    api.setBattleBroExpression(root,'neutral');mover.pauseRemaining=0;
    const start=root.position.clone();
    for(let frame=0;frame<720;frame++)api.tickLavaMonsterMovers(frame/60,1/60);
    assert(root.position.distanceTo(start)>.05,`${variant} ${form} walks`);
    root.traverse(n=>assert(Number.isFinite(n.position.x+n.position.y+n.position.z+n.quaternion.w)));
    if(form>=5)assert(root.userData.upperArmMotion.arms.length>=1,'Upper-arm animation enabled');
    if(form>=2) {
      mover.state='IDLE';mover.turn=null;mover.pauseRemaining=1000;
      const point=root.position.clone().add(new THREE.Vector3(4,3,5));
      const action=api.telekineticRockThrow(root,{isActive:()=>true,getPosition:p=>p.copy(point),getVelocity:p=>p.set(0,0,0)});
      assert(action,`${variant} ${form} throw starts`);api.cancelTelekineticRockThrow(root);
      for(let frame=0;frame<180;frame++)api.tickLavaMonsterMovers(20+frame/60,1/60);
      assert.equal(root.userData.rockThrow,null,'Throw cancellation settles');
    }
    api.worldGroup.remove(root);root.userData.looseRocks.orbitField?.parent?.remove(root.userData.looseRocks.orbitField);
  }
}
api.lavaMonsterMovers.clear();
api.ensureRockVariantExamples();assert.equal(api.rockVariantExamples.size,0,'Gallery does not auto-populate');
let previous=null;
for(const variant of ['lava','sand','plant','ice'])for(let form=1;form<=7;form++) {
  const result=api.selectBattleBroCharacterPreview(variant,form);assert(result.ok);
  assert.equal(api.lavaMonsterMovers.size,1,'One preview actor');assert.equal(api.getPreview(),result.root);
  if(previous){assert.equal(previous.parent,null);assert.equal(previous.userData.looseRocks.orbitField?.parent||null,null);}
  api.tickLavaMonsterMovers(0,1/60);previous=result.root;
}
assert.equal(api.selectBattleBroCharacterPreview('unknown',4).ok,false);
assert.equal(api.getPreview(),previous,'Invalid selection leaves current character intact');
console.log('Character variants: all 28 shared forms, material details, expressions, walking, arm motion, throw cancellation and single-preview cleanup passed.');

for (const variant of ['lava','plant','sand','ice']) for (let form=1;form<=7;form++) {
  const result=api.selectBattleBroCharacterPreview(variant,form,'specter');
  assert(result.ok);
  assert.equal(result.root.userData.visualVariant,variant);
  assert.equal(result.root.userData.form,form);
  assert.equal(api.specterMovers.size,1);
  assert.equal(api.lavaMonsterMovers.size,0);
  assert.equal(previous.parent,null);
  assert.equal(previous.userData.looseRocks.orbitField?.parent || null,null);
  api.tickSpecterMovers(1,1/60);
  previous=result.root;
  const monster=api.selectBattleBroCharacterPreview(variant,form,'monsters');
  assert(monster.ok);
  assert.equal(api.specterMovers.size,0);
  assert.equal(api.lavaMonsterMovers.size,1);
  assert.equal(previous.parent,null);
  assert.equal(previous.userData.looseRocks.orbitField?.parent || null,null);
  previous=monster.root;
}
assert.equal(api.selectBattleBroCharacterPreview('lava',5,'unknown').ok,false);
assert.equal(api.getPreview(),previous,'Invalid family preserves preview');
console.log('Preview families: all 56 appearances, cross-family switching, single actor and orbit cleanup passed.');

const longneck=api.selectBattleBroCharacterPreview('lava',4,'longneck');
assert(longneck.ok);
assert.equal(api.minotaurMovers.size,1);
assert.equal(api.lavaMonsterMovers.size,0);
const neck = longneck.root;
assert.equal(neck.userData.kind,'battlebro-longneck-prototype');
assert.equal(Object.keys(neck.userData.rig.minotaurLegs).length,4);
assert.equal(neck.userData.looseRocks.chunks.filter(c=>/^longneckNeckBoulder/.test(c.node.name)).length,4);
assert(!neck.getObjectByName('minotaurChest'));
assert(!neck.getObjectByName('minotaurLeftShoulderPivot'));
assert(neck.getObjectByName('lavaLeftEye'));
const jaw=neck.userData.rig.jaw;
assert(jaw.position.z < 0,'Jaw hinges at the back');
const rest=jaw.rotation.x;
assert.equal(neck.userData.form,4);
assert.equal(neck.userData.looseRocks.debris.length,3);
api.tickMinotaurMovers(0,1/60);
const orbitStart=neck.userData.looseRocks.debris[0].node.position.clone();
for(let frame=0;frame<1800;frame++)api.tickMinotaurMovers(frame/60,1/60);
neck.traverse(n=>assert(Number.isFinite(n.position.x+n.position.y+n.position.z+n.quaternion.w)));
assert.equal(jaw.rotation.x,rest,'Jaw remains posed, without animation');
assert(neck.userData.looseRocks.debris[0].node.position.distanceTo(orbitStart)>.1,'Longneck satellites orbit');
const longneckOrbit=neck.userData.looseRocks.orbitField;
assert.equal(api.selectBattleBroCharacterPreview('unknown',5,'longneck').ok,false);
assert.equal(api.selectBattleBroCharacterPreview('lava',8,'longneck').ok,false);
assert(api.selectBattleBroCharacterPreview('plant',5,'specter').ok);
assert.equal(api.minotaurMovers.size,0);
assert.equal(neck.parent,null);
assert.equal(longneckOrbit.parent,null,'Longneck orbit cleans up on preview switch');
console.log('Longneck: four-legged body, four loose neck boulders, shared eyes, rear jaw hinge, stable walking and selector cleanup passed.');

let lastLongneck=null,lastSize=0,lastDrift=Infinity;
for(let form=1;form<=7;form++) {
  const result=api.selectBattleBroCharacterPreview('lava',form,'longneck');
  assert(result.ok,'Longneck Form '+form+' is selectable');
  const root=result.root, parts=root.userData.rig, loose=root.userData.looseRocks;
  assert.equal(api.minotaurMovers.size,1);
  assert.equal(api.lavaMonsterMovers.size,0);
  assert.equal(api.specterMovers.size,0);
  if(lastLongneck) {
    assert.equal(lastLongneck.parent,null);
    assert.equal(lastLongneck.userData.looseRocks.orbitField?.parent||null,null);
  }
  assert.equal(root.userData.form,form);
  assert(root.userData.approximateHeight>lastSize,'Progressive growth');lastSize=root.userData.approximateHeight;
  assert(loose.chunks[0].amplitude<lastDrift,'Progressively closer attachments');lastDrift=loose.chunks[0].amplitude;
  assert.equal(loose.debris.length,[0,1,2,3,5,6,8][form-1]);
  assert.equal(loose.chunks.filter(c=>/^longneckNeckBoulder/.test(c.node.name)).length,[1,2,3,4,4,5,5][form-1]);
  if(form===1) {
    assert(parts.animalBody.scale.y < 1.5,'Short leg nubs');
    assert(parts.head.position.y < .5,'Short neck nub');
  }
  const jawAngle=parts.jaw.rotation.x;
  for(let frame=0;frame<900;frame++)api.tickMinotaurMovers(frame/60,1/60);
  root.traverse(n=>assert(Number.isFinite(n.position.x+n.position.y+n.position.z+n.quaternion.w)));
  for(const orbit of loose.debris) assert(Number.isFinite(orbit.node.position.length()));
  assert.equal(parts.jaw.rotation.x,jawAngle,'Static jaw pose preserved');
  lastLongneck=root;
}
console.log('Longneck evolution: seven selectable forms, leg/neck nubs, growth, loose attachments, orbit progression, stable motion and one-character cleanup passed.');

for(let form=1;form<=7;form++) {
  const reference=api.selectBattleBroCharacterPreview('lava',form,'longneck').root;
  for(const variant of ['plant','sand','ice']) {
    const previous=api.getPreview();
    const result=api.selectBattleBroCharacterPreview(variant,form,'longneck');
    assert(result.ok);
    const root=result.root, loose=root.userData.looseRocks;
    assert.equal(root.userData.visualVariant,variant);
    assert.equal(root.userData.form,form);
    assert.equal(api.minotaurMovers.size,1);
    assert.equal(api.lavaMonsterMovers.size+api.specterMovers.size,0);
    assert.equal(previous.parent,null);
    assert.equal(previous.userData.looseRocks.orbitField?.parent||null,null);
    assert.equal(loose.chunks.length,reference.userData.looseRocks.chunks.length);
    assert.equal(loose.debris.length,reference.userData.looseRocks.debris.length);
    for(const chunk of loose.chunks) {
      const original=reference.userData.looseRocks.chunks.find(c=>c.node.name===chunk.node.name);
      assert.equal(chunk.node.geometry,original.node.geometry);
      assert.deepEqual(chunk.anchor.position.toArray(),original.anchor.position.toArray());
      assert.equal(chunk.amplitude,original.amplitude);
    }
    let details=0;root.traverse(n=>{if(n.userData.variantDecoration)details++;});
    assert(details>0 && details<=25,'Uses shared variant decorations');
    assert.notEqual(root.getObjectByName('minotaurBody').material,reference.getObjectByName('minotaurBody').material);
    assert.notEqual(root.getObjectByName('lavaLeftEye').material,reference.getObjectByName('lavaLeftEye').material);
    const jawAngle=root.userData.rig.jaw.rotation.x;
    for(let frame=0;frame<180;frame++)api.tickMinotaurMovers(frame/60,1/60);
    assert.equal(root.userData.rig.jaw.rotation.x,jawAngle);
    root.traverse(n=>assert(Number.isFinite(n.position.x+n.position.y+n.position.z+n.quaternion.w)));
  }
}
console.log('Longneck variants: all 28 appearances, shared morphology, palettes, decorations, stable animation and single-preview cleanup passed.');
