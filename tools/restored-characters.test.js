'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const file = path.join(__dirname, 'rock-battlebro.test.js');
let fixture = fs.readFileSync(file, 'utf8').split('const api = context.api;')[0];
fixture = fixture.replace('const M = {', 'const M_ANIMAL = {hoof: new THREE.MeshLambertMaterial({color: 0x241813})}; const M = {');
fixture = fixture.replace('globalThis.api = {', 'globalThis.api = {createSpecterBattleBro, createLongNeckBattleBro, registerMinotaurMover, beginLongneckFootMotion, poseLongneckFeet, resetLongneckFeet, ensureFloatingRockFormExamples, floatingRockFormExamples, ensureMinotaurBattleBroPrototype, ensureSpecterBattleBroPrototype, tickMinotaurMovers, tickSpecterMovers, minotaurMovers, specterMovers,');
const m = new Module(file, module);
m.filename = file;
m.paths = Module._nodeModulePaths(__dirname);
m._compile(fixture + 'module.exports=context.api;', file);
const api = m.exports;
for (let form=1;form<=7;form++) {
  const root = api.createLongNeckBattleBro({ form });
  root.position.set(.5, 0, .5);
  api.worldGroup.add(root);
  const mover = api.registerMinotaurMover(root, 32, 32);
  const legs = mover.parts.minotaurLegs;
  const worldPosition = leg => leg.getWorldPosition(leg.position.clone());
  const assertCompactFeet = message => {
    ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'].forEach((name, i) => {
      const leg = legs[name], rest = mover.longneckFootRest[i];
      assert(Math.abs(leg.position.x - rest.x) <= .111, message + ': front/back reach');
      assert(Math.abs(leg.position.z - rest.z) <= .066, message + ': side reach');
    });
  };
  mover.startX = .5; mover.startZ = .5; mover.targetX = 1.5; mover.targetZ = .5;
  mover.desiredYaw = Math.PI / 2;
  api.beginLongneckFootMotion(mover, true);
  const plantedTurnFoot = worldPosition(legs.frontRight);
  root.rotation.y = Math.PI / 4;
  api.poseLongneckFeet(mover, .5);
  assertCompactFeet('Turn');
  assert(worldPosition(legs.frontRight).distanceTo(plantedTurnFoot) < .2,
    `Form ${form} limits supporting foot drift while turning`);
  root.rotation.y = Math.PI / 2;
  api.poseLongneckFeet(mover, 1);
  const turnEndFoot = worldPosition(legs.frontRight);
  api.resetLongneckFeet(mover);
  assert(worldPosition(legs.frontRight).distanceTo(turnEndFoot) < 1e-6,
    'Turning returns to the rest pose without a foot jump');
  api.beginLongneckFootMotion(mover, false);
  const plantedWalkFoot = worldPosition(legs.frontRight);
  root.position.x = .8;
  api.poseLongneckFeet(mover, .28);
  assertCompactFeet('Walk');
  assert(worldPosition(legs.frontRight).distanceTo(plantedWalkFoot) < .15,
    'Form IV limits supporting foot drift while walking');
  assert(worldPosition(legs.frontLeft).distanceTo(mover.longneckFootMotion[0].start) > .1*root.scale.x,
    'The opposite diagonal foot swings forward');
  root.position.x = 1.5;
  api.poseLongneckFeet(mover, 1);
  const walkEndFoot = worldPosition(legs.frontRight);
  api.resetLongneckFeet(mover);
  assert(worldPosition(legs.frontRight).distanceTo(walkEndFoot) < 1e-6,
    'Walking returns to the rest pose without a foot jump');
  root.position.set(.5, 0, .5);
  mover.startY = 0; mover.targetY = .3;
  api.beginLongneckFootMotion(mover, false);
  const plantedStepFoot = worldPosition(legs.frontRight);
  root.position.set(.8, .15, .5);
  api.poseLongneckFeet(mover, .28);
  assertCompactFeet('Terrain step');
  assert(worldPosition(legs.frontRight).distanceTo(plantedStepFoot) < .15,
    'Form IV limits supporting foot drift during a terrain step');
  root.position.set(1.5, .3, .5);
  api.poseLongneckFeet(mover, 1);
  const stepEndFoot = worldPosition(legs.frontRight);
  api.resetLongneckFeet(mover);
  assert(worldPosition(legs.frontRight).distanceTo(stepEndFoot) < 1e-6,
    'Terrain step returns to the rest pose without a foot jump');
  api.worldGroup.remove(root);
  api.tickMinotaurMovers(0, 1 / 60);
}
const minotaur = api.ensureMinotaurBattleBroPrototype();
const specter = api.ensureSpecterBattleBroPrototype();
assert.equal(api.ensureMinotaurBattleBroPrototype(), minotaur);
assert.equal(api.ensureSpecterBattleBroPrototype(), specter);
assert(specter.userData.looseRocks.chunks.length > 15, 'Body and arm stones float independently');
for (const arm of [specter.userData.rig.leftArm, specter.userData.rig.rightArm]) {
  assert.equal(arm.jaws.length, 2, 'Higher-form two-jaw stone claw');
  specter.updateMatrixWorld(true);
  assert(arm.hand.matrixWorld.elements[13] < arm.shoulder.matrixWorld.elements[13], 'Relaxed hands below shoulders');
}
for (const expression of Object.keys(api.BATTLEBRO_EXPRESSIONS)) {
  assert(api.setBattleBroExpression(specter, expression, { immediate: true }));
  assert.equal(specter.userData.slots.face.userData.expression.name, expression);
}
assert.equal(specter.userData.rig.head.parent.name, 'floatingRockFace', 'Face follows its stone');
const debris = specter.userData.looseRocks.debris;
assert.equal(debris.length, 5, 'Five satellites like Form V');
const cores = ['floatingLavaCore'].map(name => specter.getObjectByName(name));
for (const core of cores) {
  assert.equal(core.geometry, cores[0].geometry, 'Cached Form VII lava mosaic geometry');
  assert.equal(core.material.length, 2, 'Lava and crust material groups');
}
api.tickSpecterMovers(0, 1 / 60);
const orbitStart = debris[0].node.position.clone();
const gestures = new Set();
let claspSeen = false;
const starts = [minotaur, specter].map(root => root.position.clone());
const states = [new Set(), new Set()];
for (let frame = 0; frame < 3600; frame++) {
  api.tickMinotaurMovers(frame / 60, 1 / 60);
  api.tickSpecterMovers(frame / 60, 1 / 60);
  gestures.add(specter.userData.floatingArmGestures.kind);
  claspSeen ||= specter.userData.rig.leftArm.jaws.some(jaw => Math.abs(jaw.joint.rotation.z) > .1);
  states[0].add(minotaur.userData.minotaurMovement.state);
  states[1].add(specter.userData.specterMovement.state);
  for (const root of [minotaur, specter]) root.traverse(node => {
    assert(Number.isFinite(node.position.x + node.position.y + node.position.z + node.quaternion.w));
  });
  assert(specter.position.y >= 0.64, 'Specter keeps ground clearance');
}
for (const kind of ['singleClasp', 'doubleClasp', 'shrug', 'reach', 'sweep', 'stretch']) assert(gestures.has(kind), kind + ' plays automatically');
assert(claspSeen, 'Claw jaws close during gestures');
assert(debris[0].node.position.distanceTo(orbitStart) > .1, 'Satellites orbit');
assert(states[0].has('WALKING_FLAT'));
assert(states[0].has('REARING'));
assert(states[1].has('FLOATING'));
assert(states[1].has('SETTLING'));
[minotaur, specter].forEach((root, i) => assert(root.position.distanceTo(starts[i]) > 0.1));
const orbitField = specter.userData.looseRocks.orbitField;
assert.equal(orbitField.parent, api.worldGroup);
api.worldGroup.remove(minotaur, specter);
assert.equal(orbitField.parent, null, 'Orbit field removed with character');
api.tickMinotaurMovers(61, 1 / 60);
api.tickSpecterMovers(61, 1 / 60);
assert.equal(api.minotaurMovers.size, 0);
assert.equal(api.specterMovers.size, 0);
console.log('Restored characters: spawn deduplication, walking, rearing, hovering, gliding, finite poses and cleanup passed.');

