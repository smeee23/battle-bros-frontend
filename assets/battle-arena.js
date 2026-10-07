/* Isolated arena and visual action preview; no world cells or combat accounting. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.createBattleArena=factory;})(typeof globalThis!=='undefined'?globalThis:this,function(THREE,createCharacter,animateCharacter,options){
  'use strict';
  options=options||{};
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x040916);scene.fog=new THREE.Fog(0x111c26,48,100);
  const camera=new THREE.PerspectiveCamera(43,1,.1,1200);
  const architecture=new THREE.Group();architecture.name='arenaArchitecture';scene.add(architecture);
  const geometries=new Map(),materials=new Map();
  const material=(color,glow=false)=>{const key=color+':'+glow;if(!materials.has(key))materials.set(key,glow?new THREE.MeshBasicMaterial({color}):new THREE.MeshLambertMaterial({color}));return materials.get(key);};
  const boxGeometry=(w,h,d)=>{const key=[w,h,d].join(':');if(!geometries.has(key))geometries.set(key,new THREE.BoxGeometry(w,h,d));return geometries.get(key);};
  function box(name,w,h,d,x,y,z,color,parent=architecture){const mesh=new THREE.Mesh(boxGeometry(w,h,d),material(color));mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
  function beam(name,a,b,width,color,parent=architecture){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b);const mesh=box(name,width,from.distanceTo(to),width,0,0,0,color,parent);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());return mesh;}
  function ring(name,radius,width,x,y,z,color){const geometry=new THREE.RingGeometry(radius-width,radius,64);const mesh=new THREE.Mesh(geometry,material(color,true));mesh.name=name;mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);architecture.add(mesh);return mesh;}
  const deckLift=3.2;
  const palette={steel:0x34414b,light:0xc6d3dc,teal:0x202f39,gold:0x93c9dc,white:0xe3eee9};
  const matrix=new THREE.Matrix4(),bowlScale=1.5;
  // An independent hull, with no ground disk or structure crossing to the stands.
  const raisedDeck=new THREE.Group();raisedDeck.name='raisedMatchDeck';raisedDeck.position.y=deckLift;architecture.add(raisedDeck);
  box('armoredHull',24.8,2.5,16,0,-1.02,1,0x26313e,raisedDeck);
  box('bellyArmor',22.6,.65,13.8,0,-2.57,1,0x161f2b,raisedDeck);
  box('alloyBattleCourt',23,.32,14,0,.28,1,0x171f29,raisedDeck);
  // Large, irregularly toned steel plates; all combat footing stays at .465.
  const plateColors=[0x45515d,0x394653,0x505965,0x34424d];
  for(let x=0;x<6;x++)for(let z=0;z<4;z++){
    box('deckArmorPanel',3.79,.12,3.44,(x-2.5)*3.83,.405,(z-1.5)*3.5+1,plateColors[(x+z*3)%4],raisedDeck);
  }
  // Recessed service bays and grates sit outside the fighting surface.
  const bolts=[],louvers=[];
  for(const z of [-6.55,8.55])for(let i=0;i<8;i++){
    const x=(i-3.5)*3.05;
    box('reinforcedEdgeCassette',2.96,.42,1.02,x,.17,z,0x68717a,raisedDeck);
    box('recessedVent',2.3,.035,.66,x,.392,z,0x0e1721,raisedDeck);
    for(let slat=0;slat<9;slat++)louvers.push([x+(slat-4)*.25,.43,z]);
    for(const dx of [-1.33,1.33])for(const dz of [-.36,.36])bolts.push([x+dx,.42,z+dz]);
    box('sideArmor',2.72,1.6,.20,x,-1.1,z+(z<0?-.43:.43),0x4c5966,raisedDeck);
    box('sideVentInset',1.85,.4,.23,x,-1.04,z+(z<0?-.45:.45),0x101c29,raisedDeck);
    box('statusLight',.48,.065,.25,x,-.73,z+(z<0?-.45:.45),0x6acddd,raisedDeck).material=material(0x6acddd,true);
  }
  for(const x of [-12,12]){
    box('endArmorRail',.9,.45,14.2,x,.16,1,0x596570,raisedDeck);
    for(let z=-5;z<=7;z+=2){
      box('endHullRib',.32,2.55,.32,x,-1,z,0x65717b,raisedDeck);
      bolts.push([x,.42,z]);
    }
  }
  function instances(name,w,h,d,color,positions){
    const mesh=new THREE.InstancedMesh(boxGeometry(w,h,d),material(color),positions.length);mesh.name=name;
    positions.forEach((p,i)=>{matrix.makeTranslation(...p);mesh.setMatrixAt(i,matrix);});raisedDeck.add(mesh);
  }
  instances('deckFasteners',.10,.055,.10,0x9aa5ad,bolts);
  instances('ventGrates',.075,.04,.58,0x71808b,louvers);
  // Internal keel members and machinery remain entirely inside the hull footprint.
  for(const x of [-8,0,8])box('undersideKeel',.48,.5,12.8,x,-2.94,1,0x465462,raisedDeck);
  for(const z of [-3,5])box('undersideCrossmember',21,.4,.42,0,-2.94,z,0x465462,raisedDeck);
  const emitterMaterial=new THREE.MeshBasicMaterial({color:0x65dfff,side:THREE.DoubleSide});
  for(const x of [-8,8])for(const z of [-3.5,5.5]){
    box('hoverMachineryPod',3.4,.65,3.2,x,-2.97,z,0x2e414f,raisedDeck);
    const emitter=ring('levitationEmitter',1.12,.24,x,-3.31,z,0x65dfff);
    emitter.material=emitterMaterial;raisedDeck.add(emitter);
    box('hoverPodCore',1.15,.12,1.15,x,-3.30,z,0x172433,raisedDeck);
  }
  // Continuous annular terraces, not duplicated grandstand wedges. Seat and
  // rail dimensions stay unchanged while row count, radius and height grow.
  const tiers=[
    {name:'lowerBowl',radius:38,base:1.1,rows:18,rise:.45,step:.82},
    {name:'middleTier',radius:56,base:13,rows:20,rise:.52,step:.82},
    {name:'upperBowl',radius:76,base:27,rows:24,rise:.60,step:.82},
    {name:'crownTier',radius:98,base:44,rows:12,rise:.62,step:.82},
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
  }
  const seating=new THREE.InstancedMesh(boxGeometry(.48,.22,.57),material(0x546e80),seats.length);seating.name='spectatorSeats';
  // Match the home-world crew's eight-part suits, using eight shared draws.
  const astronautDefinitions=[
    [0xd8d9d2,0,.46,0,.32,.38,.23],
    [0xd8d9d2,0,.82,0,.43,.36,.36],
    [0x4d5b66,0,.83,.185,.32,.19,.025],
    [0x2d4f7a,0,.49,-.18,.25,.29,.14],
    [0xd8d9d2,-.24,.47,0,.12,.34,.13],
    [0xd8d9d2,.24,.47,0,.12,.34,.13],
    [0x4d5b66,-.10,.15,0,.13,.30,.16],
    [0x4d5b66,.10,.15,0,.13,.30,.16],
  ];
  const astronautParts=astronautDefinitions.map(([color,x,y,z,w,h,d],part)=>{
    const mesh=new THREE.InstancedMesh(boxGeometry(w,h,d),material(color),seats.length);
    mesh.name='astronautSpectators'+part;architecture.add(mesh);return {mesh,x,y,z};
  });
  const partMatrix=new THREE.Matrix4();
  seats.forEach((seat,i)=>{
    matrix.makeRotationY(seat.angle+Math.PI);
    matrix.setPosition(Math.sin(seat.angle)*seat.radius,seat.y,Math.cos(seat.angle)*seat.radius);
    seating.setMatrixAt(i,matrix);
    for(const part of astronautParts){
      // Counter the bowl's horizontal expansion to retain human proportions.
      partMatrix.makeTranslation(part.x/bowlScale,part.y-.11,part.z/bowlScale);
      partMatrix.scale(new THREE.Vector3(1/bowlScale,1,1/bowlScale));
      partMatrix.premultiply(matrix);part.mesh.setMatrixAt(i,partMatrix);
    }
  });architecture.add(seating);
  architecture.userData.seatingCapacity=seats.length;
  // Fourth seating gallery beneath an inward-tapered, open scaffold crown.
  terraceRing('upperRimConcourse',107.5,111,52,palette.teal);
  wallRing('outerStadiumWall',111,26,54,0x283640);
  wallRing('outerWallInset',110.8,52,2,0x526b7c);
  terraceRing('structuralCrown',109,112,54,palette.steel);
  terraceRing('crownGoldTrim',110.8,111.4,54.15,palette.gold);
  for(let rib=0;rib<48;rib++){
    const angle=rib*Math.PI*2/48;
    beam('stadiumRib',[Math.sin(angle)*111,0,Math.cos(angle)*111],
      [Math.sin(angle)*111,54,Math.cos(angle)*111],.55,palette.light);
  }
  // Shared unit beams form a full lattice without hundreds of extra draw calls.
  const scaffoldTransforms=[],scaffoldPose=new THREE.Object3D();
  const scaffoldUp=new THREE.Vector3(0,1,0);
  const point=(radius,y,angle)=>new THREE.Vector3(Math.sin(angle)*radius,y,Math.cos(angle)*radius);
  function scaffoldBeam(a,b,width){
    scaffoldPose.position.copy(a).add(b).multiplyScalar(.5);
    scaffoldPose.quaternion.setFromUnitVectors(scaffoldUp,b.clone().sub(a).normalize());
    scaffoldPose.scale.set(width,a.distanceTo(b),width);scaffoldPose.updateMatrix();
    scaffoldTransforms.push(scaffoldPose.matrix.clone());
  }
  for(let bay=0;bay<48;bay++){
    const a=bay*Math.PI/24,b=(bay+1)*Math.PI/24;
    const foot=point(111,54.4,a),nextFoot=point(111,54.4,b);
    const top=point(104,63,a),nextTop=point(104,63,b);
    scaffoldBeam(foot,top,.42);
    scaffoldBeam(foot,nextTop,.23);scaffoldBeam(nextFoot,top,.23);
    scaffoldBeam(top,point(101,63,a),.32);
  }
  const scaffold=new THREE.InstancedMesh(boxGeometry(1,1,1),material(0x8293a0),scaffoldTransforms.length);
  scaffold.name='crownScaffolding';scaffoldTransforms.forEach((m,i)=>scaffold.setMatrixAt(i,m));architecture.add(scaffold);
  wallRing('scaffoldLowerChord',111,54.4,.45,palette.light);
  wallRing('scaffoldUpperChord',104,63,.45,palette.light);
  wallRing('scaffoldInnerChord',101,63,.4,palette.steel);
  for(const [radius,y] of [[111,54.6],[104,62.8]]){
    terraceRing('crownShieldEmitter',radius-.16,radius+.16,y,palette.gold).material=material(0x53dcff,true);
  }
  const plasmaMaterial=new THREE.ShaderMaterial({
    uniforms:{time:{value:0}},transparent:true,depthWrite:false,
    side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform float time; varying vec2 vUv;
      void main(){
        float edge=pow(abs(vUv.y-.5)*2.0,10.0);
        float scan=pow(.5+.5*sin(vUv.y*65.0-time*2.0),14.0);
        float wave=.5+.5*sin(vUv.x*300.0+sin(vUv.y*12.0-time)*2.0);
        float alpha=.07+edge*.65+scan*.12+pow(wave,12.0)*.08;
        gl_FragColor=vec4(mix(vec3(.08,.40,.95),vec3(.40,1.0,1.0),edge+scan*.2),alpha);
      }`
  });
  // Energy bands occupy the perimeter and terrace-front positions in the reference.
  for(const [radius,base,height] of [[34.6,.3,2.6],[52.6,12.9,2.1],[72.6,26.9,2.1],[94.6,43.9,2.1]]){
    const shield=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,256,1,true),plasmaMaterial);
    shield.name='stadiumPlasmaShield';shield.position.y=base+height/2;architecture.add(shield);
    terraceRing('shieldEmitterRail',radius-.12,radius+.12,base,0x53dcff).material=material(0x53dcff,true);
  }
  // The plasma membrane follows the scaffold taper, leaving the central sky open.
  const crownShield=new THREE.Mesh(new THREE.CylinderGeometry(103.9,110.9,8.2,256,1,true),plasmaMaterial);
  crownShield.name='crownPlasmaShield';crownShield.position.y=58.7;architecture.add(crownShield);
  // Expand the bowl and grounds outward, retaining the court and crew scale.
  const bowl=new THREE.Group();bowl.name='stadiumBowl';bowl.scale.set(bowlScale,1,bowlScale);
  for(const mesh of [...architecture.children])if(mesh!==raisedDeck)bowl.add(mesh);
  architecture.add(bowl);
  // Rear display, flanked by the arena's light towers.
  box('displayFrame',12,4.9,.55,0,14,-53.35,palette.gold);
  const display=box('arenaDisplay',11.5,4.4,.12,0,14,-53.01,0x102636);
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=384;const ctx=canvas.getContext('2d');
    if(ctx){ctx.fillStyle='#102636';ctx.fillRect(0,0,1024,384);ctx.strokeStyle='#93c9dc';ctx.lineWidth=4;ctx.strokeRect(20,20,984,344);ctx.textAlign='center';ctx.fillStyle='#e3eee9';ctx.font='bold 78px sans-serif';ctx.fillText('BATTLEBROS',512,156);ctx.fillStyle='#84c8c5';ctx.font='26px sans-serif';ctx.fillText('T H E   A R E N A',512,218);ctx.strokeStyle='#437a81';ctx.beginPath();ctx.moveTo(290,263);ctx.lineTo(734,263);ctx.stroke();ctx.fillStyle='#b9cad3';ctx.font='20px sans-serif';ctx.fillText('TWO CHALLENGERS · ONE COURT',512,308);const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;display.material=new THREE.MeshBasicMaterial({map:texture});}
  }
  for(const x of [-10,10]){box('displayLightTower',.8,7,.8,x,11.4,-53.7,palette.steel);for(let y=6;y<9;y++)box('towerLight',.55,.28,.1,x,y+6.3,-53.24,0xd8eee4).material=material(0xd8eee4,true);}
  // Camera-centred celestial background stays beyond the arena at every zoom.
  const sky=new THREE.Group();sky.name='arenaSky';scene.add(sky);
  const starPositions=[],starColors=[];
  let starSeed=719;
  const random=()=>{starSeed=(Math.imul(starSeed,1664525)+1013904223)>>>0;return starSeed/4294967296;};
  for(let i=0;i<2400;i++){
    const y=random()*2-1,angle=random()*Math.PI*2,r=Math.sqrt(1-y*y);
    starPositions.push(Math.cos(angle)*r*700,y*700,Math.sin(angle)*r*700);
    const brightness=.35+random()*.65;starColors.push(brightness*.8,brightness*.9,brightness);
  }
  const starGeometry=new THREE.BufferGeometry();
  starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  starGeometry.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
  const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({size:1.5,sizeAttenuation:false,vertexColors:true,fog:false}));
  stars.name='arenaStars';sky.add(stars);
  // Clean crystalline facets, matching the cyan Ethereum reference.
  const planetMaterial=new THREE.MeshPhongMaterial({
    vertexColors:true,flatShading:true,shininess:75,
    specular:0xb8eaff,emissive:0x082137,emissiveIntensity:.45,fog:false
  });
  function ethereumSection(equator,top,bottom,lower){
    // Equal horizontal diagonals retain the diamond profile throughout rotation.
    const rim=[[-63,equator,0],[0,equator,63],[63,equator,0],[0,equator,-63]];
    const vertices=[],colors=[];
    const upperColors=[0xc2f3ff,0x48bce9,0x237eb9,0x74d9f4];
    const undersideColors=[0x3899ca,0x204d98,0x163d78,0x266d9e];
    const lowerColors=[0x8ceaff,0x3cb3e3,0x246fab,0x62cfe9];
    function triangle(a,b,c,color){
      vertices.push(...a,...b,...c);
      const tint=new THREE.Color(color);for(let v=0;v<3;v++)colors.push(tint.r,tint.g,tint.b);
    }
    for(let i=0;i<4;i++){
      const next=(i+1)%4;
      triangle([0,top,0],rim[i],rim[next],lower?undersideColors[i]:upperColors[i]);
      triangle([0,bottom,0],rim[next],rim[i],lower?lowerColors[i]:undersideColors[i]);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();return geometry;
  }
  const planet=new THREE.Group();planet.name='arenaPlanet';planet.position.set(-65,110,-340);
  planet.rotation.set(-.08,-.16,-.10);sky.add(planet);
  const edgeMaterial=new THREE.LineBasicMaterial({color:0x9aeaff,transparent:true,opacity:.22,fog:false});
  for(const [name,equator,top,bottom,lower] of [
    ['ethereumUpper',-6,100,-44,false],
    ['ethereumLower',-18,-56,-103,true]
  ]){
    // The lower section follows the upper underside with a consistent chevron gap.
    const geometry=ethereumSection(equator,top,bottom,lower);
    const section=new THREE.Mesh(geometry,planetMaterial);section.name=name;planet.add(section);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),edgeMaterial);
    edges.name='ethereumFacetEdges';planet.add(edges);
  }
  scene.add(new THREE.HemisphereLight(0xbddfed,0x38463e,.85));
  const key=new THREE.DirectionalLight(0xf1f6ff,.95);key.position.set(-10,18,14);scene.add(key);
  const fill=new THREE.DirectionalLight(0x93c7e8,.6);fill.position.set(12,9,-6);scene.add(fill);
  const actors=[],actions=options.actions;
  const characterForms=options.characterForms||{juggernaut:[1,2,3,4,5,6,7],monsters:[1,2,3,4,5,6,7],specter:[1,2,3,4,5,6,7],longneck:[1,2,3,4,5,6,7]};
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
    const character=appearance?.character||'monsters';
    if(!characterForms[character]?.includes(appearance?.form)||!['lava','sand','plant','ice'].includes(appearance?.variant))return false;
    resetCombat();const old=actors[index];actors[index]=makeActor(index,appearance);
    const field=old.root.userData.looseRocks?.orbitField;if(field)field.parent?.remove(field);
    old.root.parent?.remove(old.root);options.disposeCharacter?.(old.root,field);return true;
  }
  function attack(index){return actions?.attack(actors,index)||{ok:false,reason:'unavailable'};}
  function hit(index){if(!actions||actors.some(actor=>actions.busy(actor)))return false;return actions.hit(actors[index],actors[1-index].root.position);}
  let yaw=0,pitch=.24,distance=29;
  const lookAt=new THREE.Vector3(0,3,0);
  function resize(aspect){if(camera.aspect===aspect)return;camera.aspect=aspect;camera.updateProjectionMatrix();}
  function orbit(dx,dy){yaw=(yaw+dx)%(Math.PI*2);pitch=THREE.MathUtils.clamp(pitch+dy,.08,1.25);}
  function zoom(delta){distance=THREE.MathUtils.clamp(distance+delta,12,220);}
  function reset(){yaw=0;pitch=.24;distance=29;}
  function tick(time,dt){const framedDistance=distance;camera.fov=THREE.MathUtils.clamp(50/Math.min(1,camera.aspect/1.1),50,85);camera.updateProjectionMatrix();scene.fog.near=180;scene.fog.far=380;camera.position.set(Math.sin(yaw)*Math.cos(pitch)*framedDistance,deckLift+3+Math.sin(pitch)*framedDistance,Math.cos(yaw)*Math.cos(pitch)*framedDistance);lookAt.y=deckLift+6+Math.max(0,.24-pitch)*55;camera.lookAt(lookAt);sky.position.copy(camera.position);plasmaMaterial.uniforms.time.value=time;planet.rotation.y=(planet.rotation.y+Math.max(0,Math.min(dt||0,.1))*.045)%(Math.PI*2);for(const actor of actors)actions?.restore(actor);for(const actor of actors)animateCharacter(actor,time,dt);for(const actor of actors)actions?.tick(actor,time,dt);}
  tick(0,0);
  return {scene,camera,actors,architecture,resize,orbit,zoom,reset,tick,setFighter,attack,hit,resetCombat,
    isBusy:()=>!!actions&&actors.some(actor=>actions.busy(actor)),
    actorState:index=>actions?actions.state(actors[index]):'Ready'};
});
