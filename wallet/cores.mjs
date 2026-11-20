const BATCH_SIZE=100;
const SYNC_DELAY_MS=500;
const RETRY_DELAY_MS=5000;

export function createCoreInventory({worlds,storage,scope,update,newId=()=>crypto.randomUUID()}){
  const records=new Map();
  let selected=null;

  function show(record){
    if(record!==selected)return;
    const {balance,pending,failed,storageFailed}=record;
    const status=pending.size
      ? (storageFailed?'Cores pending sync. Keep this tab open.':failed?'Cores saved on this device. Waiting to sync.':'Syncing Cores…')
      : failed?'Could not load the saved Core balance. Retrying…':balance===null?'Loading Core balance…':'Cores autosave for this BRO.';
    update({balance:balance===null&&!pending.size?'—':String((balance??0n)+BigInt(pending.size)),status});
  }

  function restore(record){
    try{
      for(let i=0;i<(storage?.length??0);i++){
        const key=storage.key(i);
        if(key?.startsWith(record.prefix))record.pending.add(key.slice(record.prefix.length));
      }
    }catch{record.storageFailed=true;}
  }

  function schedule(record,delay){
    if(record.inFlight)return;
    clearTimeout(record.timer);
    record.timer=setTimeout(()=>sync(record),delay);
  }

  async function sync(record){
    if(record.inFlight)return;
    clearTimeout(record.timer);
    const credits=[...record.pending].slice(0,BATCH_SIZE);
    record.inFlight=true;
    try{
      record.balance=credits.length
        ? await worlds.creditCores(record.tokenId,credits)
        : await worlds.loadCores(record.tokenId);
      for(const credit of credits){
        record.pending.delete(credit);
        try{storage?.removeItem(record.prefix+credit);}catch{record.storageFailed=true;}
      }
      if(!record.pending.size)record.storageFailed=false;
      record.failed=false;
    }catch{
      record.failed=true;
    }finally{
      record.inFlight=false;
      show(record);
      if(record.pending.size||record===selected&&record.failed)
        schedule(record,record.failed?RETRY_DELAY_MS:0);
    }
  }

  return {
    select(tokenId){
      if(tokenId===(selected?.tokenId??null))return;
      if(!tokenId){selected=null;update(null);return;}
      if(!records.has(tokenId))records.set(tokenId,{
        tokenId,prefix:'battlebros.core.v1:'+scope+':'+tokenId+':',
        pending:new Set(),balance:null,inFlight:false,failed:false,storageFailed:false,timer:null,
      });
      selected=records.get(tokenId);
      restore(selected);
      show(selected);
      schedule(selected,0);
    },
    collect(){
      if(!selected)return false;
      const record=selected,id=newId();
      record.pending.add(id);
      try{
        if(!storage)throw Error('Local storage unavailable');
        storage.setItem(record.prefix+id,'1');
      }catch{record.storageFailed=true;}
      show(record);
      schedule(record,SYNC_DELAY_MS);
      return true;
    },
    refresh(){if(selected){restore(selected);schedule(selected,0);}},
    flush(){for(const record of records.values())if(record.pending.size)void sync(record);},
  };
}
