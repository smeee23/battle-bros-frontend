import {wallet,transactionsReady} from './wallet.js';
const $=id=>document.getElementById(id),config=window.__battleBrosPublicData;
if(!config.localDev?.instanceId||String(config.wallet?.chainId)!=='31337'||!['localhost','127.0.0.1'].includes(location.hostname))throw Error('Local development stack required');
const transactions=await transactionsReady;
if(!transactions)throw Error('Transaction service unavailable. Check the local stack configuration.');
const rpc=document.createElement('p');rpc.textContent='Wallet network RPC: '+config.wallet.rpcUrl+' · Chain ID: 31337';document.querySelector('nav').after(rpc);
const labels={preparing:'Preparing', 'awaiting-wallet':'Awaiting wallet approval',pending:'Pending',unknown:'Submission uncertain; checking chain',included:'Included; awaiting confirmations',confirmed:'Confirmed; awaiting publication',reflected:'Reflected in published game state',failed:'Failed',rejected:'Rejected',interrupted:'Interrupted before submission',replaced:'Replaced by a different transaction',cancelled:'Cancelled'};
async function act(button,operation){button.disabled=true;$('notice').textContent='';try{await operation();}catch(error){$('notice').textContent=error.safeMessage||'Request failed. Check the wallet and transaction history.';}finally{button.disabled=false;refreshButtons();}}
async function command(command,address){const response=await fetch('/api/local-dev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,address})});const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Local command failed'),{safeMessage:result.error||'Local command failed'});$('notice').textContent=command==='addYield'?'Added 1% test yield to existing deposits. Wait for publication, then refresh the Territory dashboard to hatch.':'Local development command completed.';}
function refreshButtons(){for(const id of ['fund','mint','invalid','remember-player'])$(id).disabled=wallet.getState().status!=='connected';
  if(config.localDev.scenario){const matches=wallet.getState().address?.toLowerCase()===config.localDev.scenario.playerAddress.toLowerCase();$('scenario-wallet').textContent=matches?'Connected wallet owns seeded BROs #1–6.':'Connect the seeded player wallet, or use the button below and restart npm run local:dev once to seed to your wallet.';}}
if(config.localDev.scenario){
  const scenario=config.localDev.scenario;$('scenario').hidden=false;$('scenario-owner').textContent='Scenario '+scenario.name+' · Player wallet: '+scenario.playerAddress;
  for(const bro of scenario.roster){const row=document.createElement('p'),link=document.createElement('a');link.href='index.html?battleBroId='+bro.tokenId;link.textContent='BRO #'+bro.tokenId+' · '+bro.role;row.append(link);$('scenario-roster').append(row);}
}
$('remember-player').onclick=event=>act(event.currentTarget,async()=>{await command('rememberPlayer',wallet.getState().address);$('notice').textContent='Wallet remembered. Stop and restart npm run local:dev to rebuild the scenario with BROs #1–6 owned by this wallet.';});
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
