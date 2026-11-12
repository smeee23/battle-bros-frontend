/* Shared, frontend-only combat. Native family poses are supplied by the scene. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.createBattleBroBattleActions=factory;})(typeof globalThis!=='undefined'?globalThis:this,function(THREE,hooks){
  'use strict';
  hooks=hooks||{};
  // Balance and timing live here for BOTH Arena and Endless practice.
  const config=Object.freeze({maxHealth:100,normalDamage:2,berserkerDamage:16,energyMax:100,energyPerHit:5,
    cooldown:.32,windup:.08,gestureDuration:.26,berserkerCooldown:.6,berserkerWindup:.14,berserkerGestureDuration:.42,
    releaseDuration:.08,hitDuration:.32,hitDistance:.14,opponentCadence:.95,opponentDelay:.7,
    projectileSpeed:32,minFlight:.16,maxFlight:.7,projectileLifetime:1.5,maxRange:40,maxProjectiles:12,...hooks.config});
  for(const [key,value] of Object.entries(config))if(!Number.isFinite(value)||value<=0)throw Error('Invalid combat configuration: '+key);
  if(!Number.isInteger(config.maxProjectiles)||config.maxProjectiles>64||config.gestureDuration>config.cooldown||config.berserkerGestureDuration>config.berserkerCooldown||config.windup>=config.gestureDuration||config.berserkerWindup>=config.berserkerGestureDuration||config.minFlight>config.maxFlight||config.maxFlight>config.projectileLifetime)throw Error('Inconsistent combat timing/pool configuration');
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const expression=root=>root.userData.slots?.face?.userData.expression?.name||'neutral';
  const setExpression=(root,name)=>hooks.setExpression?.(root,name,{automatic:true});
  const point=new THREE.Vector3(),local=new THREE.Vector3(),inverse=new THREE.Quaternion(),segment=new THREE.Vector3(),nearest=new THREE.Vector3();
  const battle={running:false,winner:null,clock:0,revision:0,fighters:[],opponentEnabled:false,nextOpponent:0,activeProjectiles:0,shots:0,spawned:0,hits:0,misses:0};
  const pool=[];let actors=null,sequence=0,glowMaterial=null;
  function center(actor,out){actor.root.updateMatrixWorld(true);actor.root.userData.rig.head.getWorldPosition(out);actor.root.getWorldPosition(local);return out.lerp(local,.25);}
  function remember(actor,node){const poses=actor.battlePoses||(actor.battlePoses=new Map());let pose=poses.get(node);if(!pose){pose={p:new THREE.Vector3(),q:new THREE.Quaternion(),active:false};poses.set(node,pose);}if(!pose.active){pose.p.copy(node.position);pose.q.copy(node.quaternion);pose.active=true;}}
  function restore(actor){for(const [node,pose] of actor.battlePoses||[]){if(pose.active){node.position.copy(pose.p);node.quaternion.copy(pose.q);pose.active=false;}}}
  function sourceFor(root){
    const rocks=root.userData.looseRocks;
    let source=rocks?.debris.find(r=>r.node.isMesh)?.node||rocks?.chunks.find(r=>r.node.isMesh&&!/Face|Head|head|Shell/.test(r.node.name))?.node;
    if(!source)root.traverse(node=>{if(!source&&node.isMesh&&node.geometry&&!/Face|Eye|eye|Mouth/.test(node.name))source=node;});
    return source;
  }
  function gesture(){return {active:false,age:0,launched:false,projectile:null,state:'WINDUP',elapsed:0,weight:0,windup:config.windup,releaseDuration:config.releaseDuration,
    rock:{orbitPhase:0},point:new THREE.Vector3(),position:new THREE.Vector3(),scratch:new THREE.Vector3(),down:new THREE.Vector3(),quaternion:new THREE.Quaternion(),euler:new THREE.Euler()};}
  function release(p){if(!p.active)return;p.active=false;p.launched=false;p.mesh.visible=false;p.mesh.parent?.remove(p.mesh);battle.activeProjectiles--;}
  function clearVisuals(){
    for(const p of pool)release(p);
    if(!actors)return;
    for(const actor of actors){restore(actor);hooks.restoreBody?.(actor.root);const g=actor.root.userData.battleThrow;if(g){g.active=false;g.projectile=null;g.lastPoses=null;setExpression(actor.root,g.expression);}const h=actor.root.userData.battleHit;if(h)setExpression(actor.root,h.expression);actor.root.userData.battleThrow=null;actor.root.userData.battleAttack=null;actor.root.userData.battleHit=null;}
  }
  function cancel(){battle.running=false;clearVisuals();battle.revision++;}
  function start(list,options={}){
    cancel();if(list.length!==2||list.some(a=>!a?.root?.parent))throw Error('Two attached BROs required');
    actors=[list[0],list[1]];battle.running=true;battle.winner=null;battle.clock=0;battle.shots=0;battle.spawned=0;battle.hits=0;battle.misses=0;
    battle.opponentEnabled=options.opponentEnabled??true;battle.nextOpponent=config.opponentDelay;
    battle.fighters=actors.map(actor=>{actor.hitsReceived=0;return {actor,baseExpression:expression(actor.root),health:config.maxHealth,maxHealth:config.maxHealth,energy:0,energyMax:config.energyMax,cooldown:0,source:sourceFor(actor.root),gesture:gesture()};});battle.revision++;return battle;
  }
  function ensure(list){if(!actors||actors[0]!==list[0]||actors[1]!==list[1])start(list,{opponentEnabled:false});}
  function reserve(source){
    for(const p of pool)if(!p.active)return p;
    if(pool.length>=config.maxProjectiles)return null;
    if(!glowMaterial)glowMaterial=new THREE.MeshBasicMaterial({color:0xffac32,wireframe:true,transparent:true,opacity:.7,depthWrite:false});
    const mesh=new THREE.Mesh(source.geometry,source.material),glow=new THREE.Mesh(source.geometry,glowMaterial);mesh.name='combatRock';glow.name='berserkerGlow';glow.scale.setScalar(1.2);mesh.add(glow);mesh.visible=false;
    const p={mesh,glow,active:false,launched:false,start:new THREE.Vector3(),position:new THREE.Vector3(),previous:new THREE.Vector3(),target:new THREE.Vector3(),lastTarget:new THREE.Vector3(),scale:new THREE.Vector3()};pool.push(p);return p;
  }
  function canAttack(index,berserker=false){const f=battle.fighters[index];if(!battle.running||!f||f.cooldown>1e-8||f.gesture.active||(berserker&&f.energy<config.energyMax))return false;return battle.activeProjectiles<config.maxProjectiles;}
  function attack(list,index,options={}){
    ensure(list);const special=options.berserker===true;
    if(!canAttack(index,special))return {ok:false,reason:battle.running?'cooldown-or-energy':'inactive'};
    const f=battle.fighters[index],other=battle.fighters[1-index];
    if(!f.source||!f.actor.root.parent||!other.actor.root.parent||f.actor.root.position.distanceTo(other.actor.root.position)>config.maxRange)return {ok:false,reason:'unavailable-or-out-of-range'};
    const p=reserve(f.source);if(!p)return {ok:false,reason:'pool-full'};
    Object.assign(p,{active:true,launched:false,damageApplied:false,id:++sequence,owner:index,age:0,special,damage:special?config.berserkerDamage:config.normalDamage});
    p.mesh.geometry=f.source.geometry;p.mesh.material=f.source.material;p.glow.geometry=f.source.geometry;p.glow.visible=special;p.mesh.visible=false;f.actor.root.parent.add(p.mesh);battle.activeProjectiles++;
    const g=f.gesture;Object.assign(g,{active:true,age:0,launched:false,projectile:p,state:'WINDUP',elapsed:0,weight:0,expression:f.baseExpression,windup:special?config.berserkerWindup:config.windup,duration:special?config.berserkerGestureDuration:config.gestureDuration});
    center(other.actor,g.point);f.source.getWorldPosition(g.position);g.rock.orbitPhase=0;
    f.cooldown=special?config.berserkerCooldown:config.cooldown;if(special)f.energy-=config.energyMax;
    f.actor.root.userData.battleAttack=g;f.actor.root.userData.battleThrow=g;setExpression(f.actor.root,'mildAngry');battle.shots++;battle.revision++;
    return {ok:true,action:g,projectileId:p.id};
  }
  function hit(actor,source){
    if(!battle.running||!actor.root.parent)return false;
    let h=actor.root.userData.battleHit;
    if(!h){h={age:0,duration:config.hitDuration,direction:new THREE.Vector3(),expression:battle.fighters.find(f=>f.actor===actor)?.baseExpression||expression(actor.root),chunks:actor.root.userData.looseRocks.chunks.filter(c=>actor.root.userData.rig.spectralBody||actor.root.userData.rig.minotaurLegs||actor.root.userData.characterFamily==='juggernaut'||actor.root.userData.form<5||/^(greater|advanced)|Apex/.test(c.node.name)).slice(0,8),distance:config.hitDistance};actor.root.userData.battleHit=h;}
    h.age=0;actor.root.getWorldPosition(h.direction);h.direction.sub(source);h.direction.y=0;if(h.direction.lengthSq()<1e-8)h.direction.set(1,0,0);h.direction.normalize();
    actor.hitsReceived=(actor.hitsReceived||0)+1;setExpression(actor.root,'veryAngry');return true;
  }
  function launch(f,g){const p=g.projectile;g.launched=true;if(!p?.active)return;
    f.source.getWorldPosition(p.start);center(battle.fighters[1-p.owner].actor,p.target);p.lastTarget.copy(p.target);p.position.copy(p.start);p.previous.copy(p.start);
    p.duration=THREE.MathUtils.clamp(p.start.distanceTo(p.target)/config.projectileSpeed,config.minFlight,config.maxFlight);p.age=0;p.launched=true;p.mesh.visible=true;
    f.source.getWorldScale(p.scale);p.mesh.scale.copy(p.scale).multiplyScalar(p.special?1.8:1);battle.spawned++;
  }
  function impact(p){
    if(!p.active||p.damageApplied||!battle.running)return;
    p.damageApplied=true;const f=battle.fighters[p.owner],target=battle.fighters[1-p.owner];
    target.health=Math.max(0,target.health-p.damage);battle.hits++;if(!p.special)f.energy=Math.min(config.energyMax,f.energy+config.energyPerHit);
    f.actor.root.getWorldPosition(point);hit(target.actor,point);release(p);battle.revision++;
    if(target.health===0){battle.running=false;battle.winner=p.owner;clearVisuals();battle.revision++;}
  }
  function advance(dt){
    if(!battle.running)return;
    if(actors.some(a=>!a.root.parent)){cancel();return;}
    battle.clock+=dt;
    for(const f of battle.fighters){
      const cooldown=f.cooldown;f.cooldown=Math.max(0,cooldown-dt);if(cooldown>1e-8&&f.cooldown<=1e-8)battle.revision++;
      const g=f.gesture;if(!g.active)continue;g.age+=dt;g.rock.orbitPhase+=dt*4;center(battle.fighters[f===battle.fighters[0]?1:0].actor,g.point);
      g.state=g.age<g.windup?'WINDUP':'RELEASE';g.elapsed=g.age<g.windup?g.age:g.age-g.windup;
      g.weight=smooth(g.age/g.windup)*(1-smooth((g.age-(g.duration-config.releaseDuration))/config.releaseDuration));
      if(!g.launched&&g.age>=g.windup)launch(f,g);
      if(g.age>=g.duration){g.active=false;g.projectile=null;g.lastPoses=null;f.actor.root.userData.battleAttack=null;f.actor.root.userData.battleThrow=null;setExpression(f.actor.root,g.expression);}
    }
    for(const p of pool){
      if(!p.active||!p.launched)continue;const target=battle.fighters[1-p.owner].actor;
      center(target,p.target);if(p.target.distanceTo(p.lastTarget)>4||p.age>=config.projectileLifetime){release(p);battle.misses++;continue;}p.lastTarget.copy(p.target);
      p.age+=dt;p.previous.copy(p.position);const u=Math.min(1,p.age/p.duration);p.position.copy(p.start).lerp(p.target,u);p.position.y+=Math.sin(Math.PI*u)*(p.special?.5:.22);
      segment.subVectors(p.position,p.previous);nearest.subVectors(p.target,p.previous);const length=segment.lengthSq(),along=length?THREE.MathUtils.clamp(nearest.dot(segment)/length,0,1):0;
      nearest.copy(p.previous).addScaledVector(segment,along);
      if(nearest.distanceToSquared(p.target)<=.3*.3){impact(p);continue;}
      p.mesh.position.copy(p.position);p.mesh.parent.worldToLocal(p.mesh.position);p.mesh.rotation.x+=dt*7;p.mesh.rotation.z+=dt*5;
      if(p.special)p.glow.scale.setScalar(1.2+Math.sin(p.age*22)*.06);
    }
    if(battle.running&&battle.opponentEnabled&&battle.clock>=battle.nextOpponent){attack(actors,1);battle.nextOpponent=battle.clock+config.opponentCadence;}
  }
  function tick(actor,time,dt){
    if(!actors||!actors.includes(actor))return;dt=Math.max(0,Math.min(dt,.05));if(actor===actors[0])advance(dt);
    const root=actor.root,h=root.userData.battleHit;if(!h)return;
    h.age+=dt;const ramp=smooth(h.age/(h.duration*.22)),recovery=smooth((h.age-h.duration*.25)/(h.duration*.75)),weight=ramp*(1-recovery);
    remember(actor,root);root.position.addScaledVector(h.direction,h.distance*weight);root.position.y+=Math.abs(Math.sin(h.age*Math.PI*5))*(1-smooth(h.age/h.duration))*.06;
    root.rotateX(-weight*.22);root.rotateZ(Math.sin(h.age*19)*Math.exp(-h.age*12)*.035);
    const rig=root.userData.rig;
    if(rig.minotaurLegs){Object.values(rig.minotaurLegs).forEach((leg,i)=>{remember(actor,leg);leg.rotation.z+=Math.sin(h.age*15+(i%2)*Math.PI)*weight*.25;});remember(actor,rig.torso);rig.torso.rotation.x+=weight*.16;if(rig.jaw){remember(actor,rig.jaw);rig.jaw.rotation.x+=weight*.22;}}
    if(rig.spectralBody){remember(actor,rig.torso);rig.torso.rotation.z+=Math.sin(h.age*8)*weight*.16;}
    root.getWorldQuaternion(inverse).invert();point.copy(h.direction).applyQuaternion(inverse);
    h.chunks.forEach((chunk,i)=>{remember(actor,chunk.node);const phase=i*2.399;chunk.node.position.x+=weight*(point.x*.18+Math.sin(phase)*.24);chunk.node.position.y+=weight*(.14+(i%3)*.09);chunk.node.position.z+=weight*(point.z*.18+Math.cos(phase)*.22);chunk.node.rotateZ(weight*Math.sin(phase)*.32);});
    const field=root.userData.looseRocks.orbitField;if(field)field.position.copy(root.position);
    if(h.age>=h.duration){restore(actor);root.userData.battleHit=null;setExpression(root,h.expression);}
  }
  function busy(actor){if(actor.root.userData.battleAttack||actor.root.userData.battleHit)return true;if(!actors)return false;const index=actors.indexOf(actor);for(const p of pool)if(p.active&&p.owner===index)return true;return false;}
  function state(actor){const i=actors?.indexOf(actor)??-1;if(i<0)return 'Inactive';if(!battle.running)return battle.winner===null?'Inactive':battle.winner===i?'Victory':'Defeat';if(actor.root.userData.battleHit)return 'Recovering';if(actor.root.userData.battleThrow)return actor.root.userData.battleThrow.state==='WINDUP'?'Wind-up':'Throwing';return battle.fighters[i].cooldown>1e-8?'Cooling down':'Ready';}
  function dispose(){cancel();for(const p of pool)p.mesh.remove(p.glow);pool.length=0;glowMaterial?.dispose();glowMaterial=null;actors=null;battle.fighters=[];}
  return {config,start,cancel,stop:cancel,attack,hit,tick,restore,busy,state,canAttack,combat:()=>battle,stats:()=>({allocated:pool.length,active:battle.activeProjectiles,spawned:battle.spawned,hits:battle.hits}),dispose};
});
