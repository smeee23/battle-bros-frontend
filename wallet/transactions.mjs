import {createPublicClient,createWalletClient,http,custom,encodeFunctionData,decodeEventLog,keccak256} from 'viem';
import {mainnet,sepolia,hoodi,hardhat} from 'viem/chains';
import {contractAbis} from './contract-abis.mjs';
import {readTransactionPublication} from './publication.mjs';

const address=value=>/^0x[0-9a-fA-F]{40}$/.test(value??''),hash=value=>/^0x[0-9a-fA-F]{64}$/.test(value??'');
const phases=new Set(['preparing','awaiting-wallet','pending','unknown','included','confirmed','reflected','failed','rejected','interrupted','replaced','cancelled']);
const moduleErrors=Object.values(contractAbis).flat().filter(item=>item.type==='error');
const tracking=record=>['pending','unknown','included'].includes(record.phase)||record.phase==='confirmed'&&record.awaitPublication;
function issue(message){return Object.assign(Error(message),{safeMessage:message});}
export function transactionError(error) {
  for(let cause=error,depth=0;cause&&depth<10;cause=cause.cause,depth++){
    if(cause.safeMessage)return cause.safeMessage;
    if(Number(cause.code)===4001||cause.name==='UserRejectedRequestError')return 'Wallet request declined.';
    if(cause.name==='ContractFunctionRevertedError')return `Contract rejected the action: ${String(cause.reason||cause.data?.errorName||'execution reverted').slice(0,160)}`;
    if(cause.name==='InsufficientFundsError')return 'Not enough ETH for the transaction and gas.';
    if(cause.message?.startsWith('Wallet account or network changed'))return 'Wallet account or network changed. Prepare the action again.';
    if(cause.message==='Connect your wallet to the configured network first.')return cause.message;
  }
  return 'RPC or wallet request failed. Check the connection and transaction status before retrying.';
}
export function createTransactionService({wallet,settings=wallet.settings,storage,manifestUrl,fetcher=fetch,client,pollInterval=1500,onReflected=()=>{}}) {
  if(!settings.rpcUrl||!settings.deployment)throw issue('Configure an RPC and trusted deployment before submitting transactions.');
  const chain=[mainnet,sepolia,hoodi,hardhat].find(item=>item.id===settings.chainId);
  if(!chain)throw issue('Unsupported transaction network.');
  client??=createPublicClient({chain,transport:http(settings.rpcUrl,{retryCount:0,timeout:10000}),cacheTime:0});
  const confirmations=settings.confirmations??12;
  const scope=`${settings.chainId}:${settings.deployment.deploymentId.toLowerCase()}:${settings.instanceId??'chain'}`;
  const storageKey='battlebros.transactions.v1:'+scope,records=new Map(),listeners=new Set();
  let timer,stopped=true,polling=false,submitting=false,storageWarning='',lastError='';
  function readStored(){try{const raw=storage?.getItem(storageKey);return raw&&raw.length<1000000?JSON.parse(raw):[];}catch{return [];}}
  function valid(record){return record&&typeof record.id==='string'&&record.scope===scope&&phases.has(record.phase)&&address(record.from)&&address(record.to)&&
    (record.hash===null||hash(record.hash))&&hash(record.dataHash)&&(record.nonce===null||Number.isSafeInteger(record.nonce)&&record.nonce>=0)&&/^\d+$/.test(record.value)&&/^\d+$/.test(record.startBlock)&&typeof record.updatedAt==='number';}
  function merge(){const stored=readStored();if(!Array.isArray(stored))return;for(const record of stored.slice(-100))if(valid(record)&&(!records.has(record.id)||records.get(record.id).updatedAt<record.updatedAt))records.set(record.id,record);}
  merge();for(const record of records.values())if(['preparing','awaiting-wallet'].includes(record.phase)){record.phase=record.nonce===null?'interrupted':'unknown';}
  const list=()=>[...records.values()].map(record=>({...record,result:record.result?{...record.result}:null}));
  function notify(){for(const listener of listeners)listener(list());}
  function persist(){
    try{if(!storage)throw Error('Storage unavailable');storage.setItem(storageKey,JSON.stringify([...records.values()].slice(-100)));storageWarning='';}
    catch{storageWarning='Transaction history cannot be saved in this browser. Keep this page open while transactions are pending.';}
  }
  function change(record,patch){Object.assign(record,patch,{updatedAt:Math.max(Date.now(),record.updatedAt+1)});persist();notify();}
  async function validateNetwork(){
    if(await client.getChainId()!==settings.chainId)throw issue('Application RPC is on the wrong network.');
    if(settings.anchor){const block=await client.getBlock({blockNumber:BigInt(settings.anchor.number)});if(block.hash!==settings.anchor.hash)throw issue('Local chain was reset. Restart the local stack and reload this page.');}
  }
  async function validateSession(session){
    await session.assertCurrent();
    if(settings.anchor){
      const block=await session.provider.request({method:'eth_getBlockByNumber',params:['0x'+BigInt(settings.anchor.number).toString(16),false]});
      if(block?.hash!==settings.anchor.hash)throw issue('Your wallet is connected to a different local chain. Update its local RPC URL and retry.');
    }
  }
  function schedule(){if(!stopped&&!timer&&[...records.values()].some(tracking))timer=setTimeout(async()=>{timer=null;await poll();schedule();},pollInterval);}
  function decodedResult(record,receipt){
    if(record.contract!=='bros'||!['mintWithETH','mintWithStETH'].includes(record.functionName))return null;
    for(const log of receipt.logs){if(log.address.toLowerCase()!==record.to.toLowerCase())continue;
      try{const event=decodeEventLog({abi:contractAbis.bros,data:log.data,topics:log.topics});if(event.eventName==='BroMinted'&&event.args.owner.toLowerCase()===record.from.toLowerCase())return {type:'bro-mint',tokenId:String(event.args.token)};}catch{}
    }
    return null;
  }
  async function detectReplacement(record,head){
    let cursor=BigInt(record.scanBlock??record.startBlock),limit=cursor+24n;if(limit>head)limit=head;
    for(;cursor<=limit;cursor++){
      const block=await client.getBlock({blockNumber:cursor,includeTransactions:true});
      const tx=block.transactions.find(tx=>typeof tx!=='string'&&tx.from.toLowerCase()===record.from.toLowerCase()&&tx.nonce===record.nonce);
      if(tx){
        const same=tx.to?.toLowerCase()===record.to.toLowerCase()&&String(tx.value)===record.value&&keccak256(tx.input)===record.dataHash;
        const cancellation=tx.to?.toLowerCase()===record.from.toLowerCase()&&tx.value===0n&&tx.input==='0x';
        change(record,{hash:tx.hash,scanBlock:String(cursor),replacement:!same?(cancellation?'cancelled':'replaced'):record.originalHash&&tx.hash!==record.originalHash?'repriced':null});
        return await client.getTransactionReceipt({hash:tx.hash});
      }
    }
    change(record,{scanBlock:String(cursor)});return null;
  }
  async function poll(){
    if(polling)return;polling=true;
    try{
      lastError='';merge();const pending=[...records.values()].filter(tracking);if(!pending.length)return;
      await validateNetwork();const head=await client.getBlockNumber();let publication;
      for(const record of pending){
        let receipt=null;
        if(record.hash){try{receipt=await client.getTransactionReceipt({hash:record.hash});}catch(error){if(error.name!=='TransactionReceiptNotFoundError')throw error;}}
        if(!receipt){
          if(record.blockHash)change(record,{phase:'pending',blockHash:null,blockNumber:null,result:null,scanBlock:record.startBlock});
          receipt=await detectReplacement(record,head);
        }
        if(!receipt)continue;
        const block=await client.getBlock({blockNumber:receipt.blockNumber});
        if(block.hash!==receipt.blockHash){change(record,{phase:'pending',blockHash:null,blockNumber:null,result:null,scanBlock:record.startBlock});continue;}
        const included=Number(head-receipt.blockNumber+1n);
        const confirmed=included>=confirmations;
        const patch={blockNumber:String(receipt.blockNumber),blockHash:receipt.blockHash,confirmations:Math.max(0,included),
          phase:confirmed?'confirmed':'included',result:record.replacement==='cancelled'||record.replacement==='replaced'?null:decodedResult(record,receipt),error:''};
        if(confirmed&&receipt.status==='reverted'){patch.phase='failed';patch.error='Transaction reverted.';}
        else if(confirmed&&['cancelled','replaced'].includes(record.replacement))patch.phase=record.replacement;
        change(record,patch);
        if(record.phase==='confirmed'&&record.awaitPublication&&manifestUrl){
          try{
            publication??=await readTransactionPublication(settings,manifestUrl,fetcher);
            if(BigInt(publication.snapshot.blockNumber)<receipt.blockNumber)continue;
            const snapshotBlock=await client.getBlock({blockNumber:BigInt(publication.snapshot.blockNumber)});
            if(snapshotBlock.hash!==publication.snapshot.blockHash)continue;
            const reflected=record.result?.type==='bro-mint'?publication.battleBros.some(b=>String(b.tokenId)===record.result.tokenId):publication.history.some(event=>event.transactionHash===record.hash);
            if(reflected){change(record,{phase:'reflected',publicationBlock:publication.snapshot.blockNumber});try{onReflected({...record},publication);}catch{}}
          }catch{lastError='Waiting for a valid confirmed publication.';}
        }
      }
      if(!lastError.startsWith('Waiting'))lastError='';
    }catch(error){lastError=transactionError(error);notify();}
    finally{polling=false;notify();}
  }
  async function submit(action){
    if(submitting)throw issue('Another wallet submission is already being prepared.');
    submitting=true;let record;
    try{
      merge();const session=await wallet.session();
      const ownAbi=contractAbis[action.contract],abi=ownAbi?[...ownAbi,...moduleErrors]:null,to=settings.deployment.contracts[action.contract];
      if(!abi||!address(to)||!abi.some(fn=>fn.type==='function'&&fn.name===action.functionName&&!['view','pure'].includes(fn.stateMutability)))throw issue('Unknown write function or untrusted contract.');
      if([...records.values()].some(r=>tracking(r)&&r.from.toLowerCase()===session.address.toLowerCase()&&r.conflictKey===(action.conflictKey??action.contract+':'+action.functionName)))throw issue('This action already has a pending transaction.');
      const args=action.args??[],value=BigInt(action.value??0),data=encodeFunctionData({abi,functionName:action.functionName,args});
      record={id:crypto.randomUUID(),scope,phase:'preparing',contract:action.contract,functionName:action.functionName,conflictKey:action.conflictKey??action.contract+':'+action.functionName,
        label:String(action.label??action.functionName).slice(0,80),from:session.address,to,value:String(value),dataHash:keccak256(data),nonce:null,hash:null,originalHash:null,
        startBlock:'0',scanBlock:'0',confirmations:0,awaitPublication:action.awaitPublication!==false,updatedAt:Date.now(),result:null,error:''};
      records.set(record.id,record);change(record,{});
      await validateNetwork();const code=await client.getCode({address:to});if(!code||code==='0x')throw issue('No deployed contract at the configured address.');
      const simulation=await client.simulateContract({address:to,abi,functionName:action.functionName,args,value,account:session.address});
      const start=await client.getBlockNumber(),nonce=await client.getTransactionCount({address:session.address,blockTag:'pending'});
      await validateSession(session);change(record,{phase:'awaiting-wallet',nonce,startBlock:String(start),scanBlock:String(start)});
      const walletClient=createWalletClient({chain,account:session.address,transport:custom(session.provider)});
      const hash=await walletClient.writeContract({...simulation.request,nonce});
      change(record,{phase:'pending',hash,originalHash:hash});schedule();return {...record};
    }catch(error){
      if(record){const message=transactionError(error),rejected=message==='Wallet request declined.';
        const unknown=record.phase==='awaiting-wallet'&&!rejected&&!message.startsWith('Not enough ETH')&&!message.startsWith('Contract rejected');
        change(record,{phase:rejected?'rejected':unknown?'unknown':'failed',error:unknown?'Wallet response interrupted. Checking the chain; do not submit again yet.':message});schedule();
      }
      throw issue(record?.error||transactionError(error));
    }finally{submitting=false;}
  }
  async function replace(id,cancel=false){
    if(submitting)throw issue('Another wallet submission is already being prepared.');
    const record=records.get(id);if(!record||!['pending','unknown'].includes(record.phase)||!record.hash)throw issue('Only a known pending transaction can be replaced.');
    submitting=true;
    try{
    await validateNetwork();const session=await wallet.session();
    if(session.address.toLowerCase()!==record.from.toLowerCase())throw issue('Reconnect the wallet that submitted this transaction.');
    const tx=await client.getTransaction({hash:record.hash}),price=await client.getGasPrice();
    if(tx.blockNumber!==null)throw issue('Transaction is already included.');
    await validateSession(session);const walletClient=createWalletClient({chain,account:session.address,transport:custom(session.provider)});
    const bump=n=>{const value=(n??price)*12n/10n+1n;return value>price*2n?value:price*2n;};
    const replacementHash=await walletClient.sendTransaction({to:cancel?record.from:tx.to,data:cancel?'0x':tx.input,value:cancel?0n:tx.value,nonce:record.nonce,
      ...(tx.type==='eip1559'?{maxFeePerGas:bump(tx.maxFeePerGas),maxPriorityFeePerGas:bump(tx.maxPriorityFeePerGas)}:{gasPrice:bump(tx.gasPrice)}),
      ...(cancel?{gas:21000n}:{})});
    change(record,{hash:replacementHash,replacement:cancel?'cancelled':'repriced',phase:'pending',error:''});schedule();return replacementHash;
    }finally{submitting=false;}
  }
  return {list,subscribe(fn){listeners.add(fn);fn(list());return()=>listeners.delete(fn);},
    submit:action=>globalThis.navigator?.locks?globalThis.navigator.locks.request(storageKey,()=>submit(action)):submit(action),replace,poll,
    start(){stopped=false;poll().finally(schedule);},stop(){stopped=true;clearTimeout(timer);timer=null;},
    get error(){return lastError;},get storageWarning(){return storageWarning;},client};
}
