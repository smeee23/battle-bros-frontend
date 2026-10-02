'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('  // ---------- exploration terrain ----------'),html.indexOf('  const homeFPTerrain ='));
function setup(){
 const scene=new THREE.Scene(),xrWorldRoot=new THREE.Group();scene.add(xrWorldRoot);
 const context=vm.createContext({THREE,scene,xrWorldRoot,TILE:1,DIRT_H:.5,TOP_H:.18,BUILDABLE_LAND_Y_OFFSET:-.18,currentSkyBgHex:0,
 explorationActive:false,terrainRiseForLevel:n=>Math.max(0,(Math.min(64,n||1)-1)*.2),terrainLevelForCell:c=>c?.terrainFloors||1,
 terrainVoxelMaterials:()=>({base:new THREE.MeshLambertMaterial()}),terrainRiserMaterial:()=>new THREE.MeshLambertMaterial(),applyDistanceMistSettings(){}});
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
const pet={position:new THREE.Vector3(before.x,terrain.groundYAt(before.x,before.z),before.z)};
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
