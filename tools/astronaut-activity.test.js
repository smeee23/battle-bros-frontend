const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../vendor/three/three.r128.min.js');
const html = fs.readFileSync('index.html', 'utf8');
const source = html.slice(html.indexOf('  const astronautCapacity ='), html.indexOf('  function persistCrowdSettings()'));
const material = new THREE.MeshLambertMaterial();
const vehicle = { visualScale: .4, x: 0, z: 0, angle: 0, speed: 0, path: [], activityDwellDuration: 8, activityDwellRemaining: 6 };
const context = vm.createContext({ THREE, Math, Number,
  M: { habitatShell: material, habitatBand: material, habitatPanel: material, habitatTrim: material, habitatWindow: material },
  getBoxGeometry: (w, h, d) => new THREE.BoxGeometry(w, h, d), worldGroup: new THREE.Group(),
  vehicleFleet: new Map([['test', vehicle]]), buildingWindowObjects: new Set(),
  fp: { active: false }, crowdPaused: false, crowdCount: 20, activityVehiclesAllowed: () => true,
  isActivityVehicle: () => true, vehicleCellFromWorld: () => ({ inside: true, cellX: 1, cellZ: 1 }),
  isVehicleTraversableCell: () => true, isCellInHomeRenderWindow: () => true,
  vehicleRoadHeightAtCell: () => 0, getWorldCell: () => ({ kind: 'house', buildingType: 'habitat' }),
  terrainRiseAt: () => 0, tilePos: (x, z) => ({ x, z }), cellRand: () => 0,
  vehicleVisualScaleForGrid: () => .4,
});
vm.runInContext(html.slice(html.indexOf('  function addSlidingBuildingDoor('), html.indexOf('  // Space habitat —')), context);
vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);
run('tickAstronauts(0)');
assert.equal(run('astronautParts[0].mesh.count'), 2, 'two crew outside during dwell');
assert.equal(context.worldGroup.children.length, 8, 'shared instancing bounds draw calls');
assert.ok(run('astronautParts[1].mesh.instanceMatrix.array[0]') < .06, 'helmet stays tiny relative to car');
vehicle.activityDwellRemaining = 0;
run('tickAstronauts(0)');
assert.equal(run('astronautParts[0].mesh.count'), 0, 'crew board before departure');
vehicle.activityDwellRemaining = 6;
vehicle.path = [{}];
run('tickAstronauts(0)');
assert.equal(run('astronautParts[0].mesh.count'), 0, 'no crew while driving');
vehicle.path = [];
context.isCellInHomeRenderWindow = () => false;
run('tickAstronauts(0)');
assert.equal(run('astronautParts[0].mesh.count'), 0, 'render window culls crew');
context.isCellInHomeRenderWindow = () => true;
context.vehicleFleet.clear();
for (let i = 0; i < 60; i++) {
  const building = new THREE.Group();
  building.userData = { gx: i, gz: 0, baseY: 0 };
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(.2, .24, .035), material);
  hatch.position.set(.6, .2, .12);
  hatch.rotation.y = Math.PI / 2;
  const pane = new THREE.Mesh(hatch.geometry, material);
  building.add(hatch, pane);
  context.building = building;
  context.hatch = hatch;
  context.pane = pane;
  run('addSlidingBuildingDoor(building, hatch, pane)');
  context.worldGroup.add(building);
  context.buildingWindowObjects.add(building);
}
run('astronautClock = .6; tickAstronauts(0)');
assert.equal(run('astronautParts[0].mesh.count'), 0, 'door opens before workers emerge');
const firstDoor = [...context.buildingWindowObjects][0].userData.slidingDoor;
assert.ok(firstDoor.leaves[1].position.x > .14, 'panels slide apart');
run('astronautClock = 5; tickAstronauts(0)');
assert.equal(run('astronautParts[0].mesh.count'), 48, 'building activity respects pool cap');
assert.ok(run('astronautParts[0].mesh.instanceMatrix.array[12]') > 1.2, 'habitat crew follow east-facing door transform');
assert.equal(firstDoor.leaves[1].position.x, .05, 'door closes while crew work');
run('astronautClock = 18; tickAstronauts(0)');
assert.ok(firstDoor.leaves[1].position.x > .14, 'door reopens for returning crew');
run('astronautClock = 22; tickAstronauts(0)');
assert.equal(run('astronautParts[0].mesh.count'), 0, 'workers disappear inside after return');
assert.equal(firstDoor.leaves[1].position.x, .05, 'door closes after return');
context.buildingWindowObjects.clear();
run('tickAstronauts(0)');
assert.equal(run('astronautParts[0].mesh.count'), 0, 'removed buildings leave no crew');
console.log('astronaut activity: dwell, departure, driving, scale, render window, pool cap and cleanup OK');
