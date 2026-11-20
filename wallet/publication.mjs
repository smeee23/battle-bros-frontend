import {assertTrustedPublication} from './config.mjs';
import {contentHash,validateAppearance} from '../../battle-bros-backend/packages/shared/src/world-save.mjs';
export async function readTransactionPublication(settings,url,fetcher=fetch) {
  const response=await fetcher(url,{cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('Publication manifest unavailable');
  const manifest=await response.json();
  if(manifest.schemaVersion!==5||manifest.projectionVersion!==6||!/^snapshots\/[a-zA-Z0-9/-]+\.json$/.test(manifest.paths?.gameState??'')||!/^[a-f0-9]{64}$/.test(manifest.contentHash??''))throw Error('Invalid publication manifest');
  const state=await fetcher(new URL(manifest.paths.gameState,url),{cache:'no-store',credentials:'omit'});
  if(!state.ok)throw Error('Published game state unavailable');
  const bytes=await state.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==manifest.contentHash)throw Error('Publication content hash mismatch');
  const document=JSON.parse(new TextDecoder().decode(bytes));
  if(document.schemaVersion!==5||document.projectionVersion!==6||document.chainId!==manifest.chainId||document.deploymentId!==manifest.deploymentId||
    !['blockNumber','blockHash','timestamp'].every(key=>document.snapshot?.[key]===manifest.snapshot?.[key])||!Array.isArray(document.battleBros)||!Array.isArray(document.history))throw Error('Publication identity mismatch');
  assertTrustedPublication(settings,document);
  return document;
}

export async function readPublishedAppearance(descriptor,manifestUrl,fetcher=fetch) {
  const {kind,id,revision,contentHash:hash,path}=descriptor;
  if(kind!=='appearance'||!/^[1-9]\d*$/.test(id)||!/^[1-9]\d*$/.test(revision)
    ||!/^0x[a-f0-9]{64}$/.test(hash)||path!==`worlds/appearance/${id}/${revision}-${hash.slice(2)}.json`){
    throw Error('Invalid appearance descriptor');
  }
  const response=await fetcher(new URL(path,manifestUrl),{
    credentials:'omit',cache:'force-cache',signal:globalThis.AbortSignal?.timeout?.(5000)
  });
  if(!response.ok)throw Error('Published appearance unavailable');
  const saved=await response.json();
  if(saved.schemaVersion!==1||saved.kind!==kind||saved.id!==id||saved.revision!==revision
    ||saved.contentHash!==hash||contentHash(validateAppearance(saved.world))!==hash){
    throw Error('Published appearance identity or content mismatch');
  }
  return saved.world;
}
