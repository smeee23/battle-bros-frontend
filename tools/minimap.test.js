'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const frames=[],wrap={hidden:true},label={textContent:''};
let snapshots=0,paints=0;
const draw=new Proxy({}, {get:(_,name)=>name==='clearRect'?()=>paints++:()=>{},set:()=>true});
const canvas={width:240,height:240,getContext:()=>draw};
const pos={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}};
const context=vm.createContext({window:{},document:{getElementById:id=>({'minimap-wrap':wrap,'minimap-canvas':canvas,'minimap-size':label}[id])},
 requestAnimationFrame:callback=>frames.push(callback),GRID:50,HOME_GRID_MAX:256,renderVisibleSize:50,MAX_TERRAIN_FLOORS:64,
 explorationActive:false,fp:{active:true,pos,yaw:0,pitch:0},target:pos,fpJourney:{previous:null},fpKeys:new Set(),transportCube:{root:null},
 explorationTerrain:{activate(){context.explorationActive=true;},deactivate(){context.explorationActive=false;},
 minimapCells(){snapshots++;return new Map([['0,0',{terrain:'snow',terrainFloors:1}]]);}},
 ghostCellAt(){throw Error('Minimap must never read Home/Territory terrain');},
 minimapTerrainHex:()=>0xffffff,minimapMixHex:x=>x,minimapHexToCss:()=> '#fff',minimapThemeHex:x=>x,
 leaveExcavation(){},resetTransportCube(){},fpGroundYAt:()=>.6});
vm.runInContext(section('  let minimapRepaintQueued =','  function hoveredStatusWorldCell(')
 +section('  function redrawMinimap()','  function drawMinimapProp(')
 +section('  function switchFPWorld(other)','  function cancelFPWarp()'),context);
const flush=()=>{while(frames.length)frames.shift()();};
context.requestMinimapRepaint();assert(wrap.hidden);assert.equal(frames.length,0);assert.equal(snapshots,0);
for(const board of ['Home','Territory','Home']) {
 context.switchFPWorld(true);assert(!wrap.hidden,board+' departure shows Endless minimap');flush();
 assert(label.textContent.startsWith('Endless · '));
 const before=snapshots;assert(before>0);assert(paints>0);
 assert(context.minimapWorldFromCanvasPoint(120,120));
 // Leave with an Endless paint still queued: its callback cannot paint a
 // board or resurrect the hidden widget after H / Escape / return travel.
 context.requestMinimapRepaint();assert.equal(frames.length,1);
 context.switchFPWorld(false);assert(wrap.hidden,'Hide immediately on return to '+board);
 assert.equal(context.minimapWorldFromCanvasPoint(120,120),null,'Clear stale map interaction');
 flush();assert(wrap.hidden);assert.equal(snapshots,before,'Queued repaint does not sample another world');
 context.redrawMinimap();assert.equal(snapshots,before);
}
context.switchFPWorld(true);context.switchFPWorld(false);context.switchFPWorld(true);flush();
assert(!wrap.hidden,'Rapid re-entry displays Endless again');
assert.equal(context.minimapGlobalCell(25,25,new Map([['0,0',{terrain:'lava'}]])).terrain,'lava');
assert.equal(context.minimapGlobalCell(25,25,new Map()),null,'Void has no board fallback');
assert(/id="minimap-wrap" hidden/.test(html),'Hidden before JavaScript starts');
assert(/\.minimap-wrap\[hidden\]\s*\{\s*display:\s*none/.test(html),'Hidden overrides flex display');
console.log('Minimap: Endless-only data and visibility, Home/Territory returns, queued repaint cancellation and rapid re-entry passed');
