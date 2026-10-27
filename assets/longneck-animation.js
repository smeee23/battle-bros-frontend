/* Authoritative Longneck poses and contact sequencing. No navigation, collision,
 * gravity, terrain mutation or render loop. Browser + Node, Three.js r128. */
(function(root,factory){
  if(typeof module==='object' && module.exports)module.exports=factory;
  else root.createLongneckAnimation=factory;
})(typeof globalThis!=='undefined'?globalThis:this,function createLongneckAnimation(THREE,mover,options={}){
  const encounter=typeof module==='object'&&module.exports?require('./battlebro-encounter.js'):globalThis.BattleBroEncounter;
  const names=['frontLeft','frontRight','rearLeft','rearRight'];
  const LONGNECK_FOOT_FORE_AFT_REACH=.11,LONGNECK_FOOT_SIDE_REACH=.065;
  const battleBroYawDelta=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const random=options.random||Math.random;
  const parts=mover.parts,root=mover.root;
  mover.headBaseY ??= parts.head.position.y;
  mover.idlePhase ??= root.userData.idlePhase||0;
  mover.jawBaseX ??= parts.jaw.rotation.x;
  mover.lookRemaining ??= 1.5;
  mover.lookDirection ??= 0;
  mover.progress ??= 0;
  mover.state ??= 'IDLE';
  mover.longneckFootRest=names.map(name=>parts.minotaurLegs[name].position.clone());
  mover.legAngles=names.map(name=>({upper:parts.minotaurLegs[name].rotation.clone(),lower:parts.minotaurLegs[name].userData.lowerPivot.rotation.clone()}));
  root.updateMatrixWorld(true);
  const footGroundOffsets=names.map(name=>parts.minotaurLegs[name].getWorldPosition(new THREE.Vector3()).y-root.position.y);
  mover.longneckFootScratch=new THREE.Vector3();mover.longneckGallopTarget=new THREE.Vector3();
  mover.gallopRest={pivotX:parts.rearingPivot.rotation.x,bodyScaleX:parts.animalBody.scale.x,
    bodyZ:parts.animalBody.position.z,bodyRoll:parts.animalBody.rotation.z,
    chestY:parts.torso.position.y,chestZ:parts.torso.position.z,headZ:parts.head.position.z};
  const rest={rigY:parts.rig.position.y,torsoX:parts.torso.rotation.x,headY:parts.head.position.y,
    arms:[parts.leftArm,parts.rightArm].map(a=>({x:a.shoulder.rotation.x,z:a.shoulder.rotation.z,handX:a.hand?.rotation.x||0}))};
  const poseNodes=[parts.rig,parts.rearingPivot,parts.animalBody,parts.torso,parts.head,parts.neckPivot,parts.jaw,
    ...[parts.leftArm,parts.rightArm].flatMap(a=>[a.shoulder,a.elbow,a.hand]),
    ...names.flatMap(n=>[parts.minotaurLegs[n],parts.minotaurLegs[n].userData.lowerPivot])].filter(Boolean);
  const restTransforms=poseNodes.map(node=>({node,position:node.position.clone(),rotation:node.rotation.clone(),scale:node.scale.clone()}));
  function restorePose(){for(const r of restTransforms){r.node.position.copy(r.position);r.node.rotation.copy(r.rotation);r.node.scale.copy(r.scale);}resetLongneckFeet(mover);}
  let wasJump=false,lastState=mover.state,prepared=null;
  const lastPosition=root.position.clone();
  let lastYaw=root.rotation.y;
  const proposal={position:new THREE.Vector3()};
  mover.velocity=new THREE.Vector3();mover.acceleration=new THREE.Vector3();
  const velocity=new THREE.Vector3();
  function beginLongneckFootMotion(mover, turning) {
    const root = mover.root, names = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'];
    root.updateMatrixWorld(true);
    const delta = turning ? battleBroYawDelta(mover.desiredYaw - root.rotation.y) : 0;
    if (turning) mover.longneckTurnYaw = root.rotation.y;
    const cos = Math.cos(delta), sin = Math.sin(delta);
    mover.longneckFootMotion = names.map((name, i) => {
      const leg = mover.parts.minotaurLegs[name];
      const start = leg.getWorldPosition(new THREE.Vector3());
      const goal = start.clone();
      if (turning) {
        const dx = start.x - root.position.x, dz = start.z - root.position.z;
        goal.x = root.position.x + cos * dx + sin * dz;
        goal.z = root.position.z - sin * dx + cos * dz;
      } else {
        goal.x += mover.targetX - mover.startX;
        goal.y += mover.targetY - mover.startY;
        goal.z += mover.targetZ - mover.startZ;
      }
      const ground=mover.sampleFootGround?.(goal.x,goal.z);
      if(Number.isFinite(ground))goal.y=ground+footGroundOffsets[i];
      return { leg, rest: mover.longneckFootRest[i], start, goal, pair: i === 0 || i === 3 ? 0 : 1 };
    });
  }

  function poseLongneckFeet(mover, progress) {
    const motion = mover.longneckFootMotion;
    if (!motion) return;
    mover.root.updateMatrixWorld(true);
    for (const foot of motion) {
      const start = foot.pair ? 0.52 : 0.05;
      const swing = smoothMinotaurStep((progress - start) / 0.42);
      const point = mover.longneckFootScratch.copy(foot.start).lerp(foot.goal, swing);
      point.y += Math.sin(Math.PI * swing) * (0.085 + Math.abs(foot.goal.y - foot.start.y) * 0.3);
      foot.leg.position.copy(foot.leg.parent.worldToLocal(point));
      // This stylized rig has short legs. Soften the world-space plant when
      // its hip would travel beyond the body, especially during quarter turns.
      const dx = foot.leg.position.x - foot.rest.x;
      const dz = foot.leg.position.z - foot.rest.z;
      foot.leg.position.x = foot.rest.x + LONGNECK_FOOT_FORE_AFT_REACH * Math.tanh(dx / LONGNECK_FOOT_FORE_AFT_REACH);
      foot.leg.position.z = foot.rest.z + LONGNECK_FOOT_SIDE_REACH * Math.tanh(dz / LONGNECK_FOOT_SIDE_REACH);
    }
  }

  function poseTerrainFeet(){
    if(!mover.sampleFootGround)return;
    root.updateMatrixWorld(true);
    names.forEach((name,i)=>{
      const leg=parts.minotaurLegs[name];leg.position.copy(mover.longneckFootRest[i]);
      leg.updateWorldMatrix(true,false);const point=leg.getWorldPosition(mover.longneckFootScratch);
      const ground=mover.sampleFootGround(point.x,point.z);
      if(Number.isFinite(ground)){point.y=ground+footGroundOffsets[i];leg.position.copy(leg.parent.worldToLocal(point));}
    });
  }
  function resetLongneckFeet(mover) {
    if (!mover.longneckFootRest) return;
    ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'].forEach((name, i) => {
      const leg = mover.parts.minotaurLegs[name];
      leg.position.copy(mover.longneckFootRest[i]);
      leg.rotation.copy(mover.legAngles[i].upper);
      leg.userData.lowerPivot.rotation.copy(mover.legAngles[i].lower);
    });
    mover.longneckFootMotion = null;
    poseTerrainFeet();
  }

  function settleLongneckGallop(mover, dt) {
    const parts = mover.parts, rest = mover.gallopRest, settle = Math.min(1, dt*7);
    parts.rearingPivot.rotation.x += (rest.pivotX-parts.rearingPivot.rotation.x)*settle;
    parts.animalBody.scale.x += (rest.bodyScaleX-parts.animalBody.scale.x)*settle;
    parts.animalBody.position.z += (rest.bodyZ-parts.animalBody.position.z)*settle;
    parts.animalBody.rotation.z += (rest.bodyRoll-parts.animalBody.rotation.z)*settle;
    parts.torso.position.y += (rest.chestY-parts.torso.position.y)*settle;
    parts.torso.position.z += (rest.chestZ-parts.torso.position.z)*settle;
    parts.head.position.z += (rest.headZ-parts.head.position.z)*settle;
  }

  // One bound per tile. The rear supports launch the body, both pairs release
  // for suspension, and the fore supports catch the landing. World anchors
  // hold each support foot still while the body's pivots move over it.
  function poseLongneckGallop(mover) {
    const sprint = mover.sprint, parts = mover.parts, root = mover.root;
    const p = ((sprint.total - sprint.remaining + mover.progress) % 1 + 1) % 1;
    const pulse = (a, b, c, d) => smoothMinotaurStep((p-a)/(b-a))
      * (1-smoothMinotaurStep((p-c)/(d-c)));
    const gather = Math.max(1-smoothMinotaurStep((p-.05)/.14), smoothMinotaurStep((p-.83)/.14));
    const push = pulse(.12,.23,.30,.42);
    const flight = pulse(.33,.42,.56,.65);
    const catchWeight = pulse(.65,.73,.82,.92);
    const rest = mover.gallopRest;

    parts.rig.position.y = mover.gallopVisualBase + (-gather*.035 + push*.035 + flight*.11 - catchWeight*.045)/root.scale.y;
    parts.rearingPivot.rotation.x = rest.pivotX + push*.065 + flight*.025 - catchWeight*.055;
    // The body is one mesh, so a small longitudinal squash and pitch supply
    // the missing spine and pelvis articulation without changing its geometry.
    parts.animalBody.scale.x = rest.bodyScaleX*(1-gather*.055+push*.065+flight*.025);
    parts.animalBody.position.z = rest.bodyZ - gather*.045 + push*.075 + flight*.035;
    parts.animalBody.rotation.z = rest.bodyRoll + push*.055 - catchWeight*.04;
    parts.torso.position.y = rest.chestY + push*.09 + flight*.055 - catchWeight*.07;
    parts.torso.position.z = rest.chestZ - gather*.035 + push*.085 + flight*.045;
    parts.torso.rotation.x = push*-.105 + flight*-.055 + catchWeight*.11;
    parts.torso.rotation.z = Math.sin(p*Math.PI*2)*.008;
    parts.head.position.y = mover.headBaseY - push*.035 + catchWeight*.025;
    parts.head.position.z = rest.headZ + push*.035 - catchWeight*.025;
    parts.head.rotation.x = -parts.torso.rotation.x*.48 + flight*.035 - catchWeight*.025;
    parts.leftArm.shoulder.rotation.x = -push*.095 + catchWeight*.055;
    parts.rightArm.shoulder.rotation.x = -push*.095 + catchWeight*.055;

    root.updateMatrixWorld(true);
    ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'].forEach((name, i) => {
      const leg = parts.minotaurLegs[name];
      if (!sprint.feet[name]) sprint.feet[name] = { planted:false,
        anchor:new THREE.Vector3(), swingStart:leg.getWorldPosition(new THREE.Vector3()) };
      const foot = sprint.feet[name];
      const front = i < 2;
      const contact = front ? p >= .66 && p < .91 : p >= .06 && p < .34;
      if (contact && !foot.planted) {
        leg.getWorldPosition(foot.anchor);
        foot.planted = true;
      } else if (!contact && foot.planted) {
        leg.getWorldPosition(foot.swingStart);
        foot.planted = false;
      }
      const point = mover.longneckFootScratch;
      if (foot.planted) point.copy(foot.anchor);
      else {
        const u = front ? (p >= .91 ? (p-.91)/.75 : (p+.09)/.75)
          : (p >= .34 ? (p-.34)/.72 : (p+.66)/.72);
        const target = leg.parent.localToWorld(mover.longneckGallopTarget.copy(mover.longneckFootRest[i]));
        target.x += sprint.dx*(front ? .055 : -.035);
        target.z += sprint.dz*(front ? .055 : -.035);
        point.copy(foot.swingStart).lerp(target,smoothMinotaurStep(u));
        point.y += Math.sin(Math.PI*u)*.11;
      }
      leg.position.copy(leg.parent.worldToLocal(point));
      const offset = leg.position.x-mover.longneckFootRest[i].x;
      const reach = foot.planted ? .18 : LONGNECK_FOOT_FORE_AFT_REACH;
      leg.position.x = mover.longneckFootRest[i].x + Math.max(-reach,Math.min(reach,offset));
      leg.rotation.x = foot.planted ? 0 : (front ? -.14 : .16)*Math.sin(Math.PI*p);
      leg.userData.lowerPivot.rotation.x = foot.planted ? 0 : (front ? .18 : -.22)*Math.sin(Math.PI*p);
    });
  }

  function smoothMinotaurStep(value) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }

  function tickLongneckHead(mover, t, dt) {
    const parts = mover.parts;
    if (!parts.neckPivot || mover.root.userData.rockThrow) return;
    const idle = mover.state === 'IDLE';
    if (idle) {
      mover.lookRemaining -= dt;
      if (mover.lookRemaining <= 0) {
        mover.lookDirection = [-1, 0, 1][Math.floor(random()*3)];
        mover.lookRemaining = 2.2 + random()*2.6;
      }
    }
    const look = idle ? mover.lookDirection : 0;
    const neckTarget = look*.17, headTarget = look*.12;
    parts.neckPivot.rotation.y += (neckTarget-parts.neckPivot.rotation.y)*Math.min(1,dt*2.5);
    parts.head.rotation.y += (headTarget-parts.head.rotation.y)*Math.min(1,dt*3.5);
    const chew = (t+mover.idlePhase)%5.4;
    const open = idle && chew>3.15 && chew<4.35
      ? Math.sin((chew-3.15)/1.2*Math.PI)*.27 : 0;
    parts.jaw.rotation.x += (mover.jawBaseX+open-parts.jaw.rotation.x)*Math.min(1,dt*7);
  }

  function tickMinotaurRearing(mover, dt) {
    const parts = mover.parts;
    const legs = parts.minotaurLegs;
    const p = mover.progress;
    let rearAmount;
    if (p < 0.14) rearAmount = smoothMinotaurStep(p / 0.14) * 0.14;
    else if (p < 0.40) rearAmount = 0.14 + smoothMinotaurStep((p - 0.14) / 0.26) * 0.86;
    else if (p < 0.62) rearAmount = 1;
    else if (p < 0.88) rearAmount = 1 - smoothMinotaurStep((p - 0.62) / 0.26) * 0.88;
    else rearAmount = (1 - smoothMinotaurStep((p - 0.88) / 0.12)) * 0.12;

    const holdWave = p >= 0.40 && p < 0.62 ? Math.sin((p - 0.40) / 0.22 * Math.PI * 2) : 0;
    const rearAngle = rearAmount * (1.02 + holdWave * 0.025);
    parts.rearingPivot.rotation.x = -rearAngle;
    parts.rearingPivot.rotation.z = holdWave * 0.018;

    // Front cow legs fold at both the shoulder and newly articulated lower
    // hinge. The opposite Z rotations draw the pair slightly inward.
    legs.frontLeft.rotation.x = -rearAmount * 0.62;
    legs.frontRight.rotation.x = -rearAmount * 0.62;
    legs.frontLeft.rotation.z = rearAmount * 0.20;
    legs.frontRight.rotation.z = -rearAmount * 0.20;
    legs.frontLeft.userData.lowerPivot.rotation.x = rearAmount * 1.18;
    legs.frontRight.userData.lowerPivot.rotation.x = rearAmount * 1.18;

    // A restrained mirrored shoulder abduction keeps the hands separated;
    // the smaller opposite elbow bend lets the forearms hang naturally.
    parts.leftArm.shoulder.rotation.x = -rearAmount * 0.18 + holdWave * 0.03;
    parts.rightArm.shoulder.rotation.x = -rearAmount * 0.18 - holdWave * 0.03;
    parts.leftArm.shoulder.rotation.z = -rearAmount * 0.30;
    parts.rightArm.shoulder.rotation.z = rearAmount * 0.30;
    parts.leftArm.elbow.rotation.z = rearAmount * 0.18;
    parts.rightArm.elbow.rotation.z = -rearAmount * 0.18;

    parts.torso.rotation.x = rearAmount * 0.08;
    parts.torso.rotation.z = holdWave * 0.025;
    parts.head.rotation.x = rearAmount * 0.18;
    parts.head.rotation.y = holdWave * 0.05;
    parts.head.position.y = mover.headBaseY - rearAmount * 0.025;
    parts.rig.position.y = 0.018;
    if (p > 0.88) parts.rig.position.y += Math.sin((p - 0.88) / 0.12 * Math.PI) * 0.025;

  }

  function idle(t,dt){
    const phase=t*2.15+mover.idlePhase,breath=Math.sin(phase);
        if (mover.gallopSettle) {
          const settle = Math.min(1, dt * 7);
          settleLongneckGallop(mover, dt);
          ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'].forEach((name, i) => {
            const leg = parts.minotaurLegs[name];
            leg.position.lerp(mover.longneckFootRest[i], settle);
            leg.rotation.x *= 1 - settle;
            leg.userData.lowerPivot.rotation.x *= 1 - settle;
          });
          parts.torso.rotation.x *= 1 - settle;
          parts.head.rotation.x *= 1 - settle;
          parts.leftArm.shoulder.rotation.x *= 1 - settle;
          parts.rightArm.shoulder.rotation.x *= 1 - settle;
          if (Math.abs(parts.animalBody.scale.x-mover.gallopRest.bodyScaleX)<.001
            && ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'].every((name, i) =>
              parts.minotaurLegs[name].position.distanceTo(mover.longneckFootRest[i]) < 0.001))
            mover.gallopSettle = false;
        }
        const idleRigY = 0.018 + breath * 0.008;
        const idleTorsoZ = Math.sin(t * 0.8 + mover.idlePhase) * 0.006;
        const idleHeadY = mover.headBaseY - breath * 0.003;
        if (mover.longneckFootRest) {
          const settle = Math.min(1, dt * 5);
          parts.rig.position.y += (idleRigY - parts.rig.position.y) * settle;
          parts.torso.rotation.z += (idleTorsoZ - parts.torso.rotation.z) * settle;
          parts.head.position.y += (idleHeadY - parts.head.position.y) * settle;
        } else {
          parts.rig.position.y = idleRigY;
          parts.torso.rotation.z = idleTorsoZ;
          parts.head.position.y = idleHeadY;
        }
        if (mover.longneckFootRest && !parts.neckPivot)
          parts.head.rotation.y *= Math.max(0, 1 - dt * 3);

  }
  function turn(dt){
    const delta=battleBroYawDelta(mover.desiredYaw-mover.longneckTurnYaw);
          parts.torso.rotation.z = -Math.sin(Math.PI * mover.progress) * Math.sign(delta) * 0.025;
          const yawRate = mover.yawRate || 0;
          const headTarget = Math.max(-0.16, Math.min(0.16, -yawRate * 0.12));
          parts.head.rotation.y += (headTarget - parts.head.rotation.y) * Math.min(1, dt * 5);
          poseLongneckFeet(mover, mover.progress);

  }
  function walk(dt){
    const progress=mover.progress,isFlat=mover.state==='WALKING_FLAT';
    const bob=isFlat?Math.sin(progress*Math.PI*4)*.025:Math.sin(progress*Math.PI)*.018;
        const walkingPhase = progress * Math.PI * 4;
        const armSwing = Math.sin(walkingPhase) * (mover.sprint ? 0.115 : 0.08);
        parts.leftArm.shoulder.rotation.x = armSwing;
        parts.rightArm.shoulder.rotation.x = -armSwing;
        const slopeSign = isFlat ? 0 : Math.sign(mover.heightDelta);
        parts.torso.rotation.x = slopeSign > 0
          ? Math.sin(progress * Math.PI) * 0.075
          : (slopeSign < 0 ? -Math.sin(progress * Math.PI) * 0.045 : 0);
        if (mover.sprint) parts.torso.rotation.x -= Math.sin(progress * Math.PI) * 0.07;
        parts.torso.rotation.z = Math.sin(walkingPhase) * 0.022;
        parts.rig.position.y = 0.018;
        const headY = mover.headBaseY - bob * (mover.longneckFootRest ? 0.35 : 0.55);
        if (mover.longneckFootRest) parts.head.position.y += (headY - parts.head.position.y) * Math.min(1, dt * 7);
        else parts.head.position.y = headY;
        parts.head.rotation.x = -parts.torso.rotation.x * 0.45;
        if (mover.longneckFootRest) parts.head.rotation.y *= Math.max(0, 1 - dt * 3);

    parts.rig.position.y+=bob/root.scale.y;
    poseLongneckFeet(mover,progress);
  }
  // Prepare is speculative: movement/physics applies the proposed root transform.
  // Commit advances only the accepted fraction and never writes the physical root.
  function prepare(input={},dt){
    const state=mover.state,p0=mover.progress||0;
    const duration=input.duration||(state==='TURNING'?(mover.sprint?.72:1.15):state==='GALLOPING'?.43:
      state==='REARING'?4.2:state==='SPRINT_BRAKE'?.38:mover.sprint?.58:state==='WALKING_FLAT'?1.35:1.70);
    const p=Math.min(1,p0+dt/Math.max(.001,duration)),travel=smoothMinotaurStep(p);
    const position=proposal.position.copy(root.position);let yaw=root.rotation.y;
    if(state==='TURNING')yaw=mover.longneckTurnYaw+battleBroYawDelta(mover.desiredYaw-mover.longneckTurnYaw)*travel;
    else if(state==='SPRINT_BRAKE'){
      position.x=mover.brakeStartX+(mover.startX-mover.brakeStartX)*travel;
      position.z=mover.brakeStartZ+(mover.startZ-mover.brakeStartZ)*travel;
    } else if(['WALKING_FLAT','STEPPING_UP','STEPPING_DOWN','GALLOPING'].includes(state)){
      const u=state==='GALLOPING'?p:travel;
      position.x=mover.startX+(mover.targetX-mover.startX)*u;
      position.z=mover.startZ+(mover.targetZ-mover.startZ)*u;
      position.y=mover.startY+(mover.heightDelta||0)*smoothMinotaurStep((p-.28)/.46);
    } else if(state==='IDLE' && Number.isFinite(input.groundY))position.y+=(input.groundY-position.y)*Math.min(1,dt*7);
    prepared=Object.assign(proposal,{yaw,progress:state==='IDLE'?0:p,previousProgress:p0,previousYaw:root.rotation.y,state,dt});
    return prepared;
  }
  // A continuous destination is split into contact-sized strides. This is gait
  // sequencing, not route planning: callers validate every proposed movement.
  function prepareTravel(input,dt){
    if(input.discontinuity)reset();
    carry(input.supportDelta);
    if(input.supportId!==undefined && mover.supportId!==undefined && input.supportId!==mover.supportId)reset();
    mover.supportId=input.supportId;
    mover.sampleFootGround=input.sampleFootGround;
    const distance=Math.hypot(input.x-root.position.x,input.z-root.position.z);
    const speed=Math.max(0,input.speed||0),running=!!input.running;
    if(speed<.02 || distance<.005){
      if(mover.state!=='IDLE'){resetLongneckFeet(mover);mover.gallopSettle=true;}
      mover.state='IDLE';mover.progress=0;mover.sprint=null;
    } else if(mover.state==='IDLE'||mover.progress>=1||input.replan){
      const yaw=Math.atan2(input.x-root.position.x,input.z-root.position.z);
      const turning=Math.abs(battleBroYawDelta(yaw-root.rotation.y))>.2;
      const previousSprint=mover.state==='GALLOPING'&&!turning?mover.sprint:null;
      if(!previousSprint)resetLongneckFeet(mover);
      const stride=Math.min(1,distance),dx=Math.sin(yaw),dz=Math.cos(yaw);
      Object.assign(mover,{startX:root.position.x,startY:root.position.y,startZ:root.position.z,
        targetX:root.position.x+dx*stride,targetZ:root.position.z+dz*stride,
        targetY:input.targetY??root.position.y,desiredYaw:yaw,progress:0});
      const sampled=input.sampleGround?.(mover.targetX,mover.targetZ);
      if(Number.isFinite(sampled))mover.targetY=sampled;
      mover.heightDelta=mover.targetY-mover.startY;
      mover.sprint=running?{total:1,remaining:1,dx,dz,feet:previousSprint?.feet||{}}:null;
      mover.state=turning?'TURNING':running?'GALLOPING':Math.abs(mover.heightDelta)<.01?'WALKING_FLAT':mover.heightDelta>0?'STEPPING_UP':'STEPPING_DOWN';
      beginLongneckFootMotion(mover,turning);
    }
    // Distance-normalized cadence retains home curves while allowing catch-up speed.
    const length=Math.hypot(mover.targetX-mover.startX,mover.targetZ-mover.startZ);
    return prepare({groundY:input.groundY,duration:mover.state==='TURNING'?undefined:Math.max(.12,length/Math.max(.02,speed))},dt);
  }
  function carry(delta,history=true){
    if(!delta)return;
    if(history)lastPosition.add(delta);
    for(const f of mover.longneckFootMotion||[])for(const key of ['start','goal'])f[key].add(delta);
    for(const f of Object.values(mover.sprint?.feet||{})){f.anchor.add(delta);f.swingStart.add(delta);}
    for(const key of ['start','target'])for(const [axis,field] of [['x','X'],['y','Y'],['z','Z']])
      if(Number.isFinite(mover[key+field]))mover[key+field]+=delta[axis];
  }
  // Actions own their joint masks while active. Invalidate contact history without
  // touching the pose they have just written (strike completion restores it).
  function interrupt(){prepared=null;mover.longneckFootMotion=null;if(mover.sprint)mover.sprint.feet={};}
  function finishStep(){
    resetLongneckFeet(mover);
    parts.torso.rotation.x=0;parts.torso.rotation.z=0;parts.head.rotation.x=0;
    parts.leftArm.shoulder.rotation.x=0;parts.rightArm.shoulder.rotation.x=0;
  }
  function reset(){
    resetLongneckFeet(mover);mover.sprint=null;mover.progress=0;mover.state='IDLE';
    mover.gallopSettle=true;prepared=null;lastPosition.copy(root.position);lastYaw=root.rotation.y;mover.velocity.set(0,0,0);mover.acceleration.set(0,0,0);
  }
  function poseJump(j,config){
    const prep=j.phase==='prepare',land=j.phase==='landing';
    const u=Math.min(1,j.elapsed/(prep?config.prepare:config.land));
    const compression=prep?smoothMinotaurStep(u):land?Math.sin(Math.PI*u):0;
    const flight=prep?0:land?1-smoothMinotaurStep(u):Math.min(1,j.elapsed/.16);
    const descend=flight*Math.max(0,Math.min(1,-(j.vy||0)/config.velocity));
    parts.rig.position.y=rest.rigY-compression*.08+flight*.025;
    parts.torso.rotation.x=rest.torsoX+compression*.14-flight*.1+descend*.16;
    parts.head.position.y=rest.headY-compression*.035;
    names.forEach((name,i)=>{
      const leg=parts.minotaurLegs[name],front=i<2;
      leg.position.copy(mover.longneckFootRest[i]);leg.position.y+=compression*.035;
      leg.rotation.copy(mover.legAngles[i].upper);leg.rotation.z+=flight*(front?-.72:.62)*(1-descend*.35);
      leg.userData.lowerPivot.rotation.copy(mover.legAngles[i].lower);
      leg.userData.lowerPivot.rotation.z+=(front?.18:-.16)*flight*(1-descend)+compression*.22;
    });
    [parts.leftArm,parts.rightArm].forEach((arm,i)=>{
      arm.shoulder.rotation.x=rest.arms[i].x+compression*.3-flight*.25+descend*.35;
      arm.shoulder.rotation.z=rest.arms[i].z+(i?1:-1)*flight*.08;
      if(arm.hand)arm.hand.rotation.x=rest.arms[i].handX-descend*.15;
    });
  }
  function commit(resolved={},t=0,dt=prepared?.dt||0){
    const jumping=resolved.jump&&resolved.jump.phase!=='runup';
    if(wasJump&&!jumping){reset();parts.leftArm.shoulder.rotation.z=rest.arms[0].z;parts.rightArm.shoulder.rotation.z=rest.arms[1].z;}
    if(prepared){
      const accepted=Math.max(0,Math.min(1,resolved.accepted??1));
      if(accepted>0&&accepted<1&&['TURNING','WALKING_FLAT','STEPPING_UP','STEPPING_DOWN','SPRINT_BRAKE'].includes(prepared.state)){
        const from=smoothMinotaurStep(prepared.previousProgress);
        const travel=from+(smoothMinotaurStep(prepared.progress)-from)*accepted;
        let lo=prepared.previousProgress,hi=prepared.progress;
        for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(smoothMinotaurStep(mid)<travel)lo=mid;else hi=mid;}
        mover.progress=(lo+hi)/2;
      }else mover.progress=prepared.previousProgress+(prepared.progress-prepared.previousProgress)*accepted;
      mover.yawRate=battleBroYawDelta(root.rotation.y-prepared.previousYaw)/Math.max(.001,dt);
    }
    velocity.copy(root.position).sub(lastPosition).divideScalar(Math.max(.001,dt));
    mover.acceleration.copy(velocity).sub(mover.velocity).divideScalar(Math.max(.001,dt));
    mover.velocity.copy(velocity);lastPosition.copy(root.position);
    mover.yawRate=battleBroYawDelta(root.rotation.y-lastYaw)/Math.max(.001,dt);lastYaw=root.rotation.y;
    mover.actualSpeed=resolved.actualSpeed??Math.hypot(velocity.x,velocity.z);
    if(resolved.supportId!==undefined)mover.supportId=resolved.supportId;
    mover.grounded=resolved.grounded??!jumping;
    if(jumping){
      if(!wasJump){resetLongneckFeet(mover);mover.sprint=null;settleLongneckGallop(mover,1);}
      mover.state=resolved.jump.phase==='prepare'?'PREPARING_JUMP':resolved.jump.phase==='landing'?'LANDING':'AIRBORNE';poseJump(resolved.jump,resolved.jumpConfig);
    }else{
      if(lastState==='GALLOPING'&&mover.state!=='GALLOPING')mover.gallopSettle=true;
      if(mover.state==='IDLE'){
        idle(t,dt);
        poseTerrainFeet();
      }
      else if(mover.state==='TURNING'){settleLongneckGallop(mover,dt);turn(dt);}
      else if(mover.state==='GALLOPING'){
        if(lastState!=='GALLOPING'||mover.gallopVisualBase===undefined)mover.gallopVisualBase=parts.rig.position.y;
        poseLongneckGallop(mover);
      }
      else if(mover.state==='REARING')tickMinotaurRearing(mover,dt);
      else if(mover.state==='SPRINT_BRAKE'){parts.rig.position.y+=(.018-parts.rig.position.y)*Math.min(1,dt*8);settleLongneckGallop(mover,dt);}
      else {if(mover.gallopSettle)settleLongneckGallop(mover,dt);walk(dt);}
    }
    // Gaze follows the home layering; airborne state suppresses idle chewing.
    tickLongneckHead(mover,t,dt);
    const blink=(t+mover.idlePhase)%4.6;
    parts.leftEye.scale.y=parts.rightEye.scale.y=blink>4.38?Math.max(.10,Math.abs(blink-4.49)/.11):1;
    lastState=mover.state;wasJump=!!jumping;prepared=null;
  }
  // Temporary action state calls the same prepare/commit, foot plants and gaze as navigation.
  function encounterFrame(yaw,dt,t,canTurn){
    if(Number.isFinite(yaw)&&mover.state!=='TURNING'&&Math.abs(battleBroYawDelta(yaw-root.rotation.y))>.025){
      mover.desiredYaw=yaw;mover.progress=0;mover.state='TURNING';
      beginLongneckFootMotion(mover,true);
    }
    const proposal=prepare({},dt);
    const accepted=canTurn(proposal.yaw);
    if(accepted)root.rotation.y=proposal.yaw;
    commit({accepted:accepted?1:0,grounded:true,actualSpeed:0},t,dt);
    if(mover.state==='TURNING'&&mover.progress>=1){mover.state='IDLE';mover.progress=0;}
    return {accepted,done:mover.state==='IDLE'};
  }
  function syncEncounterHistory(){
    prepared=null;lastPosition.copy(root.position);lastYaw=root.rotation.y;lastState=mover.state;
    mover.velocity.set(0,0,0);mover.acceleration.set(0,0,0);mover.actualSpeed=0;mover.yawRate=0;
  }
  return {encounterFrame,syncEncounterHistory,encounterPose:()=>encounter.createPose(mover,"longneck"),mover,prepare,prepareTravel,commit,reset,interrupt,carry,restorePose,finishStep,
    beginFeet:turning=>beginLongneckFootMotion(mover,turning),
    poseFeet:p=>poseLongneckFeet(mover,p),resetFeet:()=>resetLongneckFeet(mover),
    settle:dt=>settleLongneckGallop(mover,dt),head:(t,dt)=>tickLongneckHead(mover,t,dt)};
});
