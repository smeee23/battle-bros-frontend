'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../vendor/three/three.r128.min.js');
const html = fs.readFileSync('index.html', 'utf8');
const section = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const noop = () => {};
const world = [];
const empty = () => ({terrain: 'stone', terrainFloors: 1, floors: 1, kind: null, extras: []});
const getWorldCell = (x,z) => world[x]?.[z] || empty();
const materials = Object.fromEntries(['habitatShell','habitatTrim','habitatBand','habitatWindow','greenhouseGlass','step'].map(k => [k, new THREE.MeshLambertMaterial()]));
const context = vm.createContext({ THREE, world, GRID: 20, M: {...materials,stone:materials.habitatTrim,stoneDk:materials.habitatBand},
  worldGroup:new THREE.Group(), tilePos:(x,z)=>({x:x-9.5,z:z-9.5}), BUILDABLE_LAND_Y_OFFSET:0, TOP_H:.18, terrainRiseForLevel:level=>(level-1)*.2, disposeGroup:noop,
  getBoxGeometry: (w,h,d) => new THREE.BoxGeometry(w,h,d), geomCache: new Map(), castReceive: noop,
  getWorldCell, ensureWorldCell: (x,z) => { world[x] ||= []; return world[x][z] ||= empty(); },
  terrainLevelForCell: c => c?.terrainFloors || 1,
  terrainConsumeLocks: new Map(), neighborInspectionState: {active: false}, setCellMutationAuthority: 'test',
  BASE_TERRAIN: 'stone', MAX_TERRAIN_FLOORS: 64, MAX_FLOORS: 8, AIR_COMMAND_MAX_LEVEL: 8,
  CROP_KINDS: new Set(), isGenerationPlantKind: () => false,
  normalizeBuildingType: x => x || null, normalizeAppearance: x => x ? {...x} : null,
  sameAppearance: (a,b) => JSON.stringify(a) === JSON.stringify(b), tileLevelForCell: c => c.terrainFloors,
  borderOverlayState: () => '', cellMeshes: {}, isVehicleDrivableCell: c => !c.kind,
  refreshVehiclesForWorldObstacleChange: noop, isCropCell: () => false, isAirCommandCell: () => false,
  renderCellTile: noop, renderCellObject: noop, saveState: noop, suppressSave: true,
  bfsHouseCluster: (x,z) => [{x,z}], updateCarriageAfterChange: noop,
});
vm.runInContext(section('  function roundedBox(', '  // -------- materials --------')
  + section('  const TRAINING_CENTER_HEIGHT =', '  function addSlidingBuildingDoor(')
  + section('  function makeVoxelSkyscraper(', '  function makeVoxelTree(')
  + section('  function trainingFacilityLayout(', '  function generateProceduralWorld(')
  + section('  function setCell(x, z, opts)', '  // Cinderella rule:')
  + section('  const TRAINING_GROUND_SIDE_SPREAD =', '  async function generateWorld(')
  + '\nthis.api = {makeSkyscraper, makeVoxelSkyscraper, trainingFacilityLayout, trainingFacilityOccupiesCell, syncTrainingFacility, setCell};', context);
const api = context.api;
for (const make of [api.makeSkyscraper, api.makeVoxelSkyscraper]) {
  const first = make(1), last = make(8);
  const box = new THREE.Box3().setFromObject(first), size = box.getSize(new THREE.Vector3());
  assert(size.x > 4.5 && size.x <= 5 && size.z > 4.4 && size.z <= 5, 'Fits a true five-cell plot');
  assert(Math.abs(box.max.y - 1.85) < 1e-6, 'Fixed old level-six shell and clean roof cap');
  assert.deepEqual(new THREE.Box3().setFromObject(last), box, 'Levels never resize the facility');
  const shell = first.children.find(m => m.material === materials.habitatShell);
  const walls = new THREE.Box3().setFromObject(shell);
  assert(walls.min.y <= 0.001 && walls.max.y < 1.83, 'Real extruded walls span ground through level six');
  for (const band of first.children.filter(m => m.material === materials.greenhouseGlass)) {
    const glass = new THREE.Box3().setFromObject(band);
    assert(glass.min.x < walls.min.x || glass.max.x > walls.max.x || glass.min.z < walls.min.z || glass.max.z > walls.max.z,
      'Plasma remains outside the beveled wall surface');
  }
  assert(first.children.some(m => m.geometry?.parameters.width === 2 && m.geometry?.parameters.height === 1.48), 'Large hangar entrance');
}
const root = context.worldGroup;
api.syncTrainingFacility();
assert.equal(root.children.length,1,'One permanent fixture');
const facility = root.children[0];
assert.equal(facility.userData.permanentEnvironment,true);
assert.equal(facility.rotation.y,Math.PI/4,'Entrance faces inward');
assert.equal(facility.scale.x,4.5,'Landmark enlarged without redesign');
assert.equal(facility.getObjectByName('Training Center').children.find(m=>m.geometry?.parameters.width===2).geometry.parameters.height * facility.scale.y,6.66,'Door fits large Forms visually');
const box = new THREE.Box3().setFromObject(facility);
assert(box.min.x < -10 && box.min.z < -10,'Building extends beyond playable corner');
assert(box.min.y < -3 && box.max.y > 8,'Footing descends into island; building dominates skyline');
assert(api.trainingFacilityOccupiesCell(2,2));
assert(!api.trainingFacilityOccupiesCell(19,19));
api.syncTrainingFacility();
assert.equal(root.children.length,1,'Reset/reload does not duplicate landmark');
assert.equal(facility.parent,null,'Old instance removed cleanly');
assert(!html.includes("{ id: 'highrise',"),'Facility removed from build menu and its thumbnails');
console.log('training facility: real walls/plasma, unchanged design, enlarged door, border integration, reserved footprint and permanent lifecycle OK');

assert.equal(api.setCell(2,2,{terrain:'stone',kind:null}),false,'Player cannot erase or reshape the permanent foundation');
assert.equal(api.setCell(19,19,{terrain:'stone',kind:'house',buildingType:'skyscraper'}),false,'Cannot place another facility');
