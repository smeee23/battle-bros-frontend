'use strict';
const vm=require('node:vm');
// Load the real shared terrain palette, caches, cap geometry and shader.
module.exports=function installTerrainRendering(context,html) {
 const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
 Object.assign(context,{GRID:50,geomCache:new Map(),renderVoxelTerrain:true,renderTerrainVoxelResolution:'mixed'});
 vm.runInContext(section('  const ALIEN_VEGETATION =','  const M = {')+section('  const M = {','    bridgeWood:')+'\n};\n'
  +section('  const customMaterialCache =','  function normalizeAppearance(')
  +section('  function cellRand(','  function edgeBand(')
  +section('  function materialHex(','  function voxelTreeLeafMaterials(')
  +section('  function terrainVoxelMaterials(','  function addVoxelTerrainTop(')
  +section('  function getBoxGeometry(','  function getVoxelBoxGeometry(')
  +section('  function getOpenBoxGeometry(','  // A rounded extruded slab')
  +section('  function terrainTileMaterials(','  function updateHomeCapEdges('),context);
 const fn=name=>{const a=html.indexOf('  function '+name+'(');return html.slice(a,html.indexOf('\n  }',a)+4);};
 vm.runInContext('Object.assign(M,{'+section('    trunk:     new','    wallCream:')
  +section('    cropLeaf:  new','    greenhouseGlass:')+'});'
  +section('  const M_PLANT =','  const M_ANIMAL =')
  +['getVoxelBoxGeometry','roundedBox','castReceive','voxelBoxGeometryForSize','vbox','isGreenhouseCropKind','makeVoxelCropKind'].map(fn).join('\n')
  +'\nconst MAX_FLOORS=8; let renderVoxelGap=0,renderVoxelBevel=0;',context);

};
