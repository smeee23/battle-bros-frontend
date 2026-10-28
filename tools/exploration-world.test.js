'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('  // ---------- exploration terrain ----------'),html.indexOf('  const homeFPTerrain ='));
function setup(){
 const scene=new THREE.Scene(),xrWorldRoot=new THREE.Group();scene.add(xrWorldRoot);
 const context=vm.createContext({THREE,scene,xrWorldRoot,TILE:1,DIRT_H:.5,TOP_H:.18,BUILDABLE_LAND_Y_OFFSET:-.18,currentSkyBgHex:0,
 explorationActive:false,terrainRiseForLevel:n=>Math.max(0,(Math.min(64,n||1)-1)*.2),terrainLevelForCell:c=>c?.terrainFloors||1,
 applyDistanceMistSettings(){}});
 require('../tools/terrain-render-fixture')(context,html);
 // Inspect the actual solver without adding a production mutation/debug API.
 vm.runInContext(source.replace('return {group,getCell,','return {test:{islands,contact,simulate},group,getCell,')+'\nthis.terrain=explorationTerrain;',context);
 return {terrain:context.terrain,scene,xrWorldRoot,context};
}
const {terrain,scene,xrWorldRoot,context}=setup();
terrain.activate();assert(!xrWorldRoot.visible && terrain.group.visible);
let stats=terrain.diagnostics();
assert(stats.islands>10&&stats.islands<=100,'Stream a bounded field of whole fragments');
assert(new Set(stats.fragments.map(b=>b.style)).size===4,'Dunes, jagged rocks, plateaus and mixed shapes');
const sizes=stats.fragments.map(b=>b.count);assert(Math.max(...sizes)>Math.min(...sizes)*4,'Substantial landmass size variation');
assert(terrain.group.getObjectByName('endless-space-stars'));
for(const root of terrain.group.children.filter(c=>c.name.startsWith('floating-fragment-'))) {
 assert(root.getObjectByName('explorationTerrainWindow').isInstancedMesh);
 const hull=root.getObjectByName('fractured-rock-underside');assert(hull.geometry.attributes.position.count>0);
 hull.geometry.computeBoundingBox();assert(hull.geometry.boundingBox.min.y < -3,'Tapered depth below the shared plane');
}
const original=terrain.getCell(0,0);assert(original && !original.kind);assert(terrain.canExcavate(0,0));
let solid=0,voids=0;const shores=[];
for(let x=-24;x<24;x++)for(let z=-24;z<24;z++){
 const c=terrain.getCell(x,z);
 if(c)solid++;else {voids++;assert.equal(terrain.groundYAt(x+.5,z+.5),-Infinity);assert(!terrain.canExcavate(x,z));}
 if(c&&(!terrain.getCell(x+1,z)||!terrain.getCell(x,z+1)))shores.push(c.terrainFloors);
}
assert(solid>600&&voids>100,'Real gaps fracture the landscape');
assert(shores.filter(n=>n<=5).length/shores.length>.8,'Most shoreline tops share an easy jumping elevation');
terrain.setCell(0,0,{terrainFloors:2,userEdited:true});assert.equal(terrain.getCell(0,0).terrainFloors,2);
const before=terrain.cellToWorld(0,0),player={pos:new THREE.Vector3(before.x,terrain.groundYAt(before.x,before.z,.6),before.z),grounded:true,vy:0};
const pet=new THREE.Group();
pet.position.set(before.x,terrain.groundYAt(before.x,before.z),before.z);
for(let i=0;i<300;i++)terrain.tick(1/30,player,.6,pet);
const after=terrain.cellToWorld(0,0);
assert(Math.hypot(after.x-before.x,after.z-before.z)>.02,'Slow physical drift is observable');
assert(Math.hypot(after.x-before.x,after.z-before.z)<.46,'Motion stays subtle');
assert(Math.abs(player.pos.x-after.x)<1e-8&&Math.abs(player.pos.z-after.z)<1e-8,'Standing player rides the island');
assert(Math.abs(pet.position.x-after.x)<1e-8,'Companion rides the same rock');
assert.equal(terrain.getCell(0,0).terrainFloors,2,'Edits stay attached during drift');
assert.deepEqual(JSON.parse(JSON.stringify(terrain.worldToCell(after.x,after.z))),{x:0,z:0});
assert.equal(terrain.groundYAt(after.x,after.z),.2,'Collision agrees with edited moving surface');
player.pos.y=-30;player.grounded=false;terrain.tick(1/30,player,.6,pet);
assert(player.grounded && Number.isFinite(player.pos.y)&&player.pos.y>0,'Void fall recovers onto last safe island');
const old=terrain.group.getObjectByName('fractured-rock-underside');let disposed=false;old.geometry.addEventListener('dispose',()=>disposed=true);
terrain.ensureAround(1000,1000);assert(disposed,'Eviction disposes island-specific GPU geometry');
assert(terrain.diagnostics().islands<=100);
assert(terrain.diagnostics().pending>0,'Distant arrivals build progressively');
const remote={pos:new THREE.Vector3(1000,20,1000),grounded:false};
for(let i=0;i<100&&terrain.diagnostics().pending;i++)terrain.tick(0,remote,.6,null);
assert.equal(terrain.diagnostics().pending,0,'Progressive streaming completes on the existing tick');
terrain.ensureAround(0,0);assert.equal(terrain.getCell(0,0).terrainFloors,2,'Edits survive eviction and reload');
for(let i=1;i<=8;i++)terrain.ensureAround(i*1000,-i*1000);
stats=terrain.diagnostics();assert(stats.islands<=100&&stats.sites<200&&stats.cells<50000&&stats.sleeping<=128,'Streaming and dormant motion stay bounded');
terrain.deactivate();assert(xrWorldRoot.visible&&!terrain.group.visible);
terrain.activate();assert.equal(terrain.getCell(0,0).terrainFloors,2,'Mode switches preserve edits');
const returned={pos:new THREE.Vector3(0,20,0),grounded:false};
for(let i=0;i<100&&terrain.diagnostics().pending;i++)terrain.tick(0,returned,.6,null);
const other=setup().terrain;
for(const [x,z] of [[10,10],[47,-50],[1004,1001],[-505,912]])assert.equal(JSON.stringify(terrain.getCell(x,z)),JSON.stringify(other.getCell(x,z)),'Deterministic fragments at arbitrary coordinates');
// Force two real polygon bodies into gentle approach, then exercise the solver.
const bodies=[...terrain.test.islands.values()];let pair=null;
for(let i=0;i<bodies.length&&!pair;i++)for(let j=i+1;j<bodies.length&&!pair;j++){
 const a=bodies[i],b=bodies[j],dx=b.site.x-a.site.x,dz=b.site.z-a.site.z,len=Math.hypot(dx,dz),nx=dx/len,nz=dz/len;
 const save=[a.ox,a.oz,b.ox,b.oz];
 for(let d=0;d<2.1;d+=.05){a.ox=nx*d;a.oz=nz*d;b.ox=-nx*d;b.oz=-nz*d;if(terrain.test.contact(a,b)){pair={a,b,nx,nz};break;}}
 if(!pair)[a.ox,a.oz,b.ox,b.oz]=save;
}
assert(pair,'Some neighboring rocks can meet within the slow drift envelope');
const {a,b,nx,nz}=pair;a.vx=nx*.02;a.vz=nz*.02;b.vx=-nx*.02;b.vz=-nz*.02;
terrain.test.simulate(1/30);
assert((b.vx-a.vx)*nx+(b.vz-a.vz)*nz>-.039,'Mass-weighted contact slows an approaching pair');
console.log('floating world: deterministic varied fragments, real void, shared shores, tapered hulls, drift/contact, riders, mining, rescue and bounded streaming OK');
// Regional themes are coordinate-based, independent of random island shape.
const regional=setup().terrain;regional.activate();
const regions=[[0,0,'EARTH',['grass','water','stone']],[192,0,'LAVA',['stone','lava']],
 [0,-192,'DESERT',['sand']],[192,-192,'ICE',['snow']]];
