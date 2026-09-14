'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const context=vm.createContext({THREE,Math,Float32Array,TILE:1,TOP_H:.2,GRID:50,renderVoxelTerrain:true,terrainVoxelCellCount:()=>6,
 M:{grass:new THREE.MeshLambertMaterial({color:0x669933}),grassHi:new THREE.MeshLambertMaterial({color:0x88bb55})},
 geomCache:new Map(),tileLevelForCell:c=>c.terrainFloors,getWorldCell:(x,z)=>({terrainFloors:x===25&&z===25?64:63})});
vm.runInContext(section('  function getBoxGeometry(', '  function getVoxelBoxGeometry(')+section('  function getOpenBoxGeometry(', '  // A rounded extruded slab')+section('  function makeInstancedTerrainCapGeometry(', '  function ensureHomeTileGeoms()'),context);
for(const terrain of ['grass','path','water','dirt','sand','snow','stone','lava']){
 const geo=context.makeInstancedTerrainCapGeometry(terrain);geo.computeBoundingBox();
 const expected=['grass','path','water'].includes(terrain)?1.04:.98;
 assert(Math.abs(geo.boundingBox.max.x-(expected/2 + .0025))<.001);
 assert(Math.abs(geo.boundingBox.max.y-.212)<.001,'Original highlight height');
 assert(geo.attributes.position.count/3<=110,'Bounded shared geometry');
 assert.equal(geo.groups.length,0,'One material draw per cap batch');
 for(const name of ['normal','color','capRequiredEdges'])assert.equal(geo.attributes[name].count,geo.attributes.position.count);
 geo.dispose();
}
const capEdges=new THREE.InstancedBufferAttribute(new Float32Array(8),4);
context.updateHomeCapEdges({capEdges},0,25,25);
assert.deepEqual([...capEdges.array.slice(0,4)],[1,1,1,1],'Raised tile exposes every edge');
context.updateHomeCapEdges({capEdges},1,24,25);
assert.deepEqual([...capEdges.array.slice(4)],[0,0,0,0],'Equal and higher neighbors hide trim');
context.updateHomeCapEdges({capEdges},1,0,0);
assert.deepEqual([...capEdges.array.slice(4)],[1,0,1,0],'Map boundary exposes edges');
context.terrainVoxelMaterials=()=>({base:context.M.grass,hi:context.M.grassHi,low:context.M.grass,scuff:context.M.grass});
const mat=context.makeInstancedTerrainCapMaterial(context.M.grass);
const shader={uniforms:{},vertexShader:THREE.ShaderLib.lambert.vertexShader,fragmentShader:THREE.ShaderLib.lambert.fragmentShader};mat.onBeforeCompile(shader);
assert(shader.vertexShader.includes('attribute vec4 capExposedEdges;'));
assert(shader.vertexShader.includes('transformed *= capVisible;'));
assert(shader.fragmentShader.includes('diffuseColor.rgb *= capPatternTint;'));
assert(shader.fragmentShader.includes('totalEmissiveRadiance *= capPatternTint;'));
assert.equal(shader.uniforms.capPatternCells.value,6);
assert(mat.vertexColors);assert.notEqual(mat,context.M.grass);
console.log('terrain-caps: all eight materials, original cap dimensions, bounded geometry, single draw batches and edge visibility OK');
