import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {test} from 'node:test';
import {createCoreInventory} from '../wallet/cores.mjs';
import {createWorldClient} from '../wallet/worlds.mjs';
import {worldApiHandler} from '../../battle-bros-backend/scripts/world-api.mjs';
import {createWorldService} from '../../battle-bros-backend/scripts/world-service.mjs';

const origin='https://game.example',chainId='31337',deploymentId='0x'+'a'.repeat(40);
const scope={chainId,deploymentId};
const tokenId='9007199254740993';
const creditId='00000000-0000-4000-8000-000000000001';
const otherCredit='00000000-0000-4000-8000-000000000002';

function setup(){
  const credited=new Map();
  const wallet={
    settings:{chainId:Number(chainId),deployment:{deploymentId}},
    session(){assert.fail('Core requests must not ask for a signature');},
  };
  const service=createWorldService({...scope,origin,
    verify(){assert.fail('Core requests must not verify a signature');},
    repository:{transaction:async(_,run)=>run({
      publication:async()=>({battleBros:[
        {tokenId,active:true,hatchedAt:'10'},
        {tokenId:'2',active:true,hatchedAt:'20'},
        {tokenId:'3',active:true,hatchedAt:'0'},
      ]}),
      coreBalance:async id=>String(credited.get(id)?.size??0),
      creditCores:async(id,credits)=>{
        const ids=credited.get(id)??new Set();
        for(const credit of credits)ids.add(credit);
        credited.set(id,ids);
        return String(ids.size);
      },
    })},
  });
  const handler=worldApiHandler(service,origin);
  async function fetcher(url,options){
    const request=Readable.from(options.body?[Buffer.from(options.body)]:[]);
    Object.assign(request,{url:url.pathname+url.search,method:options.method,
      headers:{origin,...Object.fromEntries(new Headers(options.headers))},socket:{remoteAddress:'127.0.0.1'}});
    let status,body;
    await handler(request,{setHeader(){},writeHead(code){status=code;},end(data){body=data;}});
    return new Response(body,{status});
  }
  const values=new Map();
  const storage={
    get length(){return values.size;},
    key:index=>[...values.keys()][index]??null,
    setItem:(key,value)=>values.set(key,value),
    removeItem:key=>values.delete(key),
  };
  return {fetcher,storage,worlds:fetcherOverride=>createWorldClient({wallet,apiUrl:'https://api.example/',storage,origin,fetcher:fetcherOverride??fetcher})};
}

test('unsigned Core credits are per BRO, additive and idempotent',async()=>{
  const {worlds}=setup();
  const client=worlds();
  assert.equal(await client.loadCores(tokenId),0n);
  assert.equal(await client.creditCores(tokenId,[creditId,creditId]),1n);
  assert.equal(await client.creditCores(tokenId,[creditId,otherCredit]),2n);
  assert.equal(await client.loadCores(tokenId),2n);
  assert.equal(await client.loadCores('2'),0n);
  await assert.rejects(client.creditCores(tokenId,[-1]),/Invalid Core credits/);
  await assert.rejects(client.creditCores('3',[creditId]),/active, hatched BROs/);
  await assert.rejects(client.creditCores('4',[creditId]),/active, hatched BROs/);
  assert.equal(await client.loadCores(tokenId),2n);
});

test('a lost credit response survives reload and cannot increment the balance again',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  const {storage,worlds,fetcher}=setup();
  const views=[];
  const create=client=>createCoreInventory({worlds:client,storage,scope:chainId+':'+deploymentId,update:view=>views.push(view),newId:()=>creditId});
  const first=create(worlds(async(url,options)=>{
    const response=await fetcher(url,options);
    if(options.method!=='POST')return response;
    assert(options.keepalive);
    assert.equal(response.status,200);
    throw Error('Connection lost after the server saved the credits');
  }));
  first.select(tokenId);
  t.mock.timers.tick(0);
  await settle();
  assert.equal(views.at(-1).balance,'0');
  assert(first.collect());
  assert.equal(views.at(-1).balance,'1');
  assert.equal(storage.length,1);
  first.flush();
  await settle();
  assert.equal(storage.length,1);

  const reopened=create(worlds());
  reopened.select(tokenId);
  t.mock.timers.tick(0);
  await settle();
  assert.equal(views.at(-1).balance,'1');
  assert.equal(storage.length,0);
  assert.equal(await worlds().loadCores(tokenId),1n);

  reopened.select('2');
  t.mock.timers.tick(0);
  await settle();
  assert.equal(views.at(-1).balance,'0');
  reopened.select(null);
  assert.equal(views.at(-1),null);
  assert.equal(reopened.collect(),false);
});
