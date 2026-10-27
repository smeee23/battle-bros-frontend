import ABI from './assets/territory-abi.json' with {type:'json'};

const $=id=>document.getElementById(id), cfg=window.__battleBrosPublicData??{}, params=new URLSearchParams(location.search);
const status=$('status');let manifestUrl=params.get('manifestUrl')||cfg.manifestUrl,manifest,doc,account=null;
const submittedRegistrations=new Map();
const u=x=>BigInt(x??0), short=x=>x?`${x.slice(0,6)}…${x.slice(-4)}`:'—', fmt=(x,d=18)=>{
  const n=u(x),unit=10n**BigInt(d),whole=n/unit,frac=(n%unit).toString().padStart(d,'0').slice(0,4).replace(/0+$/,'');
  return frac?`${whole}.${frac}`:String(whole);
};
function setStatus(message,error=false){status.textContent=message;status.classList.toggle('error',error);}
async function getJson(url,label){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${label}: HTTP ${r.status}`);return r.json();}
function contract(key){const value=doc.contracts[key];if(!/^0x[0-9a-fA-F]{40}$/.test(value||''))throw new Error(`Missing ${key} contract address in the published state.`);return value;}
function encodeValue(type,value){
  if(type.endsWith(']')){const n=Number(type.slice(type.lastIndexOf('[')+1,-1));if(!Array.isArray(value)||value.length!==n)throw new Error(`Invalid ${type}`);return value.map(v=>encodeValue(type.slice(0,type.lastIndexOf('[')),v)).join('');}
  if(type==='address')return value.toLowerCase().replace(/^0x/,'').padStart(64,'0');
  if(type==='bool')return value?'1'.padStart(64,'0'):'0'.repeat(64);
  if(/^uint(\d+)?$/.test(type)){const n=u(value);if(n<0n||n>=1n<<256n)throw new Error('Integer out of range');return n.toString(16).padStart(64,'0');}
  throw new Error(`Unsupported transaction input ${type}`);
}
export function encode(abiName,fnName,args){
 const fn=ABI[abiName].find(x=>x.name===fnName&&x.inputs.length===args.length);if(!fn)throw new Error(`Missing ${abiName}.${fnName} ABI`);
 const size=t=>t.endsWith(']')?Number(t.slice(t.lastIndexOf('[')+1,-1))*32:32;
 let offset=fn.inputs.reduce((n,x)=>n+size(x.type),0),tail='';
 const head=fn.inputs.map((x,i)=>{if(x.type!=='string')return encodeValue(x.type,args[i]);
   const bytes=new TextEncoder().encode(args[i]);if(!bytes.length||bytes.length>128)throw Error('Name must be 1–128 UTF-8 bytes');
   const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
   const part=encodeValue('uint256',bytes.length)+hex.padEnd(Math.ceil(bytes.length/32)*64,'0');
   const pointer=encodeValue('uint256',offset);offset+=part.length/2;tail+=part;return pointer;
 }).join('');return fn.selector+head+tail;
}
async function transact(key,name,args,value='0x0'){
  if(!account)throw new Error('Connect your wallet first.');
  const chain=await window.ethereum.request({method:'eth_chainId'});
  if(BigInt(chain)!==u(doc.chainId))throw new Error(`Switch wallet to chain ${doc.chainId} before submitting.`);
  const data=encode(key,name,args),to=contract(({TerritoryCombat:'combat',TerritoryMatchmaker:'matchmaker',TerritoryBro:'bros',NeedsOracle:'needs',StETH:'stETH'})[key]);
  const tx={from:account,to,data,...(value!=='0x0'?{value}: {})};
  await window.ethereum.request({method:'eth_call',params:[tx,'latest']});
  const hash=await window.ethereum.request({method:'eth_sendTransaction',params:[tx]});
  setStatus(`Transaction submitted: ${hash}`);
  for(let i=0;i<90;i++){
    const receipt=await window.ethereum.request({method:'eth_getTransactionReceipt',params:[hash]});
    if(receipt){if(receipt.status==='0x0')throw new Error(`Transaction reverted: ${hash}`);if(name==='challenge')submittedRegistrations.set(String(args[1]),BigInt(receipt.blockNumber));await refresh();setStatus(name==='challenge'?'Registration submitted; awaiting confirmed game state.':'Transaction included; awaiting confirmed game state.');return hash;}
    await new Promise(r=>setTimeout(r,1500));
  }
  setStatus(`Transaction is still pending: ${hash}`);return hash;
}
async function connect(){
  if(!window.ethereum)throw new Error('No injected wallet was found.');
  const [address]=await window.ethereum.request({method:'eth_requestAccounts'});account=address;
  $('connect').textContent=short(account);await refresh();
}
function broLabel(b){return b.name ? `${b.name} (#${b.tokenId})` : `#${b.tokenId}`;}
function broBy(id){return doc.battleBros.find(b=>String(b.tokenId)===String(id));}
function ownerIds(){return account?doc.battleBros.filter(b=>b.active&&b.owner?.toLowerCase()===account.toLowerCase()):[];}
function labelLevels(loc){return loc.maxLevel==='0' ? (loc.minLevel==='1'?'Open · Any level':`Level ${loc.minLevel}+`) : `Levels ${loc.minLevel}–${loc.maxLevel}`;}
function make(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function makeSelect(items,value){const s=document.createElement('select');for(const x of items){const o=document.createElement('option');o.value=x.value;o.textContent=x.label;s.append(o);}if(value!==undefined)s.value=String(value);return s;}
function button(text,fn,cls=''){const b=make('button',cls,text);b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){setStatus(e.shortMessage||e.message||String(e),true);}finally{b.disabled=false;}});return b;}
function countdown(until,ended){const n=make('span','muted');n.dataset.until=String(until);n.dataset.ended=ended;return n;}
function updateCountdowns(){for(const n of document.querySelectorAll('[data-until]')){const seconds=Math.max(0,Number(n.dataset.until)-Math.floor(Date.now()/1000));n.textContent=seconds?`${Math.floor(seconds/60)}m ${seconds%60}s remaining`:n.dataset.ended;}}
function render(){
  for(const [token,block] of submittedRegistrations)if(u(doc.snapshot.blockNumber)>=block)submittedRegistrations.delete(token);
  $('snapshot').textContent=`Block ${doc.snapshot.blockNumber} · ${new Date(Number(doc.snapshot.timestamp)*1000).toLocaleString()} · ${doc.needs.activeTokenIds.length} BattleBros with an active need`;
  $('population').textContent=`${doc.locations.length} locations · ${doc.battleBros.filter(b=>b.active).length} active BattleBros`;
  const own=ownerIds(), management=$('management');management.replaceChildren();management.hidden=!account;
  if(account){
    management.append(button('Request today’s needs seed',()=>transact('NeedsOracle','requestNeeds',[]),'secondary'));
    management.append(button('Mint with 1 ETH',()=>transact('TerritoryBro','mintWithETH',[],'0x'+(10n**18n).toString(16))));
    management.append(button('Approve 1 stETH',()=>transact('StETH','approve',[contract('vault'),10n**18n]),'secondary'),button('Mint with 1 stETH',()=>transact('TerritoryBro','mintWithStETH',[])));
    if(own.some(b=>b.hatchedAt==='0')){const unhatched=makeSelect(own.filter(b=>b.hatchedAt==='0').map(b=>({value:b.tokenId,label:`Unhatched #${b.tokenId}`})));
      const name=document.createElement('input');name.placeholder='BattleBro name';name.setAttribute('aria-label','BattleBro name');management.append(name);
      management.append(unhatched,button('Hatch with balanced weights',()=>transact('TerritoryBro','hatch',[unhatched.value,0,[3334,3333,3333],[3334,3333,3333],name.value]),'secondary'));}
    for(const b of own.filter(b=>b.hatchedAt==='0'))management.append(button(`Withdraw unhatched #${b.tokenId}`,()=>transact('TerritoryBro','withdrawAll',[b.tokenId]),'danger'));
    const hatchedBros=own.filter(b=>b.hatchedAt!=='0');
    if(hatchedBros.length){const select=makeSelect(hatchedBros.map(b=>({value:b.tokenId,label:`${broLabel(b)} · Level ${b.level}`})));
      const chosen=()=>broBy(select.value);management.append(select);
      const care=button('Care',()=>transact('TerritoryBro','care',[select.value]),'secondary');
      const sync=button('Sync needs',()=>transact('TerritoryBro','syncNeeds',[select.value,32]),'secondary');
      const settle=button('Settle training',()=>transact('TerritoryBro','settle',[select.value]),'secondary');
      const vacate=button('Vacate',()=>transact('TerritoryCombat','vacate',[select.value]),'secondary');
      const departure=button('Request departure after pending challenge',()=>transact('TerritoryCombat','requestDeparture',[select.value]),'secondary');
      management.append(care,sync,settle,vacate,departure);
      const weights=document.createElement('input');weights.value='3334,3333,3333';weights.setAttribute('aria-label','Three comma-separated training weights totaling 10000');weights.placeholder='3334,3333,3333';
      const defenseWeights=document.createElement('input');defenseWeights.value='2000,6000,2000';defenseWeights.setAttribute('aria-label','Three comma-separated defense weights totaling 10000');defenseWeights.placeholder='2000,6000,2000';
      const parseWeights=input=>{const values=input.value.split(',').map(x=>Number(x.trim()));if(values.length!==3||values.some(x=>!Number.isInteger(x)||x<0||x>10000)||values.reduce((a,x)=>a+x,0)!==10000)throw new Error('Weights must be three integers totaling 10000.');return values;};
      management.append(weights,button('Set training weights',()=>transact('TerritoryBro','setWeights',[select.value,parseWeights(weights),false]),'secondary'),defenseWeights,button('Set defense weights',()=>transact('TerritoryBro','setWeights',[select.value,parseWeights(defenseWeights),true]),'secondary'));
      const withdraw=button('Withdraw & burn',()=>transact('TerritoryBro','withdrawAll',[select.value]),'danger');
      const syncSelected=()=>{const b=chosen();care.disabled=!b?.need.active;vacate.disabled=!b||b.locationId===null||b.pendingChallengeId!==null;departure.disabled=!b||b.locationId===null||b.pendingChallengeId===null;withdraw.disabled=!b||b.locationId!==null||b.pendingChallengeId!==null;};select.addEventListener('change',syncSelected);syncSelected();management.append(withdraw);
    }
  }
  const root=$('locations');root.replaceChildren();
  for(const loc of [...doc.locations].sort((a,b)=>Number(a.locationId)-Number(b.locationId))){
    const card=make('article','card location'),id=String(loc.locationId),occupied=u(loc.occupant)!==0n,def=occupied?broBy(loc.occupant):null;
    card.append(make('span','pill',labelLevels(loc)),make('h3','',`Location ${id}`));
    const pool=doc.registrations.find(r=>r.registrationId===loc.pendingChallengeId);
    const now=Math.floor(Date.now()/1000),cooling=u(loc.cooldownUntil)>BigInt(now);
    const open=pool?.status==='REGISTERING'&&now<Number(pool.closesAt);
    const phase=pool?.status==='REGISTERING'?(open?'Registration open':'Registration closed; awaiting confirmed update'):pool?.status==='PENDING'?'Battle pending':cooling?'Territory cooldown':occupied?'Available for challenge':'Vacant';
    const stats=make('div','stats');
    for(const [k,v] of [['Status',phase],['Defender',def?`${broLabel(def)} · Level ${def.level}`:'—'],['Started',loc.occupiedAt!=='0'?new Date(Number(loc.occupiedAt)*1000).toLocaleString():'—'],['Pot',`${fmt(loc.potShares)} stETH shares`]]){stats.append(make('span','muted',k),make('span','',v));}
    card.append(stats);
    if(pool){card.append(make('p','',`${pool.count} registered attackers · 1/${pool.count} territory chance per Bro · ${u(pool.count)%2n===1n?'all attackers':`${u(pool.count)-1n}/${pool.count} attackers`} can battle at this count`));
      if(pool.status==='REGISTERING')card.append(countdown(pool.closesAt,'Registration closed; awaiting confirmed update'));
      for(const entry of Object.values(pool.entries).filter(e=>e.owner.toLowerCase()===account?.toLowerCase()))card.append(make('p','',`Your BattleBro #${entry.token} is registered · ${entry.power} power and ${fmt(entry.sideStakeShares)} stETH shares maximum exposure.`));
      if(pool.selectedToken)card.append(make('p','',`Selected attacker: #${pool.selectedToken}`));
    } else if(cooling)card.append(countdown(loc.cooldownUntil,'Cooldown elapsed; refresh confirmed state'));
    for(const r of doc.registrations.filter(r=>r.location===id&&['RESOLVED','EXPIRED'].includes(r.status)).slice(-1)){
      const battle=doc.challenges.find(c=>c.challengeId===r.registrationId);
      card.append(make('p','muted',r.status==='RESOLVED'?`Last battle: attacker #${r.selectedToken}; winner #${battle?.winner??'—'}. Other entrants await side battles or a bye.`:'Previous registration expired; all commitments released automatically.'));
    }
    if(def){const weights=make('p','muted',`Defense weights · Attack ${fmt(def.defense[0],2)}% · Defend ${fmt(def.defense[1],2)}% · Counter ${fmt(def.defense[2],2)}%`);
      const reserves=make('p','muted',`Projected reserves · ${def.projectedReserves.join(' / ')} · capacity ${def.capacity}`);card.append(weights,reserves);
    }
    const controls=make('div','row');
    const available=own.filter(b=>b.hatchedAt!=='0'&&!submittedRegistrations.has(b.tokenId)&&!b.locationId&&b.pendingChallengeId===null&&!b.need.active&&u(b.level)>=u(loc.minLevel)&&(loc.maxLevel==='0'||u(b.level)<=u(loc.maxLevel)));
    const claimable=available.filter(b=>b.tokenId!==loc.reclaimBlockedTokenId&&b.owner?.toLowerCase()!==loc.reclaimBlockedOwner?.toLowerCase());
    if(!occupied&&loc.enabled&&claimable.length){const token=makeSelect(claimable.map(b=>({value:b.tokenId,label:`Claim with ${broLabel(b)} · Lv ${b.level}`})));
      controls.append(token,button('Claim',()=>transact('TerritoryCombat','claim',[id,token.value,loc.nonce,broBy(token.value).defense])));
    } else if(occupied&&account&&def?.owner?.toLowerCase()!==account.toLowerCase()&&!cooling&&((loc.pendingChallengeId==='0'&&!loc.departing)||open)&&available.length){
      const token=makeSelect(available.map(b=>({value:b.tokenId,label:`Attack with ${broLabel(b)} · Lv ${b.level}`})));
      const action=makeSelect([{value:'0',label:'ATTACK'},{value:'1',label:'DEFEND'},{value:'2',label:'COUNTER'}]);
      const amount=document.createElement('input');amount.type='number';amount.min='1';amount.step='1';amount.value=String(Math.ceil(Number(available[0].capacity)/10));amount.setAttribute('aria-label','Combat power to commit');
      const exposure=make('p','muted');card.append(exposure);
      const attacker=()=>broBy(token.value), refreshAmount=()=>{const b=attacker(),reserve=b?.projectedReserves[Number(action.value)]??'0';amount.max=String(Math.min(Number(b?.capacity??0),Number(reserve)));amount.value=String(Math.ceil(Number(b?.capacity??0)/10));exposure.textContent=`Maximum yield exposure: ${fmt(u(b?.riskableShares)*u(doc.configuration.riskBps)/10000n)} stETH shares. A side battle uses the lesser participant commitment; both spend power. Side XP: up to 4 for a win / 2 for a loss. Fee: ${fmt(doc.configuration.feeBps,2)}% of the losing stake. No side pot contribution.`;};token.addEventListener('change',refreshAmount);action.addEventListener('change',refreshAmount);refreshAmount();
      controls.append(token,action,amount,button(open?'Join registration':'Open 10-minute registration',()=>transact('TerritoryCombat','challenge',[id,token.value,action.value,amount.value,loc.nonce,def.defenseNonce,Math.floor(Date.now()/1000)+300,broBy(token.value).defense])));
    }
    if(loc.pendingChallengeId!=='0'&&account){const challenge=doc.challenges.find(c=>String(c.challengeId)===String(loc.pendingChallengeId));
      if(challenge){if(challenge.status==='REGISTERING'){
          if(Number(doc.snapshot.timestamp)>=Number(challenge.deadline))controls.append(button('Release expired registration',()=>transact('TerritoryCombat','expire',[challenge.challengeId]),'secondary'));
          else if(now>=Number(pool.closesAt))controls.append(button('Advance registration',()=>transact('TerritoryCombat','advanceRegistration',[challenge.challengeId]),'secondary'));
        } else if(challenge.status==='PENDING'&&challenge.randomnessFulfilled){controls.append(button('Resolve challenge',()=>transact('TerritoryCombat','resolve',[challenge.challengeId]),'secondary'));if(challenge.attacker==='0')controls.append(button('Select territory attacker',()=>transact('TerritoryCombat','selectAttacker',[challenge.challengeId]),'secondary'));}
        else if(challenge.status==='PENDING'&&Number(doc.snapshot.timestamp)>=Number(challenge.deadline))controls.append(button('Expire challenge',()=>transact('TerritoryCombat','expire',[challenge.challengeId]),'secondary'));
        else if(challenge.status==='PENDING')controls.append(make('span','muted','Waiting for VRF fulfillment…'));}
    }
    for(const side of doc.sidePools.filter(p=>doc.registrations.find(r=>r.registrationId===p.poolId)?.location===id)){
      card.append(make('p','muted',`Pool #${side.poolId}: ${side.settled}/${side.generated} side battles settled${side.complete?' · complete':''}.`));
      if(side.started&&side.remaining!=='0'&&account)controls.append(button('Pair remaining attackers',()=>transact('TerritoryMatchmaker','advanceMatching',[side.poolId,32]),'secondary'));
      for(const match of doc.sideMatches.filter(m=>m.pool===side.poolId)){
        card.append(make('p','',`Side battle #${match.matchId}: #${match.tokenA} vs #${match.tokenB} · ${fmt(match.stakeShares)} shares each · ${match.status==='RESOLVED'?`winner #${match.winner}`:'pending'}`));
        if(match.status==='PENDING'&&account)controls.append(button(`Resolve side battle #${match.matchId}`,()=>transact('TerritoryMatchmaker','resolveSide',[match.matchId]),'secondary'));
      }
      const registration=doc.registrations.find(r=>r.registrationId===side.poolId);
      for(const e of Object.values(registration.entries).filter(e=>e.disposition==='BYE'))card.append(make('p','muted',`#${e.token} received a bye; power and yield commitment released.`));
    }
    card.append(controls);root.append(card);
  }
  const history=$('history');const rows=doc.history.filter(e=>/Side(MatchResolved|ParticipantReleased)|Registration(Opened|Finalized)|AttackerSelected|Challenge(Resolved|Expired)|OccupancyChanged|Need(sSeedAccepted|Assigned)|CareProvided/.test(e.name)).slice(-40).reverse();
  updateCountdowns();
  history.replaceChildren(...(rows.length?rows.map(e=>{const p=make('p','',`${new Date(Number(e.timestamp)*1000).toLocaleString()} · ${e.name} · block ${e.blockNumber}`);return p;}):[make('p','muted','No territory activity has been indexed yet.') ]));
}
async function refresh(){
  if(!manifestUrl){setStatus('Configure the v4 territory manifest URL in runtime-config.js or pass ?manifestUrl=…',true);return;}
  try{manifest=await getJson(manifestUrl,'Manifest');if(manifest.schemaVersion!==4)throw new Error('This URL points to a v1 round manifest. Configure a territory v4 deployment manifest.');
    const root=new URL('.',new URL(manifestUrl,location.href)),url=new URL(manifest.paths.gameState,root);doc=await getJson(url,'Territory state');
    if(doc.schemaVersion!==4||doc.projectionVersion!==5||manifest.projectionVersion!==5||doc.chainId!==manifest.chainId||doc.deploymentId!==manifest.deploymentId||doc.contracts.combat.toLowerCase()!==manifest.deploymentId.toLowerCase()||JSON.stringify(doc.snapshot)!==JSON.stringify(manifest.snapshot))throw new Error('Manifest and territory snapshot do not match.');
    render();setStatus(`Showing confirmed block ${doc.snapshot.blockNumber}. Transactions are checked against the live contract before submission.`);
  }catch(e){setStatus(e.message||String(e),true);}
}
$('connect').addEventListener('click',()=>connect().catch(e=>setStatus(e.message,true)));
$('refresh').addEventListener('click',()=>refresh());
window.ethereum?.on?.('accountsChanged',accounts=>{account=accounts[0]??null;$('connect').textContent=account?short(account):'Connect wallet';refresh();});
window.ethereum?.on?.('chainChanged',()=>refresh());refresh();

setInterval(updateCountdowns,1000);
