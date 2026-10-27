/* Authoritative planted-support animation. Home and resident navigation supply
 * routes and terrain plans; no environment selector or separate resident poses.
 * r128 / browser + CommonJS. Both support families use this actual controller;
 * Monster supplies its authored family layer at the shared commit stage.
 */
(function(global,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else global.createJuggernautAnimationSystem=factory;
})(typeof globalThis!=='undefined'?globalThis:this,function(THREE,host){
  'use strict';
  const encounter=typeof module==='object'&&module.exports?require('./battlebro-encounter.js'):globalThis.BattleBroEncounter;
  const Math=host.Math||globalThis.Math;
  const {lavaMovementForm, lavaSupportScale, battleBroYawDelta, LAVA_TURN_MORPHOLOGY, LAVA_TURN_FORM_TUNING, NEWBORN_SPACING, DEVELOPING_GAIT, ADOLESCENT_GAIT, NEWBORN_GAIT, LAVA_HAND_LATERAL, LAVA_HAND_FORWARD, LAVA_WRIST_ABOVE_GROUND, LAVA_UPPER_ARM_LENGTH, LAVA_FOREARM_LENGTH, LAVA_MOVE_STATE, withLavaClamber, planLavaTerrainTurn, smoothBattleBroStep, smoothJuggernautStep, sampleLavaContactSwing, tickAdvancedTurn, usesBipedSupportGait, setLavaHandAnchor, beginJuggernautRun, beginJuggernautStride, enterLavaMoveState, tickJuggernautRun, tickJuggernautStride, settleLavaMonsterMove, tickGreaterBalance, tickAdvancedIdle, tickApexIdle, tickUpperArmMotion, tickLooseRockAttachments, tickBattleBroExpression, poseDevelopingArms}=host;
  const chooseLavaWalkTarget=m=>host.chooseTarget(m);
  const selectLavaWalkRoute=m=>host.selectRoute(m);
  const battleBroGroundHeight=(x,z)=>host.groundHeight(x,z);
  function beginLavaTurn(mover, currentDirection, targetDirection) {
    const form = lavaMovementForm(mover.root) || 4;
    const profile = LAVA_TURN_MORPHOLOGY[form < 4 ? 'juvenile' : form === 4 ? 'mature' : 'advanced'];
    const tuning = LAVA_TURN_FORM_TUNING[form];
    const delta = battleBroYawDelta(targetDirection - currentDirection);
    const steps = Math.max(1, Math.ceil(Math.abs(delta) / (profile.step * tuning.step)));
    const anchors = mover.anchors || [mover.leftAnchor, mover.rightAnchor];
    const terrainTurn = mover.terrainContacts ? (mover.terrainPlan?.rough
      ? withLavaClamber(mover, () => planLavaTerrainTurn(mover, targetDirection), mover.terrainPlan.clamberLimit)
      : planLavaTerrainTurn(mover, targetDirection)) : null;
    if (mover.terrainContacts && !terrainTurn) {
      mover.state = LAVA_MOVE_STATE.IDLE;
      mover.targetCellX = mover.cellX; mover.targetCellZ = mover.cellZ;
      mover.terrainPlan = null; mover.recoveryExit = null;
      mover.pauseRemaining = 1.5;
      return false;
    }
    mover.turn = {
      terrainTurn,
      profile, anchors, steps, index: 0, progress: 0,
      duration: profile.duration * tuning.duration,
      yaw: currentDirection, delta: delta / steps,
      side: delta < 0 ? 0 : 1, phase: 'SHIFT',
      center: mover.root.position.clone(),
      starts: anchors.map(anchor => anchor.clone()),
      goals: anchors.map(anchor => anchor.clone()),
      local: new THREE.Vector3(), direction: new THREE.Vector3(), bend: new THREE.Vector3(),
      elbow: new THREE.Vector3(), rest: new THREE.Vector3(), quaternion: new THREE.Quaternion(),
      contactYaw: [currentDirection, currentDirection],
    };
    mover.state = 'TURNING';
    prepareLavaTurnStep(mover);
    return true;
  }
  function prepareLavaTurnStep(mover) {
    const turn = mover.turn;
    const form = lavaMovementForm(mover.root);
    const lateral = (form === 1 ? NEWBORN_SPACING.limbX
      : form === 2 ? DEVELOPING_GAIT.limbX : form === 3 ? ADOLESCENT_GAIT.limbX : LAVA_HAND_LATERAL)*lavaSupportScale(mover.root);
    const forward = (form < 4 ? 0.06 : LAVA_HAND_FORWARD)*lavaSupportScale(mover.root);
    const yaw = turn.yaw + turn.delta;
    for (let i = 0; i < 2; i++) {
      turn.starts[i].copy(turn.anchors[i]);
      const x = (i ? 1 : -1) * lateral;
      turn.goals[i].set(turn.center.x + Math.cos(yaw) * x + Math.sin(yaw) * forward,
        turn.center.y, turn.center.z - Math.sin(yaw) * x + Math.cos(yaw) * forward);
      if (turn.terrainTurn?.plans[turn.index]) turn.goals[i].copy(turn.terrainTurn.plans[turn.index][i].end);
    }
  }
  function tickLavaTurn(mover, dt) {
    if (!mover.turn && !beginLavaTurn(mover, mover.root.rotation.y, mover.desiredYaw)) return false;
    const turn = mover.turn, profile = turn.profile;
    if (Math.abs(turn.delta) < 1e-6) return true;
    turn.progress = Math.min(1, turn.progress + Math.max(0, Math.min(dt, 0.05)) / turn.duration);
    const p = turn.progress, side = turn.side, support = 1 - side;
    const reach = smoothBattleBroStep((p - 0.16) / 0.26);
    const pull = smoothBattleBroStep((p - 0.42) / 0.27);
    const adjust = smoothBattleBroStep((p - 0.69) / 0.23);
    turn.phase = p < 0.16 ? 'SHIFT' : p < 0.42 ? 'REACH' : p < 0.69 ? 'PULL' : p < 0.92 ? 'ADJUST' : 'SETTLE';
    turn.anchors[side].lerpVectors(turn.starts[side], turn.goals[side], reach);
    turn.anchors[side].y += Math.sin(Math.PI * reach) * profile.lift;
    turn.anchors[support].lerpVectors(turn.starts[support], turn.goals[support], adjust);
    turn.anchors[support].y += Math.sin(Math.PI * adjust) * profile.lift * 0.8;
    turn.contactYaw[side] = turn.yaw + turn.delta * reach;
    turn.contactYaw[support] = turn.yaw + turn.delta * adjust;
    const swings = turn.terrainTurn?.plans[turn.index];
    if (swings) {
      turn.contactYaw[side] = turn.yaw + turn.delta * sampleLavaContactSwing(turn.anchors[side], swings[side], reach);
      turn.contactYaw[support] = turn.yaw + turn.delta * sampleLavaContactSwing(turn.anchors[support], swings[support], adjust);
    }
    // Orientation changes only after the reaching support has landed. Both
    // contacts stay in world space while the body pulls between them.
    mover.root.rotation.y = turn.yaw + turn.delta * pull;
    const load = smoothBattleBroStep(p / 0.16) * (1 - smoothBattleBroStep((p - 0.92) / 0.08));
    const weight = (side ? -1 : 1) * (1 - 2 * pull) * load;
    mover.parts.rig.position.x = profile.sway * weight;
    mover.parts.rig.position.y = -profile.sway * load;
    const body = mover.parts.torso || mover.parts.rig;
    body.rotation.z = -profile.lean * weight;
    if (mover.root.userData.characterFamily === 'monsters') {
      tickAdvancedTurn(mover);
    }
    if (p < 1) return false;
    turn.yaw += turn.delta;
    turn.index++;
    turn.side = support;
    turn.progress = 0;
    if (turn.index < turn.steps) {
      prepareLavaTurnStep(mover);
      return false;
    }
    return true;
  }
  function solveLavaTurnArm(mover, arm, anchor, index, turn = mover.turn) {
    const target = turn.local.copy(anchor);
    target.y += mover.terrainContacts ? mover.terrainContacts[index].sole : LAVA_WRIST_ABOVE_GROUND;
    mover.parts.torso.worldToLocal(target);
    const a = arm.elbow.position.length(), b = arm.hand.position.length();
    // The decorated shoulder rests slightly beyond full extension. Compress
    // its floating joint enough to reach the floor instead of sliding a fist.
    arm.shoulder.position.y = index ? mover.rightShoulderBaseY : mover.leftShoulderBaseY;
    const horizontalSq = (target.x - arm.shoulder.position.x) ** 2 + (target.z - arm.shoulder.position.z) ** 2;
    arm.shoulder.position.y = Math.min(arm.shoulder.position.y,
      target.y + Math.sqrt(Math.max(0, (a + b - 0.002) ** 2 - horizontalSq)));
    target.sub(arm.shoulder.position);
    const distance = Math.max(0.01, Math.min(a + b - 0.001, target.length()));
    const direction = turn.direction.copy(target).normalize();
    const along = (a * a - b * b + distance * distance) / (2 * distance);
    const bend = turn.bend.set(0, 0, -1).addScaledVector(direction, direction.z).normalize();
    const elbow = turn.elbow.copy(direction).multiplyScalar(along)
      .addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
    arm.shoulder.quaternion.setFromUnitVectors(turn.rest.copy(arm.elbow.position).normalize(), turn.bend.copy(elbow).normalize());
    target.copy(direction).multiplyScalar(distance).sub(elbow)
      .applyQuaternion(turn.quaternion.copy(arm.shoulder.quaternion).invert()).normalize();
    arm.elbow.quaternion.setFromUnitVectors(turn.rest.copy(arm.hand.position).normalize(), target);
    arm.elbow.updateWorldMatrix(true, false);
    arm.elbow.getWorldQuaternion(turn.quaternion).invert();
    arm.hand.quaternion.setFromAxisAngle(turn.rest.set(0, 1, 0), turn.contactYaw[index]).premultiply(turn.quaternion);
  }
  function solveLavaArmToAnchor(mover, arm, anchor) {
    if (mover.terrainContacts) {
      const index = arm === mover.parts.leftArm ? 0 : 1;
      mover.terrainIK.contactYaw[index] = mover.root.rotation.y;
      return solveLavaTurnArm(mover, arm, anchor, index, mover.terrainIK);
    }
    const target = mover.ikTarget.copy(anchor);
    target.y += LAVA_WRIST_ABOVE_GROUND;
    mover.parts.torso.worldToLocal(target);
    const dy = target.y - arm.shoulder.position.y;
    const dz = target.z - arm.shoulder.position.z;
    const reach = Math.max(0.08, Math.min(LAVA_UPPER_ARM_LENGTH + LAVA_FOREARM_LENGTH - 0.015, Math.hypot(dy, dz)));
    const elbowCos = Math.max(-1, Math.min(1,
      (reach * reach - LAVA_UPPER_ARM_LENGTH * LAVA_UPPER_ARM_LENGTH - LAVA_FOREARM_LENGTH * LAVA_FOREARM_LENGTH)
        / (2 * LAVA_UPPER_ARM_LENGTH * LAVA_FOREARM_LENGTH),
    ));
    const elbowAngle = Math.acos(elbowCos);
    const targetAngle = Math.atan2(-dz, -dy);
    const shoulderAngle = targetAngle - Math.atan2(
      LAVA_FOREARM_LENGTH * Math.sin(elbowAngle),
      LAVA_UPPER_ARM_LENGTH + LAVA_FOREARM_LENGTH * Math.cos(elbowAngle),
    );
    arm.shoulder.rotation.set(shoulderAngle, 0, 0);
    arm.elbow.rotation.set(elbowAngle, 0, 0);
    arm.hand.rotation.y = 0;
    arm.hand.rotation.x = -(shoulderAngle + elbowAngle + mover.parts.torso.rotation.x);
    arm.hand.rotation.z = -mover.parts.torso.rotation.z;
  }
  function poseBattleBroSupportWalk(mover,p,stride) {
    const parts=mover.parts;
    const first=p<.5;
    const u=first?p*2:(p-.5)*2;
    const reach=smoothJuggernautStep(u/.58);
    const swing=first?mover.rightAnchor:mover.leftAnchor;
    const start=first?stride.rightStart:stride.leftStart;
    const goal=first?mover.rightGoal:mover.leftGoal;
    if(first)mover.leftAnchor.copy(stride.leftStart);else mover.rightAnchor.copy(mover.rightGoal);
    swing.lerpVectors(start,goal,reach);
    swing.y+=Math.sin(Math.PI*reach)*stride.lift;
    const terrainSwing=mover.terrainPlan?.swings[first?0:1];
    if(terrainSwing?.raised)sampleLavaContactSwing(swing,terrainSwing,reach);

    // Transfer the body after the reaching support lands. In particular, do
    // not drag the body ahead while the trailing support is still swinging.
    const travel=(first?0:.5)+.5*smoothJuggernautStep((u-.58)/.42);
    mover.root.position.x=THREE.MathUtils.lerp(mover.startX,mover.targetX,travel);
    mover.root.position.z=THREE.MathUtils.lerp(mover.startZ,mover.targetZ,travel);
    mover.root.position.y=THREE.MathUtils.lerp(mover.startY,mover.targetY,travel);
    if(stride.impactYaw!==undefined)mover.root.rotation.y=stride.startYaw
      +battleBroYawDelta(stride.impactYaw-stride.startYaw)*smoothJuggernautStep(Math.min(1,p/.72));
    const rhythm=Math.sin(Math.PI*2*p),rise=Math.sin(Math.PI*2*p)**2;
    parts.rig.position.x=-rhythm*.022;
    parts.rig.position.y=rise*.018;
    parts.torso.rotation.set(0,0,rhythm*.016);
    parts.head.position.y=mover.headBaseY-rise*.008;
    parts.head.rotation.x=-rise*.008;
    mover.progress=p;
  }
  function poseBattleBroSupportRun(mover,p,run) {
    const parts=mover.parts,anchors=[mover.leftAnchor,mover.rightAnchor];
    const scale=run.scale;
    const takeoff=.60,landing=.84;
    const swing=smoothJuggernautStep(p/landing);
    const support=anchors[run.support],recovery=anchors[run.landing];
    recovery.lerpVectors(run.starts[run.landing],run.goal,swing);
    recovery.y+=Math.sin(Math.PI*Math.min(1,p/landing))*.38*scale;
    support.copy(run.starts[run.support]);
    if(p>takeoff){
      const fold=smoothJuggernautStep((p-takeoff)/(1-takeoff));
      const forwardX=Math.sin(mover.desiredYaw),forwardZ=Math.cos(mover.desiredYaw);
      const side=run.support?1:-1;
      const endX=mover.targetX-forwardX*.38*scale+Math.cos(mover.desiredYaw)*side*LAVA_HAND_LATERAL*scale;
      const endZ=mover.targetZ-forwardZ*.38*scale-Math.sin(mover.desiredYaw)*side*LAVA_HAND_LATERAL*scale;
      support.x=THREE.MathUtils.lerp(support.x,endX,fold);
      support.z=THREE.MathUtils.lerp(support.z,endZ,fold);
      support.y=THREE.MathUtils.lerp(support.y,mover.targetY+.24*scale,
        Math.sin(Math.PI*.5*(p-takeoff)/(1-takeoff)));
    }
    // Compression -> planted extension -> ballistic arc -> landing absorption.
    let bounce;
    const launchVelocity=4*.08/(landing-takeoff);
    if(p<.16)bounce=-.09*smoothJuggernautStep(p/.16);
    else if(p<takeoff){
      const u=(p-.16)/(takeoff-.16);
      // Match upward velocity at takeoff instead of pausing at full extension.
      bounce=-.09+.22*(3*u*u-2*u*u*u)+launchVelocity*(takeoff-.16)*(u*u*u-u*u);
    }else if(p<landing){
      const flight=(p-takeoff)/(landing-takeoff);bounce=.13+.08*4*flight*(1-flight);
    }else{
      const u=(p-landing)/(1-landing);
      // Absorb the incoming flight velocity continuously into the next load.
      bounce=.13*(2*u*u*u-3*u*u+1)-launchVelocity*(1-landing)*(u*u*u-2*u*u+u);
    }
    const travel=p-.025*Math.sin(2*Math.PI*p);
    mover.root.position.set(THREE.MathUtils.lerp(mover.startX,mover.targetX,travel),
      THREE.MathUtils.lerp(mover.startY,mover.targetY,travel)+bounce*scale,
      THREE.MathUtils.lerp(mover.startZ,mover.targetZ,travel));
    const lean=run.first?smoothJuggernautStep(p/.22):1;
    parts.rig.position.set(0,0,0);
    parts.torso.rotation.set(.055*lean,0,0);
    run.phase=p<.16?'LOAD':p<takeoff?'PUSH':p<landing?'FLIGHT':'LAND';
    run.contact[run.support]=p<=takeoff;run.contact[run.landing]=p>=landing;
    mover.progress=p;
  }
  function poseBattleBroJuvenileLoad(mover,reach,p,side,gait,developing) {
    const parts=mover.parts,weight=Math.sin(Math.PI*p);
    parts.rig.position.x=-side*weight*gait.sway;
    parts.rig.position.y=-weight*(reach?.015:.055);
    parts.rig.rotation.z=side*weight*(developing?gait.lean:.10);
  }
  function advance(mover,t,dt){
      const parts = mover.parts;
      const state = mover.state;
      const bipedGait=usesBipedSupportGait(mover.root);
      let phaseDuration = state === LAVA_MOVE_STATE.TURNING ? 0.7
        : (state === LAVA_MOVE_STATE.REACH_RIGHT || state === LAVA_MOVE_STATE.REACH_LEFT ? 0.72
          : (state === LAVA_MOVE_STATE.PULL_RIGHT || state === LAVA_MOVE_STATE.PULL_LEFT ? 0.92
            : (state === LAVA_MOVE_STATE.PLANT_RIGHT || state === LAVA_MOVE_STATE.PLANT_LEFT ? 0.24 : 0.42)));

      if (lavaMovementForm(mover.root) === 5) {
        phaseDuration *= state === LAVA_MOVE_STATE.PULL_LEFT ? 1.20
          : state === LAVA_MOVE_STATE.PULL_RIGHT ? 1.07 : 1.08;
      }

      if (state === LAVA_MOVE_STATE.IDLE) {
        const groundY = mover.terrainContacts ? (mover.leftAnchor.y + mover.rightAnchor.y) * 0.5 : battleBroGroundHeight(mover.cellX, mover.cellZ);
        mover.root.position.y += (groundY - mover.root.position.y) * Math.min(1, dt * 6);
        parts.rig.position.y = Math.sin(t * 1.7) * 0.006;
        parts.torso.rotation.z = Math.sin(t * 0.65) * 0.005;
        const throwing=mover.root.userData.rockThrow;
        const holdStance=throwing && (bipedGait || ['NOTICE','WINDUP','RELEASE'].includes(throwing.state));
        if (!holdStance) {
          mover.pauseRemaining -= dt;
          if (mover.pauseRemaining <= 0) chooseLavaWalkTarget(mover);
        }
      } else if (state === LAVA_MOVE_STATE.TURNING && !mover.terrainContacts) {
        // Other material variants retain their existing orientation behavior.
        const yawDelta = battleBroYawDelta(mover.desiredYaw - mover.root.rotation.y);
        mover.root.rotation.y += yawDelta * Math.min(1, dt * 3.2);
        parts.torso.rotation.z = Math.max(-0.045, Math.min(0.045, -yawDelta * 0.07));
        const groundY = battleBroGroundHeight(mover.cellX, mover.cellZ);
        setLavaHandAnchor(mover.leftAnchor, mover.root.position.x, mover.root.position.z, mover.root.rotation.y, -1, groundY,lavaSupportScale(mover.root));
        setLavaHandAnchor(mover.rightAnchor, mover.root.position.x, mover.root.position.z, mover.root.rotation.y, 1, groundY,lavaSupportScale(mover.root));
        if (Math.abs(yawDelta) < 0.035) {
          mover.root.rotation.y = mover.desiredYaw;
          setLavaHandAnchor(mover.leftAnchor, mover.startX, mover.startZ, mover.desiredYaw, -1, mover.startY,lavaSupportScale(mover.root));
          setLavaHandAnchor(mover.rightAnchor, mover.startX, mover.startZ, mover.desiredYaw, 1, mover.startY,lavaSupportScale(mover.root));
          if(mover.encounterStationary){mover.state='IDLE';mover.progress=0;}
          else if(bipedGait){if(mover.juggernautJog)beginJuggernautRun(mover);else beginJuggernautStride(mover);}
          else enterLavaMoveState(mover, LAVA_MOVE_STATE.SHIFT_LEFT);
        }
      } else if (state === LAVA_MOVE_STATE.TURNING) {
        if (tickLavaTurn(mover, dt)) {
          if(mover.pendingScenerySmash||mover.encounterStationary){
            mover.state=LAVA_MOVE_STATE.IDLE;mover.progress=0;
            parts.rig.position.set(0,0,0);parts.torso.rotation.set(0,0,0);
          }else if(bipedGait){if(mover.juggernautJog)beginJuggernautRun(mover);else beginJuggernautStride(mover);}
          else enterLavaMoveState(mover, LAVA_MOVE_STATE.SHIFT_LEFT);
        }
      } else if(state===LAVA_MOVE_STATE.JUGGERNAUT_RUN){
        tickJuggernautRun(mover,dt);
      } else if(state===LAVA_MOVE_STATE.JUGGERNAUT_STRIDE){
        tickJuggernautStride(mover,dt);
      } else {
        mover.progress = Math.min(1, mover.progress + dt / phaseDuration);
        const gaitEase=usesBipedSupportGait(mover.root)?smoothJuggernautStep:smoothBattleBroStep;
        const p = gaitEase(mover.progress);
        let nextState = null;

        if (state === LAVA_MOVE_STATE.SHIFT_LEFT) {
          parts.torso.rotation.z = p * 0.065;
          parts.rig.position.x = -p * 0.035;
          parts.rig.position.y = (-0.14 + (mover.terrainContacts ? 0 : Math.min(0, mover.targetY - mover.root.position.y))) * p;
          if (mover.progress >= 1) nextState = LAVA_MOVE_STATE.REACH_RIGHT;
        } else if (state === LAVA_MOVE_STATE.REACH_RIGHT) {
          mover.rightAnchor.lerpVectors(mover.reachStart, mover.rightGoal, p);
          mover.rightAnchor.y += Math.sin(mover.progress * Math.PI) * 0.16;
          if (mover.terrainPlan) sampleLavaContactSwing(mover.rightAnchor, mover.terrainPlan.swings[0], p);
          parts.torso.rotation.z = 0.065 - p * 0.025;
          parts.torso.rotation.y = -p * 0.055;
          parts.rig.position.y = -0.14 + (mover.terrainContacts ? 0 : Math.min(0, mover.targetY - mover.root.position.y));
          if (mover.progress >= 1) nextState = LAVA_MOVE_STATE.PLANT_RIGHT;
        } else if (state === LAVA_MOVE_STATE.PLANT_RIGHT) {
          parts.rightArm.shoulder.position.y = mover.rightShoulderBaseY - Math.sin(mover.progress * Math.PI) * 0.045;
          parts.rig.position.y = -0.14 + (mover.terrainContacts ? 0 : Math.min(0, mover.targetY - mover.root.position.y))
            - Math.sin(mover.progress * Math.PI) * 0.035;
          if (mover.progress >= 1) nextState = LAVA_MOVE_STATE.PULL_RIGHT;
        } else if (state === LAVA_MOVE_STATE.PULL_RIGHT) {
          const pull = gaitEase((mover.progress - 0.14) / 0.86);
          mover.root.position.x = mover.pullStartX + (mover.pullEndX - mover.pullStartX) * pull;
          mover.root.position.z = mover.pullStartZ + (mover.pullEndZ - mover.pullStartZ) * pull;
          mover.root.position.y = mover.pullStartY + (mover.pullEndY - mover.pullStartY) * pull - Math.sin(pull * Math.PI) * 0.035;
          parts.torso.rotation.z = 0.04 - pull * 0.075;
          parts.torso.rotation.y = -0.055 + pull * 0.09;
          parts.rig.position.x = -0.035 + pull * 0.060;
          parts.rig.position.y = mover.pullRigStartY * (1 - pull);
          if (mover.progress >= 1) nextState = LAVA_MOVE_STATE.SHIFT_RIGHT;
        } else if (state === LAVA_MOVE_STATE.SHIFT_RIGHT) {
          parts.torso.rotation.z = -0.035 - p * 0.030;
          parts.rig.position.x = 0.025 + p * 0.015;
          parts.rig.position.y = (-0.14 + (mover.terrainContacts ? 0 : Math.min(0, mover.targetY - mover.root.position.y))) * p;
          if (mover.progress >= 1) nextState = LAVA_MOVE_STATE.REACH_LEFT;
        } else if (state === LAVA_MOVE_STATE.REACH_LEFT) {
          mover.leftAnchor.lerpVectors(mover.reachStart, mover.leftGoal, p);
          mover.leftAnchor.y += Math.sin(mover.progress * Math.PI) * 0.16;
          if (mover.terrainPlan) sampleLavaContactSwing(mover.leftAnchor, mover.terrainPlan.swings[1], p);
          parts.torso.rotation.z = -0.065 + p * 0.025;
          parts.torso.rotation.y = 0.055 * p;
          parts.rig.position.y = -0.14 + (mover.terrainContacts ? 0 : Math.min(0, mover.targetY - mover.root.position.y));
          if (mover.progress >= 1) nextState = LAVA_MOVE_STATE.PLANT_LEFT;
        } else if (state === LAVA_MOVE_STATE.PLANT_LEFT) {
          parts.leftArm.shoulder.position.y = mover.leftShoulderBaseY - Math.sin(mover.progress * Math.PI) * 0.045;
          parts.rig.position.y = -0.14 + (mover.terrainContacts ? 0 : Math.min(0, mover.targetY - mover.root.position.y))
            - Math.sin(mover.progress * Math.PI) * 0.035;
          if (mover.progress >= 1) nextState = LAVA_MOVE_STATE.PULL_LEFT;
        } else if (state === LAVA_MOVE_STATE.PULL_LEFT) {
          const pull = gaitEase((mover.progress - 0.14) / 0.86);
          mover.root.position.x = mover.pullStartX + (mover.pullEndX - mover.pullStartX) * pull;
          mover.root.position.z = mover.pullStartZ + (mover.pullEndZ - mover.pullStartZ) * pull;
          mover.root.position.y = mover.pullStartY + (mover.pullEndY - mover.pullStartY) * pull - Math.sin(pull * Math.PI) * 0.035;
          parts.torso.rotation.z = -0.04 + pull * 0.04;
          parts.torso.rotation.y = 0.055 * (1 - pull);
          parts.rig.position.x = 0.04 * (1 - pull);
          parts.rig.position.y = mover.pullRigStartY * (1 - pull);
          if (mover.progress >= 1) nextState = LAVA_MOVE_STATE.SETTLE;
        } else if (state === LAVA_MOVE_STATE.SETTLE) {
          parts.rig.position.y = -Math.sin(mover.progress * Math.PI) * 0.028;
          parts.rig.position.x *= 1 - p;
          parts.torso.rotation.z *= 1 - p;
          parts.torso.rotation.y *= 1 - p;
          if (mover.progress >= 1) settleLavaMonsterMove(mover);
        }
        if (nextState) enterLavaMoveState(mover, nextState);
      }


  }
  function finish(mover,t,dt){
    const parts=mover.parts;
      mover.root.updateMatrixWorld(true);
      if (mover.turn) {
        solveLavaTurnArm(mover, parts.leftArm, mover.leftAnchor, 0);
        solveLavaTurnArm(mover, parts.rightArm, mover.rightAnchor, 1);
        if (mover.state !== LAVA_MOVE_STATE.TURNING) {
          mover.turnHandoff = mover.terrainContacts ? null : {
            elapsed: 0,
            rotations: [parts.leftArm, parts.rightArm].map(arm =>
              [arm.shoulder.quaternion.clone(), arm.elbow.quaternion.clone(), arm.hand.quaternion.clone()]),
            heights: [parts.leftArm.shoulder.position.y, parts.rightArm.shoulder.position.y],
          };
          mover.turn = null;
        }
      } else {
        solveLavaArmToAnchor(mover, parts.leftArm, mover.leftAnchor);
        solveLavaArmToAnchor(mover, parts.rightArm, mover.rightAnchor);
        if (mover.turnHandoff) {
          const handoff = mover.turnHandoff;
          handoff.elapsed += Math.max(0, Math.min(dt, 0.05));
          const blend = smoothBattleBroStep(handoff.elapsed / 0.24);
          [parts.leftArm, parts.rightArm].forEach((arm, i) => {
            [arm.shoulder, arm.elbow, arm.hand].forEach((joint, j) =>
              joint.quaternion.slerp(handoff.rotations[i][j], 1 - blend));
            arm.shoulder.position.y = handoff.heights[i] +
              ((i ? mover.rightShoulderBaseY : mover.leftShoulderBaseY) - handoff.heights[i]) * blend;
          });
          if (blend === 1) mover.turnHandoff = null;
        }
      }
      const bodyBob = parts.rig.position.y;
      parts.head.position.y = mover.headBaseY - bodyBob * 0.55;
      parts.head.rotation.x = -parts.torso.rotation.x * 0.35;
      if(mover.root.userData.characterFamily==='monsters')host.poseMonsterLayer(mover,t,dt);
      else if(lavaMovementForm(mover.root)===5)tickGreaterBalance(mover.root,t,mover);
      tickUpperArmMotion(mover.root, t, dt, mover);
      tickLooseRockAttachments(mover.root, t, dt, mover);
      const blinkCycle = (t + 0.7) % 4.8;
      const eyeScale = blinkCycle > 4.57 ? Math.max(0.12, Math.abs(blinkCycle - 4.685) / 0.115) : 1;
      parts.leftEye.scale.y = eyeScale;
      parts.rightEye.scale.y = eyeScale;
      tickBattleBroExpression(mover.root, dt);
  }
  function advanceJuvenile(mover,t,dt){
    const { root, parts } = mover;
    const adolescent = root.userData.form === 3;
    const developing = root.userData.form === 2 || adolescent;
    const gait = adolescent ? ADOLESCENT_GAIT : developing ? DEVELOPING_GAIT : NEWBORN_GAIT;
    const limbX = developing ? gait.limbX : NEWBORN_SPACING.limbX;
    const stride = developing ? gait.stride : 0.25;
    dt = Math.max(0, Math.min(dt, 0.05));
    if (mover.state === 'IDLE') {
      if (!mover.root.userData.rockThrow || !['NOTICE','WINDUP','RELEASE'].includes(mover.root.userData.rockThrow.state)) mover.pauseRemaining -= dt;
      if (mover.pauseRemaining <= 0) {
        const route = selectLavaWalkRoute(mover);
        if (route) {
          mover.terrainPlan = route.plan;
          mover.targetCellX = route.x; mover.targetCellZ = route.z;
          mover.startX = root.position.x; mover.startZ = root.position.z;
          mover.dx = route.x - mover.cellX; mover.dz = route.z - mover.cellZ; mover.desiredYaw = route.yaw;
          mover.turn = null;
          mover.state = route.reverse ? 'REACH' : 'TURNING'; mover.progress = 0; mover.stepIndex = 0;
          if (route.reverse) mover.reachStart.copy(mover.anchors[mover.sideIndex]);
        }
        mover.pauseRemaining = 2.5;
      }
    } else if (mover.state === 'TURNING') {
      if (tickLavaTurn(mover, dt)) {
        if(mover.pendingScenerySmash||mover.encounterStationary){mover.state='IDLE';mover.progress=0;parts.rig.position.set(0,0,0);}
        else {mover.state = 'REACH'; mover.progress = 0;mover.reachStart.copy(mover.anchors[mover.sideIndex]);}
      }
    } else if (adolescent && mover.state === 'PLANT') {
      mover.progress = Math.min(1, mover.progress + dt / gait.plant);
      parts.rig.position.y = -Math.sin(Math.PI * mover.progress) * 0.025;
      if (mover.progress >= 1) { mover.state = 'PULL'; mover.progress = 0; }
    } else {
      const reach = mover.state === 'REACH';
      mover.progress = Math.min(1, mover.progress + dt / ((reach ? gait.reach : gait.pull) * (developing && mover.sideIndex ? (adolescent ? 1.04 : 1.10) : 1)));
      const gaitEase=root.userData.characterFamily==='juggernaut'?smoothJuggernautStep:smoothBattleBroStep;
      const p = gaitEase(mover.progress);
      const side = mover.sideIndex ? 1 : -1;
      const distance = (mover.stepIndex + 1) * stride;
      if (reach) {
        mover.goal.set(mover.startX + mover.dx * distance + Math.cos(mover.desiredYaw) * side * limbX,
          root.position.y, mover.startZ + mover.dz * distance - Math.sin(mover.desiredYaw) * side * limbX);
        mover.anchors[mover.sideIndex].lerpVectors(mover.reachStart, mover.goal, p);
        mover.anchors[mover.sideIndex].y += Math.sin(p * Math.PI) * gait.lift;
        if (mover.terrainPlan) sampleLavaContactSwing(mover.anchors[mover.sideIndex], mover.terrainPlan.swings[mover.stepIndex], p);
      } else {
        // Delayed, short tug with the planted rocks fixed in world space.
        const delay = developing ? gait.pullDelay : 0.18;
        const pull = gaitEase((mover.progress - delay) / (developing ? 1 - delay : 0.82));
        const travel = (mover.stepIndex + pull) * stride;
        root.position.x = mover.startX + mover.dx * travel;
        root.position.z = mover.startZ + mover.dz * travel;
        if (mover.terrainPlan) root.position.y = THREE.MathUtils.lerp(mover.pullStartY, mover.terrainPlan.swings[mover.stepIndex].bodyY, pull);
      }
      poseBattleBroJuvenileLoad(mover,reach,p,side,gait,developing);
      if (mover.progress >= 1) {
        mover.progress = 0;
        if (reach) { mover.pullStartY = root.position.y; mover.state = adolescent ? 'PLANT' : 'PULL'; }
        else {
          mover.stepIndex++; mover.sideIndex = 1 - mover.sideIndex;
          mover.reachStart.copy(mover.anchors[mover.sideIndex]);
          mover.state = mover.stepIndex < (developing ? gait.steps : 4) ? 'REACH' : 'IDLE';
          if (mover.state === 'IDLE') {
            mover.cellX = mover.targetCellX; mover.cellZ = mover.targetCellZ;
            mover.pauseRemaining = mover.recoveryExit ? 0.35 : 2.5 + Math.random() * 2;
          }
        }
      }
    }

  }
  function finishJuvenile(mover,t,dt){
    const {root,parts}=mover;
    const adolescent=root.userData.form===3,developing=root.userData.form===2||adolescent;
    const gait=adolescent?ADOLESCENT_GAIT:developing?DEVELOPING_GAIT:NEWBORN_GAIT;
    root.updateMatrixWorld(true);
    parts.limbs.forEach((limb, i) => {
      mover.scratch.copy(mover.anchors[i]);
      if (mover.terrainContacts) mover.scratch.y += mover.terrainContacts[i].sole;
      limb.position.copy(root.worldToLocal(mover.scratch));
    });
    if (mover.turn) {
      parts.limbs.forEach((limb, i) => { limb.rotation.y = mover.turn.contactYaw[i] - root.rotation.y; });
      if (mover.state !== 'TURNING') mover.turn = null;
    }
    parts.head.position.y = (developing ? gait.headY : NEWBORN_SPACING.headY) + Math.sin(t * 1.3) * 0.018;
    parts.head.rotation.y = Math.sin(t * 0.6) * 0.025;
    const blink = (t + 0.7) % 4.8;
    parts.leftEye.scale.y = parts.rightEye.scale.y = blink > 4.57 ? Math.max(0.12, Math.abs(blink - 4.685) / 0.115) : 1;
    if (developing) poseDevelopingArms(root);
    // Give adolescent stones restrained load separation and compression.
    if (adolescent) {
      mover.floatLoad.progress = mover.progress;
      mover.floatLoad.state = mover.state + (mover.sideIndex ? '_RIGHT' : '_LEFT');
    }
    tickLooseRockAttachments(root, t, dt, mover.turn ? mover : adolescent ? mover.floatLoad : null);
  }
  function create(mover){
    const root=mover.root,juvenile=lavaMovementForm(root)<4;
    const previous=root.position.clone(),velocity=new THREE.Vector3();
    let previousYaw=root.rotation.y,pending=null;
    // A rejected proposal must not consume a contact phase. Save only phase
    // records and primary pose nodes, not the geometry/secondary-animation rig.
    function contacts(){
      if(mover.juggernautRun){
        const run=mover.juggernautRun;
        return run.finishing?[run.support!==0,run.support!==1]:run.contact.slice();
      }
      const contact=[true,true],turn=mover.turn;
      if(turn){
        if(turn.phase==='REACH')contact[turn.side]=false;
        if(turn.phase==='ADJUST')contact[1-turn.side]=false;
      }else if(mover.juggernautStride){
        const p=mover.progress,u=p<.5?p*2:(p-.5)*2;
        if(u>0&&u<.58)contact[p<.5?1:0]=false;
      }else if(juvenile&&mover.state==='REACH'&&mover.progress>0)contact[mover.sideIndex]=false;
      return contact;
    }
    function checkpoint(){
      const records=[],seen=new Set();
      function save(object,recurse=false){
        if(!object||seen.has(object))return;
        seen.add(object);
        if(object.isVector3||object.isQuaternion){records.push(()=>object.copy(value));const value=object.clone();return;}
        const entries=Object.entries(object);
        records.push(()=>{for(const key of Object.keys(object))if(!entries.some(([k])=>k===key))delete object[key];for(const [key,value]of entries)object[key]=value;});
        if(recurse)for(const [,value]of entries){
          if(value&&(value.isVector3||value.isQuaternion||Array.isArray(value)||Object.getPrototypeOf(value)===Object.prototype))save(value,true);
        }
      }
      save(mover);
      for(const key of ['anchors','leftAnchor','rightAnchor','leftGoal','rightGoal','reachStart','goal','turn','turnHandoff','juggernautStride','juggernautRun','juggernautJog','floatLoad','upperTurn'])save(mover[key],true);
      const parts=mover.parts;
      for(const node of [parts.rig,parts.torso,parts.head,parts.leftArm?.shoulder,parts.rightArm?.shoulder])if(node){save(node.position);save(node.quaternion);}
      return ()=>{for(const restore of records)restore();};
    }
    return {
      encounterFrame(yaw,dt,t,canTurn){
        mover.encounterStationary=true;mover.pauseRemaining=Infinity;
        if(Number.isFinite(yaw)&&mover.state!=='TURNING'&&Math.abs(battleBroYawDelta(yaw-root.rotation.y))>.025){
          mover.desiredYaw=yaw;mover.turn=null;mover.progress=0;mover.state='TURNING';
          mover.startX=root.position.x;mover.startY=root.position.y;mover.startZ=root.position.z;
          mover.targetX=root.position.x;mover.targetY=root.position.y;mover.targetZ=root.position.z;
          mover.targetCellX=mover.cellX;mover.targetCellZ=mover.cellZ;
        }
        const wasTurning=mover.state==='TURNING';
        const proposal=this.prepare({},dt,t),accepted=canTurn(proposal.yaw);
        if(accepted)root.rotation.y=proposal.yaw;
        this.commit({accepted:accepted?1:0,grounded:true},t,dt);
        const done=mover.state==='IDLE';
        const failed=wasTurning&&done&&Math.abs(battleBroYawDelta(mover.desiredYaw-root.rotation.y))>.04;
        return {accepted:accepted&&!failed,done};
      },
      syncEncounterHistory(){pending=null;previous.copy(root.position);previousYaw=root.rotation.y;velocity.set(0,0,0);},
      encounterPose:()=>encounter.createPose(mover,root.userData.characterFamily||"juggernaut"),
      mover,
      // Phase/contact preparation precedes movement resolution; IK runs afterwards.
      prepare(input={},dt=0,t=0){
        if(pending)throw new Error('Juggernaut prepare requires a matching commit');
        const position=root.position.clone(),yaw=root.rotation.y,restore=checkpoint();
        if(!input.blocked)(juvenile?advanceJuvenile:advance)(mover,t,dt);
        pending={position:root.position.clone(),yaw:root.rotation.y,origin:position,originYaw:yaw,restore,dt,t,blocked:!!input.blocked};
        root.position.copy(position);root.rotation.y=yaw;
        return {position:pending.position,yaw:pending.yaw};
      },
      commit(resolved={},t=0,dt=0){
        if(pending&&resolved.accepted===0){
          pending.restore();
        }
        const step=Math.max(0,dt);
        velocity.copy(root.position).sub(previous).divideScalar(step||1);
        mover.velocity=velocity;mover.actualSpeed=Math.hypot(velocity.x,velocity.z);
        mover.turnRate=step?battleBroYawDelta(root.rotation.y-previousYaw)/step:0;
        mover.supportContacts=contacts();
        mover.grounded=resolved.grounded!==false&&mover.supportContacts.some(Boolean);
        (juvenile?finishJuvenile:finish)(mover,t,dt);
        if(juvenile)tickBattleBroExpression(root,dt);
        previous.copy(root.position);previousYaw=root.rotation.y;pending=null;
      },
      carry(delta,history=true){
        if(history)previous.add(delta);
        const seen=new Set();
        const carry=v=>{if(v?.isVector3&&!seen.has(v)){v.add(delta);seen.add(v);}};
        for(const key of ['leftAnchor','rightAnchor','leftGoal','rightGoal','reachStart','goal'])carry(mover[key]);
        mover.anchors?.forEach(carry);
        for(const key of ['startX','targetX','pullStartX','pullEndX'])if(Number.isFinite(mover[key]))mover[key]+=delta.x;
        for(const key of ['startZ','targetZ','pullStartZ','pullEndZ'])if(Number.isFinite(mover[key]))mover[key]+=delta.z;
        for(const key of ['startY','targetY','pullStartY','pullEndY'])if(Number.isFinite(mover[key]))mover[key]+=delta.y;
        if(mover.turn){carry(mover.turn.center);mover.turn.starts.forEach(carry);mover.turn.goals.forEach(carry);}
        for(const swing of [...(mover.terrainPlan?.swings||[]),...(mover.turn?.terrainTurn?.plans.flat()||[])]){
          carry(swing.start);carry(swing.end);if(Number.isFinite(swing.bodyY))swing.bodyY+=delta.y;
          if(Number.isFinite(swing.clearance))swing.clearance+=delta.y;
        }
        if(mover.juggernautStride){carry(mover.juggernautStride.leftStart);carry(mover.juggernautStride.rightStart);}
        if(mover.juggernautRun){mover.juggernautRun.starts.forEach(carry);carry(mover.juggernautRun.goal);carry(mover.juggernautRun.settleStart);carry(mover.juggernautRun.settleGoal);}
      },
      reset(){
        pending=null;previous.copy(root.position);previousYaw=root.rotation.y;velocity.set(0,0,0);
        mover.turn=null;mover.turnHandoff=null;mover.terrainPlan=null;
        mover.juggernautStride=null;mover.juggernautRun=null;mover.progress=0;mover.state='IDLE';
        mover.actualSpeed=0;mover.turnRate=0;
        mover.parts.rig.position.set(0,0,0);mover.parts.rig.rotation.set(0,0,0);
        if(mover.parts.torso)mover.parts.torso.rotation.set(0,0,0);
        host.resetContacts(mover);
        if(root.userData.characterFamily==='monsters')host.resetMonster(mover);
      },
      interrupt(){pending=null;previous.copy(root.position);previousYaw=root.rotation.y;velocity.set(0,0,0);mover.actualSpeed=0;mover.turnRate=0;}
    };
  }
  return {create,advance,finish,advanceJuvenile,finishJuvenile,beginLavaTurn,prepareLavaTurnStep,tickLavaTurn,solveLavaTurnArm,solveLavaArmToAnchor,poseBattleBroSupportWalk,poseBattleBroSupportRun,poseBattleBroJuvenileLoad};
});
