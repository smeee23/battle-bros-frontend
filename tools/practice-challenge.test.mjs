import {test} from 'node:test';import assert from 'node:assert/strict';
import {encodeAbiParameters,encodeEventTopics} from 'viem';
import {createPracticeChallenge} from '../wallet/practice-challenge.mjs';import {contractAbis} from '../wallet/contract-abis.mjs';
const address='0x'+'1'.repeat(40);
const event=contractAbis.combat.find(e=>e.name==='ChallengeAccepted');
function value(p){if(p.type==='tuple')return Object.fromEntries(p.components.map(c=>[c.name,value(c)]));if(p.type.endsWith('[3]'))return [0,0,0];if(p.type==='address')return address;return 0n;}
function fixture(final=2,locationId=2n){let tick=0,submitted;const status=[];
 const snapshot=value(event.inputs.find(p=>p.name==='snapshot'));
 const receipt={blockNumber:10n,logs:[{address,topics:encodeEventTopics({abi:contractAbis.combat,eventName:'ChallengeAccepted',args:{challenge:9n,location:locationId,attacker:1n}}),data:encodeAbiParameters(event.inputs.filter(p=>!p.indexed),[snapshot])}]};
 const transactions={submit:async a=>(submitted=a,{id:'tx'}),poll:async()=>{},list:()=>[{id:'tx',hash:'0x1',phase:'confirmed'}],client:{readContract:async a=>a.functionName==='locations'?contractAbis.combat.find(f=>f.name==='locations').outputs.map(f=>({occupant:3n,pending:0n,nonce:7n}[f.name]??0n)):a.functionName==='broState'?{defenseNonce:4n}:{status:tick?final:1,attacker:1n,location:locationId},getBlock:async()=>({timestamp:1000n}),getBlockNumber:async()=>100n,getContractEvents:async()=>[{args:{challenge:9n,winner:1n}}],getTransactionReceipt:async()=>receipt}};
 const run=createPracticeChallenge({transactions,wallet:{settings:{}},settings:{confirmations:2,deployment:{contracts:{combat:address,bros:address}}},wait:async()=>{tick++;}});
 return {run,status,transactions,get submitted(){return submitted;}};
}
test('challenges location 2 and waits for settlement, not just inclusion',async()=>{const f=fixture();const result=await f.run({locationId:'2',tokenId:'1',choices:{action:2,power:25,defenseWeights:[2000,3000,5000]},onStatus:s=>f.status.push(s)});assert.equal(result.challengeId,'9');assert.deepEqual(f.submitted.args,[2n,1n,2,25,7n,4n,1300n,[2000,3000,5000]]);assert(f.status.some(s=>s.includes('VRF')));});
test('expiry does not start practice',async()=>{const f=fixture(3);await assert.rejects(f.run({locationId:'2',tokenId:'1',choices:{action:0,power:10,defenseWeights:[10000,0,0]}}),/expired/);});
test('aborted preparation never submits',async()=>{const f=fixture(),c=new AbortController();c.abort();await assert.rejects(f.run({locationId:'2',tokenId:'1',signal:c.signal}),/closed/);assert.equal(f.submitted,undefined);});

test('uses the encountered territory and returns the onchain winner',async()=>{const f=fixture(2,4n);const result=await f.run({locationId:'4',tokenId:'1',expectedDefender:'3',choices:{action:0,power:10,defenseWeights:[10000,0,0]}});assert.equal(f.submitted.args[0],4n);assert.equal(result.locationId,'4');assert.equal(result.playerWon,true);});
test('does not battle a replacement defender using a stale NPC',async()=>{const f=fixture();await assert.rejects(f.run({locationId:'2',tokenId:'1',expectedDefender:'7'}),/defender changed/);assert.equal(f.submitted,undefined);});

import {createTerritoryClaim} from '../wallet/territory-claim.mjs';
test('claims the chosen vacant territory with its live nonce and defense weights',async()=>{
 let action;const settings={deployment:{contracts:{combat:address}}},transactions={client:{readContract:async()=>({occupant:0n,enabled:true,nonce:13n})},submit:async a=>(action=a,{id:'c'}),poll:async()=>{},list:()=>[{id:'c',phase:'confirmed'}]};
 await createTerritoryClaim({transactions,settings})({locationId:'4',tokenId:'8',defenseWeights:[2000,6000,2000]});assert.deepEqual(action.args,[4n,8n,13n,[2000,6000,2000]]);
 transactions.client.readContract=async()=>({occupant:3n,enabled:true,nonce:14n});await assert.rejects(createTerritoryClaim({transactions,settings})({locationId:'4',tokenId:'8',defenseWeights:[10000,0,0]}),/no longer claimable/);
});

test('acceptance arrives before settlement and closing the view does not cancel tracking',async()=>{
 const f=fixture(),controller=new AbortController();let accepted=false;
 const result=await f.run({locationId:'2',tokenId:'1',choices:{action:0,power:10,defenseWeights:[10000,0,0]},signal:controller.signal,onAccepted:r=>{accepted=true;assert.equal(r.challengeId,'9');controller.abort();}});
 assert(accepted);assert.equal(result.playerWon,true);
});
test('resume does not submit another transaction',async()=>{
 const f=fixture();const result=await f.run({locationId:'2',tokenId:'1',resume:{challengeId:'9',acceptedBlock:'10',transactionHash:'0x1',transactionRecordId:'tx'}});assert.equal(f.submitted,undefined);assert.equal(result.playerWon,true);
});

test('transient settlement RPC errors retry without another transaction or acceptance',async()=>{
 const f=fixture(),read=f.transactions.client.readContract;let fail=true,accepted=0;
 f.transactions.client.readContract=async args=>{if(args.functionName==='challengeState'&&fail){fail=false;throw Error('temporary RPC outage');}return read(args);};
 const result=await f.run({locationId:'2',tokenId:'1',choices:{action:0,power:10,defenseWeights:[10000,0,0]},onAccepted:()=>accepted++,onStatus:s=>f.status.push(s)});
 assert.equal(result.playerWon,true);assert.equal(accepted,1);assert(f.status.some(s=>s.includes('Reconnecting')));
});
