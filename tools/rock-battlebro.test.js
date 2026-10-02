'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const THREE = require('../vendor/three/three.r128.min.js');
const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'Inline source section exists: ' + start);
  return source.slice(a, b);
}
let seed = 42;
const seededMath = Object.create(Math);
seededMath.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const context = vm.createContext({ THREE, assert, performance, console, Math: seededMath });
vm.runInContext(`
  const geomCache = new Map();
  ${section('  function getBoxGeometry(', '  // Variant of getBoxGeometry')}
  ${section('  function roundedBox(', '  // -------- materials --------')}
  const M = { sand: new THREE.MeshLambertMaterial({color: 0xe6cc7c}),
    sandDk: new THREE.MeshLambertMaterial({color: 0xc6a64b}),
    sandAccent: new THREE.MeshLambertMaterial({color: 0xff2020}),
    lava: new THREE.MeshLambertMaterial({color: 0xe7592b}),
    lavaCrust: new THREE.MeshLambertMaterial({color: 0x3a201a}) };
  ${section('  function cellRand(', '  function edgeBand(')}
  ${section('  const LAVA_MONSTER_M =', '  function makeBattleBroPart(')}
  ${section('  function makeBattleBroPart(', '  // Shared semantic material roles;')}
  function castReceive(root) {}
  ${section('  // Shared semantic material roles;', '  function battleBroYawDelta(')}
  const GRID = 64;
  const MAX_FLOORS = 8;
  const MAX_TERRAIN_FLOORS = 64;
  const BUILDABLE_LAND_Y_OFFSET = 0, TOP_H = 0;
  const terrainRiseForLevel = level => (level - 1) * 0.2;
  function terrainLevelForCell(cell) { return cell?.terrainFloors || 1; }
  let heights = new Map();
  const terrainRiseAt = (x,z) => heights.get(x+","+z) || 0;
  let blocked = new Set();
  const getWorldCell = (x,z) => ({terrain: blocked.has(x+','+z) ? 'water' : 'grass'});
  const trainingFacilityOccupiesCell = () => null;
  const stargateOccupiesCell = () => false;
  const tilePos = (x,z) => ({x:x-GRID/2+0.5, z:z-GRID/2+0.5});
  const worldGroup = new THREE.Group();
  const spawnDustBurst = () => {};
  ${section('  function battleBroYawDelta(', '  const LAVA_MOVE_STATE =')}
  ${section('  const LAVA_MOVE_STATE =', '  let baseBattleBroPrototype =')}
  ${section('  const rockVariantExamples =', '  const VEHICLE_BASE_WHEEL_RADIUS =')}
  globalThis.api = {setBattleBroExpression, tickBattleBroExpression, BATTLEBRO_EXPRESSIONS, createRockBattleBro, createLavaMonsterBattleBro, createBattleBroCharacter, ROCK_BATTLEBRO_M,
    beginLavaTurn, tickLavaTurn, solveLavaTurnArm, battleBroYawDelta, tickUpperArmMotion, triggerUpperArmClawGesture,
    telekineticRockThrow, cancelTelekineticRockThrow, restoreTelekineticBody,
    evaluateLavaTerrainStep, tickLavaTraversalProgress, chooseLavaContactSwing, planLavaContactSwing, lavaContactCandidates, selectJuggernautImpactRoute, selectLavaWalkRoute, chooseLavaWalkTarget, setLavaHandAnchor, planLavaTerrainMove, planLavaTerrainTurn, safeLavaContact, lavaContactExtent, sampleLavaContactSwing, lavaTerrainRectangle,
    setTerrainHeights: entries => heights = new Map(entries),
    registerLavaMonsterMover, beginJuggernautStride, tickJuggernautStride, tickLavaMonsterMovers, tickLooseRockAttachments, tickBattleBroOrbitField, lavaMonsterMovers, worldGroup,
    ensureRockVariantExamples, rockVariantExamples, lavaCellIsWalkable, tilePos,
    setBlocked: cells => blocked = new Set(cells)};
`, context);
const api = context.api;
const variants = ['lava', 'ice', 'sand', 'plant'];
const roots = variants.map(variant => api.createRockBattleBro({ variant }));
const lava = roots[0];
for (const root of roots) {
  const rig = root.userData.rig;
  assert.equal(rig.leftLeg, undefined);
  assert.equal(rig.rightLeg, undefined);
  assert.deepEqual(Object.keys(rig), Object.keys(lava.userData.rig));
  // Untreated variants retain the same structural geometry and local pose.
  if (root !== lava) roots[1].traverse(base => {
    if (!base.isMesh || base.userData.variantDecoration || base.name.startsWith('ice') || ['lavaBackFlame', 'lavaBackEmber'].includes(base.name)) return;
    const mesh = root.getObjectByName(base.name);
    assert(mesh?.isMesh, base.name);
    assert.equal(mesh.geometry, base.geometry);
    if (roots[1].userData.looseRocks.debris.some(c=>c.node===base)) return;
    const sourcePose = roots[1].userData.looseRocks.chunks.find(c=>c.node===base)?.anchor || base;
    const targetPose = root.userData.looseRocks.chunks.find(c=>c.node===mesh)?.anchor || mesh;
    assert.deepEqual(targetPose.position.toArray(), sourcePose.position.toArray());
    assert.deepEqual(targetPose.rotation.toArray(), sourcePose.rotation.toArray());
    assert(mesh.material?.isMaterial);
  });
  const again = api.createRockBattleBro({variant: root.userData.visualVariant});
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    assert.equal(mesh.geometry, again.getObjectByName(mesh.name).geometry);
    assert.equal(mesh.material, again.getObjectByName(mesh.name).material);
  });
}
// Lava decoration must not change the authoritative joint rest poses.
for (const name of ['torso', 'head']) {
  assert.deepEqual(lava.userData.rig[name].position.toArray(), roots[1].userData.rig[name].position.toArray());
}
for (const side of ['leftArm', 'rightArm']) {
  for (const joint of ['shoulder', 'elbow', 'hand']) {
    assert.deepEqual(lava.userData.rig[side][joint].position.toArray(), roots[1].userData.rig[side][joint].position.toArray());
  }
}
assert.equal(lava.userData.looseRocks.debris.length, 3);
assert.equal(lava.userData.looseRocks.chunks.length, 16);
for (const root of roots.slice(1)) assert.equal(root.userData.looseRocks.chunks.length, lava.userData.looseRocks.chunks.length);
const originalFistY = lava.getObjectByName('leftGroundFist').position.y;
// Following must lag a changed rig target, converge without drift, and leave
// ground-contact geometry untouched. This also exercises a long frame safely.
const follower = lava.userData.looseRocks.chunks[0];
const initial = follower.node.position.clone();
follower.anchor.position.x += 0.04;
api.tickLooseRockAttachments(lava, 0, 1 / 60);
assert(follower.node.position.distanceTo(initial) > 0);
assert(follower.node.position.distanceTo(follower.target) > 0.001);
for (let i = 0; i < 120; i++) api.tickLooseRockAttachments(lava, 0, 1 / 60);
assert(follower.node.position.distanceTo(follower.target) < 1e-6);
follower.anchor.position.x -= 0.04;
api.tickLooseRockAttachments(lava, 0, 2);
assert(follower.node.position.distanceTo(follower.target) <= 0.045 + 1e-10);
for (const side of ['left', 'right']) {
  const hand = lava.getObjectByName(side + 'GroundFist');
  const baseline = roots[1].getObjectByName(side + 'GroundFist');
  hand.geometry.computeBoundingBox();
  const bottom = hand.position.y + hand.geometry.boundingBox.min.y * hand.scale.y;
  const oldBottom = baseline.position.y + baseline.geometry.boundingBox.min.y * baseline.scale.y;
  assert(Math.abs(bottom - oldBottom) < 1e-7, 'Original hand contact plane');
}
assert.throws(() => api.createRockBattleBro({variant: 'unknown'}), /Unknown/);
assert.equal(api.createLavaMonsterBattleBro().userData.visualVariant, 'lava');
assert.equal(api.ROCK_BATTLEBRO_M.sand.stoneLight.color.getHex(), 0xe6cc7c);
assert.equal(api.ROCK_BATTLEBRO_M.sand.crack.emissiveIntensity, 0);

