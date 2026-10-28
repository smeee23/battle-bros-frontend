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
 fp,transporterObjects:new Set(),fpEyeHeight:()=>.6,fpKeys:new Set(['w']),performance:{now:()=>time},window:{innerWidth:800,innerHeight:600},
 document:{createElement:()=>({style:{},setAttribute(){},getContext:()=>draw}),body:{appendChild(){}}},
 terrainRiseForLevel:n=>(n-1)*.2,terrainLevelForCell:c=>c?.terrainFloors||1,
 applyDistanceMistSettings(){},leaveExcavation(){},resetTransportCube(){},
 worldToCellCoord:v=>Math.floor(v+25),tilePos:(x,z)=>({x:x-24.5,z:z-24.5}),
 getWorldCell:()=>({terrain:'stone',terrainFloors:3}),setCell(){},trainingFacilityTerrainCell:()=>false,
 setCameraMode:value=>{mode=value;if(ctx.exitFP)ctx.exitFP();else {ctx.api.explorationTerrain.deactivate();fp.active=false;}}});
require('./terrain-render-fixture')(ctx,html);
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
assert(!ctx.explorationActive);assert(home.visible);assert(!fp.active);assert.equal(mode,'perspective');
ctx.escapeFP();assert(!fp.active,'Pointer-lock and key events leave first person exited');
time=500;ctx.escapeFP();assert.equal(mode,'perspective','Leaving first-person home returns to perspective');
fp.active=true;
const layout=ctx.stargateLayout(),p=ctx.tilePos(layout.x,layout.z);
const gate=new THREE.Group();gate.position.set(p.x,1.2,p.z);gate.rotation.y=layout.yaw;
gate.userData={kind:'house',buildingType:'transporter',permanentEnvironment:true};home.add(gate);ctx.transporterObjects.add(gate);
const sin=Math.sin(layout.yaw),cos=Math.cos(layout.yaw);
const place=(depth,across=0)=>fp.pos.set(p.x+sin*depth+cos*across,1.8,p.z+cos*depth-sin*across);
place(2,2);ctx.tickFPJourney(.016);place(-2,2);ctx.tickFPJourney(.016);
assert.equal(ctx.api.fpJourney.warp,0,'Passing beside the building does not teleport');
ctx.api.fpJourney.previous=null;
place(2,1);ctx.tickFPJourney(.016);const safe=fp.pos.clone();place(.8,1);ctx.tickFPJourney(.016);
assert(ctx.api.fpJourney.warp>0,'Entering the transporter starts warp');assert(fp.pos.equals(safe),'Return point is outside the building');
ctx.cancelFPWarp();ctx.api.fpJourney.previous=null;
place(-2,1);ctx.tickFPJourney(.016);place(-.8,1);ctx.tickFPJourney(.016);
assert(ctx.api.fpJourney.warp>0,'Entry works from the back as well');
ctx.cancelFPWarp();ctx.api.fpJourney.previous=null;
place(3);ctx.tickFPJourney(.016);place(-3);ctx.tickFPJourney(.016);
assert(ctx.api.fpJourney.warp>0,'Fast steps through the entire building still trigger');
ctx.cancelFPWarp();ctx.api.fpJourney.previous=null;
place(.1);ctx.tickFPJourney(.016);place(-.1);ctx.tickFPJourney(.016);
assert.equal(ctx.api.fpJourney.warp,0,'Standing inside or spawning inside does not repeatedly trigger');
ctx.api.fpJourney.previous=null;
place(2);fp.pos.y=4;ctx.tickFPJourney(.016);place(-2);fp.pos.y=4;ctx.tickFPJourney(.016);
assert.equal(ctx.api.fpJourney.warp,0,'Passing above the roof does not teleport');
ctx.api.fpJourney.previous=null;
place(2);ctx.tickFPJourney(.016);place(.8);ctx.tickFPJourney(.016);
assert(ctx.api.fpJourney.warp>0);assert(!ctx.explorationActive,'Warp begins on home');
ctx.tickFPJourney(.7);assert(ctx.explorationActive,'World switches during the existing wormhole effect');
assert.equal(ctx.fpKeys.size,0,'No held movement carries through');
ctx.tickFPJourney(.7);assert.equal(ctx.api.fpJourney.warp,0);assert(ctx.api.fpJourney.overlay.hidden);
// Player-built transporters share the entry test, including transforms and raised terrain.
ctx.switchFPWorld(false);ctx.api.fpJourney.previous=null;
const built=new THREE.Group();built.position.set(4,2,-3);built.rotation.y=.7;built.scale.setScalar(1.7);
built.userData={kind:'house',buildingType:'transporter'};home.add(built);ctx.transporterObjects.add(built);built.updateWorldMatrix(true,false);
const builtPlace=depth=>{const q=built.localToWorld(new THREE.Vector3(.3,0,depth));fp.pos.copy(q);fp.pos.y+=.6;};
builtPlace(2);ctx.tickFPJourney(.016);builtPlace(.8);ctx.tickFPJourney(.016);assert(ctx.api.fpJourney.warp>0,'Placed, rotated, scaled and elevated transporter uses the wormhole');
ctx.cancelFPWarp();ctx.api.fpJourney.previous=null;home.remove(built);
builtPlace(2);ctx.tickFPJourney(.016);builtPlace(.8);ctx.tickFPJourney(.016);assert.equal(ctx.api.fpJourney.warp,0,'Removed transporter no longer triggers');
time=1000;ctx.escapeFP();assert(!ctx.explorationActive);assert(!fp.active);
ctx.tickFPJourney(.016);assert.equal(ctx.api.fpJourney.warp,0,'Return does not retrigger');
assert(html.includes('Walk (first-person home)') && html.includes('Walk (first-person other)'));
console.log('portal travel: home provider, boundaries, transporter entry/transforms/deletion, warp, safe return and direct Escape to perspective OK');
// Exercise the real entry/exit functions, including direct testing-mode switches.
Object.assign(ctx,{FP_FOV:55,FP_NEAR:.02,PERS_FOV_DEFAULT:50,PERS_NEAR_DEFAULT:.1,
 persCam:{updateProjectionMatrix(){}},renderer:{domElement:{}},excavation:{equipped:'hands'},
 fpToolMenu:{hidden:true},fpToolsToggle:{setAttribute(){}}});
