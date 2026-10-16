'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const fixture=fs.readFileSync('tools/fp-camera.test.js','utf8').split('// Ground height matches')[0];
const {setup,run}=new Function('require',fixture+'return {setup,run};')(require);

const homeFlat=setup(()=>1),otherFlat=setup(()=>1,true);
assert.equal(homeFlat.fpGroundYAt(.5,.5),.3);
assert.equal(otherFlat.fpGroundYAt(.5,.5),.6);
const homeSlope=setup((_,z)=>z<10?5:1),otherSlope=setup((_,z)=>z<10?5:1,true);
run(homeSlope,1);run(otherSlope,1);
assert(homeSlope.fp.terrainLift>0 && homeSlope.fp.terrainLift<=.5,'Home slope anticipation has a lower cap');
assert(homeSlope.fp.terrainLift<otherSlope.fp.terrainLift,'Home slopes keep the lower camera perspective');
assert.equal(otherSlope.fp.pos.y,.6,'Other-world physical eye height is unchanged');

console.log('World camera: home height 0.3, gentler home slope lift, other-world height 0.6 and original slope lift passed');
