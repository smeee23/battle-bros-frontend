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
 s.tick(7);assert(!s.prompt,'Prompt gives the encounter time to register');
 s.tick(9);assert(s.prompt,'Prompt appears at 0.8 seconds without waiting for turns');
 assert.notDeepEqual(transforms(a),before[0],`${family}/${form}: family core supplies a nontrivial aggression pose`);
 for(let i=0;i<800&&!s.prompt;i++)s.tick();assert(s.prompt,`${family}/${form}: prompt follows native turn and square off`);
 for(let i=0;i<800&&!s.system.active.settled;i++)s.tick();
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
// Large native turns continue while the early question is already visible.
for(const family of ['longneck','juggernaut','monsters','specter']){
 const a=actor(family,4,0),b=actor('specter',1,8);a.root.rotation.y=-Math.PI/2;
 const s=scenario(a,b);s.tick();s.tick(16);assert(s.prompt,'A half turn must not delay the prompt');
 assert(!s.system.active.settled,'Prompt is visible before the half turn finishes');
 for(let i=0;i<1200&&!s.system.active.settled;i++)s.tick();
 assert(s.prompt,`${family}: half turn completes`);
 assert(s.nativeTurns.has(a));assert(Math.abs(Math.atan2(Math.sin(a.root.rotation.y-Math.PI/2),Math.cos(a.root.rotation.y-Math.PI/2)))<.04);
 s.system.cancel();a.root.parent.remove(a.root);b.root.parent.remove(b.root);
}
// Exercise the actual browser adapter (expressions, terrain guards, menu and recall), using real rigs.
{
 const a=actor('longneck',4,0),b=actor('specter',7,8);
 const handlers={},menu={hidden:true,style:{},querySelector:()=>({focus(){}}),addEventListener:(k,fn)=>{handlers[k]=fn;}};
 const hud={hidden:true,focus(){},contains:()=>false,addEventListener(){},querySelectorAll:()=>[...buttons].filter(([id])=>/^practice-(shield|berserker)$/.test(id)).map(([,button])=>button)},buttons=new Map(),captures={};let pointerLockRequests=0;
 Object.assign(context,{BattleBroEncounter:encounter,fp:{active:true},fpKeys:new Set(),trainingAppearance:{active:false},
  fpToolMenu:{hidden:false},fpToolsToggle:{setAttribute(){}},
  createBattleBroPractice:require('../assets/practice-battle.js'),createBattleBroBattleActions:(three,hooks)=>require('../assets/character-battle-actions.js')(three,{...hooks,config:{normalDamage:8,berserkerDamage:32,energyPerHit:20}}),
  camera:new THREE.PerspectiveCamera(55,1,.02,2000),window:{addEventListener:(name,fn,options)=>{if(options?.capture)captures[name]=fn;}},
  document:{body:{classList:{toggle(){}}},getElementById:id=>{if(id==='bro-encounter-menu')return menu;if(id==='practice-battle-hud')return hud;if(!buttons.has(id))buttons.set(id,{hidden:true,dataset:{},style:{setProperty(key,value){this[key]=value;}},focus(){},contains:target=>['practice-berserker','practice-shield'].some(id=>buttons.get(id)===target||target?.control===buttons.get(id))});return buttons.get(id);},exitPointerLock(){}},renderer:{domElement:{clientWidth:1280,clientHeight:720,requestPointerLock(){pointerLockRequests++;}}},testPlayer:a,testNPC:b});
 vm.runInContext("transportCubeController={phase:'deployed',root:testPlayer.root,captures:0,capture(root){if(root!==this.root)return false;this.captures++;pauseTransportBattleBro(root);return true;}};testPlayer.root.userData.transportActor=testPlayer;explorationResidents.clear();explorationResidents.set('test',testNPC);",context);
 vm.runInContext(html.slice(html.indexOf('  const broEncounterMenu='),html.indexOf('  const FP_EYE_H =')),context);
 api.setBattleBroExpression(a.root,'littleSmile',{immediate:true});
 const update=(t)=>vm.runInContext(`broEncounter.tick(${t},.05)`,context);
 const shotCount=()=>vm.runInContext('practiceBattle.combat().shots',context);
 const ready=()=>vm.runInContext('practiceBattle.canAttack()',context);
 const click=(target=null,button=0)=>{
  let prevented=false;
  captures.click({target,button,preventDefault(){prevented=true;},stopImmediatePropagation(){}});
  const control=target?.control||target;if(!prevented&&!control?.disabled)control?.onclick?.();
 };
 const shoot=(button=0)=>{const before=shotCount();click(null,button);return shotCount()>before;};

 update(0);assert(a.encounter,'Production adapter detects released actor');
 for(let i=1;i<800&&menu.hidden;i++)update(i*.05);
 assert.equal(menu.hidden,false,'Production prompt opens before square off finishes');
 assert.equal(a.root.userData.slots.face.userData.expression.name,'veryAngry');
 assert.equal(a.root.userData.expressionCycleEnabled,false);
 handlers.click({target:{dataset:{broChoice:'yes'}}});assert(menu.hidden);
 assert.equal(hud.hidden,false,'Yes enters the production practice HUD');
 assert.equal(buttons.get('practice-health-0').value,100);assert.equal(buttons.get('practice-health-1').value,100);
 assert.equal(buttons.get('practice-energy-0').value,0);assert(buttons.get('practice-berserker').disabled,'Berserker starts unavailable');
 const emptyShots=shotCount();click(buttons.get('practice-berserker'));assert.equal(shotCount(),emptyShots,'Uncharged Berserker cannot attack');
 assert.equal(buttons.get('practice-berserker').style['--charge'],'0%');
 assert(!buttons.get('practice-health-anchor-0').hidden&&!buttons.get('practice-health-anchor-1').hidden,'Health labels appear next to both BROs');
 assert.equal(context.fpToolMenu.hidden,true,'Practice closes the walking-tools pause menu');
 for(const [name,key] of [['keydown','w'],['keydown','q'],['mousemove',null],['pointerdown',null]]){
  let prevented=false,stopped=false;captures[name]({key,target:null,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
  assert(prevented&&stopped,'Practice captures movement, tools and mouse input before exploration receives it');
 }
 assert(!shoot(2),'Right click does not attack');
 assert(shoot(),'Primary screen click uses the shared normal attack controller');
 assert(!shoot(),'Rapid duplicate click respects cooldown');
 assert.equal(buttons.get('practice-health-1').value,100,'UI does not damage on button press');
 let reacted=false;for(let i=0;i<400&&buttons.get('practice-health-0').value>0;i++){update(40+i*.05);reacted ||= !!b.root.userData.battleHit;}
 assert(reacted,'Production opponent plays the arena hit reaction');
 assert.equal(buttons.get('practice-health-1').value,92,'Successful shot updates opponent health');
 assert.equal(buttons.get('practice-health-0').value,0,'Opponent attacks reduce player health');
 assert(buttons.get('practice-battle-controls').hidden,'Completed battle hides the ability controls');
 assert.equal(a.root.userData.slots.face.userData.expression.name,'sad','Loss uses the existing sad expression');
 assert.equal(buttons.get('practice-battle-result').textContent,'You lose!');assert(!buttons.get('practice-battle-result').hidden);
 assert.equal(buttons.get('practice-battle-result').dataset.outcome,'loss');
 assert(buttons.get('practice-shield').disabled);assert(!shoot(),'Screen clicks cannot attack after defeat');
 buttons.get('practice-shield').onclick();
 let escaped=false;captures.keydown({key:'Escape',preventDefault(){},stopImmediatePropagation(){escaped=true;}});
 assert(escaped&&hud.hidden,'Escape immediately exits the result before three seconds');
 assert.equal(vm.runInContext('transportCubeController.captures',context),1,'Completed fight returns the player BRO to the cube');
 captures.keydown({key:'Escape',preventDefault(){},stopImmediatePropagation(){}});assert.equal(vm.runInContext('transportCubeController.captures',context),1,'Repeated exit cannot capture twice');
 for(let i=0;i<80;i++)update(60+i*.05);
 assert.equal(vm.runInContext('transportCubeController.captures',context),1,'Early Escape cancels pending automatic return');
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
 handlers.click({target:{dataset:{broChoice:'yes'}}});assert(!hud.hidden);
 assert(buttons.get('practice-battle-result').hidden,'A new battle clears the previous result');
 assert(!buttons.get('practice-battle-controls').hidden);assert(!buttons.get('practice-shield').disabled);
 assert.equal(buttons.get('practice-berserker').style['--charge'],'0%','New battle clears the button fill');
 let normals=0;
 for(let i=0;i<300&&buttons.get('practice-berserker').disabled;i++){
  if(normals<5&&ready()){assert(shoot());normals++;}
  update(80+i*.05);
 }
 assert.equal(normals,5);assert.equal(buttons.get('practice-energy-0').value,100);assert(!buttons.get('practice-berserker').disabled,'Five successful hits enable the real Berserker control');
 assert.equal(buttons.get('practice-health-1').value,60);
 assert.equal(buttons.get('practice-berserker').style['--charge'],'100%','Berserker fills as successful hits charge it');
 const shotsBeforeSpecial=shotCount();click({control:buttons.get('practice-berserker')});assert.equal(shotCount(),shotsBeforeSpecial+1,'Clicking inside Berserker executes one special and no normal attack');
 assert.equal(buttons.get('practice-berserker').style['--charge'],'0%','Special consumes its visible fill');assert.equal(buttons.get('practice-energy-0').value,0,'UI consumes charge immediately');
 for(let i=0;i<80&&buttons.get('practice-health-1').value===60;i++)update(100+i*.05);
 assert.equal(buttons.get('practice-health-1').value,28,'Berserker updates the real health meter on impact');
 const shieldHealth=buttons.get('practice-health-0').value,shieldShots=shotCount();click(buttons.get('practice-shield'));assert.equal(shotCount(),shieldShots,'Shield click does not leak into a normal attack');assert.equal(buttons.get('practice-health-0').value,shieldHealth,'Shield has no combat effect');
 for(let i=0;i<300&&buttons.get('practice-health-1').value>0;i++){
  if(ready())shoot();update(110+i*.05);
 }
 assert.equal(buttons.get('practice-health-1').value,0);assert.equal(buttons.get('practice-battle-result').textContent,'You win!');
 assert.equal(a.root.userData.slots.face.userData.expression.name,'bigSmile','Win uses the existing happy expression');
 assert(buttons.get('practice-battle-controls').hidden,'Results clear the combat controls');
 captures.keydown({key:'Tab',preventDefault(){},stopImmediatePropagation(){}});
 const finalHealth=buttons.get('practice-health-0').value;
 for(let i=0;i<59;i++)update(125+i*.05);
 assert(!hud.hidden,'Result remains visible until three seconds have elapsed');
 assert.equal(buttons.get('practice-health-0').value,finalHealth,'Opponent attacks stop after victory');
 assert.equal(buttons.get('practice-battle-result').dataset.outcome,'win');
 const locksBeforeReturn=pointerLockRequests;
 update(128);assert(hud.hidden,'Completed battle automatically closes at three seconds');
 assert.equal(pointerLockRequests,locksBeforeReturn,'Automatic return does not request gesture-only pointer lock');
 assert.equal(vm.runInContext('transportCubeController.captures',context),2,'Automatic close captures the BRO');
 for(let i=0;i<80;i++)update(130+i*.05);
 assert.equal(vm.runInContext('transportCubeController.captures',context),2,'Automatic return runs once');
 assert.equal(a.root.userData.slots.face.userData.expression.name,'littleSmile','Automatic return restores the original expression');
 vm.runInContext("pauseTransportBattleBro(testPlayer.root);transportCubeController.phase='recall-flight';",context);
 assert(menu.hidden&&!b.encounter,'Recalling during the new prompt also cleans up safely');
}
assert(html.includes('if(actor.encounter)return;'),'Resident navigation yields to temporary state');
assert(html.includes('broEncounter.resetDeployment(root)'),'Recall cancels and rearms before unbinding');
assert(html.includes('broEncounter.cancel(actor)'),'NPC disposal cancels before removal');
console.log('Encounter: 28 family/form pairs, Specter/ground poses, staged prompt, frozen navigation, both choices, exact recovery, native contact/robe turns and half turns, 3D range, rearm, removal and unsafe rotation passed.');
