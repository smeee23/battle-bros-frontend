'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const fixture=fs.readFileSync('tools/fp-camera.test.js','utf8').split('// Ground height matches')[0];
const {setup,run}=new Function('require',fixture+'return {setup,run};')(require);

const baseline={height:.6,fov:55,near:.02,lookahead:1,liftMax:1,liftLerp:8,stepLerp:14,
  landingDip:.01,landingDuration:.24,landingFullSpeed:3,fallThreshold:.25};
const worlds=[['Home',false],['Other World',true]];
let sharedLift;
for(const [name,other] of worlds){
  const flat=setup(()=>1,other);
  assert.equal(flat.fpGroundYAt(.5,.5),.6,name+' eye is 0.6 above ground');
  assert.deepEqual(JSON.parse(JSON.stringify(flat.settings)),baseline,name+' matches the previous Other World camera settings');
  run(flat,1);assert.equal(flat.camera.position.y,.6,name+' rendered camera preserves the height');
  const slope=setup((_,z)=>z<10?5:1,other);run(slope,1);
  assert(slope.fp.terrainLift>0&&slope.fp.terrainLift<=1,name+' anticipates terrain within the shared cap');
  if(sharedLift===undefined)sharedLift=slope.fp.terrainLift;
  else assert.equal(slope.fp.terrainLift,sharedLift,name+' uses identical lookahead and smoothing');
}
console.log('World camera: Home and Other World match previous Other World height 0.6, FOV, near plane, lookahead, lift, smoothing and landing settings');
