'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.join(__dirname,'rock-battlebro.test.js');
let fixture=fs.readFileSync(file,'utf8').split('const api = context.api;')[0];
fixture=fixture.replace('const M = {','const M_ANIMAL={hoof:new THREE.MeshLambertMaterial({color:0x241813})}; const M = {');
fixture=fixture.replace('globalThis.api = {','globalThis.api = {applyBattleBroColors,BATTLEBRO_COLORS,');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(__dirname);
m._compile(fixture+'module.exports=context.api;',file);
const api=m.exports;
assert.equal(Object.keys(api.BATTLEBRO_COLORS).length,21);
for(const character of ['monsters','juggernaut','specter','longneck'])for(const variant of ['lava','ice','sand','plant','mushroom','gem','zebra','cheetah','rainbow','tiger','tieDye']) {
 const root=api.createBattleBroCharacter({character,variant,form:1});
 const originals=new Map();root.traverse(n=>{if(n.material)originals.set(n,n.material);});
 if(variant==='mushroom'){
  const caps=[],spots=[];root.traverse(n=>{if(n.name.startsWith('mushroomCap'))caps.push(n);if(n.name.startsWith('mushroomSpot'))spots.push(n);});
  assert(caps.length>0&&caps.length<=7,character+' has bounded mushroom growth');
  assert.equal(spots.length,caps.length*5,'Each cap has five white spots');
  for(const cap of caps){assert.equal(cap.material.color.getHex(),0xc92e28);assert(cap.geometry.userData.cached);}
 }
 const palette=api.ROCK_BATTLEBRO_M[variant],before=palette.core.color.getHex();
 api.applyBattleBroColors(root,{core:'blue',glow:'pink',eye:'green'});
 let changed=0;
 for(const [node,original] of originals){
  if(original===palette.core){assert.equal(node.material.color.getHex(),0x3b82f6);changed++;}
  if(original===palette.stone){
   assert.equal(node.material.color.getHex(),original.color.getHex(),'Outer base color is preserved');
   if(!original.userData.patternColor)assert.equal(node.material,original,'Unpatterned skin is preserved');
  }
 }
 if(character==='specter'){assert.equal(root.getObjectByName('floatingLavaCore').material[0].color.getHex(),0x3b82f6);}
 else assert(changed>0,character+' exposes a core');
 assert.equal(palette.core.color.getHex(),before,'Shared skin palette stays unchanged');
 const colored=new Map();root.traverse(n=>{if(n.material)colored.set(n,n.material);});
 api.applyBattleBroColors(root,{core:'blue',glow:'pink',eye:'green'});
 for(const [node,material] of colored)assert.deepEqual(node.material,material,'Repeated selections reuse cached materials');
 api.applyBattleBroColors(root,{core:'invalid',glow:'default',eye:'default'});
 for(const [node,material] of originals)assert.deepEqual(node.material,material,'Defaults restore original material identities');
}
for(const form of [5,6,7]) {
 const root=api.createBattleBroCharacter({character:'monsters',variant:'lava',form,colors:{core:'cyan'}});
 assert.equal(root.userData.colors.core,'cyan');
 let cores=0;root.traverse(n=>{if(n.material?.color?.getHex()===0x22d3ee)cores++;});
 assert(cores>0,'Specialized higher-form cores are recolored');
}
console.log('Character colors: 21 choices, four families, eleven skins, higher forms, isolation, caching and default restoration OK');

for(const character of ['monsters','juggernaut','specter','longneck'])for(let form=1;form<=7;form++) {
 const root=api.createBattleBroCharacter({character,variant:'rainbow',form});
 root.updateMatrixWorld(true);
 const entries=[];
 root.traverse(node=>{
  if(node.userData.rainbowProgress!==undefined)entries.push({node,t:node.userData.rainbowProgress,
   point:node.getWorldPosition(new node.position.constructor())});
 });
 assert(entries.length>0,character+' has rainbow stones');
 assert(entries.every(e=>Number.isFinite(e.t)&&e.t>=0&&e.t<=1));
 assert(Math.max(...entries.map(e=>e.t))-Math.min(...entries.map(e=>e.t))>.85,character+' spans the rainbow in form '+form);
 if(character==='monsters'){
  entries.sort((a,b)=>a.point.y-b.point.y);
  assert(entries[0].t>entries.at(-1).t,'Monster runs from head to toe');
 }else if(character==='specter'||character==='juggernaut'){
  entries.sort((a,b)=>a.point.x-b.point.x);
  assert(entries[0].t<entries.at(-1).t,'Colors run from left to right');
  if(character==='juggernaut'){
   const top=entries.reduce((a,b)=>a.point.y>b.point.y?a:b);
   assert(top.t>.25&&top.t<.75,'Crown is the middle of the rainbow arch');
  }
 }else{
  const head=entries.find(e=>e.node.name==='longneckUpperHead');
  const body=entries.filter(e=>/^longneckBodyBoulder/.test(e.node.name));
  assert.equal(head.t,0,'Longneck rainbow starts at the head');
  assert(body.every(e=>e.t>head.t),'Longneck continues down the neck into the body');
 }
 const duplicate=api.createBattleBroCharacter({character,variant:'rainbow',form});
 const shared=new Map(entries.map(e=>[e.t,e.node.material]));
 duplicate.traverse(node=>{const t=node.userData.rainbowProgress;if(shared.has(t))assert.equal(node.material,shared.get(t),'Rainbow palette is reused');});
}
console.log('Rainbow: all 28 forms, family directions, full spectrum, arch crown and shared palette OK');

