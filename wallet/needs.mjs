import {needIdentity} from '../../battle-bros-backend/packages/shared/src/need-activities.mjs';
import {assertTrustedPublication} from './config.mjs';
export function createNeedRegistry(){
  const entries=new Map();
  return {register(activity){if(!/^[a-z][a-z0-9-]{0,63}$/.test(activity.type)||entries.has(activity.type)||typeof activity.start!=='function'||typeof activity.validateCompletion!=='function')throw Error('Invalid or duplicate Need activity');entries.set(activity.type,activity);},get:type=>entries.get(type)};
}
export function defaultNeedRegistry(){
  const registry=createNeedRegistry();
  registry.register({type:'care',version:'1',title:'Needs care',instructions:'Review your BRO’s Need, then confirm care with your wallet. Brief gameplay activities will be added later.',canStart:()=>true,start:({complete})=>complete({reviewed:true}),validateCompletion:outcome=>outcome?.reviewed===true});
  return registry;
}
const livePhases=new Set(['preparing','awaiting-wallet','pending','unknown','included','confirmed']);
export function createNeedsService({wallet,transactions,registry=defaultNeedRegistry(),refresh=async()=>{}}){
  let publication=null,session=0,identity='';const progress=new Map(),listeners=new Set();
  const notify=()=>{for(const fn of listeners)fn(list());};
  function list(){
    const address=wallet.getState().address?.toLowerCase();if(!publication||!address)return [];
    const records=transactions?.list()??[];
    return publication.battleBros.filter(b=>b.active&&b.owner?.toLowerCase()===address&&b.need.active).map(b=>{
      const assignment=b.need.activity??{id:needIdentity(publication,b),type:'care',version:'1'},handler=registry.get(assignment.type),local=progress.get(assignment.id);
      const record=records.filter(r=>r.subject?.assignmentId===assignment.id&&r.from.toLowerCase()===address).sort((a,b)=>b.updatedAt-a.updatedAt)[0];
      const phase=record?.phase;
      let status=local?.ready?'ready':local?'in-progress':'awaiting-activity';
      if(['failed','rejected','cancelled','replaced','interrupted'].includes(phase))status=phase;
      else if(['preparing','awaiting-wallet','pending','unknown','included'].includes(phase))status=phase;
      else if(['confirmed','reflected'].includes(phase))status=record.result?.type==='bro-care'&&record.result.tokenId===b.tokenId&&record.result.sourceEpoch===b.need.sourceEpoch?'completed-syncing':'completion-mismatch';
      return {bro:b,assignment,handler,status,record,ready:!!local?.ready,available:!!handler&&handler.version===assignment.version,progressMessage:local?.message??'',error:local?.error??record?.error??''};
    });
  }
  function find(id){const need=list().find(n=>n.assignment.id===id);if(!need)throw Error('This Need is no longer active for your wallet');return need;}
  const unsubWallet=wallet.subscribe(state=>{const next=state.address?.toLowerCase()+':'+state.chainId;if(next!==identity){identity=next;session++;for(const p of progress.values())p.dispose?.();progress.clear();}notify();});
  const unsubTx=transactions?.subscribe(notify);
  return {list,registry,subscribe(fn){listeners.add(fn);fn(list());return()=>listeners.delete(fn);},
    update(document){assertTrustedPublication(wallet.settings,document);publication=document;
      const valid=new Set(list().map(n=>n.assignment.id));for(const [id,p] of progress)if(!valid.has(id)){p.dispose?.();progress.delete(id);}notify();},
    async start(id){const n=find(id);if(!n.available)throw Error('This activity is not available in this version of the game');
      if(n.record&&livePhases.has(n.record.phase))throw Error('Completion is already being tracked');
      if(n.handler.canStart&&!n.handler.canStart({bro:n.bro,publication}))throw Error('This activity cannot be started in the current state');
      for(const [other,p] of progress)if(other!==id&&!p.ready){p.dispose?.();progress.delete(other);}
      progress.get(id)?.dispose?.();const current=session,p={ready:false,error:''};progress.set(id,p);notify();
      const complete=outcome=>{if(current!==session||progress.get(id)!==p)return;find(id);if(!n.handler.validateCompletion(outcome,{bro:n.bro,publication}))throw Error('Activity completion conditions have not been met');p.ready=true;notify();};
      try{const dispose=await n.handler.start({bro:n.bro,assignment:n.assignment,publication,complete,report:message=>{if(progress.get(id)===p){p.message=String(message).slice(0,300);notify();}}});if(typeof dispose==='function'){if(progress.get(id)===p)p.dispose=dispose;else dispose();}}
      catch(error){p.error=error.message;notify();throw error;}
    },
    cancel(id){const p=progress.get(id);p?.dispose?.();progress.delete(id);notify();},
    async complete(id){
      if(!transactions)throw Error('Transactions are unavailable for this deployment');
      await refresh();const n=find(id);if(!n.ready)throw Error('Finish the activity before confirming care');
      if(n.status==='completed-syncing'||n.record&&livePhases.has(n.record.phase))throw Error('Completion is already being tracked');
      return transactions.submit({contract:'bros',functionName:'care',args:[BigInt(n.bro.tokenId)],conflictKey:'care:'+n.bro.tokenId,label:'Complete Need for BRO #'+n.bro.tokenId,
        subject:{type:'need-care',tokenId:n.bro.tokenId,assignmentId:id,sourceEpoch:n.bro.need.sourceEpoch,activeSinceTimestamp:n.bro.need.activeSinceTimestamp}});
    },
    destroy(){unsubWallet();unsubTx?.();for(const p of progress.values())p.dispose?.();listeners.clear();}
  };
}
