import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createAppearanceService} from '../wallet/appearance.mjs';
import {defaultAppearance,validateAppearance,BRO_KINDS} from '../../battle-bros-backend/packages/shared/src/world-save.mjs';
const {create,kinds,formForLevel}=createRequire(import.meta.url)('../assets/bro-appearance.js');
test('selected NFT kind drives the actor; preview stays usable and cosmetics remain token scoped',()=>{
  assert.deepEqual(kinds,BRO_KINDS);
  let root={family:'juggernaut',userData:{form:4,visualVariant:'lava',colors:{}}},replaced=0;
  const bridge=create({actor:()=>root,character:r=>r.family,replace:(skin,form,family,colors)=>{replaced++;root={family,userData:{visualVariant:skin,form,colors}};return {ok:true,root};},applyColors:(r,c)=>{r.userData.colors={...c};}});
  const scope={chainId:'31337',deploymentId:'0xabc'},model=(token,kind,hatched=true)=>({identity:{active:true,hatched,tokenId:BigInt(token),type:String(kind)},progression:{level:1n}});
  for(let kind=0;kind<4;kind++){bridge.select(model(kind+1,kind),scope);assert.equal(root.family,kinds[kind]);}
  const blue={v:1,skin:'ice',colors:{core:'blue',glow:'cyan',eye:'green'}};
  bridge.apply(blue);assert.deepEqual(bridge.capture(),blue);
  bridge.select(model(1,0),scope);assert.equal(root.family,'juggernaut');assert.equal(root.userData.visualVariant,'lava');
  bridge.select(model(4,3),scope);assert.deepEqual(bridge.capture(),blue,'Returning to a BRO restores its own cosmetics');
  root.family='specter';const before=replaced;bridge.select(model(4,3),scope);assert.equal(replaced,before,'Background refresh does not undo preview testing');assert.throws(()=>bridge.capture(),/Restore/);bridge.restore();assert.equal(root.family,'longneck');
  bridge.select(model(2,1,false),scope);assert.throws(()=>bridge.capture(),/Hatch/);bridge.select(model(2,1,true),scope);assert.equal(root.family,'monsters');
  assert.throws(()=>validateAppearance({...blue,kind:3}),/Invalid/);assert.throws(()=>validateAppearance({...blue,colors:{...blue.colors,eye:'black'}}),/Invalid/);
});
test('confirmed NFT levels drive all seven forms and cap at VII while preserving cosmetics',()=>{
  const scope={chainId:'31337',deploymentId:'0xabc'};
  const appearance={v:1,skin:'ice',colors:{core:'blue',glow:'cyan',eye:'green'}};
  for(let kind=0;kind<4;kind++){
    let root=null,replaced=0,prepared=0;
    const bridge=create({actor:()=>root,character:r=>r.family,beforeSelect:()=>prepared++,replace:(skin,form,family,colors)=>{
      replaced++;root={family,userData:{visualVariant:skin,form,colors}};return {ok:true,root};
    },applyColors:(r,c)=>{r.userData.colors={...c};}});
    const model=level=>({identity:{active:true,hatched:true,tokenId:1n,type:String(kind)},progression:{level}});
    for(let level=1n;level<=7n;level++){
      bridge.select(model(level),scope);
      assert.equal(root.family,kinds[kind]);assert.equal(root.userData.form,Number(level));
      if(level===1n)bridge.apply(appearance);
      assert.deepEqual(bridge.capture(),appearance,'Level updates retain saved skin and colors');
      const previous=root,count=replaced;
      bridge.select(model(level),scope);assert.equal(root,previous);assert.equal(replaced,count,'Unchanged publications reuse the actor');
    }
    const seventh=root,count=replaced,preparations=prepared;
    for(const level of ['8','100','900719925474099312345678901234567890']){
      bridge.select(model(level),scope);assert.equal(root,seventh);assert.equal(replaced,count);assert.equal(root.userData.form,7);
    }
    assert.equal(prepared,preparations,'Levels above seven do not interrupt the current activity');
    bridge.restore();assert.equal(root.userData.form,7);assert.deepEqual(bridge.capture(),appearance);
    bridge.select({...model(2n),identity:{active:true,hatched:true,tokenId:2n,type:String(kind)}},scope);
    assert.equal(root.userData.form,2,'Switching NFTs uses the new token level');
    assert.equal(root.userData.visualVariant,'lava','Cosmetics remain scoped to the token');
  }
  assert.equal(formForLevel(0n),1);
});
test('appearance saves are signed through the shared client; reload, conflict and slow token switches are isolated',async()=>{
  const saved=new Map(),cloud=new Map(),statuses=[];let live=defaultAppearance(),reject=false,resolveSlow;
  const worlds={local:t=>saved.get(t.id)??null,draft:(t,world,revision)=>saved.set(t.id,{world:structuredClone(world),revision}),load:async t=>t.id==='3'?await new Promise(r=>resolveSlow=r):({world:cloud.get(t.id)??null}),save:async(t,world,revision)=>{if(reject)throw Error('revision conflict');assert.equal(revision,'0');cloud.set(t.id,{document:world,revision:'1'});return {world:{revision:'1'}};}};
  const bridge={apply:a=>live=structuredClone(a),capture:()=>live};
  const make=()=>createAppearanceService({worlds,bridge:()=>bridge,onChange:s=>statuses.push(s)});
  const service=make();await service.select('1');live={...live,skin:'ice',colors:{core:'blue',glow:'default',eye:'green'}};service.draft();await service.save();assert.equal(saved.get('1').revision,'1');
  await service.select('2');assert.equal(live.skin,'lava');live.skin='sand';service.draft();reject=true;await assert.rejects(service.save(),/conflict/);assert.equal(saved.get('2').world.skin,'sand');
  const slow=service.select('3');await service.select('1');resolveSlow({world:{document:{...defaultAppearance(),skin:'plant'},revision:'1'}});await slow;assert.equal(live.skin,'ice');
  const reloaded=make();await reloaded.select('1');assert.equal(live.colors.core,'blue');assert.match(statuses.at(-1).status,/BRO #1/);
});
