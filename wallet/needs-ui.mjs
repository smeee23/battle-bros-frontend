import {createAppearanceService} from './appearance.mjs';
import {readTransactionPublication} from './publication.mjs';
import {createNeedsService} from './needs.mjs';
import {createWorldClient,visualWorld} from './worlds.mjs';
import {contentHash,validateWorld} from '../../battle-bros-backend/packages/shared/src/world-save.mjs';
export function mountNeedsInfrastructure({wallet,transactions,storage,runtime=window.__battleBrosPublicData}){
  if(!wallet.settings.deployment||!runtime.manifestUrl)return;
  const root=document.getElementById('bro-player-controls'),needsRoot=document.getElementById('bro-needs-controls'),worldRoot=document.getElementById('world-save-controls');
  if(!root||!needsRoot||!worldRoot)return;
  root.className='bb-player-controls';needsRoot.className='battlebro-panel-section battlebro-panel-disclosure bb-player-needs';worldRoot.className='bb-world-controls';
  root.innerHTML='<label>Your BRO <select data-bro aria-label="Your BRO"></select></label><p data-appearance-status role="status" aria-live="polite"></p><button data-refresh type="button">Refresh BROs</button><p data-error role="alert"></p>';
  needsRoot.innerHTML='<summary>Needs</summary><div data-needs></div>';
  worldRoot.innerHTML='<label>World <select data-world aria-label="Saved world"><option value="home">Home</option><option value="territory">Occupied territory</option></select></label><div class="bb-world-actions"><button data-open type="button">Open world</button><button data-save type="button">Save world</button><button data-cloud type="button">Load saved world</button></div><p data-world-status role="status"></p><p data-world-error role="alert"></p>';
  const el=s=>root.querySelector(s)||needsRoot.querySelector(s)||worldRoot.querySelector(s),broSelect=el('[data-bro]'),kindSelect=el('[data-world]');
  let publication=null,selected='',identityGeneration=0,revision='0',activeTarget=null,switching=false,worldBusy=false,request=0,timer,lastFocusRefresh=0;
  const worlds=runtime.worldApiUrl?createWorldClient({wallet,apiUrl:runtime.worldApiUrl,storage}):null;
  const appearance=createAppearanceService({worlds,bridge:()=>window.battleBrosAppearanceBridge,onChange:state=>{el('[data-appearance-status]').textContent=state.status;}});
  const service=createNeedsService({wallet,transactions,refresh});window.battleBrosNeeds=service;
  const own=()=>publication?.battleBros.filter(b=>b.active&&b.owner?.toLowerCase()===wallet.getState().address?.toLowerCase())??[];
  const target=()=>{const bro=own().find(b=>b.tokenId===broSelect.value);if(!bro)throw Error('Select a BRO owned by your connected wallet');if(kindSelect.value==='territory'&&!bro.locationId)throw Error('This BRO does not occupy a territory');return {kind:kindSelect.value,id:kindSelect.value==='home'?bro.tokenId:bro.locationId};};
  const same=(a,b)=>a&&b&&a.kind===b.kind&&a.id===b.id;
  const active=()=>own().some(b=>activeTarget?.kind==='home'?b.tokenId===activeTarget.id:b.locationId===activeTarget?.id);
  function error(e,selector='[data-error]'){el(selector).textContent=e?.code===4001?'Wallet request declined. Your local draft is preserved.':e.message??'Request failed';}
  async function action(fn,selector='[data-error]'){el(selector).textContent='';try{await fn();}catch(e){error(e,selector);}}
  const worldAction=fn=>action(fn,'[data-world-error]');
  function render(){
    const previous=selected||String(window.__battleBrosReadModel?.identity.tokenId??broSelect.value);broSelect.replaceChildren();for(const b of own()){const o=document.createElement('option');o.value=b.tokenId;o.textContent=(b.name||'BRO')+' #'+b.tokenId;broSelect.append(o);}if(own().some(b=>b.tokenId===previous))broSelect.value=previous;selected=own().length?broSelect.value:'';
    if(!own().length){const o=document.createElement('option');o.textContent='Connect an owning wallet';broSelect.append(o);}
    broSelect.disabled=worldBusy;kindSelect.disabled=worldBusy;
    for(const button of [el('[data-open]'),el('[data-save]'),el('[data-cloud]')])button.disabled=!worlds||!own().length||worldBusy;
    if(!worlds)el('[data-world-status]').textContent='Cloud world saves are not configured.';
    const list=el('[data-needs]');list.replaceChildren();
    const selectedNeeds=service.list().filter(n=>n.bro.tokenId===selected);
    for(const n of selectedNeeds){
      const card=document.createElement('article'),title=document.createElement('strong'),description=document.createElement('p'),state=document.createElement('span');
      title.textContent=n.handler?.title||n.assignment.type;
      description.className='battlebro-panel-note';
      description.textContent=n.available?n.handler.instructions:'This activity requires a newer version of the game.';
      const labels={'awaiting-activity':'Awaiting activity','in-progress':'Activity in progress',ready:'Activity satisfied. Confirm care with your wallet.','completed-syncing':'Completed onchain. Waiting for game state to sync.','completion-mismatch':'A different Need was cleared. Refresh before continuing.',preparing:'Preparing transaction','awaiting-wallet':'Check your wallet',pending:'Transaction pending',unknown:'Checking submission status. Do not submit again.',included:'Included; waiting for confirmations',failed:'Transaction failed',rejected:'Wallet request declined',cancelled:'Transaction cancelled',replaced:'Transaction replaced',interrupted:'Submission interrupted'};
      state.textContent=(labels[n.status]??n.status)+(n.progressMessage?' · '+n.progressMessage:'');
      const grid=document.createElement('div'),needLabel=document.createElement('span'),stateLabel=document.createElement('span');
      grid.className='battlebro-panel-grid';needLabel.textContent='Need';stateLabel.textContent='Status';
      grid.append(needLabel,title,stateLabel,state);card.append(grid,description);
      if(n.error){const p=document.createElement('p');p.textContent=n.error;card.append(p);}
      const blocked=['preparing','awaiting-wallet','pending','unknown','included','completed-syncing','completion-mismatch'].includes(n.status);
      const start=document.createElement('button');start.textContent=n.assignment.type==='care'?'Review care':'Start / restart activity';start.disabled=!n.available||blocked||worldBusy;start.onclick=()=>action(async()=>{broSelect.value=n.bro.tokenId;selected=n.bro.tokenId;selectBro();await service.start(n.assignment.id);});
      const complete=document.createElement('button');complete.textContent='Confirm care';complete.disabled=!n.ready||blocked||!transactions||wallet.getState().status!=='connected';complete.onclick=()=>action(()=>service.complete(n.assignment.id));card.append(start,complete);if(n.status==='in-progress'){const cancel=document.createElement('button');cancel.textContent='Cancel activity';cancel.onclick=()=>service.cancel(n.assignment.id);card.append(cancel);}list.append(card);
    }
    if(publication&&!selectedNeeds.length){const p=document.createElement('p');p.className='battlebro-panel-note';p.textContent=selected?'No active Needs for this BRO.':'Connect your wallet and select a BRO to see its Needs.';list.append(p);}
  }
  function selectBro(tokenId=broSelect.value){
    const bro=own().find(b=>b.tokenId===tokenId);if(!bro||!window.normalizeBattleBrosPublicDocuments)return;
    const model=window.normalizeBattleBrosPublicDocuments(publication,publication,bro,BigInt(bro.tokenId));
    window.selectBattleBrosReadModel?.(model,{chainId:publication.chainId,deploymentId:publication.deploymentId});
    if(window.battleBrosAppearanceBridge)appearance.select(bro.tokenId).catch(error);
  }
  async function refresh(){
    const current=++request;try{const doc=await readTransactionPublication(wallet.settings,new URL(runtime.manifestUrl,location.href).href);if(current!==request)return;
      publication=doc;service.update(doc);render();selectBro();
      if(activeTarget&&el('[data-world-status]').textContent.startsWith('Saved to backend')){const published=doc.worlds?.find(w=>same(w,activeTarget));if(published?.revision===revision)el('[data-world-status]').textContent='World revision '+revision+' published.';}
    }catch(e){if(current===request)throw Error('Confirmed state unavailable. Displayed information may be stale. '+e.message);}
  }
  async function openWorld({cloud=false}={}){
    if(worldBusy)throw Error('A world operation is already in progress');if(!worlds)throw Error('Cloud world saves are not configured');if(!window.battleBrosWorldBridge)throw Error('World renderer is still loading');
    const next=target(),broId=broSelect.value,generation=identityGeneration;
    if(activeTarget&&active()&&window.battleBrosWorldBridge.matches(activeTarget))worlds.draft(activeTarget,window.battleBrosWorldBridge.capture(),revision);
    worldBusy=true;switching=true;clearTimeout(timer);render();
    try{
      const loaded=await worlds.load(next),local=cloud?null:worlds.local(next);let world=local?.world??loaded.world?.document;
      if(generation!==identityGeneration)throw Error('Wallet changed while opening the world. Open it again.');
      if(cloud&&!loaded.world)throw Error('No cloud save exists');
      const nextRevision=local?.revision??loaded.world?.revision??'0';
      // S3 remains the public read path; the API returns accepted revisions so a
      // player can resume their own just-saved world before publication catches up.
      const descriptor=publication.worlds?.find(w=>same(w,next));
      if(!local&&descriptor&&descriptor.revision===loaded.world?.revision){
        const response=await fetch(new URL(descriptor.path,new URL(runtime.manifestUrl,location.href)),{credentials:'omit'});
        if(response.ok){const saved=await response.json();if(saved.schemaVersion!==1||saved.kind!==next.kind||saved.id!==next.id||saved.revision!==descriptor.revision||saved.contentHash!==descriptor.contentHash||contentHash(saved.world)!==descriptor.contentHash)throw Error('Published world identity mismatch');validateWorld(saved.world);world=saved.world;}
      }
      if(!world&&same(activeTarget,next))world=window.battleBrosWorldBridge.capture();
      if(!world&&!activeTarget&&next.kind==='home')world=window.battleBrosWorldBridge.captureHome();
      if(generation!==identityGeneration)throw Error('Wallet changed while opening the world. Open it again.');
      if(world)validateWorld(world);
      if(cloud){if(!window.confirm('Replace this local draft with the latest saved world?'))return;worlds.draft(next,world,nextRevision);}
      await window.battleBrosWorldBridge.open(next,world);if(generation!==identityGeneration)throw Error('Wallet changed while opening the world. Open it again.');revision=nextRevision;activeTarget=next;selected=broId;broSelect.value=broId;selectBro(broId);
      const worldLabel=next.kind==='home'?'home for BRO #'+broId:'territory #'+next.id+' for BRO #'+broId;
      el('[data-world-status]').textContent='Opened '+worldLabel+'. '+(local?'Local draft restored'+(local.revision!==(loaded.world?.revision??'0')?'; a newer cloud revision exists.':'')+'. Use “Load saved world” to discard it.':revision==='0'?'No cloud save yet.':('Cloud save '+revision+' loaded.'));
    }finally{switching=false;worldBusy=false;render();}
  }
  async function saveWorld(){
    if(worldBusy)throw Error('A world operation is already in progress');if(!same(target(),activeTarget)||!active())throw Error('Open this world before saving it');
    if(!window.battleBrosWorldBridge.matches(activeTarget))throw Error('Return to the opened world before saving');
    worldBusy=true;render();try{
      const world=window.battleBrosWorldBridge.capture();worlds.draft(activeTarget,world,revision);
      const savingTarget={...activeTarget},generation=identityGeneration;
      const result=await worlds.save(savingTarget,world,revision);if(generation!==identityGeneration)return;clearTimeout(timer);revision=result.world.revision;
      const latest=window.battleBrosWorldBridge.matches(savingTarget)?window.battleBrosWorldBridge.capture():world;worlds.draft(savingTarget,latest,revision);
      el('[data-world-status]').textContent='Saved to backend, revision '+revision+'. Publishing…'+(contentHash(visualWorld(latest))!==contentHash(visualWorld(world))?' Newer edits remain in your local draft.':'');
    }finally{worldBusy=false;render();}
  }
  el('[data-cloud]').onclick=()=>worldAction(()=>openWorld({cloud:true}));
  document.addEventListener('battlebros:training-entered',()=>appearance.beginTraining());
  document.addEventListener('battlebros:training-exited',event=>action(()=>{const pending=appearance.finishTraining();if(pending&&event.detail)event.detail.pending=true;return pending;}));
  document.addEventListener('battlebros:appearance-edited',()=>{try{appearance.draft();}catch(e){error(e);}});
  broSelect.onchange=()=>{selected=broSelect.value;selectBro();render();};
  el('[data-open]').onclick=()=>worldAction(openWorld);el('[data-save]').onclick=()=>worldAction(saveWorld);el('[data-refresh]').onclick=()=>action(refresh);
  document.addEventListener('battlebros:world-edited',()=>{
    if(!worlds||switching||!activeTarget||!active()||!window.battleBrosWorldBridge?.matches(activeTarget))return;
    clearTimeout(timer);const capturedTarget={...activeTarget},capturedRevision=revision;
    timer=setTimeout(()=>{if(switching||!same(activeTarget,capturedTarget)||!active()||!window.battleBrosWorldBridge.matches(activeTarget))return;try{worlds.draft(capturedTarget,window.battleBrosWorldBridge.capture(),capturedRevision);el('[data-world-status]').textContent='Saved locally. Sign “Save world” to sync across devices.';}catch(e){error(e,'[data-world-error]');}},300);
  });
  service.subscribe(render);let identity='';wallet.subscribe(state=>{const next=state.address+':'+state.chainId;if(next===identity)return;identity=next;identityGeneration++;clearTimeout(timer);activeTarget=null;selected='';appearance.reset();render();action(refresh);});
  document.addEventListener('battlebros:transaction-reflected',()=>action(refresh));
  window.addEventListener('focus',()=>{if(Date.now()-lastFocusRefresh>30000){lastFocusRefresh=Date.now();action(refresh);}});
  for(const panel of [root,needsRoot,worldRoot]){
    panel.addEventListener('focusin',()=>{if(document.pointerLockElement)document.exitPointerLock?.();document.dispatchEvent(new CustomEvent('battlebros:wallet-open'));});
    for(const event of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','keydown','keyup','wheel'])panel.addEventListener(event,e=>e.stopPropagation());
  }
  return service;
}
