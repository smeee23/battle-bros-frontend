'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three/three.r128.min.js'),html=fs.readFileSync('index.html','utf8');
const group=new THREE.Group(),root=new THREE.Group(),field=new THREE.Group();root.userData.looseRocks={orbitField:field};root.position.set(2,3,4);group.add(root,field);
let paused=0,bound=0,stored=0;
const context=vm.createContext({baseBattleBroPrototype:root,worldGroup:group,explorationActive:false,
 activeFPTerrain:()=>({groundYAt:()=>7}),battleBroFamily:()=> 'monsters',SPECTER_HOVER_CLEARANCE:.3,
 pauseTransportBattleBro:()=>paused++,bindTransportBattleBro:()=>bound++,isHomeBroUnhatched:()=>false,
 ensureTransportCube:()=>({suspend:()=>stored++}),fpToolsAvailable:()=>true,battleBrosMessages:require('../assets/game-messages')()});
const start=html.indexOf('  // ---------- transport cube ----------'),end=html.indexOf('  function pauseTransportBattleBro(',start);
vm.runInContext(html.slice(start,end),context);
const sync=model=>context.syncHomeBroPresence(model);
sync({territory:null});assert.equal(root.parent,group);assert(!context.selectedBroDefendsTerritory());
sync({territory:'9007199254740993'});assert.equal(root.parent,null);assert(!field.visible);assert.equal(paused,1);
sync();assert.equal(root.parent,null,'Missing data during refresh does not undo the last confirmed location');assert.equal(paused,1,'Parked actors do not repeatedly reset animation');
context.explorationActive=true;context.restoreHomeTransportBattleBro();sync();assert.equal(root.parent,null,'Travel cannot restore a defender');
sync({territory:null});assert.equal(root.parent,null,'A freed actor returns only when back at Home');
context.explorationActive=false;sync();assert.equal(root.parent,group);assert.equal(root.position.y,7);assert.equal(bound,1);assert(field.visible);
sync({territory:'2'});
const other=new THREE.Group();group.add(other);context.baseBattleBroPrototype=other;sync({territory:'0'});
assert.equal(root.parent,null,'Changing NFTs cannot restore the old defender');assert.equal(other.parent,group);
sync({territory:'3'});assert.equal(other.parent,null,'Newly selected defenders are absent too');
const a=html.indexOf('  function throwTransportCube()'),b=html.indexOf('  function tickTransportCube(',a);
vm.runInContext(html.slice(a,b),context);assert.equal(context.throwTransportCube(),false);assert.match(context.battleBrosMessages.current.text,/defending/);
console.log('Home BRO presence: confirmed defense, refresh stability, travel, departure restoration, NFT switches and blocked defender transport passed');
