'use strict';
const load=require('./longneck-fixture');
module.exports=function capture(source){
 const {api,THREE,context}=load(source),vm=require('node:vm'),out={};
 for(let form=1;form<=7;form++)for(const state of ['idle','turn','walk',...(form>=4?['run']:[])]){
  api.lavaMonsterMovers.clear();const root=api.createBattleBroCharacter({character:'juggernaut',form,variant:'ice'});
  api.worldGroup.add(root);root.position.set(.5,0,.5);
  const m=api.registerLavaMonsterMover(root,32,32);context.referenceMover=m;
  Object.assign(m,{pauseRemaining:999,homeJumpWait:999,desiredYaw:state==='turn'?Math.PI/2:0,
   startX:.5,startZ:.5,startY:0,targetX:.5,targetZ:1.5,targetY:0,targetCellX:32,targetCellZ:33,dx:0,dz:1});
  if(state==='turn')m.state='TURNING';
  if(state==='walk'||state==='run'){
   m.terrainPlan=api.planLavaTerrainMove(m,32,33,0);
   if(form<4){m.state='REACH';m.reachStart.copy(m.anchors[m.sideIndex]);}
   else {
    m.rightGoal.copy(m.terrainPlan.swings[0].end);m.leftGoal.copy(m.terrainPlan.swings[1].end);
    if(state==='run'){m.juggernautJog={support:0,total:1,remaining:1};vm.runInContext('beginJuggernautRun(referenceMover)',context);}
    else api.beginJuggernautStride(m);
   }
  }
  const samples=[];
  for(let frame=0;frame<90;frame++){
   api.tickLavaMonsterMovers(frame/60,1/60);
   if([0,15,35,60,89].includes(frame)){
    root.updateMatrixWorld(true);const p=m.parts;
    const nodes=[root,p.rig,p.torso,p.head,...(p.limbs||[p.leftArm.shoulder,p.leftArm.elbow,p.leftArm.hand,p.rightArm.hand])];
    samples.push(nodes.filter(Boolean).flatMap(n=>[...n.getWorldPosition(new THREE.Vector3()).toArray(),...n.getWorldQuaternion(new THREE.Quaternion()).toArray()]).map(v=>+v.toFixed(8)));
   }
  }
  out[form+':'+state]=samples;api.worldGroup.remove(root);
 }
 return out;
};
