'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const encounter=require('../assets/battlebro-encounter.js'),load=require('./longneck-fixture');
const html=fs.readFileSync('index.html','utf8');
const {api,context,THREE}=load();
const terrain={group:api.worldGroup,worldToCell:(x,z)=>({x:Math.floor(x),z:Math.floor(z),islandId:'test'}),
 cellToWorld:(x,z)=>({x:x+.5,z:z+.5}),getCell:()=>({terrain:'stone',terrainFloors:1,islandId:'test'}),groundYAt:()=>0};
Object.assign(context,{explorationTerrain:terrain,explorationActive:true,activeFPTerrain:()=>terrain});
vm.runInContext(html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  function fpGroundYAt(')),context);
function actor(character,form,x){
 const root=api.createBattleBroCharacter({character,form,variant:'ice'});api.worldGroup.add(root);
 root.position.set(x+.5,character==='specter'?.72:0,.5);
 const a={root,character,phase:.4,x,z:0,islandId:'test',mover:{root,parts:root.userData.locomotionRig||root.userData.rig,state:'IDLE',progress:0,ikTarget:new THREE.Vector3()}};
 context.tickExplorationResidentMotion(a,0,0);a.motion.pause=Infinity;
 return a;
}
function controller(a){return a.character==='longneck'?api.ensureLongneckAnimation(a.mover)
 :a.character==='specter'?api.ensureSpecterAnimation(a.mover):api.ensureSupportAnimation(a.mover);}
function transforms(a){const values=[];a.root.traverse(n=>values.push(...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()));return values;}
function scenario(a,b){
 let player=a,npcs=[b],enabled=true,prompt=false,turnAllowed=true;
 const system=encounter.create({player:()=>player,npcs:()=>npcs,enabled:()=>enabled,
 available:a=>!!a.root.parent&&!!a.motion,controller,expressionName:()=> 'neutral',expression:()=>{},tickExpression:()=>{},
 carry:()=>true,canTurn:()=>turnAllowed,menu:v=>{prompt=v;}});
 const nativeTurns=new Set();
 let t=0;
 function tick(n=1){for(let i=0;i<n;i++){
   // The real resident adapter must yield to the encounter, preserving its route and timers.
   context.tickExplorationResidentMotion(a,t,.05);context.tickExplorationResidentMotion(b,t,.05);
   system.tick(t,.05);t+=.05;
   for(const side of system.active?.sides||[]){
    const m=side.session.state;
    const original=side.controller.mover;
    if(original.anchors?.includes(original.leftAnchor))assert(m.anchors.includes(m.leftAnchor),'Action contacts preserve shared anchor identity');
    if(m.state==='TURNING'&&(m.turn||m.longneckFootMotion)||m.state==='START_FLOAT'&&Math.abs(m.robeYaw)>.001)nativeTurns.add(side.actor);
   }
 }}
 return {system,tick,nativeTurns,get prompt(){return prompt;},player:v=>{player=v;},enabled:v=>{enabled=v;},turn:v=>{turnAllowed=v;}};
}
for(const family of ['longneck','juggernaut','monsters','specter'])for(let form=1;form<=7;form++){
 const a=actor(family,form,0),b=actor(family==='specter'?'juggernaut':'specter',form,8),s=scenario(a,b);
 s.tick();assert(s.system.active,`${family}/${form} triggers`);
 const before=[transforms(a),transforms(b)],positions=[a.root.position.clone(),b.root.position.clone()],yaw=[a.root.rotation.y,b.root.rotation.y];
 const phases=[a.mover.progress,b.mover.progress],pauses=[a.motion.pause,b.motion.pause];
 s.tick(15);assert(!s.prompt,'Notice precedes confirmation');
 assert.notDeepEqual(transforms(a),before[0],`${family}/${form}: family core supplies a nontrivial aggression pose`);
 for(let i=0;i<800&&!s.prompt;i++)s.tick();assert(s.prompt,`${family}/${form}: prompt follows native turn and square off`);
 assert(s.nativeTurns.has(a)&&s.nativeTurns.has(b),`${family}/${form}: both participants use authored contact or robe turns`);
 assert.equal(a.mover.progress,phases[0]);assert.equal(b.mover.progress,phases[1]);
 assert.equal(a.motion.pause,pauses[0]);assert.equal(b.motion.pause,pauses[1]);
 [a,b].forEach((a,i)=>assert(a.root.position.distanceTo(positions[i])<1e-8,'No encounter translation'));
 s.system.end(form%2?'yes':'no');assert(!s.prompt);for(let i=0;i<800&&s.system.active;i++)s.tick();
 assert(!s.system.active);assert(!a.encounter&&!b.encounter);
 assert.equal(a.mover.encounterStationary,undefined);assert.equal(b.mover.encounterStationary,undefined);
 [a,b].forEach((a,i)=>{assert.equal(a.root.rotation.y,yaw[i]);transforms(a).forEach((v,j)=>assert(Math.abs(v-before[i][j])<1e-7,'Exact pose restoration'));});
 s.tick(3);assert(!s.system.active,'No repeat at close range');
 const rebound={...a};s.player(rebound);s.system.tick(4,.05);assert(!s.system.active,'Transport rebinding preserves pair suppression');s.player(a);
 b.root.position.x=14.5;b.motion.pointX=14.5;b.x=14;s.tick();
 b.root.position.x=8.5;b.motion.pointX=8.5;b.x=8;s.tick();assert(s.system.active,'Separating past hysteresis rearms pair');
 s.system.cancel();a.root.parent.remove(a.root);b.root.parent.remove(b.root);
}
{
 const a=actor('longneck',4,0),b=actor('specter',7,30),s=scenario(a,b);
 s.tick();assert(!s.system.active,'NPC near camera alone cannot trigger');
 b.root.position.copy(a.root.position).add(new THREE.Vector3(0,11,0));s.system.tick(0,.05);assert(!s.system.active,'Distance includes vertical separation');
 b.root.position.copy(a.root.position).add(new THREE.Vector3(9,0,0));s.player(null);s.tick();assert(!s.system.active,'Stored or recalling companion cannot trigger');
 s.player(a);s.tick();assert(s.system.active);b.root.parent.remove(b.root);s.tick();assert(!s.system.active&&!a.encounter,'Removal cleans both participants');
 api.worldGroup.add(b.root);s.system.cancel();
 // A different NPC may trigger, but only one pair owns temporary state at a time.
 const c=actor('monsters',6,5),s2=scenario(a,c);s2.tick();assert(s2.system.active);s2.enabled(false);s2.tick();assert(!s2.system.active);
 const d=actor('juggernaut',1,6),s3=scenario(a,d);s3.tick();s3.turn(false);s3.tick();assert(!s3.system.active,'Unsafe footprint rotation aborts cleanly');
}
// Interrupted strides retain their existing controller and route progress through recovery.
for(const family of ['longneck','juggernaut','monsters','specter']){
 const a=actor(family,4,0),b=actor('specter',4,8);a.motion.pause=0;
 for(let i=0;i<12;i++)context.tickExplorationResidentMotion(a,i*.05,.05);
 const s=scenario(a,b);s.tick();const core=controller(a),progress=a.mover.progress,state=a.mover.state;
 for(let i=0;i<800&&!s.prompt;i++)s.tick();assert(s.prompt);assert.equal(a.mover.progress,progress);assert.equal(a.mover.state,state);
 s.system.end('no');for(let i=0;i<800&&s.system.active;i++)s.tick();assert.equal(controller(a),core);assert.equal(a.mover.progress,progress);
 assert(!a.encounter);context.tickExplorationResidentMotion(a,5,.05);
 assert.equal(controller(a),core,'Original controller resumes after interrupted stride');
 a.root.parent.remove(a.root);b.root.parent.remove(b.root);
}
// Large face-off turns must complete their authored steps before the question appears.
for(const family of ['longneck','juggernaut','monsters','specter']){
 const a=actor(family,4,0),b=actor('specter',1,8);a.root.rotation.y=-Math.PI/2;
 const s=scenario(a,b);s.tick();s.tick(30);assert(!s.prompt,'A large native turn delays the prompt');
 for(let i=0;i<1200&&!s.prompt;i++)s.tick();
 assert(s.prompt,`${family}: half turn completes`);
 assert(s.nativeTurns.has(a));assert(Math.abs(Math.atan2(Math.sin(a.root.rotation.y-Math.PI/2),Math.cos(a.root.rotation.y-Math.PI/2)))<.04);
 s.system.cancel();a.root.parent.remove(a.root);b.root.parent.remove(b.root);
}
// Exercise the actual browser adapter (expressions, terrain guards, menu and recall), using real rigs.
{
 const a=actor('longneck',4,0),b=actor('specter',7,8);
 const handlers={},menu={hidden:true,style:{},querySelector:()=>({focus(){}}),addEventListener:(k,fn)=>{handlers[k]=fn;}};
 Object.assign(context,{BattleBroEncounter:encounter,fp:{active:true},fpKeys:new Set(),trainingAppearance:{active:false},
  document:{getElementById:()=>menu,exitPointerLock(){}},renderer:{domElement:{requestPointerLock(){}}},testPlayer:a,testNPC:b});
 vm.runInContext("transportCubeController={phase:'deployed',root:testPlayer.root};testPlayer.root.userData.transportActor=testPlayer;explorationResidents.clear();explorationResidents.set('test',testNPC);",context);
 vm.runInContext(html.slice(html.indexOf('  const broEncounterMenu='),html.indexOf('  const FP_EYE_H =')),context);
 api.setBattleBroExpression(a.root,'littleSmile',{immediate:true});
 const update=(t)=>vm.runInContext(`broEncounter.tick(${t},.05)`,context);
 update(0);assert(a.encounter,'Production adapter detects released actor');
 for(let i=1;i<800&&menu.hidden;i++)update(i*.05);
 assert.equal(menu.hidden,false,'Production prompt opens after square off');
 assert.equal(a.root.userData.slots.face.userData.expression.name,'veryAngry');
 assert.equal(a.root.userData.expressionCycleEnabled,false);
 handlers.click({target:{dataset:{broChoice:'yes'}}});assert(menu.hidden);
 for(let i=0;i<800&&a.encounter;i++)update(40+i*.05);
 assert(!a.encounter&&!b.encounter);
 assert.equal(a.root.userData.slots.face.userData.expression.name,'littleSmile');
 assert.equal(a.root.userData.expressionCycleEnabled,false,'Original explicit expression preference survives');
 vm.runInContext("pauseTransportBattleBro(testPlayer.root);transportCubeController.phase='recall-flight';",context);
 update(5);assert(!a.encounter&&!b.encounter,'Recall ends encounters without starting another');
 vm.runInContext("bindTransportBattleBro(testPlayer.root);transportCubeController.phase='deployed';tickExplorationResidentMotion(testPlayer.root.userData.transportActor,5,.05);",context);
 update(5.1);
 assert(a.root.userData.transportActor.encounter&&b.encounter,'Releasing near the same NPC starts a fresh encounter without separation');
 for(let i=1;i<800&&menu.hidden;i++)update(5.1+i*.05);
 assert.equal(menu.hidden,false,'The same NPC prompts again after recall and release');
 vm.runInContext("pauseTransportBattleBro(testPlayer.root);transportCubeController.phase='recall-flight';",context);
 assert(menu.hidden&&!b.encounter,'Recalling during the new prompt also cleans up safely');
}
assert(html.includes('if(actor.encounter)return;'),'Resident navigation yields to temporary state');
assert(html.includes('broEncounter.resetDeployment(root)'),'Recall cancels and rearms before unbinding');
assert(html.includes('broEncounter.cancel(actor)'),'NPC disposal cancels before removal');
console.log('Encounter: 28 family/form pairs, Specter/ground poses, staged prompt, frozen navigation, both choices, exact recovery, native contact/robe turns and half turns, 3D range, rearm, removal and unsafe rotation passed.');