ctx.document.body.classList={add(){},remove(){}};
const walkElements=new Map();ctx.document.getElementById=id=>{if(!walkElements.has(id))walkElements.set(id,{hidden:true});return walkElements.get(id);};
vm.runInContext('let minimapState=null;\n'+section('  function syncMinimapVisibility()', '  function requestMinimapRepaint()'),ctx);
ctx.trainingAppearance={active:false};ctx.equipExcavationTool=tool=>{ctx.excavation.equipped=tool;};
const toolAccess=html.indexOf('  function fpToolsAvailable()');
vm.runInContext(html.slice(toolAccess,html.indexOf('\n',toolAccess))
 +section('  function syncFPTools()', '  function excavationWithinReach('),ctx);
vm.runInContext(section('  function enterFP(',"  document.addEventListener('pointerlockchange'"),ctx);
ctx.exitFP();ctx.enterFP();assert(fp.active && !ctx.explorationActive,'Normal first person starts at home');
assert(walkElements.get('fp-tools').hidden,'Home entry hides walking tools');
ctx.enterFP({world:'other'});assert(ctx.explorationActive,'Testing view switches directly to endless');
assert(!walkElements.get('minimap-wrap').hidden,'Endless activation shows the minimap without a repaint');
assert(!walkElements.get('fp-tools').hidden,'Other-world entry shows walking tools');ctx.excavation.equipped='axe';ctx.fpToolMenu.hidden=false;
ctx.enterFP({world:'home'});assert(!ctx.explorationActive && fp.active,'Testing view switches directly home');
assert(walkElements.get('fp-tools').hidden&&ctx.fpToolMenu.hidden);assert.equal(ctx.excavation.equipped,'hands');
ctx.enterFP({world:'other'});ctx.exitFP();assert(!ctx.explorationActive && home.visible,'Exit restores home visibility');
assert(walkElements.get('minimap-wrap').hidden,'Direct exit hides minimap without needing a repaint');
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
assert(walkElements.get('fp-tools').hidden,'H return also hides walking tools');
assert.equal(ctx.document.pointerLockElement,ctx.renderer.domElement,'H retains pointer lock');
assert.equal(lockRequests,0,'H needs no new capture request or click');
const beforeLook=fp.yaw;
inputHandlers.mousemove({movementX:20,movementY:0});
assert(Math.abs(fp.yaw-(beforeLook-.044))<1e-12,'Mouse-look responds immediately after returning home');
pressHome();assert(fp.active && !ctx.explorationActive,'H at home does not exit first person');
ctx.exitFP();pressHome();assert(!fp.active,'H outside first person does not enter it');
console.log('portal travel: H preserves capture, restores home, cancels warp and immediately accepts mouse-look OK');

