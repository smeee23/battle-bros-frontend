'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const create=require('../assets/game-messages');
let writes=0;
const box={hidden:false,dataset:{}},title={},body={};
const messages=create({box,title,body,onChange:()=>writes++});
assert(box.hidden,'Idle world has no permanent message');
messages.setMode('endless');
messages.context('cube','Aim at clear ground',{title:'BRO teleport cube equipped',priority:30});
assert.equal(body.textContent,'Aim at clear ground');assert.equal(title.textContent,'BRO teleport cube equipped');
const initialWrites=writes;
for(let i=0;i<1000;i++)messages.context('cube','Aim at clear ground',{title:'BRO teleport cube equipped',priority:30});
assert.equal(writes,initialWrites,'Unchanged per-frame context never rewrites the DOM');
messages.context('territory','Territory #3 · Claimable',{priority:10});
messages.notify('BRO #1 has an open Need.',{source:'claim',category:'error'});
assert.equal(body.textContent,'BRO #1 has an open Need.');assert(title.hidden);assert.equal(box.dataset.category,'error');
messages.context('cube','Recall BattleBro',{title:'BRO teleport cube equipped',priority:30});
messages.tick(7);assert.equal(body.textContent,'BRO #1 has an open Need.');
messages.notify('BRO #1 has an open Need.',{source:'claim',category:'error'});
messages.tick(1.1);assert.equal(body.textContent,'Recall BattleBro','Expiry restores the latest context, not text from before the warning');
messages.notify('Low priority',{source:'info',duration:4});messages.tick(1);
messages.notify('Important',{source:'warning',category:'warning',duration:6});
messages.notify('Critical',{source:'error',category:'error',duration:8});
messages.notify('Second critical',{source:'other-error',category:'error',duration:8});
assert.equal(body.textContent,'Critical');messages.tick(8);assert.equal(body.textContent,'Second critical','Equal-priority errors get their full reading time in order');
messages.tick(8);assert.equal(body.textContent,'Important','Interrupted warning resumes');
messages.tick(6);assert.equal(body.textContent,'Low priority');messages.tick(2.9);assert.equal(body.textContent,'Low priority');messages.tick(.2);assert.equal(body.textContent,'Recall BattleBro');
messages.notify('First failure',{source:'same-action',category:'error',duration:1});messages.notify('Latest failure',{source:'same-action',category:'error',duration:1});assert.equal(body.textContent,'First failure','A second error from the same system cannot cut short the first');messages.tick(1);assert.equal(body.textContent,'Latest failure');messages.tick(1);
messages.notify('Read this',{category:'error'});messages.setVisible(false);assert(box.hidden);messages.tick(100);
messages.setVisible(true);assert.equal(body.textContent,'Read this','Hidden dialogs do not consume reading time');messages.tick(8);
messages.notify('Departing island',{source:'claim',category:'error'});
messages.setMode('home-first-person');assert(box.hidden,'Leaving Endless clears context and scoped notices');
messages.context('training-door','Enter the training facility');messages.setMode('home-building');assert(box.hidden,'Changing camera mode clears old context');
messages.context('fence','Click to place',{title:'Plasma Fence'});messages.notify('Bad world import',{category:'error'});
messages.context('fence','');messages.tick(8);assert(box.hidden,'No stale fence instructions reappear');
messages.notify('Territory #3 settled',{source:'settlement',scope:'global',duration:10});messages.setMode('endless');assert.equal(body.textContent,'Territory #3 settled','Background settlement is relevant across worlds');messages.tick(10);assert(box.hidden);
messages.notify('Stale completion',{scope:'home-building'});assert(box.hidden,'Scoped async completions cannot bleed into another mode');
for(let i=0;i<20;i++)messages.notify('Burst '+i,{source:'source-'+i,category:'error',duration:1});
messages.tick(1);assert.equal(body.textContent,'Burst 1');for(let i=0;i<5;i++)messages.tick(1);assert(box.hidden,'Burst traffic has a bounded pending queue');
// The territory adapter emits a separate notice while its real context keeps changing.
const THREE=require('../vendor/three/three.r128.min.js'),territories=require('../assets/endless-territories');
(async()=>{
 const location={locationId:'3',enabled:true,occupant:'0',pendingChallengeId:'0',cooldownUntil:'0'},island={site:{id:'native',territoryId:'3'},root:new THREE.Group()};
 const player={x:0,z:0};let active=true,eligible=false,prompts=0;
 const controller=territories.create(THREE,{createEthereumLogo:require('../assets/battle-arena').createEthereumLogo,
 active:()=>active,player:()=>player,bodies:()=>[island],surface:()=>0,read:async()=>({snapshot:{timestamp:'100'},locations:[location],battleBros:[]}),
 status:text=>messages.context('territory',text),notify:text=>messages.notify(text,{source:'claim',category:'error'}),
 canPrompt:()=>true,canClaim:()=>eligible,promptClaim:()=>prompts++,claimBlockedMessage:()=> 'BRO #1 has an open Need.'});
 controller.refresh();await new Promise(setImmediate);controller.tick(0,.01);
 messages.context('cube','Deploying BattleBro',{priority:30});
 assert(!controller.requestClaim({x:4,z:0},'native'));assert.equal(body.textContent,'BRO #1 has an open Need.');
 messages.context('cube','');player.x=50;controller.tick(1,.1);messages.tick(8);assert(box.hidden,'Walking away during an error does not restore the old territory label');
 eligible=true;player.x=0;controller.tick(2,.1);assert(controller.requestClaim({x:4,z:0},'native'));assert.equal(prompts,1);
 active=false;controller.tick(3,.1);assert(box.hidden,'World exit removes territory context');
 // Production adapters share one box; passive banners and browser alerts are gone.
 const html=fs.readFileSync('index.html','utf8');
 assert.equal((html.match(/id="excavation-hud"/g)||[]).length,1);
 assert(!html.includes('id="territory-world-status"'));assert(!html.includes('id="territory-settlement-notice"'));assert(!html.includes('id="flight-mode-hint"'));assert(!/\balert\(/.test(html));
 const loop=html.slice(html.indexOf('  function animate(now, xrFrame) {'),html.indexOf('  // -------- resize --------'));
 assert(loop.indexOf('messages.setMode(')<loop.indexOf('tickTransportCube('));
 const mount={document:{getElementById:id=>({'excavation-hud':box,'fp-equipped-tool-label':title,'excavation-status':body}[id])}};
 vm.runInNewContext(fs.readFileSync('assets/game-messages.js','utf8'),mount);assert(mount.battleBrosMessages,'Browser script mounts the same reusable component');
 console.log('Game messages: context restoration, priority, burst handling, deduplication, DOM stability, mode cleanup, dialog suspension and cube/territory restrictions passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
