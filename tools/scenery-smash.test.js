'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const THREE=require('../vendor/three/three.r128.min.js');
const filename=path.join(__dirname,'rock-battlebro.test.js');
let fixture=fs.readFileSync(filename,'utf8').split('const api = context.api;')[0];
fixture=fixture.replace("const getWorldCell = (x,z) => ({terrain: blocked.has(x+','+z) ? 'water' : 'grass'});",`const cells=new Map(),cellMeshes={};
const neighborInspectionState={active:false};
const M_ANIMAL={hoof:new THREE.MeshLambertMaterial({color:0x554433})};
const getWorldCell=(x,z)=>cells.get(x+','+z)||{terrain:'grass'};
const bfsHouseCluster=(x,z)=>getWorldCell(x,z+1).kind==='house'?[{x,z},{x,z:z+1}]:[{x,z}];
const withSetCellMutationAuthority=(authority,fn)=>fn();
const setCell=(x,z,c)=>{cells.set(x+','+z,c);cellMeshes[x+','+z]?.object?.removeFromParent();};
const renderCellObject=()=>{};
function obstacle(kind='house',buildingType=null){const object=new THREE.Group();worldGroup.add(object);cells.set('32,33',{terrain:'grass',kind,buildingType});cellMeshes['32,33']={object};return object;}
function distantBuilding(distance=2){const object=new THREE.Group(),key='32,'+(32+distance);worldGroup.add(object);cells.set(key,{terrain:'grass',kind:'house',buildingType:'tower'});cellMeshes[key]={object};return object;}`);
// Three r128 predates removeFromParent.
fixture=fixture.replace("cellMeshes[x+','+z]?.object?.removeFromParent();", "const object=cellMeshes[x+','+z]?.object;if(object?.parent)object.parent.remove(object);");
fixture=fixture.replace('globalThis.api = {','globalThis.api = {tickBipedSceneryContacts,lavaContactExtent,selectScenerySprintRoute,selectJuggernautJogRoute,createBattleBroCharacter,tryScenerySmash,tickScenerySmash,scenerySmashLocks,obstacle,distantBuilding,setCell,getWorldCell,createLongNeckBattleBro,createSpecterBattleBro,registerLavaMonsterMover,registerMinotaurMover,registerSpecterMover,minotaurMovers,tickMinotaurMovers,tryStartLongneckSprint,longneckSprintCell,canMinotaurRear,beginMinotaurRear,tickMinotaurRearing,');
fixture+='\nmodule.exports={...context.api,withRandom:(value,fn)=>{const previous=seededMath.random;seededMath.random=()=>value;try{return fn();}finally{seededMath.random=previous;}}};';
const Module=require('node:module'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(__dirname);m._compile(fixture,filename);const api=m.exports;
for(const type of ['monster','specter','longneck'])for(const form of [1,4,5,7]){
 const root=type==='monster'?api.createRockBattleBro({form}):type==='specter'?api.createSpecterBattleBro({form}):api.createLongNeckBattleBro({form});
 api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover=type==='monster'?api.registerLavaMonsterMover(root,32,32):type==='specter'?api.registerSpecterMover(root,32,32,0):api.registerMinotaurMover(root,32,32);
 api.obstacle();assert(api.tryScenerySmash(mover,true),type+form);
 if(type==='specter')assert(['specterArms','specterRock'].includes(mover.smash.style),'Specter uses a claw or orbiting rock strike');
 else assert.equal(mover.smash.style,type==='longneck'?'stomp':type==='monster'&&form<=4?'kick':form>=4?'arms':'headbutt');
 assert(mover.smashCooldown >= (type==='longneck'?10:25));
 assert(mover.smashCooldown < (type==='longneck'?20:50));
 const position=root.position.clone();
 for(let i=0;i<140;i++){
  api.tickScenerySmash(mover,i/60,1/60);
  if(i<83)assert.equal(api.getWorldCell(32,33).kind,'house','No early destruction');
  root.traverse(n=>assert(Number.isFinite(n.position.x+n.rotation.x),'Finite animation'));
 }
 assert.equal(api.getWorldCell(32,33).kind,null);assert.equal(api.getWorldCell(32,33).sceneryRubble,true);assert(mover.smash===null,'Strike finishes after recovery');
 assert(root.position.distanceTo(position)<1e-8);assert.equal(api.scenerySmashLocks.size,0);
 assert(!api.tryScenerySmash(mover,true),'Cooldown');
 mover.smashCooldown=0;api.obstacle();assert(api.tryScenerySmash(mover,true));
 api.setCell(32,33,{terrain:'grass',kind:'tree'});api.tickScenerySmash(mover,3,1/60);
 assert.equal(mover.smash,null);assert.equal(api.getWorldCell(32,33).kind,'tree','Stale target is preserved');
 mover.smashCooldown=0;const target=api.obstacle();assert(api.tryScenerySmash(mover,true));
 api.tickScenerySmash(mover,4,.05);
 api.worldGroup.remove(root);
 api.tickScenerySmash(mover,4.1,.05);
 assert(mover.smash===null,'Removing the actor cancels its strike');
 assert.equal(api.scenerySmashLocks.size,0,'Cancellation releases the scenery');
 assert.equal(target.scale.y,1,'Cancellation restores the target');
}
console.log('Scenery smash: body styles, impact timing, pose recovery, cooldowns, locks and replaced targets passed.');

for(const [character,form] of [['monsters',2],['juggernaut',6]]){
 const root=api.createBattleBroCharacter({character,variant:'lava',form});
 api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover=api.registerLavaMonsterMover(root,32,32);
 api.obstacle();assert(api.tryScenerySmash(mover,true),`${character} begins a scenery strike`);
 assert.equal(mover.smash.style,character==='juggernaut'?'kick':'arms');
 for(let i=0;i<140;i++)api.tickScenerySmash(mover,i/60,1/60);
 assert.equal(api.getWorldCell(32,33).kind,null,`${character} completes the strike`);
 api.worldGroup.remove(root);
}

{
 const root=api.createBattleBroCharacter({character:'juggernaut',variant:'lava',form:6});
 api.worldGroup.add(root);root.position.set(.5,0,.5);root.rotation.y=Math.PI/2;
 const mover=api.registerLavaMonsterMover(root,32,32),startAnchors=[mover.leftAnchor.clone(),mover.rightAnchor.clone()];
 api.obstacle();assert(api.tryScenerySmash(mover,true),'Juggernaut prepares a building kick');
 let previousYaw=root.rotation.y,maxYawStep=0,supportStepped=false;
 for(let i=0;i<500&&!mover.smash;i++){
  api.tickLavaMonsterMovers(i/60,1/60);
  maxYawStep=Math.max(maxYawStep,Math.abs(api.battleBroYawDelta(root.rotation.y-previousYaw)));previousYaw=root.rotation.y;
  supportStepped ||= mover.leftAnchor.distanceTo(startAnchors[0])>.02||mover.rightAnchor.distanceTo(startAnchors[1])>.02;
 }
 assert(mover.smash&&mover.smash.style==='kick','Juggernaut kicks after facing the building');
 const kickStart=mover.smash.kickLimb.position.clone();let kickMovedWhileTurning=supportStepped;
 for(let i=0;i<140;i++){
  const yawBefore=root.rotation.y;api.tickScenerySmash(mover,i/60,1/60);
  const yawStep=Math.abs(api.battleBroYawDelta(root.rotation.y-yawBefore));maxYawStep=Math.max(maxYawStep,yawStep);
  if(yawStep>.0001&&mover.smash?.kickLimb.position.distanceTo(kickStart)>.005)kickMovedWhileTurning=true;
 }
 assert(kickMovedWhileTurning,'A support visibly moves while the Juggernaut turns to kick');
 assert(maxYawStep<.1,'The Juggernaut does not snap-spin toward a building');
 api.worldGroup.remove(root);
}

{
 const root=api.createBattleBroCharacter({character:'juggernaut',variant:'lava',form:6});
 api.worldGroup.add(root);root.position.set(.5,0,.5);root.rotation.y=0;
 const mover=api.registerLavaMonsterMover(root,32,32);
 mover.juggernautJogCooldown=1000;
 api.obstacle('house','tower');
 for(const [x,z] of [[33,32],[31,32],[32,31]])api.setCell(x,z,{terrain:'grass',kind:'house',buildingType:'tower'});
 assert(api.chooseLavaWalkTarget(mover),'Juggernaut chooses a forward locomotion impact');
 assert.equal(mover.state,'JUGGERNAUT_STRIDE');
 assert(mover.juggernautImpact&&!mover.smash,'The building impact remains part of the walk rather than a kick action');
 let movedBeforeImpact=false;
 for(let i=0;i<500&&mover.state==='JUGGERNAUT_STRIDE';i++){
  api.tickLavaMonsterMovers(i/60,1/60);
  if(api.getWorldCell(32,33).kind==='house'&&root.position.z>.65)movedBeforeImpact=true;
 }
 assert(movedBeforeImpact,'Juggernaut walks into the building before destroying it');
 assert.equal(api.getWorldCell(32,33).kind,null,'Forward building is destroyed during the stride');
 assert.equal(api.getWorldCell(33,32).kind,'house','Nearby buildings do not redirect the impact stride');
 assert(Math.abs(root.position.z-1.5)<1e-8,'Juggernaut completes the stride through the former building cell');
 api.obstacle('house','skyscraper');mover.cellX=32;mover.cellZ=32;root.rotation.y=0;
 assert.equal(api.selectJuggernautImpactRoute(mover),null,'Protected skyscrapers remain locomotion blockers');
 api.worldGroup.remove(root);
}

{
 api.minotaurMovers.clear();
 const root=api.createLongNeckBattleBro({form:4});
 api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover=api.registerMinotaurMover(root,32,32);
 api.setCell(32,33,{terrain:'grass',kind:null});
 api.distantBuilding();
 assert(!api.withRandom(.5,()=>api.tryScenerySmash(mover,false)),'A failed roaming roll does not strike');
 assert(api.withRandom(.49,()=>api.tryScenerySmash(mover,false)),'A building beyond an empty tile is reachable on a successful roaming roll');
 assert.equal(mover.smash.style,'bite','A distant building uses the head bite');
 assert(mover.smashCooldown>=10 && mover.smashCooldown<20,'The longneck can strike again sooner');
 const mouth=mover.parts.jaw.getObjectByName('longneckLowerJaw');
 const start=mouth.getWorldPosition(new THREE.Vector3());
 let opened=false,contact=null;
 for(let i=0;i<140;i++){
  api.tickScenerySmash(mover,i/60,1/60);
  if(mover.smash?.parts.jaw.rotation.x>.38)opened=true;
  if(mover.smash?.impacted && !contact)contact=mouth.getWorldPosition(new THREE.Vector3());
 }
 assert(opened,'The distant bite opens its jaw before impact');
 assert(contact && contact.y<start.y-.25,'The head descends onto the building');
 assert(Math.abs(contact.z-api.tilePos(32,34).z)<.9,'The mouth reaches the distant building tile');
 assert.equal(api.getWorldCell(32,34).kind,null,'The distant building breaks on contact');
 assert.equal(api.getWorldCell(32,33).kind,null,'The intervening tile remains clear');
 mover.smashCooldown=0;
 api.distantBuilding();
 api.setCell(32,33,{terrain:'water',kind:null});
 assert(!api.withRandom(0,()=>api.tryScenerySmash(mover,false)),'The head strike does not cross water');
 api.obstacle();
 assert(!api.withRandom(0,()=>api.tryScenerySmash(mover,false)),'Roaming does not strike through an adjacent building');
 mover.smashCooldown=19;
 assert(api.tryScenerySmash(mover,true),'A trapped longneck strikes the adjacent building despite roaming cooldown');
 assert.equal(mover.smash.style,'stomp','A trapped longneck uses the rearback smash');
 for(let i=0;i<140;i++)api.tickScenerySmash(mover,i/60,1/60);
}
console.log('Longneck smash: adjacent stomp and two-tile building bite passed.');

for(let form=1;form<=7;form++){
 api.minotaurMovers.clear();
 const root=api.createLongNeckBattleBro({form});
 api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover=api.registerMinotaurMover(root,32,32);
 const distance=form<4?1:form<6?2:3;
 api.setCell(32,33,{terrain:'grass',kind:null});
 api.setCell(32,34,{terrain:'grass',kind:null});
 api.setCell(32,35,{terrain:'grass',kind:null});
 if(distance===1)api.obstacle();else api.distantBuilding(distance);
 if(distance===3){
  api.obstacle();
  assert(!api.withRandom(0,()=>api.tryScenerySmash(mover,false)),`Form ${form} does not strike through a building`);
  api.setCell(32,33,{terrain:'grass',kind:null});
 }
 assert(mover.longneckFootRest,'Every form has the planted-foot animation');
 assert(api.withRandom(.49,()=>api.tryScenerySmash(mover,false)),`Form ${form} starts a roaming head strike`);
 assert.equal(mover.smash.style,'bite');
 assert.equal(mover.smash.z,32+distance);
 const mouth=mover.parts.jaw.getObjectByName('longneckLowerJaw');
 let contact=null;
 for(let i=0;i<140;i++){
  api.tickScenerySmash(mover,i/60,1/60);
  if(mover.smash?.impacted && !contact)contact=mouth.getWorldPosition(new THREE.Vector3());
 }
 assert(contact && Math.abs(contact.z-api.tilePos(32,32+distance).z)<.9,
  `Form ${form} head reaches its ${distance}-tile target (contact ${contact?.z}, target ${api.tilePos(32,32+distance).z})`);
 assert.equal(api.getWorldCell(32,32+distance).kind,null);
 api.obstacle();mover.smashCooldown=19;
 assert(api.tryScenerySmash(mover,true),`Form ${form} can rearback while trapped`);
 assert.equal(mover.smash.style,'stomp');
 for(let i=0;i<140;i++)api.tickScenerySmash(mover,i/60,1/60);
 api.worldGroup.remove(root);
}
console.log('Longneck forms I–VII: roaming head strikes and trapped rearback smashes passed.');

for(let form=1;form<=7;form++){
 api.minotaurMovers.clear();
 const root=api.createLongNeckBattleBro({form});
 api.worldGroup.add(root);root.position.set(-11.5,0,-11.5);
 const mover=api.registerMinotaurMover(root,20,20);
 assert(api.canMinotaurRear(mover),`Form ${form} has safe rear supports`);
 api.beginMinotaurRear(mover);
 api.tickMinotaurRearing(mover,2.1);
 assert(mover.parts.rearingPivot.rotation.x<-.7,`Form ${form} raises its front body`);
 api.tickMinotaurRearing(mover,2.1);
 assert.equal(mover.state,'IDLE',`Form ${form} returns from the rear`);
 for(let z=21;z<=28;z++)api.setCell(20,z,{terrain:'grass',kind:null});
 assert(api.tryStartLongneckSprint(mover),`Form ${form} starts a gallop`);
 for(let i=0;i<75;i++)api.tickMinotaurMovers(i/60,1/60);
 assert.equal(mover.state,'GALLOPING',`Form ${form} uses the gallop animation`);
 root.traverse(node=>assert(Number.isFinite(node.position.x+node.rotation.x)));
 api.worldGroup.remove(root);
}
console.log('Longneck forms I–VII: rearing and galloping passed.');

for(const form of [1,2,3,4,5,6,7])for(const [kind,buildingType] of [['fence',null],['house','habitat']]){
 const root=api.createRockBattleBro({form});
 api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover=api.registerLavaMonsterMover(root,32,32);
 api.obstacle(kind,buildingType);
 assert(api.tryScenerySmash(mover,true),`Monster ${form} can strike ${buildingType||kind}`);
 assert.equal(mover.smash.style,'kick',`Monster ${form} kicks ${buildingType||kind}`);
 const limb=mover.parts.limbs?.[0]||mover.parts.leftArm?.shoulder;
 const startingPosition=limb.position.clone(),startingRotation=limb.rotation.clone();
 for(let i=0;i<140;i++){
  api.tickScenerySmash(mover,i/60,1/60);
  if(i===65)assert(limb.position.distanceTo(startingPosition)>.01,'The contact limb visibly swings');
 }
 assert(limb.position.distanceTo(startingPosition)<1e-8,'Kick position recovers');
 assert(Math.abs(limb.rotation.x-startingRotation.x)<1e-8,'Kick rotation recovers');
}
console.log('Scenery smash: all Monster forms kick fences and Habitats, then recover their support limbs.');

for(let form=1;form<=7;form++){
 api.minotaurMovers.clear();
 const root=api.createLongNeckBattleBro({form});
 api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover=api.registerMinotaurMover(root,32,32);
 mover.pauseRemaining=100;mover.rearingCooldown=100;mover.lookRemaining=100;
 mover.lookDirection=-1;
 for(let i=0;i<75;i++)api.tickMinotaurMovers(i/60,1/60);
 assert(mover.parts.neckPivot.rotation.y<-.1,'The neck looks to one side');
 assert(mover.parts.head.rotation.y<-.07,'The head follows the neck');
 mover.lookDirection=1;
 let maxJaw=0,minJaw=Infinity;
 for(let i=75;i<405;i++){
  api.tickMinotaurMovers(i/60,1/60);
  maxJaw=Math.max(maxJaw,mover.parts.jaw.rotation.x);
  minJaw=Math.min(minJaw,mover.parts.jaw.rotation.x);
 }
 assert(mover.parts.neckPivot.rotation.y>.1,'The neck looks to the other side');
 assert(mover.parts.head.rotation.y>.07,'The head turns with it');
 assert(maxJaw-minJaw>.2,'The mouth opens and closes while idle');
 api.worldGroup.remove(root);
}
console.log('Longneck forms I–VII: left/right look, neck follow and idle jaw cycle passed.');

// A house may be struck while another house occupies an adjacent tile.
{
 const root=api.createLongNeckBattleBro({form:4});
 api.worldGroup.add(root);root.position.set(.5,0,.5);
 root.rotation.y=Math.PI/2;
 const mover=api.registerMinotaurMover(root,32,32);
 api.obstacle();
 api.setCell(32,34,{terrain:'grass',kind:'house',buildingType:'habitat'});
 assert(api.tryScenerySmash(mover,true),'A tower in a house cluster can be targeted');
 api.tickScenerySmash(mover,0,1/60);
 assert(root.rotation.y>1.5,'The strike begins with a gradual turn');
 for(let i=0;i<140;i++)api.tickScenerySmash(mover,i/60,1/60);
 assert.equal(api.getWorldCell(32,33).kind,null,'Only the struck tower is removed');
 assert.equal(api.getWorldCell(32,34).kind,'house','The neighboring house survives');
 assert(Math.abs(root.rotation.y)<1e-8,'The actor keeps facing the impact after recovery');
 assert(mover.pauseRemaining>=1,'The actor pauses before choosing another direction');
}

{
 api.minotaurMovers.clear();
 const root=api.createLongNeckBattleBro({form:4});
 api.worldGroup.add(root);root.position.set(.5,0,.5);root.rotation.y=0;
 const mover=api.registerMinotaurMover(root,32,32);
 api.obstacle('house','tower');
 api.setCell(32,34,{terrain:'grass',kind:'crop'});
 for(let z=35;z<=39;z++)api.setCell(32,z,{terrain:'grass',kind:null});
 api.setCell(32,40,{terrain:'water',kind:null});
 api.setCell(31,32,{terrain:'grass',kind:'house',buildingType:'skyscraper'});
 assert.equal(api.longneckSprintCell(mover,32,40,32,39),null,'Water blocks a charge');
 assert.equal(api.longneckSprintCell(mover,31,32,32,32),null,'The Training Center is protected');
 assert(api.tryStartLongneckSprint(mover),'Form IV can begin a long straight sprint');
 assert.equal(mover.sprint.remaining,7,'The sprint continues across seven tiles before water');
 for(let i=0;i<50;i++)api.tickMinotaurMovers(i/60,1/60);
 assert.equal(api.getWorldCell(32,33).kind,'house','The tower remains until contact');
 assert.equal(mover.state,'GALLOPING','The sprint uses a distinct gallop state');
 const legs=mover.parts.minotaurLegs;
 let pairedBound=false;
 let minBodyY=Infinity,maxBodyY=-Infinity,minSpine=Infinity,maxSpine=-Infinity;
 let rearPlant=null,frontPlant=null,maxRearDrift=0,maxFrontDrift=0;
 for(let i=50;i<240;i++){
  api.tickMinotaurMovers(i/60,1/60);
  if(mover.state==='GALLOPING' && Math.abs(legs.frontLeft.position.y-legs.frontRight.position.y)<.035
    && Math.abs(legs.frontLeft.position.y-legs.rearLeft.position.y)>.04)pairedBound=true;
  if(mover.state==='GALLOPING'){
   minBodyY=Math.min(minBodyY,root.position.y);maxBodyY=Math.max(maxBodyY,root.position.y);
   minSpine=Math.min(minSpine,mover.parts.animalBody.scale.x);
   maxSpine=Math.max(maxSpine,mover.parts.animalBody.scale.x);
   const phase=mover.progress;
   if(phase>.11 && phase<.29){
    const contact=legs.rearLeft.getWorldPosition(new THREE.Vector3());
    if(rearPlant)maxRearDrift=Math.max(maxRearDrift,contact.distanceTo(rearPlant));
    rearPlant=contact;
   }else rearPlant=null;
   if(phase>.71 && phase<.85){
    const contact=legs.frontLeft.getWorldPosition(new THREE.Vector3());
    if(frontPlant)maxFrontDrift=Math.max(maxFrontDrift,contact.distanceTo(frontPlant));
    frontPlant=contact;
   }else frontPlant=null;
  }
 }
 assert(pairedBound,'Fore and hind legs bound in separate pairs');
 assert(maxBodyY-minBodyY>.1,'The entire body compresses and becomes airborne');
 assert(maxSpine-minSpine>.1,'The longitudinal body mass compresses and extends');
 assert(maxRearDrift<.04,`A supporting hind foot stays planted as the body passes over it: ${maxRearDrift}`);
 assert(maxFrontDrift<.04,`A supporting forefoot catches the body without sliding: ${maxFrontDrift}`);
 assert.equal(api.getWorldCell(32,33).kind,null,'The tower is trampled');
 assert.equal(api.getWorldCell(32,34).kind,null,'The crop is trampled');
 assert.equal(api.getWorldCell(32,40).terrain,'water','The blocked cell is preserved');
 assert.equal(mover.cellZ,39,'The sprint ends after seven tiles');
 assert.equal(mover.sprint,null,'Sprint state clears after landing');
}
console.log('Longneck sprint: continuous seven-tile gallop, paired bounds, trampling and water boundary passed.');

// Exercise the actual save tuple and import destructuring together.
const vm=require('node:vm'),source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const saveStart=source.indexOf('  function serializeCell('),saveEnd=source.indexOf('\n  }',saveStart)+4;
const importStart=source.indexOf('      let x, z, terrain',source.indexOf('    for (const entry of data.cells) {',source.indexOf('GRID = HOME_GRID_DEFAULT;',source.indexOf('function normalizeResourceDraftCell'))));
const importEnd=source.indexOf("      if (typeof x",importStart);
const persistence=vm.createContext({BASE_TERRAIN:'grass',terrainLevelForCell:c=>c.terrainFloors||1,normalizeBuildingType:v=>v||null,normalizeAppearance:v=>v||null});
vm.runInContext(source.slice(saveStart,saveEnd)+`\nfunction readRubble(entries){const result=[];for(const entry of entries){${source.slice(importStart,importEnd)}result.push(sceneryRubble===true);}return result;}`,persistence);
const tuple=persistence.serializeCell(3,4,{terrain:'grass',kind:null,sceneryRubble:true});
assert.equal(tuple[11],true);
assert.equal(JSON.stringify(persistence.readRubble([tuple,{x:3,z:4,terrain:'grass',kind:null,sceneryRubble:true},[3,4,'grass',null]])),'[true,true,false]');
console.log('Scenery rubble: saved tuple, object import and older saves passed.');

// Juggernaut and longneck share the actual route planner, including lookahead,
// heading preference, minimum distance, and all protected-cell boundaries.
{
 api.lavaMonsterMovers.clear();api.minotaurMovers.clear();
 const root=api.createBattleBroCharacter({character:'juggernaut',variant:'lava',form:6});
 api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover=api.registerLavaMonsterMover(root,32,32);
 for(let z=32;z<=40;z++)api.setCell(32,z,{terrain:'grass'});
 for(let z=33;z<=38;z++)api.setCell(32,z,{terrain:'grass',kind:'house',buildingType:'tower'});
 api.setCell(32,40,{terrain:'water'});
 const route=api.selectScenerySprintRoute(mover);
 assert.equal(route.length,7,'Same seven-cell route before water as the longneck');
 api.withRandom(.5,()=>assert.equal(api.selectJuggernautJogRoute(mover),null,'Same occasional start chance'));
 api.withRandom(0,()=>assert(api.chooseLavaWalkTarget(mover)));
 assert.equal(mover.juggernautJog.total,7);
 assert(mover.juggernautRun&&mover.state==='JUGGERNAUT_RUN','Run uses its own gait');
 const target={isActive:()=>true};
 assert.equal(api.telekineticRockThrow(root,target),false,'Plane attack cannot interrupt the jog');
 let steps=0;
 for(let frame=0;frame<1000&&mover.juggernautJog;frame++){
   api.tickLavaMonsterMovers(frame/60,1/60);
   if(mover.juggernautJog&&mover.cellZ>32+steps){
     steps++;
     assert.equal(api.telekineticRockThrow(root,target),false,'Plane attack cannot steal the between-step stance');
   }
 }
 assert.equal(mover.juggernautJog,null,'Jog ends after its planned route');
 assert.equal(mover.cellZ,39);assert(steps>=6,'All successive cells completed');
 for(let z=33;z<=38;z++)assert.equal(api.getWorldCell(32,z).kind,null,'Buildings trampled along entire route');
 assert.equal(api.getWorldCell(32,40).terrain,'water');
 assert(mover.juggernautJogCooldown>0,'Cooldown continues after landing');
 // Open routes are eligible too; buildings are not required by the longneck.
 mover.cellZ=32;root.position.set(.5,0,.5);mover.juggernautJogCooldown=0;
 api.setCell(32,40,{terrain:'grass'});
 assert.equal(api.selectScenerySprintRoute(mover).length,8,'Full longneck distance');
 api.withRandom(0,()=>api.chooseLavaWalkTarget(mover));
 api.setCell(32,33,{terrain:'grass',kind:'house',buildingType:'skyscraper'});
 api.tickLavaMonsterMovers(30,1/60);
 assert.equal(mover.juggernautJog,null,'Live protected barrier cancels the jog');
 assert.equal(mover.cellZ,32,'Does not enter the protected cell');
 assert.equal(api.getWorldCell(32,33).buildingType,'skyscraper');
 api.worldGroup.remove(root);
}
console.log('Juggernaut jog: shared longneck route, eight-cell maximum, building corridor, cooldown and live barrier passed.');

for(const character of ['juggernaut','monsters'])for(const form of (character==='monsters'?[1,4,6,7]:[4,7]))for(const variant of ['lava','sand']){
 api.lavaMonsterMovers.clear();api.minotaurMovers.clear();
 for(let x=29;x<=35;x++)for(let z=29;z<=42;z++)api.setCell(x,z,{terrain:'grass'});
 const root=api.createBattleBroCharacter({character,variant,form});
 api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover=api.registerLavaMonsterMover(root,32,32),scale=root.scale.x;
 api.withRandom(0,()=>assert(api.chooseLavaWalkTarget(mover)));
 assert.equal(mover.state,'JUGGERNAUT_RUN','Distinct running state');
 let minY=0,maxY=0,flights=0,plants=0,lastLanding=-1,previousZ=root.position.z;
 let loadedBend=null,pushBend=null;
 const lastPlants=[null,null];
 for(let frame=0;frame<900&&mover.juggernautJog;frame++){
   api.tickLavaMonsterMovers(frame/60,1/60);
   const run=mover.juggernautRun;if(!run)break;
   root.updateMatrixWorld(true);
   minY=Math.min(minY,root.position.y);maxY=Math.max(maxY,root.position.y);
   assert(root.position.z>=previousZ-1e-9,'Forward motion never reverses');previousZ=root.position.z;
   assert(Math.abs(mover.parts.torso.rotation.x)<=.056,'Steady small torso lean');
   if(run.finishing)continue;
   const p=run.elapsed/run.duration;
   const feet=[mover.parts.leftArm,mover.parts.rightArm].map((leg,i)=>{
     const foot=leg.hand.getWorldPosition(new THREE.Vector3());
     const target=(i?mover.rightAnchor:mover.leftAnchor).clone();target.y+=mover.terrainContacts[i].sole;
     assert(foot.distanceTo(target)<1e-5,`${character} ${variant} ${form}: articulated foot matches ${run.phase} target (${foot.distanceTo(target)})`);
     return foot.y-mover.terrainContacts[i].sole;
   });
   for(let i=0;i<2;i++){
     const anchor=i?mover.rightAnchor:mover.leftAnchor;
     if(run.contact[i]&&lastPlants[i])assert(anchor.distanceTo(lastPlants[i])<1e-8,'Planted foot does not slide');
     lastPlants[i]=run.contact[i]?anchor.clone():null;
   }
   if(p>.63&&p<.81){assert(feet.every(y=>y>.005*scale),'Both actual feet clear ground during flight');flights++;}
   if(run.landed&&lastLanding!==mover.cellZ){
     if(plants)assert.equal(run.landing,plants%2?0:1,'Left/right landings alternate');
     plants++;lastLanding=mover.cellZ;
   }
   const leg=run.support?mover.parts.rightArm:mover.parts.leftArm;
   const hip=leg.shoulder.getWorldPosition(new THREE.Vector3()),knee=leg.elbow.getWorldPosition(new THREE.Vector3()),foot=leg.hand.getWorldPosition(new THREE.Vector3());
   const bend=knee.clone().sub(hip).normalize().angleTo(foot.clone().sub(knee).normalize());
   if(p>.14&&p<.18)loadedBend=bend;
   if(p>.56&&p<.60)pushBend=bend;
 }
 assert(flights>30&&plants===8,'Eight alternating bounds include repeated flight phases');
 assert(maxY-minY>.27*scale,'Visible compression and vertical bounce');
 assert(loadedBend>pushBend+.05,'Planted leg extends from load into push-off');
 assert.equal(mover.state,'IDLE');assert.equal(mover.juggernautRun,null);
 assert.equal(mover.cellZ,40,'Run covers its full route');
 assert(Math.abs(mover.leftAnchor.y)<1e-8&&Math.abs(mover.rightAnchor.y)<1e-8,'Both feet settle to ground');
 api.worldGroup.remove(root);
}
console.log('Biped run: alternating contacts, actual airborne feet, planted stability, push-off extension, body bounce and final settle passed.');

for(const character of ['juggernaut','monsters']){
 api.lavaMonsterMovers.clear();api.minotaurMovers.clear();
 for(let x=25;x<=39;x++)for(let z=25;z<=39;z++)api.setCell(x,z,{terrain:'grass'});
 const root=api.createBattleBroCharacter({character,variant:'lava',form:6});
 api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover=api.registerLavaMonsterMover(root,32,32);
 const directions=[[1,0],[-1,0],[0,1],[0,-1]];
 for(let i=0;i<4;i++){
   const [dx,dz]=directions[i];
   mover.failedTerrain=new Map([[`${32+dx},${32+dz}`,100]]);
   const route=api.withRandom((i+.1)/4,()=>api.selectLavaWalkRoute(mover));
   assert(route&&route.x===32+dx&&route.z===32+dz,`${character}: first safe direction wins regardless of heading or history`);
   assert(route.plan,'The chosen route retains validated foot placement');
 }
 api.worldGroup.remove(root);
}
console.log('Shared wandering: Longneck direction order, randomized first-safe choice and preserved foot-placement validation passed.');

for(const character of ['monsters','juggernaut'])for(const form of [1,2,3,4,5,6,7])for(const kind of ['house','fence']){
 const root=api.createBattleBroCharacter({character,variant:'lava',form});
 api.worldGroup.add(root);root.position.set(.5,0,.5);
 const mover=api.registerLavaMonsterMover(root,32,32);
 const anchors=mover.anchors||[mover.leftAnchor,mover.rightAnchor];
 const extent=api.lavaContactExtent(mover,0,root.rotation.y);
 anchors.forEach(a=>a.set(-4,0,-4));
 anchors[0].set(.5-extent.x,0,1-extent.z-extent.hz+.01);
 api.obstacle(kind);
 anchors[0].z-=.03;
 api.tickBipedSceneryContacts(mover,.11);
 assert.equal(api.getWorldCell(32,33).kind,kind,'Scenery beyond the foot bounds is preserved');
 anchors[0].z+=.03;
 anchors[0].y=.2;
 api.tickBipedSceneryContacts(mover,.11);
 assert.equal(api.getWorldCell(32,33).kind,kind,'Airborne support preserves scenery');
 anchors[0].y=0;
 api.tickBipedSceneryContacts(mover,.11);
 assert.equal(api.getWorldCell(32,33).kind,null,`${character} ${form} crushes ${kind} at foot edge`);
 api.worldGroup.remove(root);
}
console.log('Scenery contacts: both families crush partial foot overlaps only at ground contact.');
