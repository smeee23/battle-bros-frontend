'use strict';
// Real r128 character factories and home controller, without starting the UI.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
module.exports=function loadLongneckFixture(sourcePath){
  const filename=path.join(__dirname,'rock-battlebro.test.js');
  let fixture=fs.readFileSync(filename,'utf8').split('const api = context.api;')[0];
  if(sourcePath)fixture=fixture.replace("path.join(__dirname, '../index.html')",JSON.stringify(sourcePath));
  fixture=fixture.replace('const M = {','const M_ANIMAL={hoof:new THREE.MeshLambertMaterial()}; const M = {');
  fixture=fixture.replace('globalThis.api = {','globalThis.api = {SPECTER_MOVE_STATE,chooseSpecterDestination,ensureSpecterAnimation,ensureMonsterAnimation,ensureSupportAnimation,ensureJuggernautAnimation,lavaMovementForm,poseDevelopingArms,registerSpecterMover,tickSpecterMovers,specterMovers,ensureLongneckAnimation,createLongNeckBattleBro,registerMinotaurMover,tickMinotaurMovers,minotaurMovers,beginLongneckFootMotion,');
  if(sourcePath)fixture=fixture.replace('ensureLongneckAnimation,createLongNeckBattleBro','createLongNeckBattleBro');
  const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(__dirname);
  loaded._compile(fixture+'module.exports={api:context.api,context,THREE};',filename);
  return loaded.exports;
};
