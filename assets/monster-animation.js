/* Monster's authored upper-body layer, over the one shared support controller.
 * No navigation, physics, separate gait equations or update loop. */
(function(global,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else global.createMonsterAnimationSystem=factory;
})(typeof globalThis!=='undefined'?globalThis:this,function(THREE,host){
  'use strict';
  const {Math,smoothBattleBroStep,LAVA_MOVE_STATE}=host;
  function tickAdvancedTurn(mover) {
    const turn = mover.turn;
    const angle = turn.delta * turn.steps;
    const p = (turn.index + turn.progress) / turn.steps;
    const hips = smoothBattleBroStep((p - 0.10) / 0.80);
    const chest = smoothBattleBroStep((p - 0.04) / 0.76);
    const head = smoothBattleBroStep(p / 0.46);
    const startYaw = turn.yaw - turn.delta * turn.index;
    mover.parts.torso.rotation.y = startYaw + angle * hips - mover.root.rotation.y;
    const pose = mover.upperTurn || (mover.upperTurn = {});
    pose.chest = angle * (chest - hips);
    pose.head = angle * (head - chest);
    // The companion head notices slightly later and makes a smaller, slower glance.
    pose.head2 = angle * (smoothBattleBroStep((p - 0.01) / 0.54) - chest) * 0.72;
    pose.head2Pitch = Math.sin(Math.PI * p) ** 2 * 0.045;
    pose.lean = -Math.sign(angle) * Math.sin(Math.PI * p) ** 2 * 0.045;
  }
  function tickMonsterSecondHead(root, t) {
    const parts=root.userData.rig,phase=t+root.userData.looseRocks.phase;
    const sway=Math.sin(phase*.72)*.018;
    if(parts.head2){
      parts.head2.rotation.set(.06+Math.sin(phase*.43)*.035,
        Math.sin(phase*.37+1.7)*.18,sway*.6);
      const secondBlink=(phase+1.3)%4.8;
      parts.secondFace.leftEye.scale.y=parts.secondFace.rightEye.scale.y=secondBlink>4.57
        ?Math.max(.12,Math.abs(secondBlink-4.685)/.115):1;
    }
  }
  function tickAdvancedIdle(root, t) {
    tickMonsterSecondHead(root, t);
    const parts = root.userData.rig;
    const phase = t + root.userData.looseRocks.phase;
    const sway = Math.sin(phase * 0.65) * 0.012;
    parts.torso.rotation.set(-0.06, 0, sway);
    parts.torso.position.y = -1.28 + Math.sin(phase * 0.85) * 0.012;
    parts.head.rotation.z = -sway * 0.7;
    parts.head.rotation.y = Math.sin(phase * 0.31) * 0.025;
    const blink = phase % 4.8;
    parts.leftEye.scale.y = parts.rightEye.scale.y = blink > 4.57
      ? Math.max(0.12, Math.abs(blink - 4.685) / 0.115) : 1;
  }
  function tickGreaterBalance(root, t, mover = null) {
    const parts = root.userData.rig;
    const phase = t + root.userData.looseRocks.phase;
    const moving = mover && mover.state !== LAVA_MOVE_STATE.IDLE;
    const sway = Math.sin(phase * 0.72) * (moving ? 0.036 : 0.018);
    // A smooth lean-and-recover only during a short part of a 19-second cycle.
    const cycle = phase % 19;
    const catchLean = cycle > 15 && cycle < 18
      ? Math.sin((cycle - 15) * Math.PI / 3) ** 2 * 0.055 : 0;
    parts.torso.rotation.y = 0;
    parts.torso.rotation.z = -0.055 + sway - catchLean;
    parts.torso.rotation.x = -0.06 + Math.sin(phase * 0.51) * 0.018;
    parts.torso.position.x = -0.08 + Math.sin(phase * 0.72) * 0.045;
    parts.torso.position.y = -1.28 + Math.sin(phase * 1.44) * 0.015;
    parts.head.rotation.z = -sway * 0.8 + catchLean * 0.9;
    parts.head.rotation.y = 0;
    parts.head.rotation.x = 0.06;
    parts.head.position.x = 0.34 - sway * 0.65;
    tickMonsterSecondHead(root, t);
    const blink = phase % 4.8;
    parts.leftEye.scale.y = parts.rightEye.scale.y = blink > 4.57
      ? Math.max(0.12, Math.abs(blink - 4.685) / 0.115) : 1;
  }
  function tickApexIdle(root, t) {
    tickMonsterSecondHead(root, t);
    const parts = root.userData.rig;
    const phase = t + root.userData.looseRocks.phase;
    parts.torso.rotation.x = -0.06;
    parts.torso.rotation.y = 0;
    parts.torso.rotation.z = 0;
    parts.head.rotation.z = 0;
    parts.torso.position.y = -1.28 + Math.sin(phase * 0.85) * 0.024;
    parts.head.rotation.y = Math.sin(phase * 0.31) * 0.035;
    // One revolution every 24 seconds, around the mount's tilted local Y axis.
    parts.shoulderWeaponSpin.rotation.y = (t * Math.PI / 12) % (Math.PI * 2);
    const blink = (phase + 0.7) % 4.8;
    parts.leftEye.scale.y = parts.rightEye.scale.y = blink > 4.57 ? Math.max(0.12, Math.abs(blink - 4.685) / 0.115) : 1;
  }
  function layer(mover,t){
    const root=mover.root,form=root.userData.form;
    // Select by visible Monster form, independently of its inherited lower rig.
    if(form===7)tickApexIdle(root,t);
    else if(form===6)tickAdvancedIdle(root,t);
    else tickGreaterBalance(root,t,mover);
      if (mover.root.userData.characterFamily === 'monsters' && mover.upperTurn) {
        const upper = mover.root.userData.rig;
        const pose = mover.upperTurn;
        // Apply after idle so anticipation survives its neutral pose writes.
        upper.torso.rotation.y = pose.chest;
        upper.torso.rotation.z += pose.lean;
        upper.head.rotation.y += pose.head;
        upper.head.rotation.z -= pose.lean * 0.6;
        if(upper.head2){
          upper.head2.rotation.y += pose.head2;
          upper.head2.rotation.x += pose.head2Pitch;
          upper.head2.rotation.z -= pose.lean * 0.45;
        }
        if (!mover.turn) mover.upperTurn = null;
      }

  }
  function create(mover){
    // This is the actual shared controller, not another gait behind a wrapper.
    const controller=host.locomotion().create(mover);
    controller.family='monsters';return controller;
  }
  function reset(mover){
    mover.upperTurn=null;
    const motion=mover.root.userData.upperArmMotion;
    if(motion){
      motion.previousPosition.copy(mover.root.position);motion.previousYaw=null;
      motion.velocity.set(0,0,0);motion.turn=0;motion.acceleration=0;motion.gesture=null;
      motion.gestureWait=Math.max(1.5,motion.gestureWait);
      for(const arm of motion.arms)for(const follow of arm.follow)follow.set(0,0,0);
    }
  }
  return {create,layer,reset,tickAdvancedTurn,tickMonsterSecondHead,tickAdvancedIdle,tickGreaterBalance,tickApexIdle};
});
