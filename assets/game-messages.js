'use strict';
/* Passive gameplay messaging. Driven by the existing world loop; no timers or render loop. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else root.battleBrosMessages=factory({box:root.document.getElementById('excavation-hud'),
  title:root.document.getElementById('fp-equipped-tool-label'),body:root.document.getElementById('excavation-status')});
})(typeof globalThis!=='undefined'?globalThis:this,function createGameMessages({box,title,body,onChange}={}){
 const ranks={info:1,warning:2,error:3},durations={info:4,warning:6,error:8};
 const contexts=new Map();let mode='home-building',visible=true,current=null,queue=[],sequence=0,last='';
 function view(){
  if(!visible)return null;
  if(current)return {text:current.text,title:current.title,category:current.category};
  let best=null;
  for(const context of contexts.values())if(!best||context.priority>best.priority||context.priority===best.priority&&context.sequence>best.sequence)best=context;
  return best?{text:best.text,title:best.title,category:'info'}:null;
 }
 function render(){
  const message=view(),key=JSON.stringify(message);if(key===last)return;last=key;
  if(box){box.hidden=!message;box.dataset.category=message?.category||'info';box.dataset.mode=mode;}
  if(title){title.textContent=message?.title||'';title.hidden=!message?.title;}
  if(body)body.textContent=message?.text||'';
  onChange?.(message);
 }
 function advance(){
  queue.sort((a,b)=>b.rank-a.rank||a.sequence-b.sequence);current=queue.shift()||null;
 }
 const api={
  context(source,text,{title='',priority=10}={}){
   if(!text){if(contexts.delete(source))render();return;}
   const old=contexts.get(source);
   if(old?.text===text&&old.title===title&&old.priority===priority)return;
   contexts.set(source,{text,title,priority,sequence:++sequence});render();
  },
  notify(text,{source='notification',category='info',title='',duration=durations[category]||4,scope=mode}={}){
   if(!text||scope!==mode&&scope!=='global')return;
   category=ranks[category]?category:'info';
   // Repeated emissions do not extend visibility indefinitely or refill the queue.
   const duplicate=[current,...queue].find(m=>m?.source===source&&m.text===text&&m.category===category);
   if(duplicate)return;
   const message={source,text,title,category,rank:ranks[category],remaining:Math.max(1,duration),scope,sequence:++sequence};
   queue=queue.filter(m=>m.source!==source);
   if(!current)current=message;
   else if(message.rank>current.rank){queue.push(current);current=message;}
   else if(current.source===source&&current.rank===1&&message.rank===1)current=message;
   else queue.push(message);
   // Bound burst traffic, retaining the most important pending messages first.
   queue.sort((a,b)=>b.rank-a.rank||a.sequence-b.sequence);queue=queue.slice(0,5);render();
  },
  clear(source){
   contexts.delete(source);queue=queue.filter(m=>m.source!==source);
   if(current?.source===source)advance();render();
  },
  setMode(next){
   if(mode===next)return;
   mode=next;contexts.clear();queue=queue.filter(m=>m.scope==='global');
   if(current?.scope!=='global'){current=null;advance();}
   if(box)box.dataset.mode=mode;
   render();
  },
  setVisible(next){if(visible!==!!next){visible=!!next;render();}},
  tick(dt){
   // Time spent in a dialog does not consume a notification's reading time.
   if(!visible||!current)return;
   current.remaining-=Math.max(0,dt);
   if(current.remaining<=0){advance();render();}
  },
  get current(){return view();},get mode(){return mode;}
 };
 render();return api;
});
