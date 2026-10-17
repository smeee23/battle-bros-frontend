'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const load=require('./longneck-fixture'),capture=require('./juggernaut-reference-capture');
const expected=require('./fixtures/juggernaut-home-reference.json'),actual=capture();
for(const key of Object.keys(expected))expected[key].forEach((row,i)=>row.forEach((v,j)=>
 assert(Math.abs(v-actual[key][i][j])<1e-7,`${key} ${i}/${j}: original home pose`)));
const html=fs.readFileSync('index.html','utf8');
function setup(form,resident){
 const {api,context,THREE}=load();
 const group=api.worldGroup,island=new THREE.Group();island.name='floating-fragment-test';group.add(island);
 const terrain={group,groundYAt:()=>0,worldToCell:(x,z)=>({x:Math.floor(x),z:Math.floor(z),islandId:'test'}),
  cellToWorld:(x,z)=>({x:x+.5,z:z+.5}),getCell:()=>({terrain:'stone',terrainFloors:1,islandId:'test'})};
 Object.assign(context,{explorationTerrain:terrain});
 vm.runInContext(html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  // ---------- transport cube ----------')),context);
 const root=api.createBattleBroCharacter({character:'juggernaut',form,variant:'ice'});group.add(root);root.position.set(.5,0,.5);
 let mover,actor;
 if(resident){actor={root,character:'juggernaut',phase:0,x:0,z:0,islandId:'test',mover:{root}};context.actor=actor;
  vm.runInContext('tickExplorationResidentMotion(actor,0,0)',context);mover=actor.mover;}
 else mover=api.registerLavaMonsterMover(root,32,32);
 mover.pauseRemaining=Infinity;mover.homeJumpWait=Infinity;
 if(actor)actor.motion.pause=Infinity;
 const animation=api.ensureJuggernautAnimation(mover);
 return {api,context,THREE,root,mover,actor,animation,
  tick(t,dt){if(actor)vm.runInContext(`tickExplorationResidentMotion(actor,${t},${dt})`,context);else api.tickLavaMonsterMovers(t,dt);}};
}
function pose(a){const p=a.mover.parts;return [a.root,p.rig,p.torso,p.head,...(p.limbs||[p.leftArm.shoulder,p.leftArm.elbow,p.leftArm.hand,p.rightArm.shoulder,p.rightArm.elbow,p.rightArm.hand])]
 .filter(Boolean).flatMap(n=>[...n.position.toArray(),...n.quaternion.toArray()]);}
for(let form=1;form<=7;form++){
 const home=setup(form,false),resident=setup(form,true);
 for(const a of [home,resident]){a.mover.state='TURNING';a.mover.desiredYaw=Math.PI/2;}
 for(let frame=0;frame<480;frame++){
  home.tick(frame/60,1/60);resident.tick(frame/60,1/60);
  const x=pose(home),y=pose(resident);
  // Stop after the common turn: the environment is allowed to select a different route afterwards.
  if(home.mover.state!=='TURNING')break;
  x.forEach((v,i)=>assert(Math.abs(v-y[i])<1e-7,`Form ${form}: home/resident turn ${frame}/${i}`));
 }
 const a=setup(form,false),m=a.mover;
 m.state='TURNING';m.desiredYaw=1;
 for(let frame=0;frame<45;frame++){
  const before=a.root.position.clone(),yaw=a.root.rotation.y;
  const proposal=a.animation.prepare({},1/60,frame/60);
  assert(a.root.position.equals(before));assert.equal(a.root.rotation.y,yaw,'Prepare leaves physical root to movement owner');
  a.root.position.copy(proposal.position);a.root.rotation.y=proposal.yaw;
  const resolved=a.root.position.clone(),resolvedYaw=a.root.rotation.y;
  a.animation.commit({grounded:true},frame/60,1/60);
  assert(a.root.position.equals(resolved));assert.equal(a.root.rotation.y,resolvedYaw,'Commit only poses rig');
 }
 const phase=m.turn.progress,anchors=(m.anchors||[m.leftAnchor,m.rightAnchor]).map(v=>v.clone());
 a.animation.prepare({},1/60,1);a.animation.commit({accepted:0,grounded:true},1,1/60);
 assert.equal(m.turn.progress,phase,'Rejected turn does not consume a contact phase');
 (m.anchors||[m.leftAnchor,m.rightAnchor]).forEach((v,i)=>assert(v.distanceTo(anchors[i])<1e-9));
 const drift=new a.THREE.Vector3(.3,0,-.2),oldSpeed=m.actualSpeed;
 a.root.position.add(drift);a.animation.carry(drift);
 a.animation.prepare({blocked:true},1/60,2);a.animation.commit({grounded:true},2,1/60);
 assert(m.actualSpeed<1e-8,'Support drift does not appear as locomotion velocity');
 a.root.position.set(9,0,9);a.animation.reset();
 for(const v of m.anchors||[m.leftAnchor,m.rightAnchor])assert(v.distanceTo(a.root.position)<3,'Relocation rebuilds nearby contacts');
 assert(!m.turn&&!m.terrainPlan&&!m.juggernautStride);assert.equal(m.state,'IDLE');
}
assert(html.includes("if(actor.character==='juggernaut')return tickJuggernautResidentMotion"),'Generic resident poses cannot also update Juggernaut');
console.log('Juggernaut: original home references, all seven shared home/resident turns, prepare/commit ownership, rejected phases, moving supports and contact reset passed.');
// Running contacts must describe the actual support sequence, including flight.
for(let form=4;form<=7;form++){
 const a=setup(form,false),m=a.mover;
 Object.assign(m,{startX:.5,startZ:.5,startY:0,targetX:.5,targetZ:1.5,targetY:0,targetCellX:32,targetCellZ:33,desiredYaw:0,juggernautJog:{support:0,total:1,remaining:1}});
 a.context.runMover=m;vm.runInContext('beginJuggernautRun(runMover)',a.context);
 let flight=false,landing=false;
 for(let frame=0;frame<90;frame++){
  a.tick(frame/120,1/120);
  if(m.juggernautRun?.phase==='FLIGHT'){flight=true;assert.equal(m.grounded,false);assert(m.supportContacts.every(v=>!v));}
  if(m.juggernautRun?.phase==='LAND'){landing=true;assert(m.supportContacts[m.juggernautRun.landing]);assert.equal(m.grounded,true);}
 }
 assert(flight&&landing,`Form ${form}: actual run flight and landing contacts`);
}

// Ordinary generated islands intentionally omit islandId from worldToCell.
// Exercise both production entry paths, rather than a fixture that supplies it.
{
 const terrainSource=fs.readFileSync('tools/exploration-world.test.js','utf8')
  .split('const {terrain,scene,xrWorldRoot,context}=setup();')[0];
 const terrain=new Function('require',terrainSource+'return setup().terrain;')(require);
 terrain.activate();
 const {api,context}=load();
 Object.assign(context,{explorationTerrain:terrain,explorationActive:true,activeFPTerrain:()=>terrain});
 vm.runInContext(html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  // ---------- transport cube ----------')),context);
 const start=html.indexOf('  // ---------- transport cube ----------');
 vm.runInContext(html.slice(start,html.indexOf('  function fpGroundYAt(',start)),context);
 let location;
 for(let x=-25;x<=25&&!location;x++)for(let z=-25;z<=25;z++){
  if(context.residentFlatCell(x,z)&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>context.residentFlatCell(x+dx,z+dz))){location={x,z};break;}
 }
 assert(location,'Generated terrain supplies a broad roaming patch');
 const {x,z}=location,point=terrain.cellToWorld(x,z),height=terrain.groundYAt(point.x,point.z);
 assert.equal(terrain.worldToCell(point.x,point.z,height+.1).islandId,undefined,'Regression exercises the real base-island API');
 const expectedIsland=terrain.getCell(x,z).islandId;
 for(const entry of ['resident','cube'])for(let form=1;form<=7;form++){
  const root=api.createBattleBroCharacter({character:'juggernaut',form,variant:'ice'});
  root.position.set(point.x,height,point.z);terrain.group.add(root);
  let actor;
  if(entry==='cube'){
   context.bindTransportBattleBro(root);actor=root.userData.transportActor;
  }else actor={root,character:'juggernaut',phase:0,x,z,mover:{root}};
  context.tickExplorationResidentMotion(actor,0,0);
  assert.equal(actor.islandId,expectedIsland,`${entry} ${form}: actual supporting island resolved`);
  actor.motion.pause=0;
  const origin=root.position.clone();let moved=false;
  for(let frame=1;frame<=1800;frame++){
   context.tickExplorationResidentMotion(actor,frame/60,1/60);
   moved ||= root.position.distanceTo(origin)>.05;
   if(actor.x!==x||actor.z!==z)break;
  }
  assert(moved,`${entry} ${form}: locomotion starts on generated terrain`);
  assert(actor.x!==x||actor.z!==z,`${entry} ${form}: completes a planned step`);
  assert(![...api.lavaMonsterMovers].some(m=>m.root===root),'Endless character is not registered for home updates');
  context.pauseTransportBattleBro(root);terrain.group.remove(root);
 }
 console.log('Juggernaut generated islands: all seven resident and cube-release forms resolve support and complete movement.');
}
