'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.join(__dirname,'rock-battlebro.test.js');
let fixture=fs.readFileSync(file,'utf8').split('const api = context.api;')[0];
fixture=fixture.replace('const M = {', 'const M_ANIMAL={hoof:new THREE.MeshLambertMaterial({color:0x241813})}; const M = {');
fixture=fixture.replace('const worldGroup = new THREE.Group();','const worldGroup = new THREE.Group(); let baseBattleBroPrototype=null; function disposeGroup() {}');
fixture=fixture.replace('globalThis.api = {','globalThis.api = {minotaurMovers, tickMinotaurMovers, specterMovers, tickSpecterMovers, selectBattleBroCharacterPreview, getPreview:()=>baseBattleBroPrototype,');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);m._compile(fixture+'module.exports={api:context.api,THREE};',file);
const {api,THREE}=m.exports;

for(const variant of ['lava','sand','plant','ice'])for(const form of [1,2,3,4,5,6,7]){
 const root=api.createBattleBroCharacter({character:'monsters',variant,form});
 const rig=root.userData.rig;
 assert(rig.head,'Primary head contract is preserved');
 {
  assert(rig.head2 && rig.head2!==rig.head,'Greater lineage has two separate heads');
  assert.equal(rig.head2.parent,rig.torso);
  assert(rig.head2.position.distanceTo(rig.head.position)>.8,'Heads are separated');
  assert(rig.secondFace.leftEye.children.length && rig.secondFace.rightEye.children.length,'Second head has both eyes');
  assert(root.userData.looseRocks.chunks.some(c=>c.node.name.endsWith('SecondNeckRock')),'Second neck has floating stone');
 }
 root.updateMatrixWorld(true);
 root.traverse(node=>assert(node.matrixWorld.elements.every(Number.isFinite),'Finite head and rock transforms'));
}
console.log('Greater heads: all forms and materials construct with valid primary rigs and separated, complete second heads.');
