'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const frames=[],wrap={hidden:true},label={textContent:''};
let snapshots=0,paints=0;
const dots=[];let ink;
const draw=new Proxy({}, {get:(_,name)=>name==='clearRect'?()=>paints++:name==='arc'?(x,y,r)=>dots.push({x,y,r,ink}):()=>{},set:(_,name,value)=>{if(name==='fillStyle')ink=value;return true;}});
const canvas={width:240,height:240,getContext:()=>draw};
const pos={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}};
const context=vm.createContext({window:{},document:{getElementById:id=>({'minimap-wrap':wrap,'minimap-canvas':canvas,'minimap-size':label}[id])},
 requestAnimationFrame:callback=>frames.push(callback),GRID:50,HOME_GRID_MAX:256,renderVisibleSize:50,MAX_TERRAIN_FLOORS:64,
 explorationActive:false,fp:{active:true,pos,yaw:0,pitch:0},target:pos,fpJourney:{previous:null},fpKeys:new Set(),transportCube:{root:null},explorationResidents:new Map(),
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
// A packed cube must not gate periodic refreshes or heading updates.
const before=snapshots;context.tickMinimap(1);flush();assert.equal(snapshots,before+1);
context.tickMinimap(1.05);flush();assert.equal(snapshots,before+1,'Refresh is capped at ten per second');
pos.x=6;pos.z=-8;context.tickMinimap(1.11);flush();
assert.equal(snapshots,before+2,'Walking with a packed BRO still refreshes the map');
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
// Forward is always screen-up, including all four cardinal headings and diagonals.
for(const yaw of [0,Math.PI/2,Math.PI,3*Math.PI/2,.71]) {
 context.fp.yaw=yaw;context.redrawMinimap();
 const point=context.minimapCanvasPoint(pos.x-10*Math.sin(yaw),pos.z-10*Math.cos(yaw));
 near(point.x,120);near(point.y,72);
 for(const [x,z] of [[pos.x,pos.z],[pos.x+9,pos.z-7],[pos.x-13,pos.z+15]]) {
  const screen=context.minimapCanvasPoint(x,z),world=context.minimapWorldFromCanvasPoint(screen.x,screen.y);
  near(world.x,x);near(world.z,z);
 }
}
context.fp.yaw=0;
context.explorationResidents.set('npc',{root:{parent:{},visible:true,position:{x:pos.x+10,z:pos.z}}});
context.explorationResidents.set('hidden',{root:{parent:{},visible:false,position:{x:pos.x,z:pos.z}}});
context.explorationResidents.set('removed',{root:{parent:null,visible:true,position:{x:pos.x,z:pos.z}}});
context.explorationResidents.set('outside',{root:{parent:{},visible:true,position:{x:pos.x+100,z:pos.z}}});
dots.length=0;context.redrawMinimap();
let red=dots.filter(p=>p.ink==='#ef4444');assert.equal(red.length,1,'Only live, visible NPCs inside the map get red dots');
near(red[0].x,168);near(red[0].y,120);
context.fp.yaw=Math.PI/2;dots.length=0;context.redrawMinimap();
red=dots.filter(p=>p.ink==='#ef4444');near(red[0].x,120);near(red[0].y,168);
context.explorationResidents.get('npc').root.position.z-=5;dots.length=0;context.redrawMinimap();
red=dots.filter(p=>p.ink==='#ef4444');near(red[0].x,144);near(red[0].y,168);
context.switchFPWorld(false);const hiddenSnapshots=snapshots;context.tickMinimap(2);flush();assert.equal(snapshots,hiddenSnapshots);
assert(html.includes('    tickMinimap(t);'),'The existing main render loop owns refreshes');
assert(!html.includes('transportMinimapHadBro'),'Refreshes are independent of BRO release');
console.log('Minimap: Endless-only visibility, independent throttled refresh, heading rotation, click round trips and live NPC red markers passed');
