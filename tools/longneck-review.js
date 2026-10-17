/* Development-only equivalent-input pose review. Uses the application's renderer/loop. */
window.createLongneckReview=function(THREE,hooks){
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x182331);
  const camera=new THREE.PerspectiveCamera(42,1,.1,150),size=new THREE.Vector2();
  scene.add(new THREE.HemisphereLight(0xffffff,0x607080,1));
  const light=new THREE.DirectionalLight(0xffffff,.9);light.position.set(4,12,7);scene.add(light);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshLambertMaterial({color:0x46505a}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.12;scene.add(floor);
  scene.add(new THREE.GridHelper(40,40,0x8798a8,0x607080));
  const panel=document.createElement('div');panel.style.cssText='position:fixed;z-index:10001;top:12px;left:12px;padding:14px;background:#102030ee;color:white;font:14px system-ui;max-width:560px';
  panel.innerHTML='<b>Longneck shared-pose review</b><p>Left: home · Middle: resident · Right: deployed pose<br>Equivalent motion inputs; navigation is bypassed here.</p>';
  const form=document.createElement('select');for(let i=1;i<=7;i++)form.add(new Option('Form '+i,i));form.value=4;panel.append(form);
  const scenario=document.createElement('select');for(const name of ['idle','walk','gallop','turn','step up','step down','standing jump','running jump','blocked','moving support'])scenario.add(new Option(name,name));panel.append(scenario);
  const view=document.createElement('select');for(const name of ['three-quarter','side','front','above'])view.add(new Option(name,name));panel.append(view);
  const pause=document.createElement('button');pause.textContent='Pause';panel.append(pause);
  const step=document.createElement('button');step.textContent='Step 1/60 s';panel.append(step);
  const restart=document.createElement('button');restart.textContent='Restart';panel.append(restart);
  const info=document.createElement('pre');panel.append(info);document.body.append(panel);
  hooks.canvas.style.cssText+=';position:fixed;inset:0;z-index:10000';
  let actors=[],time=0,accumulator=0,paused=false;
  function reset(){
    for(const a of actors){scene.remove(a.group);hooks.release(a.root);}
    actors=[];time=0;
    for(let lane=0;lane<3;lane++){
      const root=hooks.create({form:Number(form.value),variant:'ice'}),group=new THREE.Group();const originX=(lane-1)*5;root.position.x=originX;group.add(root);scene.add(group);
      const mover={root,parts:root.userData.rig,state:'IDLE',progress:0,idlePhase:0,lookRemaining:1.5,lookDirection:0};
      actors.push({root,group,originX,mover,animation:hooks.animation(mover),airborne:false});
    }
  }
  function tick(dt){
    time+=dt;
    const mode=scenario.value;
    for(const a of actors){
      const running=mode==='gallop'||mode==='running jump';
      const jumpMode=mode.endsWith('jump'),launch=mode==='running jump'?2:.4;
      const flightTime=2*hooks.jump.velocity/hooks.gravity;
      let jump=null;
      if(jumpMode&&time>=launch){
        const age=time-launch;
        if(age<hooks.jump.prepare)jump={phase:'prepare',elapsed:age,vy:0};
        else if(age<hooks.jump.prepare+flightTime){
          const air=age-hooks.jump.prepare,vy=hooks.jump.velocity-hooks.gravity*air;
          jump={phase:vy>0?'ascent':'descent',elapsed:air,vy};
          a.root.position.y=hooks.jump.velocity*air-.5*hooks.gravity*air*air;
          a.root.position.z+=dt*.4;
        }else if(age<hooks.jump.prepare+flightTime+hooks.jump.land){
          a.root.position.y=0;jump={phase:'landing',elapsed:age-hooks.jump.prepare-flightTime,vy:0};
        }
      }
      if(!jump){
        const moving=!['idle','standing jump'].includes(mode)&&time<5;
        const supportDelta=mode==='moving support'?new THREE.Vector3(dt*.25,0,0):null;
        if(supportDelta)a.root.position.add(supportDelta);
        const p=a.animation.prepareTravel({x:a.originX+(mode==='turn'?3:0),z:mode==='turn'?0:5,
          speed:moving?(running?1/.43:1/1.35):0,running,supportId:'review',supportDelta,
          targetY:mode==='step up'?.2:mode==='step down'?-.2:0},dt);
        if(mode!=='blocked'){a.root.position.copy(p.position);a.root.rotation.y=p.yaw;}
      }
      a.animation.commit({accepted:mode==='blocked'?0:1,grounded:!jump,jump,jumpConfig:hooks.jump},time,dt);
      hooks.secondary(a.root,time,dt,a.mover);
    }
    info.textContent=`${time.toFixed(2)} s · ${actors[0].mover.state}\nCompare feet, torso, head and landing transitions. Reload without the query to return to the game.`;
  }
  form.onchange=scenario.onchange=restart.onclick=reset;
  pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Play':'Pause';};
  step.onclick=()=>{paused=true;pause.textContent='Play';tick(1/60);};
  reset();
  return {render(renderer,dt){
    if(!paused){accumulator+=dt;while(accumulator>=1/60){tick(1/60);accumulator-=1/60;}}
    renderer.getSize(size);camera.aspect=size.x/size.y;camera.updateProjectionMatrix();
    const positions={'three-quarter':[15,10,20],side:[22,5,2],front:[0,6,24],above:[0,25,.01]};
    camera.position.fromArray(positions[view.value]);camera.lookAt(0,2,2);
    renderer.setRenderTarget(null);renderer.render(scene,camera);
  }};
};
