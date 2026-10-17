/* Local visual transport only: no combat, ownership, or onchain location changes.
 * The host supplies terrain validation and the existing character/animation factories. */
(function(root,factory){
  factory.createModel=function(THREE,box){
    const cube=new THREE.Group();cube.name='BattleBro transport cube';
    const shell=new THREE.MeshStandardMaterial({color:0x142d42,metalness:.75,roughness:.3});
    const glow=new THREE.MeshStandardMaterial({color:0x9dffff,emissive:0x29dfff,emissiveIntensity:1.7,roughness:.3});
    const geometry=box(.20,.09,.20),seamGeometry=box(.205,.016,.205);
    const top=new THREE.Mesh(geometry,shell),bottom=new THREE.Mesh(geometry,shell),seam=new THREE.Mesh(seamGeometry,glow);
    top.position.y=.055;bottom.position.y=-.055;cube.add(top,bottom,seam);
    return cube;
  };
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.createTransportCube=factory;
})(typeof globalThis!=='undefined'?globalThis:this,function createTransportCube(THREE,hooks){
  const cube=createTransportCube.createModel(THREE,hooks.box),top=cube.children[0];
  cube.visible=false;hooks.scene.add(cube);
  let phase='carried',root=null,source=null,stored=null,age=0,actorScale=null,landing=null,returnStart=null;
  let deployed=false,flightAge=0,recallStart=null,recallDuration=0;
  const velocity=new THREE.Vector3(),hand=new THREE.Vector3(),previous=new THREE.Vector3();
  function status(message){hooks.status?.(message);}
  // Keep the selected instance (and its gameplay data), never a visual clone.
  function storeActor(){
    if(root){
      root.scale.copy(actorScale||root.scale);hooks.release(root);stored=root;root=null;
    }
    deployed=false;
  }
  function syncSource(){
    const selected=hooks.source();
    if(source===selected)return;
    storeActor();source=selected;stored=selected;actorScale=(selected?.userData.transportRestScale||selected?.scale)?.clone()||null;
    root=hooks.current?.(selected)||null;deployed=!!root;
    if(stored?.parent&&!root)hooks.release(stored);
    phase=root?'deployed':'carried';age=0;landing=null;top.position.y=.055;
  }
  function suspend(store=true){
    syncSource();
    if(store)storeActor();
    else if(root&&!['deployed','returning'].includes(phase)){
      root.scale.copy(actorScale);hooks.prepare(root);hooks.bind(root);
    }
    phase=root?'deployed':'carried';cube.visible=false;age=0;landing=null;top.position.y=.055;
  }
  function reset(){suspend(true);}
  function launch(){
    hooks.hand(hand);cube.position.copy(hand);hooks.direction(velocity).normalize().multiplyScalar(7);velocity.y+=1.8;
    cube.rotation.set(0,0,0);cube.scale.setScalar(1);top.position.y=.055;
    phase='flight';age=0;flightAge=0;cube.visible=true;status('Transport cube thrown');
  }
  function throwCube(){
    if(!hooks.active()||!hooks.source())return false;
    syncSource();
    if(!['carried','deployed'].includes(phase))return false;
    if(root){
      hooks.pause(root);
      hooks.hand(hand);cube.position.copy(hand);recallStart=hand.clone();
      recallDuration=Math.max(.5,Math.min(2,hand.distanceTo(root.position)/12));
      cube.rotation.set(0,0,0);top.position.y=.055;cube.visible=true;
      phase='recall-flight';age=0;actorScale=root.scale.clone();status('Throwing cube to recall BattleBro');
    }
    else launch();
    return true;
  }
  function returnCube(message){
    phase='returning';age=0;returnStart=cube.position.clone();top.position.y=.055;status(message);
  }
  function carryLanding(){
    if(!landing?.anchor)return;
    const point=hooks.anchor(landing.cell);
    if(!point)return;
    const dx=point.x-landing.anchor.x,dz=point.z-landing.anchor.z;
    cube.position.x+=dx;cube.position.z+=dz;
    // The host terrain transports deployed actors. Before deployment only the cube moves.
    landing.x+=dx;landing.z+=dz;landing.anchor=point;
  }
  function tick(dt,t){
    syncSource();
    if(!hooks.active()){cube.visible=false;return;}
    hooks.hand(hand);
    const equipped=hooks.equipped();
    if(phase==='carried'||phase==='deployed'){
      cube.visible=equipped;cube.position.copy(hand);cube.quaternion.copy(hooks.camera.quaternion);
      cube.rotateY(.35);cube.rotateX(.15);
      if(equipped)status(root?'Click to throw the cube and recall your BattleBro':'Click to throw your BattleBro · Aim at clear ground');
    }else if(phase==='recall-flight'){
      age+=dt;const u=Math.min(1,age/recallDuration);
      const target=root.position.clone();target.y+=.1;
      cube.visible=true;cube.position.copy(recallStart).lerp(target,u);
      cube.position.y+=Math.sin(Math.PI*u)*Math.min(3,.6+recallStart.distanceTo(target)*.15);
      cube.rotation.x+=dt*5;cube.rotation.z+=dt*3;
      if(u===1){phase='recall-opening';age=0;cube.rotation.set(0,0,0);}
    }else if(phase==='recall-opening'){
      age+=dt;cube.position.copy(root.position);cube.position.y+=.1;
      top.position.y=.055+.25*Math.min(1,age/.35);
      if(age>=.35){phase='recall';age=0;status('Returning BattleBro to the cube');}
    }else if(phase==='recall'){
      age+=dt;const u=Math.min(1,age/.7),ease=u*u*(3-2*u);
      cube.position.copy(root.position);cube.position.y+=.1;
      root.scale.copy(actorScale).multiplyScalar(Math.max(.001,1-ease));
      if(u===1){storeActor();returnCube('BattleBro recaptured · Click to deploy again');}
    }else if(phase==='flight'){
      const steps=Math.max(1,Math.ceil(dt/(1/120))),h=dt/steps;
      for(let i=0;i<steps&&phase==='flight';i++){
        previous.copy(cube.position);cube.position.addScaledVector(velocity,h);cube.position.y-=3*h*h;velocity.y-=6*h;flightAge+=h;
        const ground=hooks.ground(cube.position.x,cube.position.z,previous.y+.11);
        if(velocity.y<=0&&Number.isFinite(ground)&&previous.y>=ground&&cube.position.y<=ground+.1){
          landing=hooks.landing(cube.position.x,cube.position.z,ground+.11);
          if(!landing){returnCube('No safe landing here · Throw onto clear ground away from the player');break;}
          cube.position.set(landing.x,landing.y+.1,landing.z);phase='opening';age=0;status('Deploying BattleBro');
        }else if(hooks.blocked(previous,cube.position)){returnCube('The cube hit an obstacle · Try clear ground');}
        else if(flightAge>6||cube.position.y < -24)returnCube('No ground reached · Cube returned');
      }
      cube.rotation.x+=dt*5;cube.rotation.z+=dt*3;
    }else if(phase==='opening'){
      carryLanding();age+=dt;top.position.y=.055+Math.min(.25,age*.4);
      // Revalidate while opening: the player or the island may have moved.
      const safe=hooks.landing(landing.x,landing.z,landing.maxY??landing.y+.11);
      if(!safe){storeActor();returnCube('Landing became occupied · Cube returned');}
      else if(age>=.25){
        if(!root){
          root=stored;if(!root){returnCube('Choose a BattleBro before throwing');return;}
          root.scale.copy(actorScale);hooks.prepare(root);
          root.position.set(safe.x,safe.y+(hooks.hover(root)||0),safe.z);root.rotation.y=hooks.yaw();
          hooks.place(root);deployed=true;
        }
        const u=Math.min(1,(age-.25)/.7),ease=u*u*(3-2*u);
        root.scale.copy(actorScale).multiplyScalar(Math.max(.001,ease));
        if(u===1){root.scale.copy(actorScale);hooks.bind(root);returnCube('BattleBro released · Click to recapture');}
      }
    }else if(phase==='returning'){
      age+=dt;cube.position.copy(returnStart).lerp(hand,Math.min(1,age/.4));
      if(age>=.4){phase=root?'deployed':'carried';cube.visible=equipped;}
    }
    if(root&&deployed&&['deployed','returning'].includes(phase))hooks.animate(root,t,dt);
    if(root)hooks.visual?.(root);
  }
  return {throw:throwCube,tick,reset,suspend,get root(){return deployed?root:null;},get phase(){return phase;},get cube(){return cube;}};
});
