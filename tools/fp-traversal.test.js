'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const source = html.slice(html.indexOf('  function moveFPAcrossTerrain('), html.indexOf('  function enterFP('));
function setup(height, limit = 0.4) {
  const fp = {pos: {x: 0.5, z: 0.5, y: height(0,0) + 0.6}, grounded: true};
  const context = vm.createContext({fp, FP_MAX_HEIGHT_DIFFERENCE: limit, FP_WALL_CLEARANCE: 0.08,
    fpGroundYAt: (x,z) => height(Math.floor(x), Math.floor(z)) + 0.6});
  vm.runInContext(source, context);
  return {fp, move: context.moveFPAcrossTerrain};
}
const allowed = setup(x => x > 0 ? 0.4 : 0);
allowed.move(1, 0);
assert(Math.abs(allowed.fp.pos.x - 1.5) < 1e-9, 'Walking threshold is inclusive');
const blocked = setup(x => x > 0 ? 1 : 0);
blocked.move(1, 1);
assert(Math.abs(blocked.fp.pos.x - 0.92) < 0.00001, 'Stop at the configured wall clearance');
assert(Math.abs(blocked.fp.pos.z - 1.5) < 1e-9, 'Slide along a blocked edge');
const stoppedX = blocked.fp.pos.x;
blocked.move(1, 0);
assert(Math.abs(blocked.fp.pos.x - stoppedX) < 1e-9, 'Repeated input cannot creep into wall');
blocked.move(-0.2, 0);
assert(blocked.fp.pos.x < stoppedX - 0.19, 'Can retreat from wall');
blocked.move(0.2, 0);
blocked.fp.grounded = false;
blocked.fp.pos.y = 1.59;
blocked.move(1, 0);
assert(blocked.fp.pos.x < 1, 'Jump below ledge height remains blocked');
blocked.fp.pos.y = 1.6;
blocked.move(1, 0);
assert(blocked.fp.pos.x > 1, 'Jump clears ledge when feet reach its top');
const drop = setup(x => x > 0 ? -5 : 0);
drop.move(1, 0);
assert(drop.fp.pos.x > 1, 'Walking off large drops is allowed');
const reverse = setup(x => x < 0 ? 2 : 0);
reverse.move(-1, 0);
assert(Math.abs(reverse.fp.pos.x - 0.08) < 0.00001, 'Approach negative-facing wall precisely');
const barrier = setup(x => x === 1 ? 2 : 0);
barrier.move(5, 0);
assert(barrier.fp.pos.x < 1, 'Long frames cannot skip a narrow barrier');
const corner = setup((x,z) => x === z ? 0 : 2);
corner.move(1, 1);
assert(corner.fp.pos.x < 1 && corner.fp.pos.z < 1, 'Cannot cut diagonally through blocked corners');
const adjusted = setup(x => x > 0 ? 0.6 : 0, 0.8);
adjusted.move(1, 0);
assert(adjusted.fp.pos.x > 1, 'Increasing the setting permits taller steps');
// Exercise actual movement/gravity together using the camera test's fixture.
const fixture = fs.readFileSync('tools/fp-camera.test.js', 'utf8').split('// Ground height matches')[0];
const {setup: cameraSetup, run} = new Function('require', fixture + '\nreturn {setup, run};')(require);
for (const hz of [20, 60, 120]) {
  const falling = cameraSetup((_,z) => z < 10 ? 1 : 6);
  falling.fpKeys.add('w');
  run(falling, 0.5, hz);
  assert(falling.fp.pos.z < 0 && !falling.fp.grounded, 'Walking over a drop starts falling');
  run(falling, 3, hz);
  assert(falling.fp.grounded, 'Player lands on lower terrain');
  const jumping = cameraSetup((_,z) => z < 10 ? 11 : 1);
  jumping.fpKeys.add('w');
  run(jumping, 1, hz);
  assert(Math.abs(jumping.fp.pos.z - 0.08) < 0.00001, 'Walking stops at the ledge');
  jumping.jump();
  run(jumping, 1, hz);
  assert(jumping.fp.pos.z < 0, 'A sufficiently high jump crosses the ledge');
  jumping.fpKeys.clear();
  run(jumping, 10, hz);
  assert(jumping.fp.grounded && Math.abs(jumping.fp.pos.y - jumping.fpGroundYAt(jumping.fp.pos.x, jumping.fp.pos.z)) < 1e-9,
    'Jump lands on the higher terrain');
}
console.log('first-person traversal: height limits, sliding, jumping, corners and long frames OK');
