'use strict';
const vm=require('node:vm');
// Load the real shared terrain palette, caches, cap geometry and shader.
module.exports=function installTerrainRendering(context,html) {
 const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
 Object.assign(context,{GRID:50,geomCache:new Map(),renderVoxelTerrain:true,renderTerrainVoxelResolution:'mixed'});
 vm.runInContext(section('  const M = {','    bridgeWood:')+'\n};\n'
  +section('  const customMaterialCache =','  function normalizeAppearance(')
  +section('  function cellRand(','  function edgeBand(')
  +section('  function materialHex(','  function voxelTreeLeafMaterials(')
  +section('  function terrainVoxelMaterials(','  function addVoxelTerrainTop(')
  +section('  function getBoxGeometry(','  function getVoxelBoxGeometry(')
  +section('  function getOpenBoxGeometry(','  // A rounded extruded slab')
  +section('  function terrainTileMaterials(','  function updateHomeCapEdges('),context);
};
