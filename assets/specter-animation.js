/* Authoritative Specter floating poses and gesture layers. Navigation/terrain
 * validation, physical root application and jump physics remain with the host. */
(function(global,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else global.createSpecterAnimationSystem=factory;
})(typeof globalThis!=='undefined'?globalThis:this,function(THREE,host){
  'use strict';
  const {smoothMinotaurStep,battleBroYawDelta,SPECTER_MOVE_STATE,SPECTER_MIN_CLEARANCE}=host;
  function tickFloatingRockArmGestures(root, t, dt) {
    if(root.userData.rockThrow)return;
    const state = root.userData.floatingArmGestures || (root.userData.floatingArmGestures = {
      kind: null, elapsed: 0, wait: 2.5, next: 0, side: -1,
      previousPosition: root.position.clone(), previousYaw: root.rotation.y, travel: 0, turn: 0,
      arms: [root.userData.rig.leftArm, root.userData.rig.rightArm].map((arm, index) => ({
        arm, side: index ? 1 : -1, y: arm.shoulder.position.y,
        shoulderZ: arm.shoulder.rotation.z, elbowZ: arm.elbow.rotation.z,
        wristX: arm.hand.rotation.x, shoulderX: arm.shoulder.rotation.x,
        shoulderY: arm.shoulder.rotation.y, elbowX: arm.elbow.rotation.x,
        elbowY: arm.elbow.rotation.y, wristY: arm.hand.rotation.y,
      })),
    });
    const step = Math.max(0, Math.min(dt, .05));
    const speed=step>0?Math.min(1,Math.hypot(root.position.x-state.previousPosition.x,
      root.position.z-state.previousPosition.z)/step):0;
    const yawSpeed=step>0?Math.max(-1,Math.min(1,battleBroYawDelta(root.rotation.y-state.previousYaw)/step)):0;
    const follow=1-Math.exp(-step*3);
    state.travel+=(speed-state.travel)*follow;state.turn+=(yawSpeed-state.turn)*follow;
    state.previousPosition.copy(root.position);state.previousYaw=root.rotation.y;
    if (!state.kind) {
      state.wait -= step;
      if (state.wait <= 0) {
        const sequence=root.userData.form<3?['shrug','reach','stretch']:['singleClasp','reach','doubleClasp','sweep','shrug','stretch'];
        state.kind=sequence[state.next++%sequence.length];
        state.elapsed = 0;
        if (['singleClasp','reach','sweep'].includes(state.kind)) state.side *= -1;
      }
    }
    if (state.kind) state.elapsed += step;
    const duration = state.kind === 'shrug' ? 2.6 : state.kind === 'sweep' ? 5.2 : 4.2;
    const p = Math.min(1, state.elapsed / duration);
    const envelope = (start, rise, fall, end) =>
      smoothMinotaurStep((p-start)/(rise-start)) * (1-smoothMinotaurStep((p-fall)/(end-fall)));
    const lift = state.kind ? envelope(0,.26,.72,1) : 0;
    const clasp = ['singleClasp','doubleClasp','reach'].includes(state.kind) ? envelope(.28,.43,.55,.72) : 0;
    for (const rest of state.arms) {
      const { arm, side } = rest;
      const active = !['singleClasp','reach','sweep'].includes(state.kind) || side === state.side;
      const delayedP=Math.max(0,p-(side>0?.055:0));
      const stagger=state.kind?smoothMinotaurStep(delayedP/.26)*(1-smoothMinotaurStep((p-.72)/.28)):0;
      const amount = active ? (side>0?stagger:lift) : 0;
      const phase=t*(side<0?.69:.53)+(root.userData.looseRocks?.phase||0)+side*1.7;
      const reach=state.kind==='reach'?amount:0,sweep=state.kind==='sweep'?amount:0;
      const stretch=state.kind==='stretch'?amount:0;
      const shrug = state.kind === 'shrug';
      arm.shoulder.position.y = rest.y + (shrug ? .18 : .035) * amount + Math.sin(phase)*.022;
      arm.shoulder.rotation.x=rest.shoulderX+Math.sin(phase*.83)*.045-state.travel*.13-reach*.40-stretch*.16;
      arm.shoulder.rotation.y=rest.shoulderY-state.turn*.20+Math.sin(phase*.61)*.045
        +side*(sweep*.48*Math.sin(p*Math.PI)-reach*.12);
      arm.shoulder.rotation.z = rest.shoulderZ + side * (shrug ? .16 : .72) * amount
        + Math.sin(phase)*.035 + side*stretch*.18;
      arm.elbow.rotation.z = rest.elbowZ + side * (shrug ? .12 : .48) * amount;
      arm.elbow.rotation.x=rest.elbowX+Math.sin(phase-.5)*.06-reach*.22;
      arm.elbow.rotation.y=rest.elbowY-state.turn*.12+side*sweep*.24;
      arm.hand.rotation.x = rest.wristX - .18 * amount + Math.sin(phase-.9)*.07;
      arm.hand.rotation.y=rest.wristY+Math.sin(phase*.73-.6)*.085+side*reach*.18;
      arm.hand.rotation.z=Math.sin(phase-1.1)*.045+side*sweep*.15;
      for (const jaw of arm.jaws) {
        // Both tips turn inward; keep a small gap between the stone jaws.
        jaw.joint.rotation.z = -jaw.side * .38 * (active ? clasp : 0);
      }
    }
    if (state.kind && p >= 1) {
      state.kind = null;
      state.elapsed = 0;
      state.wait = 3.8+(Math.sin(state.next*2.17)+1)*.7;
    }
  }
  function poseSpecterLocomotion(mover,t,dt,robeYawTarget=0,robeRollTarget=0) {
    const specter=mover.root,parts=mover.parts,drift=Math.sin(t*.72+mover.phase);
      const robeFollow = Math.min(1, dt * 2.2);
      mover.robeYaw += (robeYawTarget - mover.robeYaw) * robeFollow;
      mover.robeRoll += (robeRollTarget - mover.robeRoll) * robeFollow;
      parts.spectralBody.rotation.y = mover.robeYaw;
      parts.spectralBody.rotation.z = mover.robeRoll;
      const travelAmount = mover.state === SPECTER_MOVE_STATE.FLOATING ? Math.sin(mover.progress * Math.PI) : 0;
      parts.leftArm.shoulder.rotation.x = -travelAmount * 0.025;
      parts.rightArm.shoulder.rotation.x = -travelAmount * 0.025;
      parts.leftArm.shoulder.rotation.z = mover.leftShoulderZ + drift * 0.009;
      parts.rightArm.shoulder.rotation.z = mover.rightShoulderZ - drift * 0.009;
      parts.leftArm.hand.rotation.z = Math.sin(t * 0.60 + mover.phase) * 0.012;
      parts.rightArm.hand.rotation.z = -Math.sin(t * 0.60 + mover.phase) * 0.012;

      tickFloatingRockArmGestures(specter, t, dt);
      if(mover.fastFloat && mover.state===SPECTER_MOVE_STATE.FLOATING) {
        // Alternating broad flipper strokes propel the fast hover.
        const stroke=Math.sin(mover.progress * Math.PI * 5);
        const envelope=Math.sin(mover.progress * Math.PI);
        for(const [arm,side] of [[parts.leftArm,-1],[parts.rightArm,1]]) {
          arm.shoulder.rotation.x=-.45+stroke*side*.65*envelope;
          arm.shoulder.rotation.z=-side*(.35+.25*envelope);
          arm.elbow.rotation.x=-.30+stroke*side*.38*envelope;
          arm.hand.rotation.x=stroke*side*.22*envelope;
        }
        parts.torso.rotation.z=stroke*.055*envelope;
      }
  }
  function create(mover){
    const specter=mover.root,parts=mover.parts;
    const previous=specter.position.clone(),velocity=new THREE.Vector3(),acceleration=new THREE.Vector3();
    let previousYaw=specter.rotation.y,pending=null;
    const nodes=[parts.rig,parts.torso,parts.spectralBody,parts.head,
      ...[parts.leftArm,parts.rightArm].flatMap(a=>[a.shoulder,a.elbow,a.hand,...a.jaws.map(j=>j.joint)])];
    const rests=nodes.map(node=>({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()}));
    function advance(input,t,dt){
      let finished=false;
      const drift = Math.sin(t * 0.72 + mover.phase);
      const slowSway = Math.sin(t * 0.43 + mover.phase * 0.7);
      let robeYawTarget = 0;
      let robeRollTarget = slowSway * 0.008;

      if (mover.state === SPECTER_MOVE_STATE.IDLE_HOVER) {
        specter.position.y = mover.baseY + drift * 0.025;
        parts.rig.position.x = slowSway * 0.008;
        parts.torso.rotation.x *= Math.max(0, 1 - dt * 4);
        parts.torso.rotation.z = slowSway * 0.006;

      } else if (mover.state === SPECTER_MOVE_STATE.START_FLOAT) {
        mover.progress = Math.min(1, mover.progress + dt / (mover.fastFloat ? .32 : .85));
        const eased = smoothMinotaurStep(mover.progress);
        specter.rotation.y = mover.startYaw + mover.yawTravel * eased;
        specter.position.y = mover.startBaseY + drift * 0.018;
        parts.rig.position.x = slowSway * 0.006;
        parts.torso.rotation.x = -eased * 0.018;
        robeYawTarget = -mover.yawTravel * (1 - eased) * 0.18;
        robeRollTarget = Math.max(-0.025, Math.min(0.025, -mover.yawTravel * 0.025));
        if (mover.progress >= 1) {
          specter.rotation.y = mover.desiredYaw;
          mover.progress = 0;
          mover.state = SPECTER_MOVE_STATE.FLOATING;
        }
      } else if (mover.state === SPECTER_MOVE_STATE.FLOATING) {
        mover.progress = Math.min(1, mover.progress + dt / mover.travelDuration);
        const eased = smoothMinotaurStep(mover.progress);
        const dx = mover.targetX - mover.startX;
        const dz = mover.targetZ - mover.startZ;
        const distance = Math.max(0.001, Math.hypot(dx, dz));
        const curveOffset = Math.sin(eased * Math.PI) * mover.curve;
        specter.position.x = mover.startX + dx * eased + (dz / distance) * curveOffset;
        specter.position.z = mover.startZ + dz * eased - (dx / distance) * curveOffset;

        const heightDelta = mover.targetBaseY - mover.startBaseY;
        const heightProgress = heightDelta >= 0
          ? smoothMinotaurStep(mover.progress / 0.60)
          : smoothMinotaurStep((mover.progress - 0.40) / 0.60);
        const intendedY = mover.startBaseY + heightDelta * heightProgress + drift * 0.012;
        const sampled=input.sampleGround?.(specter.position.x,specter.position.z);
        const clearanceFloor=Number.isFinite(sampled)?sampled+SPECTER_MIN_CLEARANCE:-Infinity;
        specter.position.y = Math.max(intendedY, clearanceFloor);

        parts.rig.position.x = -curveOffset * 0.08;
        parts.torso.rotation.x = mover.fastFloat ? -.20 : -Math.sin(mover.progress * Math.PI) * 0.025;
        parts.torso.rotation.z = -curveOffset * 0.10;
        robeYawTarget = curveOffset * -0.22;
        robeRollTarget = curveOffset * -0.14;
        if (mover.progress >= 1) {
          mover.progress = 0;
          mover.state = SPECTER_MOVE_STATE.SETTLING;
        }
      } else {
        mover.progress = Math.min(1, mover.progress + dt / (mover.fastFloat ? .38 : .9));
        const eased = smoothMinotaurStep(mover.progress);
        specter.position.x = mover.targetX;
        specter.position.z = mover.targetZ;
        specter.position.y = mover.targetBaseY + Math.sin(eased * Math.PI) * 0.018 + drift * 0.012;
        parts.rig.position.x *= Math.max(0, 1 - dt * 4.5);
        parts.torso.rotation.x *= Math.max(0, 1 - dt * 4.5);
        parts.torso.rotation.z *= Math.max(0, 1 - dt * 4.5);
        if (mover.progress >= 1) {
          mover.baseY = mover.targetBaseY;finished=true;
          mover.progress = 0;
          mover.state = SPECTER_MOVE_STATE.IDLE_HOVER;
        }
      }

      return {robeYawTarget,robeRollTarget,finished};
    }
    function interrupt(){
      pending=null;previous.copy(specter.position);previousYaw=specter.rotation.y;
      velocity.set(0,0,0);acceleration.set(0,0,0);mover.actualSpeed=0;mover.yawRate=0;
      const gesture=specter.userData.floatingArmGestures;
      if(gesture){gesture.previousPosition.copy(specter.position);gesture.previousYaw=specter.rotation.y;gesture.travel=0;gesture.turn=0;}
    }
    return {
      mover,family:'specter',
      prepare(input={},dt=0,t=0){
        if(pending)throw new Error('Specter prepare requires matching commit');
        const before={position:specter.position.clone(),yaw:specter.rotation.y,state:mover.state,
          progress:mover.progress,baseY:mover.baseY,rig:parts.rig.position.clone(),torso:parts.torso.quaternion.clone()};
        const targets=advance(input,t,input.blocked?0:dt);
        pending={before,...targets};
        const proposal={position:specter.position.clone(),yaw:specter.rotation.y,finished:targets.finished};
        specter.position.copy(before.position);specter.rotation.y=before.yaw;return proposal;
      },
      commit(resolved={},t=0,dt=0){
        let robeYawTarget=pending?.robeYawTarget||0,robeRollTarget=pending?.robeRollTarget||0;
        if(pending&&resolved.accepted===0){
          const b=pending.before;mover.state=b.state;mover.progress=b.progress;mover.baseY=b.baseY;
          parts.rig.position.copy(b.rig);parts.torso.quaternion.copy(b.torso);robeYawTarget=0;robeRollTarget=0;
        }
        if(resolved.accepted!==0&&mover.state===SPECTER_MOVE_STATE.START_FLOAT&&pending?.before.state===SPECTER_MOVE_STATE.START_FLOAT){
          robeYawTarget=-battleBroYawDelta(mover.desiredYaw-specter.rotation.y)*.18;
        }else if(resolved.accepted!==0&&mover.state===SPECTER_MOVE_STATE.FLOATING&&pending?.before.state===SPECTER_MOVE_STATE.FLOATING){
          const dx=mover.targetX-mover.startX,dz=mover.targetZ-mover.startZ,length=Math.max(.001,Math.hypot(dx,dz));
          const lateral=((specter.position.x-mover.startX)*dz-(specter.position.z-mover.startZ)*dx)/length;
          robeYawTarget=-lateral*.22;robeRollTarget=-lateral*.14;
        }
        const old=velocity.clone();velocity.copy(specter.position).sub(previous).divideScalar(dt||1);
        acceleration.copy(velocity).sub(old).divideScalar(dt||1);
        mover.velocity=velocity;mover.acceleration=acceleration;mover.actualSpeed=Math.hypot(velocity.x,velocity.z);
        mover.yawRate=dt?battleBroYawDelta(specter.rotation.y-previousYaw)/dt:0;
        mover.grounded=resolved.grounded!==false;
        poseSpecterLocomotion(mover,t,dt,robeYawTarget,robeRollTarget);
        host.worldExpression(specter,t);host.expression(specter,dt);host.secondary(specter,t,dt,mover);
        previous.copy(specter.position);previousYaw=specter.rotation.y;pending=null;
      },
      carry(delta){
        previous.add(delta);
        for(const key of ['startX','targetX'])mover[key]+=delta.x;
        for(const key of ['startZ','targetZ'])mover[key]+=delta.z;
        for(const key of ['baseY','startBaseY','targetBaseY'])mover[key]+=delta.y;
        specter.userData.floatingArmGestures?.previousPosition.add(delta);
      },
      interrupt,
      reset({baseY=specter.position.y}={}){
        interrupt();for(const r of rests){r.node.position.copy(r.p);r.node.quaternion.copy(r.q);r.node.scale.copy(r.s);}
        delete specter.userData.floatingArmGestures;
        Object.assign(mover,{state:SPECTER_MOVE_STATE.IDLE_HOVER,progress:0,robeYaw:0,robeRoll:0,baseY,
          startBaseY:baseY,targetBaseY:baseY,startX:specter.position.x,targetX:specter.position.x,
          startZ:specter.position.z,targetZ:specter.position.z,startYaw:specter.rotation.y,desiredYaw:specter.rotation.y,yawTravel:0});
      }
    };
  }
  return {create,gestures:tickFloatingRockArmGestures,pose:poseSpecterLocomotion};
});
