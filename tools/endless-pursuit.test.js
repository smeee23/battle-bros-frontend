'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const pursuit=require('../assets/endless-pursuit');

function fixture(){
  const actor={root:{rotation:{y:0}},islandId:'a'},body={x:5,y:0,z:0};
  const player={x:0,y:.6,z:0,eyeHeight:.6,islandId:'a'};
  const events=[];let enabled=true,clear=true,available=true;
  const system=pursuit.create({enabled:()=>enabled,player:()=>({...player}),npcs:()=>[actor],
    available:()=>available,shape:()=>({halfWidth:.5,halfDepth:.4,height:2}),body:()=>({...body}),
    clear:()=>clear,start:()=>events.push('start'),stop:()=>events.push('stop'),
    lookAt:()=>events.push('look'),regenerate:()=>{player.x=7;events.push('regenerate');},
    feedback:mode=>events.push(mode)});
  return {actor,body,player,system,events,setEnabled:v=>enabled=v,setClear:v=>clear=v,setAvailable:v=>available=v};
}
{
  const f=fixture();f.actor.islandId='b';f.system.tick(0,.05);assert(!f.actor.pursuit,'Other islands cannot trigger pursuit');
  f.actor.islandId='a';f.player.x=-20;f.system.tick(.1,.05);assert(!f.actor.pursuit,'Outside awareness range');
  f.player.x=0;f.setClear(false);f.system.tick(.2,.05);assert(!f.actor.pursuit,'Blocked path cannot trigger pursuit');
  f.setClear(true);f.system.tick(.3,.05);assert(f.actor.pursuit);
  f.setClear(false);f.system.tick(.6,.05);assert(!f.actor.pursuit,'Terrain edits cancel pursuit');
  f.setClear(true);f.system.tick(.7,.05);assert(f.actor.pursuit);
  f.setAvailable(false);f.system.tick(.8,.05);assert(!f.actor.pursuit,'An encounter or other action cancels pursuit');
  f.setAvailable(true);f.system.tick(.9,.05);f.player.islandId='b';f.system.tick(1,.05);
  assert(!f.actor.pursuit,'Leaving the island cancels pursuit');
}
{
  const f=fixture();f.system.tick(0,.05);f.player.x=10;
  assert(f.system.tick(.05,.05),'Swept contact catches a player crossing the Bro between frames');
  assert(f.actor.pursuitCaught&&!f.actor.pursuit);assert(f.events.includes('look'));
  for(let i=1;i<=25;i++)f.system.tick(.05+i*.05,.05);
  assert(f.events.includes('regenerate'));assert(!f.actor.pursuitCaught);assert(f.system.grace>4.9);
  f.player.x=f.body.x;
  for(let i=0;i<98;i++)assert(!f.system.tick(2+i*.05,.05),'Global grace prevents an immediate second catch');
  assert(!f.actor.pursuit);
  for(let i=0;i<4;i++)f.system.tick(7+i*.05,.05);
  assert(f.system.locked,'Pursuit resumes after protection expires');
  f.system.cancel(f.actor);assert(!f.system.locked&&!f.actor.pursuitCaught,'Removal releases the camera');
  f.setEnabled(false);f.system.tick(10,.05);assert.equal(f.system.grace,0,'World exit clears protection and effects');
}
{
  const shape={halfWidth:1,halfDepth:.3,height:2},body={x:0,y:0,z:0};
  const p={x:0,y:4,z:0,eyeHeight:.6};
  assert(!pursuit.contact(p,p,body,body,shape,0),'Airborne player above the body is not caught');
  p.y=.6;p.x=.8;
  assert(pursuit.contact(p,p,body,body,shape,0));
  assert(!pursuit.contact(p,p,body,body,shape,Math.PI/2),'Collision follows body orientation');
}
console.log('Endless pursuit: island/range/path gates, path edits, swept collision, height, camera lifecycle, regeneration, grace and exit cleanup passed.');

