'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fixture=fs.readFileSync('tools/fp-camera.test.js','utf8').split('// Ground height matches')[0];
const {setup,run}=new Function('require',fixture+'\nreturn {setup,run};')(require);
for(const hz of [20,60,120]) {
  const tapped=setup(()=>1),held=setup(()=>1);
  tapped.jump();held.pressSpace();
  run(tapped,2,hz);run(held,2,hz);
  assert.equal(held.fp.pos.y,tapped.fp.pos.y,'Holding Space preserves normal jump gravity');
  assert.equal(held.fp.vy,tapped.fp.vy,'Holding Space does not accelerate descent');
  held.releaseSpace();run(tapped,1,hz);run(held,1,hz);
  assert.equal(held.fp.vy,tapped.fp.vy,'Releasing Space leaves normal gravity unchanged');
  const falling=setup(()=>1),control=setup(()=>1);
  for(const player of [falling,control]){player.fp.pos.y+=10;player.fp.grounded=false;}
  falling.pressSpace();run(falling,1,hz);run(control,1,hz);
  assert.equal(falling.fp.pos.y,control.fp.pos.y,'Airborne Space cannot jump or increase gravity');
  assert.equal(falling.fp.vy,control.fp.vy,'Normal gravity also applies to ledge falls');
  run(falling,6,hz);assert(falling.fp.grounded);
  falling.pressSpace(true);run(falling,.2,hz);
  assert(falling.fp.grounded,'Holding Space through landing does not jump again');
  falling.releaseSpace();falling.pressSpace();
  assert(!falling.fp.grounded,'A fresh grounded press still jumps');
}
console.log('first-person jump controls: normal gravity on hold/release, airborne input and fresh presses passed');
