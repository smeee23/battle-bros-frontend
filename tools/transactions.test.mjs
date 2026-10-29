import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeFunctionData,encodeEventTopics,encodeAbiParameters,keccak256} from 'viem';
import {createHash} from 'node:crypto';
import {createTransactionService,transactionError} from '../wallet/transactions.mjs';
import {contractAbis} from '../wallet/contract-abis.mjs';
const a='0x'+'1'.repeat(40),b='0x'+'2'.repeat(40),h=x=>'0x'+x.repeat(64);
const action={contract:'bros',functionName:'mintWithETH',value:10n**18n};
function fixture(){
  let head=10n,sendCount=0,simulationError=null,chainId=31337,code='0x1234',publication=true;
  const receipts=new Map(),blocks=new Map(),data=encodeFunctionData({abi:contractAbis.bros,functionName:'mintWithETH'}),saved=new Map();
  const settings={chainId:31337,rpcUrl:'http://127.0.0.1:8545',instanceId:'test',confirmations:2,deployment:{chainId:'31337',deploymentId:b,contracts:{combat:b,bros:b}}};
  const client={getChainId:async()=>chainId,getCode:async()=>code,getBlockNumber:async()=>head,getTransactionCount:async()=>1,
    getBlock:async({blockNumber})=>({hash:blocks.get(blockNumber)?.hash??h('c'),transactions:blocks.get(blockNumber)?.transactions??[]}),
    simulateContract:async request=>{if(simulationError)throw simulationError;return {request};},
    getTransactionReceipt:async({hash})=>{if(!receipts.has(hash))throw Object.assign(Error('missing'),{name:'TransactionReceiptNotFoundError'});return receipts.get(hash);}};
  const wallet={settings,session:async()=>({address:a,assertCurrent:async()=>{},provider:{request:async({method})=>{if(method==='eth_chainId')return '0x7a69';if(method==='eth_sendTransaction'){sendCount++;return h('a');}throw Error(method);}}})};
  const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
  const document={schemaVersion:4,projectionVersion:5,chainId:'31337',deploymentId:b,contracts:{combat:b,bros:b},snapshot:{blockNumber:'12',blockHash:h('c'),timestamp:'1'},battleBros:[{tokenId:'7',active:true,hatchedAt:'0'}],history:[]};
  const body=JSON.stringify(document),manifest={...document,contentHash:createHash('sha256').update(body).digest('hex'),paths:{gameState:'snapshots/test.json'}};
  const fetcher=async url=>publication?{ok:true,json:async()=>manifest,arrayBuffer:async()=>new TextEncoder().encode(body).buffer}:{ok:false};
  let reflected=0;
  const make=(extra={})=>createTransactionService({wallet,settings,client,storage,manifestUrl:'http://local/manifest.json',fetcher,onReflected:()=>reflected++,...extra});
  function include(hash=h('a'),status='success'){
    head=12n;const receipt={transactionHash:hash,blockNumber:11n,blockHash:h('c'),status,logs:[{address:b,
      topics:encodeEventTopics({abi:contractAbis.bros,eventName:'BroMinted',args:{token:7n,owner:a}}),data:encodeAbiParameters([{type:'uint64'}],[1n])}]};receipts.set(hash,receipt);return receipt;
  }
  return {make,settings,wallet,receipts,blocks,saved,data,include,set head(value){head=value;},set simulationError(value){simulationError=value;},set chainId(value){chainId=value;},set code(value){code=value;},set publication(value){publication=value;},get sendCount(){return sendCount;},get reflected(){return reflected;}};
}
test('simulate, persist, confirm, reload while disconnected, and await publisher',async()=>{
  const f=fixture(),service=f.make();f.publication=false;
  const record=await service.submit(action);assert.equal(record.phase,'pending');assert.equal(f.sendCount,1);
  await assert.rejects(service.submit(action),/pending transaction/);
  f.include();await service.poll();assert.equal(service.list().find(r=>r.id===record.id).phase,'confirmed');
  assert.equal(service.list().find(r=>r.id===record.id).result.tokenId,'7');
  service.stop();f.wallet.session=async()=>{throw Error('Disconnected wallet must not be consulted by tracking');};
  const restored=f.make();assert.equal(restored.list()[0].phase,'confirmed');
  f.publication=true;await restored.poll();assert.equal(restored.list()[0].phase,'reflected');assert.equal(f.reflected,1);
  assert(![...f.saved.values()].some(value=>value.includes('signature')||value.includes('privateKey')));
});
test('validation, decoded simulation reverts, and rejection never auto-submit',async()=>{
  const f=fixture();f.chainId=1;await assert.rejects(f.make().submit(action),/wrong network/);assert.equal(f.sendCount,0);
  f.chainId=31337;f.code='0x';await assert.rejects(f.make().submit(action),/No deployed contract/);
  f.code='0x1234';f.simulationError={name:'ContractFunctionRevertedError',reason:'hatch yield'};
  await assert.rejects(f.make().submit(action),/hatch yield/);assert.equal(f.sendCount,0);
  f.simulationError=null;f.wallet.session=async()=>({address:a,assertCurrent:async()=>{},provider:{request:async({method})=>{if(method==='eth_chainId')return '0x7a69';throw {code:4001};}}});
  const service=f.make();await assert.rejects(service.submit(action),/declined/);assert(service.list().some(r=>r.phase==='rejected'));
  assert(!transactionError(Error('https://secret-rpc/key')).includes('secret-rpc'));
  const insufficient=fixture();insufficient.wallet.session=async()=>({address:a,assertCurrent:async()=>{},provider:{request:async({method})=>{if(method==='eth_chainId')return '0x7a69';throw {name:'InsufficientFundsError'};}}});
  const lacking=insufficient.make();await assert.rejects(lacking.submit(action),/Not enough ETH/);assert.equal(lacking.list()[0].phase,'failed','A definite balance rejection is not an ambiguous submission');
});
test('replacements mined before reload are found from stored sender, nonce and submission block',async()=>{
  for(const cancel of [false,true]){
    const f=fixture(),service=f.make();await service.submit({...action,awaitPublication:false});
    f.include(h('b'));f.blocks.set(11n,{hash:h('c'),transactions:[{from:a,to:cancel?a:b,nonce:1,hash:h('b'),input:cancel?'0x':f.data,value:cancel?0n:10n**18n}]});
    const restored=f.make();await restored.poll();const record=restored.list()[0];
    assert.equal(record.hash,h('b'));assert.equal(record.replacement,cancel?'cancelled':'repriced');assert.equal(record.phase,cancel?'cancelled':'confirmed');
  }
});
test('reverted receipts and pre-publication reorganizations are distinguished from success',async()=>{
  const f=fixture(),service=f.make();f.publication=false;await service.submit(action);f.include(h('a'),'reverted');
  await service.poll();assert.equal(service.list()[0].phase,'failed');
  const g=fixture(),live=g.make();g.publication=false;await live.submit(action);g.include();await live.poll();
  assert.equal(live.list()[0].phase,'confirmed');g.receipts.clear();g.head=13n;await live.poll();
  assert.equal(live.list()[0].phase,'pending');assert.equal(live.list()[0].result,null);
});
test('fresh local instances cannot inherit pending records; stale deployment anchor blocks writes',async()=>{
  const f=fixture();await f.make().submit(action);
  assert.equal(f.make({settings:{...f.settings,instanceId:'new-run'}}).list().length,0);
  const anchored=f.make({settings:{...f.settings,instanceId:'anchor',anchor:{number:'1',hash:h('f')}}});
  await assert.rejects(anchored.submit(action),/reset/);
});
test('same chain ID on a different wallet RPC cannot receive a write',async()=>{
  const f=fixture();f.wallet.session=async()=>({address:a,assertCurrent:async()=>{},provider:{request:async()=>({hash:h('f')})}});
  const service=f.make({settings:{...f.settings,anchor:{number:'1',hash:h('c')}}});
  await assert.rejects(service.submit(action),/different local chain/);assert.equal(f.sendCount,0);
});
test('ambiguous submission recovers by nonce without repeating the wallet request',async()=>{
  const f=fixture();f.wallet.session=async()=>({address:a,assertCurrent:async()=>{},provider:{request:async({method})=>{if(method==='eth_chainId')return '0x7a69';throw Error('Response lost');}}});
  const service=f.make();await assert.rejects(service.submit({...action,awaitPublication:false}),/interrupted/);
  assert.equal(service.list()[0].phase,'unknown');
  f.include();f.blocks.set(11n,{hash:h('c'),transactions:[{from:a,to:b,nonce:1,hash:h('a'),input:f.data,value:10n**18n}]});
  const restored=f.make();await restored.poll();assert.equal(restored.list()[0].phase,'confirmed');assert.equal(restored.list()[0].result.tokenId,'7');
});
test('storage failure does not turn a submitted transaction into a failed one',async()=>{
  const f=fixture(),service=f.make({storage:{getItem:()=>null,setItem(){throw Error('Quota exceeded');}}});
  const record=await service.submit({...action,awaitPublication:false});assert.equal(record.phase,'pending');assert(service.storageWarning);
  f.include();await service.poll();assert.equal(service.list()[0].phase,'confirmed');
});