const gallery = api.ensureFloatingRockFormExamples();
assert.equal(gallery.size, 7, 'All seven forms spawn');
api.ensureFloatingRockFormExamples();
assert.equal(api.specterMovers.size, 7, 'Gallery spawn is idempotent');
let previousScale = 0, previousDrift = Infinity;
for (let form = 1; form <= 7; form++) {
  const root = gallery.get(form), controller = root.userData.looseRocks;
  assert.equal(root.userData.form, form);
  assert.equal(root.userData.visualVariant, 'plant', 'Only plant forms populate the gallery');
  assert(root.scale.x > previousScale, 'Forms grow gradually'); previousScale = root.scale.x;
  assert(controller.chunks[0].amplitude < previousDrift, 'Forms become more connected'); previousDrift = controller.chunks[0].amplitude;
  assert.equal(controller.debris.length, [0,1,2,3,5,6,8][form-1]);
  assert.equal(root.userData.rig.leftArm.jaws.length, form < 3 ? 0 : 2);
  if (form === 1) assert(!root.getObjectByName('leftFloatingForearm'), 'First form has nubs');
  for (const expression of Object.keys(api.BATTLEBRO_EXPRESSIONS)) assert(api.setBattleBroExpression(root, expression));
}
for (let frame=0;frame<900;frame++) api.tickSpecterMovers(70+frame/60,1/60);
for (const root of gallery.values()) {
  root.traverse(node => assert(Number.isFinite(node.position.x+node.position.y+node.position.z+node.quaternion.w)));
  const mover = root.userData.specterMovement, home = root.userData.previewHome;
  assert(Math.hypot(mover.cellX-home.x,mover.cellZ-home.z)<=1.5, 'Gallery forms stay near their labels');
}
console.log('Floating evolution: seven distinct forms, progression, orbit counts, expressions, bounded travel and duplicate-free gallery passed.');

