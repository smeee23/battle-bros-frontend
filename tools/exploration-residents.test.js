'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
const terrainFixture=fs.readFileSync('tools/exploration-world.test.js','utf8').split('const {terrain,scene,xrWorldRoot,context}=setup();')[0];
const {terrain,context}=new Function('require',terrainFixture+'return setup();')(require);
terrain.activate();
let created=0,disposed=0,motions=0;
Object.assign(context,{fp:{active:true,pos:new THREE.Vector3(),yaw:0},transportCube:{root:null},SPECTER_HOVER_CLEARANCE:1,
 createBattleBroCharacter(){created++;throw Error('Ambient residents must not create rigs');},disposeGroup(){disposed++;},
 broEncounter:{cancel(){}},tickBattleBroArenaActor(){}});
const source=html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  // ---------- transport cube'));
vm.runInContext(source+'\nthis.residents=explorationResidents;',context);
assert.equal(terrain.residentSpawns,undefined,'Terrain does not create ordinary NPC plans');
// Even a leftover provider cannot cause the removed ambient spawner to run.
terrain.residentSpawns=()=>[{id:'old-npc',x:15,z:0,islandId:'0,0:0'}];
for(let frame=0;frame<600;frame++)context.tickExplorationResidents(frame/60,1/60);
assert.equal(created,0);assert.equal(context.residents.size,0,'No ordinary NPC appears over time');
const ordinary=new THREE.Group();terrain.group.add(ordinary);
context.residents.set('old-npc',{root:ordinary,x:0,z:0});
context.tickExplorationResidents(11,1/60);assert.equal(ordinary.parent,null);assert.equal(context.residents.size,0,'Untagged legacy actors are removed');
assert.equal(disposed,1);
// Only the territory adapter supplies NFT actors. Movement stays in the same loop.
const root=new THREE.Group();terrain.group.add(root);
const actor={root,x:0,z:0,islandId:'0,0:0',broTokenId:'3',territoryLocationId:'2'};
context.residents.set('territory:2',actor);
context.residentSupport=()=>true;context.tickExplorationResidentMotion=()=>motions++;
context.tickExplorationResidents(12,1/60);assert.equal(context.residents.get('territory:2'),actor);assert.equal(motions,1);
context.fp.active=false;context.tickExplorationResidents(13,1/60);assert.equal(context.residents.size,0);assert.equal(root.parent,null,'Leaving exploration cleans up NFT actors');
assert.equal(created,0);
console.log('Endless residents: no ambient plans or rig creation, legacy NPC removal, NFT-only movement and exit cleanup passed');
