/* Reusable visual attacks and recovery. No damage, NFT state, physics, or timers. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.createBattleBroBattleActions=factory;})(typeof globalThis!=='undefined'?globalThis:this,function(THREE,hooks){
  'use strict';
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const expression=root=>root.userData.slots?.face?.userData.expression?.name||'neutral';
  const setExpression=(root,name)=>hooks.setExpression(root,name,{automatic:true});
  const point=new THREE.Vector3(),local=new THREE.Vector3(),inverse=new THREE.Quaternion();
  function center(actor,out){actor.root.updateMatrixWorld(true);actor.root.userData.rig.head.getWorldPosition(out);actor.root.getWorldPosition(local);return out.lerp(local,.25);}
  function busy(actor){return !!(actor.root.userData.battleAttack||actor.root.userData.battleHit||actor.root.userData.rockThrow);}
  function remember(actor,node){const poses=actor.battlePoses||(actor.battlePoses=new Map());let pose=poses.get(node);if(!pose){pose={p:new THREE.Vector3(),q:new THREE.Quaternion(),active:false};poses.set(node,pose);}if(!pose.active){pose.p.copy(node.position);pose.q.copy(node.quaternion);pose.active=true;}}
  function restore(actor){for(const [node,pose] of actor.battlePoses||[]){if(pose.active){node.position.copy(pose.p);node.quaternion.copy(pose.q);pose.active=false;}}}
  function hit(actor,source){
    if(!actor.root.parent||actor.root.userData.battleHit)return false;
    const direction=actor.root.getWorldPosition(new THREE.Vector3()).sub(source);direction.y=0;
    if(direction.lengthSq()<1e-8)direction.set(1,0,0);direction.normalize();
    const form=actor.root.userData.form;
    actor.root.userData.battleHit={age:0,duration:form===7?3:2.35,direction,expression:expression(actor.root),
      chunks:actor.root.userData.looseRocks.chunks.filter(c=>actor.root.userData.rig.spectralBody||actor.root.userData.rig.minotaurLegs||form<5||/^(greater|advanced)|Apex/.test(c.node.name)).slice(0,8),distance:form<4?.38:form===7?.85:.60};
    actor.hitsReceived=(actor.hitsReceived||0)+1;setExpression(actor.root,'veryAngry');return true;
  }
  function attack(actors,index){
    const actor=actors[index],defender=actors[1-index];
    if(!actor||!defender||actors.some(busy)||!actor.root.parent||!defender.root.parent)return {ok:false,reason:'busy'};
    const a={actor,defender,age:0,hit:false,expression:expression(actor.root)};
    const impact=()=>{if(a.hit)return;a.hit=true;hit(defender,actor.root.getWorldPosition(point));};
    if(actor.root.userData.form===1){
      const controller=actor.root.userData.looseRocks;
      const chunk=actor.root.userData.rig.limbs?null:controller.chunks.find(c=>c.node.isMesh&&!/Face|Head|head|Shell/.test(c.node.name));
      const foot=chunk?chunk.node:actor.root.userData.rig.limbs[1];
      if(chunk){a.chunk=chunk;a.chunkIndex=controller.chunks.indexOf(chunk);controller.chunks.splice(a.chunkIndex,1);}
      Object.assign(a,{foot,parent:foot.parent,position:foot.position.clone(),quaternion:foot.quaternion.clone(),scale:foot.scale.clone(),
        start:foot.getWorldPosition(new THREE.Vector3()),release:new THREE.Vector3(),arrival:new THREE.Vector3(),scratch:new THREE.Vector3(),returnQuaternion:new THREE.Quaternion(),parentQuaternion:new THREE.Quaternion(),impact});
      actor.root.parent.attach(foot);setExpression(actor.root,'mildAngry');
    }else{
      const target={isActive:()=>actors[1-index]===defender&&!!defender.root.parent,
        getPosition:out=>center(defender,out),getVelocity:out=>out.set(0,0,0),onImpact:impact};
      a.throw=hooks.throwRock(actor.root,target);if(!a.throw)return {ok:false,reason:'no-projectile'};
    }
    actor.root.userData.battleAttack=a;return {ok:true,action:a};
  }
  function returnFoot(a){if(!a.foot)return;a.parent.add(a.foot);a.foot.position.copy(a.position);a.foot.quaternion.copy(a.quaternion);a.foot.scale.copy(a.scale);a.foot=null;if(a.chunk){a.actor.root.userData.looseRocks.chunks.splice(a.chunkIndex,0,a.chunk);a.chunk=null;}}
  function tickFoot(a,dt){
    const root=a.actor.root;a.age+=dt;
    const wind=smooth(a.age/.7),settle=1-smooth((a.age-2.1)/.55);
    remember(a.actor,root);root.rotateX(-.13*wind*settle);root.position.y+=Math.sin(Math.PI*wind)*.055*settle;
    if(a.age<.7){
      a.scratch.copy(a.start);a.scratch.y+=.65*wind;a.scratch.z+=.12*Math.sin(wind*Math.PI);
      a.release.copy(a.scratch);
    }else if(a.age<1.3){
      center(a.defender,a.arrival);const u=(a.age-.7)/.6;
      a.scratch.copy(a.release).lerp(a.arrival,u);a.scratch.y+=Math.sin(Math.PI*u)*.35;
      setExpression(root,'veryAngry');
    }else{
      if(!a.hit)a.impact();
      a.parent.updateMatrixWorld(true);point.copy(a.position);a.parent.localToWorld(point);
      const u=smooth((a.age-1.42)/.85);a.scratch.copy(a.arrival).lerp(point,u);a.scratch.y+=Math.sin(Math.PI*u)*.65;
    }
    if(a.foot){a.foot.position.copy(a.scratch);a.foot.parent.worldToLocal(a.foot.position);a.foot.rotateX(dt*4);a.foot.rotateZ(dt*2.5);
      if(a.age>1.8){a.parent.getWorldQuaternion(a.returnQuaternion).multiply(a.quaternion);a.foot.parent.getWorldQuaternion(a.parentQuaternion).invert();a.returnQuaternion.premultiply(a.parentQuaternion);a.foot.quaternion.slerp(a.returnQuaternion,smooth((a.age-1.8)/.47));}}
    if(a.age>=2.27)returnFoot(a);
    if(a.age>=2.65){root.userData.battleAttack=null;setExpression(root,a.expression);}
  }
  function tick(actor,time,dt){
    dt=Math.max(0,Math.min(dt,.05));const root=actor.root,a=root.userData.battleAttack;
    if(a){if(a.parent)tickFoot(a,dt);else if(!root.userData.rockThrow)root.userData.battleAttack=null;}
    const h=root.userData.battleHit;if(!h)return;
    h.age+=dt;const ramp=smooth(h.age/.20),recovery=smooth((h.age-.8)/(h.duration-.8)),weight=ramp*(1-recovery);
    remember(actor,root);root.position.addScaledVector(h.direction,h.distance*weight);
    root.position.y+=Math.abs(Math.sin(h.age*Math.PI*5))*Math.max(0,1-h.age/.65)*.12;
    root.rotateX(-weight*.22);root.rotateZ(Math.sin(h.age*19)*Math.exp(-h.age*3)*.035);
    const rig=root.userData.rig;
    if(rig.minotaurLegs){
      Object.values(rig.minotaurLegs).forEach((leg,i)=>{remember(actor,leg);leg.rotation.z+=Math.sin(h.age*15+(i%2)*Math.PI)*weight*.25;});
      remember(actor,rig.torso);rig.torso.rotation.x+=weight*.16;
      if(rig.jaw){remember(actor,rig.jaw);rig.jaw.rotation.x+=weight*.22;}
    }
    if(rig.spectralBody){remember(actor,rig.torso);rig.torso.rotation.z+=Math.sin(h.age*8)*weight*.16;}
    root.getWorldQuaternion(inverse).invert();point.copy(h.direction).applyQuaternion(inverse);
    h.chunks.forEach((chunk,i)=>{remember(actor,chunk.node);const phase=i*2.399;
      chunk.node.position.x+=weight*(point.x*.18+Math.sin(phase)*.24);
      chunk.node.position.y+=weight*(.14+(i%3)*.09);
      chunk.node.position.z+=weight*(point.z*.18+Math.cos(phase)*.22);
      chunk.node.rotateZ(weight*Math.sin(phase)*.32);
    });
    const field=root.userData.looseRocks.orbitField;if(field)field.position.copy(root.position);
    if(h.age>=h.duration){restore(actor);root.userData.battleHit=null;setExpression(root,h.expression);}
  }
  function cancel(actors){for(const actor of actors){restore(actor);const root=actor.root,a=root.userData.battleAttack,h=root.userData.battleHit;
    if(a?.parent)returnFoot(a);hooks.restoreBody?.(root);hooks.cancelThrow(root);
    const thrown=root.userData.rockThrow;if(thrown){thrown.rock.action=null;root.userData.rockThrow=null;const trail=root.userData.looseRocks.throwTrail;if(trail)trail.line.material.opacity=0;}
    root.userData.battleAttack=null;root.userData.battleHit=null;if(a||h)setExpression(root,(a||h).expression);
  }}
  function state(actor){const root=actor.root;if(root.userData.battleHit)return root.userData.battleHit.age<.8?'Stunned':'Recovering';const a=root.userData.battleAttack;if(!a)return 'Ready';if(a.parent)return a.age<.7?'Wind-up':a.age<1.3?'Attack':'Recalling limb';return root.userData.rockThrow?.state?.replaceAll('_',' ').toLowerCase()||'Recovering';}
  return {attack,hit,tick,restore,cancel,busy,state};
});
