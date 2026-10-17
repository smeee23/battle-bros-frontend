'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {api,THREE}=require('./longneck-fixture')();
const create=require('../assets/longneck-animation');
const capture=require('./longneck-reference-capture');
const expected=require('./fixtures/longneck-home-reference.json');
const actual=capture();
for(const key of Object.keys(expected))for(let sample=0;sample<expected[key].length;sample++)
  expected[key][sample].forEach((value,i)=>assert(Math.abs(value-actual[key][sample][i])<1e-6,
    `${key} sample ${sample} component ${i}: home world-space pose preserved`));
function actor(form){
 const root=api.createLongNeckBattleBro({form}),parts=root.userData.rig;
 const mover={root,parts,state:'IDLE',progress:0,idlePhase:0,lookRemaining:999,lookDirection:0};
 return {root,mover,animation:create(THREE,mover,{random:()=>.5})};
}
const names=['frontLeft','frontRight','rearLeft','rearRight'];
for(let form=1;form<=7;form++){
 // Identical resolved motion is independent of the context owning navigation.
 const actors=['home','resident','transport'].map(()=>actor(form));
 for(let frame=0;frame<240;frame++)for(const a of actors){
  const turn=frame>=120;
  const oldPosition=a.root.position.clone(),oldYaw=a.root.rotation.y;
  const p=a.animation.prepareTravel({x:turn?3:0,z:3,speed:frame<80?.8:3,running:frame>=80,supportId:'island'},1/60);
  assert(a.root.position.equals(oldPosition));assert.equal(a.root.rotation.y,oldYaw);
  a.root.position.copy(p.position);a.root.rotation.y=p.yaw;
  const resolvedPosition=a.root.position.clone(),resolvedYaw=a.root.rotation.y;
  a.animation.commit({accepted:1,grounded:true},frame/60,1/60);
  assert(a.root.position.equals(resolvedPosition),'Commit cannot move physical root');
  assert.equal(a.root.rotation.y,resolvedYaw,'Commit cannot turn physical root');
 }
 const poses=actors.map(a=>{const result=[];a.root.traverse(n=>result.push(...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()));return result;});
 assert.deepEqual(poses[0],poses[1]);assert.deepEqual(poses[0],poses[2]);
 const a=actor(form),m=a.mover;
 let p=a.animation.prepareTravel({x:0,z:3,speed:1,supportId:'island'},.1);
 const contacts=m.longneckFootMotion,progress=m.progress;
 a.animation.commit({accepted:0,actualSpeed:0,grounded:true},0,.1);
 assert.equal(m.progress,progress,'Rejected movement does not advance gait');
 assert.equal(m.actualSpeed,0);assert.equal(m.grounded,true);
 p=a.animation.prepareTravel({x:0,z:3,speed:1,supportId:'island'},.1);
 assert.equal(m.longneckFootMotion,contacts,'A planted sequence persists across frames');
 a.root.position.lerp(p.position,.5);a.animation.commit({accepted:.5,grounded:true},.1,.1);
 const ease=v=>v*v*(3-2*v);
 assert(Math.abs(ease(m.progress)-ease(p.progress)*.5)<1e-8,'Partial movement reconciles eased travel rather than assuming linear phase');
 const before=contacts[0].start.clone();a.animation.carry(new THREE.Vector3(.3,.2,-.1));
 assert(contacts[0].start.distanceTo(before.add(new THREE.Vector3(.3,.2,-.1)))<1e-9,'Contacts follow their support');
 const stationary=actor(form),drift=new THREE.Vector3(.2,.1,-.3);
 stationary.animation.prepareTravel({x:0,z:0,speed:0},.1);stationary.animation.commit({grounded:true},0,.1);
 stationary.root.position.add(drift);stationary.animation.carry(drift);
 stationary.animation.prepareTravel({x:.2,z:-.3,speed:0},.1);stationary.animation.commit({grounded:true},.1,.1);
 assert(stationary.mover.velocity.length()<1e-9,'Support transport is not self-propelled movement');
 const strikeRotation=m.parts.minotaurLegs.frontLeft.rotation.clone();
 a.animation.interrupt();assert(m.parts.minotaurLegs.frontLeft.rotation.equals(strikeRotation),'Interrupt cannot overwrite an action pose');
 const jumpConfig={prepare:.18,land:.24,velocity:2.9};
 for(const phase of ['prepare','ascent','descent','landing']){
  const grounded=phase==='prepare'||phase==='landing';
  a.animation.commit({jump:{phase,elapsed:.15,vy:phase==='descent'?-1:1},jumpConfig,grounded},.2,.016);
  assert.equal(m.state,phase==='prepare'?'PREPARING_JUMP':phase==='landing'?'LANDING':'AIRBORNE');assert.equal(m.grounded,grounded);
  if(phase==='ascent'){
   assert(m.parts.minotaurLegs.frontLeft.rotation.z<0,'Front legs extend forward');
   assert(m.parts.minotaurLegs.rearLeft.rotation.z>0,'Rear legs extend backward');
  }
  names.forEach((name,i)=>assert.equal(m.parts.minotaurLegs[name].position.z,m.longneckFootRest[i].z,'Jump does not spread legs sideways'));
 }
 a.animation.commit({grounded:true},.3,.016);
 for(let i=0;i<120;i++){
  p=a.animation.prepareTravel({x:a.root.position.x,z:a.root.position.z,speed:0},1/60);
  a.animation.commit({grounded:true},i/60,1/60);
 }
 names.forEach((name,i)=>{
  assert.equal(m.parts.minotaurLegs[name].rotation.z,m.legAngles[i].upper.z,'Jump hip angle restored');
  assert.equal(m.parts.minotaurLegs[name].userData.lowerPivot.rotation.z,m.legAngles[i].lower.z,'Jump knee angle restored');
 });
 for(let i=0;i<20;i++)a.animation.commit({grounded:true},4.49,.016);
 a.animation.commit({grounded:true},5,.016);assert.equal(m.parts.leftEye.scale.y,1,'Blink never accumulates scale');
 assert(Number.isFinite(m.idlePhase),'All contexts initialize idle timing');
 a.animation.prepareTravel({x:10,z:10,speed:1,supportId:'new-island',discontinuity:true},.016);
 assert.notEqual(m.longneckFootMotion,contacts,'Recovery releases obsolete contacts');
}
const html=fs.readFileSync('index.html','utf8');
assert(html.includes('src="assets/longneck-animation.js"'),'Browser loads the same module tested by Node');
assert(!html.includes('const reach=Math.min(1.8,.55+pet.actualSpeed*.18)'),'Duplicate companion gait removed');
assert(!html.includes('const reach=flight*(front?-.72:.62)'),'Duplicate companion jump pose removed');
console.log('Longneck: home pose reference, shared replay, root ownership, contact persistence, rejected movement, support drift, seven-form jump/reset and blink regression checks passed.');