// Both native pointer unlock and Escape leave every walking world, even mid-warp.
for(const other of [false,true]) {
  for(const nativeUnlock of [false,true]) {
    ctx.enterFP({world:other?'other':'home'});
    ctx.api.fpJourney.warp=.3;
    ctx.document.pointerLockElement=ctx.renderer.domElement;
    ctx.document.exitPointerLock=()=>{ctx.document.pointerLockElement=null;inputHandlers.pointerlockchange();};
    if(nativeUnlock) {ctx.document.pointerLockElement=null;inputHandlers.pointerlockchange();}
    else inputHandlers.keydown({key:'Escape',repeat:false});
    assert(!fp.active && !ctx.explorationActive && home.visible,'Escape restores building world');
    assert(walkElements.get('minimap-wrap').hidden,'Escape and native unlock hide the minimap immediately');
    assert.equal(mode,'perspective');
    assert.equal(ctx.document.pointerLockElement,null,'Exit releases capture');
    assert.equal(ctx.api.fpJourney.warp,0,'Exit cancels portal travel');
  }
}
// The same wormhole works while the underlying building board is Territory.
ctx.territoryWorldState={active:true};
ctx.BattleBrosTerritoryWorld=require('../assets/territory-world');
ctx.enterFP({world:'home'});
fp.pos.set(20,2, -20);fp.yaw=.8;fp.pitch=.2;
const territoryReturn=fp.pos.clone();
ctx.switchFPWorld(true);
assert(ctx.explorationActive&&!home.visible,'Territory departure activates Endless terrain');
assert(ctx.territoryWorldState.active,'Underlying Territory board identity persists');
ctx.switchFPWorld(false);
assert(!ctx.explorationActive&&home.visible,'Return restores Territory terrain');
assert.equal(fp.pos.x,territoryReturn.x);assert.equal(fp.pos.z,territoryReturn.z);
assert.equal(fp.yaw,.8);assert.equal(fp.pitch,.2);
// A transporter entry must still start and complete the animated warp.
ctx.transporterObjects.clear();ctx.transporterObjects.add(gate);home.add(gate);
const outside=gate.localToWorld(new THREE.Vector3(0,.6,2));
const inside=gate.localToWorld(new THREE.Vector3(0,.6,.8));
fp.pos.copy(outside);ctx.api.fpJourney.previous=null;ctx.tickFPJourney(.016);
fp.pos.copy(inside);assert(ctx.tickFPJourney(.016));
assert(ctx.api.fpJourney.warp>0,'Territory entry starts wormhole animation');
ctx.tickFPJourney(.7);assert(ctx.explorationActive,'Territory warp midpoint enters Endless');
ctx.cancelFPWarp();ctx.switchFPWorld(false);
assert(fp.pos.distanceTo(new THREE.Vector3(outside.x,fp.pos.y,outside.z))<1e-8,'Return is outside entry volume');
assert(!ctx.tickFPJourney(.016),'Safe return does not immediately retrigger');
ctx.enterFP({world:'other'});
assert(!walkElements.get('minimap-wrap').hidden);ctx.exitFP();
assert(walkElements.get('minimap-wrap').hidden,'Endless exit restores Territory with no minimap');
console.log('Territory travel: actual entry, animated warp, Endless departure, same-board return and no immediate retrigger passed.');
