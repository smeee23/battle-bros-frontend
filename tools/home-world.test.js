'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
assert(!html.includes('territory-world-toggle')&&!html.includes('__toggleTerritoryWorld'),'Separate Territory World has no entry point');
assert(!html.includes('src="assets/territory-world.js"'),'The game does not load the retired board generator');
const start=html.indexOf('  function syncDefenseWeightVisibility()'),end=html.indexOf('  (function wireWorldMenu()',start);
let board={v:4,gridSize:50,environment:'EARTH',seed:'home',cells:[]},reject=false;
const section={hidden:false};
const context=vm.createContext({window:{},document:{getElementById:()=>section},explorationActive:false,trainingAppearance:{active:false},neighborInspectionState:{active:false},
  fp:{active:false},flight:{active:false},HOME_GRID_DEFAULT:50,saveTimer:0,clearTimeout(){},
  getSerializableWorldState:()=>structuredClone(board),
  applyState:(source,opts)=>{if(reject)return false;board=structuredClone(source);assert(opts.keepCamera);opts.onDone();return true;}});
vm.runInContext(html.slice(start,end),context);
(async()=>{
 const bridge=context.window.battleBrosWorldBridge;
 await bridge.open({kind:'home',id:'9007199254740993'},board);
 assert(bridge.matches({kind:'home',id:'9007199254740993'}));assert(!bridge.matches({kind:'home',id:'9007199254740992'}));
 const target=bridge.currentTarget();target.id='other';assert.equal(bridge.currentTarget().id,'9007199254740993');
 assert.deepEqual(bridge.captureHome(),board);
 const before=structuredClone(board);
 await assert.rejects(bridge.open({kind:'territory',id:'1'},{}),/Only Home worlds/);assert.deepEqual(board,before,'Retired targets cannot replace Home');
 assert(bridge.matches({kind:'home',id:'9007199254740993'}),'Rejected targets retain the current Home identity');
 for(const [key,object] of [['explorationActive',context],['active',context.trainingAppearance],['active',context.neighborInspectionState]]){
   object[key]=true;await assert.rejects(bridge.open({kind:'home',id:'2'},board),/Return to Home/);object[key]=false;
 }
 reject=true;await assert.rejects(bridge.open({kind:'home',id:'2'},board),/rejected/);assert.equal(bridge.currentTarget(),null,'A failed open cannot bind the previous world to a new NFT');
 console.log('Home world: retired Territory navigation, Home-only saves, target identity, mode guards and failed-load isolation passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