// Run the actual production adapters and the shared r128 animation controllers.
const html=fs.readFileSync('index.html','utf8');
function realFixture(){
  const {api,context,THREE}=require('./longneck-fixture')();
  const group=new THREE.Group(),overlay={hidden:true,style:{}},status={textContent:''};
  const terrain={group,worldToCell:(x,z)=>({x:Math.floor(x),z:Math.floor(z)}),
    cellToWorld:(x,z)=>({x:x+.5,z:z+.5}),groundYAt:()=>0,
    getCell:(x,z)=>Math.abs(x)<30&&Math.abs(z)<30?{terrain:'stone',terrainFloors:1,islandId:'a',kind:null}:null};
  Object.assign(context,{EndlessPursuit:pursuit,explorationTerrain:terrain,explorationActive:true,
    fp:{active:true,pos:new THREE.Vector3(.5,.6,.5),yaw:0,pitch:0},fpKeys:new Set(['w']),
    FP_EYE_H:.6,FP_MAX_HEIGHT_DIFFERENCE:1.7,SPECTER_HOVER_CLEARANCE:1,
    trainingAppearance:{active:false},broEncounterMenu:{hidden:true},fpJourney:{warp:0,previous:null},
    document:{getElementById:id=>id==='endless-catch-overlay'?overlay:status},markCameraMoving(){}});
  vm.runInContext(html.slice(html.indexOf('  // Sparse local scenery inhabitants'),html.indexOf('  // ---------- transport cube')),context);
  vm.runInContext(html.slice(html.indexOf('  // ---------- Endless NPC pursuit ----------'),html.indexOf('  // -------- animation loop --------'))
    +'\nthis.pursuitSystem=endlessPursuit;this.residents=explorationResidents;',context);
  function actor(character,form=4){
    const root=api.createBattleBroCharacter({character,form,variant:'ice'});group.add(root);
    root.position.set(5.5,character==='specter'?1:0,.5);root.rotation.y=-Math.PI/2;
    const a={root,character,x:5,z:0,islandId:'a',phase:0,
      mover:{root,parts:root.userData.locomotionRig||root.userData.rig,state:'IDLE',progress:0,ikTarget:new THREE.Vector3()}};
    context.tickExplorationResidentMotion(a,0,0);context.residents.set('npc',a);return a;
  }
  return {context,actor,overlay,status,terrain,THREE};
}
for(const obstacle of ['rock','water','void']){
  const f=realFixture(),a=f.actor('juggernaut'),get=f.terrain.getCell;
  f.terrain.getCell=(x,z)=>x===3?(obstacle==='void'?null:{...get(x,z),kind:obstacle==='rock'?'rock':null,terrain:obstacle==='water'?'water':'stone'}):get(x,z);
  f.context.pursuitSystem.tick(0,1/60);
  assert(!a.pursuit,obstacle+' blocks actual production awareness');
}
for(const [family,form] of ['juggernaut','monsters','longneck','specter'].flatMap(family=>Array.from({length:7},(_,i)=>[family,i+1]))){
  const f=realFixture(),a=f.actor(family,form),start=a.root.position.clone();let ran=false,caught=false,time=0;
  if(form===1)f.context.fp.pos.set(.01,.6,.01);
  for(let frame=0;frame<1800;frame++){
    time=frame/60;
    caught=f.context.pursuitSystem.tick(time,1/60);
    f.context.tickExplorationResidentMotion(a,time,1/60);
    ran ||= ['JUGGERNAUT_RUN','GALLOPING'].includes(a.mover.state)||!!a.mover.fastFloat
      ||(family==='juggernaut'&&form<=3&&['REACH','PULL'].includes(a.mover.state));
    a.root.traverse(n=>assert(Number.isFinite(n.position.length()+n.quaternion.length()),'Finite shared animation pose'));
    if(caught)break;
  }
  assert(ran,family+' uses its existing run/fast-float/support controller');
  assert(caught,family+' reaches the player');assert(a.root.position.distanceTo(start)>1,'Bro travels toward the player');
  assert(f.overlay.style.background.includes('185,0,0'),'Catch has a red screen cue');
  assert(f.status.textContent.includes('Caught'));assert(f.context.fpKeys.size===0,'Catch clears movement');
  assert(f.context.fp.yaw<0,'Camera pans toward the Bro');
  const previous=f.context.fp.pos.clone();
  for(let frame=1;frame<=80;frame++)f.context.pursuitSystem.tick(time+frame/60,1/60);
  assert(f.context.fp.pos.distanceTo(previous)>2,'Regeneration selects a nearby different spot');
  assert.equal(f.context.endlessPlayerPosition().islandId,'a','Regeneration stays on the island');
  assert.equal(f.context.fp.pos.y,.6,'Regenerated player has terrain support');
  assert(f.status.textContent.includes('Protected'));assert(!f.context.pursuitSystem.locked);
}
console.log('Endless production adapters: shared Juggernaut/Monster runs, Longneck gallop, Specter fast float, juvenile support gait, camera pan, red cue and safe island regeneration passed.');
