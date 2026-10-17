const fs=require('fs');
const load=require('./longneck-fixture');
function capture(source){
 const {api,THREE}=load(source),out={};
 for(let form=1;form<=7;form++)for(const state of ['IDLE','TURNING','WALKING_FLAT','STEPPING_UP','STEPPING_DOWN','GALLOPING','REARING']){
  api.minotaurMovers.clear();const root=api.createLongNeckBattleBro({form});api.worldGroup.add(root);root.position.set(.5,0,.5);
  const m=api.registerMinotaurMover(root,32,32);m.state=state;m.pauseRemaining=999;m.rearingCooldown=999;m.idlePhase=0;m.lookRemaining=999;m.lookDirection=0;
  Object.assign(m,{startX:.5,startY:0,startZ:.5,targetX:.5,targetZ:1.5,targetY:state==='STEPPING_UP'?.2:state==='STEPPING_DOWN'?-.2:0,desiredYaw:state==='TURNING'?Math.PI/2:0});
  m.heightDelta=m.targetY;
  if(state==='GALLOPING')m.sprint={total:1,remaining:1,dx:0,dz:1,feet:{}};
  if(['TURNING','WALKING_FLAT','STEPPING_UP','STEPPING_DOWN'].includes(state))api.beginLongneckFootMotion(m,state==='TURNING');
  const duration=state==='TURNING'?1.15:state==='GALLOPING'?.43:state==='REARING'?4.2:state==='WALKING_FLAT'?1.35:state==='IDLE'?1:1.7;
  const samples=[];
  for(let i=0;i<24;i++){
   api.tickMinotaurMovers(i*duration/32,duration/32);
   if([7,15,23].includes(i)){
    root.updateMatrixWorld(true);const p=root.userData.rig;
    const nodes=[p.torso,p.animalBody,p.head,p.minotaurLegs.frontLeft,p.minotaurLegs.rearRight];
    samples.push(nodes.flatMap(n=>[...n.getWorldPosition(new THREE.Vector3()).toArray(),...n.getWorldQuaternion(new THREE.Quaternion()).toArray(),...n.scale.toArray()]).map(v=>+v.toFixed(8)));
   }
  }
  out[form+':'+state]=samples;api.worldGroup.remove(root);
 }
 return out;
}
module.exports=capture;
