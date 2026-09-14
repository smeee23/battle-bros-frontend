'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const world=Array.from({length:20},()=>Array.from({length:20},()=>({terrain:'stone',terrainFloors:1,kind:null,extras:[]})));
const listeners={},win={};let gold=100n,mutations=0,extrasRendered=0;
const tally=c=>BigInt((c.kind==='fence'?(c.floors||1):0)+(c.extras||[]).filter(e=>e.kind==='fence').reduce((n,e)=>n+(e.floors||1),0))*5n;
const noop=()=>{};
const ctx=vm.createContext({THREE,world,GRID:20,MAX_FLOORS:3,BATTLEBROS_MIGRATION_MODE:false,
  selectedTool:{kind:'fence'},ghostRotation:0,ghostPreview:null,xrWorldRoot:new THREE.Group(),
  hoverMesh:{visible:false,position:new THREE.Vector3()},currentHover:null,TOP_H:.18,BUILDABLE_LAND_Y_OFFSET:-.18,
  terrainConsumeLocks:new Map(),trainingFacilityOccupiesCell:(x,z)=>x===2&&z===2,
  catalogCellTotals:c=>({goldCost:tally(c)}),editableResourceBigInt:()=>gold,normalizeFenceSide:s=>s||'n',
  applyCatalogCellMutation(x,z,next){gold-=tally(next)-tally(world[x][z]);world[x][z]=next;mutations++;return true;},
  renderCellExtras(){extrasRendered++;},refreshVehiclesForWorldObstacleChange:noop,
  isImmersiveReadOnlyMode:()=>false,rejectMockResourceBuildAction:noop,playMockResourcePlacementSuccess:noop,
  fenceSideFromHover:()=>Math.abs(Math.round(ctx.ghostRotation/(Math.PI/2)))%2?'center-z':'center-x',
  makeFence:()=>new THREE.Mesh(new THREE.BoxGeometry(1,.3,.03),new THREE.MeshBasicMaterial()),
  tilePos:(x,z)=>({x:x-9.5,z:z-9.5}),terrainRiseAt:(x,z)=>(world[x][z].terrainFloors-1)*.2,fenceHeightForLevel:l=>l*.3,
  markCameraMoving:noop,pickNeighborSlot:()=>null,
  pickTile:(x,y)=>x<0?null:({x:Math.floor(x/10),z:Math.floor(y/10),worldX:x/10-9.5,worldZ:y/10-9.5}),
  window:{addEventListener(n,f){win[n]=f;}},
  document:{getElementById:()=>null,body:{classList:{toggle:noop}}},
  renderer:{domElement:{addEventListener(n,f){listeners[n]=f;},setPointerCapture:noop,classList:{add:noop,remove:noop}}},
  flight:{active:false},setHoveredNeighborSlot:noop,updateGhostPlacement:noop,updateSelectedBuildingStatus:noop,
  hoverHeightForCell:()=>0,panCameraByPixels:noop,updateCamera:noop,azimuth:0,polar:.7,
  setRectangleSelection:noop,clearSelection:noop,viewSize:20,clampViewSize:v=>v,onResize:noop,
});
const start=html.indexOf('  // -------- centered fence line placement --------');
vm.runInContext(html.slice(start,html.indexOf('  const MODAL_FOCUS_SELECTOR',start))+'\nthis.api={centeredFenceRun,planFenceRun,commitFenceRun,cancelFenceLine,state:fenceLineState};',ctx);
const {centeredFenceRun:run,planFenceRun:plan,commitFenceRun:commit,state}=ctx.api;
assert.equal(run({x:5,z:5},{x:8,z:7})[3].z,5,'Dominant X');
assert.equal(run({x:5,z:5},{x:4,z:1})[4].x,5,'Dominant negative Z');
assert.equal(run({x:5,z:5},{x:5,z:5},'center-z')[0].side,'center-z','Single click rotation');
const event=(x,y,id=1,extra={})=>({clientX:x,clientY:y,pointerId:id,pointerType:'mouse',button:0,shiftKey:true,preventDefault:noop,...extra});
listeners.pointerdown(event(50,50));listeners.pointermove(event(80,60));
assert.equal(mutations,0,'Preview never mutates');assert.equal(state.drag.run.length,4);assert(state.group.visible);
listeners.pointerup(event(80,60));assert.equal(mutations,4);assert.equal(gold,80n);assert(!state.group.visible);
for(let x=5;x<=8;x++){assert.equal(world[x][5].fenceSide,'center-x');assert.equal(world[x][5].offsetX,0);assert.equal(world[x][5].rotationY,0);}
ctx.ghostRotation=Math.PI/2;listeners.pointerdown(event(100,100,1,{shiftKey:false}));listeners.pointerup(event(101,101,1,{shiftKey:false}));
assert.equal(world[10][10].fenceSide,'center-z');
assert(commit([{x:10,z:10,side:'center-x'}]));assert.equal(world[10][10].extras[0].fenceSide,'center-x');assert(extrasRendered>0,'Existing intersections rendered');
world[11][11].kind='house';assert(commit([{x:11,z:11,side:'center-x'}]));assert.equal(world[11][11].kind,'house','Occupants preserved');
let before=mutations;gold=0n;assert(!commit(run({x:12,z:12},{x:15,z:12})));assert.equal(mutations,before,'Unaffordable run entirely rejected');gold=100n;
assert(!plan(run({x:1,z:2},{x:4,z:2})).ok,'Facility blocks whole run');
ctx.terrainConsumeLocks.set('12,12',{});assert(!plan([{x:12,z:12,side:'center-x'}]).ok);ctx.terrainConsumeLocks.clear();
world[12][12].kind='fence';world[12][12].floors=3;world[12][12].fenceSide='center-x';assert(!plan([{x:12,z:12,side:'center-x'}]).ok);
listeners.pointerdown(event(50,70));listeners.pointermove(event(80,70));listeners.pointercancel(event(80,70));assert(!state.drag);assert.equal(mutations,before,'Cancellation never builds');
listeners.pointerdown(event(50,70));listeners.pointerdown(event(60,70,2,{pointerType:'touch'}));assert(!state.drag,'Pinch cancels preview');listeners.pointerup(event(50,70));listeners.pointerup(event(60,70,2));assert.equal(mutations,before);
listeners.pointerdown(event(50,70));listeners.pointermove(event(80,70));listeners.pointerup(event(-1,70));assert.equal(mutations,before,'Release outside playable terrain cancels');
console.log('fence line: dominant axes, click rotation, previews, pointer commit/cancel/pinch, centered geometry, costs, protection and intersections passed');

