/* Shared jump action. Longneck posing remains in longneck-animation.js.
 * Navigation chooses when/where to jump; this reusable action owns vertical
 * motion and exclusive jump posing until landing, then restores the rig. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;
else root.createBattleBroJump=factory;})(typeof globalThis!=='undefined'?globalThis:this,function(THREE,root,options={}){
  const config={gravity:.6,velocity:2.9,prepare:.32,land:.38,...options};
  const parts=root.userData.rig,lower=root.userData.locomotionRig||parts;
  const heavy=['juggernaut','monsters'].includes(options.character);
  const supports=lower.leftArm?[lower.leftArm,lower.rightArm]:[];
  const arms=parts.leftArm?[parts.leftArm,parts.rightArm]:parts.leftSupport?[parts.leftSupport,parts.rightSupport]:[lower.leftArm,lower.rightArm];
  const rests={rigY:parts.rig.position.y,torsoX:parts.torso?.rotation.x||0,headY:parts.head.position.y,
    limbs:lower.limbs?.map(l=>l.position.clone()),supports:arms[0]?arms.map(a=>({x:a.shoulder.rotation.x,z:a.shoulder.rotation.z,handX:a.hand?.rotation.x||0})):null};
  const saved=[];
  const nodes=[...new Set([parts.rig,parts.torso,parts.head,...(lower.limbs||[]),
    ...arms.flatMap(a=>a?[a.shoulder,a.hand]:[]),
    ...(heavy?supports.flatMap(a=>[a.shoulder,a.elbow,a.hand]):[]),
    ...(heavy?(lower.arms||[]).flatMap(a=>[a.shoulder,a.upper,a.lower]):[])].filter(Boolean))];
  for(const node of nodes)saved.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});
  const pet={root,parts,rests,character:options.character,jump:{phase:'prepare',elapsed:0,vy:0}};
  const startY=root.position.y,startPosition=root.getWorldPosition(new THREE.Vector3()),worldPosition=new THREE.Vector3();
  let active=true;
  const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
  const depth=supports.length?.22:(root.userData.form===1?.10:.15);
  root.updateMatrixWorld(true);
  const parentScale=root.parent?.getWorldScale(new THREE.Vector3()).y||1;
  const bodyWorldScale=parts.rig.parent.getWorldScale(new THREE.Vector3()).y;
  const bodyScale=bodyWorldScale/parentScale;
  const pushHeight=depth*bodyScale;
  const contacts=heavy?(supports.length?supports.map(a=>a.hand):lower.limbs||[]).map(node=>({
    node,anchor:node.getWorldPosition(new THREE.Vector3()),target:new THREE.Vector3()})):[];
  const supportMover=supports.length?{root,parts:lower,terrainContacts:[{sole:0},{sole:0}],
    leftShoulderBaseY:supports[0].shoulder.position.y,rightShoulderBaseY:supports[1].shoulder.position.y}:null;
  const ik={local:new THREE.Vector3(),direction:new THREE.Vector3(),bend:new THREE.Vector3(),
    elbow:new THREE.Vector3(),rest:new THREE.Vector3(),quaternion:new THREE.Quaternion(),
    contactYaw:[root.rotation.y,root.rotation.y]};
  if(heavy&&supports.length&&typeof options.solveSupport!=='function')throw new Error('Heavy jumps require the shared support solver');
  root.userData.characterJumping=true;
  function poseHeavyJump(j){
    const preparing=j.phase==='prepare',landing=j.phase==='landing';
    const rise=Math.max(0,root.position.y-startY);
    const floor=options.groundY?.()??startY;
    const clearance=Math.max(0,root.position.y-floor);
    const u=landing?Math.min(1,j.elapsed/j.landDuration):0;
    // Ground contact starts a quick compression and a slower, bounded recovery.
    const absorb=u<.25?smooth(u/.25):1-smooth((u-.25)/.75);
    const compression=preparing?depth*smooth(j.elapsed/config.prepare)
      :landing?depth*j.impactStrength*absorb
      :j.vy>0?depth*(1-smooth(rise/pushHeight)):0;
    // Extension follows actual launch displacement. Relax the knees only after
    // pushing clear, then reach for the surface as physical clearance decreases.
    const tuck=preparing||landing?0:.10*smooth(clearance/(pushHeight*2))
      *(j.vy>0?smooth((rise-pushHeight)/pushHeight):1);
    parts.rig.position.y=rests.rigY-compression;
    if(parts.torso)parts.torso.rotation.x=rests.torsoX+.09*compression/depth-.035*tuck/.10;
    root.updateMatrixWorld(true);
    root.getWorldPosition(worldPosition);
    contacts.forEach((contact,i)=>{
      contact.target.copy(contact.anchor).add(worldPosition).sub(startPosition);
      if(preparing)contact.target.copy(contact.anchor);
      else if(!landing&&j.vy>0)contact.target.y-=Math.min(rise,compression*bodyScale)*parentScale;
      contact.target.y+=tuck*bodyWorldScale;
      if(supports.length)options.solveSupport(supportMover,supports[i],contact.target,i,ik);
      else contact.node.position.copy(contact.node.parent.worldToLocal(contact.target));
    });
    if(lower.arms)options.poseJuvenile?.(root);
    // Settle tiny IK/rest differences before releasing animation ownership.
    if(landing&&u>.75){
      const blend=smooth((u-.75)/.25);
      for(const pose of saved){
        pose.node.position.lerp(pose.p,blend);pose.node.quaternion.slerp(pose.q,blend);
      }
    }
  }
  function restore(){for(const v of saved){v.node.position.copy(v.p);v.node.quaternion.copy(v.q);v.node.scale.copy(v.s);}}
  function poseJump(pet) {
    const j=pet.jump;if(!j || j.phase==='runup')return;
    if(heavy){poseHeavyJump(j);return;}
    const parts=pet.parts,rest=pet.rests;
    const prep=j.phase==='prepare',land=j.phase==='landing';
    const u=Math.min(1,j.elapsed/(prep?config.prepare:config.land));
    const compression=prep?u*u*(3-2*u):land?Math.sin(Math.PI*u):0;
    const flight=prep?0:land?1-u*u*(3-2*u):Math.min(1,j.elapsed/.16);
    const descend=flight*Math.max(0,Math.min(1,-(j.vy||0)/config.velocity));
    if(parts.rig)parts.rig.position.y=rest.rigY-compression*(heavy?.16:.08)+flight*.025;
    if(parts.torso)parts.torso.rotation.x=rest.torsoX+compression*.14-flight*.1+descend*.16;
    if(parts.head)parts.head.position.y=rest.headY-compression*.035;
    const limbs=parts.limbs||pet.root.userData.locomotionRig?.limbs;
    if(limbs&&rest.limbs)limbs.forEach((limb,i)=>{
      limb.position.copy(rest.limbs[i]);limb.position.y+=compression*.12+flight*.09*(1-descend);
      limb.position.z+=flight*.07-descend*.1;
    });
    const arms=parts.leftArm?[parts.leftArm,parts.rightArm]:parts.leftSupport?[parts.leftSupport,parts.rightSupport]
      :[pet.root.userData.locomotionRig?.leftArm,pet.root.userData.locomotionRig?.rightArm];
    arms.forEach((arm,i)=>{if(!arm||!rest.supports)return;
      const r=rest.supports[i];arm.shoulder.rotation.x=r.x+compression*.3-flight*(pet.character==='specter'?.5:.25)+descend*.35;
      arm.shoulder.rotation.z=r.z+(i?1:-1)*flight*.08;
      if(arm.hand)arm.hand.rotation.x=r.handX-descend*.15;
    });
    pet.locomotion=j.phase;
  }

  function tick(dt,t){
    if(!active)return false;
    const j=pet.jump;
    let remaining=Math.max(0,dt);
    while(remaining>1e-9){
      const h=Math.min(remaining,1/120);remaining-=h;j.elapsed+=h;
      if(j.phase==='prepare'){
        if(j.elapsed>=config.prepare){j.phase='takeoff';j.elapsed=0;j.vy=config.velocity;}
      }else if(j.phase==='landing'){
        if(j.elapsed>=(j.landDuration||config.land)){active=false;break;}
      }else{
        root.position.y+=j.vy*h-.5*config.gravity*h*h;j.vy-=config.gravity*h;
        const floor=options.groundY?.()??startY;
        if(j.vy<=0&&root.position.y<=floor){
          root.position.y=floor;j.phase='landing';j.elapsed=0;
          j.impactSpeed=-j.vy;
          j.impactStrength=Math.max(.55,Math.min(1.35,j.impactSpeed/config.velocity));
          j.landDuration=heavy?config.land*(1.35+.25*j.impactStrength):config.land;
          j.vy=0;
        }
        else j.phase=(heavy?j.vy>0&&root.position.y-startY<pushHeight:j.elapsed<.12)?'takeoff':j.vy>0?'ascent':'descent';
      }
    }
    if(options.longneck){
      options.longneck.commit({grounded:j.phase==='prepare'||j.phase==='landing',jump:j,jumpConfig:config},t,dt);
    }else{restore();poseJump(pet);}
    if(!active){
      root.userData.characterJumping=false;
      if(options.longneck){options.longneck.commit({grounded:true},t,dt);options.longneck.restorePose();}
      restore();
    }
    return active;
  }
  return {tick,get active(){return active;},get phase(){return pet.jump.phase;},get impactSpeed(){return pet.jump.impactSpeed||0;}};
});
