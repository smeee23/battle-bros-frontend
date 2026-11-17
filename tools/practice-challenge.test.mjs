import {test} from 'node:test';import assert from 'node:assert/strict';
import {encodeAbiParameters,encodeEventTopics} from 'viem';
import {createPracticeChallenge} from '../wallet/practice-challenge.mjs';import {contractAbis} from '../wallet/contract-abis.mjs';
const address='0x'+'1'.repeat(40);
const event=contractAbis.combat.find(e=>e.name==='ChallengeAccepted');
function value(p){if(p.type==='tuple')return Object.fromEntries(p.components.map(c=>[c.name,value(c)]));if(p.type.endsWith('[3]'))return [0,0,0];if(p.type==='address')return address;return 0n;}
function fixture(final=2){let tick=0,submitted;const status=[];
 const snapshot=value(event.inputs.find(p=>p.name==='snapshot'));
 const receipt={logs:[{address,topics:encodeEventTopics({abi:contractAbis.combat,eventName:'ChallengeAccepted',args:{challenge:9n,location:2n,attacker:1n}}),data:encodeAbiParameters(event.inputs.filter(p=>!p.indexed),[snapshot])}]};
 const transactions={submit:async a=>(submitted=a,{id:'tx'}),poll:async()=>{},list:()=>[{id:'tx',hash:'0x1',phase:'confirmed'}],client:{readContract:async a=>a.functionName==='locations'?contractAbis.combat.find(f=>f.name==='locations').outputs.map(f=>({occupant:3n,pending:0n,nonce:7n}[f.name]??0n)):a.functionName==='broState'?{defenseNonce:4n}:{status:tick?final:1,attacker:1n,location:2n},getBlock:async()=>({timestamp:1000n}),getBlockNumber:async()=>100n,getTransactionReceipt:async()=>receipt}};
 const run=createPracticeChallenge({transactions,wallet:{settings:{}},settings:{confirmations:2,deployment:{contracts:{combat:address,bros:address}}},wait:async()=>{tick++;}});
 return {run,status,get submitted(){return submitted;}};
}
test('challenges location 2 and waits for settlement, not just inclusion',async()=>{const f=fixture();const result=await f.run({tokenId:'1',choices:{action:2,power:25,defenseWeights:[2000,3000,5000]},onStatus:s=>f.status.push(s)});assert.equal(result.challengeId,'9');assert.deepEqual(f.submitted.args,[2n,1n,2,25,7n,4n,1300n,[2000,3000,5000]]);assert(f.status.some(s=>s.includes('VRF')));});
test('expiry does not start practice',async()=>{const f=fixture(3);await assert.rejects(f.run({tokenId:'1',choices:{action:0,power:10,defenseWeights:[10000,0,0]}}),/expired/);});
test('aborted preparation never submits',async()=>{const f=fixture(),c=new AbortController();c.abort();await assert.rejects(f.run({tokenId:'1',signal:c.signal}),/closed/);assert.equal(f.submitted,undefined);});
