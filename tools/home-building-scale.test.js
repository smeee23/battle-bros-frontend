'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js');
const html=fs.readFileSync('index.html','utf8');
function fn(name){const a=html.indexOf('  function '+name+'(');assert(a>=0,name);return html.slice(a,html.indexOf('\n  }',a)+4);}
function setup(previous=false){
  const materials=new Map(),geometries=new Map();
  const M=new Proxy({}, {get:(_,name)=>{if(!materials.has(name))materials.set(name,new THREE.MeshLambertMaterial());return materials.get(name);}});
  const context=vm.createContext({THREE,M,MAX_FLOORS:8,MAX_TERRAIN_FLOORS:64,OXYGEN_PLANT_MAX_LEVEL:6,
    AIR_COMMAND_MAX_LEVEL:6,CRYSTAL_RIG_MAX_LEVEL:8,HOME_GRID_DEFAULT:50,world:[],BASE_TERRAIN:'stone',CROP_KINDS:new Set(),
    getBoxGeometry:(w,h,d)=>{const key=[w,h,d].join(',');if(!geometries.has(key))geometries.set(key,new THREE.BoxGeometry(w,h,d));return geometries.get(key);},
    castReceive(){},isTrainingCenter:c=>c?.kind==='house'&&c.buildingType==='skyscraper',
    isGenerationPlantKind:k=>['oxygen-plant','water-plant'].includes(k),normalizeAppearance:a=>a||null});
  const constants=html.slice(html.indexOf('  const SPACE_TOWER_MIN_LEVEL ='),html.indexOf('  // Space laser tower'));
  const names=['addSlidingBuildingDoor','setBuildingDoorOpen','makeSpaceHabitat','makeStoneTower',
    'removedHouseTypeValues','activeHouseTypeValues','normalizeBuildingType','cloneExtras',
    'maxFloorsForKind','maxFloorsForCell','clampFloorsForKind','writeWorldIntentCell','normalizeAutoAction','normalizeCommitCell'];
  let source=constants+names.map(fn).join('\n');
  if(previous)source=source
    .replace('const f = Math.max(1, Math.min(6, floors || 1)) + 2;','const f = Math.max(1, floors);')
    .replace('const f = Math.max(SPACE_TOWER_MIN_LEVEL, Math.min(MAX_FLOORS - 2, floors || 1)) + 2;',
      'const f = Math.max(SPACE_TOWER_MIN_LEVEL, Math.min(MAX_FLOORS, floors || 1));')
    .replaceAll('addSlidingBuildingDoor(g, hatch, hatchWindow, 1.5);','addSlidingBuildingDoor(g, hatch, hatchWindow);');
  vm.runInContext(source,context);return context;
}
const current=setup(),previous=setup(true);
for(const [buildingType,make] of [['tower','makeStoneTower'],['habitat','makeSpaceHabitat']]){
  assert.equal(current.maxFloorsForCell({kind:'house',buildingType}),6);
  for(let level=1;level<=6;level++){
    const model=current[make](level),old=previous[make](level+2);
    const shell=model.children.find(n=>n.material===current.M.habitatShell&&n.geometry.type==='CylinderGeometry');
    const oldShell=old.children.find(n=>n.material===previous.M.habitatShell&&n.geometry.type==='CylinderGeometry');
    assert.deepEqual(shell.geometry.parameters,oldShell.geometry.parameters,buildingType+' '+level+' retains old level '+(level+2)+' shell');
    assert(shell.position.equals(oldShell.position));
    const door=model.userData.slidingDoor,oldDoor=old.userData.slidingDoor;
    assert(Math.abs(door.width*door.doorway.scale.x-oldDoor.width*1.5)<1e-10,'Door width is half the previous tripled size');
    assert(Math.abs(door.height*door.doorway.scale.y-oldDoor.height*1.5)<1e-10,'Door height is half the previous tripled size');
    assert(Math.abs(door.doorway.position.y-door.height/2-(oldDoor.doorway.position.y-oldDoor.height/2))<1e-10,'Door bottom returns to its original height');
    if(buildingType==='habitat'){
      assert.equal(door.doorway.position.z,shell.position.z,'Habitat doorway is centered across the circular wall');
      assert.equal(model.children.find(n=>n.material===current.M.step).position.z,door.doorway.position.z,'Entrance step follows the centered door');
    }
    for(let i=0;i<2;i++)for(const axis of ['width','height','depth']){
      const scale=door.doorway.scale[{width:'x',height:'y',depth:'z'}[axis]];
      assert(Math.abs(door.leaves[0].children[i].geometry.parameters[axis]*scale-oldDoor.leaves[0].children[i].geometry.parameters[axis]*1.5)<1e-10,'Panel and window sizes are halved from the previous tripled size');
    }
    current.setBuildingDoorOpen(door,1);
    assert(door.leaves[1].position.x-door.leaves[0].position.x>door.width,'Sliding doors clear the full entrance');
    current.setBuildingDoorOpen(door,0);assert.equal(door.leaves[1].position.x,door.width/4);
    assert(Math.abs(new THREE.Box3().setFromObject(model).min.y-new THREE.Box3().setFromObject(old).min.y)<1e-6,'Ground contact stays unchanged');
  }
  const last=current[make](6),overflow=current[make](8);
  assert(new THREE.Box3().setFromObject(last).equals(new THREE.Box3().setFromObject(overflow)),'Old upper levels clamp to the new maximum');
  const one=current[make](1),again=current[make](1);
  assert.equal(one.userData.slidingDoor.leaves[0].children[0].geometry,again.userData.slidingDoor.leaves[0].children[0].geometry,'Enlarged doors reuse cached geometry');
  assert.equal(current.writeWorldIntentCell(1,1,{kind:'house',buildingType,floors:8}).floors,6,'Imported intents clamp old levels');
  assert.equal(current.normalizeAutoAction({terrain:'stone',kind:'house',buildingType,floors:8}).floors,6,'Generated actions respect the cap');
  assert.throws(()=>current.normalizeCommitCell({x:1,z:1,terrain:'stone',kind:'house',buildingType,floors:7},0),/level cap of 6/);
}
assert.equal(current.maxFloorsForCell({kind:'rock'}),8);
assert.equal(current.maxFloorsForCell({kind:'house',buildingType:'air-command'}),6);
assert.equal(current.maxFloorsForCell({kind:'house',buildingType:'transporter'}),1);
assert.equal(current.maxFloorsForCell({kind:'house',buildingType:'skyscraper'}),1);
console.log('Home buildings: old sizes 3–8, halved doors, original door-bottom height, centered Habitat entrance, cached geometry, level caps and unchanged other buildings passed.');
