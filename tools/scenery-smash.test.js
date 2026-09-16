'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const filename=path.join(__dirname,'rock-battlebro.test.js');
let fixture=fs.readFileSync(filename,'utf8').split('const api = context.api;')[0];
fixture=fixture.replace("const getWorldCell = (x,z) => ({terrain: blocked.has(x+','+z) ? 'water' : 'grass'});",`const cells=new Map(),cellMeshes={};
const neighborInspectionState={active:false};
const M_ANIMAL={hoof:new THREE.MeshLambertMaterial({color:0x554433})};
const getWorldCell=(x,z)=>cells.get(x+','+z)||{terrain:'grass'};
const bfsHouseCluster=(x,z)=>[{x,z}];
const withSetCellMutationAuthority=(authority,fn)=>fn();
const setCell=(x,z,c)=>{cells.set(x+','+z,c);cellMeshes[x+','+z]?.object?.removeFromParent();};
const renderCellObject=()=>{};
function obstacle(){const object=new THREE.Group();worldGroup.add(object);cells.set('32,33',{terrain:'grass',kind:'house'});cellMeshes['32,33']={object};return object;}`);
// Three r128 predates removeFromParent.
fixture=fixture.replace("cellMeshes[x+','+z]?.object?.removeFromParent();", "const object=cellMeshes[x+','+z]?.object;if(object?.parent)object.parent.remove(object);");
fixture=fixture.replace('globalThis.api = {','globalThis.api = {tryScenerySmash,tickScenerySmash,scenerySmashLocks,obstacle,setCell,getWorldCell,createLongNeckBattleBro,createSpecterBattleBro,registerMinotaurMover,registerSpecterMover,');
fixture+='\nmodule.exports=context.api;';
const Module=require('node:module'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(__dirname);m._compile(fixture,filename);const api=m.exports;
for(const type of ['monster','specter','longneck'])for(const form of [1,4,5,7]){
 const root=type==='monster'?api.createRockBattleBro({form}):type==='specter'?api.createSpecterBattleBro({form}):api.createLongNeckBattleBro({form});
 api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover=type==='monster'?api.registerLavaMonsterMover(root,32,32):type==='specter'?api.registerSpecterMover(root,32,32,0):api.registerMinotaurMover(root,32,32);
 api.obstacle();assert(api.tryScenerySmash(mover,true),type+form);
 assert.equal(mover.smash.style,type==='longneck'?'stomp':type==='specter'||form>=4?'arms':'headbutt');
 const position=root.position.clone();
 for(let i=0;i<140;i++){
  api.tickScenerySmash(mover,i/60,1/60);
  if(i<83)assert.equal(api.getWorldCell(32,33).kind,'house','No early destruction');
  root.traverse(n=>assert(Number.isFinite(n.position.x+n.rotation.x),'Finite animation'));
 }
 assert.equal(api.getWorldCell(32,33).kind,null);assert.equal(api.getWorldCell(32,33).sceneryRubble,true);assert(mover.smash===null,'Strike finishes after recovery');
 assert(root.position.distanceTo(position)<1e-8);assert.equal(api.scenerySmashLocks.size,0);
 assert(!api.tryScenerySmash(mover,true),'Cooldown');
 mover.smashCooldown=0;api.obstacle();assert(api.tryScenerySmash(mover,true));
 api.setCell(32,33,{terrain:'grass',kind:'tree'});api.tickScenerySmash(mover,3,1/60);
 assert.equal(mover.smash,null);assert.equal(api.getWorldCell(32,33).kind,'tree','Stale target is preserved');
 mover.smashCooldown=0;const target=api.obstacle();assert(api.tryScenerySmash(mover,true));
 api.tickScenerySmash(mover,4,.05);
 api.worldGroup.remove(root);
 api.tickScenerySmash(mover,4.1,.05);
 assert(mover.smash===null,'Removing the actor cancels its strike');
 assert.equal(api.scenerySmashLocks.size,0,'Cancellation releases the scenery');
 assert.equal(target.scale.y,1,'Cancellation restores the target');
}
console.log('Scenery smash: body styles, impact timing, pose recovery, cooldowns, locks and replaced targets passed.');

// Exercise the actual save tuple and import destructuring together.
const vm=require('node:vm'),source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const saveStart=source.indexOf('  function serializeCell('),saveEnd=source.indexOf('\n  }',saveStart)+4;
const importStart=source.indexOf('      let x, z, terrain',source.indexOf('    for (const entry of data.cells) {',source.indexOf('GRID = HOME_GRID_DEFAULT;',source.indexOf('function normalizeResourceDraftCell'))));
const importEnd=source.indexOf("      if (typeof x",importStart);
const persistence=vm.createContext({BASE_TERRAIN:'grass',terrainLevelForCell:c=>c.terrainFloors||1,normalizeBuildingType:v=>v||null,normalizeAppearance:v=>v||null});
vm.runInContext(source.slice(saveStart,saveEnd)+`\nfunction readRubble(entries){const result=[];for(const entry of entries){${source.slice(importStart,importEnd)}result.push(sceneryRubble===true);}return result;}`,persistence);
const tuple=persistence.serializeCell(3,4,{terrain:'grass',kind:null,sceneryRubble:true});
assert.equal(tuple[11],true);
assert.equal(JSON.stringify(persistence.readRubble([tuple,{x:3,z:4,terrain:'grass',kind:null,sceneryRubble:true},[3,4,'grass',null]])),'[true,true,false]');
console.log('Scenery rubble: saved tuple, object import and older saves passed.');
