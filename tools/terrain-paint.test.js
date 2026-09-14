'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const start=source.indexOf('  function applyTool(x, z)'),end=source.indexOf('  async function applyAutoTool(',start);
let rejected=0;
const context=vm.createContext({setCellMutationAuthority:'test',isImmersiveReadOnlyMode:()=>false,
 trainingFacilityOccupiesCell:()=>null,window:{},world:[],selectedTool:{},BASE_TERRAIN:'stone',MAX_TERRAIN_FLOORS:64,
 CROP_KINDS:new Set(['crop']),terrainLevelForCell:c=>c.terrainFloors||1,
 resourceRuleForTool:()=>null,trySpendForPlacementWithReplacement:()=>true,
 playMockResourcePlacementSuccess:()=>{},rejectMockResourceMaxLevelAction:()=>rejected++,
 getWorldCell:(x,z)=>context.world[x][z],
 setCell:(x,z,opts)=>{context.world[x][z]={...context.world[x][z],...opts};}
});
vm.runInContext(source.slice(start,end),context);
const materials=['grass','path','water','dirt','sand','snow','stone','lava'];
for(const from of materials)for(const to of materials)for(const height of [1,3,27,64]) {
 context.window.__tinyworldSelection=null;
 context.world=[[{terrain:from,terrainFloors:height,kind:null,floors:1}]];
 context.selectedTool={terrain:to};context.applyTool(0,0);
 assert.equal(context.world[0][0].terrain,to);
 assert.equal(context.world[0][0].terrainFloors,from===to?Math.min(64,height+1):height,`${from} -> ${to} at ${height}`);
}
assert(rejected>0,'Same-material stacking still respects the cap');
for(const kind of ['house','crop','bridge']) {
 context.world=[[{terrain:'dirt',terrainFloors:24,kind,floors:3,buildingType:'tower'}]];
 context.selectedTool={terrain:'stone'};context.applyTool(0,0);
 assert.equal(context.world[0][0].terrainFloors,24,'Height preserved when hosted objects are kept or cleared');
}
context.world=[[{terrain:'grass',terrainFloors:12,kind:null}],[{terrain:'dirt',terrainFloors:50,kind:null}]];
context.window.__tinyworldSelection={cells:new Set(['0,0','1,0']),worldCoords:()=>[{x:0,z:0},{x:1,z:0}]};
context.selectedTool={terrain:'sand'};context.applyTool(0,0);
assert.equal(context.world[0][0].terrainFloors,12);
assert.equal(context.world[1][0].terrainFloors,50);
assert.equal(context.world[1][0].terrain,'sand');
console.log('Terrain paint: all eight materials preserve column height, same-material stacking/cap, hosted objects and bulk selection passed.');