for(const character of ['monsters','juggernaut','specter','longneck'])for(let form=1;form<=7;form++){
 const root=api.createBattleBroCharacter({character,variant:'tiger',form});
 const geometry=[];
 root.traverse(node=>{
  const coord=node.geometry?.attributes.tigerCoord;
  if(!coord)return;
  assert.equal(coord.count,node.geometry.attributes.position.count);
  assert(Array.from(coord.array).every(Number.isFinite),'Tiger coordinates are finite');
  assert(node.geometry.userData.cached,'Tiger geometry remains cached');
  geometry.push(node.geometry);
 });
 assert(geometry.length>0,character+' form '+form+' has tiger stripes');
 const duplicate=api.createBattleBroCharacter({character,variant:'tiger',form});
 const repeated=[];duplicate.traverse(node=>{if(node.geometry?.attributes.tigerCoord)repeated.push(node.geometry);});
 assert.equal(repeated.length,geometry.length);
 repeated.forEach((g,i)=>assert.equal(g,geometry[i],'Repeated tiger characters reuse geometry'));
 const plain=api.createBattleBroCharacter({character,variant:'lava',form});
 plain.traverse(node=>assert(!node.geometry?.attributes.tigerCoord,'Tiger mapping leaves other skins unchanged'));
}
console.log('Tiger: all 28 forms, finite stripe coordinates, shared geometry and skin isolation OK');

for(const variant of ['gem','zebra','tiger','cheetah']){
 const root=api.createBattleBroCharacter({character:'juggernaut',variant,form:7});
 const original=new Map();root.traverse(n=>{if(n.material)original.set(n,n.material);});
 for(const glow of ['cyan','black']){
  api.applyBattleBroColors(root,{core:'black',glow});
  let accents=0;
  for(const [node,material] of original){
   if(material===api.ROCK_BATTLEBRO_M[variant].core)assert.equal(node.material.color.getHex(),0,'Black core');
   if(material.userData?.patternColor){
    const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
    node.material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.skinPatternColor.value.getHex(),api.BATTLEBRO_COLORS[glow],'Selected stripe/dot color reaches shader');
    assert(shader.fragmentShader.includes('uniform vec3 skinPatternColor;'));
    assert.equal(node.material.color.getHex(),material.color.getHex(),'Pattern tint preserves base');
    assert.equal(node.material.customProgramCacheKey(),material.customProgramCacheKey(),'Clones preserve shader program');
    accents++;
   }else if(material===api.ROCK_BATTLEBRO_M.gem.ruby){
    assert.equal(node.material.color.getHex(),api.BATTLEBRO_COLORS[glow]);accents++;
   }
  }
  assert(accents>0,variant+' exposes skin accents');
 }
 api.applyBattleBroColors(root,{});
 for(const [node,material] of original)assert.deepEqual(node.material,material,'Defaults restore skin colors');
}
console.log('Skin accents: cyan/black gems, stripes and dots, black cores, shader hooks, base preservation and defaults OK');

for(const character of ['monsters','juggernaut','specter','longneck'])for(const variant of ['lava','gem','zebra','tiger','cheetah']){
 const root=api.createBattleBroCharacter({character,variant,form:7});
 api.worldGroup.add(root);
 api.tickBattleBroOrbitField(root,1/60);
 const debris=root.userData.looseRocks.debris;
 assert(debris.length>0,'Higher forms have orbit stones');
 assert(root.userData.looseRocks.orbitField?.parent===api.worldGroup,'Orbit field is a sibling');
 const originals=new Map();
 for(const pebble of debris)pebble.node.traverse(n=>{if(n.material)originals.set(n,n.material);});
 for(const glow of ['cyan','black']){
  api.applyBattleBroColors(root,{core:glow,glow});
  let updated=0;
  for(const [node,original] of originals){
   if(original.userData?.patternColor){
    const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};
    node.material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.skinPatternColor.value.getHex(),api.BATTLEBRO_COLORS[glow],'Detached orbit pattern updates immediately');updated++;
   }else if([api.ROCK_BATTLEBRO_M[variant].core,api.ROCK_BATTLEBRO_M[variant].crack,api.ROCK_BATTLEBRO_M[variant].accent,api.ROCK_BATTLEBRO_M[variant].ruby].includes(original)){
    assert.equal(node.material.color.getHex(),api.BATTLEBRO_COLORS[glow],'Detached orbit accent updates immediately');updated++;
   }
  }
  if(['zebra','tiger','cheetah'].includes(variant))assert(updated>0,character+' '+variant+' updates orbit colors without another tick');
 }
 api.applyBattleBroColors(root,{});
 for(const [node,original] of originals)assert.deepEqual(node.material,original,'Orbit defaults restore immediately');
 api.worldGroup.remove(root);
}
console.log('Orbit colors: all families, gems/stripes/dots, immediate live updates and default restoration OK');