// Populate on flat terrain, then exercise a complete gait for every form.
api.worldGroup.add(lava);
lava.position.set(0.5, 0, 0.5);
api.registerLavaMonsterMover(lava, 32, 32);
api.setBlocked(['28,28']); // Preferred ice cell is water: use a clear nearby site.
api.ensureRockVariantExamples({gallery:true});
assert.equal(api.rockVariantExamples.size, 9);
api.ensureRockVariantExamples({gallery:true});
assert.equal(api.lavaMonsterMovers.size, 10, 'Population is idempotent');
const movers = [...api.lavaMonsterMovers];
// Morphology/gait baselines use the unchanged neutral face.
for (const mover of movers) mover.root.userData.expressionCycleEnabled = false;
for (const a of movers) {
  for (const b of movers) {
    if (a === b) continue;
    assert(Math.hypot(a.cellX-b.cellX, a.cellZ-b.cellZ) >= 3.5);
    assert.equal(api.lavaCellIsWalkable(b.cellX, b.cellZ, a), false);
  }
}
const seen = new Map(movers.map(m => [m, new Set()]));
const origins = new Map(movers.map(m => [m, m.root.position.clone()]));
const moved = new Set();
for (let frame = 0; frame < 2400; frame++) {
  api.tickLavaMonsterMovers(frame / 60, 1 / 60);
  for (const mover of movers) {
    seen.get(mover).add(mover.state);
    if (mover.root.position.distanceTo(origins.get(mover)) > 0.1) moved.add(mover);
    if (mover.root === lava) {
      for (const chunk of lava.userData.looseRocks.chunks) {
        assert(chunk.node.position.distanceTo(chunk.target) <= 0.045 + 1e-10);
        assert.equal(chunk.node.parent, lava.userData.looseRocks.group);
      }
      assert.equal(lava.getObjectByName('leftGroundFist').position.y, originalFistY);
      for (const pebble of lava.userData.looseRocks.debris) {
        assert(Math.abs(pebble.node.position.x) <= pebble.radius + 0.055 + 1e-10);
        assert(Math.abs(pebble.node.position.y - pebble.height) <= 0.10 + 1e-10);
      }
    }
    mover.root.traverse(node => {
      assert(node.position.toArray().every(Number.isFinite));
      assert(node.rotation.toArray().slice(0,3).every(Number.isFinite));
    });
  }
}
for (const mover of movers) {
  const expectedStates=(mover.root.userData.locomotionForm||mover.root.userData.form)>=4
    ? ['JUGGERNAUT_STRIDE']
    :mover.root.userData.form < 4 ? ['REACH', 'PULL'] : ['REACH_RIGHT', 'PLANT_RIGHT', 'PULL_RIGHT', 'REACH_LEFT', 'PLANT_LEFT', 'PULL_LEFT', 'SETTLE'];
  for (const state of expectedStates) {
    assert(seen.get(mover).has(state), mover.root.name + ' completed ' + state);
  }
  assert(moved.has(mover), mover.root.name + ' moved away from its spawn');
}
console.log('rock-battlebro: shared geometry/materials, variant rigs, safe population and four-form arm locomotion OK');

const newborn = api.rockVariantExamples.get('lava-newborn');
assert.equal(newborn.userData.form, 1);
assert.equal(newborn.userData.rig.limbs.length, 2);
assert.equal(newborn.userData.rig.torso, undefined);
assert.equal(newborn.userData.rig.leftArm, undefined);
assert.equal(newborn.userData.looseRocks.debris.length, 0);
assert.equal(newborn.userData.looseRocks.chunks.length, 1);
assert(newborn.userData.approximateHeight < lava.userData.approximateHeight * 0.5);
for (const name of ['lavaLeftEye', 'lavaRightEye', 'lavaLeftBrow', 'lavaRightBrow', 'lavaMouthCavity', 'lavaMouthGlow']) {
  const young = newborn.getObjectByName(name), mature = lava.getObjectByName(name);
  assert.equal(young.geometry, mature.geometry);
  assert.equal(young.material, mature.material);
  assert.deepEqual(young.position.toArray(), mature.position.toArray());
}
for (const form of [8]) assert.throws(() => api.createRockBattleBro({form}), /Unsupported/);
for (const variant of ['ice', 'sand', 'plant']) assert.equal(api.createRockBattleBro({variant, form: 1}).userData.form, 1);
// A planted crude limb must remain fixed while the head/core pulls forward.
const youngMover = movers.find(m => m.root === newborn);
let checkedPlant = false;
for (let frame = 0; frame < 1200 && !checkedPlant; frame++) {
  api.tickLavaMonsterMovers(40 + frame / 60, 1 / 60);
  if (youngMover.state !== 'PULL' || youngMover.progress < 0.3 || youngMover.progress > 0.7) continue;
  const limb = newborn.userData.rig.limbs[youngMover.sideIndex];
  const before = limb.getWorldPosition(new THREE.Vector3());
  const bodyBefore = newborn.position.clone();
  api.tickLavaMonsterMovers(40 + (frame + 1) / 60, 1 / 60);
  assert(limb.getWorldPosition(new THREE.Vector3()).distanceTo(before) < 1e-8);
  assert(newborn.position.distanceTo(bodyBefore) > 0);
  checkedPlant = true;
}
assert(checkedPlant, 'Newborn plants a limb and pulls its core forward');
console.log('newborn: sparse morphology, shared face, form selection and planted hobble OK');

