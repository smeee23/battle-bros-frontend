/* Temporary pose layer shared by the existing family cores. No locomotion or render loop. */
(function(global,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else global.BattleBroEncounter=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
  function createPose(mover,family){
    const root=mover.root,p=family==='monsters'?{...mover.parts,...root.userData.rig}:mover.parts,records=[];
    // Only animation joints; facial expression geometry remains owned by expression blending.
    const nodes=new Set([p.rig,p.torso,p.head,p.head2,p.neckPivot,p.jaw,
      ...[p.leftArm,p.rightArm].flatMap(a=>a?[a.shoulder,a.elbow,a.hand]:[])]);
    for(const node of nodes)if(node)records.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});
    function restore(){for(const r of records){r.node.position.copy(r.p);r.node.quaternion.copy(r.q);r.node.scale.copy(r.s);}}
    function pose({age,readyAge=0,weight=1,look=0,time=0}){
      const notice=smooth(age/.65)*weight,ready=smooth(readyAge/1.1)*weight;
      const spectral=family==='specter',long=family==='longneck',monster=family==='monsters';
      const juvenile=(root.userData.form||4)<4,force=juvenile?.65:1;
      const head=p.neckPivot||p.head;
      if(head){head.rotation.y+=Math.max(-.8,Math.min(.8,look))*notice;head.rotation.x+=.09*ready;}
      if(p.head2){p.head2.rotation.y+=Math.max(-.6,Math.min(.6,look))*notice*.8;p.head2.rotation.x+=.12*ready;}
      if(p.torso){p.torso.rotation.x+=(spectral?.22:long?.10:monster?.20:.13)*ready*force;
        p.torso.position.y-=(spectral?0:long?.035:monster?.065:.045)*ready*force;}
      if(p.jaw)p.jaw.rotation.x+=(monster?.12:long?.08:0)*ready;
      if(p.rig)p.rig.position.y+=Math.sin(time*(spectral?4.3:2.1))*(spectral?.035:.006)*ready;
      // Ground support limbs remain planted. Specter's free arms rise into a threat.
      for(const [i,arm] of [p.leftArm,p.rightArm].entries())if(arm){
        if(spectral){if(arm.shoulder){arm.shoulder.rotation.x-=.55*ready;arm.shoulder.rotation.z+=(i?1:-1)*.28*ready;}
          if(arm.elbow)arm.elbow.rotation.x-=.25*ready;}
        else if((root.userData.form||4)>=4&&arm.hand)arm.hand.rotation.x-=.10*ready;
      }
      // Supplemental eye narrowing also covers secondary faces and rigs without expression slots.
      for(const face of [p,p.secondFace])if(face)for(const key of ['leftEye','rightEye']){
        const eye=face[key];if(!eye)continue;
        // Eyes are saved separately below, so the layer never accumulates scale.
        const rest=eyes.find(r=>r.node===eye);eye.scale.y=rest.y*(1-.38*smooth((age-.6)/.5)*weight);
      }
    }
    const eyes=[];
    for(const face of [p,p.secondFace])if(face)for(const key of ['leftEye','rightEye'])if(face[key])eyes.push({node:face[key],y:face[key].scale.y});
    return {pose,capture(){
      for(const r of records){r.p.copy(r.node.position);r.q.copy(r.node.quaternion);r.s.copy(r.node.scale);}
      for(const r of eyes)r.y=r.node.scale.y;
    },restore(){restore();for(const r of eyes)r.node.scale.y=r.y;}};
  }
  // Keep the interrupted route in place while the SAME controller operates temporary
  // action state. Copy data, never scene nodes, controller instances or navigation hooks.
  function createSession(controller){
    const mover=controller.mover,root=mover.root,originalPose=[];
    root.traverse(node=>{if(node!==root)originalPose.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});});
    const copy=(value,seen=new Map())=>{
      if(!value||typeof value!=='object'||value.isObject3D||value===mover.parts||value.mover===mover)return value;
      if(seen.has(value))return seen.get(value);
      if(value.isVector3||value.isQuaternion||value.isEuler){const result=value.clone();seen.set(value,result);return result;}
      if(!Array.isArray(value)&&value.constructor?.name!=='Object')return value;
      const result=Array.isArray(value)?[]:{};seen.set(value,result);
      for(const key of Object.keys(value))result[key]=copy(value[key],seen);
      return result;
    };
    const initial={...mover};let state={};const seen=new Map();
    for(const key of Object.keys(initial))state[key]=copy(initial[key],seen);
    function assign(value){for(const key of Object.keys(mover))if(!(key in value))delete mover[key];Object.assign(mover,value);}
    function run(fn){
      const saved={...mover};assign(state);
      try{return fn();}finally{state={...mover};assign(saved);}
    }
    run(()=>controller.reset());
    for(const r of originalPose){r.node.position.copy(r.p);r.node.quaternion.copy(r.q);r.node.scale.copy(r.s);}
    return {
      frame:(yaw,dt,t,canTurn)=>run(()=>controller.encounterFrame(yaw,dt,t,canTurn)),
      carry(delta){
        // Carry both the paused route and action contacts; history advances only once.
        controller.carry(delta);run(()=>controller.carry(delta,false));
      },
      blendOriginal(weight){if(weight<=0)return;for(const r of originalPose){r.node.position.lerp(r.p,weight);r.node.quaternion.slerp(r.q,weight);r.node.scale.lerp(r.s,weight);}},
      finish(){this.blendOriginal(1);controller.syncEncounterHistory();},
      get state(){return state;}
    };
  }
  function create(host){
    let active=null;
    // Suppress each pair until separation or an explicit transport deployment reset.
    const blocked=new Map();
    const distance=(a,b)=>a.root.position.distanceTo(b.root.position);
    function finish(){
      if(!active)return;
      for(const s of active.sides){s.pose.restore();s.actor.root.rotation.y=s.yaw;s.session.finish();
        delete s.actor.encounter;host.expression(s.actor,s.expression,true);}
      active=null;host.menu(false);
    }
    function end(choice){
      if(!active||active.phase==='recover')return;
      active.choice=choice;active.phase='recover';active.recovery=0;active.returnAge=0;host.menu(false);
      for(const s of active.sides)host.expression(s.actor,s.expression);
    }
    function cancel(actor){if(active&&(!actor||active.sides.some(s=>s.actor===actor)))finish();}
    function resetDeployment(root){
      if(active?.sides.some(s=>s.actor.root===root))finish();
      blocked.delete(root);
    }
    function tick(t,dt){
      const player=host.player(),npcs=host.npcs(),enabled=host.enabled();
      for(const [a,set] of blocked){
        for(const b of set)if(!npcs.some(npc=>npc.root===b)
          ||(a.parent&&b.parent&&a.position.distanceTo(b.position)>12))set.delete(b);
        if(!set.size)blocked.delete(a);
      }
      if(active){
        if(!enabled||active.sides[0].actor!==player||!npcs.includes(active.sides[1].actor)||!active.sides.every(s=>host.available(s.actor))){finish();return;}
        const step=Math.max(0,Math.min(dt,.05));active.age+=step;
        if(active.phase==='recover')active.recovery+=step;
        if(active.age>=.6&&!active.expressed&&active.phase==='sequence'){
          active.expressed=true;for(const s of active.sides)host.expression(s.actor,'veryAngry');
        }
        const recovery=smooth(active.recovery/.7);
        let settled=true;
        for(const s of active.sides){
          s.pose.restore();
          const other=active.sides.find(o=>o!==s).actor.root.position,root=s.actor.root;
          if(!host.carry(s.actor,s.session,t)){finish();return;}
          const target=Math.atan2(other.x-root.position.x,other.z-root.position.z);
          const recovering=active.phase==='recover';
          const yaw=recovering?(recovery>=1?s.yaw:null):(active.age>=1?target:null);
          const result=s.session.frame(yaw,step,t,nextYaw=>host.canTurn(s.actor,nextYaw));
          if(!result.accepted){finish();return;}
          const aligned=!Number.isFinite(yaw)||Math.abs(angle(yaw-root.rotation.y))<.04;
          settled=settled&&result.done&&aligned&&(!recovering||recovery>=1);
          if(active.age<.5)s.session.blendOriginal(1-smooth(active.age/.5));
          s.pose.capture();
          s.pose.pose({age:active.age,readyAge:active.squareAge,weight:1-recovery,look:angle(target-root.rotation.y),time:t});
          host.tickExpression(s.actor,step);
        }
        if(active.phase==='recover'){
          if(settled)active.returnAge+=step;else active.returnAge=0;
          const blend=smooth(active.returnAge/.7);
          for(const s of active.sides)s.session.blendOriginal(blend);
          if(active.returnAge>=.7){finish();return;}
        }else{
          if(settled&&active.age>=1)active.squareAge+=step;else active.squareAge=0;
          if(active.phase==='sequence'&&active.age>=3&&active.squareAge>=1.1){active.phase='prompt';host.menu(true);}
        }
        return;
      }
      if(!enabled||!player||!host.available(player))return;
      for(const npc of npcs){
        if(npc===player||!host.available(npc)||blocked.get(player.root)?.has(npc.root)||distance(player,npc)>10)continue;
        const sides=[player,npc].map(actor=>{
          const controller=host.controller(actor);
          const expression=host.expressionName(actor),yaw=actor.root.rotation.y;
          const session=createSession(controller);
          return {actor,controller,session,pose:controller.encounterPose(),yaw,expression};
        });
        if(!blocked.has(player.root))blocked.set(player.root,new Set());blocked.get(player.root).add(npc.root);
        active={sides,age:0,squareAge:0,recovery:0,phase:'sequence'};
        for(const s of sides){s.actor.encounter=active;s.actor.root.userData.expressionCycleEnabled=false;}
        break;
      }
    }
    return {tick,end,cancel,resetDeployment,get active(){return active;}};
  }
  return {createPose,create};
});
