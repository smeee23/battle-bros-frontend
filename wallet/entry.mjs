import {createTerritoryClaim} from './territory-claim.mjs';
import {readPublishedAppearance,readTransactionPublication} from './publication.mjs';
import {createPracticeChallenge} from './practice-challenge.mjs';
import { walletSettings } from './config.mjs';
import { createInjectedDriver } from './driver.mjs';
import { createWalletService } from './service.mjs';
import { mountWalletControls } from './ui.mjs';
import { mountNeedsInfrastructure } from './needs-ui.mjs';

let storage;
try { storage = window.localStorage; } catch { /* Private browsing can deny storage. */ }
const settings = walletSettings(window.__battleBrosPublicData, location.hostname);
export const wallet = createWalletService(createInjectedDriver(settings, storage), settings);
export { assertTrustedPublication } from './config.mjs';
for (const root of document.querySelectorAll('[data-wallet-controls]')) mountWalletControls(root, wallet);
// Does not ask for accounts or signatures on a fresh visit.
const walletReconnectReady=wallet.reconnect();
// Load transaction code only for an explicitly configured deployment/RPC.
export const transactionsReady=settings.rpcUrl&&settings.deployment
  ?import('./transactions.js').then(({createTransactionService})=>{
    const service=createTransactionService({wallet,settings,storage,
      manifestUrl:new URL(window.__battleBrosPublicData.manifestUrl,location.href).href,
      onReflected:record=>{
        document.dispatchEvent(new CustomEvent('battlebros:transaction-reflected',{detail:record}));
        window.hydrateBattleBrosReadModel?.();
      }});
    service.start();window.addEventListener('storage',event=>{if(event.key?.startsWith('battlebros.transactions.v1:'))service.start();});return service;
  }).catch(()=>null):Promise.resolve(null);

if(window.__battleBrosPublicData.localDev?.instanceId){const link=document.getElementById('local-transactions-link');if(link)link.hidden=false;}

transactionsReady.then(async transactions=>{
  await walletReconnectReady;
  mountNeedsInfrastructure({wallet,transactions,storage});
  window.battleBrosWorldLoading?.complete('wallet');
}).catch(error=>window.battleBrosWorldLoading?.fail('wallet',error,'Player setup'));

const pendingBattleKey='battlebros.pending-battles:'+settings.chainId+':'+(settings.deployment?.deploymentId??'none')+':'+(settings.instanceId??settings.anchor?.hash??'chain');
const readPending=()=>{try{const value=JSON.parse(storage?.getItem(pendingBattleKey)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}};
function rememberBattle(id,value){try{const pending=readPending();if(value)pending[id]=value;else delete pending[id];storage?.setItem(pendingBattleKey,JSON.stringify(pending));}catch{}}
window.battleBrosAcknowledgeTerritoryResult=id=>rememberBattle(String(id),null);
window.battleBrosChallengePractice=async options=>{
 const service=await transactionsReady;
 let acceptedId=null;try{
 const result=await createPracticeChallenge({transactions:service,wallet,settings})({...options,onAccepted:accepted=>{
  acceptedId=accepted.challengeId;rememberBattle(accepted.challengeId,{...accepted,tokenId:options.tokenId});options.onAccepted?.(accepted);
 }});
 return result;
 }catch(error){if(error.terminal&&acceptedId)rememberBattle(acceptedId,null);throw error;}
};
transactionsReady.then(service=>{if(!service)return;for(const record of Object.values(readPending())){
 if(!record||!/^\d+$/.test(record.challengeId)||!/^\d+$/.test(record.locationId)||!/^\d+$/.test(record.tokenId)||!/^\d+$/.test(record.acceptedBlock)||!/^0x[0-9a-fA-F]{64}$/.test(record.transactionHash))continue;
 createPracticeChallenge({transactions:service,wallet,settings})({locationId:record.locationId,tokenId:record.tokenId,resume:record}).then(result=>{
  rememberBattle(record.challengeId,null);window.dispatchEvent(new CustomEvent('battlebros:territory-background-result',{detail:result}));
 }).catch(error=>{if(error.terminal){rememberBattle(record.challengeId,null);window.dispatchEvent(new CustomEvent('battlebros:territory-background-result',{detail:{locationId:record.locationId,message:error.message}}));}});
}});


window.battleBrosReadTerritories=()=>readTransactionPublication(settings,new URL(window.__battleBrosPublicData.manifestUrl,location.href).href);
window.battleBrosReadDefenderAppearance=descriptor=>readPublishedAppearance(descriptor,new URL(window.__battleBrosPublicData.manifestUrl,location.href));
window.battleBrosClaimTerritory=async options=>createTerritoryClaim({transactions:await transactionsReady,settings})(options);
