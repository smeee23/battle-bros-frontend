'use strict';
const assert=require('node:assert/strict'),api=require('../assets/endless-territories'),THREE=require('../vendor/three/three.r128.min.js');
// The adapter creates its shared logo during inline app startup, before deferred scripts run.
const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const arenaScript=html.match(/<script\b[^>]*\bsrc=["']assets\/battle-arena\.js["'][^>]*>/);
assert(arenaScript&&!/\b(?:defer|async)\b|type=["']module["']/.test(arenaScript[0]),'Logo factory must load synchronously before app startup');
assert(arenaScript.index<html.indexOf('const endlessTerritories='),'Logo factory loads before territory initialization');
const loc={locationId:'1',enabled:true,pendingChallengeId:'0',occupant:'0',cooldownUntil:'0',departing:false,minLevel:'1',maxLevel:'4'};
assert.equal(api.state(loc,'10'),'claimable');assert.equal(api.state({...loc,occupant:'3'},'10'),'ready');assert.equal(api.state({...loc,occupant:'3',cooldownUntil:'20'},'10'),'cooldown');assert.equal(api.state({...loc,pendingChallengeId:'7'},'10'),'pending');assert.equal(api.state(null,'10'),'locked');
const bro={tokenId:'1',active:true,hatchedAt:'1',level:'2',locationId:null,pendingChallengeId:null,need:{active:false}};
const defender={...bro,tokenId:'3',locationId:'2'};
const attack={...loc,locationId:'2',occupant:'3'};
const claim={...loc,locationId:'9007199254740993'};
const blocked={...loc,locationId:'9007199254740992',minLevel:'5',maxLevel:'0'};
const battlePending={...attack,pendingChallengeId:'17'};
assert.equal(api.availability(blocked,'10',bro).reason,'Requires level 5 or higher');
assert.equal(api.availability(battlePending,'10',bro,defender).reason,'Battle pending');
assert.equal(api.availability({...loc,reclaimBlockedTokenId:'1'},'10',bro).kind,'unavailable');
assert.equal(api.availability(attack,'10',bro,{...defender,pendingChallengeId:'17'}).kind,'unavailable');
assert.equal(api.availability(loc,'10',{...bro,need:{active:true}}).reason,'Your BRO needs care at Home');
const docForPlacement={snapshot:{timestamp:'10'},battleBros:[bro,defender],locations:[attack,blocked,loc,claim]};
const layout=api.createLayout({exists:(sx,sz)=>(sx+sz)%2===0,random:()=>.99});
assert.equal(layout.get('1'),undefined);
const first=layout.populate(layout.slots(0,0),2,docForPlacement,'1');
assert.deepEqual(first.map(p=>p.id),[claim.locationId,'1'],'Overflow samples the claim list before using attacks');
assert.deepEqual(layout.populate(layout.slots(0,0),4,docForPlacement,'1'),[],'A loaded area stops at two territories');
const next=layout.populate(layout.slots(8,8),4,docForPlacement,'1');
assert.deepEqual(next.map(p=>p.id),['2',blocked.locationId],'Attack comes before unavailable and remaining slots stay empty');
const all=[...first,...next];
assert.equal(new Set(all.map(p=>p.sx+','+p.sz)).size,4);
for(const p of all){
 assert((p.sx+p.sz)%2===0,'Use only eligible native islands');
 assert.equal(layout.binding(p.sx,p.sz,0),p);
 assert.equal(layout.binding(p.sx,p.sz,1),undefined);
}
assert.deepEqual(layout.populate(layout.slots(12,12),4,docForPlacement,'1'),[],'Exploration cannot reuse an assigned ID');
assert.equal(layout.assign('2',layout.slots(12,12)[0]),next[0],'Lookup finds the original assignment');
const noOptions=api.createLayout({exists:()=>true});
const overlapping=api.createLayout({exists:()=>true});
assert(overlapping.assign('1',{sx:0,sz:0}));
assert.equal(overlapping.assign('2',{sx:1,sz:1}),null,'Adjacent sectors remain scenery');
assert(overlapping.assign('2',{sx:4,sz:0}));
assert.equal(overlapping.assign('3',{sx:2,sz:2}),null,'An overlapping render window cannot expose a third territory');
assert(overlapping.assign('3',{sx:2,sz:5}),'A new neighborhood can have another territory');
assert.deepEqual(noOptions.populate(noOptions.slots(0,0),3,{...docForPlacement,locations:[blocked]},'1').map(p=>p.id),[blocked.locationId]);
(async()=>{
 const scene=new THREE.Group(),body={site:{id:'island-1',territoryId:'1'},root:new THREE.Group()};scene.add(body.root);
 let doc={snapshot:{timestamp:'100'},locations:[{...loc}],battleBros:[{...bro}]},active=true,failRead=false,bodies=[body],spawned=0,removed=0,prompts=0,label='',canPrompt=true,canClaim=true,notice='';
 let selectedToken=bro.tokenId;
 const controller=api.create(THREE,{selectedToken:()=>selectedToken,ownsSelected:()=>canClaim,createEthereumLogo:require('../assets/battle-arena').createEthereumLogo,active:()=>active,player:()=>({x:0,z:0}),bodies:()=>bodies,read:async()=>{if(failRead)throw Error('offline');return doc;},surface:()=>1,canPrompt:()=>canPrompt,notify:text=>notice=text,promptClaim:()=>prompts++,status:t=>label=t,
 spawn:(b,bro)=>{spawned++;const root=new THREE.Group();scene.add(root);return {root};},removeActor:(id,a)=>{removed++;a.root.parent?.remove(a.root);}});
 controller.tick(0,.01);await new Promise(setImmediate);controller.tick(1,.01);
 let marker=body.root.children[0];assert.equal(marker.userData.state,'claimable');assert.equal(prompts,0,'Walking near a logo never opens a claim prompt');assert(label.includes('Claimable'));
 assert(!controller.requestClaim({x:0,z:0},'other-island'),'Cube must land on the territory island');
 assert(!controller.requestClaim({x:7,z:0},'island-1'),'Cube must land near the logo');
 canPrompt=false;assert(!controller.requestClaim({x:4,z:0},'island-1'),'Other menus block claim prompts');canPrompt=true;
 canClaim=false;assert(!controller.requestClaim({x:4,z:0},'island-1'),'An ineligible BRO cannot open a claim prompt');
 assert(notice.includes('Connect the wallet'));controller.tick(1,.01);assert(label.includes('Claimable'),'Context continues updating independently of the notification');canClaim=true;
 assert(controller.requestClaim({x:4,z:0},'island-1'));assert.equal(prompts,1,'Cube deployment opens the claim prompt');
 const logo=marker.getObjectByName('ethereumMonument');
 assert(logo.getObjectByName('ethereumUpper')&&logo.getObjectByName('ethereumLower'),'Uses the central world logo facets');
 function assertHue(root,hue){
  for(const name of ['ethereumUpper','ethereumLower']){
   const colors=root.getObjectByName(name).geometry.getAttribute('color');
   for(let i=0;i<colors.count;i++){const hsl=new THREE.Color().fromBufferAttribute(colors,i).getHSL({});assert(Math.abs(hsl.h-hue)<1e-6,'Both logo sections use the territory status hue');}
  }
 }
 assertHue(logo,1/3);
 assert.equal(controller.minimapMarker('1').fill,0x55ee88,'Claimable dots match the green logo');
 const hover=logo.position.y,turn=logo.rotation.y;
 controller.tick(1.5,.01);
 assert.notEqual(logo.position.y,hover,'Logo bobs with world time');assert.notEqual(logo.rotation.y,turn,'Logo turns with world time');
 const bounds=new THREE.Box3().setFromObject(logo);assert(bounds.min.y>.5,'Entire logo floats above the territory');
 assert(Math.abs(bounds.max.y-bounds.min.y-5.075)<1e-6,'Territory logo is scaled to about five units tall');
 controller.tick(1.5,0);assert.equal(logo.rotation.y,1.5*.12,'Repeated paused time does not advance rotation');
 doc.locations[0]={...loc,occupant:'3'};doc.battleBros=[{...bro},{...bro,tokenId:'3',locationId:'1'}];controller.accept(doc);controller.tick(2,.01);assert.equal(marker.userData.state,'ready');assert.equal(spawned,1);assert(!controller.requestClaim({x:4,z:0},'island-1'),'Occupied territory cannot be claimed');
 assert.equal(controller.minimapMarker('1').fill,0x86edff,'Attackable dots match the cyan logo');
 const centralLogo=require('../assets/battle-arena').createEthereumLogo(THREE);
 for(const name of ['ethereumUpper','ethereumLower'])assert.deepEqual(logo.getObjectByName(name).geometry.getAttribute('color').array,centralLogo.getObjectByName(name).geometry.getAttribute('color').array,'Attackable retains the original cyan facets');
 const otherBody={site:{territoryId:'2'},root:new THREE.Group()};otherBody.root.position.x=100;scene.add(otherBody.root);bodies.push(otherBody);doc.locations.push({...loc,locationId:'2'});controller.accept(doc);controller.tick(2.5,.01);
 const otherLogo=otherBody.root.getObjectByName('ethereumMonument');assertHue(otherLogo,1/3);
 const greenGeometry=otherLogo.getObjectByName('ethereumUpper').geometry;
 doc.locations[0].cooldownUntil='200';controller.tick(3,.01);assert.equal(marker.userData.state,'cooldown');assertHue(logo,0);assertHue(otherLogo,1/3);assert.equal(otherLogo.getObjectByName('ethereumUpper').geometry,greenGeometry,'Other territories keep their cached palette');
 doc.locations[0].pendingChallengeId='9';controller.tick(4,.01);assert.equal(marker.userData.state,'pending');assertHue(logo,0);assert.equal(prompts,1);
 assert.equal(controller.minimapMarker('1').fill,0xff5555,'Pending dots match the red logo');
 selectedToken='3';
 assert.deepEqual(controller.minimapMarker('1'),{fill:0x252733,outline:0xd7dcf2},'Owned dots keep the charcoal logo and silver outline even when pending');
 selectedToken=bro.tokenId;
 doc.locations[0]={...loc};controller.accept(doc);controller.tick(5,.01);assertHue(logo,1/3);assert.equal(removed,1);assert.equal(prompts,1,'Standing near a newly empty territory does not open a prompt');
 bodies=[];controller.tick(6,.01);assert.equal(body.root.children.length,0,'Streamed logo cleanup');
 bodies=[body];controller.tick(7,.01);assert.equal(body.root.children.length,1,'Logo recreated on restream');
 failRead=true;await controller.refresh();controller.tick(8,.01);
 assert.equal(body.root.children.length,0,'Publication failure hides the logo and ring');
 assert.match(label,/data is unavailable/);
 controller.accept({...doc,locations:[]});controller.tick(9,.01);
 assert.equal(body.root.children.length,0);assert.match(label,/No confirmed territories/);
 active=false;controller.tick(10,.01);assert.equal(label,'');
 const auditBody={site:{territoryId:'1'},root:new THREE.Group()};let auditSpawns=0,auditRemoved=0;
 const auditBro={...bro,tokenId:'7',locationId:'1',active:false};
 const auditDoc={snapshot:{timestamp:'100'},locations:[{...loc,occupant:'7'}],battleBros:[auditBro]};
 const audit=api.create(THREE,{createEthereumLogo:require('../assets/battle-arena').createEthereumLogo,active:()=>true,player:()=>({x:0,z:0}),bodies:()=>[auditBody],read:async()=>auditDoc,surface:()=>1,canPrompt:()=>false,
  spawn:()=>{auditSpawns++;const root=new THREE.Group();auditBody.root.add(root);return {root};},removeActor:(_key,actor)=>{auditRemoved++;actor.root.parent?.remove(actor.root);}});
 audit.refresh();await new Promise(setImmediate);audit.tick(1,.01);assert.equal(auditSpawns,0,'Inactive NFTs never spawn');
 auditBro.active=true;auditBro.locationId='2';audit.tick(2,.01);assert.equal(auditSpawns,0,'A BRO assigned elsewhere cannot spawn at this location');
 auditBro.locationId='1';audit.tick(3,.01);assert.equal(auditSpawns,1,'A matching active NFT spawns as the confirmed defender');
 auditDoc.locations[0].occupant='0';audit.tick(4,.01);assert.equal(auditRemoved,1,'An emptied territory loses its defender');
 console.log('Territory islands: confirmed states, eligibility, occupancy changes, bounded spawning, explicit cube claims and streaming cleanup passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
