'use strict';
const load=require('./longneck-fixture');
module.exports=function capture(){
 const {api,THREE}=load(),out={};
 for(let form=1;form<=7;form++)for(const state of ['IDLE_HOVER','START_FLOAT','FLOATING','SETTLING','FAST_FLOAT']){
  api.specterMovers.clear();const root=api.createBattleBroCharacter({character:'specter',form,variant:'ice'});
  api.worldGroup.add(root);root.position.set(.5,.72,.5);
  const m=api.registerSpecterMover(root,32,32,.72);
  Object.assign(m,{state:state==='FAST_FLOAT'?'FLOATING':state,phase:.4,progress:0,idleRemaining:999,homeJumpWait:999,
   startX:.5,startZ:.5,startBaseY:.72,targetX:.5,targetZ:1.5,targetBaseY:.72,targetCellX:32,targetCellZ:33,
   startYaw:0,desiredYaw:Math.PI/2,yawTravel:Math.PI/2,curve:.08,fastFloat:state==='FAST_FLOAT',travelDuration:state==='FAST_FLOAT'?.9:3});
  const nodes=[root,m.parts.rig,m.parts.torso,m.parts.spectralBody,m.parts.head,
   ...[m.parts.leftArm,m.parts.rightArm].flatMap(a=>[a.shoulder,a.elbow,a.hand,...a.jaws.map(j=>j.joint)])];
  const samples=[];
  for(let frame=0;frame<120;frame++){
   api.tickSpecterMovers(frame/60,1/60);
   if([0,15,35,60,89,119].includes(frame)){
    root.updateMatrixWorld(true);
    samples.push(nodes.flatMap(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.getWorldPosition(new THREE.Vector3()).toArray()]).map(v=>+v.toFixed(8)));
   }
  }
  out[form+':'+state]=samples;api.worldGroup.remove(root);
 }
 return out;
};
