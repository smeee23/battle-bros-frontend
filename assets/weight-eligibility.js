(function(root,factory){const eligibility=factory();if(typeof module==='object'&&module.exports)module.exports=eligibility;else root.BattleBrosWeightEligibility=eligibility;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const exists=value=>value!==undefined&&value!==null&&String(value)!=='0'&&String(value)!=='';
  return function eligibility(model,{connected=true,network=true,owned=true,transactions=true,selection=true}={}){
    let reason='';
    if(!model)reason='Select a confirmed BRO first.';
    else if(!connected)reason='Connect your wallet to change weights.';
    else if(!network)reason='Switch your wallet to the configured network.';
    else if(!selection)reason='The selected BRO or deployment changed. Return outside and reopen training.';
    else if(!owned)reason='Only the owner of this BRO can change its weights.';
    else if(!transactions)reason='Transactions are unavailable for this deployment.';
    else if(model.identity.active===false)reason='This BRO is inactive.';
    else if(!model.identity.hatched)reason='Hatch this BRO before changing weights.';
    else if(model.need?.active)reason='Complete this BRO’s open Need before changing weights.';
    else if(exists(model.pendingChallengeId))reason='Resolve this BRO’s pending challenge before changing weights.';
    return {training:reason,defense:reason||(exists(model.territory)?'Defense weights are locked while this BRO holds a territory.':'')};
  };
});
