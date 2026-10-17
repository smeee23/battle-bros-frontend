/* Shared, rig-independent standing support and swept walking clearance.
 * Terrain is supplied by the environment. No animation, navigation or mutation. */
(function(global,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else global.battleBroTerrain=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function profile(root){
    const data=root?.userData||{},kind=data.kind||'';
    const family=data.characterFamily||(kind.includes('longneck')?'longneck':kind.includes('floating-rock')?'specter':'juggernaut');
    const scale=data.transportRestScale?.x||root?.scale?.x||1,form=data.form||4;
    const juvenile=family==='juggernaut'&&form<4;
    const width=family==='longneck'?.48:family==='specter'?.45:juvenile?[0,.45,.65,.78][form]:.88;
    const depth=family==='longneck'?.68:family==='specter'?.45:juvenile?[0,.32,.36,.4][form]:.52;
    const step=Math.max(.2,Math.min(.6,(juvenile&&form<3?.2:family==='longneck'?.3:.4)*scale));
    return {halfWidth:width*scale,halfDepth:depth*scale,height:data.approximateHeight||3,
      step,spread:step,legClearance:Math.max(step+.06,(data.approximateHeight||3)*.25),family};
  }
  function point(terrain,x,z,maxY=null){
    const cell=terrain.worldToCell(x,z,maxY),value=terrain.getCell(cell.x,cell.z,cell.islandId);
    const y=terrain.groundYAt(x,z,0,maxY);
    if(!value||!Number.isFinite(y)||maxY!==null&&y>maxY+1e-5||value.kind||value.extras?.length||['water','lava'].includes(value.terrain)
      ||terrain.characterBlockedAt?.(cell.x,cell.z))return null;
    return {x,y,z,cell,islandId:value.islandId};
  }
  function support(terrain,x,z,{halfWidth,halfDepth,spread,step},yaw=0,maxY=null,islandId){
    const center=point(terrain,x,z,maxY);if(!center||islandId!==undefined&&center.islandId!==islandId)return null;
    let min=center.y,max=center.y;const samples=[];
    const nx=Math.max(2,Math.ceil(halfWidth*2/.3)),nz=Math.max(2,Math.ceil(halfDepth*2/.3));
    const c=Math.cos(yaw),s=Math.sin(yaw);
    for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
      const dx=-halfWidth+2*halfWidth*ix/nx,dz=-halfDepth+2*halfDepth*iz/nz;
      const hit=point(terrain,x+c*dx+s*dz,z-s*dx+c*dz,center.y+step+1e-5);
      if(!hit||hit.islandId!==center.islandId)return null;
      min=Math.min(min,hit.y);max=Math.max(max,hit.y);if(max-min>spread+1e-5)return null;
      samples.push(hit);
    }
    return {...center,min,max,y:(min+max)*.5,samples};
  }
  function stand(terrain,shape,x,z,yaw=0,maxY=null,islandId){
    const result=support(terrain,x,z,shape,yaw,maxY,islandId);if(!result)return null;
    for(const hit of result.samples)if(terrain.blocksBodyAt?.(hit.x,hit.z,result.y+shape.legClearance,result.y+shape.height,0))return null;
    return result;
  }
  function route(terrain,shape,from,to){
    const start=stand(terrain,shape,from.x,from.z,from.yaw||0,from.y+shape.step,from.islandId);
    if(!start)return null;
    const yaw=to.yaw??Math.atan2(to.x-from.x,to.z-from.z),delta=Math.atan2(Math.sin(yaw-(from.yaw||0)),Math.cos(yaw-(from.yaw||0)));
    // Turning has a footprint too; check it before the translated sweep.
    for(let i=1;i<=Math.ceil(Math.abs(delta)/.2);i++)if(!stand(terrain,shape,from.x,from.z,(from.yaw||0)+delta*i/Math.ceil(Math.abs(delta)/.2),start.max+shape.step,start.islandId))return null;
    const count=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.2));let previous=start;
    for(let i=1;i<=count;i++){
      const p=i/count,current=stand(terrain,shape,from.x+(to.x-from.x)*p,from.z+(to.z-from.z)*p,yaw,previous.max+shape.step,start.islandId);
      if(!current||Math.abs(current.y-previous.y)>shape.step+1e-5||Math.abs(current.y-start.y)>shape.step+1e-5)return null;
      previous=current;
    }
    return previous;
  }
  return {profile,point,support,stand,route};
});
