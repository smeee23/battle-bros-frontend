(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BattleBrosAppearance=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const kinds=['juggernaut','monsters','specter','longneck'];
  const defaults=()=>({v:1,skin:'lava',colors:{core:'default',glow:'default',eye:'default'}});
  const copy=value=>JSON.parse(JSON.stringify(value));
  const formForLevel=level=>{const value=BigInt(level);return value<1n?1:value>=7n?7:Number(value);};
  function create({actor,character,replace,applyColors,onType=()=>{},beforeSelect=()=>{}}){
    let selected=null,key='',rendered='';const records=new Map();
    function sync(force=false){
      if(!selected)return;
      const family=kinds[Number(selected.identity.type)];onType(family,selected);
      if(!selected.identity.active||!selected.identity.hatched||!family)return;
      const form=formForLevel(selected.progression.level);
      const appearance=records.get(key)||defaults(),signature=key+':'+family+':'+form+':'+JSON.stringify(appearance);
      if(!force&&rendered===signature)return;
      const old=actor();
      if(!old||character(old)!==family||old.userData.form!==form||old.userData.visualVariant!==appearance.skin){
        const result=replace(appearance.skin,form,family,appearance.colors);
        if(!result?.ok)throw Error('Could not display the selected BRO: '+(result?.reason||'character unavailable'));
      }else applyColors(old,appearance.colors);
      rendered=signature;
    }
    return {
      select(model,scope){const previous=selected;const next=scope.chainId+':'+scope.deploymentId.toLowerCase()+':'+model.identity.tokenId;const changed=next!==key;if(changed||previous?.identity.hatched!==model.identity.hatched||previous?.identity.type!==model.identity.type||(previous&&formForLevel(previous.progression.level)!==formForLevel(model.progression.level)))beforeSelect();selected=model;key=next;if(changed)rendered='';sync();},
      apply(value){if(!selected)return;beforeSelect();records.set(key,copy(value));sync(true);},
      restore(){beforeSelect();sync(true);},
      capture(){
        if(!selected?.identity.hatched)throw Error('Hatch this BRO before saving its appearance.');
        const root=actor();if(!root||character(root)!==kinds[Number(selected.identity.type)])throw Error('Restore the selected BRO before saving its appearance.');
        return {v:1,skin:root.userData.visualVariant||'lava',colors:{core:root.userData.colors?.core||'default',glow:root.userData.colors?.glow||'default',eye:root.userData.colors?.eye||'default'}};
      }
    };
  }
  return {create,kinds,defaults,formForLevel};
});
