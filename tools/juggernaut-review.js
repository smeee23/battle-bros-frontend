/* Local-only visual comparison: production core, controlled equivalent inputs. */
window.createJuggernautReview=function(THREE,hooks){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x182331);
 scene.add(new THREE.HemisphereLight(0xffffff,0x607080,1));
 const light=new THREE.DirectionalLight(0xffffff,.9);light.position.set(4,12,7);scene.add(light);
 scene.add(new THREE.GridHelper(40,40,0x8798a8,0x607080));
 const camera=new THREE.PerspectiveCamera(42,1,.1,150),size=new THREE.Vector2();
 const panel=document.createElement('div');panel.style.cssText='position:fixed;z-index:10001;top:12px;left:12px;padding:14px;background:#102030ee;color:white;font:14px system-ui';
 panel.innerHTML='<b>Juggernaut shared animation review</b><p>Three equivalent-input instances of the production controller.<br>Navigation is bypassed; use the real worlds to review route selection.</p>';
 const form=document.createElement('select');for(let i=1;i<=7;i++)form.add(new Option('Form '+i,i));form.value=4;panel.append(form);
 const mode=document.createElement('select');for(const name of ['idle','walk','run','turn','jump','blocked','moving support'])mode.add(new Option(name,name));panel.append(mode);
 const view=document.createElement('select');for(const name of ['three-quarter','side','front','above'])view.add(new Option(name,name));panel.append(view);
 const pause=document.createElement('button');pause.textContent='Pause';panel.append(pause);
 const step=document.createElement('button');step.textContent='Step';panel.append(step);
 const restart=document.createElement('button');restart.textContent='Restart';panel.append(restart);
 const info=document.createElement('pre');panel.append(info);document.body.append(panel);
 hooks.canvas.style.cssText+=';position:fixed;inset:0;z-index:10000';
 let actors=[],time=0,paused=false,accumulator=0;
 function reset(){
  for(const a of actors){scene.remove(a.root);hooks.release(a.root);}
  actors=[];time=0;accumulator=0;
  for(let lane=0;lane<3;lane++){
   const a=hooks.actor(Number(form.value),(lane-1)*5,mode.value);scene.add(a.root);actors.push(a);
  }
 }
 function tick(dt){
  time+=dt;
  for(const a of actors){
   if(a.jump?.active){a.jump.tick(dt,time);a.animation.interrupt();continue;}
   if(mode.value==='moving support'){
    const delta=new THREE.Vector3(dt*.2,0,0);a.root.position.add(delta);a.animation.carry(delta);
   }
   const p=a.animation.prepare({blocked:mode.value==='blocked'},dt,time);
   a.root.position.copy(p.position);a.root.rotation.y=p.yaw;
   a.animation.commit({grounded:true},time,dt);
  }
  info.textContent=`${time.toFixed(2)} s · ${actors[0].mover.state} · contacts: ${actors[0].mover.supportContacts}\nRun uses the existing mature gait; Forms I–III retain their juvenile walk.\nReload without the query to return to the game.`;
 }
 form.onchange=mode.onchange=restart.onclick=reset;
 pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Play':'Pause';};
 step.onclick=()=>{paused=true;pause.textContent='Play';tick(1/60);};reset();
 return {render(renderer,dt){
  if(!paused){accumulator+=dt;while(accumulator>=1/60){tick(1/60);accumulator-=1/60;}}
  renderer.getSize(size);camera.aspect=size.x/size.y;camera.updateProjectionMatrix();
  camera.position.fromArray({'three-quarter':[15,10,20],side:[22,5,2],front:[0,6,24],above:[0,25,.01]}[view.value]);camera.lookAt(0,1.5,1);
  renderer.setRenderTarget(null);renderer.render(scene,camera);
 }};
};
