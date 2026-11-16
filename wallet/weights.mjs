import weightEligibility from '../assets/weight-eligibility.js';
const lanes=['attack','defend','counter'];
export function createWeightsService({wallet,transactions,selected,publication}){
  function records(){const address=wallet.getState().address?.toLowerCase();return (transactions?.list()??[]).filter(r=>r.subject?.type==='bro-weights'&&['training','defense'].includes(r.subject.group)&&r.subject.weights?.length===3&&r.subject.weights.every(n=>/^\d+$/.test(String(n)))&&r.from.toLowerCase()===address);}
  function eligibility(tokenId=selected(),scope){
    const state=wallet.getState(),settings=wallet.settings,bro=publication()?.battleBros.find(b=>b.tokenId===tokenId);
    const model=bro?{identity:{active:bro.active,hatched:bro.hatchedAt!=='0'},need:bro.need,pendingChallengeId:bro.pendingChallengeId,territory:bro.locationId}:null;
    return weightEligibility(model,{connected:!!state.address,network:String(state.chainId)===String(settings.chainId),owned:bro?.owner?.toLowerCase()===state.address?.toLowerCase(),transactions:!!transactions,
      selection:tokenId===selected()&&(!scope||String(scope.chainId)===String(settings.chainId)&&scope.deploymentId.toLowerCase()===settings.deployment.deploymentId.toLowerCase())});
  }
  function validate(request){
    const restrictions=eligibility(request.tokenId,request.scope);
    if(restrictions.training)throw Error(restrictions.training);
    for(const group of request.groups??[])if(restrictions[group])throw Error(restrictions[group]);
  }
  return {records,eligibility,async save(request){
    validate(request);const sent=[];
    if(!Array.isArray(request.groups)||request.groups.some(group=>!['training','defense'].includes(group)))throw Error('Invalid weight group.');
    for(const group of request.groups){const values=lanes.map(lane=>BigInt(request.values[group][lane]));if(values.some(n=>n<0n||n>10000n)||values.reduce((a,b)=>a+b,0n)!==10000n)throw Error('Each weight group must total 100%.');}
    for(const group of ['training','defense']){
      if(!request.groups.includes(group))continue;
      validate(request);const values=lanes.map(lane=>BigInt(request.values[group][lane]));
      if(values.some(n=>n<0n||n>10000n)||values.reduce((a,b)=>a+b,0n)!==10000n)throw Error('Each weight group must total 100%.');
      sent.push(await transactions.submit({contract:'bros',functionName:'setWeights',args:[BigInt(request.tokenId),values,group==='defense'],
        conflictKey:'weights:'+request.tokenId+':'+group,label:'Save '+group+' weights for BRO #'+request.tokenId,
        subject:{type:'bro-weights',tokenId:request.tokenId,group,weights:values.map(String)}}));
    }
    return sent;
  }};
}