for(const [cx,cz,biome,expected] of regions) {
 regional.ensureAround(cx,cz);
 const types=new Set(),owners=new Set();
 for(let x=cx-32;x<cx+32;x++)for(let z=cz-32;z<cz+32;z++) {
  const cell=regional.getCell(x,z);if(!cell)continue;
  assert.equal(cell.biome,biome,'A broad section shares one theme across island boundaries');
  types.add(cell.terrain);owners.add(cell.islandId);
 }
 assert(owners.size>4,'Regions span many islands, rather than coloring individual fragments');
 assert.deepEqual([...types].sort(),expected.sort());
 for(const fragment of regional.diagnostics().fragments)assert.equal(fragment.biome,biome,'Sky and lower fragments inherit the region');
}
regional.ensureAround(0,0);
const standing={pos:new THREE.Vector3(0,20,0),grounded:false};
while(regional.diagnostics().pending)regional.tick(0,standing,.6,null);
const land=regional.test.islands.get(regional.getCell(0,0).islandId);
regional.setCell(0,0,{terrain:'lava',terrainFloors:4});
const cap=land.surfaces.get('lava'),capMatrix=new THREE.Matrix4();
cap.mesh.getMatrixAt(cap.indices.get('0,0'),capMatrix);
assert(Math.abs(capMatrix.elements[13]+.18-.6)<1e-6,'Surface cap matches edited collision top');
let capDisposed=false;cap.mesh.addEventListener('dispose',()=>capDisposed=true);
regional.ensureAround(1000,1000);assert(capDisposed,'Streaming disposes regional surface instances');
console.log('endless biomes: broad coherent regions, all four palettes, sky inheritance, edited surfaces and GPU cleanup OK');

