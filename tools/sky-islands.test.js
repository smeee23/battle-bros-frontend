'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const fixture=fs.readFileSync('tools/exploration-world.test.js','utf8').split('const {terrain,scene,xrWorldRoot,context}=setup();')[0];
const setup=new Function('require',fixture+'return setup;')(require);
const {terrain,context}=setup();terrain.activate();
const sky=[...terrain.test.islands.values()].filter(b=>b.site.sky);
assert(sky.length>=2&&sky.length<terrain.test.islands.size/3,'Sparse sky layer above the main fragments');
for(const body of sky) {
  assert(body.site.width<=5&&body.site.length<=5&&body.mass<=25,'No fragment exceeds five cells in either direction');
  assert(body.mesh.isInstancedMesh&&body.hull.geometry.attributes.position.count===0,'Mini fragments use flat box bases without pointed undersides');
  assert.equal(body.mesh.material,[...terrain.test.islands.values()].find(b=>!b.site.sky).mesh.material,'Shared ground terrain materials');
}
const body=terrain.test.islands.get('0,0:sky'),id=body.site.id,{x,z}=body.entries[0];
let p=terrain.cellToWorld(x,z,id),top=terrain.groundYAt(p.x,p.z,0,Infinity);
const lower=terrain.getCell(x,z),base=terrain.groundYAt(p.x,p.z);
assert(top>base+2,'A true air gap separates the layers');
assert.equal(terrain.groundYAt(p.x,p.z,0,base+.01),base,'Standing below a sky island selects the lower floor');
assert.equal(terrain.worldToCell(p.x,p.z,top+.01).islandId,id,'Elevated contact identifies the correct layer');
assert(terrain.blocksBodyAt(p.x,p.z,top-.2,top+.4),'Rock sides block overlapping bodies');
assert(!terrain.blocksBodyAt(p.x,p.z,base,base+.7),'Walking beneath a sky island is unobstructed');
const level=terrain.getCell(x,z,id).terrainFloors;
assert(terrain.canExcavate(x,z,id));
terrain.setCell(x,z,{terrainFloors:level-1,userEdited:true},id);
assert.equal(terrain.getCell(x,z),lower,'Mining an overlapping sky cell preserves lower terrain');
assert(Math.abs(terrain.groundYAt(p.x,p.z,0,Infinity)-(top-.2))<1e-10,'Mined surface updates collision height');
const matrix=new THREE.Matrix4();body.mesh.getMatrixAt(body.indices.get(x+','+z),matrix);
assert(Math.abs(matrix.elements[13]+matrix.elements[5]/2+body.root.position.y-(top-.2))<1e-6,'Mined render surface matches collision');
const player={pos:new THREE.Vector3(p.x,top-.2+.6,p.z),grounded:true,vy:0};
for(let i=0;i<300;i++)terrain.tick(1/30,player,.6,null);
const moved=terrain.cellToWorld(x,z,id);
assert(Math.hypot(moved.x-p.x,moved.z-p.z)>.3,'Cloudlike drift is visible over time');
assert(Math.abs(player.pos.x-moved.x)<1e-8&&Math.abs(player.pos.z-moved.z)<1e-8,'Standing player rides the elevated moving platform');
assert.equal(terrain.getCell(x,z,id).terrainFloors,level-1,'Mining edits travel with the sky island');
// Exercise real ray picking and the axe impact against overlapping terrain.
const miningSource=fs.readFileSync('tools/excavation.test.js','utf8').split('create();assert')[0];
const mining=new Function('require',miningSource+'return {context,create,equip,pick,start,tick,fp,camera};')(require);
mining.context.activeFPTerrain=()=>terrain;mining.context.explorationActive=true;mining.context.FP_EYE_H=.6;
mining.create();mining.equip('axe');
// Use an unmined, interior sky cell for a complete swing.
const target=body.entries.find(q=>terrain.getCell(q.x,q.z,id).terrainFloors>8);
p=terrain.cellToWorld(target.x,target.z,id);top=terrain.groundYAt(p.x,p.z,0,Infinity);
mining.fp.pos.set(p.x,top+.6,p.z);mining.camera.position.copy(mining.fp.pos);
mining.camera.lookAt(p.x,top,p.z);mining.camera.updateMatrixWorld();
const picked=mining.pick();assert.equal(picked.islandId,id,'Axe targets the sky layer');
const lowerBefore=terrain.getCell(picked.x,picked.z);
assert(mining.start());mining.tick(.31);
assert.equal(terrain.getCell(picked.x,picked.z,id).terrainFloors,picked.level-1,'Actual axe swing mines the elevated island');
assert.equal(terrain.getCell(picked.x,picked.z),lowerBefore,'Axe cannot accidentally mine the floor below');
// Eviction/reload must retain edits and motion without retaining old GPU objects.
let disposed=false;body.hull.geometry.addEventListener('dispose',()=>disposed=true);
terrain.ensureAround(1000,1000);assert(disposed);
terrain.ensureAround(0,0);
const visitor={pos:new THREE.Vector3(0,20,0),grounded:false};
for(let i=0;i<100&&terrain.diagnostics().pending;i++)terrain.tick(0,visitor,.6,null);
assert.equal(terrain.getCell(x,z,id).terrainFloors,level-1,'Sky edits survive eviction');
assert.equal(terrain.getCell(picked.x,picked.z,id).terrainFloors,picked.level-1,'Axe edits survive eviction');
assert(terrain.diagnostics().islands<=100&&terrain.diagnostics().sleeping<=128,'Sky layer respects streaming bounds');
console.log('sky islands: sparse miniature terrain, layered collisions, drift, riders, real axe mining and persistent streamed edits OK');
// Real first-person integration: jump from a lower island onto the entry sky island.
const actual=setup();actual.terrain.activate();
Object.assign(actual.context,{persCam:{near:.1,fov:55,position:new THREE.Vector3(),lookAt(){}},activeFPTerrain:()=>actual.terrain,
 transportCube:{root:null},markCameraMoving(){}});
