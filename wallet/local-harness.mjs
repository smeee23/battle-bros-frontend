import {wallet,transactionsReady} from './wallet.js';
const $=id=>document.getElementById(id),config=window.__battleBrosPublicData;
if(!config.localDev?.instanceId||String(config.wallet?.chainId)!=='31337'||!['localhost','127.0.0.1'].includes(location.hostname))throw Error('Local development stack required');
const transactions=await transactionsReady;
if(!transactions)throw Error('Transaction service unavailable. Check the local stack configuration.');
const rpc=document.createElement('p');rpc.textContent='Wallet network RPC: '+config.wallet.rpcUrl+' · Chain ID: 31337';document.querySelector('nav').after(rpc);
const labels={preparing:'Preparing', 'awaiting-wallet':'Awaiting wallet approval',pending:'Pending',unknown:'Submission uncertain; checking chain',included:'Included; awaiting confirmations',confirmed:'Confirmed; awaiting publication',reflected:'Reflected in published game state',failed:'Failed',rejected:'Rejected',interrupted:'Interrupted before submission',replaced:'Replaced by a different transaction',cancelled:'Cancelled'};
async function act(button,operation){button.disabled=true;$('notice').textContent='';try{await operation();}catch(error){$('notice').textContent=error.safeMessage||'Request failed. Check the wallet and transaction history.';}finally{button.disabled=false;refreshButtons();}}
async function command(command,address){const response=await fetch('/api/local-dev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,address})});if(!response.ok)throw Error('Local command failed');$('notice').textContent='Local development command completed.';}
function refreshButtons(){for(const id of ['fund','mint','invalid'])$(id).disabled=wallet.getState().status!=='connected';}
wallet.subscribe(refreshButtons);
$('fund').onclick=event=>act(event.currentTarget,()=>command('fund',wallet.getState().address));
for(const [id,value] of [['mint',10n**18n],['invalid',0n]])$(id).onclick=event=>act(event.currentTarget,()=>transactions.submit({contract:'bros',functionName:'mintWithETH',value,label:'Mint BattleBro'}));
for(const button of document.querySelectorAll('[data-command]'))button.onclick=()=>act(button,()=>command(button.dataset.command));
transactions.subscribe(records=>{
  const root=$('transactions');root.replaceChildren();
  for(const record of records.toReversed()){
    const card=document.createElement('article'),title=document.createElement('strong'),hash=document.createElement('p'),status=document.createElement('p');
    title.textContent=record.label+' · '+(labels[record.phase]||record.phase);hash.textContent=record.hash??'No transaction hash yet';
    status.textContent=record.error||`Sender ${record.from} · ${record.confirmations} confirmations${record.replacement?' · '+record.replacement:''}`;
    card.append(title,hash,status);
    if(record.result?.tokenId){const link=document.createElement('a');link.href='index.html?battleBroId='+encodeURIComponent(record.result.tokenId);link.textContent='Enter Home with BattleBro #'+record.result.tokenId;card.append(link);}
    if(['pending','unknown'].includes(record.phase)&&record.hash){for(const [text,cancel] of [['Speed up',false],['Cancel',true]]){const button=document.createElement('button');button.textContent=text;button.onclick=()=>act(button,()=>transactions.replace(record.id,cancel));card.append(button);}}
    root.append(card);
  }
  if(transactions.storageWarning)$('notice').textContent=transactions.storageWarning;
  else if(transactions.error)$('notice').textContent=transactions.error;
  else $('notice').textContent='';
});
