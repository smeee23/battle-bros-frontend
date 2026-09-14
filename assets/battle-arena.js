/* Isolated arena and visual action preview; no world cells or combat accounting. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.createBattleArena=factory;})(typeof globalThis!=='undefined'?globalThis:this,function(THREE,createCharacter,animateCharacter,options){
  'use strict';
  options=options||{};
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x111c26);scene.fog=new THREE.Fog(0x111c26,48,100);
  const camera=new THREE.PerspectiveCamera(43,1,.1,400);
  const architecture=new THREE.Group();architecture.name='arenaArchitecture';scene.add(architecture);
  const geometries=new Map(),materials=new Map();
  const material=(color,glow=false)=>{const key=color+':'+glow;if(!materials.has(key))materials.set(key,glow?new THREE.MeshBasicMaterial({color}):new THREE.MeshLambertMaterial({color}));return materials.get(key);};
  const boxGeometry=(w,h,d)=>{const key=[w,h,d].join(':');if(!geometries.has(key))geometries.set(key,new THREE.BoxGeometry(w,h,d));return geometries.get(key);};
  function box(name,w,h,d,x,y,z,color,parent=architecture){const mesh=new THREE.Mesh(boxGeometry(w,h,d),material(color));mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
  function beam(name,a,b,width,color,parent=architecture){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b);const mesh=box(name,width,from.distanceTo(to),width,0,0,0,color,parent);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());return mesh;}
  function ring(name,radius,width,x,y,z,color){const geometry=new THREE.RingGeometry(radius-width,radius,64);const mesh=new THREE.Mesh(geometry,material(color,true));mesh.name=name;mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);architecture.add(mesh);return mesh;}
  const deckLift=3.2;
  const palette={steel:0x34414b,light:0xc6d3dc,teal:0x202f39,gold:0x93c9dc,white:0xe3eee9};
  // Expand the surrounding grounds, leaving the authored battle court intact.
  const foundation=new THREE.Mesh(new THREE.CylinderGeometry(102,103,1.3,256),material(0x17222b));foundation.name='floatingArenaFoundation';foundation.position.y=-.9;architecture.add(foundation);
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(101.5,102,.35,256),material(palette.steel));plinth.name='upperPlinth';plinth.position.y=-.1;architecture.add(plinth);
  const concourse=new THREE.Mesh(new THREE.CircleGeometry(101,256),material(palette.teal));concourse.name='slateConcourse';concourse.rotation.x=-Math.PI/2;concourse.position.y=.18;architecture.add(concourse);
  const tilePositions=[];
  for(let x=-25;x<=25;x++)for(let z=-25;z<=25;z++)if(Math.hypot(x,z)<25)tilePositions.push([x,z]);
  const tiles=new THREE.InstancedMesh(boxGeometry(.96,.035,.96),material(0x2b3c46),tilePositions.length);
  tiles.name='concourseTiles';const matrix=new THREE.Matrix4();let tile=0;
  for(const [x,z] of tilePositions){matrix.makeTranslation(x,.2,z);tiles.setMatrixAt(tile++,matrix);}architecture.add(tiles);
  const stairTransforms=[];
  box('courtTrim',23.5,.18,14.5,0,.25,1,palette.white);
  box('greenBattleCourt',23,.08,14,0,.38,1,0x226746);
  const court=new THREE.InstancedMesh(boxGeometry(1.89,.015,1.96),material(0x38895c),12*7);court.name='courtPanels';tile=0;
  for(let x=0;x<12;x++)for(let z=0;z<7;z++){matrix.makeTranslation((x-5.5)*1.91,.43,(z-3)*1.98+1);court.setMatrixAt(tile++,matrix);}architecture.add(court);
  box('centerLine',.075,.015,13.8,0,.448,1,palette.white);
  ring('centerCircle',1.8,.07,0,.46,1,palette.white);ring('centerCircleInner',.43,.065,0,.461,1,palette.white);
  for(const side of [-1,1]){
    const color=side<0?0xf3b44f:0x88b8f1;
    ring('challengerStartingMark',1.8,.09,side*5.6,deckLift+.46,1,color);
    box('endLine',.07,.015,13.5,side*11.2,.45,1,palette.white);
    box('entryWalkway',10.6,.06,2.6,side*17.6,.27,1,0x1b4857);
    box('entryWalkwayStripe',10.6,.015,.10,side*17.6,.31,1,color);
    const entrance=new THREE.Group();entrance.name=side<0?'amberEntrance':'azureEntrance';entrance.position.set(side*23,0,1);architecture.add(entrance);
    box('tunnelVoid',.28,4.1,3.3,0,2.1,0,0x0b182a,entrance);
    for(const z of [-1.9,1.9])box('entrancePillar',.7,4.9,.55,0,2.5,z,palette.light,entrance);
    box('entranceLintel',.8,.6,4.3,0,5,0,palette.steel,entrance);
    box('entranceTeamLight',.85,.12,4.15,0,4.69,0,color,entrance);
  }
  // Raise the complete playing deck and its markings together.
  const raisedDeck=new THREE.Group();raisedDeck.name='raisedMatchDeck';raisedDeck.position.y=deckLift;architecture.add(raisedDeck);
  const deckNames=new Set(['courtTrim','greenBattleCourt','courtPanels','centerLine','centerCircle','centerCircleInner','challengerStartingMark','endLine']);
  for(const mesh of [...architecture.children])if(deckNames.has(mesh.name))raisedDeck.add(mesh);
  box('platformFoot',24.5,.3,15.5,0,.36,1,palette.light);
  box('platformCore',23.7,2.9,14.7,0,1.9,1,palette.steel);
  box('platformUpperRim',24,.22,15,0,3.34,1,palette.light);
  for(const z of [-6.4,8.4]){
    box('platformLightStrip',23.5,.09,.06,0,2.95,z,palette.gold).material=material(palette.gold,true);
    for(let x=-11;x<=11;x+=2.2)box('platformBrace',.18,2.6,.22,x,1.8,z,palette.light);
  }
  for(const side of [-1,1])for(let step=0;step<12;step++){
    const height=(12-step)*deckLift/12;
    box('courtAccessStep',.48,height,2.6,side*(11.95+step*.48),.3+height/2,1,palette.light);
  }
  // Continuous annular terraces, not duplicated grandstand wedges. Seat and
  // rail dimensions stay unchanged while row count, radius and height grow.
  const tiers=[
    {name:'lowerBowl',radius:38,base:1.1,rows:18,rise:.45,step:.82},
    {name:'middleTier',radius:56,base:13,rows:20,rise:.52,step:.82},
    {name:'upperBowl',radius:76,base:27,rows:24,rise:.60,step:.82},
  ];
  const seats=[];
  function terraceRing(name,inner,outer,y,color,parent=architecture){
    const mesh=new THREE.Mesh(new THREE.RingGeometry(inner,outer,256),material(color));
    mesh.name=name;mesh.rotation.x=-Math.PI/2;mesh.position.y=y;parent.add(mesh);return mesh;
  }
  function wallRing(name,radius,y,height,color,parent=architecture){
    const key=color+':two-sided';
    if(!materials.has(key))materials.set(key,new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide}));
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,256,1,true),materials.get(key));
    mesh.name=name;mesh.position.y=y;parent.add(mesh);return mesh;
  }
  let previousTierTop=0;
  for(const tier of tiers){
    const group=new THREE.Group();group.name=tier.name;group.userData={...tier};architecture.add(group);
    terraceRing('tierConcourse',tier.radius-3,tier.radius,tier.base-.12,palette.teal,group);
    const fasciaHeight=Math.max(1.3,tier.base-previousTierTop);
    wallRing('tierFascia',tier.radius-3,tier.base-fasciaHeight*.5,fasciaHeight,palette.steel,group);
    previousTierTop=tier.base+(tier.rows-1)*tier.rise;
    wallRing('safetyBarrier',tier.radius-3,tier.base+.38,1,0x718997,group);
    terraceRing('barrierGoldRail',tier.radius-3.12,tier.radius-2.88,tier.base+.9,palette.gold,group);
    for(let row=0;row<tier.rows;row++){
      const radius=tier.radius+row*tier.step,y=tier.base+row*tier.rise;
      terraceRing('terrace',radius-.4,radius+tier.step-.4,y,palette.steel,group);
      wallRing('terraceRiser',radius-.4,y-tier.rise*.5,tier.rise,palette.steel,group);
      const count=Math.floor(2*Math.PI*radius/.65);
      for(let col=0;col<count;col++){
        const angle=col/count*Math.PI*2;
        // Regular radial circulation aisles, with one-metre clear passages.
        const aisleOffset=((angle+Math.PI/24)%(Math.PI/12))-Math.PI/24;
        if(Math.abs(aisleOffset)*radius<.65)continue;
        seats.push({angle,radius,y:y+.17});
      }
    }
    // Fine stepped aisle strips retain a credible scale at every elevation.
    for(let aisle=0;aisle<24;aisle++)for(let row=0;row<tier.rows;row++){
      const angle=aisle*Math.PI/12,radius=tier.radius+row*tier.step;
      // Matrix collected below for one shared instanced stair draw.
      stairTransforms.push({angle,radius,y:tier.base+row*tier.rise+.015});
    }
  }
  const stairs=new THREE.InstancedMesh(boxGeometry(1.18,.03,.8),material(0x9aaab5),stairTransforms.length);stairs.name='radialAisleSteps';
  stairTransforms.forEach((step,i)=>{matrix.makeRotationY(step.angle);matrix.setPosition(Math.sin(step.angle)*step.radius,step.y,Math.cos(step.angle)*step.radius);stairs.setMatrixAt(i,matrix);});architecture.add(stairs);
  const seating=new THREE.InstancedMesh(boxGeometry(.48,.22,.57),material(0x546e80),seats.length);seating.name='spectatorSeats';
  const crowd=new THREE.InstancedMesh(boxGeometry(.21,.35,.23),material(0xffffff),seats.length);crowd.name='voxelSpectators';
  const colors=[0x779aa7,0xd7b766,0xb6c9ae,0x8a9cd1,0xc78b6e].map(color=>new THREE.Color(color));
  seats.forEach((seat,i)=>{matrix.makeRotationY(seat.angle+Math.PI);matrix.setPosition(Math.sin(seat.angle)*seat.radius,seat.y,Math.cos(seat.angle)*seat.radius);seating.setMatrixAt(i,matrix);matrix.elements[13]+=.29;crowd.setMatrixAt(i,matrix);crowd.setColorAt(i,colors[(i*7)%colors.length]);});architecture.add(seating,crowd);
  architecture.userData.seatingCapacity=seats.length;
  terraceRing('upperRimConcourse',95,101,42,palette.teal);
  wallRing('outerStadiumWall',101,23,48,0x283640);
  wallRing('outerWallInset',100.8,45,5,0x526b7c);
  terraceRing('structuralCrown',98,102,48,palette.steel);
  terraceRing('crownGoldTrim',99.8,101,48.15,palette.gold);
  // The original light-coloured segmented ribs now wrap the entire bowl.
  for(let rib=0;rib<48;rib++){
    const angle=rib*Math.PI*2/48;
    const point=(radius,y)=>[Math.sin(angle)*radius,y,Math.cos(angle)*radius];
    const points=[point(101,2),point(101,45),point(97,53),point(87,56),point(73,53)];
    for(let i=1;i<points.length;i++)beam('roofRib',points[i-1],points[i],i===1?.55:.28,palette.light);
  }
  wallRing('roofPurlin',87,55.5,.16,palette.steel);
  wallRing('innerRoofRing',73,53,.28,palette.light);
  const glass=new THREE.MeshBasicMaterial({color:0x7ab3cf,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide});
  const glazing=new THREE.Mesh(new THREE.RingGeometry(73,98,256),glass);glazing.name='rearSkylight';glazing.rotation.x=-Math.PI/2;glazing.position.y=53.4;architecture.add(glazing);
  // Rear display, flanked by the arena's light towers.
  box('displayFrame',12,4.9,.55,0,14,-25.35,palette.gold);
  const display=box('arenaDisplay',11.5,4.4,.12,0,14,-25.01,0x102636);
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=384;const ctx=canvas.getContext('2d');
    if(ctx){ctx.fillStyle='#102636';ctx.fillRect(0,0,1024,384);ctx.strokeStyle='#93c9dc';ctx.lineWidth=4;ctx.strokeRect(20,20,984,344);ctx.textAlign='center';ctx.fillStyle='#e3eee9';ctx.font='bold 78px sans-serif';ctx.fillText('BATTLEBROS',512,156);ctx.fillStyle='#84c8c5';ctx.font='26px sans-serif';ctx.fillText('T H E   A R E N A',512,218);ctx.strokeStyle='#437a81';ctx.beginPath();ctx.moveTo(290,263);ctx.lineTo(734,263);ctx.stroke();ctx.fillStyle='#b9cad3';ctx.font='20px sans-serif';ctx.fillText('TWO CHALLENGERS · ONE COURT',512,308);const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;display.material=new THREE.MeshBasicMaterial({map:texture});}
  }
  for(const x of [-10,10]){box('displayLightTower',.8,7,.8,x,11.4,-24.7,palette.steel);for(let y=6;y<9;y++)box('towerLight',.55,.28,.1,x,y+6.3,-24.24,0xd8eee4).material=material(0xd8eee4,true);}
  scene.add(new THREE.HemisphereLight(0xbddfed,0x38463e,.85));
  const key=new THREE.DirectionalLight(0xf1f6ff,.95);key.position.set(-10,18,14);scene.add(key);
  const fill=new THREE.DirectionalLight(0x93c7e8,.6);fill.position.set(12,9,-6);scene.add(fill);
  const actors=[],actions=options.actions;
  function makeActor(index,appearance){
    const side=index===0?-1:1,root=createCharacter(appearance);
    root.name=side<0?'arenaAmberChallenger':'arenaAzureChallenger';root.position.set(side*5.6,deckLift+.46,1);root.rotation.y=-side*Math.PI/2;scene.add(root);
    root.updateMatrixWorld(true);const lower=root.userData.locomotionRig||root.userData.rig;
    const feet=lower.spectralBody?[root]:lower.minotaurLegs?Object.values(lower.minotaurLegs):lower.limbs||[lower.leftArm.hand,lower.rightArm.hand];
    const sole=Math.min(...feet.map(foot=>new THREE.Box3().setFromObject(foot).min.y));root.position.y+=deckLift+.465-sole+(lower.spectralBody?.65:0);root.updateMatrixWorld(true);
    const mover={root,parts:lower,state:'IDLE',progress:0,ikTarget:new THREE.Vector3()};
    if(lower.leftArm?.hand && !lower.spectralBody){mover.leftAnchor=lower.leftArm.hand.getWorldPosition(new THREE.Vector3());mover.rightAnchor=lower.rightArm.hand.getWorldPosition(new THREE.Vector3());
      mover.leftAnchor.y-=options.wristHeight||0;mover.rightAnchor.y-=options.wristHeight||0;}
    return {root,mover,appearance:{character:appearance.character||'monsters',variant:root.userData.visualVariant,form:root.userData.form},home:root.position.clone(),facing:root.quaternion.clone()};
  }
  for(let index=0;index<2;index++){
    actors.push(makeActor(index,{variant:'lava',form:6}));
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.6,40),new THREE.MeshBasicMaterial({color:0x152c23,transparent:true,opacity:.22,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set((index===0?-1:1)*5.6,deckLift+.455,1);architecture.add(shadow);
  }
  function resetCombat(){actions?.cancel(actors);for(const actor of actors){actor.root.position.copy(actor.home);actor.root.quaternion.copy(actor.facing);}}
  function setFighter(index,appearance){
    if(index!==0&&index!==1)return false;
    if(!['monsters','specter','longneck'].includes(appearance?.character||'monsters')||!['lava','sand','plant','ice'].includes(appearance?.variant)||!Number.isInteger(appearance?.form)||appearance.form<1||appearance.form>7)return false;
    resetCombat();const old=actors[index];actors[index]=makeActor(index,appearance);
    const field=old.root.userData.looseRocks?.orbitField;if(field)field.parent?.remove(field);
    old.root.parent?.remove(old.root);options.disposeCharacter?.(old.root,field);return true;
  }
  function attack(index){return actions?.attack(actors,index)||{ok:false,reason:'unavailable'};}
  function hit(index){if(!actions||actors.some(actor=>actions.busy(actor)))return false;return actions.hit(actors[index],actors[1-index].root.position);}
  let yaw=0,pitch=.24,distance=21;
  const lookAt=new THREE.Vector3(0,3,0);
  function resize(aspect){if(camera.aspect===aspect)return;camera.aspect=aspect;camera.updateProjectionMatrix();}
  function orbit(dx,dy){yaw=(yaw+dx)%(Math.PI*2);pitch=THREE.MathUtils.clamp(pitch+dy,.08,1.25);}
  function zoom(delta){distance=THREE.MathUtils.clamp(distance+delta,12,150);}
  function reset(){yaw=0;pitch=.24;distance=21;}
  function tick(time,dt){const framedDistance=distance;camera.fov=THREE.MathUtils.clamp(50/Math.min(1,camera.aspect/1.1),50,85);camera.updateProjectionMatrix();scene.fog.near=180;scene.fog.far=380;camera.position.set(Math.sin(yaw)*Math.cos(pitch)*framedDistance,deckLift+3+Math.sin(pitch)*framedDistance,Math.cos(yaw)*Math.cos(pitch)*framedDistance);lookAt.y=deckLift+6+Math.max(0,.24-pitch)*55;camera.lookAt(lookAt);for(const actor of actors)actions?.restore(actor);for(const actor of actors)animateCharacter(actor,time,dt);for(const actor of actors)actions?.tick(actor,time,dt);}
  tick(0,0);
  return {scene,camera,actors,architecture,resize,orbit,zoom,reset,tick,setFighter,attack,hit,resetCombat,
    isBusy:()=>!!actions&&actors.some(actor=>actions.busy(actor)),
    actorState:index=>actions?actions.state(actors[index]):'Ready'};
});
