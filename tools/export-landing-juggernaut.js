'use strict';
// Export the real game factory through the existing headless fixture.
// Run again when the Juggernaut model changes.
const fs = require('node:fs');
const path = require('node:path');
const {api, THREE} = require('./longneck-fixture')();
const root = api.createBattleBroCharacter({character:'juggernaut',form:4,variant:'lava'});
root.position.set(0,0,0);
root.rotation.set(0,0,0);
// Newly attached floating parts (including the visor) need their first rig sync.
api.tickLooseRockAttachments(root,0,0);
root.updateMatrixWorld(true);
const visor = root.getObjectByName('juggernautCoreVisor');
const head = root.getObjectByName('lavaHeadCore');
const visorPosition = visor.getWorldPosition(new THREE.Vector3());
const headPosition = head.getWorldPosition(new THREE.Vector3());
if (Math.abs(visorPosition.y - headPosition.y) > .35)
  throw Error('Juggernaut visor must remain at face height');
// Sample the production idle and head-look routines, with a quiet pause between scans.
const presentation = new THREE.Group();
presentation.name = 'LandingJuggernautPreview';
api.worldGroup.add(presentation);
presentation.add(root);
api.tickBattleBroOrbitField(root,0);
root.userData.juggernautLook.wait = 3;
root.userData.juggernautLook.direction = 1;
api.setBattleBroExpression(root,'neutral',{immediate:true});
const nodes = [];
presentation.traverse(node => nodes.push(node));
const frames = nodes.map(node => ({node, positions:[], rotations:[], scales:[]}));
const times = [], duration = 18, fps = 20;
for (let frame=0; frame<=duration*fps; frame++) {
  const time = frame/fps;
  if (time > 10) root.userData.juggernautLook.wait = 1000;
  api.tickLooseRockAttachments(root,time,1/fps);
  api.tickBattleBroExpression(root,1/fps);
  times.push(time);
  for (const sample of frames) {
    sample.positions.push(...sample.node.position.toArray());
    sample.rotations.push(...sample.node.quaternion.toArray());
    // r128 matrix deserialization cannot decompose an exact zero scale.
    sample.scales.push(...sample.node.scale.toArray().map(value=>Math.max(1e-6,value)));
  }
}
const tracks = [];
for (const {node,positions,rotations,scales} of frames) {
  for (const [property,values,width,Track] of [
    ['position',positions,3,THREE.VectorKeyframeTrack],
    ['quaternion',rotations,4,THREE.QuaternionKeyframeTrack],
    ['scale',scales,3,THREE.VectorKeyframeTrack]]) {
    if (!values.every(Number.isFinite)) throw Error('Non-finite preview pose: '+node.name);
    // Keep the authored drift intact; the preview eases playback in both directions.
    const first = values.slice(0,width);
    if (values.some((value,i)=>Math.abs(value-first[i%width])>1e-6)) {
      const track = new Track(node.uuid+'.'+property,times,values);
      track.optimize(); tracks.push(track);
    }
    if(property==='position')node.position.fromArray(first);
    else if(property==='quaternion')node.quaternion.fromArray(first);
    else node.scale.fromArray(first);
  }
}
presentation.animations=[new THREE.AnimationClip('Juggernaut idle look around',duration,tracks)];
// Runtime references contain cycles; serialize geometry, pose and animation only.
presentation.traverse(node => {node.userData = {};});
root.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(root);
if (bounds.isEmpty() || !bounds.getSize(new THREE.Vector3()).toArray().every(Number.isFinite))
  throw Error('Juggernaut preview has invalid geometry');
const data = presentation.toJSON();
// Validate the serialized asset: missing track nodes can bind to the root in r128.
const replay = new THREE.ObjectLoader().parse(data);
for (const track of replay.animations[0].tracks) {
  if (!replay.getObjectByProperty('uuid',track.name.split('.')[0]))
    throw Error('Missing preview animation target: '+track.name);
}
const mixer = new THREE.AnimationMixer(replay);
mixer.clipAction(replay.animations[0]).play();
for(let frame=0;frame<duration*fps;frame++){
  mixer.setTime(frame/fps);
  replay.updateMatrixWorld(true);
  replay.traverse(node=>{
    if(!node.matrixWorld.elements.every(Number.isFinite))
      throw Error('Invalid reloaded animation pose: '+node.name);
  });
  const face=replay.getObjectByName('lavaHeadCore').getWorldPosition(new THREE.Vector3());
  const visor=replay.getObjectByName('juggernautCoreVisor').getWorldPosition(new THREE.Vector3());
  if(face.distanceTo(visor)>.8)throw Error('Animated visor detached from face');
}
fs.writeFileSync(path.join(__dirname,'../assets/landing-juggernaut.json'),JSON.stringify(data));
console.log('Exported actual Juggernaut IV lava preview.');
