import {contentHash,saveTypedData,validateVisualDocument,targetKey} from '../../battle-bros-backend/packages/shared/src/world-save.mjs';
export function visualWorld(source){return {v:4,gridSize:source.gridSize,environment:source.environment,seed:source.seed,cells:source.cells};}
const visualDocument=(target,source)=>target.kind==='appearance'?structuredClone(source):visualWorld(source);
export function createWorldClient({wallet,apiUrl,storage,fetcher=fetch,origin=location.origin}){
  const base=new URL(apiUrl,origin);if(!['https:','http:'].includes(base.protocol)||base.username||base.password)throw Error('Invalid world API URL');
  const scope=wallet.settings.chainId+':'+wallet.settings.deployment.deploymentId.toLowerCase()+':'+(wallet.settings.instanceId??'chain');
  const draftKey=target=>'battlebros.world-draft.v1:'+scope+':'+targetKey(target)+':'+(wallet.getState().address?.toLowerCase()??'visitor');
  async function request(path,body){
    const response=await fetcher(new URL(path,base.href.endsWith('/')?base:base.href+'/'),{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'omit',cache:'no-store'});
    const data=await response.json();if(!response.ok)throw Error(data.error??'World request failed');return data;
  }
  return {
    draft(target,world,revision){const value={world:visualDocument(target,world),revision};validateVisualDocument(target,value.world);try{if(!storage)throw Error('Storage unavailable');storage.setItem(draftKey(target),JSON.stringify(value));}catch{throw Error('Local draft could not be saved. Keep this page open.');}return value;},
    local(target){try{const raw=storage?.getItem(draftKey(target));if(!raw||raw.length>5*1024*1024)return null;const value=JSON.parse(raw);validateVisualDocument(target,value.world);return value;}catch{return null;}},
    load:target=>request('worlds?'+new URLSearchParams(target)),
    async save(target,world,revision){
      const visual=visualDocument(target,world);validateVisualDocument(target,visual);const session=await wallet.session();
      const challenge=await request('worlds/challenge',{target,revision,contentHash:contentHash(visual),editor:session.address});
      if(challenge.chainId!==String(wallet.settings.chainId)||challenge.deploymentId.toLowerCase()!==wallet.settings.deployment.deploymentId.toLowerCase()||challenge.origin!==origin||targetKey(challenge.target)!==targetKey(target)||challenge.revision!==revision||challenge.contentHash!==contentHash(visual)||BigInt(challenge.expiresAt)<=BigInt(Math.floor(Date.now()/1000)))throw Error('Save challenge does not match this world');
      const data=saveTypedData(challenge),wire={...data,domain:{...data.domain,chainId:'0x'+data.domain.chainId.toString(16)},types:{EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'},{name:'verifyingContract',type:'address'}],...data.types},message:{...data.message,revision:String(data.message.revision),expiresAt:String(data.message.expiresAt)}};
      await session.assertCurrent();
      const signature=await session.provider.request({method:'eth_signTypedData_v4',params:[session.address,JSON.stringify(wire)]});
      await session.assertCurrent();return request('worlds/save',{nonce:challenge.nonce,signature,world:visual});
    }
  };
}
