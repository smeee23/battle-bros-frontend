'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const rules=require('../assets/battlebro-terrain'),load=require('./longneck-fixture');
const fixture=fs.readFileSync('tools/exploration-world.test.js','utf8').split('const {terrain,scene,xrWorldRoot,context}=setup();')[0];
const terrain=new Function('require',fixture+'return setup().terrain;')(require);terrain.activate();
const {api,context,THREE}=load(),html=fs.readFileSync('index.html','utf8');
Object.assign(context,{explorationTerrain:terrain,explorationActive:true,activeFPTerrain:()=>terrain,
 fp:{pos:new THREE.Vector3(100,.6,100),yaw:0}});
vm.runInContext(html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  function fpGroundYAt(')),context);
// Original reported failure: valid cube location on untouched entry terrain,
// rejected by the old 5x5 rule for every family.
for(const character of ['longneck','juggernaut','monsters','specter']){
 const root=api.createBattleBroCharacter({character,form:4,variant:'ice'}),p=terrain.cellToWorld(-4,-1);
 context.baseBattleBroPrototype=root;const landing=context.transportLanding(p.x,p.z);
 assert(landing,character+': original entry location accepts placement');
 root.position.set(p.x,landing.y+(character==='specter'?vm.runInContext('SPECTER_HOVER_CLEARANCE',context):0),p.z);
 terrain.group.add(root);context.bindTransportBattleBro(root);
 const actor=root.userData.transportActor;context.tickExplorationResidentMotion(actor,0,0);actor.motion.pause=0;
 let moved=false;
 for(let frame=1;frame<=1800;frame++){
  context.tickExplorationResidentMotion(actor,frame/60,1/60);
  if(actor.x!==-4||actor.z!==-1){moved=true;break;}
 }
 assert(moved,character+': completes a step at the previously stuck procedural location');
 context.pauseTransportBattleBro(root);terrain.group.remove(root);
}
let center;
for(let x=-35;x<=35&&!center;x++)for(let z=-35;z<=35;z++){
 const c=terrain.getCell(x,z);if(!c)continue;
 let safe=true;for(let dx=-4;dx<=4&&safe;dx++)for(let dz=-4;dz<=4;dz++)if(terrain.getCell(x+dx,z+dz)?.islandId!==c.islandId){safe=false;break;}
 if(safe){center={x,z,islandId:c.islandId};break;}
}
assert(center,'Actual generated island has a test patch');
const {x,z,islandId}=center;
function patch(fn){for(let dx=-4;dx<=4;dx++)for(let dz=-4;dz<=4;dz++)assert(terrain.setCell(x+dx,z+dz,{terrain:'stone',kind:null,extras:[],terrainFloors:2,...fn(dx,dz)}));}
const point=terrain.cellToWorld(x,z,islandId);
// A real two-level rocky terrace, with different support heights under one body.
patch((dx,dz)=>({terrainFloors:dz>=1?3:2}));
for(const character of ['longneck','juggernaut','monsters','specter'])for(let form=1;form<=7;form++){
 const root=api.createBattleBroCharacter({character,form,variant:'ice'}),shape=rules.profile(root);
 context.baseBattleBroPrototype=root;
 const placement=context.transportLanding(point.x,point.z);
 assert(placement,`${character} ${form}: modest terrace accepts cube`);
 assert(placement.y>=.2-1e-6&&placement.y<=.4+1e-6);
 root.position.set(placement.x,placement.y+(character==='specter'?vm.runInContext('SPECTER_HOVER_CLEARANCE',context):0),placement.z);
 terrain.group.add(root);context.bindTransportBattleBro(root);
 const actor=root.userData.transportActor;
 context.tickExplorationResidentMotion(actor,0,0);actor.motion.pause=0;
 if(actor.mover.terrainContacts){
  const m=actor.mover,anchors=m.anchors||[m.leftAnchor,m.rightAnchor];root.updateMatrixWorld(true);
  anchors.forEach((anchor,i)=>{
   const foot=m.parts.limbs?.[i]||m.parts[i?'rightArm':'leftArm'].hand;
   assert(Math.abs(foot.getWorldPosition(new THREE.Vector3()).y-anchor.y-m.terrainContacts[i].sole)<1e-5,
    character+' '+form+': rendered support matches terrain contact');
  });
 }
 const origin=root.position.clone();let moved=false;
 for(let frame=1;frame<=2100;frame++){
  context.tickExplorationResidentMotion(actor,frame/60,1/60);
  moved ||= Math.hypot(root.position.x-origin.x,root.position.z-origin.z)>.1;
  if(actor.x!==x||actor.z!==z)break;
 }
 assert(moved&& (actor.x!==x||actor.z!==z),`${character} ${form}: uneven release resumes and completes movement`);
 root.traverse(n=>assert(Number.isFinite(n.position.length()+n.quaternion.length()),'Finite articulated pose'));
 const from={x:point.x,z:point.z,y:placement.y,yaw:0,islandId};
 const up=terrain.cellToWorld(x,z+1,islandId);
 assert(rules.route(terrain,shape,from,up),`${character} ${form}: supported upward route`);
 const start=rules.stand(terrain,shape,up.x,up.z,0,.6,islandId);
 assert(rules.route(terrain,shape,{x:up.x,z:up.z,y:start.y,yaw:Math.PI,islandId},{x:point.x,z:point.z,yaw:Math.PI}),`${character} ${form}: supported descent`);
 context.pauseTransportBattleBro(root);terrain.group.remove(root);
}
// Full throw/open/bind/recall lifecycle on the same actual uneven provider.
const savedPlayerPosition=context.fp.pos.clone();
for(const character of ['longneck','juggernaut','monsters','specter']){
 const root=api.createBattleBroCharacter({character,form:4,variant:'ice'});
 context.baseBattleBroPrototype=root;
 const camera=new THREE.PerspectiveCamera();
 context.fp.pos.set(point.x,.65,point.z+3.5);camera.position.copy(context.fp.pos);
 const cube=require('../assets/transport-cube')(THREE,{
  scene:terrain.group,camera,box:(x,y,z)=>new THREE.BoxGeometry(x,y,z),
  active:()=>true,equipped:()=>true,source:()=>root,current:()=>null,
  playerPosition:()=>context.fp.pos,
  hand:out=>out.copy(camera.position),direction:out=>out.set(0,0,-1),yaw:()=>0,
  ground:(x,z,maxY)=>terrain.groundYAt(x,z,0,maxY),landing:context.transportLanding,blocked:context.transportCubeBlocked,
  anchor:c=>terrain.cellToWorld(c.x,c.z,c.islandId),pause:context.pauseTransportBattleBro,prepare:context.prepareTransportBattleBro,
  place:r=>terrain.group.add(r),hover:()=>character==='specter'?vm.runInContext('SPECTER_HOVER_CLEARANCE',context):0,
  bind:context.bindTransportBattleBro,animate:(r,t,dt)=>context.tickExplorationResidentMotion(r.userData.transportActor,t,dt),
  release:r=>{context.pauseTransportBattleBro(r);terrain.group.remove(r);}
 });
 assert(cube.throw());
 for(let f=0;f<240;f++)cube.tick(1/60,f/60);
 assert.equal(cube.root,root,character+': full cube opening succeeds on uneven terrain');
 assert(root.userData.transportActor?.motion,character+': emergence binds movement');
 // Approach the deployed actor so recall exercises the real 15m range check.
 context.fp.pos.copy(root.position).add(new THREE.Vector3(0,.65,5));camera.position.copy(context.fp.pos);
 assert(cube.throw());for(let f=0;f<240;f++)cube.tick(1/60,4+f/60);
 assert.equal(cube.root,null,character+': recall clears deployment');
 terrain.group.remove(cube.cube);
}
context.fp.pos.copy(savedPlayerPosition);
// Keep every negative test on the real provider; only edit its cells.
for(const character of ['longneck','juggernaut','monsters','specter']){
 const root=api.createBattleBroCharacter({character,form:4,variant:'ice'}),shape=rules.profile(root);
 context.baseBattleBroPrototype=root;
 patch(()=>({terrainFloors:2}));
 const from={x:point.x,z:point.z,y:.2,yaw:0,islandId};
 const target=terrain.cellToWorld(x,z+2,islandId);
 assert(rules.route(terrain,shape,from,target));
 terrain.setCell(x,z+1,{kind:'rock'});
 assert(!rules.route(terrain,shape,from,target),`${character}: swept route cannot skip obstacle`);
 assert(!context.transportLanding(target.x,target.z-1),`${character}: cube cannot emerge in obstacle`);
 patch((dx,dz)=>({terrainFloors:dz>=1?12:2}));
 assert(!rules.route(terrain,shape,from,target),`${character}: rejects excessive step`);
 patch((dx,dz)=>({terrain:dz===1?'water':'stone'}));
 assert(!rules.route(terrain,shape,from,target),`${character}: rejects unsupported gap`);
 patch((dx,dz)=>({terrain:Math.abs(dx)>Math.ceil(shape.halfWidth)?'water':'stone'}));
 assert(rules.stand(terrain,shape,point.x,point.z,0,.4,islandId),`${character}: narrow footprint-supported platform accepted`);
 assert(rules.route(terrain,shape,from,target),`${character}: narrow supported straight route accepted`);
 patch(()=>({terrainFloors:2}));
 const ceiling={...terrain,blocksBodyAt:()=>true};
 assert(!rules.stand(ceiling,shape,point.x,point.z,0,.4,islandId),`${character}: overhead/body collision rejects placement`);
}
// Retain genuine island-edge/void rejection on unedited generated geography.
let edgeChecked=false;
for(let cx=-30;cx<=30&&!edgeChecked;cx++)for(let cz=-30;cz<=30;cz++){
 if(terrain.getCell(cx,cz)&&!terrain.getCell(cx+1,cz)){
  const p=terrain.cellToWorld(cx,cz),shape=rules.profile(api.createBattleBroCharacter({character:'juggernaut',form:7,variant:'ice'}));
  assert(!rules.stand(terrain,shape,p.x,p.z,0,null),'Reject a body overhanging a real island edge');edgeChecked=true;break;
 }
}
assert(edgeChecked);
console.log('Shared terrain support: all 28 released rigs move on real uneven terrain; slopes, narrow support, obstacles, gaps, excessive steps, ceiling and island-edge checks passed.');
