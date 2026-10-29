// Uses the same transaction service as the browser, against a fresh real local stack.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {startLocalDev} from './local-dev.mjs';
import {walletSettings} from '../wallet/config.mjs';
import {createTransactionService} from '../wallet/transactions.mjs';
const require=createRequire(import.meta.url),THREE=require('../vendor/three/three.r128.min.js');
const unhatched=require('../assets/unhatched-home.js'),transport=require('../assets/transport-cube.js');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label,timeout=35000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await delay(200);}throw Error('Timed out: '+label);}
let stack,service;
try {
  stack=await startLocalDev({rpcPort:0,frontendPort:0});
  const settings=walletSettings(stack.runtime,'127.0.0.1'),manifestUrl=new URL(stack.runtime.manifestUrl,stack.origin).href;
  await until(async()=>{try{return (await fetch(manifestUrl)).ok;}catch{return false;}},'initial publication');
  const accounts=await stack.provider.send('eth_accounts',[]),account=accounts[1];
  const funded=await fetch(stack.origin+'/api/local-dev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:'fund',address:account})});
  assert.equal(funded.status,200);assert.equal(await stack.provider.getBalance(account),100n*10n**18n);
  const saved=new Map(),storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
  let connected=true,submissions=0;
  const wallet={settings,session:async()=>{
    assert(connected,'Tracking must not depend on a connected wallet');
    return {address:account,assertCurrent:async()=>assert(connected),provider:{request:async({method,params=[]})=>{
      if(method==='eth_sendTransaction')submissions++;
      return stack.provider.send(method,params);
    }}};
  }};
  const make=()=>createTransactionService({wallet,settings,storage,manifestUrl});
  service=make();
  await assert.rejects(service.submit({contract:'bros',functionName:'mintWithETH',value:0n}),/InvalidAmount|rejected/);
  assert.equal(submissions,0,'A real simulation revert never opens transaction submission');
  await stack.control('pausePublisher');
  const first=await service.submit({contract:'bros',functionName:'mintWithETH',value:10n**18n,label:'Local mint'});
  await until(async()=>{await service.poll();return service.list().find(r=>r.id===first.id).phase==='confirmed';},'mint confirmation');
  assert.equal(service.list().find(r=>r.id===first.id).result.tokenId,'1');
  service.stop();connected=false;service=make();
  await service.poll();assert.equal(service.list().find(r=>r.id===first.id).phase,'confirmed','Publication is still paused');
  await stack.control('resumePublisher');
  await until(async()=>{await service.poll();return service.list().find(r=>r.id===first.id).phase==='reflected';},'indexed and published mint');

  // Execute the actual Home publication reader, then its actual cube controller.
  class Element {constructor(){this.children=[];this.textContent='';this.value='';this.hidden=false;}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}addEventListener(){}focus(){}}
  const nodes=new Map(),element=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  const group=new THREE.Group(),controller=unhatched.create(THREE,{group,makeCube:()=>transport.createModel(THREE,(...args)=>new THREE.BoxGeometry(...args)),
    isHome:()=>true,center:()=>({x:0,z:0,cellX:24.5,cellZ:24.5}),ground:()=>0,onModeChange(){}});
  const context=vm.createContext({URL,URLSearchParams,console,fetch,
    document:{getElementById:element,createElement:()=>new Element()},location:{href:stack.origin+'/index.html?battleBroId=1',hostname:'127.0.0.1',protocol:'http:',search:'?battleBroId=1'},
    window:{__battleBrosPublicData:{...stack.runtime,manifestUrl},updateUnhatchedHome:(model,scope)=>controller.update(model,scope)}});
  const html=await (await fetch(stack.origin+'/')).text();
  vm.runInContext(html.slice(html.indexOf('  const BATTLEBRO_FRONTEND_EMPTY'),html.indexOf('  const resources = {')),context);
  assert(await context.hydrateBattleBrosReadModel());
  assert.equal(context.window.__battleBrosReadModel.identity.hatched,false);
  assert(controller.active&&controller.cube.visible&&!controller.previewing,'Real published unhatched record activates Home without a preview override');
  assert.equal(context.window.__battleBrosReadModel.identity.owner.toLowerCase(),account.toLowerCase());
  console.log('PASS: shared service → local mint → confirmations → indexer/PostgreSQL → publisher/S3 sink → actual Home reader → unhatched cube.');

  connected=true;await stack.control('holdMining');
  const second=await service.submit({contract:'bros',functionName:'mintWithETH',value:10n**18n,label:'Replacement mint'});
  await service.poll();assert.equal(service.list().find(r=>r.id===second.id).phase,'pending');
  const replacement=await service.replace(second.id);assert.notEqual(replacement,second.hash);
  service.stop();service=make();
  await stack.control('mine');await stack.control('mine');await service.poll();
  const spedUp=service.list().find(r=>r.id===second.id);
  assert.equal(spedUp.replacement,'repriced');assert.equal(spedUp.hash,replacement);assert.equal(spedUp.result.tokenId,'2');
  await stack.control('resumeMining');
  await until(async()=>{await service.poll();return service.list().find(r=>r.id===second.id).phase==='reflected';},'replacement publication');
  await stack.control('holdMining');
  const third=await service.submit({contract:'bros',functionName:'mintWithETH',value:10n**18n,label:'Cancelled mint'});
  // External wallet cancellation, mined before this service is re-created.
  const cancellation=await stack.provider.send('eth_sendTransaction',[{from:account,to:account,value:'0x0',data:'0x',gas:'0x5208',gasPrice:'0x174876e800',nonce:'0x'+third.nonce.toString(16)}]);
  await stack.control('mine');await stack.control('mine');service.stop();service=make();await service.poll();
  const cancelled=service.list().find(r=>r.id===third.id);
  assert.equal(cancelled.phase,'cancelled');assert.equal(cancelled.hash,cancellation);assert.equal(cancelled.result,null);
  const fresh=createTransactionService({wallet,settings:{...settings,instanceId:'fresh-run'},storage,manifestUrl});assert.equal(fresh.list().length,0);
  console.log('PASS: pending state, wallet-independent reload recovery, speed-up, external cancellation already mined at reload, and local reset isolation.');
  // Commands are unavailable on ordinary production/static servers; local proxy rejects cross-origin requests.
  const rejected=await fetch(stack.origin+'/api/local-dev',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:JSON.stringify({command:'fund',address:account})});assert.equal(rejected.status,400);
} finally {service?.stop();await stack?.stop();}