for (let form = 1; form <= 7; form++) {
  const lava = api.createSpecterBattleBro({form, variant: 'lava'});
  for (const variant of ['plant','sand','ice']) {
    const root = api.createSpecterBattleBro({form, variant});
    assert.equal(root.userData.visualVariant, variant);
    assert.equal(root.userData.looseRocks.chunks.length, lava.userData.looseRocks.chunks.length);
    assert.equal(root.userData.looseRocks.debris.length, lava.userData.looseRocks.debris.length);
    for (const chunk of root.userData.looseRocks.chunks) {
      const reference = lava.userData.looseRocks.chunks.find(other => other.node.name === chunk.node.name);
      assert.equal(chunk.node.geometry, reference.node.geometry, 'Variants share body geometry');
      assert.deepEqual(chunk.anchor.position.toArray(), reference.anchor.position.toArray());
      assert.equal(chunk.amplitude, reference.amplitude, 'Drift preserved');
    }
    let decorations = 0;
    root.traverse(node => { if(node.userData.variantDecoration) decorations++; });
    assert(decorations > 0, 'Variant uses existing stone decorations');
    assert.notEqual(root.getObjectByName('floatingLavaCore').material, lava.getObjectByName('floatingLavaCore').material);
    for (const name of Object.keys(api.BATTLEBRO_EXPRESSIONS)) assert(api.setBattleBroExpression(root, name));
  }
}
assert.throws(() => api.createSpecterBattleBro({variant:'unknown'}), /Unknown floating rock variant/);
assert.equal(api.specterMovers.size, 7, 'Constructing variants does not populate them');
console.log('Floating variants: all 28 forms share geometry, gestures, drift and expressions; plant-only gallery and variant decorations passed.');
// Forms III/IV: expressions stay in front of the drifting face slab.
{
  const THREE = require('../vendor/three/three.r128.min.js');
  const point = new THREE.Vector3(), transform = new THREE.Matrix4();
  for (const form of [3,4]) for (const variant of ['lava','sand','plant','ice']) {
    const root = api.createSpecterBattleBro({form,variant});
    const slab = root.getObjectByName('floatingRockFace');
    slab.geometry.computeBoundingBox();
    const front = slab.geometry.boundingBox.max.z;
    for (const expression of Object.keys(api.BATTLEBRO_EXPRESSIONS)) {
      api.setBattleBroExpression(root,expression,{immediate:true});
      for (let frame=0;frame<60;frame++) {
        api.tickLooseRockAttachments(root,frame*.1, .05);
        root.updateMatrixWorld(true);
        for (const name of ['lavaLeftEye','lavaRightEye']) {
          const eye=root.getObjectByName(name);
          eye.geometry.computeBoundingBox();
          transform.copy(slab.matrixWorld).invert().multiply(eye.matrixWorld);
          const box=eye.geometry.boundingBox;
          for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]) {
            point.set(x,y,z).applyMatrix4(transform);
            assert(point.z>front+.015,`${variant} Specter ${form}: ${name} stays ahead of face during ${expression}: z=${point.z}, front=${front}, scale=${root.userData.rig.head.scale.z}`);
          }
        }
      }
    }
  }
  console.log('Specter III/IV eyes: all materials and expressions retain clearance through face drift.');
}
