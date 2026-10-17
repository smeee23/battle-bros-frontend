'use strict';
const load=require('./longneck-fixture'),vm=require('node:vm');
module.exports=function capture(){
 const {api,THREE,context}=load(),out={};
 for(let form=1;form<=7;form++)for(const state of ['idle','turn','walk','run']){
  api.lavaMonsterMovers.clear();const root=api.createBattleBroCharacter({character:'monsters',form,variant:'ice'});
  api.worldGroup.add(root);root.position.set(.5,0,.5);
  const m=api.registerLavaMonsterMover(root,32,32);context.referenceMover=m;
  Object.assign(m,{pauseRemaining:999,homeJumpWait:999,desiredYaw:state==='turn'?Math.PI/2:0,
   startX:.5,startZ:.5,startY:0,targetX:.5,targetZ:1.5,targetY:0,targetCellX:32,targetCellZ:33,dx:0,dz:1});
  if(state==='turn')m.state='TURNING';
  if(state==='walk'||state==='run'){
   m.terrainPlan=api.planLavaTerrainMove(m,32,33,0);
   m.rightGoal.copy(m.terrainPlan.swings[0].end);m.leftGoal.copy(m.terrainPlan.swings[1].end);
   if(state==='run'){m.juggernautJog={support:0,total:1,remaining:1};vm.runInContext('beginJuggernautRun(referenceMover)',context);}
   else api.beginJuggernautStride(m);
  }
  const samples=[];
  for(let frame=0;frame<90;frame++){
   api.tickLavaMonsterMovers(frame/60,1/60);
   if([0,15,35,60,89].includes(frame)){
    root.updateMatrixWorld(true);const lower=m.parts,upper=root.userData.rig;
    const nodes=[root,lower.rig,lower.torso,lower.leftArm.shoulder,lower.leftArm.elbow,lower.leftArm.hand,lower.rightArm.hand,
     upper.torso,upper.head,upper.head2,upper.shoulderWeaponSpin,
     ...[upper.leftUpperArm,upper.rightUpperArm].filter(Boolean).flatMap(a=>[a.shoulder,a.arm,a.elbow,a.hand])].filter(Boolean);
    samples.push(nodes.flatMap(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.getWorldPosition(new THREE.Vector3()).toArray()]).map(v=>+v.toFixed(8)));
   }
  }
  out[form+':'+state]=samples;api.worldGroup.remove(root);
 }
 return out;
};
