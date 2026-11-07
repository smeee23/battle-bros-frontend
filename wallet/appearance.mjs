import {defaultAppearance,validateAppearance,contentHash} from '../../battle-bros-backend/packages/shared/src/world-save.mjs';
export function createAppearanceService({worlds,bridge,onChange=()=>{}}){
  let generation=0,current=null,status='Select a BRO.',busy=false,training=null;
  const notify=()=>onChange({status,busy,tokenId:current?.id});
  return {
    async select(tokenId,{force=false}={}){
      if(current?.id===tokenId&&!force)return;
      const request=++generation;current=tokenId?{kind:'appearance',id:tokenId,revision:'0',savedHash:contentHash(defaultAppearance())}:null;busy=false;training=null;
      if(!current){status='Select a BRO.';notify();return;}
      bridge()?.apply(defaultAppearance());
      if(!worlds){status='Appearance saves are not configured.';notify();return;}
      const target={kind:'appearance',id:tokenId},local=worlds.local(target);
      status='Loading appearance for BRO #'+tokenId+'…';notify();
      try{
        const response=await worlds.load(target);if(request!==generation)return;
        const latestLocal=worlds.local(target);
        const saved=latestLocal??(response.world?{world:response.world.document,revision:response.world.revision}:null);
        const appearance=saved?.world??defaultAppearance();validateAppearance(appearance);current.revision=saved?.revision??'0';current.savedHash=contentHash(response.world?.document??defaultAppearance());bridge()?.apply(appearance);
        status=latestLocal?'Local appearance draft restored for BRO #'+tokenId+'.':response.world?'Saved appearance loaded for BRO #'+tokenId+'.':'BRO #'+tokenId+' uses its default appearance.';
        if(latestLocal&&latestLocal.revision!==(response.world?.revision??'0'))status+=' A newer cloud save exists; restore it before saving.';
      }catch(error){if(request!==generation)return;if(local){validateAppearance(local.world);current.revision=local.revision;bridge()?.apply(local.world);}status='Appearance could not sync: '+error.message;}
      notify();
    },
    beginTraining(){training=null;if(!current||busy)return;try{const hash=contentHash(bridge().capture());training={generation,initial:current.savedHash,edited:hash!==current.savedHash};}catch{/* Unhatched BROs cannot edit appearance. */}},
    finishTraining(){const session=training;training=null;if(!session||session.generation!==generation||!session.edited)return;if(contentHash(bridge().capture())===session.initial)return;return this.save();},
    draft(){if(!current||!worlds)return;const appearance=bridge()?.capture();if(!appearance)return;validateAppearance(appearance);bridge()?.remember?.(appearance);if(training)training.edited=true;worlds.draft(current,appearance,current.revision);status='Appearance saved locally for BRO #'+current.id+'. Leave the training facility to sync it.';notify();},
    async save(){
      if(!current||!worlds)throw Error('Select a BRO and configure appearance saves first.');if(busy)throw Error('An appearance save is already in progress.');
      const request=generation,target={kind:'appearance',id:current.id},appearance=bridge().capture();validateAppearance(appearance);worlds.draft(target,appearance,current.revision);busy=true;status='Sign the appearance save for BRO #'+target.id+'.';notify();
      try{
        const result=await worlds.save(target,appearance,current.revision);if(request!==generation)return;
        current.revision=result.world.revision;current.savedHash=contentHash(appearance);const latest=bridge().capture();worlds.draft(target,latest,current.revision);
        status='Appearance saved for BRO #'+target.id+'. Publishing…';if(contentHash(latest)!==contentHash(appearance))status+=' Newer changes remain local.';
      }catch(error){if(request===generation){status='Appearance save failed. Your local draft is preserved.';notify();}throw error;}
      finally{if(request===generation){busy=false;notify();}}
    },
    async restore(){
      if(!current||!worlds)throw Error('Select a BRO and configure appearance saves first.');if(busy)throw Error('Wait for the current appearance save.');
      const request=++generation,target={kind:'appearance',id:current.id};const response=await worlds.load(target);if(request!==generation)return;
      const appearance=response.world?.document??defaultAppearance();validateAppearance(appearance);current.revision=response.world?.revision??'0';worlds.draft(target,appearance,current.revision);bridge().apply(appearance);status='Restored appearance for BRO #'+target.id+'.';notify();
    },
    reset(){generation++;current=null;training=null;busy=false;status='Select a BRO.';notify();}
  };
}
