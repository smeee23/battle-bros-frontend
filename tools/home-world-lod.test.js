'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../vendor/three/three.r128.min.js');
const HomeWorldLOD = require('../assets/home-world-lod.js');
const source = fs.readFileSync('index.html', 'utf8');
const section = (a,b) => source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const world = Array.from({length:96},()=>Array.from({length:96},()=>({terrain:'stone',terrainFloors:1,kind:null,extras:[]})));
const mats = new Proxy({}, {get(target,key){return target[key] ||= new THREE.MeshLambertMaterial({color:0x89939a});}});
const parent = new THREE.Group();
const camera = new THREE.OrthographicCamera(-55,55,55,-55,.1,500);
camera.position.set(0,150,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const ctx = vm.createContext({THREE,HomeWorldLOD,world,GRID:96,BASE_TERRAIN:'stone',DIRT_H:.2,TOP_H:.18,BUILDABLE_LAND_Y_OFFSET:-.18,
 M:mats,cellMeshes:{},worldGroup:parent,camera,cameraMode:'ortho',xrSession:null,xrWorldRoot:parent,target:new THREE.Vector3(),renderer:{domElement:{clientHeight:900}},window:{innerHeight:900},
 getWorldCell:(x,z)=>world[x]?.[z] || {terrain:'stone'},tilePos:(x,z)=>({x:x-47.5,z:z-47.5}),terrainRiseAt:(x,z)=>(world[x][z].terrainFloors-1)*.2,
 terrainRiserMaterial:()=>mats.stone,cellRand:()=>.5,normalizeFenceSide:s=>s,normalizeBuildingType:s=>s||'tower',isTrainingCenter:c=>c.buildingType==='skyscraper',
 isGenerationPlantKind:k=>k==='water-plant'||k==='oxygen-plant',fenceHeightForLevel:l=>l*.7,
 TRAINING_CENTER_HEIGHT:3,SPACE_TOWER_BASE_H:.5,SPACE_TOWER_LEVEL_H:.3,
});
vm.runInContext(section('  function fenceCornerSpan(', '  function makeFence(')+section('  // Overview meshes never replace world intent', '  const HOME_RENDER_WINDOW_THRESHOLD')+section('  function homeRenderWindowRadius()', '  function boundsEqual('),ctx);
assert.equal(ctx.homeDetailRadius(),-1,'Whole island uses overview');
camera.top=12;camera.bottom=-12;camera.updateProjectionMatrix();
assert.equal(ctx.homeDetailRadius(),15,'Close orbit uses bounded detail');
ctx.cameraMode='fp';camera.position.set(30,3,22);assert.equal(ctx.computeHomeRenderBounds().cx,78,'Walking focus follows camera, not orbit target');
ctx.cameraMode='flight';assert.equal(ctx.computeHomeRenderBounds().cz,70,'Flight focus follows camera');
ctx.cameraMode='ortho';camera.top=55;camera.bottom=-55;camera.position.set(0,150,0);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
const lod=ctx.ensureHomeOverview();
const finish=()=>{while(lod.dirty.size)lod.update(camera,Infinity);parent.updateMatrixWorld(true);};
finish();
assert.equal(lod.chunks.size,36);assert.equal(lod.stats().instances,96*96*2,'Every cell remains visible');
assert.equal(lod.stats().drawCalls,36,'Empty overview has one draw call per chunk');
const raycaster = new THREE.Raycaster(new THREE.Vector3(47.5,50,47.5),new THREE.Vector3(0,-1,0));
let hits=raycaster.intersectObject(parent,true);assert(hits.some(h=>h.object.userData.keyAt[h.instanceId]==='95,95'),'Far corner is selectable');
world[95][95].terrainFloors=64;lod.invalidate(95,95);finish();hits=raycaster.intersectObject(parent,true);assert(Math.abs(hits[0].point.y-12.6)<.001,'Edited distant elevation updates picking');
const snapshot=JSON.stringify(world);
ctx.cellMeshes['95,95']={tile:{}};lod.invalidate(95,95);finish();
assert(!raycaster.intersectObject(parent,true).some(h=>h.object.userData.keyAt[h.instanceId]==='95,95'),'No overview duplicate beneath detailed cells');
delete ctx.cellMeshes['95,95'];lod.invalidate(95,95);finish();assert.equal(JSON.stringify(world),snapshot,'LOD never changes intent');
for(let x=0;x<96;x++)for(let z=0;z<96;z++)world[x][z].kind='house';
lod.reset();const start=performance.now();finish();
assert(lod.stats().drawCalls<=72,'Fully built overview stays batched');
const fullStats=lod.stats();
camera.left=-5;camera.right=5;camera.top=5;camera.bottom=-5;camera.position.set(-40,50,-40);camera.lookAt(-40,0,-40);camera.updateProjectionMatrix();camera.updateMatrixWorld();lod.update(camera);
assert(lod.stats().drawCalls<fullStats.drawCalls,'Offscreen chunks are culled');
const hiddenChunk=[...lod.chunks.values()].find(c=>!c.group.visible);assert(hiddenChunk);
const hiddenBounds=hiddenChunk.bounds.getCenter(new THREE.Vector3());raycaster.set(new THREE.Vector3(hiddenBounds.x,100,hiddenBounds.z),new THREE.Vector3(0,-1,0));
assert.equal(raycaster.intersectObject(hiddenChunk.group,true).length,0,'Culled chunks cannot intercept picking');
console.log('96×96 overview:',JSON.stringify(fullStats),'full build ms:',Math.round(performance.now()-start));
lod.dispose();assert.equal(parent.children.length,0,'Resources detach on disposal');
console.log('Home LOD: all cells, far-edge picking/editing, detail handoff, camera focus, chunk culling and bounded draw calls passed');
