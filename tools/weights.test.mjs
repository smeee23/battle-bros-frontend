import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWeightsService} from '../wallet/weights.mjs';
const address='0x'+'1'.repeat(40),deployment='0x'+'2'.repeat(40);
function setup(){
 let selected='1',state={address,chainId:31337},rejected=false;
 const bro={tokenId:'1',active:true,owner:address,hatchedAt:'1',need:{active:false},pendingChallengeId:'0'};
 const actions=[],wallet={settings:{chainId:31337,deployment:{deploymentId:deployment}},getState:()=>state};
 const service=createWeightsService({wallet,transactions:{list:()=>[],submit:async action=>{if(rejected&&action.args[2])throw Error('declined');actions.push(action);return {phase:'pending'};}},selected:()=>selected,publication:()=>({battleBros:[bro]})});
 const request={tokenId:'1',scope:{chainId:'31337',deploymentId:deployment},groups:['training','defense'],values:{training:{attack:'3334',defend:'3333',counter:'3333'},defense:{attack:'5000',defend:'2500',counter:'2500'}}};
 return {service,request,actions,bro,set state(v){state=v;},set selected(v){selected=v;},set rejected(v){rejected=v;}};
}
test('weight saves encode separate training/defense transactions with exact basis points',async()=>{
 const f=setup();await f.service.save(f.request);assert.equal(f.actions.length,2);
 assert.deepEqual(f.actions[0].args,[1n,[3334n,3333n,3333n],false]);assert.deepEqual(f.actions[1].args,[1n,[5000n,2500n,2500n],true]);
 assert.equal(f.actions[0].functionName,'setWeights');assert.equal(f.actions[0].contract,'bros');assert.notEqual(f.actions[0].conflictKey,f.actions[1].conflictKey);
 assert.deepEqual(f.actions[1].subject.weights,['5000','2500','2500']);
});
test('changed groups only; partial submissions remain tracked when the next approval is declined',async()=>{
 const f=setup();f.request.groups=['defense'];await f.service.save(f.request);assert.equal(f.actions.length,1);assert.equal(f.actions[0].args[2],true);
 const partial=setup();partial.rejected=true;await assert.rejects(partial.service.save(partial.request),/declined/);assert.equal(partial.actions.length,1);
});
test('ownership, wallet/network changes, Needs, pending challenges and totals block invalid saves',async()=>{
 for(const change of [f=>f.selected='2',f=>f.state={address,chainId:1},f=>f.bro.owner=deployment,f=>f.bro.need.active=true,f=>f.bro.hatchedAt='0',f=>f.bro.pendingChallengeId='9',f=>f.request.values.training.attack='3335',f=>f.request.values.defense.attack='5001']){
  const f=setup();change(f);await assert.rejects(f.service.save(f.request));assert.equal(f.actions.length,0);
 }
});

test('eligibility keeps occupant defense locked between challenges and explains common blockers',async()=>{
 const f=setup();f.bro.locationId='2';let allowed=f.service.eligibility('1',f.request.scope);
 assert.equal(allowed.training,'');assert.match(allowed.defense,/locked/);
 await assert.rejects(f.service.save(f.request),/locked/);assert.equal(f.actions.length,0);
 f.request.groups=['training'];await f.service.save(f.request);assert.equal(f.actions.length,1);
 f.bro.need.active=true;allowed=f.service.eligibility('1',f.request.scope);assert.match(allowed.training,/Need/);assert.equal(allowed.training,allowed.defense);
 f.bro.need.active=false;f.state={address,chainId:1};assert.match(f.service.eligibility('1').training,/network/);
 f.state={address:null,chainId:31337};assert.match(f.service.eligibility('1').training,/Connect/);
});
