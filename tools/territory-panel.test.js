'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
class Element {
  constructor(){this.children=[];this.hidden=false;this.textContent='';this.value='';this.listeners={};}
  append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;this.textContent='';}
  setAttribute(){} addEventListener(name,fn){this.listeners[name]=fn;} focus(){this.focused=true;}
  get text(){return this.textContent+this.children.map(c=>c.text??'').join(' ');}
}
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const address='0x'+'1'.repeat(40),snapshot={blockNumber:'123',blockHash:'0x'+'a'.repeat(64),timestamp:'1800000000'};
const manifest={schemaVersion:2,projectionVersion:3,chainId:'31337',deploymentId:address,snapshot,paths:{gameState:'snapshots/test.json'}};
const token='9007199254740993';
const bro={tokenId:token,name:'<img src=x onerror=alert(1)>',owner:address,active:true,hatchedAt:'1',kind:'0',xp:'790',level:'4',capacity:'115',projectedReserves:['38','31','27'],training:['4000','3500','2500'],defense:['1000','6000','3000'],lastTrainingAt:'1700000000',need:{active:false,activeSinceTimestamp:null},freeShares:'1000000000000000001',reservedShares:'2',protectedPrincipal:'1000000000000000000',currentValueWei:'1004000000000000000',locationId:'2',pendingChallengeId:null};
const challenge=(id,attacker,defender,status,extra={})=>({challengeId:id,location:'2',attacker,defender,status,action:'2',power:'15',weights:['1000','6000','3000'],...extra});
const game={...manifest,contracts:{combat:address},battleBros:[bro,{...bro,tokenId:'2',name:'Other',active:false,owner:null}],challenges:[
 challenge('1',token,'2','RESOLVED',{winner:token,loser:'2',defenderAction:'1'}),
 challenge('2','2',token,'RESOLVED',{winner:'2',loser:token}),
 challenge('3',token,'2','EXPIRED'),challenge('4','2',token,'PENDING'),challenge('5','8','9','RESOLVED',{winner:'8',loser:'9'})],history:[]};
let fail=false,pending=null;
const context=vm.createContext({URL,URLSearchParams,console,document:{getElementById:el,createElement:()=>new Element()},location:{href:'https://example.test/',hostname:'example.test',protocol:'https:',search:''},window:{__battleBrosPublicData:{manifestUrl:'https://example.test/manifest.json',tokenId:token}},fetch:async url=>{
 if(pending){const wait=pending;pending=null;await wait;}
 return {ok:!fail,status:503,json:async()=>structuredClone(url.endsWith('manifest.json')?manifest:game)};
}});
vm.runInContext(html.slice(html.indexOf('  const BATTLEBRO_FRONTEND_EMPTY'),html.indexOf('  const resources = {')),context);
(async()=>{
 await context.hydrateBattleBrosReadModel();
 assert.match(el('battlebro-name').text,/9007199254740993/);
 assert.match(el('battlebro-territory').text,/#2/);
 assert.equal(el('battlebro-source-badge').textContent,'CONFIRMED TERRITORY V2');
 assert(!el('battlebro-data-status').text.includes('unavailable'));
 const result=await context.loadBattleBroHistory(token),s=context.summarizeBattleHistory(result.model,result.game);
 assert.equal(s.battles.length,4);assert.equal(s.attacks,2);assert.equal(s.defenses,2);
 assert.equal(s.wins,1);assert.equal(s.losses,1);assert.equal(s.resolved,2);assert.equal(s.expired,1);assert.equal(s.pending,1);
 assert.equal(result.model.capital.freeShares,1000000000000000001n);
 await context.showBattleHistory(token);
 assert.equal(el('battle-history-title').textContent,bro.name+' #'+token,'Names are plain text');
 assert.match(el('battle-history-content').text,/Defense weights/);
 assert.match(el('battle-history-content').text,/Training weights/);
 const [stats,filter,list]=el('battle-history-content').children;
 assert.equal(list.children.length,4);
 filter.value='Attack';filter.listeners.change();assert.equal(list.children.length,2);
 filter.value='Defense';filter.listeners.change();assert.equal(list.children.length,2);
 await context.showBattleHistory('2');assert.match(el('battle-history-content').text,/Inactive \/ burned/);
 await context.showBattleHistory('999');assert.match(el('battle-history-error').text,/not found/);
 await context.showBattleHistory('-1');assert.match(el('battle-history-error').text,/Token ID/);
 // A slower old search cannot overwrite a more recent one.
 let release;pending=new Promise(r=>release=r);const old=context.showBattleHistory(token);
 await context.showBattleHistory('2');release();await old;assert.equal(el('battle-history-title').textContent,'Other #2');
 game.snapshot={...snapshot,blockNumber:'124'};await context.hydrateBattleBrosReadModel();
 assert.equal(el('battlebro-source-badge').textContent,'DATA UNAVAILABLE');
 assert.equal(el('battlebro-name').textContent,'No BattleBro selected');
 game.snapshot=snapshot;fail=true;await context.showBattleHistory(token);
 assert.match(el('battle-history-error').text,/503/);assert.equal(el('battle-history-content').children.length,0);
 assert(!html.includes('battle-calendar'));
 assert(!html.includes('<h3>Current round</h3>'));
 assert(!html.includes('>Commit / Reveal</button>'));assert(!html.includes('>Register</button>'));
 console.log('territory panel: publication hydration, exact token IDs, attack/defense history, profile lookup, filters, inactive tokens, failures and request races passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
