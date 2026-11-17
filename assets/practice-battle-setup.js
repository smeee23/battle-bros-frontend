/* UI-only encounter choices. Does not alter combat or invoke wallet services. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.createPracticeBattleSetup=factory;})(typeof globalThis!=='undefined'?globalThis:this,function(document){
  'use strict';
  const get=id=>document.getElementById('practice-setup-'+id);
  let capacity=100,onStart=null,onCancel=null,lastStart=null,busy=false;
  const percent=value=>{const n=Number(value);return Number.isFinite(n)?String(n/100):'0';};
  function parse(value){
    if(!/^\d{1,3}(\.\d{1,2})?$/.test(String(value)))return null;
    const [whole,fraction='']=String(value).split('.');const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
    return n<=10000?n:null;
  }
  function selection(){
    const attack=parse(get('attack-weight').value),defend=parse(get('defend-weight').value);
    const action=Number(get('action').value),commitmentPercent=Number(get('strength').value);
    if(attack===null||defend===null||attack+defend>10000||!['0','1','2'].includes(String(get('action').value))
      ||!Number.isInteger(commitmentPercent)||commitmentPercent<10||commitmentPercent>100)return null;
    return {defenseWeights:[attack,defend,10000-attack-defend],action,commitmentPercent,power:Math.ceil(capacity*commitmentPercent/100),capacity};
  }
  function update(){
    const value=selection();get('start').disabled=!value||busy;
    get('counter-weight').value=value?percent(value.defenseWeights[2]):'';
    get('status').textContent=value?'Defense total: 100%':'Enter valid percentages. Attack + Defend must not exceed 100%.';
    get('strength-label').textContent=get('strength').value+'% · '+Math.ceil(capacity*Number(get('strength').value)/100)+' power';
    for(const key of ['attack-weight','defend-weight'])get(key).setAttribute('aria-invalid',String(!value));
    return value;
  }
  for(const key of ['attack-weight','defend-weight','action','strength'])get(key).oninput=update;
  get('form').onsubmit=event=>{event.preventDefault();const value=update();if(value&&onStart&&!busy){const start=onStart;onStart=null;start(value);}};
  get('cancel').onclick=()=>onCancel?.();
  return {
    open(model,start,cancel){
      const candidate=Number(model?.progression?.capacity);capacity=Number.isSafeInteger(candidate)&&candidate>0?candidate:100;
      const weights=model?.defense?.weightsBps,values=weights?['attack','defend','counter'].map(k=>Number(weights[k])):[3334,3333,3333];
      const valid=values.every(n=>Number.isInteger(n)&&n>=0)&&values.reduce((a,b)=>a+b,0)===10000;
      get('attack-weight').value=percent(valid?values[0]:3334);get('defend-weight').value=percent(valid?values[1]:3333);
      const reserves=['attack','defend','counter'].map(k=>Number(model?.progression?.reserves?.[k]??0));
      get('action').value=String(reserves.indexOf(Math.max(...reserves)));get('strength').value='10';onStart=lastStart=start;onCancel=cancel;busy=false;update();
      this.setBusy(false);get('form').hidden=false;get('attack-weight').focus();
    },
    setBusy(value,message){busy=value;get('cancel').textContent=value?'Close (transaction continues)':'Cancel';for(const key of ['attack-weight','defend-weight','action','strength'])get(key).disabled=value;update();if(message)get('status').textContent=message;},
    retry(message){onStart=lastStart;this.setBusy(false,message);},
    close(){get('form').hidden=true;onStart=null;onCancel=null;lastStart=null;busy=false;},
    get active(){return !get('form').hidden;}
  };
});
