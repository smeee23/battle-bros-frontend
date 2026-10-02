'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const M=Object.fromEntries(['habitatShell','habitatTrim','habitatBand','habitatWindow','habitatPanel','greenhouseGlass'].map(k=>[k,new THREE.MeshBasicMaterial()]));
const context=vm.createContext({THREE,M,GRID:50,TRAINING_FACILITY_SCALE:4.5,geomCache:new Map(),forceShieldMaterials:new Set(),
  worldGroup:new THREE.Group(),tilePos:(x,z)=>({x:x-24.5,z:z-24.5}),BUILDABLE_LAND_Y_OFFSET:-.18,TOP_H:.18,
  terrainRiseForLevel:n=>(n-1)*.2,getBoxGeometry:(...args)=>new THREE.BoxGeometry(...args),castReceive(){},disposeGroup(){}});
vm.runInContext(section('  function roundedBox(', '  // -------- materials --------')
 +section('  function stargateLayout(', '  function generateProceduralWorld(')
 +section('  let stargateLandmark =', '  async function generateWorld('),context);
const layout=context.stargateLayout();
assert(layout.x>25&&layout.z<25,'Counterclockwise from sun corner +X/+Z');
assert.equal(layout.diameter,4.44*1.15,'Portal diameter enlarged by 15%');
assert.equal(layout.x,47.5);
assert.equal(layout.z,1.5);
assert.equal(context.stargateTerrainLevel(layout.x,layout.z),7);
for(let distance=4;distance<=7;distance++) {
  assert.equal(context.stargateTerrainLevel(layout.x-distance,layout.z),10-distance,'Successive 0.2-unit stone steps');
}
context.syncStargate();
const root=context.worldGroup.children[0];
assert.equal(root.rotation.y,-Math.PI/4,'Faces map center');
const portal=root.getObjectByName('opaque-dimensional-surface');
assert.equal(portal.material.transparent,false,'Opaque even behind plasma');
assert.equal(portal.material.depthWrite,true,'Occludes terrain and objects beyond');
assert.equal(portal.material.side,THREE.DoubleSide,'Opaque from both sides');
assert(portal.material.fragmentShader.includes('vec4(color,1.0)'));
assert.equal(root.children.filter(m=>m.name==='gate-plasma-surface').length,2);
const shell=root.getObjectByName('gate-shell');
assert(Math.abs(2*(shell.geometry.parameters.radius+shell.geometry.parameters.tube)-4.44*1.15)<1e-9);
context.syncStargate();
assert.equal(context.worldGroup.children.length,1,'Reload does not duplicate gate');
assert.equal(root.parent,null);
assert.equal(context.forceShieldMaterials.size,1,'One shared portal clock/material');
assert.equal(context.worldGroup.children[0].getObjectByName('gate-shell').geometry,shell.geometry,'Reuses ring geometry');
console.log('stargate: corner, scale, stone step, opaque double-sided portal, plasma and lifecycle OK');