const developing = api.rockVariantExamples.get('lava-developing');
assert.equal(developing.userData.form, 2);
assert.equal(developing.userData.rig.arms.length, 2);
assert.equal(developing.userData.looseRocks.debris.length, 1);
assert(developing.userData.looseRocks.chunks.length > newborn.userData.looseRocks.chunks.length);
assert(developing.userData.looseRocks.chunks.length < lava.userData.looseRocks.chunks.length);
assert(developing.userData.approximateHeight > newborn.userData.approximateHeight * 1.3);
assert(developing.userData.approximateHeight < lava.userData.approximateHeight * 0.7);
for (const name of ['lavaLeftEye', 'lavaRightEye', 'lavaLeftBrow', 'lavaRightBrow', 'lavaMouthCavity', 'lavaMouthGlow']) {
  const middle = developing.getObjectByName(name), mature = lava.getObjectByName(name);
  assert.equal(middle.geometry, mature.geometry);
  assert.equal(middle.material, mature.material);
  assert.deepEqual(middle.position.toArray(), mature.position.toArray());
}
for (const variant of ['ice', 'sand', 'plant']) assert.equal(api.createRockBattleBro({variant, form: 2}).userData.form, 2);
const developingMover = movers.find(m => m.root === developing);
let checkedDevelopingPlant = false;
const armBefore = developing.userData.rig.arms[0].upper.quaternion.clone();
for (let frame = 0; frame < 1200 && !checkedDevelopingPlant; frame++) {
  api.tickLavaMonsterMovers(70 + frame / 60, 1 / 60);
  if (developingMover.state !== 'PULL' || developingMover.progress < 0.3 || developingMover.progress > 0.7) continue;
  const limb = developing.userData.rig.limbs[developingMover.sideIndex];
  const before = limb.getWorldPosition(new THREE.Vector3());
  const bodyBefore = developing.position.clone();
  api.tickLavaMonsterMovers(70 + (frame + 1) / 60, 1 / 60);
  assert(limb.getWorldPosition(new THREE.Vector3()).distanceTo(before) < 1e-8);
  assert(developing.position.distanceTo(bodyBefore) > 0);
  checkedDevelopingPlant = true;
}
assert(checkedDevelopingPlant);
assert(developing.userData.rig.arms[0].upper.quaternion.angleTo(armBefore) > 0.001);
console.log('developing: intermediate morphology, shared face, articulated limbs and planted pulls OK');

const adolescent = api.rockVariantExamples.get('lava-adolescent');
assert.equal(adolescent.userData.form, 3);
assert.equal(api.createRockBattleBro().userData.form, 4);
assert.equal(api.createLavaMonsterBattleBro().userData.form, 4);
assert.equal(adolescent.userData.rig.arms.length, 2);
assert.equal(adolescent.userData.looseRocks.debris.length, 2);
assert(adolescent.userData.looseRocks.chunks.length > developing.userData.looseRocks.chunks.length);
assert(adolescent.userData.looseRocks.chunks.length <= lava.userData.looseRocks.chunks.length);
assert(adolescent.userData.approximateHeight > developing.userData.approximateHeight);
assert(adolescent.userData.approximateHeight < lava.userData.approximateHeight);
for (const name of ['lavaLeftEye', 'lavaRightEye', 'lavaLeftBrow', 'lavaRightBrow', 'lavaMouthCavity', 'lavaMouthGlow']) {
  const teen = adolescent.getObjectByName(name), mature = lava.getObjectByName(name);
  assert.equal(teen.geometry, mature.geometry);
  assert.equal(teen.material, mature.material);
  assert.deepEqual(teen.position.toArray(), mature.position.toArray());
}
for (const variant of ['ice', 'sand', 'plant']) assert.equal(api.createRockBattleBro({variant, form: 3}).userData.form, 3);
const adolescentMover = movers.find(m => m.root === adolescent);
assert(seen.get(adolescentMover).has('PLANT'));
let adolescentPlantChecked = false;
for (let frame = 0; frame < 1200 && !adolescentPlantChecked; frame++) {
  api.tickLavaMonsterMovers(100 + frame / 60, 1 / 60);
  if (adolescentMover.state !== 'PULL' || adolescentMover.progress < 0.3 || adolescentMover.progress > 0.7) continue;
  const limb = adolescent.userData.rig.limbs[adolescentMover.sideIndex];
  const before = limb.getWorldPosition(new THREE.Vector3());
  const body = adolescent.position.clone();
  api.tickLavaMonsterMovers(100 + (frame + 1) / 60, 1 / 60);
  assert(limb.getWorldPosition(new THREE.Vector3()).distanceTo(before) < 1e-8);
  assert(adolescent.position.distanceTo(body) > 0);
  assert(adolescent.userData.looseRocks.chunks.some(chunk => chunk.compression > 0.1));
  for (const chunk of adolescent.userData.looseRocks.chunks) {
    assert(chunk.node.position.distanceTo(chunk.target) <= 0.045 + 1e-10);
  }
  adolescentPlantChecked = true;
}
assert(adolescentPlantChecked);
// Accumulating adolescent rocks must not mutate cached geometry of Form II.
const developingAgain = api.createRockBattleBro({form: 2});
for (const name of ['developingLeftCore', 'developingLeftShoulderRock', 'developingLeftUpperRock', 'developingLeftHandRock']) {
  assert.equal(developingAgain.getObjectByName(name).geometry, developing.getObjectByName(name).geometry);
  assert.notEqual(developingAgain.getObjectByName(name).geometry, adolescent.getObjectByName(name).geometry);
}
console.log('adolescent: accumulated morphology, shared face, planted pulls, load motion and mature renumbering OK');

const apex = api.rockVariantExamples.get('lava-apex');
assert.equal(apex.userData.form, 7);
assert(apex.userData.approximateHeight > lava.userData.approximateHeight * 2);
assert.equal(apex.userData.looseRocks.debris.length, 8);
assert(apex.userData.looseRocks.chunks.length < 70);
for (const key of ['head', 'core', 'spine', 'leftSupport', 'rightSupport', 'leftUpperArm', 'rightUpperArm']) assert(apex.userData.rig[key]);
for (const name of ['lavaLeftEye', 'lavaRightEye', 'lavaLeftBrow', 'lavaRightBrow', 'lavaMouthCavity', 'lavaMouthGlow']) {
  const final = apex.getObjectByName(name), mature = lava.getObjectByName(name);
  assert.equal(final.geometry, mature.geometry);
  assert.deepEqual(final.position.toArray(), mature.position.toArray());
}
for (const side of ['left', 'right']) {
  // The support legs inherit the actual mature arm geometry and pivot chain.
  for (const suffix of ['ShoulderRock', 'UpperArmRock', 'LavaElbow']) {
    assert.equal(apex.getObjectByName(side + suffix).geometry, lava.getObjectByName(side + suffix).geometry);
  }
  const support = apex.userData.rig[side + 'Support'];
  assert.equal(support.elbow.parent, support.shoulder);
  assert.equal(support.hand.parent, support.elbow);
  assert.equal(support, apex.userData.locomotionRig[side + 'Arm']);
}
assert(apex.getObjectByName('apexMoltenHeart').material.emissiveIntensity > api.ROCK_BATTLEBRO_M.lava.core.emissiveIntensity);
for (const variant of ['ice', 'sand', 'plant']) assert.equal(api.createRockBattleBro({variant, form: 7}).userData.form, 7);
const apexAgain = api.createRockBattleBro({form: 7});
apex.traverse(node => {
  if (!node.isMesh) return;
  const twin = apexAgain.getObjectByName(node.name);
  assert.equal(twin.geometry, node.geometry);
  assert.equal(twin.material, node.material);
});
const apexOrigin = apex.position.clone();
const upperBefore = apex.userData.rig.leftUpperArm.hand.getWorldPosition(new THREE.Vector3());
for (let frame = 0; frame < 180; frame++) {
  api.tickLavaMonsterMovers(140 + frame / 60, frame === 0 ? 2 : 1 / 60);
  for (const chunk of apex.userData.looseRocks.chunks) assert(chunk.node.position.distanceTo(chunk.target) <= 0.045 + 1e-10);
}
assert(apex.userData.locomotionRig.head.parent === null);
assert.equal(apex.getObjectByName('lavaHeadCore'), undefined);
assert.equal(apex.getObjectByName('lavaFloatingHeadShell'), undefined);
assert.equal(apex.getObjectByName('apexLowerCoreStone'), undefined);
assert.equal(apex.userData.apexMovement.parts, apex.userData.locomotionRig);
assert.equal(apex.userData.rig.leftSupport.shoulder.scale.x, 1);
assert.equal(apex.userData.rig.torso.parent, apex.userData.locomotionRig.torso);
assert(apex.userData.rig.leftUpperArm.hand.getWorldPosition(new THREE.Vector3()).distanceTo(upperBefore) > 0.001);
assert.equal(apex.userData.rig.spine.parent, apex.userData.rig.torso);
assert.equal(api.lavaCellIsWalkable(apex.userData.apexMovement.cellX + 2, apex.userData.apexMovement.cellZ, movers[0]), false);
console.log('apex: four semantic limbs, headless Form IV lower assembly, inherited locomotion and cached rocks OK');

