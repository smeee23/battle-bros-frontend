import { walletSettings } from './config.mjs';
import { createInjectedDriver } from './driver.mjs';
import { createWalletService } from './service.mjs';
import { mountWalletControls } from './ui.mjs';

let storage;
try { storage = window.localStorage; } catch { /* Private browsing can deny storage. */ }
const settings = walletSettings(window.__battleBrosPublicData, location.hostname);
export const wallet = createWalletService(createInjectedDriver(settings, storage), settings);
export { assertTrustedPublication } from './config.mjs';
for (const root of document.querySelectorAll('[data-wallet-controls]')) mountWalletControls(root, wallet);
// Does not ask for accounts or signatures on a fresh visit.
wallet.reconnect();
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