const html=fs.readFileSync('index.html','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
vm.runInContext(section('  const FP_EYE_H =','  // ---------- transport cube ----------')
 +section('  function fpGroundYAt(', '  function enterFP(')+section('  function tickFP(', '  // ---------- first-person flight ----------')
 +'\nthis.api={fp,fpKeys,tickFP,FP_JUMP_V0,FP_EYE_H};',actual.context);
const {fp,fpKeys,tickFP,FP_JUMP_V0,FP_EYE_H}=actual.context.api;
const entry=actual.terrain.test.islands.get(id);
fp.active=true;fp.pos.set(entry.site.bounds.minX-2.5,0,entry.site.bounds.minZ+.5);
fp.pos.y=actual.terrain.groundYAt(fp.pos.x,fp.pos.z,FP_EYE_H);
fp.yaw=-Math.PI/2;fp.grounded=false;fp.vy=FP_JUMP_V0;fpKeys.add('w');
let landed=false;
for(let i=0;i<720;i++) {
  const center=actual.terrain.cellToWorld(entry.site.bounds.minX,entry.site.bounds.minZ,id);
  if(fp.pos.x>=center.x)fpKeys.clear();
  tickFP(1/60);
  if(fp.grounded&&actual.terrain.worldToCell(fp.pos.x,fp.pos.z,fp.pos.y-FP_EYE_H+.01).islandId===id){landed=true;break;}
}
assert(landed,'Existing jump and walking controls can reach a moving sky island');
const skyFloor=fp.pos.y;
fpKeys.add('a');for(let i=0;i<240;i++)tickFP(1/60);fpKeys.clear();
for(let i=0;i<720&&!fp.grounded;i++)tickFP(1/60);
assert(fp.grounded&&fp.pos.y<skyFloor-1,'Walking off a sky island lands on the lower terrain');
fp.pos.set(entry.root.position.x,0,entry.root.position.z);
fp.pos.y=actual.terrain.groundYAt(fp.pos.x,fp.pos.z,FP_EYE_H);
fp.vy=FP_JUMP_V0;fp.grounded=false;
for(let i=0;i<180;i++) {
  tickFP(1/60);
  assert(fp.pos.y+.12<=entry.site.elevation-1.4+1e-8,'Jumping directly underneath cannot pass through the island');
}
console.log('sky traversal: ordinary jump reaches a drifting sky island and stepping off lands below OK');

// Dig a sky column all the way through using real axe impacts.
const digging=setup();digging.terrain.activate();
mining.context.activeFPTerrain=()=>digging.terrain;
const digBody=digging.terrain.test.islands.get('0,0:sky');
const digCell=digBody.entries[0],digId=digBody.site.id;
const digPoint=digging.terrain.cellToWorld(digCell.x,digCell.z,digId);
const groundBefore=digging.terrain.getCell(digCell.x,digCell.z);
let hits=0;
while(digging.terrain.getCell(digCell.x,digCell.z,digId)) {
  const y=digging.terrain.groundYAt(digPoint.x,digPoint.z,0,Infinity);
  mining.fp.pos.set(digPoint.x,y+.6,digPoint.z);mining.fp.grounded=true;
  mining.camera.position.copy(mining.fp.pos);mining.camera.lookAt(digPoint.x,y,digPoint.z);mining.camera.updateMatrixWorld();
  assert.equal(mining.pick().islandId,digId);
  mining.tick(1);assert(mining.start());mining.tick(.31);
  const after=digging.terrain.getCell(digCell.x,digCell.z,digId);
  const nextY=after?digging.terrain.groundYAt(digPoint.x,digPoint.z,0,Infinity):digBody.site.elevation-1.4;
  assert(Math.abs(y-nextY-.2)<1e-9,'Every strike removes 0.2 units, including the final base layer');
  assert(++hits<=11,'Every hit removes a layer including the bottom');
}
assert.equal(digging.terrain.getCell(digCell.x,digCell.z),groundBefore,'Breakthrough preserves the lower plane');
assert(!digging.terrain.nearbyColumns(digPoint.x,digPoint.z,2).some(c=>c.islandId===digId&&c.x===digCell.x&&c.z===digCell.z),'Removed column is no longer targetable');
assert(!digging.terrain.blocksBodyAt(digPoint.x,digPoint.z,digBody.site.elevation-1,digBody.site.elevation+1),'Breakthrough removes collision');
const remainingBody=digging.terrain.test.islands.get(digId);
remainingBody.root.updateMatrixWorld(true);
const ray=new THREE.Raycaster(new THREE.Vector3(digPoint.x,30,digPoint.z),new THREE.Vector3(0,-1,0));
assert.equal(ray.intersectObject(remainingBody.root,true).length,0,'No rendered underside seals the mined opening');
digging.terrain.ensureAround(1000,1000);digging.terrain.ensureAround(0,0);
assert.equal(digging.terrain.getCell(digCell.x,digCell.z,digId),null,'Mined holes persist after streaming');
console.log('sky mining: final layer, underside opening, collision removal, lower plane preservation and persistent holes OK');