// Greater bridges the mature support structure and Apex without a second arm.
const greater = api.rockVariantExamples.get('lava-greater');
assert.equal(greater.userData.form, 5);
assert(greater.userData.rig.leftUpperArm);
assert.equal(greater.userData.rig.rightUpperArm, undefined);
assert(greater.userData.rig.head.position.x > 0.25);
assert(greater.userData.rig.leftUpperArm.shoulder.position.x < 0);
assert(greater.getObjectByName('greaterShoulderBud'));
assert.equal(greater.getObjectByName('lavaHeadCore'), undefined);
assert.equal(greater.userData.greaterMovement.parts, greater.userData.locomotionRig);
for (const side of ['left', 'right']) {
  for (const suffix of ['ShoulderRock', 'UpperArmRock', 'MassiveForearm', 'GroundFist']) {
    const part = greater.getObjectByName(side + suffix);
    const reference = apex.getObjectByName(side + suffix);
    assert.equal(part.geometry, reference.geometry, 'Identical support geometry');
    assert.equal(part.scale.x, reference.scale.x);
    assert.equal(part.scale.z, reference.scale.z);
  }
}
assert(greater.userData.looseRocks.debris.length < apex.userData.looseRocks.debris.length);
assert(greater.userData.looseRocks.chunks.filter(chunk => !chunk.node.name.startsWith('greaterSecond')).length
  < apex.userData.looseRocks.chunks.length, 'Greater body retains fewer stones before its additional head');
const energy = greater.getObjectByName('greaterLowerHeart').material.emissiveIntensity;
assert(energy > api.ROCK_BATTLEBRO_M.lava.core.emissiveIntensity);
assert(energy < apex.getObjectByName('apexMoltenHeart').material.emissiveIntensity);
const greaterAgain = api.createRockBattleBro({form: 5});
greater.traverse(node => {
  if (!node.isMesh) return;
  const twin = greaterAgain.getObjectByName(node.name);
  assert.equal(node.geometry, twin.geometry);
  assert.equal(node.material, twin.material);
});
for (const variant of ['ice', 'sand', 'plant']) assert.equal(api.createRockBattleBro({variant, form: 5}).userData.form, 5);
console.log('greater: asymmetric single arm, offset head, unchanged support geometry, intermediate energy and cached rocks OK');

const advanced = api.rockVariantExamples.get('lava-advanced');
assert.equal(advanced.userData.form, 6);
assert.equal(advanced.userData.approximateHeight, greater.userData.approximateHeight, 'Both forms frame their raised second head');
assert(Number.isFinite(advanced.userData.rig.head.position.x), 'Authored head offset remains valid');
assert.equal(advanced.userData.advancedMovement.parts, advanced.userData.locomotionRig);
assert(advanced.userData.rig.rightUpperArm);
assert.equal(advanced.getObjectByName('greaterShoulderBud'), undefined);
for (const side of ['left', 'right']) {
  for (const suffix of ['ShoulderRock', 'UpperArmRock', 'MassiveForearm', 'GroundFist']) {
    assert.equal(advanced.getObjectByName(side + suffix).geometry, greater.getObjectByName(side + suffix).geometry);
  }
}
for (const suffix of ['Biceps', 'Forearm', 'ClawBase', 'OuterClaw', 'InnerClaw']) {
  const left = advanced.getObjectByName('greater' + suffix);
  const right = advanced.getObjectByName('advancedRight' + suffix);
  if (suffix === 'Biceps' || suffix === 'Forearm') {
    right.geometry.computeBoundingBox(); left.geometry.computeBoundingBox();
    assert(right.geometry.boundingBox.getSize(new THREE.Vector3()).length() > left.geometry.boundingBox.getSize(new THREE.Vector3()).length(), 'Right arm has heavier stones');
  } else {
    assert.equal(left.geometry, greater.getObjectByName('greater' + suffix).geometry);
    assert.equal(right.geometry, left.geometry);
  }
  assert.equal(right.material, left.material);
}
const advancedAgain = api.createRockBattleBro({form: 6});
advanced.traverse(node => {
  if (!node.isMesh) return;
  const twin = advancedAgain.getObjectByName(node.name);
  assert.equal(node.geometry, twin.geometry);
  assert.equal(node.material, twin.material);
});
assert(advanced.userData.rig.rightUpperArm.shoulder.position.y < advanced.userData.rig.leftUpperArm.shoulder.position.y);
assert(advanced.getObjectByName('greaterForearmShard'));
assert(apex.getObjectByName('leftApexUpperForearmShard'));
console.log('advanced: asymmetric gathered arms, unchanged supports, cached sculpted rocks and locomotion OK');

