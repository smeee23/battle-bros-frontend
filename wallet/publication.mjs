import {assertTrustedPublication} from './config.mjs';
export async function readTransactionPublication(settings,url,fetcher=fetch) {
  const response=await fetcher(url,{cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('Publication manifest unavailable');
  const manifest=await response.json();
  if(manifest.schemaVersion!==4||manifest.projectionVersion!==5||!/^snapshots\/[a-zA-Z0-9/-]+\.json$/.test(manifest.paths?.gameState??'')||!/^[a-f0-9]{64}$/.test(manifest.contentHash??''))throw Error('Invalid publication manifest');
  const state=await fetcher(new URL(manifest.paths.gameState,url),{cache:'no-store',credentials:'omit'});
  if(!state.ok)throw Error('Published game state unavailable');
  const bytes=await state.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==manifest.contentHash)throw Error('Publication content hash mismatch');
  const document=JSON.parse(new TextDecoder().decode(bytes));
  if(document.schemaVersion!==4||document.projectionVersion!==5||document.chainId!==manifest.chainId||document.deploymentId!==manifest.deploymentId||
    !['blockNumber','blockHash','timestamp'].every(key=>document.snapshot?.[key]===manifest.snapshot?.[key])||!Array.isArray(document.battleBros)||!Array.isArray(document.history))throw Error('Publication identity mismatch');
  assertTrustedPublication(settings,document);
  return document;
}
