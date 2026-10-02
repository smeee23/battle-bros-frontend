'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const setup=new Function('require',fs.readFileSync('tools/exploration-world.test.js','utf8').split('const {terrain,scene,xrWorldRoot,context}=setup();')[0]+'return setup;')(require);
const html=fs.readFileSync('index.html','utf8'),THREE=require('../vendor/three/three.r128.min.js');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const {terrain,context}=setup();terrain.activate();
Object.assign(context,{persCam:{near:.1,fov:55,position:new THREE.Vector3(),lookAt(){}},activeFPTerrain:()=>terrain,
 explorationCompanion:{root:null},markCameraMoving(){}});
vm.runInContext(section('  const FP_EYE_H =','  // ---------- first-person companion ----------')
 +section('  function fpGroundYAt(', '  function enterFP(')
 +section('  function tickFP(', '  // ---------- first-person flight ----------')
 +'\nthis.api={fp,fpKeys,tickFP,FP_JUMP_V0,FP_EYE_H};',context);
const {fp,fpKeys,tickFP,FP_JUMP_V0,FP_EYE_H}=context.api;
let route=null;
for(let z=-18;z<18&&!route;z++)for(let x=-18;x<18&&!route;x++){
 const a=terrain.getCell(x,z);if(!a||a.terrainFloors>5||terrain.getCell(x+1,z))continue;
 for(let gap=1;gap<=4;gap++){
  const b=terrain.getCell(x+gap+1,z);
  if(b){if(b.terrainFloors<=5)route={x,z,end:x+gap+1};break;}
 }
}
assert(route,'At least one nearby gap has low facing shores');
function place(){const p=terrain.cellToWorld(route.x,route.z);fp.active=true;fp.pos.set(p.x,terrain.groundYAt(p.x,p.z,FP_EYE_H),p.z);
 fp.yaw=-Math.PI/2;fp.pitch=0;fp.grounded=true;fp.vy=0;fp.terrainLift=0;fpKeys.clear();}
place();fpKeys.add('w');
let fell=false;
for(let i=0;i<150;i++){tickFP(1/60);if(!fp.grounded&&terrain.groundYAt(fp.pos.x,fp.pos.z)===-Infinity)fell=true;}
assert(fell,'Walking off an island starts a real fall');
assert(Number.isFinite(fp.pos.y),'Empty space never turns the camera into NaN/Infinity');
place();fp.vy=FP_JUMP_V0;fp.grounded=false;fpKeys.add('w');
const end=terrain.cellToWorld(route.end,route.z);
for(let i=0;i<600&&fp.pos.x<end.x;i++)tickFP(1/60);
fpKeys.clear();
for(let i=0;i<800&&!fp.grounded;i++)tickFP(1/60);
assert(fp.grounded,'Jump lands on neighboring island');
assert.equal(terrain.getCell(...Object.values(terrain.worldToCell(fp.pos.x,fp.pos.z))).islandId,terrain.getCell(route.end,route.z).islandId);
assert(Math.abs(fp.pos.y-terrain.groundYAt(fp.pos.x,fp.pos.z,FP_EYE_H))<1e-8,'Feet land on the moving surface');
// A falling player below a rock top cannot snap upward through its underside.
fp.pos.y=terrain.groundYAt(fp.pos.x,fp.pos.z,FP_EYE_H)-2;fp.vy=-1;fp.grounded=false;
tickFP(1/60);assert(!fp.grounded,'No landing through an underside');
fp.pos.y=-30;tickFP(1/60);assert(fp.grounded&&Number.isFinite(fp.pos.y),'Deep fall safely restores footing');
console.log('floating traversal: walk-off gravity, natural gap jump, moving landing, underside rejection and recovery OK');
