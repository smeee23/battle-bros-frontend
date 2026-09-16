'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../vendor/three/three.r128.min.js');
const html = fs.readFileSync('index.html', 'utf8');
const section = (a,b) => html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const world = Array.from({length:3},()=>Array.from({length:3},()=>({terrain:'stone',kind:null,terrainFloors:1})));
const refreshed=[];
const ctx = vm.createContext({THREE,GRID:3,BUILDABLE_LAND_Y_OFFSET:0,TOP_H:.18,
  M:{greenhouseGlass:new THREE.MeshBasicMaterial()},
  getBoxGeometry:(...args)=>new THREE.BoxGeometry(...args),
  getWorldCell:(x,z)=>world[x]?.[z],terrainRiseAt:(x,z)=>(world[x][z].terrainFloors-1)*.2,
  renderCellTile:(x,z)=>refreshed.push('tile:'+x+','+z),renderCellObject:(x,z)=>refreshed.push('object:'+x+','+z),
});
vm.runInContext(section('  function isTerraformTerrain(', '  function makeTile(')
  + section('  const CROP_DOME_SIZE =', '  function naturalObjectQuarterTurns('),ctx);
for(const terrain of ['grass','dirt','path','water']) {
  assert(ctx.cellHasCropGreenhouseDome({terrain}));
  assert(!ctx.cellHasCropGreenhouseObjectDome({terrain}));
}
for(const kind of ['cow','sheep','crop','corn','wheat','pumpkin','carrot','sunflower','tree','tuft','flower','bush']) {
  assert(ctx.cellHasCropGreenhouseObjectDome({terrain:'stone',kind}),kind+' has an object shield');
}
for(const kind of [null,'rock','house','fence'])assert(!ctx.cellHasCropGreenhouseDome({terrain:'stone',kind}));
world[1][1]={terrain:'grass',terrainFloors:1};
let group=new THREE.Group();
ctx.addCropGreenhouseDome(group,ctx.getCropGreenhouseVisibleSides(1,1));
assert.equal(group.children.length,5,'Isolated shield has four walls and a roof');
world[2][1]={terrain:'dirt',kind:'cow',terrainFloors:1};
assert.equal(ctx.getCropGreenhouseVisibleSides(1,1).e,false,'Equal-height shared wall hidden');
assert.equal(ctx.getCropGreenhouseVisibleSides(2,1).w,false,'Neighbor also hides shared wall');
world[1][1].terrainFloors=4;
const edge=ctx.getCropGreenhouseVisibleSides(1,1).e;
assert(edge.height>.6 && edge.height<.63,'Raised shield fills only the height difference plus seam overlap');
assert.equal(ctx.getCropGreenhouseVisibleSides(2,1).w,false,'Only taller cell owns the height-gap panel');
group=new THREE.Group();
const box=ctx.addTerraformGreenhouseBox(group,.58,1,ctx.getCropGreenhouseVisibleSides(1,1));
assert.equal(box.position.y,.58);assert(box.userData.gridAlignedGreenhouse);
assert(box.children.every(m=>m.userData.noShadow && m.renderOrder===4));
ctx.refreshCropGreenhouseAdjacency(1,1);
assert(refreshed.includes('tile:1,1') && refreshed.includes('tile:2,1') && refreshed.includes('object:2,1'),'Mixed terrain and animal neighbors both refresh');
assert.match(html,/isTerraformTerrain\(cell.terrain\) && !cellHasCropGreenhouseObjectDome\(cell\)/,'Object shield suppresses duplicate terrain shield');
console.log('Plasma shields: terrain, animals, crops, vegetation, shared edges, elevation gaps and grid alignment passed');
