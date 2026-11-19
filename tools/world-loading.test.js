'use strict';
const assert=require('node:assert/strict');
const create=require('../assets/world-loading');
function fixture(){
  const nodes=new Map(['world-loading','world-loading-message','world-loading-recovery','world-loading-retry','world-loading-continue'].map(id=>[id,{hidden:id==='world-loading-recovery',textContent:''}]));
  let slow,cancelled=false,reloaded=false,covered=true;
  const gate=create({document:{getElementById:id=>nodes.get(id),body:{classList:{remove:()=>covered=false}}},
    schedule:callback=>{slow=callback;return 1;},cancel:()=>cancelled=true,reload:()=>reloaded=true});
  return {gate,node:id=>nodes.get(id),slow:()=>slow(),get covered(){return covered;},get cancelled(){return cancelled;},get reloaded(){return reloaded;}};
}
function complete(f){for(const phase of ['boot','publication','wallet'])f.gate.complete(phase);}
(async()=>{
  const f=fixture();f.gate.frame(true);assert(f.covered,'Default BRO stays covered during initial loading');
  f.gate.complete('boot');f.gate.complete('publication');f.gate.frame(true);f.gate.frame(true);assert(f.covered,'Wallet restoration must finish before reveal');
  let finishAppearance,finishWorld;
  f.gate.track(new Promise(resolve=>finishAppearance=resolve));f.gate.track(new Promise(resolve=>finishWorld=resolve));f.gate.complete('wallet');
  finishWorld();await Promise.resolve();f.gate.frame(true);f.gate.frame(true);assert(f.covered,'Selected BRO appearance must finish too');
  finishAppearance();await Promise.resolve();f.gate.frame(false);f.gate.frame(false);assert(f.covered,'Progressive terrain must drain before reveal');
  f.gate.frame(true);assert(f.covered,'Render a completed frame behind the cover');
  f.gate.frame(false);f.gate.frame(true);assert(f.covered,'New render work resets readiness');
  f.gate.frame(true);assert(!f.covered);assert(f.node('world-loading').hidden);assert(f.cancelled);
  f.gate.track(Promise.resolve());assert(!f.covered,'Later updates do not reopen the startup cover');

  const failed=fixture();complete(failed);failed.gate.track(Promise.reject(Error('Network unavailable')),'Saved world');await Promise.resolve();
  failed.gate.frame(true);failed.gate.frame(true);assert(failed.covered,'Failure never silently reveals an incomplete world');
  assert.match(failed.node('world-loading-message').textContent,/Saved world could not load.*Network unavailable/,'Recovery identifies the failing task and original error');
  assert(!failed.node('world-loading-recovery').hidden);failed.node('world-loading-retry').onclick();assert(failed.reloaded);
  failed.node('world-loading-continue').onclick();assert(!failed.covered,'Continue explicitly reveals the available world');

  const slow=fixture();slow.slow();assert(slow.covered);assert(!slow.node('world-loading-recovery').hidden,'A stalled load offers recovery');
  complete(slow);slow.gate.frame(true);slow.gate.frame(true);assert(!slow.covered,'A slow successful load still completes automatically');
  console.log('World loading: startup barriers, selected appearance, progressive rendering, completed frames, failure and slow-load recovery passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