const orbitBefore=ctx.azimuth, editsBefore=mutations;
listeners.pointerdown(event(50,50,1,{shiftKey:false}));
listeners.pointermove(event(80,60,1,{shiftKey:false}));
listeners.pointerup(event(80,60,1,{shiftKey:false}));
assert.notEqual(ctx.azimuth,orbitBefore,'Ordinary fence drag orbits');
assert.equal(mutations,editsBefore,'Orbit never places fences');
listeners.pointerdown(event(50,70));listeners.pointermove(event(80,70));
listeners.pointerdown(event(80,70,1,{button:2}));listeners.pointerup(event(80,70));
assert(!state.drag,'Right-click cancels fence placement');assert.equal(mutations,editsBefore);

assert.equal(run({x:5,z:5},{x:8,z:5},'center-z')[0].side,'center-x','X drag ignores N/S toggle');
assert.equal(run({x:5,z:5},{x:5,z:8},'center-x')[0].side,'center-z','Z drag ignores E/W toggle');
gold=100n;
world[15][15]={terrain:'stone',kind:'fence',floors:1,fenceSide:'center-z',extras:[]};
assert(commit([{x:15,z:15,side:'center-z'}]));assert.equal(world[15][15].floors,2,'Same orientation stacks');
assert(commit([{x:15,z:15,side:'center-x'}]));assert.equal(world[15][15].floors,2);assert.equal(world[15][15].extras[0].fenceSide,'center-x','Opposite orientation intersects');
const buttons=['center-z','center-x'].map(side=>({dataset:{fenceSide:side},setAttribute(k,v){this[k]=v;}}));
const stored={};let ghostUpdates=0;
const orientationCtx=vm.createContext({singleFenceSide:'center-x',ghostRotation:0,document:{querySelectorAll:()=>buttons},localStorage:{setItem(k,v){stored[k]=v;}},updateGhostPlacement(){ghostUpdates++;}});
const orientationStart=html.indexOf('  function setSingleFenceOrientation(');
vm.runInContext(html.slice(orientationStart,html.indexOf("\n  document.querySelectorAll('[data-fence-side]').forEach(button => {",orientationStart))+ '\nthis.setOrientation=setSingleFenceOrientation;',orientationCtx);
orientationCtx.setOrientation('center-z');
assert.equal(orientationCtx.ghostRotation,Math.PI/2);assert.equal(buttons[0]['aria-pressed'],'true');assert.equal(stored['battlebros:fence-orientation'],'center-z');assert.equal(ghostUpdates,1);
orientationCtx.setOrientation('center-x');assert.equal(orientationCtx.ghostRotation,0);assert.equal(buttons[1]['aria-pressed'],'true');

