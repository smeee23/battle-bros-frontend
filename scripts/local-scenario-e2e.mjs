import assert from 'node:assert/strict';
import {startLocalDev} from './local-dev.mjs';
import {walletSettings} from '../wallet/config.mjs';
import {createTransactionService} from '../wallet/transactions.mjs';
import {createNeedsService} from '../wallet/needs.mjs';
const player='0x0000000000000000000000000000000000001234';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){const deadline=Date.now()+45000;while(Date.now()<deadline){if(await check())return;await delay(200);}throw Error('Timed out: '+label);}
let stack,transactions,needs;
try {
  stack=await startLocalDev({rpcPort:0,frontendPort:0,playerAddress:player,rememberPlayer:false});
  const manifestUrl=new URL(stack.runtime.manifestUrl,stack.origin).href;
  async function publication(){const manifest=await (await fetch(manifestUrl)).json();return (await fetch(new URL(manifest.paths.gameState,manifestUrl))).json();}
  const doc=await publication(),bro=id=>doc.battleBros.find(b=>b.tokenId===String(id));
  assert.equal(doc.battleBros.length,8);
  for(const id of [1,2,3,4,5,6])assert.equal(bro(id).owner.toLowerCase(),player.toLowerCase());
  for(const id of [1,2]){assert.equal(bro(id).need.active,true);assert.equal(bro(id).need.activity.type,'care');}
  for(const id of [3,4]){assert.equal(bro(id).level,'2');assert(BigInt(bro(id).xp)>=250n);assert.equal(bro(id).need.active,false);}
  assert.equal(bro(3).locationId,'2');assert.equal(bro(4).locationId,null);
  for(const id of [5,6]){assert.equal(bro(id).hatchedAt,'0');assert.equal(bro(id).need.active,false);}
  assert.equal(doc.challenges.filter(c=>c.status==='RESOLVED').length,32);
  assert(doc.history.some(e=>e.name==='CareProvided'));
  for(const id of ['3','4'])assert.equal(doc.locations.find(l=>l.locationId===id).occupant,'0');
  // Drive the same Needs and transaction services used by the browser, using a funded
  // arbitrary player address; startup impersonation must already have been stopped.
  await assert.rejects(stack.provider.send('eth_sendTransaction',[{from:player,to:player,value:'0x0'}]));
  await stack.provider.send('hardhat_impersonateAccount',[player]);
  const settings=walletSettings(stack.runtime,'127.0.0.1');
  const wallet={settings,getState:()=>({address:player,chainId:31337,status:'connected'}),subscribe:fn=>{fn(wallet.getState());return()=>{};},session:async()=>({address:player,assertCurrent:async()=>{},provider:{request:({method,params=[]})=>stack.provider.send(method,params)}})};
  transactions=createTransactionService({wallet,settings,manifestUrl});
  needs=createNeedsService({wallet,transactions,refresh:async()=>needs.update(await publication())});needs.update(doc);
  assert.equal(needs.list().length,2);
  const assignment=needs.list().find(n=>n.bro.tokenId==='1').assignment.id;
  await needs.start(assignment);assert.equal(needs.list().find(n=>n.assignment.id===assignment).status,'ready');
  const care=await needs.complete(assignment);
  await until(async()=>{await transactions.poll();return transactions.list().find(r=>r.id===care.id).phase==='reflected';},'care confirmation and publication');
  needs.update(await publication());assert.deepEqual(needs.list().map(n=>n.bro.tokenId),['2']);
  const fresh=await publication(),location=fresh.locations.find(l=>l.locationId==='3');
  const claim=await transactions.submit({contract:'combat',functionName:'claim',args:[3n,4n,BigInt(location.nonce),[10000,0,0]],conflictKey:'claim:4'});
  await until(async()=>{await transactions.poll();return transactions.list().find(r=>r.id===claim.id).phase==='reflected';},'claim confirmation and publication');
  const after=await publication();assert.equal(after.battleBros.find(b=>b.tokenId==='4').locationId,'3');
  console.log('PASS: eight-BRO scenario → real battles/levels/care/territories → owned Needs review and care transaction → open territory claim → confirmed publications.');
} finally {needs?.destroy();transactions?.stop();await stack?.stop();}
