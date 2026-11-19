(function(root,factory){const create=factory(typeof module==='object'&&module.exports?require('./weight-eligibility'):root.BattleBrosWeightEligibility);if(typeof module==='object'&&module.exports)module.exports=create;else root.createTrainingWeightsEditor=create;})(typeof globalThis!=='undefined'?globalThis:this,function(eligibility){
  'use strict';
  const lanes=['attack','defend','counter'],groups=['training'];
  const copy=value=>JSON.parse(JSON.stringify(value));
  const same=(a,b)=>lanes.every(lane=>String(a[lane])===String(b[lane]));
  const pending=new Set(['preparing','awaiting-wallet','pending','unknown','included']);
  function percentage(bps){return (BigInt(bps)/100n).toString()+(BigInt(bps)%100n?'.'+(BigInt(bps)%100n).toString().padStart(2,'0').replace(/0+$/,''):'');}
  function parse(value){
    if(!/^\d{1,3}(\.\d{1,2})?$/.test(value))return null;
    const [whole,fraction='']=value.split('.');const bps=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
    return bps<=10000n?bps:null;
  }
  function valid(weights){try{return lanes.every(lane=>/^\d+$/.test(String(weights[lane])))&&lanes.reduce((sum,lane)=>sum+BigInt(weights[lane]),0n)===10000n;}catch(_){return false;}}
  return function create({document,getRecords=()=>[],getEligibility=()=>null,getSelection=()=>({}),onValidity=()=>{}}){
    let session=null,opened=false;const controls={};
    function evaluate(){
      let allValid=true,editable=false;
      session.restrictions=getEligibility(session.model,session.scope)||eligibility(session.model);
      for(const group of groups){
        const ui=controls[group],attack=parse(ui.attack.value),defend=parse(ui.defend.value);
        const ok=attack!==null&&defend!==null&&attack+defend<=10000n;
        ui.counter.value=ok?percentage(10000n-attack-defend):'';
        ui.attack.setAttribute('aria-invalid',String(!ok));ui.defend.setAttribute('aria-invalid',String(!ok));
        const record=session.records[group],waiting=record&&pending.has(record.phase);
        const reason=session.restrictions[group]||(waiting?'Wait for the pending '+group+' weight transaction to finish.':'');
        ui.host.hidden=false;document.getElementById('battlebro-'+group).hidden=true;
        const restriction=document.getElementById('battlebro-'+group+'-restriction');
        restriction.hidden=!reason;restriction.textContent=reason?'Weight changes are not allowed. '+reason:'';
        for(const lane of lanes)ui[lane].disabled=!!reason||session.busy;ui.reset.disabled=!!reason||session.busy;
        if(reason)continue;
        editable=true;
        ui.status.textContent=waiting?'Transaction '+record.phase.replace(/-/g,' ')+'.':record&&['failed','rejected','cancelled','replaced','interrupted'].includes(record.phase)?(record.error||'Transaction '+record.phase+'. You can retry.'):
          ok?(record&&['confirmed','reflected'].includes(record.phase)?'Saved onchain · Total 100%.':'Total 100% · Counter is calculated automatically.'):'Enter percentages with up to two decimals. Attack + Defend must not exceed 100%.';
        if(ok)session.values[group]={attack:attack.toString(),defend:defend.toString(),counter:(10000n-attack-defend).toString()};
        allValid=allValid&&ok;
      }
      session.valid=allValid;onValidity(editable&&allValid&&!session.busy&&!Object.values(session.records).some(r=>pending.has(r.phase)));return allValid;
    }
    function show(){
      for(const group of groups){const ui=controls[group];for(const lane of lanes)ui[lane].value=percentage(session.values[group][lane]);}
      evaluate();
    }
    function setup(){
      if(controls.training)return;
      for(const group of groups){
        const host=document.getElementById('battlebro-'+group+'-editor'),ui={host};
        const note=document.createElement('p');note.className='battlebro-panel-note';note.textContent='Choose how training is split between Attack, Defend, and Counter. Saving updates training weights only.';host.append(note);
        for(const lane of lanes){
          const label=document.createElement('label');label.textContent=lane[0].toUpperCase()+lane.slice(1)+' %';
          const input=document.createElement('input');input.type='number';input.min='0';input.max='100';input.step='0.01';input.required=true;
          input.setAttribute('aria-label',(group==='training'?'Training':'Defense')+' '+lane+' percentage');
          input.readOnly=lane==='counter';input.oninput=()=>evaluate();label.append(input);host.append(label);ui[lane]=input;
        }
        ui.status=document.createElement('p');ui.status.className='battlebro-panel-note';ui.status.setAttribute('role','status');ui.status.setAttribute('aria-live','polite');host.append(ui.status);
        const reset=document.createElement('button');reset.type='button';reset.className='btn';reset.textContent='Reset';
        reset.onclick=()=>{session.values[group]=copy(session.confirmed[group]);for(const lane of lanes)ui[lane].value=percentage(session.values[group][lane]);evaluate();};host.append(reset);
        ui.reset=reset;controls[group]=ui;
      }
    }
    return {
      begin(model,scope){
        opened=true;session=null;setup();
        document.getElementById('battlebro-defense-section').hidden=true;
        document.getElementById('battlebro-defense-editor').hidden=true;
        document.getElementById('battlebro-defense-restriction').hidden=true;
        if(!model?.identity?.hatched||!scope?.chainId||!scope?.deploymentId){
          for(const group of groups){document.getElementById('battlebro-'+group+'-editor').hidden=false;document.getElementById('battlebro-'+group).hidden=true;
            for(const lane of lanes){controls[group][lane].value='';controls[group][lane].disabled=true;}controls[group].reset.disabled=true;
            const note=document.getElementById('battlebro-'+group+'-restriction');note.hidden=false;note.textContent='Weight changes are not allowed. Select a confirmed, hatched BRO first.';}
          onValidity(false);return false;
        }
        const confirmed={training:model.training.weightsBps};
        if(!groups.every(group=>valid(confirmed[group]))){onValidity(false);return false;}
        setup();const normalized=Object.fromEntries(groups.map(group=>[group,Object.fromEntries(lanes.map(lane=>[lane,String(confirmed[group][lane])]))]));
        session={model,restrictions:{},tokenId:String(model.identity.tokenId),scope:copy(scope),confirmed:copy(normalized),values:copy(normalized),records:{},rollback:{},valid:true,busy:false,snapshotBlock:String(model.snapshot?.blockNumber??0)};
        for(const group of groups){controls[group].host.hidden=false;document.getElementById('battlebro-'+group).hidden=true;}
        show();this.update(getRecords());return true;
      },
      refreshEligibility(model){
        if(!session){if(opened){const selection=getSelection();this.begin(model||selection.model,selection.scope);}return;}
        if(model&&String(model.identity.tokenId)===session.tokenId)session.model=model;
        evaluate();
      },
      setBusy(busy){if(session){session.busy=busy;evaluate();}},
      dirty(){
        if(!session)return false;
        return !session.valid||groups.some(group=>!same(session.values[group],session.confirmed[group]));
      },
      request(){
        if(!session||!evaluate())throw Error('Enter valid weights totaling 100% first.');
        if(groups.every(group=>session.restrictions[group]))throw Error(session.restrictions.training);
        if(Object.values(session.records).some(r=>pending.has(r.phase)))throw Error('Wait for the pending weight transactions.');
        return {tokenId:session.tokenId,scope:copy(session.scope),values:copy(session.values),groups:groups.filter(group=>!session.restrictions[group]&&!same(session.values[group],session.confirmed[group]))};
      },
      update(records){
        if(!session){onValidity(false);return;}
        for(const group of groups){
          const record=records.filter(r=>r.subject?.tokenId===session.tokenId&&r.subject.group===group).sort((a,b)=>b.updatedAt-a.updatedAt)[0];
          if(!record)continue;
          if(['confirmed','reflected'].includes(record.phase)&&record.blockNumber&&BigInt(record.blockNumber)<=BigInt(session.snapshotBlock))continue;
          const previous=session.records[group];
          if(previous?.id!==record.id)session.rollback[group]=copy(session.confirmed[group]);
          if(previous&&['confirmed','reflected'].includes(previous.phase)&&!['confirmed','reflected'].includes(record.phase))session.confirmed[group]=copy(session.rollback[group]);
          session.records[group]=record;
          const values=Object.fromEntries(lanes.map((lane,i)=>[lane,record.subject.weights[i]]));
          if(pending.has(record.phase)&&previous?.id!==record.id){session.values[group]=values;for(const lane of lanes)controls[group][lane].value=percentage(values[lane]);}
          if(['confirmed','reflected'].includes(record.phase)&&(!previous||previous.id!==record.id||!['confirmed','reflected'].includes(previous.phase))){
            session.confirmed[group]=copy(values);
            if(!previous){session.values[group]=copy(values);for(const lane of lanes)controls[group][lane].value=percentage(values[lane]);}
          }
        }
        evaluate();
      },
      finish(){
        for(const group of groups){document.getElementById('battlebro-'+group+'-restriction').hidden=true;document.getElementById('battlebro-'+group+'-editor').hidden=true;document.getElementById('battlebro-'+group).hidden=false;}
        document.getElementById('battlebro-defense-section').hidden=true;
        session=null;opened=false;onValidity(false);return true;
      }
    };
  };
});