const junctionWorld=Array.from({length:3},()=>Array.from({length:3},()=>({extras:[]})));
const material=new THREE.MeshBasicMaterial();
const junctionCtx=vm.createContext({THREE,world:junctionWorld,MAX_FLOORS:3,
 FENCE_SIDES:new Set(['n','s','e','w','center-x','center-z']),
 fenceHeightForLevel:l=>l, getBoxGeometry:(...args)=>new THREE.BoxGeometry(...args),
 M:{greenhouseFrame:material,habitatLight:material,greenhouseGlass:material},castReceive:()=>{}});
const junctionStart=html.indexOf('  function fenceCornerSpan(');
vm.runInContext(html.slice(junctionStart,html.indexOf('  const CROP_DOME_SIZE',junctionStart))+'\nthis.span=fenceCornerSpan;this.make=makeFence;',junctionCtx);
for(let mask=0;mask<16;mask++) {
 junctionWorld[1][1]={kind:'fence',fenceSide:'center-x',floors:1,extras:[{kind:'fence',fenceSide:'center-z',floors:3}]};
 [[0,1,'center-x'],[2,1,'center-x'],[1,0,'center-z'],[1,2,'center-z']].forEach(([x,z,side],bit)=>{
   junctionWorld[x][z]=mask&(1<<bit)?{kind:'fence',fenceSide:side}:{extras:[]};
 });
 let centerPosts=0;
 for(const [axis,negative,positive] of [['center-x',1,2],['center-z',4,8]]) {
   const span=junctionCtx.span(1,1,axis);
   if(mask===15){assert.equal(span,null,'Only a four-way continuation stays a full cross');continue;}
   assert.equal(span.start,mask&negative?-.5:0);assert.equal(span.end,mask&positive?.5:0);
   const mesh=junctionCtx.make(axis,axis==='center-x'?1:3,span);
   centerPosts+=mesh.children.filter(m=>m.geometry.parameters.width===.055 && m.position.x===0 && m.position.z===0).length;
   for(const panel of mesh.children.filter(m=>m.userData.noShadow)) {
     const alongX=axis==='center-x';
     const center=alongX?panel.position.x:panel.position.z;
     const length=alongX?panel.geometry.parameters.width:panel.geometry.parameters.depth;
     assert.equal(center-length/2,span.start);assert.equal(center+length/2,span.end);
   }
 }
 if(mask!==15)assert.equal(centerPosts,1,'Each endpoint junction has exactly one shared post');
}
console.log('Fence junctions: all 16 neighbor combinations, exact panel endpoints and shared posts passed');
