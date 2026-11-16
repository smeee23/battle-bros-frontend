'use strict';
(async()=>{
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('  function syncDefenseWeightVisibility()'),end=html.indexOf('  window.__territoryDefenderAreas',start);
const section={hidden:true},address='0x'+'a'.repeat(40);let walletAddress=address;
const model=()=>({identity:{tokenId:1n,active:true,owner:address},territory:'9007199254740993'});
const ctx=vm.createContext({document:{getElementById:()=>section},window:{__battleBrosReadModel:model(),battleBrosWalletAddress:()=>walletAddress},
 territoryWorldState:{active:true,switching:false},explorationActive:false,trainingAppearance:{active:false},neighborInspectionState:{active:false},
 fp:{active:false},flight:{active:false},clearTimeout(){},saveTimer:0,getSerializableWorldState:()=>({}),applyState:(_s,opts)=>{assert(section.hidden,'Old defense stats hide before the next world paints');opts.onDone();return true;},
 toggleTerritoryWorld:async()=>{ctx.territoryWorldState.active=!ctx.territoryWorldState.active;return true;}});
vm.runInContext(html.slice(start,end),ctx);const sync=()=>ctx.window.syncDefenseWeightVisibility();
assert(section.hidden,'Unbound development worlds do not display a territory defense');
await ctx.window.battleBrosWorldBridge.open({kind:'territory',id:'9007199254740993'},{});assert(!section.hidden,'Opening the owned BRO’s defended territory shows defense');
const target=ctx.window.battleBrosWorldBridge.currentTarget();target.id='other';assert.equal(ctx.window.battleBrosWorldBridge.currentTarget().id,'9007199254740993','View identity is returned as a copy');
ctx.trainingAppearance.active=true;sync();assert(section.hidden,'Territory training hides defense');ctx.trainingAppearance.active=false;sync();assert(!section.hidden,'Returning outside restores the eligible panel');
ctx.territoryWorldState.active=false;sync();assert(section.hidden,'Home hides defense even when the selected BRO owns a territory');ctx.trainingAppearance.active=true;sync();assert(section.hidden,'Home training hides defense');ctx.trainingAppearance.active=false;ctx.territoryWorldState.active=true;
ctx.explorationActive=true;sync();assert(section.hidden,'Endless hides defense');ctx.explorationActive=false;sync();assert(!section.hidden);
ctx.territoryWorldState.switching=true;sync();assert(section.hidden);ctx.territoryWorldState.switching=false;
walletAddress=null;sync();assert(section.hidden,'Disconnect hides defense');walletAddress='0x'+'b'.repeat(40);sync();assert(section.hidden,'Another wallet does not see defender-only stats');walletAddress=address.toUpperCase();sync();assert(!section.hidden,'Owner comparison ignores address case');
ctx.window.__battleBrosReadModel.territory='9007199254740992';sync();assert(section.hidden,'Another defended territory cannot match by imprecise number conversion');
ctx.window.__battleBrosReadModel.territory=null;sync();assert(section.hidden,'A BRO with no territory hides defense');
ctx.window.__battleBrosReadModel=model();ctx.window.__battleBrosReadModel.identity.active=false;sync();assert(section.hidden);
ctx.window.__battleBrosReadModel=null;sync();assert(section.hidden,'Missing confirmed data hides defense');ctx.window.__battleBrosReadModel=model();
ctx.window.__battleBrosReadModel.pendingChallengeId='7';sync();assert(!section.hidden,'Pending challenges do not hide existing read-only stats');
await ctx.window.battleBrosWorldBridge.open({kind:'territory',id:'9'},{});assert(section.hidden,'Opening a different territory immediately hides stale stats');
await ctx.window.battleBrosWorldBridge.open({kind:'home',id:'1'},{});assert(section.hidden,'Opening Home hides defense');
assert(/id="battlebro-defense-section" open hidden/.test(html),'Defense is hidden before initialization');
console.log('Defense stats: owned and matching territory only, Home/Endless/facility hiding, wallet changes, large IDs, world transitions and no-data states passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
