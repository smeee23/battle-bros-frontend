/* Endless NPC awareness and catch lifecycle. Navigation, shared character
 * animation, camera and terrain remain owned by the existing frontend loop. */
(function(global,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else global.EndlessPursuit=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Sweep relative player/Bro motion against the Bro's oriented body footprint.
  // Slab intersection also checks height, so jumping over a Bro is possible.
  function contact(player,previousPlayer,body,previousBody,shape,yaw){
    const c=Math.cos(yaw),s=Math.sin(yaw),radius=.15;
    const local=(p,b)=>{const x=p.x-b.x,z=p.z-b.z;return {
      x:c*x-s*z,z:s*x+c*z,y:p.y-(p.eyeHeight||.6)-b.y};};
    const a=local(previousPlayer,previousBody),b=local(player,body);
    let enter=0,exit=1;
    for(const [axis,lo,hi] of [['x',-shape.halfWidth-radius,shape.halfWidth+radius],
      ['z',-shape.halfDepth-radius,shape.halfDepth+radius],['y',-.75,shape.height]]){
      const delta=b[axis]-a[axis];
      if(Math.abs(delta)<1e-9){if(a[axis]<lo||a[axis]>hi)return false;continue;}
      const first=(lo-a[axis])/delta,last=(hi-a[axis])/delta;
      enter=Math.max(enter,Math.min(first,last));exit=Math.min(exit,Math.max(first,last));
      if(enter>exit)return false;
    }
    return true;
  }
  function create(host,options={}){
    const tuning={range:10,releaseRange:14,probeInterval:.25,caughtDuration:1.25,graceDuration:5,...options};
    const chasing=new Map();let caught=null,grace=0;
    function stop(actor){
      if(!chasing.delete(actor))return;
      delete actor.pursuit;host.stop(actor);
    }
    function reset(){
      const hadActivity=caught||grace||chasing.size;
      for(const actor of chasing.keys())stop(actor);
      if(caught)delete caught.actor.pursuitCaught;
      caught=null;grace=0;if(hadActivity)host.feedback('idle',0);
    }
    function cancel(actor){
      stop(actor);
      if(caught?.actor===actor){delete actor.pursuitCaught;caught=null;grace=tuning.graceDuration;host.feedback('grace',grace);}
    }
    return {reset,cancel,get locked(){return !!caught;},get grace(){return grace;},
      tick(t,dt){
        if(!host.enabled()){reset();return false;}
        const player=host.player();
        if(!player){reset();return false;}
        const step=Math.max(0,Math.min(dt,.1));
        if(caught){
          caught.elapsed+=step;
          host.lookAt(caught.actor,step);host.feedback('caught',0);
          if(caught.elapsed>=tuning.caughtDuration){
            host.regenerate(caught.actor);
            delete caught.actor.pursuitCaught;caught=null;grace=tuning.graceDuration;
            host.feedback('grace',grace);
          }
          return true;
        }
        if(grace>0){grace=Math.max(0,grace-step);host.feedback(grace?'grace':'idle',grace);return false;}
        const actors=host.npcs(),present=new Set(actors);
        for(const actor of chasing.keys())if(!present.has(actor))stop(actor);
        for(const actor of actors){
          let state=chasing.get(actor);
          const body=host.body(actor),distance=Math.hypot(body.x-player.x,body.z-player.z);
          if(!host.available(actor)||actor.islandId!==player.islandId||player.islandId===undefined
            ||distance>(state?tuning.releaseRange:tuning.range)){
            if(state)stop(actor);continue;
          }
          if(!state||t>=state.nextProbe){
            if(!host.clear(actor,player)){if(state)stop(actor);continue;}
            if(!state){
              state={previousPlayer:{...player},previousBody:{...body}};
              chasing.set(actor,state);actor.pursuit={target:{...player}};host.start(actor);
            }
            state.nextProbe=t+tuning.probeInterval;
          }
          actor.pursuit.target={...player};
          if(contact(player,state.previousPlayer,body,state.previousBody,host.shape(actor),actor.root.rotation.y)
            &&host.clear(actor,player)){
            for(const other of chasing.keys())stop(other);
            caught={actor,elapsed:0};actor.pursuitCaught=true;
            host.feedback('caught',0);host.lookAt(actor,step);return true;
          }
          state.previousPlayer={...player};state.previousBody={...body};
        }
        return false;
      }
    };
  }
  return {create,contact};
});
