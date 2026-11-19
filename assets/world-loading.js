/* Startup cover; readiness is checked by the existing render loop. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.battleBrosWorldLoading=factory({document:root.document,reload:()=>root.location.reload()});
})(typeof globalThis!=='undefined'?globalThis:this,function(options){
  'use strict';
  const {document,reload=()=>{},schedule=setTimeout,cancel=clearTimeout}=options;
  const cover=document.getElementById('world-loading'),message=document.getElementById('world-loading-message'),recovery=document.getElementById('world-loading-recovery');
  const pending=new Set(['boot','publication','wallet']);
  let finished=false,failed=false,frames=0;
  function recover(text){if(finished)return;message.textContent=text;recovery.hidden=false;}
  const timer=schedule(()=>recover('Loading is taking longer than expected. Retry, or continue with the available world.'),30000);
  function dismiss(){if(finished)return;finished=true;cancel(timer);cover.hidden=true;document.body.classList.remove('world-loading');}
  document.getElementById('world-loading-retry').onclick=reload;
  document.getElementById('world-loading-continue').onclick=dismiss;
  const api={
    complete(key){pending.delete(key);frames=0;},
    fail(key,error,label='World data'){pending.delete(key);failed=true;frames=0;const reason=error?.message?String(error.message).slice(0,300):'The request failed.';recover(label+' could not load. '+reason+' Retry, or continue with the available world.');},
    track(task,label='World data'){
      if(finished)return task;
      const key={};pending.add(key);frames=0;
      Promise.resolve(task).then(()=>api.complete(key),error=>api.fail(key,error,label));return task;
    },
    frame(ready){
      if(finished)return;
      if(!ready||failed||pending.size){frames=0;return;}
      // Allow a completed scene to paint before revealing it.
      if(++frames>=2)dismiss();
    }
  };
  return api;
});
