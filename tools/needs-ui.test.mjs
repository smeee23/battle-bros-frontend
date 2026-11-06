import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {defaultAppearance} from '../../battle-bros-backend/packages/shared/src/world-save.mjs';
import {mountNeedsInfrastructure} from '../wallet/needs-ui.mjs';
class Element{
  constructor(){this.children=[];this.nodes=new Map();this.value='';this.textContent='';this.listeners={};}
  set innerHTML(value){for(const name of value.matchAll(/\b(data-[\w-]+)(?=[\s=>])/g))this.nodes.set('['+name[1]+']',new Element());this.nodes.set('.bb-needs-actions',new Element());if(this.nodes.has('[data-world]'))this.nodes.get('[data-world]').value='home';}
  append(...nodes){this.children.push(...nodes);if(!this.value&&nodes[0]?.value)this.value=nodes[0].value;}
  replaceChildren(...nodes){this.children=nodes;this.value='';this.append(...nodes);}
  querySelector(selector){return this.nodes.get(selector);}
  setAttribute(){}addEventListener(name,fn){this.listeners[name]=fn;}
}
test('player UI discovers Needs, launches care, opens worlds, signs saves and preserves conflicts',async()=>{
  const previous=Object.fromEntries(['window','document','location','fetch'].map(k=>[k,globalThis[k]]));
  const address='0x'+'1'.repeat(40),deployment='0x'+'a'.repeat(40),body=new Element(),events={};
  const world={v:4,gridSize:50,environment:'EARTH',seed:'ui',cells:[]};let opened=null,signed=0,conflict=false,selectedProfile=null,cosmetics=defaultAppearance();
  const doc={schemaVersion:4,projectionVersion:5,chainId:'31337',deploymentId:deployment,contracts:{combat:deployment},snapshot:{blockNumber:'10',blockHash:'0x'+'b'.repeat(64),timestamp:'100'},history:[],worlds:[],needs:{seeds:[]},battleBros:[{tokenId:'1',name:'Nova',active:true,owner:address,locationId:null,need:{active:true,sourceEpoch:'2',activeSinceTimestamp:'90',activity:{id:'need-1',type:'care',version:'1'}}}]};
  doc.battleBros.push({...doc.battleBros[0],tokenId:'2',name:'Second',need:{active:false}});
  const runtime={manifestUrl:'https://game.example/manifest.json',worldApiUrl:'https://api.example/'};
  const wallet={settings:{chainId:31337,deployment:{deploymentId:deployment,contracts:{combat:deployment}}},getState:()=>({address,status:'connected',chainId:31337}),subscribe:fn=>{fn(wallet.getState());return()=>{};},session:async()=>({address,assertCurrent:async()=>{},provider:{request:async({method})=>{assert.equal(method,'eth_signTypedData_v4');signed++;return '0xsigned';}}})};
  const transactions={list:()=>[],subscribe:()=>()=>{},submit:async()=>{}};
  globalThis.location={href:'https://game.example/',origin:'https://game.example'};
  globalThis.document={body,createElement:()=>new Element(),addEventListener:(name,fn)=>events[name]=fn,dispatchEvent:()=>{},pointerLockElement:null};
  globalThis.window={__battleBrosPublicData:runtime,addEventListener:()=>{},confirm:()=>true,battleBrosAppearanceBridge:{capture:()=>cosmetics,apply:value=>{cosmetics=structuredClone(value);}},normalizeBattleBrosPublicDocuments:(_m,_g,b)=>({identity:{tokenId:BigInt(b.tokenId)}}),selectBattleBrosReadModel:model=>{selectedProfile=String(model.identity.tokenId);},battleBrosWorldBridge:{capture:()=>world,captureHome:()=>world,matches:t=>opened?.id===t.id&&opened?.kind===t.kind,open:async(t,w)=>{opened=t;if(w)assert.deepEqual(w,world);}}};
  globalThis.fetch=async(url,options={})=>{
    const path=new URL(url).pathname,input=options.body?JSON.parse(options.body):null,serialized=JSON.stringify(doc);
    let data,status=200;
    if(path==='/manifest.json')data={...doc,paths:{gameState:'snapshots/ui.json'},contentHash:createHash('sha256').update(serialized).digest('hex')};
    else if(path==='/snapshots/ui.json')return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(serialized).buffer};
    else if(path==='/worlds')data={world:null};
    else if(path==='/worlds/challenge')data={chainId:'31337',deploymentId:deployment,origin:location.origin,...input,authority:'owner:1:'+address,nonce:'0x'+'c'.repeat(64),expiresAt:'9999999999'};
    else if(path==='/worlds/save'){if(conflict){status=409;data={error:'World changed on another device'};}else data={world:{revision:'1'},status:'accepted'};}
    else throw Error('Unexpected request '+path);
    return {ok:status===200,status,json:async()=>data};
  };
  try{
    const saved=new Map(),service=mountNeedsInfrastructure({wallet,transactions,storage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}});
    for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));
    const root=body.children[0],find=s=>root.querySelector(s);
    assert.equal(find('[data-count]').textContent,'1');assert.equal(find('[data-bro]').value,'1');assert.equal(service.list()[0].status,'awaiting-activity');
    await find('[data-needs]').children[0].children[3].onclick();assert.equal(service.list()[0].status,'ready');
    await find('[data-open]').onclick();assert.deepEqual(opened,{kind:'home',id:'1'});
    await find('[data-save]').onclick();assert.equal(signed,1);assert.match(find('[data-world-status]').textContent,/Saved to backend/);assert.equal(saved.size,1);
    conflict=true;await find('[data-save]').onclick();assert.match(find('[data-error]').textContent,/another device/);assert.equal(saved.size,1,'Conflict keeps the local draft');
    const beforeAppearanceSave=signed;conflict=false;cosmetics={...cosmetics,skin:'ice'};events['battlebros:appearance-edited']();
    await find('[data-save-appearance]').onclick();assert.match(find('[data-appearance-status]').textContent,/Appearance saved for BRO #1/);assert.equal(signed,beforeAppearanceSave+1);
    find('[data-bro]').value='2';find('[data-bro]').onchange();assert.equal(selectedProfile,'2');
    await find('[data-open]').onclick();assert.equal(cosmetics.skin,'lava','A second BRO does not inherit the first BRO’s skin');assert.deepEqual(opened,{kind:'home',id:'2'});assert.match(find('[data-world-status]').textContent,/BRO #2.*No cloud save yet/);
    await find('[data-refresh]').onclick();assert.equal(find('[data-bro]').value,'2');assert.equal(selectedProfile,'2','Publication refresh preserves the selected BRO');
    find('[data-bro]').value='1';find('[data-bro]').onchange();await find('[data-open]').onclick();assert.equal(selectedProfile,'1');assert.equal(opened.id,'1');
    service.destroy();
  }finally{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
