'use strict';
(async()=>{
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),events={},docEvents={};
let focused=false,locks=0,claims=0,refreshed=0,hydrated=0;
const menu={hidden:false,style:{}},elements=new Map();
const canvas={focus(){document.activeElement=this;},requestPointerLock(){locks++;document.pointerLockElement=this;}};
const document={hasFocus:()=>focused,hidden:false,activeElement:{blur(){}},addEventListener:(name,fn)=>docEvents[name]=fn,
 getElementById:id=>{if(!elements.has(id))elements.set(id,{hidden:false});return elements.get(id);}};
const context=vm.createContext({document,AbortController,renderer:{domElement:canvas},broEncounterMenu:menu,
 fp:{active:true},practiceBattle:{active:false},trainingAppearance:{active:false},fpToolMenu:{hidden:true},
 practiceSetup:{close(){},setBusy(){},retry:message=>assert.fail(message),open(){},active:false},
 endlessTerritories:{refresh(){refreshed++;}},window:{__battleBrosReadModel:{identity:{tokenId:1n}},
 addEventListener:(name,fn)=>events[name]=fn,battleBrosClaimTerritory:async()=>{claims++;},hydrateBattleBrosReadModel(){hydrated++;}}});
vm.runInContext("let territoryClaimLocation='3',practiceChallengeAbort=null;"+html.slice(html.indexOf('  let fpResumeCapture='),html.indexOf('  function paintCombatMeters(')),context);
vm.runInContext(html.slice(html.indexOf('  function chooseBroEncounter('),html.indexOf('  function exitPracticeBattle(')),context);
vm.runInContext(html.slice(html.indexOf('  async function submitTerritoryClaim('),html.indexOf('  const endlessTerritories=')),context);
await vm.runInContext('submitTerritoryClaim({defenseWeights:[10000,0,0]})',context);
assert.equal(claims,1);assert.equal(refreshed,1);assert.equal(hydrated,1);assert(menu.hidden);
assert.equal(locks,0,'Claim can complete while the wallet window still owns focus');
assert(vm.runInContext('fpResumeCapture',context),'Capture stays pending after successful claim');
focused=true;events.focus();assert.equal(locks,1,'Returning from the wallet retries capture without a movement key');
assert.equal(document.pointerLockElement,canvas);
events.focus();assert.equal(locks,1,'Repeated focus cannot request a second capture');
// Do not steal focus behind another dialog or while the game is hidden/inactive.
document.pointerLockElement=null;menu.hidden=false;
vm.runInContext('fpResumeCapture=true;fpResumeCaptureInFlight=false',context);events.focus();assert.equal(locks,1);
menu.hidden=true;document.hidden=true;docEvents.visibilitychange();assert.equal(locks,1);
document.hidden=false;docEvents.visibilitychange();assert.equal(locks,2,'Visible game resumes pending capture');
context.fp.active=false;document.pointerLockElement=null;events.focus();assert.equal(locks,2);
console.log('Claim pointer capture: asynchronous wallet completion, focus/visibility retry, dialog guards and inactive-mode cleanup passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
