import {decodeEventLog} from 'viem';
import {contractAbis} from './contract-abis.mjs';
export function createPracticeChallenge({transactions,wallet,settings=wallet.settings,wait=()=>new Promise(r=>setTimeout(r,1500))}){
 return async function challenge({locationId,expectedDefender,tokenId,choices,onStatus=()=>{},onAccepted=()=>{},resume,signal}){
  if(!transactions)throw Error('Configure the local chain and connect your wallet before starting an onchain battle.');
  const client=transactions.client,address=settings.deployment.contracts.combat;
  let accepted=false,submitted=false;
  const check=()=>{if(signal?.aborted&&!accepted&&!submitted)throw Error('Battle preparation closed. Any submitted transaction continues onchain.');};
  const read=(functionName,args,extra={})=>client.readContract({address,abi:contractAbis.combat,functionName,args,...extra});
  if(!/^[1-9]\d*$/.test(String(locationId)))throw Error('Choose a territory defender first.');
  const locationKey=BigInt(locationId);if(locationKey<1n)throw Error('Invalid territory');
  let sent,id=resume?BigInt(resume.challengeId):null,acceptedBlock=resume?BigInt(resume.acceptedBlock):null;
  if(resume){accepted=true;sent={id:resume.transactionRecordId};}
  else{
  check();onStatus('Checking territory '+locationKey+'…');
  const raw=await read('locations',[locationKey]);
  const location=Array.isArray(raw)?Object.fromEntries(contractAbis.combat.find(f=>f.name==='locations').outputs.map((f,i)=>[f.name,raw[i]])):raw;
  if(expectedDefender!==undefined&&location.occupant!==BigInt(expectedDefender))throw Error('The defender changed. Close this encounter and approach the current defender.');
  if(location.occupant===0n)throw Error('This territory has no defender. Claim it with another BRO first.');
  if(location.occupant===BigInt(tokenId))throw Error('This BRO is the defender. Select a different BRO to attack.');
  if(location.pending!==0n)throw Error('This territory already has a pending battle.');
  const defender=await client.readContract({address:settings.deployment.contracts.bros,abi:contractAbis.bros,functionName:'broState',args:[location.occupant]});
  const block=await client.getBlock();check();onStatus('Confirm the challenge in your wallet…');
  sent=await transactions.submit({contract:'combat',functionName:'challenge',args:[locationKey,BigInt(tokenId),choices.action,choices.power,location.nonce,defender.defenseNonce,block.timestamp+300n,choices.defenseWeights],conflictKey:'practice-challenge:'+tokenId,label:'Challenge territory '+locationKey});submitted=true;

  }
  for(;;){
   check();try{await transactions.poll();check();
   let tx=transactions.list().find(r=>r.id===sent.id);
   if(resume){const receipt=await client.getTransactionReceipt({hash:resume.transactionHash});acceptedBlock=receipt.blockNumber;const head=await client.getBlockNumber();tx={phase:head-acceptedBlock>=BigInt((settings.confirmations??12)-1)?'confirmed':'included',hash:resume.transactionHash};}
   if(['failed','rejected','cancelled','replaced','interrupted'].includes(tx?.phase))throw Object.assign(Error(tx.error||'Challenge transaction did not complete.'),{terminal:true});
   if(['included','confirmed','reflected'].includes(tx?.phase)){
    if(id===null){const receipt=await client.getTransactionReceipt({hash:tx.hash});acceptedBlock=receipt.blockNumber;
     for(const log of receipt.logs){if(log.address.toLowerCase()!==address.toLowerCase())continue;
      try{const e=decodeEventLog({abi:contractAbis.combat,data:log.data,topics:log.topics});if(e.eventName==='ChallengeAccepted'&&String(e.args.attacker)===String(tokenId))id=e.args.challenge;}catch{}
     }
     if(id===null)throw Error('Confirmed transaction contains no matching challenge.');
     accepted=true;onAccepted({challengeId:String(id),locationId:String(locationKey),transactionHash:tx.hash,transactionRecordId:sent.id,acceptedBlock:String(acceptedBlock)});
    }
    if(tx.phase==='included'){await wait();continue;}
    const head=await client.getBlockNumber(),safe=head-BigInt((settings.confirmations??12)-1);
    const battle=await read('challengeState',[id],{blockNumber:safe});
    if(Number(battle.status)!==0&&(battle.attacker!==BigInt(tokenId)||battle.location!==locationKey))throw Object.assign(Error('Battle identity changed. Refresh the chain state before continuing.'),{terminal:true});
    if(Number(battle.status)===2){
      const events=await client.getContractEvents({address,abi:contractAbis.combat,eventName:'ChallengeResolved',args:{challenge:id},fromBlock:acceptedBlock,toBlock:safe});
      const result=events.find(e=>e.args.challenge===id);if(!result)throw Error('Settlement event not available. Refresh before continuing.');
      check();onStatus('Territory battle settled.');return {challengeId:String(id),locationId:String(locationKey),winnerTokenId:String(result.args.winner),playerWon:result.args.winner===BigInt(tokenId),transactionHash:tx.hash};
    }
    if(Number(battle.status)===3)throw Object.assign(Error('Battle expired; no winner was declared. Committed resources were released.'),{terminal:true});
    onStatus('Challenge confirmed. Waiting for VRF and onchain settlement…');
   }else onStatus(tx?.phase==='unknown'?'Checking transaction status. Do not submit again…':'Challenge submitted. Waiting for confirmations…');
   await wait();
   }catch(error){if(!accepted&&!submitted||error.terminal)throw error;onStatus('Reconnecting to battle settlement…');await wait();}
  }
 };
}
