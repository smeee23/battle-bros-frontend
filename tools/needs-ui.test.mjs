import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {defaultAppearance,contentHash} from '../../battle-bros-backend/packages/shared/src/world-save.mjs';
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
  const stats=new Element(),needs=new Element(),worldMenu=new Element(),hosts=new Map([['bro-player-controls',stats],['bro-needs-controls',needs],['world-save-controls',worldMenu]]);
  const world={v:4,gridSize:50,environment:'EARTH',seed:'ui',cells:[]};
  const worldExport={...world,catalogVersion:1,cameraMode:'ortho',toolId:'select'};let opened=null,signed=0,conflict=false,selectedProfile=null,cosmetics=defaultAppearance(),savedWorld=null,s3Loads=0;
  const startupTasks=[],worldLoads=[],walletListeners=[];let walletAddress=address,loadGate=null,loadError=false;
  const doc={schemaVersion:5,projectionVersion:6,chainId:'31337',deploymentId:deployment,contracts:{combat:deployment},snapshot:{blockNumber:'10',blockHash:'0x'+'b'.repeat(64),timestamp:'100'},history:[],worlds:[],needs:{seeds:[]},battleBros:[{tokenId:'1',name:'Nova',active:true,owner:address,locationId:null,need:{active:true,sourceEpoch:'2',activeSinceTimestamp:'90',activity:{id:'need-1',type:'care',version:'1'}}}]};
  doc.battleBros.push({...doc.battleBros[0],tokenId:'2',name:'Second',need:{active:false}});
  doc.battleBros.push({...doc.battleBros[0],tokenId:'3',name:'Third',locationId:'9',need:{...doc.battleBros[0].need,activity:{id:'need-3',type:'care',version:'1'}}});
  const runtime={manifestUrl:'https://game.example/manifest.json',worldApiUrl:'https://api.example/'};
  const wallet={settings:{chainId:31337,deployment:{deploymentId:deployment,contracts:{combat:deployment}}},getState:()=>({address:walletAddress,status:walletAddress?'connected':'disconnected',chainId:31337}),subscribe:fn=>{walletListeners.push(fn);fn(wallet.getState());return()=>{};},session:async()=>({address,assertCurrent:async()=>{},provider:{request:async({method})=>{assert.equal(method,'eth_signTypedData_v4');signed++;return '0xsigned';}}})};
  const transactions={list:()=>[],subscribe:()=>()=>{},submit:async()=>{}};
  globalThis.location={href:'https://game.example/',origin:'https://game.example'};
  globalThis.document={body,getElementById:id=>hosts.get(id),createElement:()=>new Element(),addEventListener:(name,fn)=>events[name]=fn,dispatchEvent:()=>{},pointerLockElement:null};
  globalThis.window={battleBrosWorldLoading:{track:task=>startupTasks.push(task)},__battleBrosPublicData:runtime,addEventListener:()=>{},confirm:()=>true,battleBrosAppearanceBridge:{capture:()=>cosmetics,apply:value=>{cosmetics=structuredClone(value);}},normalizeBattleBrosPublicDocuments:(_m,_g,b)=>({identity:{tokenId:BigInt(b.tokenId)}}),selectBattleBrosReadModel:model=>{selectedProfile=String(model.identity.tokenId);},battleBrosWorldBridge:{capture:()=>worldExport,captureHome:()=>worldExport,matches:t=>opened?.id===t.id&&opened?.kind===t.kind,open:async(t,w)=>{opened=t;if(w)assert.deepEqual(w,world);}}};
  globalThis.fetch=async(url,options={})=>{
    const path=new URL(url).pathname,input=options.body?JSON.parse(options.body):null,serialized=JSON.stringify(doc);
    let data,status=200;
    if(path==='/manifest.json')data={...doc,paths:{gameState:'snapshots/ui.json'},contentHash:createHash('sha256').update(serialized).digest('hex')};
    else if(path==='/snapshots/ui.json')return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(serialized).buffer};
    else if(path==='/worlds'){worldLoads.push(new URL(url).search);if(new URL(url).searchParams.get('kind')==='home'&&new URL(url).searchParams.get('id')==='2'){if(loadGate)await loadGate;if(loadError)throw Error('World API unavailable');}data={world:new URL(url).searchParams.get('kind')==='home'&&new URL(url).searchParams.get('id')==='1'?savedWorld:null};}
    else if(path==='/saved/home-1.json'){s3Loads++;data={schemaVersion:1,kind:'home',id:'1',revision:'1',contentHash:contentHash(world),world};}
    else if(path==='/worlds/challenge')data={chainId:'31337',deploymentId:deployment,origin:location.origin,...input,authority:'owner:1:'+address,nonce:'0x'+'c'.repeat(64),expiresAt:'9999999999'};
    else if(path==='/worlds/save'){if(conflict){status=409;data={error:'World changed on another device'};}else data={world:{revision:'1'},status:'accepted'};}
    else throw Error('Unexpected request '+path);
    return {ok:status===200,status,json:async()=>data};
  };
  try{
    const saved=new Map(),service=mountNeedsInfrastructure({wallet,transactions,storage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}});
    for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));
    assert(startupTasks.length>=3,'Startup tracks the publication, saved world and selected BRO appearance');
    await Promise.all(startupTasks);
    const find=s=>stats.querySelector(s)||needs.querySelector(s)||worldMenu.querySelector(s);
    assert.equal(body.children.length,0,'No separate Needs / World menu is added');
    assert(stats.querySelector('[data-bro]'));assert(needs.querySelector('[data-needs]'));
    assert.equal(find('[data-appearance-status]'),undefined,'Default appearance notes are removed from Stats');
    assert.equal(find('[data-bro-presence]').textContent,'');assert(find('[data-bro-presence]').hidden,'Home BROs need no presence notice');
    assert.equal(needs.className,'battlebro-panel-section battlebro-panel-disclosure bb-player-needs');
    assert.equal(find('[data-status]'),undefined,'The existing stats header owns the confirmed-block label');
    assert(worldMenu.querySelector('[data-save]'));assert(worldMenu.querySelector('[data-cloud]'));
    assert.equal(find('[data-save-appearance]'),undefined,'No menu appearance-save button');
    assert.equal(window.battleBrosWalletAddress('1'),address,'Stats ownership checks use the latest owned BRO roster');assert.equal(window.battleBrosWalletAddress('999999'),null);
    assert.equal(find('[data-bro]').value,'1');assert.equal(service.list()[0].status,'awaiting-activity');
    assert.equal(service.list().length,2);assert.equal(find('[data-needs]').children.length,1,'Only the selected BRO’s Needs are shown');
    await find('[data-needs]').children[0].children[2].onclick();assert.equal(service.list()[0].status,'ready');
    assert.equal(service.list()[1].status,'awaiting-activity','Care actions stay bound to the selected BRO');
    assert.equal(find('[data-open]'),undefined,'Selecting a BRO opens its world without an extra button');
    assert.deepEqual(opened,{kind:'home',id:'1'},'Initial owned BRO opens automatically from a renderer export with local metadata');assert.equal(worldExport.cameraMode,'ortho','Opening preserves the local renderer settings');assert.equal(find('[data-save]').disabled,false);
    const messageModule=await import('../assets/game-messages.js');window.battleBrosMessages=messageModule.default();
    await find('[data-save]').onclick();assert.equal(signed,1);assert.match(window.battleBrosMessages.current.text,/Saved to backend/);assert(find('[data-world-status]').hidden,'World-save notices use the shared box without a duplicate panel message');assert.equal(saved.size,1);
    delete window.battleBrosMessages;
    savedWorld={document:world,revision:'1'};doc.worlds.push({kind:'home',id:'1',revision:'1',path:'saved/home-1.json',contentHash:contentHash(world)});
    await find('[data-refresh]').onclick();await find('[data-cloud]').onclick();
    assert.equal(s3Loads,1,'Load saved world in the toolbar uses the verified S3 publication');assert.deepEqual(opened,{kind:'home',id:'1'});
    window.battleBrosMessages=messageModule.default();
    conflict=true;await find('[data-save]').onclick();assert.match(window.battleBrosMessages.current.text,/another device/);assert.equal(window.battleBrosMessages.current.category,'error');assert(find('[data-world-error]').hidden,'Save conflicts replace the shared message instead of creating a second error');assert.equal(saved.size,1,'Conflict keeps the local draft');
    delete window.battleBrosMessages;
    const beforeAppearanceSave=signed;conflict=false;events['battlebros:training-entered']();
    cosmetics={...cosmetics,skin:'ice'};events['battlebros:appearance-edited']();assert.equal(signed,beforeAppearanceSave,'Editing only creates a local draft');
    const save={detail:{promise:null}};events['battlebros:training-save-appearance'](save);await save.detail.promise;
    assert.equal(find('[data-bro-presence]').textContent,'','Appearance saves do not replace the presence status');assert.equal(signed,beforeAppearanceSave+1);
    cosmetics={...cosmetics,skin:'gem'};events['battlebros:appearance-edited']();await events['battlebros:training-exited']();
    assert.equal(cosmetics.skin,'ice','Leaving retains saved appearance and discards subsequent edits');
    events['battlebros:training-entered']();await events['battlebros:training-exited']();
    assert.equal(signed,beforeAppearanceSave+1,'Leaving never requests a signature');
    const beforeCancel=signed,oldCosmetics=structuredClone(cosmetics);
    events['battlebros:training-entered']();cosmetics={...cosmetics,skin:'gem'};events['battlebros:appearance-edited']();
    const canceled={detail:{pending:false,save:false}};await events['battlebros:training-exited'](canceled);
    assert.deepEqual(cosmetics,oldCosmetics,'Cancel restores the appearance at facility entry');assert.equal(signed,beforeCancel);assert.equal(canceled.detail.pending,false);
    find('[data-bro]').value='2';await find('[data-bro]').onchange();assert.equal(selectedProfile,'2');
    assert.equal(find('[data-needs]').children.length,1);assert.match(find('[data-needs]').children[0].textContent,/No active Needs for this BRO/);
    assert.equal(cosmetics.skin,'lava','A second BRO does not inherit the first BRO’s skin');assert.deepEqual(opened,{kind:'home',id:'2'});assert.match(find('[data-world-status]').textContent,/BRO #2.*No cloud save yet/);
    const loadsBeforeRefresh=worldLoads.length;
    await find('[data-refresh]').onclick();assert.equal(find('[data-bro]').value,'2');assert.equal(selectedProfile,'2','Publication refresh preserves the selected BRO');
    assert.match(find('[data-needs]').children[0].textContent,/No active Needs for this BRO/,'Refresh does not show other BROs’ Needs');
    assert.equal(worldLoads.length,loadsBeforeRefresh,'Background refresh does not reload the editor or discard edits');
    find('[data-bro]').value='3';await find('[data-bro]').onchange();assert.equal(find('[data-needs]').children.length,1);
    assert.equal(find('[data-needs]').children[0].children[0].children[3].textContent,'Awaiting activity','Switching BROs immediately shows that BRO’s Need');
    assert.deepEqual(opened,{kind:'home',id:'3'},'A defending BRO still opens its Home, never a separate territory world');
    assert.equal(find('[data-bro-presence]').textContent,'BRO #3 Defending Territory 9');assert.equal(find('[data-bro-presence]').hidden,false);
    doc.battleBros[2].locationId='9007199254740993';await find('[data-refresh]').onclick();
    assert.equal(find('[data-bro-presence]').textContent,'BRO #3 Defending Territory 9007199254740993','Territory IDs keep their full decimal precision');
    doc.battleBros[2].locationId=null;await find('[data-refresh]').onclick();
    assert.equal(find('[data-bro-presence]').textContent,'');assert(find('[data-bro-presence]').hidden,'Confirmed departure clears the notice');
    doc.battleBros[2].locationId='9';await find('[data-refresh]').onclick();
    assert.equal(find('[data-bro-presence]').textContent,'BRO #3 Defending Territory 9');
    assert.equal(find('[data-world]'),undefined,'The separate territory-world selector is removed');
    find('[data-bro]').value='1';await find('[data-bro]').onchange();assert.equal(selectedProfile,'1');assert.deepEqual(opened,{kind:'home',id:'1'});assert.equal(opened.kind,'home');
    assert(find('[data-bro-presence]').hidden,'Selecting a Home BRO clears the previous defender notice');
    assert(saved.has([...saved.keys()].find(k=>k.includes(':home:2:'))),'Switching BROs preserves the outgoing world draft');
    loadError=true;find('[data-bro]').value='2';await find('[data-bro]').onchange();
    assert.equal(opened.id,'1');assert.equal(find('[data-save]').disabled,true,'A failed load cannot save the previous BRO’s world under the selected BRO');
    assert.match(find('[data-world-error]').textContent,/World API unavailable/);
    loadError=false;await find('[data-refresh]').onclick();assert.deepEqual(opened,{kind:'home',id:'2'},'Refresh retries a failed automatic load');
    find('[data-bro]').value='1';await find('[data-bro]').onchange();
    let releaseLoad;loadGate=new Promise(resolve=>releaseLoad=resolve);
    find('[data-bro]').value='2';const pendingSwitch=find('[data-bro]').onchange();
    assert.equal(find('[data-save]').disabled,true);assert.equal(find('[data-bro]').disabled,true);
    walletAddress=null;for(const listener of walletListeners)listener(wallet.getState());
    releaseLoad();await pendingSwitch;for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));
    assert.deepEqual(opened,{kind:'home',id:'1'},'A load completed after disconnect cannot replace the displayed world');
    assert.equal(find('[data-save]').disabled,true);
    assert(find('[data-bro-presence]').hidden,'Disconnect clears the defender notice');
    service.destroy();
  }finally{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
