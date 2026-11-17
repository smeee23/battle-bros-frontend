'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const THREE=require('../vendor/three/three.r128.min.js');
const fixture=fs.readFileSync('tools/exploration-world.test.js','utf8').split('const {terrain,scene,xrWorldRoot,context}=setup();')[0];
const setup=new Function('require',fixture+'return setup;')(require);
const {terrain,scene,context}=setup(),camera=context.persCam,originalProjection=camera.projectionMatrix.clone();
terrain.activate();terrain.activate();assert.equal(camera.far,5000);assert.equal(camera.near,.02);assert.equal(camera.fov,55);
const group=terrain.group.getObjectByName('endless-ethereum-rings'),logo=group.getObjectByName('ethereumMonument'),debris=group.getObjectByName('endless-inner-ring-fragments'),stars=terrain.group.getObjectByName('endless-space-stars');
assert(debris.isInstancedMesh);assert(debris.count>300&&debris.count<=1344,'Bounded debris uses one instanced mesh');
assert(debris.material.depthTest&&debris.material.depthWrite&&!debris.material.transparent);assert.equal(debris.material.fog,false);
const shader={uniforms:{},vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader};debris.material.onBeforeCompile(shader);
assert(shader.vertexShader.includes('instanceMatrix*debrisPoint'),'Transition follows the actual instanced geometry');
assert(shader.fragmentShader.includes('gl_FragColor.rgb=mix')&&!shader.fragmentShader.includes('debrisGrain')&&!shader.fragmentShader.includes('discard'),'Distance dimming preserves solid, unperforated surfaces');assert(!shader.fragmentShader.includes('\\n'),'Shader declarations contain real newlines');
assert(shader.uniforms.debrisFadeRange.value.x<shader.uniforms.debrisFadeRange.value.y);
let left=0,right=0;const sideTransform=new THREE.Matrix4(),sidePosition=new THREE.Vector3();
for(let i=0;i<debris.count;i++){debris.getMatrixAt(i,sideTransform);sidePosition.setFromMatrixPosition(sideTransform);const width=new THREE.Vector3().setFromMatrixScale(sideTransform);assert(Math.hypot(sidePosition.x,sidePosition.z)-Math.max(width.x,width.z)>=140,'The full decorative footprint stays outside the gameplay window');
 if(Math.abs(sidePosition.z)<400&&sidePosition.length()<900){if(sidePosition.x<-140)left++;if(sidePosition.x>140)right++;}}
assert(left>10&&right>10,'Substantial solid debris continues along both sides of the observer');

assert.equal(stars.material.sizeAttenuation,false);assert.equal(stars.material.size,2.4);assert(Math.abs(stars.scale.x*150-4300)<1e-8,'Stars remain behind the larger backdrop');
const baseline=require('../assets/battle-arena').createEthereumLogo(THREE);baseline.scale.setScalar(1.25);baseline.position.set(0,12,-420);baseline.updateMatrixWorld(true);
scene.updateMatrixWorld(true);const oldTop=baseline.localToWorld(new THREE.Vector3(0,100,0)),newTop=logo.localToWorld(new THREE.Vector3(0,100,0));
assert(Math.abs(Math.atan2(oldTop.y-.6,-oldTop.z)-Math.atan2(newTop.y-.6,-newTop.z))<.002,'Ground-level upper framing is retained');
const oldBottom=baseline.localToWorld(new THREE.Vector3(0,-103,0)),newBottom=logo.localToWorld(new THREE.Vector3(0,-103,0));
assert(Math.abs(Math.atan2(oldBottom.y-.6,-oldBottom.z)-Math.atan2(newBottom.y-.6,-newBottom.z))<.002,'Ground-level lower framing is retained');
const originalInstances=debris.instanceMatrix.array.slice(),originalCells=JSON.stringify(terrain.getCell(0,0)),ray=new THREE.Raycaster(),player={pos:new THREE.Vector3(0,.6,0),grounded:false,vy:0};
let previousCompensation=0;
for(const height of [.6,13,40,80,160,800]){
 player.pos.y=height;terrain.tick(0,player,.6,null);scene.updateMatrixWorld(true);
 assert(Number.isFinite(group.position.y));assert(group.position.y>=previousCompensation);assert(group.position.y<height*.35);previousCompensation=group.position.y;
 let lower=0,blockedLower=0,upper=0,blockedUpper=0;
 for(const x of [-20,0,20])for(const y of [-95,-75,-55,-30,10,40,65,90]){
  const direction=logo.localToWorld(new THREE.Vector3(x,y,0)).sub(player.pos).normalize();ray.set(player.pos,direction);
  const logoHit=ray.intersectObject(logo,true).find(hit=>hit.object.isMesh);if(!logoHit)continue;
  const occluder=ray.intersectObject(debris,false)[0],blocked=!!occluder&&occluder.distance<logoHit.distance;
  if(y<0){lower++;if(blocked)blockedLower++;}else{upper++;if(blocked)blockedUpper++;}
 }
 assert(lower>0&&blockedLower>=1,'Inner silhouettes obscure part of the lower crystal at height '+height);
 assert(upper>0&&blockedUpper===0,'Upper focal silhouette stays open at height '+height);
 const currentCenter=logo.getWorldPosition(new THREE.Vector3());
 if(height>=80){const oldTilt=Math.abs(Math.atan2(12-height,420)),newTilt=Math.abs(Math.atan2(currentCenter.y-height,1680));assert(newTilt<oldTilt*.3,'Altitude has much less effect on the distant focal point');}
 const ringPositions=group.getObjectByName('endless-ring-lanes').geometry.attributes.position;
 for(let i=0;i<ringPositions.count;i+=17){const vertex=group.getObjectByName('endless-ring-lanes').localToWorld(new THREE.Vector3().fromBufferAttribute(ringPositions,i));assert(vertex.distanceTo(player.pos)<camera.far,'Ring continuation fits the Endless far plane');}
}
assert.deepEqual(debris.instanceMatrix.array,originalInstances,'Altitude never regenerates or moves individual fragments');assert.equal(JSON.stringify(terrain.getCell(0,0)),originalCells,'Backdrop does not edit playable terrain');
const elevation=context.terrain.test.celestialHeight;
assert.equal(elevation(0),0);assert.equal(elevation(12),0);assert(elevation(12.001)<.000001,'Compensation starts smoothly');
for(let y=12;y<819;y+=5)assert(elevation(y+1)-elevation(y)<.35,'Compensation never fully tracks vertical player motion');
terrain.deactivate();assert.equal(camera.far,1100);assert.deepEqual(camera.projectionMatrix.elements,originalProjection.elements,'Home camera projection is restored exactly');
terrain.activate();assert.equal(terrain.group.getObjectByName('endless-inner-ring-fragments'),debris,'Re-entry reuses the same GPU resources');terrain.deactivate();
console.log('Endless backdrop: preserved framing, altitude stability, real lower-logo occlusion, open upper silhouette, bounded instancing, star depth, clipping and camera restoration passed');
