import {decodeEventLog} from 'viem';
import {contractAbis} from './contract-abis.mjs';
export function createPracticeChallenge({transactions,wallet,settings=wallet.settings,wait=()=>new Promise(r=>setTimeout(r,1500))}){
 return async function challenge({tokenId,choices,onStatus=()=>{},signal}){
  if(!transactions)throw Error('Configure the local chain and connect your wallet before starting an onchain battle.');
  const client=transactions.client,address=settings.deployment.contracts.combat;
  const check=()=>{if(signal?.aborted)throw Error('Battle preparation closed. Any submitted transaction continues onchain.');};
  const read=(functionName,args,extra={})=>client.readContract({address,abi:contractAbis.combat,functionName,args,...extra});
  check();onStatus('Checking location 2…');
  const raw=await read('locations',[2n]);
  const location=Array.isArray(raw)?Object.fromEntries(contractAbis.combat.find(f=>f.name==='locations').outputs.map((f,i)=>[f.name,raw[i]])):raw;
  if(location.occupant===0n)throw Error('Location 2 has no defender. Claim it with another BRO first.');
  if(location.occupant===BigInt(tokenId))throw Error('This BRO defends location 2. Select a different BRO to attack.');
  if(location.pending!==0n)throw Error('Location 2 already has a pending battle.');
  const defender=await client.readContract({address:settings.deployment.contracts.bros,abi:contractAbis.bros,functionName:'broState',args:[location.occupant]});
  const block=await client.getBlock();check();onStatus('Confirm the challenge in your wallet…');
  const sent=await transactions.submit({contract:'combat',functionName:'challenge',args:[2n,BigInt(tokenId),choices.action,choices.power,location.nonce,defender.defenseNonce,block.timestamp+300n,choices.defenseWeights],conflictKey:'practice-challenge:'+tokenId,label:'Challenge location 2'});
  let id=null;
  for(;;){
   check();await transactions.poll();check();
   const tx=transactions.list().find(r=>r.id===sent.id);
   if(['failed','rejected','cancelled','replaced','interrupted'].includes(tx?.phase))throw Error(tx.error||'Challenge transaction did not complete.');
   if(['confirmed','reflected'].includes(tx?.phase)){
    if(id===null){const receipt=await client.getTransactionReceipt({hash:tx.hash});
     for(const log of receipt.logs){if(log.address.toLowerCase()!==address.toLowerCase())continue;
      try{const e=decodeEventLog({abi:contractAbis.combat,data:log.data,topics:log.topics});if(e.eventName==='ChallengeAccepted'&&String(e.args.attacker)===String(tokenId))id=e.args.challenge;}catch{}
     }
     if(id===null)throw Error('Confirmed transaction contains no matching challenge.');
    }
    const head=await client.getBlockNumber(),safe=head-BigInt((settings.confirmations??12)-1);
    const battle=await read('challengeState',[id],{blockNumber:safe});
    if(Number(battle.status)!==0&&(battle.attacker!==BigInt(tokenId)||battle.location!==2n))throw Error('Battle identity changed. Refresh the chain state before continuing.');
    if(Number(battle.status)===2){check();onStatus('Battle settled. Entering practice…');return {challengeId:String(id),transactionHash:tx.hash};}
    if(Number(battle.status)===3)throw Error('The onchain battle expired. Practice has not started.');
    onStatus('Challenge confirmed. Waiting for VRF and onchain settlement…');
   }else onStatus(tx?.phase==='unknown'?'Checking transaction status. Do not submit again…':'Challenge submitted. Waiting for confirmations…');
   await wait();
  }
 };
}
