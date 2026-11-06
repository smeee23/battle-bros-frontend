import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNeedsService,createNeedRegistry} from '../wallet/needs.mjs';
import {createWorldClient} from '../wallet/worlds.mjs';
import {contentHash} from '../../battle-bros-backend/packages/shared/src/world-save.mjs';
const owner='0x'+'1'.repeat(40),other='0x'+'2'.repeat(40),deployment='0x'+'a'.repeat(40);
function fixture(){
  let state={address:owner,status:'connected'},complete,submitted=0,refreshes=0;const records=[],listeners=[];
  const wallet={settings:{chainId:31337,deployment:{deploymentId:deployment,contracts:{combat:deployment}}},getState:()=>state,subscribe:fn=>{listeners.push(fn);fn(state);return()=>{};}};
  const transactions={list:()=>records,subscribe:fn=>{listeners.push(()=>fn(records));return()=>{};},submit:async action=>{submitted++;const r={...action,subject:action.subject,from:owner,phase:'pending',updatedAt:1};records.push(r);return r;}};
  const registry=createNeedRegistry();registry.register({type:'test-activity',version:'1',title:'Test',canStart:()=>true,start:ctx=>{complete=ctx.complete;},validateCompletion:outcome=>outcome===42});
  const make=()=>createNeedsService({wallet,transactions,registry,refresh:async()=>{refreshes++;}});
  const document={chainId:'31337',deploymentId:deployment,contracts:{combat:deployment},needs:{seeds:[]},battleBros:[1,2,3].map(n=>({tokenId:String(n),owner:n===3?other:owner,active:true,need:{active:true,sourceEpoch:'2',activeSinceTimestamp:'100',activity:{id:'need-'+n,type:'test-activity',version:'1'}}}))};
  return {make,document,records,wallet,transactions,get complete(){return complete;},get submitted(){return submitted;},get refreshes(){return refreshes;},switchOwner(){state={...state,address:other};for(const fn of listeners)fn(state);}};
}
test('multiple owned Needs, reload detection, activity lifecycle and duplicate prevention',async()=>{
  const f=fixture(),s=f.make();s.update(f.document);assert.equal(s.list().length,2);assert.equal(s.list()[0].status,'awaiting-activity');
  await assert.rejects(s.complete('need-1'),/Finish/);await s.start('need-1');assert.equal(s.list()[0].status,'in-progress');
  assert.throws(()=>f.complete(1),/conditions/);f.complete(42);assert.equal(s.list()[0].status,'ready');
  const r=await s.complete('need-1');assert.equal(r.functionName,'care');assert.equal(r.args[0],1n);assert.equal(s.list()[0].status,'pending');
  await assert.rejects(s.complete('need-1'),/tracked/);assert.equal(f.submitted,1);
  const reloaded=f.make();reloaded.update(f.document);assert.equal(reloaded.list()[0].status,'pending');
  r.phase='confirmed';r.result={type:'bro-care',tokenId:'1',sourceEpoch:'2'};assert.equal(s.list()[0].status,'completed-syncing');
  await assert.rejects(s.complete('need-1'),/tracked/);
  const fresh=structuredClone(f.document);fresh.battleBros[0].need.active=false;s.update(fresh);assert.equal(s.list().length,1);
  fresh.battleBros[0].need.active=true;fresh.battleBros[0].need.activity.id='new-need';s.update(fresh);assert.equal(s.list()[0].status,'awaiting-activity');
});
test('rejection/failure preserve local completion, wallet changes invalidate callbacks, unknown types remain visible',async()=>{
  const f=fixture(),s=f.make();s.update(f.document);await s.start('need-1');f.complete(42);const r=await s.complete('need-1');
  r.phase='rejected';assert.equal(s.list()[0].status,'rejected');assert.equal(s.list()[0].ready,true);
  r.phase='failed';assert.equal(s.list()[0].status,'failed');
  await s.start('need-2');const old=f.complete;f.switchOwner();old(42);assert.equal(s.list().length,1);assert.equal(s.list()[0].ready,false);
  const unknown=structuredClone(f.document);unknown.battleBros[2].need.activity.type='future';s.update(unknown);assert.equal(s.list()[0].available,false);await assert.rejects(s.start('need-3'),/not available/);
});
test('world drafts are scoped by NFT and wallet, challenge content is checked before signing',async()=>{
  const f=fixture(),saved=new Map(),world={v:4,gridSize:50,environment:'EARTH',seed:'a',cells:[]},target={kind:'home',id:'1'};
  let signatures=0;f.wallet.session=async()=>({address:owner,assertCurrent:async()=>{},provider:{request:async()=>{signatures++;return '0x123';}}});
  const client=createWorldClient({wallet:f.wallet,apiUrl:'https://api.example/',origin:'https://game.example',storage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},fetcher:async()=>({ok:true,json:async()=>({chainId:'31337',deploymentId:deployment,origin:'https://other.example',target,revision:'0',contentHash:contentHash(world),expiresAt:'9999999999'})})});
  client.draft(target,world,'0');assert.deepEqual(client.local(target).world,world);assert.equal(client.local({kind:'home',id:'2'}),null);
  await assert.rejects(client.save(target,world,'0'),/does not match/);assert.equal(signatures,0);f.switchOwner();assert.equal(client.local(target),null);
});
