/* Publication-driven Home presentation. Drafts never change hatch status. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BattleBrosUnhatchedHome=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CHARACTERS=['juggernaut','monsters','specter','longneck'];
  function weights(values) {
    if(!Array.isArray(values)||values.length!==3)return null;
    const parsed=values.map(value=>{
      const match=/^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(String(value).trim());
      return match?Number(match[1])*100+Number((match[2]||'').padEnd(2,'0')):NaN;
    });
    return parsed.every(n=>Number.isInteger(n)&&n>=0&&n<=10000)&&parsed.reduce((a,b)=>a+b,0)===10000?parsed:null;
  }
  function validate(draft) {
    const bytes=new TextEncoder().encode(draft.name).length;
    if(!bytes||bytes>128)return 'Enter a name using 1–128 UTF-8 bytes.';
    if(!CHARACTERS.includes(draft.character))return 'Choose a character type.';
    if(!weights(draft.weights))return 'Training weights must total 100%, with up to two decimal places.';
    return '';
  }
  function create(THREE,hooks) {
    let active=false,identity=null,cube=null,side=4.4,draft=null,key=null,previewing=false,lastConfirmed=null;
    const defaults=()=>({name:'',character:'juggernaut',weights:['33.34','33.33','33.33']});
    const controls=hooks.controls;
    function readDraft() {
      let saved;
      try{saved=JSON.parse(hooks.storage?.getItem(key)||'null');}catch(_){}
      return saved&&typeof saved.name==='string'&&CHARACTERS.includes(saved.character)
        &&Array.isArray(saved.weights)&&saved.weights.length===3&&saved.weights.every(x=>typeof x==='string')
        ?{name:saved.name,character:saved.character,weights:[...saved.weights]}:defaults();
    }
    function report() {
      const error=validate(draft);
      if(controls?.status)controls.status.textContent=error||'Hatch choices are ready. Your BattleBro stays in its cube until hatching is confirmed.';
    }
    function showDraft() {
      if(!controls)return;
      controls.name.value=draft.name;controls.character.value=draft.character;
      controls.weights.forEach((input,i)=>input.value=draft.weights[i]);report();
    }
    function saveDraft() {
      if(!active||!controls)return;
      draft={name:controls.name.value,character:controls.character.value,weights:controls.weights.map(input=>input.value)};
      let saved=true;
      try{hooks.storage?.setItem(key,JSON.stringify(draft));if(!hooks.storage)saved=false;}catch(_){saved=false;}
      report();
      if(!saved&&!validate(draft))controls.status.textContent='Choices are ready for this session. Browser storage is unavailable.';
    }
    if(controls)for(const input of [controls.name,controls.character,...controls.weights])input.addEventListener('input',saveDraft);
    function refresh() {
      if(!active)return;
      if(!cube) {
        cube=hooks.makeCube();cube.name='Unhatched BattleBro incubation cube';
        cube.userData.unhatchedBattleBro=true;cube.userData.nonInteractive=true;
        cube.children[0].material.color.setHex(0x582d80);
        cube.children[1].material.color.setHex(0x582d80);
        cube.children[2].material.color.setHex(0xff3030);
        cube.children[2].material.emissive.setHex(0xff0808);
        cube.children[2].material.emissiveIntensity=1.1;
        side=Math.max(4.4,hooks.characterSize?.()||0);
        cube.scale.setScalar(side/.205);hooks.group.add(cube);
      }
      cube.visible=hooks.isHome();
      const center=hooks.center();
      let ground=-Infinity;
      const radius=Math.ceil(side/2);
      for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++) {
        const height=hooks.ground(Math.floor(center.cellX+dx),Math.floor(center.cellZ+dz));
        if(Number.isFinite(height))ground=Math.max(ground,height);
      }
      cube.position.set(center.x,(Number.isFinite(ground)?ground:0)+.1*cube.scale.y,center.z);
      hooks.onRefresh?.(cube);
    }
    function apply(model,scope,preview=false) {
      // Failed/unavailable reads preserve the last confirmed mode.
      if(!model?.identity||typeof model.identity.hatched!=='boolean')return;
      const next=model.identity.active===true&&!model.identity.hatched;
      const nextKey=next?(preview?'battlebros:hatch-preview-draft:v1':`battlebros:hatch-draft:v1:${scope.chainId}:${scope.deploymentId.toLowerCase()}:${model.identity.tokenId}`):null;
      identity=model.identity;
      if(nextKey!==key){key=nextKey;if(next){draft=readDraft();showDraft();}}
      if(active!==next){active=next;hooks.onModeChange(active);}
      if(controls)controls.section.hidden=!active;
      hooks.setModeClass?.(active);
      if(active)refresh();else if(cube)cube.visible=false;
    }
    function update(model,scope) {
      if(!model?.identity||typeof model.identity.hatched!=='boolean')return;
      lastConfirmed={model,scope};
      if(!previewing)apply(model,scope);
    }
    function setPreview(enabled) {
      previewing=!!enabled;
      if(previewing)apply({identity:{tokenId:'preview',active:true,hatched:false}},null,true);
      else if(lastConfirmed)apply(lastConfirmed.model,lastConfirmed.scope);
      else apply({identity:{tokenId:'preview',active:false,hatched:true}});
    }
    function occupies(x,z) {
      if(!active||!hooks.isHome())return false;
      const center=hooks.center();
      return Math.abs(x-center.cellX)<=side/2+.5&&Math.abs(z-center.cellZ)<=side/2+.5;
    }
    function tick(time) {
      if(!active||!cube?.visible)return;
      // A gentle two-second breathing pulse, driven by the shared render clock.
      cube.children[2].material.emissiveIntensity=.4+1.4*(.5+.5*Math.sin(time*Math.PI));
    }
    return {update,refresh,occupies,setPreview,tick,get previewing(){return previewing;},get active(){return active;},get cube(){return cube;},
      get identity(){return identity;},getDraft:()=>draft?{...draft,weights:[...draft.weights]}:null};
  }
  return {create,weights,validate,CHARACTERS};
});
