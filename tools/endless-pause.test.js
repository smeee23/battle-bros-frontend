'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('  function animate(now, xrFrame) {');
const animateSource=html.slice(start,html.indexOf('  // -------- resize --------',start));
const calls=[],frames=[];
const context={explorationActive:true,fp:{active:true,pos:{y:10},vy:-2},fpToolMenu:{hidden:true},
  docHidden:false,xrSession:null,longneckReview:null,battleArenaView:{active:false},practiceBattle:{active:false,restore:()=>calls.push('practice restore')},
  dropAnims:[],neighborPivotTween:null,homeTween:null,rippleAnims:[],unhatchedHome:null,
  broEncounterMenu:{hidden:true},flight:{active:false},crowdLayer:null,
  ENABLE_GHOST_BOARDS:false,pendingGhostBoards:[],ghostBoards:new Map(),cheapGhostTerrainBuckets:new Map(),
  animatedCellObjects:new Set(),smokeHouseObjects:new Set(),smokeParticles:[],MAX_SMOKE_PARTICLES:0,
  tickTrainingAppearance:()=>false,tickFPJourney:()=>false,useWindowedHomeRendering:()=>false,
  tickFP:dt=>{context.fp.vy-=.6*dt;context.fp.pos.y+=context.fp.vy*dt;},
  camera:{y:10},bro:{x:0,phase:0},
  tickExplorationResidents(t,dt){context.bro.x+=dt;context.bro.phase=Math.sin(t);frames.push({t,dt});},
  renderScene(){context.camera.y=context.fp.pos.y;calls.push('render');},window:{}};
// Keep every production subsystem in the actual render loop observable.
for(const name of ['tickDropAnims','tickNeighborPivotTween','tickHomeTween','tickOpacityTransitions','tickSquashAnims',
  'tickRippleAnims','tickMinimap','tickTransportCube','tickExcavation','tickFlightMode','tickWeather','tickShootingStar',
  'updateClouds','updateForceShieldMaterials','tickLavaMonsterMovers','tickMinotaurMovers','tickSpecterMovers',
  'tickVehicles','tickAstronauts','syncAmbientWalkVisibility','updateCropDuster','tickBattleBroPlaneAttacks',
  'updatePlasmaTurrets','updateAntiAirDefense','updateSmoke','updateXRFrame'])context[name]=()=>calls.push(name);
context.broEncounter={tick:()=>calls.push('encounter')};
context.window.__showcaseTick=()=>calls.push('camera showcase');
vm.createContext(context);
vm.runInContext('let prevT=0,smokeTimer=0,endlessMenuPauseStarted=null,endlessMenuPausedTime=0;'+animateSource,context);
const frame=ms=>context.animate(ms);
const snapshot=()=>JSON.stringify({fp:context.fp,camera:context.camera,bro:context.bro,calls,frames});
frame(1000);frame(1016);
assert(context.fp.pos.y<10,'Falling advances before the menu opens');
context.fpToolMenu.hidden=false;
const frozen=snapshot();
for(const ms of [1032,2000,30000,61032])frame(ms);
assert.equal(snapshot(),frozen,'Open Q menu freezes physics, BROs, camera, rendering and all animation subsystems');
context.fpToolMenu.hidden=true;frame(61048);
assert.equal(frames.at(-1).dt,0,'Resume does not integrate paused time into falling');
assert(Math.abs(frames.at(-1).t-1.032)<1e-9,'Absolute-time poses exclude the paused minute');
assert.equal(context.fp.pos.y,JSON.parse(frozen).fp.pos.y,'The first resumed frame preserves the airborne position');
assert.equal(context.fp.vy,JSON.parse(frozen).fp.vy,'The first resumed frame preserves falling velocity');
frame(61064);assert(context.fp.pos.y<JSON.parse(frozen).fp.pos.y,'Falling resumes normally');
context.fpToolMenu.hidden=false;frame(61080);const frozenAgain=snapshot();frame(121080);
assert.equal(snapshot(),frozenAgain,'Repeated menu visits freeze the same state');
context.fpToolMenu.hidden=true;frame(121096);
assert(Math.abs(frames.at(-1).t-1.064)<1e-9,'Repeated pauses accumulate without animation catch-up');
// The same menu retains its existing behavior outside Endless World.
context.explorationActive=false;context.fpToolMenu.hidden=false;
const homeY=context.fp.pos.y;frame(121112);assert(context.fp.pos.y<homeY,'Home is not paused by the Endless-only rule');
context.explorationActive=true;context.fpToolMenu.hidden=true;context.practiceBattle.active=true;
context.transportCube={root:null};context.fpEyeHeight=()=>.6;context.activeFPTerrain=()=>({tick:()=>calls.push('practice terrain')});
const practiceFP=JSON.stringify(context.fp),rendersBeforePractice=calls.filter(c=>c==='render').length;
frame(121128);assert.equal(JSON.stringify(context.fp),practiceFP,'Practice suspends ordinary walking/jumping physics');
assert(calls.includes('practice terrain'),'Practice keeps the island/terrain clock advancing');
assert(calls.lastIndexOf('practice restore')<calls.lastIndexOf('practice terrain'),'Hit offsets are restored before island/support checks');
assert.equal(calls.filter(c=>c==='render').length,rendersBeforePractice+1,'Practice uses the existing single render loop');
context.practiceBattle.active=false;context.fpToolMenu.hidden=false;
// Input can arrive before asynchronous pointer-lock release completes.
const inputs={};context.explorationActive=true;context.trainingAppearance={active:false};
const canvas={addEventListener:(name,fn)=>inputs[name]=fn};context.renderer={domElement:canvas};
context.document={pointerLockElement:canvas,addEventListener:(name,fn)=>inputs[name]=fn};
context.markCameraMoving=()=>{throw Error('Paused input must not move the camera');};
for(const [begin,end] of [
  ["  renderer.domElement.addEventListener('pointerdown'","  renderer.domElement.addEventListener('pointermove'"],
  ["  renderer.domElement.addEventListener('pointermove'","  renderer.domElement.addEventListener('pointerup'"],
  ["  renderer.domElement.addEventListener('wheel'",'  const MODAL_FOCUS_SELECTOR'],
  ["  document.addEventListener('mousemove', e =>", "  window.addEventListener('keydown', e =>"]
]){const at=html.indexOf(begin,html.indexOf('  function buildToolbar()'));vm.runInContext(html.slice(at,html.indexOf(end,at)),context);}
const beforeInput=snapshot();
for(const name of ['pointerdown','pointermove','wheel','mousemove'])inputs[name]({button:0,movementX:100,movementY:100,deltaY:100,preventDefault(){}});
assert.equal(snapshot(),beforeInput,'Paused mouse, wheel and touch handlers leave the camera unchanged');
console.log('Endless Q pause: all render-loop subsystems, airborne position/velocity, camera, repeated pauses, time continuity and Home isolation passed.');
