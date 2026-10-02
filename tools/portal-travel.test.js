'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
let time=0,mode='fp';
const draw={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
const home=new THREE.Group(),scene=new THREE.Scene();scene.add(home);
const fp={active:true,pos:new THREE.Vector3(0,1,0),yaw:.3,pitch:.1};
const ctx=vm.createContext({THREE,scene,xrWorldRoot:home,worldGroup:home,GRID:50,TILE:1,DIRT_H:.5,TOP_H:.18,
 BUILDABLE_LAND_Y_OFFSET:-.18,currentSkyBgHex:0,explorationActive:false,TRAINING_FACILITY_SCALE:4.5,
 fp,fpKeys:new Set(['w']),performance:{now:()=>time},window:{innerWidth:800,innerHeight:600},
 document:{createElement:()=>({style:{},setAttribute(){},getContext:()=>draw}),body:{appendChild(){}}},
 terrainRiseForLevel:n=>(n-1)*.2,terrainLevelForCell:c=>c?.terrainFloors||1,
 terrainVoxelMaterials:()=>({base:new THREE.MeshBasicMaterial()}),terrainRiserMaterial:()=>new THREE.MeshBasicMaterial(),
 applyDistanceMistSettings(){},leaveExcavation(){},stopExplorationCompanion(){},startExplorationCompanion(){},
 worldToCellCoord:v=>Math.floor(v+25),tilePos:(x,z)=>({x:x-24.5,z:z-24.5}),
 getWorldCell:()=>({terrain:'stone',terrainFloors:3}),setCell(){},trainingFacilityTerrainCell:()=>false,
 setCameraMode:value=>{mode=value;fp.active=false;}});
vm.runInContext(section('  function stargateLayout(', '  function generateProceduralWorld(')
 +section('  // ---------- exploration terrain ----------','  // ---------- frontend excavation ----------')
 +'\nfunction fpGroundYAt(x,z){return activeFPTerrain().groundYAt(x,z,.6);}\nthis.api={homeFPTerrain,explorationTerrain,fpJourney};',ctx);
assert.equal(ctx.activeFPTerrain(),ctx.api.homeFPTerrain,'Default walk uses home');
assert.equal(ctx.api.homeFPTerrain.groundYAt(0,0,.6),1);
assert.equal(ctx.api.homeFPTerrain.groundYAt(25,0),Infinity,'Home boundary blocks walking out');
assert(!ctx.api.homeFPTerrain.canExcavate(48,1),'Portal steps are protected');
ctx.switchFPWorld(true);
assert(ctx.explorationActive);assert(!home.visible);assert.equal(fp.pos.x,0);
ctx.escapeFP();
assert(!ctx.explorationActive);assert(home.visible);assert(fp.active);assert.equal(fp.yaw,.3);
ctx.escapeFP();assert(fp.active,'Pointer-lock and key events cannot exit twice');
time=500;ctx.escapeFP();assert.equal(mode,'perspective','Leaving first-person home returns to perspective');
fp.active=true;
const layout=ctx.stargateLayout(),p=ctx.tilePos(layout.x,layout.z);
const sin=Math.sin(layout.yaw),cos=Math.cos(layout.yaw);
const place=(depth,across=0)=>fp.pos.set(p.x+sin*depth+cos*across,1.8,p.z+cos*depth-sin*across);
place(.1,4);ctx.tickFPJourney(.016);place(-.1,4);ctx.tickFPJourney(.016);
assert.equal(ctx.api.fpJourney.warp,0,'Crossing beside the ring does not teleport');
ctx.api.fpJourney.previous=null;
place(.1);ctx.tickFPJourney(.016);place(-.1);ctx.tickFPJourney(.016);
assert(ctx.api.fpJourney.warp>0,'Walking through aperture starts warp');
assert(!ctx.explorationActive,'Warp begins on home');
ctx.tickFPJourney(.7);assert(ctx.explorationActive,'World switches during warp');
assert.equal(ctx.fpKeys.size,0,'No held movement carries through');
ctx.tickFPJourney(.7);assert.equal(ctx.api.fpJourney.warp,0);assert(ctx.api.fpJourney.overlay.hidden);
time=1000;ctx.escapeFP();assert(!ctx.explorationActive);assert(fp.active);
const depth=(fp.pos.x-p.x)*sin+(fp.pos.z-p.z)*cos;
assert(Math.abs(depth-1.4)<1e-9,'Return is safely in front of portal');
ctx.tickFPJourney(.016);assert.equal(ctx.api.fpJourney.warp,0,'Return does not retrigger');
assert(html.includes('Walk (first-person home)') && html.includes('Walk (first-person other)'));
console.log('portal travel: home provider, boundaries, aperture crossing, warp, safe return and two-stage Escape OK');
// Exercise the real entry/exit functions, including direct testing-mode switches.
Object.assign(ctx,{FP_FOV:55,FP_NEAR:.02,PERS_FOV_DEFAULT:50,PERS_NEAR_DEFAULT:.1,
 persCam:{updateProjectionMatrix(){}},renderer:{domElement:{}},excavation:{equipped:'hands'},
 fpToolMenu:{hidden:true},fpToolsToggle:{setAttribute(){}}});
ctx.document.body.classList={add(){},remove(){}};
ctx.document.getElementById=()=>({hidden:true});
vm.runInContext(section('  function enterFP(',"  document.addEventListener('pointerlockchange'"),ctx);
ctx.exitFP();ctx.enterFP();assert(fp.active && !ctx.explorationActive,'Normal first person starts at home');
ctx.enterFP({world:'other'});assert(ctx.explorationActive,'Testing view switches directly to endless');
ctx.enterFP({world:'home'});assert(!ctx.explorationActive && fp.active,'Testing view switches directly home');
ctx.enterFP({world:'other'});ctx.exitFP();assert(!ctx.explorationActive && home.visible,'Exit restores home visibility');
ctx.enterFP();assert(!ctx.explorationActive && fp.pos.x===0,'Fresh entry resets to home center');
console.log('portal travel: actual first-person entry, testing modes, exit and re-entry OK');
// H returns home without releasing or reacquiring capture; mouse-look works immediately.
const inputHandlers={};
ctx.document.addEventListener=(name,handler)=>inputHandlers[name]=handler;
ctx.window.addEventListener=(name,handler)=>inputHandlers[name]=handler;
ctx.trainingAppearance={active:false};ctx.flight={active:false};ctx.markCameraMoving=()=>{};
let lockRequests=0;
ctx.renderer.domElement.requestPointerLock=()=>{lockRequests++;};
vm.runInContext(section("  document.addEventListener('pointerlockchange'",'  function tickFP('),ctx);
ctx.enterFP({world:'other'});
ctx.document.pointerLockElement=ctx.renderer.domElement;
const homePose={...ctx.api.fpJourney.home};
ctx.api.fpJourney.warp=.8;
const pressHome=extra=>inputHandlers.keydown({code:'KeyH',key:'h',preventDefault(){},...extra});
pressHome({repeat:true});assert(ctx.explorationActive,'Repeated H does not trigger travel');
pressHome({ctrlKey:true});assert(ctx.explorationActive,'Browser shortcuts do not trigger travel');
pressHome();
assert(!ctx.explorationActive && fp.active,'H returns home in first-person mode');
assert.equal(fp.pos.x,homePose.x);assert.equal(fp.pos.z,homePose.z);
assert.equal(ctx.api.fpJourney.warp,0,'H cancels any unfinished warp');
assert.equal(ctx.document.pointerLockElement,ctx.renderer.domElement,'H retains pointer lock');
assert.equal(lockRequests,0,'H needs no new capture request or click');
const beforeLook=fp.yaw;
inputHandlers.mousemove({movementX:20,movementY:0});
assert(Math.abs(fp.yaw-(beforeLook-.044))<1e-12,'Mouse-look responds immediately after returning home');
pressHome();assert(fp.active && !ctx.explorationActive,'H at home does not exit first person');
ctx.exitFP();pressHome();assert(!fp.active,'H outside first person does not enter it');
console.log('portal travel: H preserves capture, restores home, cancels warp and immediately accepts mouse-look OK');
