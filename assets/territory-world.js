/* Visual development terrain only. Uses the shared board cell format and renderer. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BattleBrosTerritoryWorld=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SIZE=50, MAX_HEIGHT=160;
  // Same ice-corner footprint/model as Home; a level snow apron reaches the
  // outer ice paths. This is environmental terrain, never a removable cell object.
  function portalTerrainLevel(x,z) {
    const distance=Math.max(Math.abs(x-(SIZE-2.5)),Math.abs(z-1.5));
    return distance<=7 ? 8 : 0;
  }
  function generate(seed='territory-v1') {
    let hash=2166136261;
    for(const c of String(seed))hash=Math.imul(hash^c.charCodeAt(0),16777619);
    const phase=(hash>>>0)/4294967296*Math.PI*2;
    const cells=[], areas=[];
    const pads=[[10,10,'DESERT'],[39,10,'ICE'],[10,39,'EARTH'],[39,39,'LAVA']];
    for(const [x,z,environment] of pads)areas.push({x,z,radius:3,environment,terrainFloors:8});
    for(let x=0;x<SIZE;x++)for(let z=0;z<SIZE;z++) {
      const dx=x-24.5,dz=z-24.5,r=Math.hypot(dx,dz),angle=Math.atan2(dz,dx);
      const wx=dx+1.7*Math.sin(z*.24+phase),wz=dz+1.8*Math.sin(x*.21-phase);
      const environment=wx<0?(wz<0?'DESERT':'EARTH'):(wz<0?'ICE':'LAVA');
      const ripple=Math.sin(x*.37+phase)*Math.cos(z*.31-phase);
      // Offset overlapping peaks and directional ridges avoid a radial cone.
      const ridge=1+.19*Math.sin(angle*5+.7)+.12*Math.cos(angle*3-r*.17);
      const peak=105*Math.exp(-((dx+1.8)**2/70+(dz-1.2)**2/95))*ridge;
      const shoulder=31*Math.exp(-((dx-6)**2/23+(dz+4)**2/40));
      let height=Math.round(8+peak+shoulder+5*ripple+4*Math.sin(r*.55+angle*3)*Math.exp(-r/17));
      let terrain=environment==='DESERT'?'sand':environment==='ICE'?'snow':environment==='EARTH'?'grass':'stone';
      let kind=null;
      if(environment==='EARTH'&&ripple<-.45)terrain='dirt';
      if(environment==='EARTH'&&height>45)terrain='stone';
      // Continuous low ring connects all biomes. Flat outer spurs and broad
      // clearings provide traversable staging areas without a defender count.
      const ring=Math.abs(r-20)<2;
      const spur=(Math.abs(dx)<2||Math.abs(dz)<2)&&r>19;
      const pad=pads.some(([px,pz])=>Math.hypot(x-px,z-pz)<=3);
      if(ring||spur||pad)height=8;
      // Liquid basins are level, contained, and clear of the connected paths.
      const lake=Math.hypot((x-7)/3,(z-34)/2.3)<1;
      const vent=Math.hypot((x-36)/3,(z-36)/2.5)<1;
      const flow=environment==='LAVA'&&r<16&&r>10&&Math.abs(x-(32+2*Math.sin(z*.45)))<.85;
      if(!ring&&!spur&&!pad&&lake&&environment==='EARTH'){terrain='water';height=5;}
      if(!ring&&!spur&&!pad&&vent&&environment==='LAVA'){terrain='lava';height=6;}
      else if(flow)terrain='lava';
      // Sparse natural scenery shares existing cached models and animation indexes.
      const scatter=(Math.imul(x+7,73856093)^Math.imul(z+13,19349663)^hash)>>>0;
      if(!ring&&!spur&&!pad&&terrain!=='water'&&terrain!=='lava') {
        if(environment==='EARTH'&&height<25&&scatter%19===0)kind='tree';
        else if(environment==='EARTH'&&height<25&&scatter%11===0)kind='tuft';
        else if(scatter%47===0)kind='rock';
      }
      const portalLevel=portalTerrainLevel(x,z);
      if(portalLevel){height=portalLevel;terrain='snow';kind=null;}
      cells.push({x,z,terrain,kind,floors:1,terrainFloors:Math.max(1,Math.min(MAX_HEIGHT,height)),buildingType:null,fenceSide:null});
    }
    return {v:4,gridSize:SIZE,environment:'LUNAR',seed:String(seed),cells,
      // Development metadata; not authoritative territory occupancy or a roster.
      defenderAreas:areas};
  }
  return Object.freeze({generate,portalTerrainLevel,SIZE,MAX_HEIGHT});
});
