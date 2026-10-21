'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {THREE}=require('./longneck-fixture')();
const html=fs.readFileSync('index.html','utf8'),camera=new THREE.PerspectiveCamera(60,1,.01,100);
const bro=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial());
bro.position.set(0,0,-10);new THREE.Scene().add(bro);
let blocked=false,paused=0,message='';
const context=vm.createContext({THREE,persCam:camera,transportCubeBlocked:()=>blocked});
vm.runInContext(html.slice(html.indexOf('  function transportRecallVisibility('),html.indexOf('  function ensureTransportCube(')),context);
const controller=require('../assets/transport-cube')(THREE,{
 scene:new THREE.Scene(),camera,box:(...a)=>new THREE.BoxGeometry(...a),source:()=>bro,current:()=>bro,
 active:()=>true,equipped:()=>false,hand:out=>out.copy(camera.position),
 playerPosition:()=>camera.position,recallVisibility:context.transportRecallVisibility,
 pause:()=>paused++,status:m=>message=m,animate(){},prepare(){},bind(){},release(){}
});
controller.tick(0,0);
bro.position.z=-15.01;assert.equal(controller.throw(),false);assert.match(message,/15m/);assert.equal(paused,0);
bro.position.z=-10;camera.rotation.y=Math.PI;assert.equal(controller.throw(),false);assert.match(message,/Look/);assert.equal(paused,0);
camera.rotation.y=0;blocked=true;assert.equal(controller.throw(),false);assert.match(message,/blocked/);assert.equal(paused,0);
blocked=false;bro.position.z=-15;assert.equal(controller.throw(),true);assert.equal(paused,1);assert.equal(controller.phase,'recall-flight');
console.log('Transport recall: 15m boundary, off-screen, blocked sight and accepted recall passed');