const styled=setup(),styledTerrain=styled.terrain;styledTerrain.activate();
const styledBody=styledTerrain.test.islands.get(styledTerrain.getCell(0,0).islandId);
for(const terrain of ['grass','water','lava','sand','snow','stone']) {
 styledTerrain.setCell(0,0,{terrain,terrainFloors:12});
 const surface=styledBody.surfaces.get(terrain),shared=styled.context.terrainTileMaterials(terrain);
 assert.equal(surface.riser.material,shared.riserMat,'Endless sides use the exact shared material');
 assert.equal(surface.mesh.material.color.getHex(),shared.topMat.color.getHex());
 assert(surface.mesh.geometry.attributes.capRequiredEdges,'Use shared detailed cap geometry');
 assert.equal(surface.mesh.geometry.attributes.capExposedEdges,surface.edges);
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.lambert.vertexShader,fragmentShader:THREE.ShaderLib.lambert.fragmentShader};
 surface.mesh.material.onBeforeCompile(shader);
 assert(shader.fragmentShader.includes('diffuseColor.rgb *= capPatternTint;'),'Shared QR-like sub-tile pattern is present');
 assert(shader.fragmentShader.includes('totalEmissiveRadiance *= capPatternTint;'),'Lava pattern preserves shared emissive shading');
 const riser=new THREE.Matrix4();surface.riser.getMatrixAt(surface.indices.get('0,0'),riser);
 assert(Math.abs(riser.elements[13]+riser.elements[5]/2-(2.2-.18))<1e-6,'Sides meet the shared cap base');
}
const shaderMaterial=styledBody.surfaces.get('stone').mesh.material;
styled.context.renderVoxelTerrain=false;styled.context.renderTerrainVoxelResolution='12';
styledTerrain.tick(0,{pos:new THREE.Vector3(0,20,0),grounded:false},.6,null);
assert.equal(shaderMaterial.userData.capPattern.capPatternEnabled.value,0);
assert.equal(shaderMaterial.userData.capPattern.capPatternCells.value,12);
console.log('Endless styling: shared patterned caps, exact terrain side materials, mining alignment and live pattern settings passed');
// The same altitude/random rule and exact snow palette as Territory, batched
// with instance colors so ice variety does not add draw calls per island.
styledTerrain.ensureAround(192,-192);
const iceBody=[...styledTerrain.test.islands.values()].find(b=>b.site.biome==='ICE'&&b.surfaces.has('snow'));
assert(iceBody,'Ice region is streamed');
const iceSurface=iceBody.surfaces.get('snow'),iceColors=new Set();let blueCell;
for(const {x,z} of iceBody.entries) {
 const cell=styledTerrain.getCell(x,z,iceBody.site.sky?iceBody.site.id:undefined);
 const variant=styled.context.terrainSnowShadeVariant(styled.context.cellRand(x,z,4107),cell.terrainFloors);
 const tint=new THREE.Color();iceSurface.mesh.getColorAt(iceSurface.indices.get(x+','+z),tint);
 const actual=iceSurface.mesh.material.color.clone().multiply(tint);
 const expected=styled.context.terrainTileMaterials('snow',variant).topMat.color;
 assert(actual.toArray().every((v,i)=>Math.abs(v-expected.toArray()[i])<1e-6),'Endless ice matches the shared Territory shade');
 iceColors.add(variant);if(variant===1)blueCell={x,z};
}
assert.equal(iceColors.size,2,'Both Territory snow/ice shades appear within the ice region');
assert(blueCell);
const iceId=iceBody.site.sky?iceBody.site.id:undefined,iceIndex=iceSurface.indices.get(blueCell.x+','+blueCell.z);
styledTerrain.setCell(blueCell.x,blueCell.z,{terrainFloors:30},iceId);
const tint=new THREE.Color();iceSurface.mesh.getColorAt(iceIndex,tint);
assert.deepEqual(tint.toArray(),[1,1,1],'High peaks use the shared snow shade');
styledTerrain.setCell(blueCell.x,blueCell.z,{terrainFloors:5},iceId);
iceSurface.mesh.getColorAt(iceIndex,tint);assert(tint.b>tint.r,'Lowered ice regains its blue shade');
console.log('Endless ice: exact shared Territory snow/blue palette, altitude selection, stable variation and mining updates passed');
