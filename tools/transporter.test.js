'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../vendor/three/three.r128.min.js');
const html = fs.readFileSync('index.html', 'utf8');
function fn(name) {
  const start = html.indexOf('  function ' + name + '(');
  assert(start >= 0, name);
  return html.slice(start, html.indexOf('\n  }', start) + 4);
}
const geomCache = new Map();
const M = Object.fromEntries(['habitatTrim','habitatBand','habitatShell','habitatWindow','habitatPanel','habitatLight','greenhouseGlass']
  .map(name => [name, new THREE.MeshLambertMaterial()]));
let rejected = 0, spent = 0, placed = 0;
const context = vm.createContext({THREE, geomCache, M,
  getBoxGeometry: (w,h,d) => {
    const key = [w,h,d].join(',');
    if (!geomCache.has(key)) geomCache.set(key, new THREE.BoxGeometry(w,h,d));
    return geomCache.get(key);
  }, castReceive() {}, isGenerationPlantKind: () => false, isTrainingCenter: () => false, maxFloorsForKind: () => 8,
  AIR_COMMAND_MAX_LEVEL: 6, BATTLEBROS_MIGRATION_MODE: true,
  rejectMockResourceMaxLevelAction: () => rejected++,
  trySpendMockResourcesForPlacement: () => { spent++; return true; },
  setCell: () => placed++, playMockResourcePlacementSuccess() {},
});
for (const name of ['roundedBox','makeTransporter','removedHouseTypeValues','activeHouseTypeValues','normalizeBuildingType','maxFloorsForCell','trySpendForPlacementWithReplacement','makeThumbObject']) {
  vm.runInContext(fn(name), context);
}
const a = context.makeTransporter(), b = context.makeTransporter();
const bounds = new THREE.Box3().setFromObject(a);
assert(Math.abs(bounds.min.y) < 1e-6, 'Deck sits directly on terrain');
assert(bounds.max.y < 1.5, 'No elevated pole or tower');
assert.equal(a.userData.level, 1);
assert.equal(context.normalizeBuildingType('transporter'), 'transporter');
assert.equal(context.maxFloorsForCell({kind:'house', buildingType:'transporter', floors:8}), 1);
assert.equal(context.maxFloorsForCell({kind:'house', buildingType:'air-command'}), 6);
for (const part of a.children) {
  assert(Object.values(M).includes(part.material), 'Uses existing habitat/tower materials');
  assert.equal(part.geometry, b.children[a.children.indexOf(part)].geometry, 'Geometry is reused');
}
const thumb = context.makeThumbObject({kind:'house', activeVariant:{buildingType:'transporter'}});
assert.equal(thumb.userData.buildingType, 'transporter', 'Thumbnail uses the Transporter model');
assert(new THREE.Box3().setFromObject(thumb).equals(bounds), 'Thumbnail and placed model have matching geometry');
const cell = {kind:'house', buildingType:'transporter', floors:1};
const tool = {kind:'house', activeVariant:{buildingType:'transporter'}};
assert.equal(context.trySpendForPlacementWithReplacement(cell, tool), false, 'Bulk replacement rejects duplicate');
assert.equal(context.trySpendForPlacementWithReplacement({kind:null}, tool), true, 'Empty cell is placeable');
// Execute the actual repeated-click branch, verifying no charge or mutation.
const start = html.indexOf("      const existingHouseType = normalizeBuildingType(cell.buildingType)");
const end = html.indexOf('      // Fresh placement', start);
vm.runInContext('function clickExisting(cell, selectedTool, bType) { const x=0,z=0;\n' + html.slice(start,end) + '\n}', context);
context.clickExisting(cell, tool, 'transporter');
assert.equal(rejected, 2);
assert.equal(spent, 0);
assert.equal(placed, 0);
console.log('transporter: grounded rounded model, shared assets, type normalization, single-level cap and rejected repeat placement OK');
