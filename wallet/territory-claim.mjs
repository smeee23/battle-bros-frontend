import {contractAbis} from './contract-abis.mjs';
export function createTerritoryClaim({transactions,settings,wait=()=>new Promise(r=>setTimeout(r,1500))}){
return async({locationId,tokenId,defenseWeights,onStatus=()=>{},signal})=>{
 if(!transactions)throw Error('Configure your chain and connect your wallet first.');
 const check=()=>{if(signal?.aborted)throw Error('Claim window closed. Any submitted transaction continues onchain.');};
 check();const raw=await transactions.client.readContract({address:settings.deployment.contracts.combat,abi:contractAbis.combat,functionName:'locations',args:[BigInt(locationId)]});
 const l=Array.isArray(raw)?Object.fromEntries(contractAbis.combat.find(f=>f.name==='locations').outputs.map((f,i)=>[f.name,raw[i]])):raw;
 if(l.occupant!==0n||!l.enabled)throw Error('This territory is no longer claimable.');
 check();onStatus('Confirm the claim in your wallet…');
 const record=await transactions.submit({contract:'combat',functionName:'claim',args:[BigInt(locationId),BigInt(tokenId),l.nonce,defenseWeights],conflictKey:'claim:'+tokenId,label:'Claim territory '+locationId});
 for(;;){check();await transactions.poll();check();const tx=transactions.list().find(t=>t.id===record.id);
  if(['failed','rejected','replaced','cancelled','interrupted'].includes(tx?.phase))throw Error(tx.error||'Claim failed.');
  if(['confirmed','reflected'].includes(tx?.phase)){onStatus('Territory claimed.');return tx;}
  onStatus('Claim submitted. Waiting for confirmation…');await wait();
 }
};

}
