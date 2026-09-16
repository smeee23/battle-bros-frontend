'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const source = html.slice(html.indexOf('  const FP_EYE_H ='), html.indexOf('  // ---------- first-person flight ----------'));
const terrainSource = html.slice(html.indexOf('  function terrainRiseForLevel('), html.indexOf('  function materialHex('));
function setup(floors) {
  class Vector3 {
    constructor(x, y, z) { this.set(x, y, z); }
    set(x, y, z) { Object.assign(this, {x, y, z}); }
    copy(v) { this.set(v.x, v.y, v.z); }
  }
  const camera = {near: .1, fov: 55, position: new Vector3(), lookAt(x,y,z) { this.look = {x,y,z}; }};
  const world = Array.from({length: 20}, (_, x) => Array.from({length: 20}, (_, z) => ({terrainFloors: floors(x,z)})));
  const handlers = {};
  const context = vm.createContext({THREE: {Vector3}, TOP_H: .18, BUILDABLE_LAND_Y_OFFSET: -.18, MAX_TERRAIN_FLOORS: 64, GRID: 20, world, getWorldCell: (x,z) => world[x]?.[z], persCam: camera,
    document: {addEventListener() {}}, window: {addEventListener(name, fn) { handlers[name] = fn; }}, markCameraMoving() {}});
  vm.runInContext(terrainSource + source + '\nthis.api = {fp, fpKeys, tickFP, fpGroundYAt, FP_TERRAIN_LIFT_MAX};', context);
  const api = context.api;
  api.fp.active = true;
  api.fp.pos.set(.5, api.fpGroundYAt(.5,.5), .5);
  return {...api, camera, world, jump() { handlers.keydown({code: 'Space', preventDefault() {}}); }};
}
function run(a, seconds, hz = 60) { for (let i=0; i<seconds*hz; i++) a.tickFP(1/hz); }
// Ground height matches rendered tile tops, including legacy cells and capped levels.
for (const [cell, expected] of [
  [{terrainFloors:1}, .3], [{terrainFloors:2}, .5], [{terrainFloors:5}, 1.1],
  [{terrainFloors:64}, 12.9], [{terrainFloors:100}, 12.9],
  [{floors:5}, 1.1], [{kind:'house',floors:5}, .3],
]) {
  const a=setup(()=>1);a.world[10][10]=cell;
  assert(Math.abs(a.fpGroundYAt(.5,.5)-expected)<1e-12,'Eye stays 0.3 above rendered terrain');
  assert.equal(a.fpGroundYAt(100,100),.3,'Missing terrain uses base height');
}
for (const floors of [() => 1, (_,z) => z < 10 ? 2 : 1]) {
  const a = setup(floors); run(a, 2);
  assert.equal(a.fp.terrainLift, 0, 'Flat ground and single floors preserve eye height');
}
for (const descending of [false,true]) {
  const a = setup((_,z) => (z < 10) !== descending ? 5 : 1);
  const originalY = a.fp.pos.y;
  a.fp.pitch = .4;
  run(a, 1);
  assert(a.fp.terrainLift > 0 && a.fp.terrainLift <= a.FP_TERRAIN_LIFT_MAX, 'Anticipates either slope before crossing');
  assert.equal(a.fp.pos.y, originalY, 'Visual lift does not move the physical eye position');
  assert(Math.abs(a.camera.look.y - a.camera.position.y - Math.sin(.4)) < 1e-12, 'Preserves look pitch');
  a.fp.yaw = Math.PI;
  run(a, 3);
  assert(a.fp.terrainLift < 1e-6, 'Returns to normal facing flat terrain');
}
const a = setup((_,z) => z < 10 ? 5 : 1);
const b = setup((_,z) => z < 10 ? 5 : 1);
run(a, 1, 30); run(b, 1, 120);
assert(Math.abs(a.fp.terrainLift - b.fp.terrainLift) < 1e-12, 'Frame-rate independent smoothing');
for (const hz of [20, 30, 60, 120]) {
  const jumper = setup(() => 1);
  const ground = jumper.fp.pos.y;
  jumper.jump();
  const launch = jumper.fp.vy;
  jumper.jump();
  assert.equal(jumper.fp.vy, launch, 'No midair jump');
  let peak = 0, elapsed = 0;
  while (!jumper.fp.grounded && elapsed < 5) {
    jumper.tickFP(1/hz);
    elapsed += 1/hz;
    peak = Math.max(peak, jumper.fp.pos.y - ground);
  }
  assert(launch < 2, 'Gentler upward launch');
  assert(Math.abs(peak - 1.805) < .002, 'Preserves low-gravity jump height across frame rates');
  assert(elapsed >= 3.8 - 1e-9 && elapsed <= 3.8 + 1/hz + 1e-9, 'Preserves 3.8-second low-gravity airtime');
  assert.equal(jumper.fp.pos.y, ground, 'Lands exactly on terrain');
  run(jumper, .1, hz);
  assert(jumper.camera.position.y < ground && jumper.camera.position.y >= ground - .01, 'Restrained landing compression');
  run(jumper, .3, hz);
  assert.equal(jumper.camera.position.y, ground, 'Landing camera fully recovers');
  jumper.fpKeys.add('w');
  run(jumper, .5, hz);
  assert(Math.abs(jumper.fp.pos.z - (.5 - .7)) < 1e-12, 'Walking speed remains responsive');
  jumper.jump();
  jumper.fpKeys.clear();
  const stoppedZ = jumper.fp.pos.z;
  run(jumper, .2, hz);
  assert.equal(jumper.fp.pos.z, stoppedZ, 'Releasing movement in air does not slide');
}
const drop = setup((_,z) => z < 10 ? 1 : 5);
drop.fpKeys.add('w');
run(drop, .4);
assert(!drop.fp.grounded && drop.fp.pos.y > .9, 'Walking off a large ledge starts a gradual fall');
run(drop, 1.5);
assert(drop.fp.grounded && drop.fp.pos.y === drop.fpGroundYAt(drop.fp.pos.x, drop.fp.pos.z), 'Ledge fall lands reliably');
const terrace = setup((_,z) => z < 10 ? 1 : 3);
terrace.fpKeys.add('w');
run(terrace, .4);
assert(!terrace.fp.grounded, 'Two-floor terrace drops now use low gravity');
const edge = setup(() => 5);
edge.fp.pos.set(.5, edge.fpGroundYAt(.5,-9.7), -9.7);
run(edge, 1);
assert.equal(edge.fp.terrainLift, 0, 'World edge does not create a false drop');
console.log('first-person camera: flat ground, slope anticipation, lift cap, look controls, recovery, smoothing, gravity and bounds OK');
