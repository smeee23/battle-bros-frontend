/* In-world camera/session adapter for the shared frontend combat controller. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.createBattleBroPractice=factory;})(typeof globalThis!=='undefined'?globalThis:this,function(THREE,host){
  'use strict';
  let encounter=null,actors=null,savedCamera=null,heights=null,widths=null,facings=null,lastState='',lastBusy=null,lastRevision=-1;
  const resultDurationSeconds=3;
  const resultPivotSeconds=1.2;
  let frontReach=0;
  let resultAge=0,resultStarted=false,resultExitRequested=false,resultStartYaw=0,resultStartRadius=0,resultStartHeight=0;
  const camera=new THREE.PerspectiveCamera(58,1,.02,2000);
  const forward=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),eye=new THREE.Vector3(),aim=new THREE.Vector3(),size=new THREE.Vector3();
  const faceTarget=new THREE.Vector3(),faceEye=new THREE.Vector3(),resultOffset=new THREE.Vector3();
  const healthPoint=new THREE.Vector3(),healthRight=new THREE.Vector3();
  function heading(root){
    const q=root.quaternion;
    return Math.atan2(2*(q.x*q.z+q.w*q.y),1-2*(q.x*q.x+q.y*q.y));
  }
  function begin(session){
    if(encounter)return false;
    encounter=session;actors=session.sides.map(s=>s.actor);savedCamera=host.camera();
    heights=[];widths=[];
    forward.subVectors(actors[1].root.position,actors[0].root.position);forward.y=0;
    if(forward.lengthSq()<1e-8)forward.set(0,0,1);forward.normalize();right.crossVectors(up,forward);
    for(let i=0;i<actors.length;i++){
      const actor=actors[i];actor.root.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(actor.root);bounds.getSize(size);
      heights.push(Math.max(.6,size.y));
      widths.push(Math.max(.5,Math.abs(right.x)*size.x+Math.abs(right.z)*size.z));
      if(i===0){
        actor.root.getWorldPosition(eye);
        frontReach=Math.max(0,forward.x*((forward.x>=0?bounds.max.x:bounds.min.x)-eye.x)
          +forward.z*((forward.z>=0?bounds.max.z:bounds.min.z)-eye.z));
      }
    }
    for(const actor of actors)actor.root.userData.deferLooseRockAttachments=true;
    host.actions.start(actors,host.combatOptions||{opponentEnabled:true});
    facings=actors.map(actor=>heading(actor.root));
    camera.position.copy(savedCamera.position);camera.quaternion.copy(savedCamera.quaternion);camera.far=savedCamera.far;camera.updateProjectionMatrix();
    resultAge=0;resultStarted=false;resultExitRequested=false;
    updateCamera(0,true);
    lastState='';lastBusy=null;lastRevision=-1;host.camera(camera);host.show(true);healthAnchors();report();return true;
  }
  function report(){const busy=!host.actions.canAttack(0),state=host.actions.state(actors[0]),combat=host.actions.combat();if(state!==lastState||busy!==lastBusy||lastRevision!==combat.revision){lastState=state;lastBusy=busy;lastRevision=combat.revision;host.status(state,busy,combat);}}
  function restore(){if(actors)for(let i=0;i<actors.length;i++){
    const actor=actors[i];host.actions.restore(actor);host.restoreBody(actor.root);
    // Restoring a quaternion can encode a yaw beyond +/-90 degrees as Euler
    // X/Z half-turns. Native locomotion reads rotation.y, so restore its clean,
    // authoritative heading before any terrain, turn or idle controller runs.
    actor.root.rotation.set(0,facings[i],0);
  }}
  function tick(t,dt){
    if(!actors)return;
    // Native turning may intentionally update facing (for moving supports).
    // Save that baseline before shared attack/hit layers tilt the roots.
    for(let i=0;i<actors.length;i++)facings[i]=heading(actors[i].root);
    // Native controllers have finished and the encounter has captured clean poses.
    // Advance projectile/body animation exactly once, using the suspended session's
    // contacts, then apply the same attack/hit layer as the Arena.
    for(const side of encounter.sides)side.session.run(()=>host.attachments(side.actor,t,dt));
    for(const actor of actors)host.actions.tick(actor,t,dt);
    const combat=host.actions.combat();
    if(!combat.running&&combat.winner!==null){
      if(!resultStarted){
        resultStarted=true;faceBasis();resultOffset.subVectors(camera.position,faceTarget);
        resultStartYaw=Math.atan2(resultOffset.dot(right),resultOffset.dot(forward));
        resultStartRadius=Math.hypot(resultOffset.x,resultOffset.z);resultStartHeight=resultOffset.y;
        host.expression?.(actors[0],combat.winner===0?'bigSmile':'sad');
      }else resultAge+=Math.max(0,Math.min(dt,.05));
    }
    updateCamera(dt);healthAnchors();report();
    if(resultStarted&&!resultExitRequested&&resultAge>=resultDurationSeconds-1e-8){
      resultExitRequested=true;
      // Last operation: the host may finish this session and capture the BRO.
      host.complete?.();
    }
  }
  function healthAnchors(){
    if(!host.healthAnchor)return;
    camera.updateMatrixWorld(true);healthRight.setFromMatrixColumn(camera.matrixWorld,0);
    for(let i=0;i<actors.length;i++){
      actors[i].root.getWorldPosition(healthPoint);healthPoint.y+=heights[i]*.65;
      healthPoint.addScaledVector(healthRight,(i===0?-1:1)*Math.max(.5,widths[i]*.65));
      healthPoint.project(camera);
      host.healthAnchor(i,(healthPoint.x+1)*.5,(1-healthPoint.y)*.5,
        healthPoint.z>=-1&&healthPoint.z<=1&&Math.abs(healthPoint.x)<1.3&&Math.abs(healthPoint.y)<1.3);
    }
  }
  function faceBasis(){
    const root=actors[0].root,face=root.userData.slots?.face||root.userData.rig.head;
    root.updateMatrixWorld(true);face.getWorldPosition(faceTarget);
    const eyes=face.userData.expression?.eyes;
    if(eyes?.[0]&&eyes[1]){
      eyes[0].getWorldPosition(faceTarget);eyes[1].getWorldPosition(faceEye);faceTarget.add(faceEye).multiplyScalar(.5);
    }
    face.getWorldDirection(forward);forward.y=0;
    if(forward.lengthSq()<1e-8)forward.set(0,0,1);forward.normalize();right.crossVectors(up,forward);
  }
  function updateCamera(dt,immediate=false){
    const a=actors[0].root.position,b=actors[1].root.position;
    forward.subVectors(b,a);forward.y=0;if(forward.lengthSq()<1e-8)forward.set(0,0,1);forward.normalize();right.crossVectors(up,forward);
    const aspect=Math.max(.25,host.aspect()||1),h=heights[0];
    if(camera.aspect!==aspect){camera.aspect=aspect;camera.updateProjectionMatrix();}
    if(resultStarted){
      faceBasis();
      const u=Math.min(1,resultAge/resultPivotSeconds),blend=u*u*(3-2*u);
      const turn=Math.atan2(Math.sin(.15-resultStartYaw),Math.cos(.15-resultStartYaw));
      const yaw=resultStartYaw+turn*blend;
      const radius=THREE.MathUtils.lerp(resultStartRadius,Math.max(1.5,h*.8,widths[0]*.9)/Math.min(1,aspect),blend);
      eye.copy(faceTarget).addScaledVector(forward,Math.cos(yaw)*radius).addScaledVector(right,Math.sin(yaw)*radius);
      eye.y+=THREE.MathUtils.lerp(resultStartHeight,h*.12,blend);
      aim.lerp(faceTarget,1-Math.exp(-dt*7));
      const floor=host.floor?.(eye.x,eye.z,eye.y);if(Number.isFinite(floor))eye.y=Math.max(eye.y,floor+.3);
      // Orbit around the face rather than interpolating through the character.
      camera.position.copy(eye);camera.lookAt(aim);setFov(THREE.MathUtils.clamp(58/Math.min(1,aspect),58,85),dt,immediate);return;
    }
    // Authored rigs face +Z with their right shoulder on +X.
    // Keep enough setback for tall forms and portrait screens.
    const range=Math.max(1,Math.hypot(b.x-a.x,b.z-a.z));
    const back=Math.max(1.8,h*1.15,widths[0]*.9,heights[1]*.85-range*.15)/Math.min(1,aspect);
    // Clear the foreground silhouette at its front edge, rather than aiming
    // through a broad torso. Larger rigs get a higher and wider shoulder view.
    const clearRange=range*.5;
    const side=Math.max(.9,h*.5,(widths[0]*.5+.6)*(back+clearRange)/Math.max(2,clearRange-frontReach));
    eye.copy(a).addScaledVector(forward,-back).addScaledVector(right,side);eye.y+=h*1.35+.4;
    aim.lerpVectors(a,b,.75);aim.y=THREE.MathUtils.lerp(a.y+h*.55,b.y+heights[1]*.55,.75);
    const floor=host.floor?.(eye.x,eye.z,eye.y);if(Number.isFinite(floor))eye.y=Math.max(eye.y,floor+.3);
    camera.position.lerp(eye,immediate?1:1-Math.exp(-dt*7));camera.lookAt(aim);
    // Keep the wider side view readable instead of making the opponent and
    // rocks tiny when a large foreground rig requires more camera clearance.
    faceEye.copy(a);faceEye.y+=h*.5;
    faceTarget.copy(b);faceTarget.y+=heights[1]*.5;
    const nearest=Math.max(1,Math.min(camera.position.distanceTo(faceEye),camera.position.distanceTo(faceTarget)));
    const halfFrame=Math.max(Math.max(h,heights[1])*.75,(range+(widths[0]+widths[1])*.5)*.6/aspect);
    setFov(THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(halfFrame/nearest)),35,85),dt,immediate);
  }
  function setFov(value,dt,immediate){
    const next=THREE.MathUtils.lerp(camera.fov,value,immediate?1:1-Math.exp(-dt*7));
    if(Math.abs(next-camera.fov)>.01){camera.fov=next;camera.updateProjectionMatrix();}
  }
  function attack(berserker=false){if(!actors)return false;
    const result=encounter.sides[0].session.run(()=>host.actions.attack(actors,0,{berserker}));
    report();return result.ok;
  }
  function finish(){if(!actors)return;host.actions.cancel(actors);for(let i=0;i<actors.length;i++){actors[i].root.rotation.set(0,facings[i],0);delete actors[i].root.userData.deferLooseRockAttachments;}host.camera(savedCamera);host.show(false);encounter=null;actors=null;savedCamera=null;facings=null;}
  return {begin,restore,tick,attack,finish,camera,combat:()=>host.actions.combat(),canAttack:berserker=>host.actions.canAttack(0,berserker),get active(){return !!encounter;}};
});
