'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const groundStart=html.indexOf('  function fpGroundYAt(');
const walkingGround=html.slice(groundStart,html.indexOf('\n  }',groundStart)+4);
function setup(withCommand=false){
 const camera=new THREE.PerspectiveCamera(),home=new THREE.Group();
 const world=Array.from({length:50},()=>Array.from({length:50},()=>({terrain:'stone',terrainFloors:5})));
 if(withCommand)world[25][25]={kind:'house',buildingType:'air-command',terrainFloors:5};
 const context=vm.createContext({THREE,GRID:50,world,worldGroup:home,explorationActive:false,
  fp:{grounded:true,pos:new THREE.Vector3(0,1.1,0)},fpEyeHeight:()=>.3,FP_MAX_HEIGHT_DIFFERENCE:1.7,
  BUILDABLE_LAND_Y_OFFSET:-.18,TOP_H:.18,terrainRiseForLevel:n=>(n-1)*.2,terrainLevelForCell:c=>c?.terrainFloors||1,
  worldToCellCoord:v=>Math.floor(v+25),getWorldCell:(x,z)=>world[x]?.[z],tilePos:(x,z)=>new THREE.Vector3(x-24.5,0,z-24.5),
  persCam:camera,camera,cameraMode:'perspective',target:new THREE.Vector3(),viewSize:50,azimuth:0,polar:.8,
  colonyNavigationState:{selectedPlayerColonyIndex:0},playerPublicColonies:[],airCommandPositions:new Set(withCommand?['25,25']:[]),cellMeshes:{},
  isAirCommandCell:c=>c?.buildingType==='air-command',terrainRiseAt:()=>.8,airCommandFlightHoldY:()=>1.7,
  document:{getElementById:()=>null,body:{classList:{add(){},toggle(){}}}},renderer:{domElement:{}},
  resetFlightPlayerCombatState(){},resetNeighborFlybyDefenseState(){},markCameraMoving(){},applyDistanceMistSettings(){}});
 vm.runInContext(section('  const homeFPTerrain =','  const fpJourney =')+walkingGround+
  section('  // ---------- first-person flight ----------',"  window.addEventListener('keydown', e => {")+
  '\nthis.api={enterFlightMode,tickFlightMode,flightTerrainMinY,homeFPTerrain,fpGroundYAt,flight,flightKeys};',context);
 return {api:context.api,camera};
}
for(const [name,opts,spawn,command] of [
 ['home fallback',{},[0,7.18,32],false],
 ['neighbor flyby',{mockNeighborFlyby:true},[17,14.18,41],false],
 ['neighbor inspection',{inspection:true},[17,14.18,41],false],
 ['home Air Command',{},[.5,1.7,.5],true],
]){
 const {api,camera}=setup(command);api.enterFlightMode(opts);
 assert.deepEqual(camera.position.toArray(),spawn,`${name}: keep the existing approach distance`);
 assert.equal(api.homeFPTerrain.groundYAt(0,32),Infinity,'Walking boundary remains intact');
 assert.equal(api.fpGroundYAt(0,32),Infinity,'Flight fix does not change the walking query');
 let offBoardFrames=0,onBoardFrames=0;
 // Enter, cross and leave the board, then exercise the distant flight boundary.
 for(let frame=0;frame<3600;frame++){
  api.tickFlightMode(1/60);camera.updateMatrixWorld(true);
  const outside=Math.abs(camera.position.x)>=25||Math.abs(camera.position.z)>=25;
  if(outside)offBoardFrames++;else onBoardFrames++;
  assert(camera.position.toArray().every(Number.isFinite),`${name}/${frame}: finite camera position`);
  assert(camera.quaternion.toArray().every(Number.isFinite),`${name}/${frame}: finite orientation`);
  assert(camera.matrixWorldInverse.elements.every(Number.isFinite),`${name}/${frame}: valid render view matrix`);
  assert(camera.position.y>=api.flightTerrainMinY(camera.position.x,camera.position.z)-1e-8,'Terrain clearance still applies');
 }
 assert(offBoardFrames>0&&onBoardFrames>0,`${name}: real flight crosses the board edge`);
 // Low flight over a raised cell still gets the full safety clearance.
 camera.position.set(0,-2,0);api.flight.orientation.identity();api.tickFlightMode(1/60);
 assert(Math.abs(camera.position.y-1.52)<1e-8,'Existing terrain altitude remains enforced');
}
{
 const {api}=setup();
 for(const invalid of [Infinity,-Infinity,NaN]){
  api.homeFPTerrain.groundYAt=()=>invalid;
  assert.equal(api.flightTerrainMinY(80,80),.72,'Missing terrain cannot invalidate the camera');
 }
}
console.log('Flight camera: home/neighbor/inspection starts, Air Command, 60-second edge crossings, distant flight, terrain clearance, finite view matrices and unchanged walking boundaries passed.');
