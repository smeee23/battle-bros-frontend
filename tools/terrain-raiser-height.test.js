'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const THREE=require('../vendor/three/three.r128.min.js');
const fixture=fs.readFileSync('tools/exploration-world.test.js','utf8').split('const {terrain,scene,xrWorldRoot,context}=setup();')[0];
const setup=new Function('require',fixture+'return setup;')(require);
const {terrain,context}=setup();terrain.activate();
const x=0,z=0,original=terrain.getCell(x,z),p=terrain.cellToWorld(x,z);
const body=terrain.test.islands.get(original.islandId),count=body.mesh.count;
for(const level of [64,65,160,512,1024,4096]){
  terrain.setCell(x,z,{...original,terrainFloors:level,userEdited:true});
  assert(Math.abs(terrain.groundYAt(p.x,p.z)-(level-1)*.2)<1e-7,'Collision follows high columns');
  const matrix=new THREE.Matrix4();body.mesh.getMatrixAt(body.indices.get(x+','+z),matrix);
  const center=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();matrix.decompose(center,rotation,scale);
  assert(Math.abs(center.y+scale.y/2-(level-1)*.2)<1e-4,'Rendered column top agrees with collision');
  assert.equal(body.mesh.count,count,'Height changes do not add geometry instances');
}
terrain.deactivate();terrain.activate();
assert.equal(terrain.getCell(x,z).terrainFloors,4096,'Tall edits survive re-entry');
const sky=terrain.test.islands.get('0,0:sky'),id=sky.site.id,entry=sky.entries[0];
const lower=terrain.getCell(entry.x,entry.z),skyCell=terrain.getCell(entry.x,entry.z,id);
terrain.setCell(entry.x,entry.z,{...skyCell,terrainFloors:512},id);
const pos=terrain.cellToWorld(entry.x,entry.z,id);
const column=terrain.nearbyColumns(pos.x,pos.z,1).find(c=>c.x===entry.x&&c.z===entry.z&&c.islandId===id);
assert(Math.abs(column.y-(sky.site.elevation+(512-1)*.2-1.2))<1e-8,'Elevated island retains its own base offset');
assert.equal(terrain.getCell(entry.x,entry.z),lower,'Raising a sky island leaves the lower layer intact');
context.MAX_TERRAIN_FLOORS=64;
assert.equal(context.explorationTerrainRiseForLevel(1024),204.60000000000002,'Height is independent of Home cap');
console.log('Tall exploration terrain: collision/render agreement through 4096 layers, bounded instance counts, re-entry and separate sky/ground layers passed.');
