/* In-world camera/session adapter for the shared frontend combat controller. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.createBattleBroPractice=factory;})(typeof globalThis!=='undefined'?globalThis:this,function(THREE,host){
  'use strict';
  let encounter=null,actors=null,savedCamera=null,heights=null,widths=null,facings=null,lastState='',lastBusy=null,lastRevision=-1;
  const resultDurationSeconds=3;
  const resultPivotSeconds=1.2;
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
    for(const actor of actors){actor.root.updateMatrixWorld(true);new THREE.Box3().setFromObject(actor.root).getSize(size);heights.push(Math.max(.6,size.y));widths.push(Math.max(.5,Math.min(size.x,heights.at(-1)*1.2)));}
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
    const aspect=Math.max(.25,host.aspect()||1),h=heights[0],distance=a.distanceTo(b);
    if(camera.aspect!==aspect){camera.aspect=aspect;camera.fov=THREE.MathUtils.clamp(58/Math.min(1,aspect),58,85);camera.updateProjectionMatrix();}
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
      camera.position.copy(eye);camera.lookAt(aim);return;
    }
    // Authored rigs face +Z with their right shoulder on +X.
    // Keep enough setback for tall forms and portrait screens.
    const back=Math.max(1.8,h*1.45,widths[0]*1.3,heights[1]*.65-distance*.25)/Math.min(1,aspect);
    eye.copy(a).addScaledVector(forward,-back).addScaledVector(right,Math.max(.65,widths[0]*.6));eye.y+=h*.85+.3;
    aim.copy(b);aim.y+=heights[1]*.55;
    const floor=host.floor?.(eye.x,eye.z,eye.y);if(Number.isFinite(floor))eye.y=Math.max(eye.y,floor+.3);
    camera.position.lerp(eye,immediate?1:1-Math.exp(-dt*7));camera.lookAt(aim);
  }
  function attack(berserker=false){if(!actors)return false;
    const result=encounter.sides[0].session.run(()=>host.actions.attack(actors,0,{berserker}));
    report();return result.ok;
  }
  function finish(){if(!actors)return;host.actions.cancel(actors);for(let i=0;i<actors.length;i++){actors[i].root.rotation.set(0,facings[i],0);delete actors[i].root.userData.deferLooseRockAttachments;}host.camera(savedCamera);host.show(false);encounter=null;actors=null;savedCamera=null;facings=null;}
  return {begin,restore,tick,attack,finish,camera,combat:()=>host.actions.combat(),canAttack:berserker=>host.actions.canAttack(0,berserker),get active(){return !!encounter;}};
});