// Deterministic turning checks use the visible wrist/limb, not just anchors.
for (let form = 1; form <= 7; form++) {
  for (const angle of [0, 0.12, -0.12, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const root = api.createRockBattleBro({form});
    api.worldGroup.add(root);
    root.position.set(3, 0, 3);
    root.rotation.y = Math.PI - 0.04;
    const mover = api.registerLavaMonsterMover(root, 35, 35);
    const initialYaw = root.rotation.y;
    api.beginLavaTurn(mover, initialYaw, initialYaw + angle);
    const turn = mover.turn;
    let complete = false, pulled = false;
    const sides = new Set();
    for (let frame = 0; frame < 2000 && !complete; frame++) {
      const previousPhase = turn.phase, previousIndex = turn.index;
      const before = turn.anchors.map(a => a.clone());
      const yawBefore = root.rotation.y;
      complete = api.tickLavaTurn(mover, frame === 30 ? 2 : 1 / 60);
      assert(Math.abs(api.battleBroYawDelta(root.rotation.y - yawBefore)) < 0.16,
        'A dropped frame cannot snap the body to its final heading');
      if (turn.phase === 'REACH' && previousPhase === 'REACH') {
        assert.equal(root.rotation.y, yawBefore, 'Reach lands before body rotation starts');
      }
      root.updateMatrixWorld(true);
      if (form < 4) {
        mover.parts.limbs.forEach((limb, i) => limb.position.copy(root.worldToLocal(turn.local.copy(turn.anchors[i]))));
      } else {
        api.solveLavaTurnArm(mover, mover.parts.leftArm, turn.anchors[0], 0);
        api.solveLavaTurnArm(mover, mover.parts.rightArm, turn.anchors[1], 1);
      }
      for (let i = 0; i < 2; i++) {
        const node = form < 4 ? mover.parts.limbs[i] : mover.parts[i ? 'rightArm' : 'leftArm'].hand;
        const actual = node.getWorldPosition(new THREE.Vector3());
        const expected = turn.anchors[i].clone();
        if (form >= 4) expected.y += mover.terrainContacts ? mover.terrainContacts[i].sole : 0.28;
        assert(actual.distanceTo(expected) < 1e-7, `Form ${form} angle ${angle} phase ${turn.phase} frame ${frame} error ${actual.distanceTo(expected)} actual ${actual.toArray()} expected ${expected.toArray()}`);
      }
      if (turn.phase === 'PULL' && previousPhase === 'PULL' && turn.index === previousIndex) {
        for (let i = 0; i < 2; i++) assert(turn.anchors[i].distanceTo(before[i]) < 1e-8, 'No support skating during pull');
        pulled = true;
        sides.add(turn.side);
      }
      assert(root.position.distanceTo(turn.center) < 1e-8, 'Turning does not advance the walking path');
    }
    assert(complete, `Form ${form} completes turn`);
    if (angle) assert(pulled);
    assert(Math.abs(api.battleBroYawDelta(root.rotation.y - initialYaw - angle)) < 1e-8);
    if (Math.abs(angle) > 1) assert.equal(sides.size, 2, 'Large turns alternate supports');
    assert(mover.parts.rig.position.length() < 1e-8, 'Turn settles the body');
    api.lavaMonsterMovers.delete(mover);
    root.parent.remove(root);
  }
}
console.log('turning: all seven forms, both directions, wraparound, alternating supports and exact 3D contacts OK');

// Juggernaut IV–VII use one uninterrupted right/left stride per terrain cell.
for(const form of [4,5,6,7]){
  const root=api.createBattleBroCharacter({character:'juggernaut',variant:'lava',form});
  api.worldGroup.add(root);root.position.set(.5,0,.5);
  const mover=api.registerLavaMonsterMover(root,32,32),scale=root.userData.locomotionScale||1;
  mover.startX=.5;mover.startZ=.5;mover.startY=0;
  mover.targetX=.5;mover.targetZ=1.5;mover.targetY=0;mover.targetCellX=32;mover.targetCellZ=33;
  api.setLavaHandAnchor(mover.rightGoal,.5,1,0,1,0,scale);
  api.setLavaHandAnchor(mover.leftGoal,.5,1.5,0,-1,0,scale);
  api.beginJuggernautStride(mover);
  let previousZ=root.position.z,minTravel=Infinity,maxPitch=0,rightLift=0,leftLift=0;
  let plantedRight=null,plantedLeft=null,maxRightDrift=0,maxLeftDrift=0;
  for(let frame=0;frame<500&&mover.state==='JUGGERNAUT_STRIDE';frame++){
    api.tickJuggernautStride(mover,1/60);
    const p=mover.progress;
    minTravel=Math.min(minTravel,root.position.z-previousZ);previousZ=root.position.z;
    maxPitch=Math.max(maxPitch,Math.abs(mover.parts.torso.rotation.x));
    rightLift=Math.max(rightLift,mover.rightAnchor.y-mover.rightGoal.y);
    leftLift=Math.max(leftLift,mover.leftAnchor.y-mover.leftGoal.y);
    if(p>.32&&p<.49){if(plantedRight)maxRightDrift=Math.max(maxRightDrift,mover.rightAnchor.distanceTo(plantedRight));plantedRight=mover.rightAnchor.clone();}
    if(p>.82&&p<.99){if(plantedLeft)maxLeftDrift=Math.max(maxLeftDrift,mover.leftAnchor.distanceTo(plantedLeft));plantedLeft=mover.leftAnchor.clone();}
  }
  assert.equal(mover.state,'IDLE',`Juggernaut ${form} completes a continuous stride cycle`);
  assert(minTravel>=-1e-9,'Body progression never reverses');
  assert(rightLift>.08*scale&&leftLift>.08*scale,'Both articulated contacts make a clear long stride');
  assert(maxRightDrift<1e-8&&maxLeftDrift<1e-8,'Each planted hand remains fixed during support');
  assert(maxPitch<.02,'The torso remains centered around its neutral pitch');
  api.lavaMonsterMovers.delete(mover);root.parent.remove(root);
}
console.log('Juggernaut IV–VII: stable torso, continuous body travel, alternating long reaches and firm plants OK');

// Exercise the full animation loop: idle must not overwrite turn articulation.
for (const form of [1, 2, 3, 4, 5, 6, 7]) {
  for (const direction of [-1, 1]) {
    const root = api.createBattleBroCharacter({character:'monsters',form});
    api.worldGroup.add(root);
    root.position.set(3, 0, 3);
    const mover = api.registerLavaMonsterMover(root, 35, 35);
    root.userData.looseRocks.phase = 0; // Isolate anticipation from random idle head drift.
    mover.desiredYaw = direction * 0.5;
    api.beginLavaTurn(mover, 0, mover.desiredYaw);
    for (let frame = 0; frame < 12; frame++) api.tickLavaMonsterMovers(frame / 60, 1 / 60);
    const upper = root.userData.rig;
    assert.equal(root.rotation.y, 0, 'Supports wait for the reaching contact');
    assert(mover.parts.torso.rotation.y * direction > 0, 'Hips lead before lower rotation');
    assert(upper.torso.rotation.y * direction > 0.01, 'Chest leads the lower body');
    assert(upper.head.rotation.y * direction > 0.04, 'Head leads the chest after idle');
    const secondIdleYaw=Math.sin((11/60)*.37+1.7)*.18;
    assert((upper.head2.rotation.y-secondIdleYaw)*direction>0.005, 'Second head still anticipates in both directions after idle');
    assert(Math.abs(mover.upperTurn.head2)<Math.abs(mover.upperTurn.head)*.7, 'Second head makes a slower, smaller anticipatory glance');
    assert(mover.upperTurn.head2Pitch>0, 'Second head adds its own subtle nod');
    for (let frame = 12; mover.state === 'TURNING' && frame < 200; frame++) {
      api.tickLavaMonsterMovers(frame / 60, 1 / 60);
    }
    assert.equal(mover.state, 'JUGGERNAUT_STRIDE');
    assert(Math.abs(upper.torso.rotation.y) < 1e-8, 'Chest settles into alignment');
    assert(Math.abs(mover.parts.torso.rotation.y) < 1e-8, 'Core settles into alignment');
    assert(Math.abs(upper.leftUpperArm.shoulder.rotation.y) < 0.5, 'Shoulder follow-through stays bounded');
    api.lavaMonsterMovers.delete(mover);
    root.parent.remove(root);
  }
}
console.log('all Monster forms turning: head and chest lead planted supports, then settle in both directions OK');

// Shared semantic arm layer: idle, acceleration, turns, stopping and ownership.
const armResponses = {};
for (const form of [5, 6, 7]) {
  const root = api.createRockBattleBro({form});
  api.worldGroup.add(root);
  const mover = api.registerLavaMonsterMover(root, 32, 32);
  mover.pauseRemaining = 1000;
  api.tickUpperArmMotion(root, 0, 0, mover);
  const motion = root.userData.upperArmMotion;
  assert.equal(motion.arms.length, form === 5 ? 1 : 2);
  const first = motion.arms[0];
  const originalPositions = first.joints.map(j => j.position.clone());
  let previous = first.joints.map(j => j.quaternion.clone());
  const ranges = [0, 0, 0, 0];
  for (let frame = 0; frame < 720; frame++) {
    api.tickLavaMonsterMovers(frame / 60, 1 / 60);
    first.joints.forEach((joint, i) => {
      ranges[i] += previous[i].angleTo(joint.quaternion);
      previous[i].copy(joint.quaternion);
      assert(joint.position.distanceTo(originalPositions[i]) < 1e-10, 'No morphology changes');
    });
  }
  ranges.forEach((r, i) => assert(r > 0.05, `Form ${form} joint ${i} idle travel ${r}`));
  for (let frame = 0; frame < 60; frame++) {
    root.rotation.y += 0.012;
    root.position.z += 0.006;
    mover.parts.rig.position.x = 0.035;
    api.tickUpperArmMotion(root, 12 + frame / 60, 1 / 60, mover);
  }
  const trailing = Math.abs(first.follow[3].y);
  assert(trailing > 0.01, 'Hand responds to turning');
  armResponses[form] = Math.abs(first.follow[3].y / first.follow[0].y);
  for (let frame = 0; frame < 600; frame++) {
    mover.parts.rig.position.x = 0;
    api.tickUpperArmMotion(root, 13 + frame / 60, 1 / 60, mover);
  }
  assert(Math.abs(first.follow[3].y) < trailing * 0.08, 'Turn inertia settles after stopping');
  first.weight = 0;
  first.joints.forEach(j => j.rotation.set(0.4, -0.2, 0.1));
  const actionPose = first.joints.map(j => j.quaternion.clone());
  api.tickUpperArmMotion(root, 24, 1 / 60, mover);
  first.joints.forEach((j, i) => assert(j.quaternion.angleTo(actionPose[i]) < 1e-7, 'Action owns disabled arm'));
  first.weight = 0.25;
  api.tickUpperArmMotion(root, 24.02, 1 / 60, mover);
  assert(first.joints[0].quaternion.angleTo(actionPose[0]) > 0.001, 'Procedural pose blends back');
  api.lavaMonsterMovers.delete(mover);
  root.parent.remove(root);
}
assert(armResponses[7] < armResponses[6], 'Apex hand follows its shoulder more slowly than VI');
console.log('upper arms: living idle chains, inertia, settling, form tuning and action ownership OK');

for (const form of [5, 6, 7]) {
  const root = api.createRockBattleBro({form});
  api.worldGroup.add(root);
  const mover = api.registerLavaMonsterMover(root, 32, 32);
  mover.pauseRemaining = 1000;
  api.tickUpperArmMotion(root, 0, 0, mover);
  const motion = root.userData.upperArmMotion;
  for (const arm of motion.arms) {
    assert(api.triggerUpperArmClawGesture(root, arm.side));
    const duration = motion.gesture.duration;
    let raised = false, bent = false, pinched = false;
    for (let frame = 0; frame < Math.ceil((duration + 4) * 60); frame++) {
      api.tickLavaMonsterMovers(frame / 60, 1 / 60);
      raised ||= arm.joints[0].rotation.x < -0.35;
      bent ||= arm.joints[2].rotation.x < -0.75;
      pinched ||= arm.jaws.every(jaw => jaw.joint.rotation.z * jaw.side < -0.08);
    }
    assert(raised && bent && pinched, `Form ${form} side ${arm.side} lifts, curls and pinches`);
    assert.equal(motion.gesture, null);
    assert(arm.joints[0].rotation.x > -0.20, 'Raised shoulder returns to rest');
    assert(arm.joints[2].rotation.x > -0.50, 'Elbow relaxes after gesture');
    assert(arm.jaws.every(jaw => jaw.joint.rotation.z * jaw.side > -0.03), 'Claws reopen');
  }
  api.lavaMonsterMovers.delete(mover);
  root.parent.remove(root);
}
console.log('claw gesture: V–VII, both available arms, raise/bend/pinch/reopen/settle OK');

// External debris uses a stable sibling frame, even across turn-state edges.
for (const form of [2, 3, 4, 5, 6, 7]) {
  const root = api.createRockBattleBro({form});
  root.position.set(2, 0.4, -3);
  root.rotation.y = 0.7;
  api.worldGroup.add(root);
  api.tickBattleBroOrbitField(root, 0);
  const controller = root.userData.looseRocks;
  const field = controller.orbitField;
  assert.equal(field.parent, root.parent);
  const parents = controller.debris.map(p => p.node.parent);
  const positions = controller.debris.map(p => p.node.getWorldPosition(new THREE.Vector3()));
  const phases = controller.debris.map(p => p.orbitPhase);
  for (const heading of [Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI, Math.PI / 2, -Math.PI / 2, 0]) {
    root.rotation.y = heading;
    root.userData.rig.torso && (root.userData.rig.torso.rotation.y = heading * 0.2);
    api.tickBattleBroOrbitField(root, 0);
    controller.debris.forEach((p, i) => {
      assert(p.node.getWorldPosition(new THREE.Vector3()).distanceTo(positions[i]) < 1e-8, `Form ${form}: heading cannot move debris`);
      assert.equal(p.orbitPhase, phases[i], 'Heading cannot offset phase');
      assert.equal(p.node.parent, parents[i], 'No reparenting during turns');
    });
  }
  const initial = controller.debris.map(p => p.orbitPhase);
  let previousCenter = root.position.clone();
  for (let frame = 0; frame < 600; frame++) {
    const elapsed = (frame + 1) / 60;
    root.rotation.y = Math.sin(elapsed * 2) * Math.PI;
    // Stand, move while turning, stop, then resume: translation is independent.
    if ((frame > 90 && frame < 300) || frame > 420) root.position.add(new THREE.Vector3(0.003, 0.0005, -0.002));
    api.tickBattleBroOrbitField(root, 1 / 60);
    const translation = root.position.clone().sub(previousCenter);
    assert(field.position.distanceTo(root.position) < 1e-10, 'Field center follows XYZ translation');
    controller.debris.forEach((p, i) => {
      const current = p.node.getWorldPosition(new THREE.Vector3());
      assert(current.clone().sub(positions[i]).sub(translation).length() < 0.015, 'No jump at turn/start/stop boundaries');
      assert(Math.abs(p.orbitPhase - initial[i] - elapsed * p.speed) < 1e-10, 'Persistent phase follows elapsed time only');
      positions[i].copy(current);
    });
    previousCenter.copy(root.position);
  }
  root.visible = false;
  api.tickBattleBroOrbitField(root, 0);
  assert.equal(field.visible, false);
  api.worldGroup.remove(root);
  assert.equal(field.parent, null, 'Removing character removes external field');
  api.worldGroup.add(root);
  assert.equal(field.parent, root.parent, 'Reattaching character restores its field');
  controller.debris.forEach((p,i) => assert.equal(p.node.parent, parents[i]));
  api.worldGroup.remove(root);
}
console.log('orbits: independent heading, 45/90/180/alternating turns, XYZ start/stop translation, phase continuity and lifecycle OK');

for (let form = 1; form <= 7; form++) {
  const root = api.createRockBattleBro({form});
  api.worldGroup.add(root);
  const mover = api.registerLavaMonsterMover(root, 32, 32);
  mover.pauseRemaining = 1000;
  const face = root.userData.slots.face;
  const eyePosition = root.userData.rig.leftEye.position.clone();
  const originalBrow = face.getObjectByName('lavaLeftBrow').rotation.z;
  const material = face.getObjectByName('lavaLeftEye').material;
  let geometryCount;
  for (const name of Object.keys(api.BATTLEBRO_EXPRESSIONS)) {
    assert(api.setBattleBroExpression(root, name));
    const state = face.userData.expression;
    const before = state.pose.slice();
    api.tickBattleBroExpression(root, 1 / 60);
    if (name !== 'neutral') assert.notDeepEqual(state.pose, state.target, 'Transition does not snap');
    for (let frame = 0; frame < 20; frame++) api.tickLavaMonsterMovers(frame / 60, 1 / 60);
    state.pose.forEach((value, i) => assert(Math.abs(value - state.target[i]) < 1e-10, 'Expression reaches its target'));
    assert(root.userData.rig.leftEye.position.equals(eyePosition), 'Eye placement stays fixed');
    assert.equal(state.eyes[0].material, material, 'Shared eye material stays unchanged');
    assert.equal(state.tears[0].visible, name === 'crying');
    assert.equal(state.mouth.visible, name !== 'neutral');
    if (geometryCount === undefined) geometryCount = face.children.length;
    assert.equal(face.children.length, geometryCount, 'Expression changes reuse geometry');
  }
  api.setBattleBroExpression(root, 'crying', {immediate:true});
  api.tickBattleBroExpression(root, 0.05);
  api.setBattleBroExpression(root, 'neutral');
  for (let i = 0; i < 20; i++) api.tickBattleBroExpression(root, 1 / 60);
  const state = face.userData.expression;
  assert.equal(state.tearTime, 0);
  assert.equal(state.tears[0].visible, false);
  assert.equal(state.brows[0].rotation.z, originalBrow);
  assert(state.eyes[0].scale.equals(new THREE.Vector3(1,1,1)));
  assert(state.originalMouth.every(mesh => mesh.visible && mesh.scale.y === 1));
  assert.throws(() => api.setBattleBroExpression(root, 'invalidExpression'));
  api.lavaMonsterMovers.delete(mover);
  root.parent.remove(root);
}
console.log('expressions: all eight poses across I–VII, transitions, shared materials, geometry reuse and neutral/tear reset OK');

for (let form = 1; form <= 7; form++) {
  const root = api.createRockBattleBro({form});
  api.worldGroup.add(root);
  const mover = api.registerLavaMonsterMover(root,32,32);
  mover.pauseRemaining = 1000;
  api.tickLavaMonsterMovers(100, 1 / 60);
  const face = root.userData.slots.face.userData.expression;
  assert(face && face.name !== 'neutral', 'Normal-world character starts visibly expressive without preview');
  const visited = new Set([face.name]);
  for (let i = 0; i < 8; i++) {
    api.tickLavaMonsterMovers(root.userData.expressionCycle.nextAt + 0.01, 1 / 60);
    visited.add(face.name);
  }
  assert.equal(visited.size, 8, 'Normal-world cycle visits all expressions');
  api.setBattleBroExpression(root, 'sad');
  api.tickLavaMonsterMovers(1000, 1 / 60);
  assert.equal(face.name,'sad','Explicit expression takes ownership from ambient cycle');
  api.lavaMonsterMovers.delete(mover);
  root.parent.remove(root);
}
console.log('world expressions: all seven Lava forms cycle all eight faces without URL flags or preview UI OK');

// Exercise grid contacts independently of random roaming, including the entire
// swept footprint rather than just the zero-width target at touchdown.
api.setBlocked([]);
api.lavaMonsterMovers.clear();
for (const form of [1, 4, 6, 7]) {
  for (const scenario of ['flat', 'up', 'down', 'diagonal', 'neighbor', 'narrow']) {
    const heights = [];
    for (let x = 25; x < 40; x++) for (let z = 25; z < 40; z++) {
      let h = scenario === 'up' ? (z >= 33 ? 0.2 : 0)
        : scenario === 'down' ? (z < 33 ? 0.2 : 0)
        : scenario === 'diagonal' ? (x + z >= 67 ? 0.2 : 0)
        : scenario === 'neighbor' ? (x === 34 ? 0.6 : 0)
        : scenario === 'narrow' ? (x !== 32 ? 1.2 : 0) : 0;
      heights.push([x + ',' + z, h]);
    }
    api.setTerrainHeights(heights);
    const root = api.createRockBattleBro({variant: 'lava', form});
    root.position.set(0.5, scenario === 'down' ? 0.2 : 0, 0.5);
    api.worldGroup.add(root);
    const mover = api.registerLavaMonsterMover(root, 32, 32);
    const plan = api.planLavaTerrainMove(mover, 32, 33);
    if (scenario === 'narrow' && form >= 4) assert.equal(plan, null, 'Oversize supports reject a narrow corridor');
    else {
      assert(plan, `Form ${form} ${scenario}: usable landing plan`);
      for (const swing of [...plan.turn.plans.flat(), ...plan.swings]) {
        const e = api.lavaContactExtent(mover, swing.index, swing.yaw);
        const end = swing.end;
        assert(Number.isFinite(api.lavaTerrainRectangle(end.x + e.x - e.hx, end.x + e.x + e.hx,
          end.z + e.z - e.hz, end.z + e.z + e.hz, end.y)), `Form ${form} ${scenario}: complete supported footprint`);
        // Translation swings retain their heading; turning footprint is checked
        // separately by the planner's expanded swept bounds.
        if (!plan.swings.includes(swing)) continue;
        const point = new THREE.Vector3();
        for (let frame = 0; frame <= 100; frame++) {
          api.sampleLavaContactSwing(point, swing, frame / 100);
          const top = api.lavaTerrainRectangle(point.x + e.x - e.hx, point.x + e.x + e.hx,
            point.z + e.z - e.hz, point.z + e.z + e.hz);
          assert(point.y >= top - 1e-8, `Form ${form} ${scenario}: swing clears walls at ${frame}`);
        }
      }
    }
    if (scenario === 'neighbor') {
      for (const angle of [Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const turn = api.planLavaTerrainTurn(mover, angle);
        // Conservative rejection is allowed when a complete turn has no safe stance.
        if (turn) for (const swing of turn.plans.flat()) assert(swing.clearance >= Math.max(swing.start.y, swing.end.y));
      }
    }
    api.lavaMonsterMovers.delete(mover);
    api.worldGroup.remove(root);
  }
}
api.setTerrainHeights([]);
console.log('terrain contacts: Forms I/IV/VI/VII flat, up/down, diagonal, neighboring wall, narrow rejection and swept footprints OK');
for (const form of [1, 4, 6, 7]) for (const down of [false, true]) {
  api.lavaMonsterMovers.clear();
  api.setTerrainHeights(Array.from({length: 16 * 16}, (_, i) => {
    const x = 24 + i % 16, z = 24 + Math.floor(i / 16);
    return [x + ',' + z, (down ? z < 33 : z >= 33) ? 0.2 : 0];
  }));
  const root = api.createRockBattleBro({variant:'lava', form});
  root.position.set(0.5, down ? 0.2 : 0, 0.5);
  api.worldGroup.add(root);
  const mover = api.registerLavaMonsterMover(root,32,32);
  mover.pauseRemaining = 0;
  const random = seededMath.random;
  seededMath.random = () => 0.6; // Select +Z through the normal world update.
  let moved = false, finished = false, previousY = root.position.y;
  for (let frame = 0; frame < 900; frame++) {
    api.tickLavaMonsterMovers(frame / 60, 1 / 60);
    assert(Math.abs(root.position.y - previousY) < 0.025, `Form ${form}: no vertical snap`);
    previousY = root.position.y;
    moved ||= mover.state !== 'IDLE';
    const anchors = mover.anchors || [mover.leftAnchor, mover.rightAnchor];
    root.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const node = form < 4 ? mover.parts.limbs[i] : mover.parts[i ? 'rightArm' : 'leftArm'].hand;
      const expected = anchors[i].clone(); expected.y += mover.terrainContacts[i].sole;
      assert(node.getWorldPosition(new THREE.Vector3()).distanceTo(expected) < 1e-6,
        `Form ${form} ${mover.state}: rendered contact follows its terrain target`);
    }
    if (moved && mover.state === 'IDLE') { finished = true; break; }
  }
  seededMath.random = random;
  assert(finished && mover.cellZ === 33, `Form ${form}: completes ${down ? 'down' : 'up'} step`);
  api.worldGroup.remove(root);
}
api.lavaMonsterMovers.clear(); api.setTerrainHeights([]);
console.log('terrain runtime: rendered supports match targets, smooth body height and completed up/down steps across I/IV/VI/VII OK');
// A wall directly overlaps the proposed footprint although its center is on
// the low cell. Correction must move the whole support away from that wall.
for (const form of [1, 4, 6, 7]) {
  api.setTerrainHeights([]);
  const root = api.createRockBattleBro({variant:'lava',form});
  root.position.set(.5,0,.5); api.worldGroup.add(root);
  const mover = api.registerLavaMonsterMover(root,32,32);
  api.setTerrainHeights(Array.from({length:9},(_,i)=>['33,'+(28+i),1.2]));
  const desired = new THREE.Vector3(.95,0,.5);
  const safe = api.safeLavaContact(mover,desired,0,0,0);
  assert(safe, `Form ${form}: can inset away from adjacent high wall`);
  const e = api.lavaContactExtent(mover,0,0);
  assert(safe.x + e.x + e.hx < 1, `Form ${form}: visible side-wall separation`);
  assert.equal(safe.y,0,'Correction preserves intended low support surface');
  api.lavaMonsterMovers.delete(mover); api.worldGroup.remove(root);
}
api.setTerrainHeights([]);
console.log('neighbor clearance: overlapping contact footprints reposition onto the low surface with a visible wall margin OK');

// A tall wall leaves safe planted contacts but prevents their turning sweep.
// Escape must translate backwards first, then use the ordinary checked turn.
for (const form of [4, 6, 7]) {
  api.lavaMonsterMovers.clear(); api.setBlocked([]);
  api.setTerrainHeights(Array.from({length:9},(_,i)=>[(28+i)+',33',1.2]));
  const root = api.createRockBattleBro({variant:'lava',form});
  root.position.set(.5,0,.5); api.worldGroup.add(root);
  const mover = api.registerLavaMonsterMover(root,32,32);
  assert.equal(api.selectLavaWalkRoute(mover),null,'First blocked search waits');
  mover.stationaryFor = 4; mover.traversalClock = 4;
  const route = api.selectLavaWalkRoute(mover);
  assert(route?.reverse, `Form ${form}: repeated obstruction selects backup`);
  assert.equal(route.yaw,0); assert.equal(route.z,31);
  assert.equal(route.plan.turn.plans.length,0,'Backup does not turn against the wall');
  mover.recoveryExit = null; mover.recoveryAfter = 0; mover.blockedAttempts = 1; mover.pauseRemaining = 0;
  let backed = false, turned = false, escaped = false;
  for (let frame=0; frame<2400; frame++) {
    api.tickLavaMonsterMovers(frame/60,1/60);
    if (!backed) assert(Math.abs(root.rotation.y)<1e-6,'Facing stays fixed during retreat');
    if (mover.cellZ===31) backed=true;
    if (backed && mover.state==='TURNING') turned=true;
    if (backed && (mover.cellX!==32 || mover.cellZ!==31)) { escaped=true; break; }
  }
  assert(backed && turned && escaped, `Form ${form}: backs up, turns, and resumes walking`);
  api.lavaMonsterMovers.delete(mover); api.worldGroup.remove(root);
}
api.lavaMonsterMovers.clear(); api.setTerrainHeights([]); api.setBlocked([]);
{
  const root=api.createRockBattleBro({variant:'lava',form:7});
  root.position.set(.5,0,.5); api.worldGroup.add(root);
  const mover=api.registerLavaMonsterMover(root,32,32);
  assert(!api.selectLavaWalkRoute(mover).reverse,'Flat ground uses normal walking');
  api.setBlocked(['31,32','33,32','32,31','32,33']);
  for(let i=0;i<6;i++) assert.equal(api.selectLavaWalkRoute(mover),null,'No unsafe escape from enclosure');
  assert.equal(mover.recoveryExit,null);
  api.lavaMonsterMovers.delete(mover); api.worldGroup.remove(root);
}
api.setBlocked([]); api.setTerrainHeights([]);
console.log('blocked recovery: checked backup, fixed facing, turn-and-walk exit, flat ground and enclosed terrain OK');
