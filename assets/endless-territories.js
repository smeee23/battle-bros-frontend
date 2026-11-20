/* Confirmed territory state and streamed visual adapters. No physics or render loop. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EndlessTerritories=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Coordinates belong to the terrain. Each published ID can occupy one
 // coordinate for the lifetime of the page, including across trips Home.
 const MAX_WINDOW_TERRITORIES=2;
 const DEFENDER_SPAWN_DISTANCE=32,DEFENDER_RELEASE_DISTANCE=52;
 function createLayout({exists,streamRadius=2,random=Math.random}){
  const byId=new Map(),bySector=new Map();
  const key=(sx,sz)=>sx+','+sz;
  function fits({sx,sz}){
   if(!bySector.size)return true;
   const span=2*streamRadius,neighbors=[];
   for(let dx=-span;dx<=span;dx++)for(let dz=-span;dz<=span;dz++){
    const existing=bySector.get(key(sx+dx,sz+dz));
    if(!existing)continue;
    if(Math.max(Math.abs(dx),Math.abs(dz))<2)return false;
    // Three placements fit in some render window if their bounding rectangle
    // fits, even when the player later approaches from a different direction.
    for(const other of neighbors){
     if(Math.max(sx,existing.sx,other.sx)-Math.min(sx,existing.sx,other.sx)<=span
       &&Math.max(sz,existing.sz,other.sz)-Math.min(sz,existing.sz,other.sz)<=span)return false;
    }
    neighbors.push(existing);
   }
   return true;
  }
  function slots(sx,sz,radius=streamRadius){
   const result=[];
   for(let r=1;r<=radius;r++){
    for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
     if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
     const x=sx+dx,z=sz+dz;
     const slot={sx:x,sz:z};
     if(exists(x,z)&&fits(slot))result.push(slot);
    }
   }
   return result.sort((a,b)=>(a.sx-sx)**2+(a.sz-sz)**2-(b.sx-sx)**2-(b.sz-sz)**2);
  }
  function assign(id,slot){
   if(byId.has(id))return byId.get(id);
   if(!slot||!fits(slot))return null;
   const placement={id,...slot};
   byId.set(id,placement);
   bySector.set(key(slot.sx,slot.sz),placement);
   return placement;
  }
  function populate(open,limit,publication,token){
   limit=Math.min(open.length,limit);
   if(limit<=0)return [];
   const result=[],groups={claim:[],attack:[],unavailable:[]};
   const bros=new Map(publication.battleBros.map(bro=>[bro.tokenId,bro]));
   for(const location of publication.locations){
    if(byId.has(location.locationId))continue;
    const match=availability(location,publication.snapshot.timestamp,bros.get(token),
      bros.get(location.occupant),publication.configuration);
    groups[match.kind].push(location.locationId);
   }
   let slotIndex=0;
   for(const list of Object.values(groups)){
    // Sample without replacement within each priority group.
    for(let i=0;i<list.length&&result.length<limit;i++){
     while(slotIndex<open.length&&!fits(open[slotIndex]))slotIndex++;
     if(slotIndex>=open.length)return result;
     const j=i+Math.floor(random()*(list.length-i));
     [list[i],list[j]]=[list[j],list[i]];
     result.push(assign(list[i],open[slotIndex++]));
    }
   }
   return result;
  }
  function* withinSectors(minX,maxX,minZ,maxZ){
   for(let sx=minX;sx<=maxX;sx++)for(let sz=minZ;sz<=maxZ;sz++){
    const placement=bySector.get(key(sx,sz));
    if(placement)yield placement;
   }
  }
  return {
   slots,assign,populate,withinSectors,get:id=>byId.get(String(id)),
   binding:(sx,sz,part)=>part===0?bySector.get(key(sx,sz)):undefined
  };
 }
 function state(location,timestamp){
  if(!location)return 'locked';
  if(location.pendingChallengeId!=='0')return 'pending';
  if(!location.enabled)return 'locked';
  if(location.occupant==='0')return 'claimable';
  if(location.departing||BigInt(location.cooldownUntil)>BigInt(timestamp))return 'cooldown';
  return 'ready';
 }
 function broRestriction(bro,location,config){
  if(!bro?.active||bro.hatchedAt==='0')return 'Select an active, hatched BRO';
  if(bro.pendingChallengeId!==null)return 'Your BRO has a pending battle';
  if(bro.locationId!==null)return 'Your BRO already holds a territory';
  if(bro.need?.active)return 'Your BRO needs care at Home';
  if(BigInt(bro.level)<BigInt(location.minLevel)
    ||(location.maxLevel!=='0'&&BigInt(bro.level)>BigInt(location.maxLevel))){
   return location.maxLevel==='0'?'Requires level '+location.minLevel+' or higher'
     :'Requires level '+location.minLevel+'–'+location.maxLevel;
  }
  if(bro.riskableYieldWei!==undefined&&BigInt(bro.riskableYieldWei)<2000000000000000n)return 'Your BRO needs more riskable yield';
  if(bro.projectedReserves&&bro.capacity&&config?.minimumBps){
   const min=(BigInt(bro.capacity)*BigInt(config.minimumBps)+9999n)/10000n;
   if(!bro.projectedReserves.some(n=>BigInt(n)>=min))return 'Your BRO needs more power';
  }
  return '';
 }
 function availability(location,timestamp,bro,defender,config){
  const status=state(location,timestamp);
  if(status==='locked')return {kind:'unavailable',status,reason:location?'Territory disabled':'Missing confirmed territory data'};
  if(status==='pending')return {kind:'unavailable',status,reason:'Battle pending'};
  if(status==='cooldown')return {kind:'unavailable',status,reason:location.departing?'Defender departing':'Cooldown'};
  if(location.occupant===bro?.tokenId)return {kind:'unavailable',status:'locked',reason:'Your defended territory'};
  let reason=broRestriction(bro,location,config);
  if(!reason&&status==='claimable'){
   if(location.reclaimBlockedTokenId===bro.tokenId
     ||(location.reclaimBlockedOwner&&location.reclaimBlockedOwner.toLowerCase()===bro.owner?.toLowerCase())){
    reason='Reclaim restricted for your BRO or wallet';
   }else if(bro.riskableShares!==undefined&&config?.riskBps!==undefined
     &&BigInt(bro.riskableShares)*BigInt(config.riskBps)<10000n)reason='Your BRO needs more riskable shares';
  }
  if(!reason&&status==='ready'){
   if(!defender?.active||defender.locationId!==location.locationId)reason='Defender data unavailable';
   else if(defender.pendingChallengeId!=null)reason='Defender has a pending battle';
   else if(bro.riskableShares!==undefined&&defender.riskableShares!==undefined&&config?.riskBps!==undefined){
    const defenderShares=BigInt(defender.riskableShares),attackerShares=BigInt(bro.riskableShares);
    const smaller=attackerShares<defenderShares?attackerShares:defenderShares;
    if(defenderShares!==0n&&smaller*BigInt(config.riskBps)<10000n)reason='Not enough riskable shares for this battle';
   }
  }
  if(reason)return {kind:'unavailable',status:'locked',reason};
  return status==='claimable'
   ?{kind:'claim',status,reason:'Claimable · Throw your BRO cube near the logo to claim'}
   :{kind:'attack',status,reason:'Ready to attack'};
 }
 function create(THREE,host){
  const records=new Map();
  const appearanceCache=new Map();
  let publication=null,age=0,request=null,failed=false;
  let locationsById=new Map(),brosById=new Map(),appearancesById=new Map();
  // Cache each status palette once; streamed markers share its geometry and materials.
  const logoTemplate=host.createEthereumLogo(THREE),ringGeometry=new THREE.TorusGeometry(1.8,.12,3,24);
  const palettes={ready:0x86edff,cooldown:0xff5555,pending:0xff5555,claimable:0x55ee88,locked:0x71818c,owned:0xb0b5cc};
  const ownedOutline=0xd7dcf2;
  const logoPalettes=new Map([['ready',logoTemplate]]);
  function statusLogo(status){
   const key=status==='pending'?'cooldown':status;
   if(logoPalettes.has(key))return logoPalettes.get(key);
   const logo=logoTemplate.clone(true),hue=key==='claimable'?1/3:0;
   const owned=key==='owned';
   logo.traverse(part=>{
    if(part.isMesh){
     part.geometry=part.geometry.clone();part.material=part.material.clone();
     const colors=part.geometry.getAttribute('color'),tint=new THREE.Color(),hsl={};
     for(let i=0;i<colors.count;i++){
      tint.fromBufferAttribute(colors,i).getHSL(hsl);
      if(owned)tint.setHSL(.64,.16,.08+hsl.l*.12);
      else tint.setHSL(hue,key==='locked'?0:.8,hsl.l);
      colors.setXYZ(i,tint.r,tint.g,tint.b);
     }
     part.material.emissive.setHex(owned?0x191c27:key==='locked'?0x000000:key==='claimable'?0x083710:0x370808);
     if(owned)part.material.specular.setHex(0x646879);
    }else if(part.isLineSegments){
     part.material=part.material.clone();
     part.material.color.setHex(owned?ownedOutline:palettes[key]);
     if(owned)part.material.opacity=.8;
    }
   });
   logoPalettes.set(key,logo);return logo;
  }
  function release(id,r){if(r.actor&&!r.actor.encounter)host.removeActor(r.actorKey,r.actor);r.marker.parent?.remove(r.marker);r.material.dispose();records.delete(id);}
  function marker(body){
   const material=new THREE.MeshPhongMaterial({color:0x48bce9,emissive:0x082137,flatShading:true,shininess:75});
   const root=new THREE.Group(),logo=logoTemplate.clone(true);
   logo.scale.setScalar(.025);logo.position.y=4;root.add(logo);
   const ring=new THREE.Mesh(ringGeometry,material);ring.rotation.x=Math.PI/2;ring.position.y=.3;root.add(ring);
   root.position.set(0,host.surface(body),0);root.name='territory-ethereum-'+body.site.territoryId;body.root.add(root);
   return {marker:root,material,logo,ring,body,actor:null,actorKey:'territory:'+body.site.territoryId,signature:'',state:null};
  }
  function accept(doc){
   if(!Array.isArray(doc?.locations)||!Array.isArray(doc?.battleBros)||doc.snapshot?.timestamp==null){
    throw Error('Territory publication is missing location data');
   }
   locationsById=new Map(doc.locations.map(location=>[location.locationId,location]));
   brosById=new Map(doc.battleBros.map(bro=>[bro.tokenId,bro]));
   appearancesById=new Map((doc.worlds??[]).filter(world=>world.kind==='appearance').map(world=>[world.id,world]));
   publication=doc;failed=false;
  }
  function refresh(){
   if(!request&&host.read){
    request=Promise.resolve().then(()=>host.read()).then(doc=>{accept(doc);return doc;}).catch(()=>{
     publication=null;locationsById.clear();brosById.clear();appearancesById.clear();failed=true;return null;
    }).finally(()=>{request=null;});
   }
   return request;
  }
  const location=id=>locationsById.get(String(id));
  const bro=id=>brosById.get(String(id));
  function opportunity(territory){
   return availability(territory,publication?.snapshot.timestamp??'0',bro(host.selectedToken?.()),
    bro(territory?.occupant),publication?.configuration);
  }
  function markerStyle(territory,status,selectedToken){
   return territory.occupant!=='0'&&territory.occupant===selectedToken?'owned':status;
  }
  function minimapMarker(id){
   const territory=location(id);
   if(!territory)return null;
   const style=markerStyle(territory,opportunity(territory).status,host.selectedToken?.());
   return style==='owned'?{fill:0x252733,outline:ownedOutline}:{fill:palettes[style],outline:0x101522};
  }
  function defenderAppearance(resident,t,inRange){
   const descriptor=appearancesById.get(resident.tokenId);
   if(!descriptor||!host.readAppearance)return resident.appearance;
   const version=descriptor.path;
   let entry=appearanceCache.get(version);
   if(inRange&&(!entry||entry.retryAt<=t)){
    entry={version,pending:true};
    appearanceCache.set(version,entry);
    if(appearanceCache.size>64)appearanceCache.delete(appearanceCache.keys().next().value);
    const read=entry;
    Promise.resolve().then(()=>host.readAppearance(descriptor))
      .then(document=>{read.document=document;},()=>{read.retryAt=t+15;})
      .finally(()=>{read.pending=false;});
   }
   return entry;
  }
  function tick(t,dt){
   if(!host.active()){
    for(const [id,r] of records)release(id,r);
    age=0;host.closePrompt?.();host.status?.('');return;
   }
   age-=dt;if(age<=0){age=3;refresh();}
   const player=host.player(),selectedToken=host.selectedToken?.();
   host.placeNearby?.(player,publication);
   const seen=new Set();let built=false,nearest=18,label='';
   for(const body of host.bodies()){
    const id=body.site.territoryId,territory=location(id);
    if(!territory)continue;
    seen.add(id);
    let r=records.get(id);
    if(r&&r.body!==body){release(id,r);r=null;}
    if(!r){r=marker(body);records.set(id,r);}
    const match=opportunity(territory),status=match.status;
    const logoStyle=markerStyle(territory,status,selectedToken);
    if(r.state!==status||r.logoStyle!==logoStyle){
     r.state=status;r.logoStyle=logoStyle;
     const ringStyle=status==='locked'?logoStyle:status;
     r.material.color.setHex(palettes[ringStyle]);
     r.material.emissive.setHex(status==='locked'?0x000000:0x082137);
     const paletteLogo=statusLogo(logoStyle);
     r.logo.children.forEach((part,i)=>{part.geometry=paletteLogo.children[i].geometry;part.material=paletteLogo.children[i].material;});
     r.marker.userData.state=status;
    }
    // The existing world tick supplies paused time; no independent animation loop.
    r.logo.position.y=4+Math.sin(t*.9)*.35;
    r.logo.rotation.y=(t*.12)%(Math.PI*2);
    const distance=Math.hypot(body.root.position.x-player.x,body.root.position.z-player.z);
    if(distance<nearest){nearest=distance;label='Territory #'+id+' · '+match.reason;}
    const defender=bro(territory.occupant);
    const resident=defender?.active&&defender.locationId===id?defender:null;
    const inRange=distance<DEFENDER_SPAWN_DISTANCE;
    const appearance=resident&&defenderAppearance(resident,t,inRange&&!r.actor?.encounter);
    const signature=resident?[resident.tokenId,resident.kind,resident.level].join(':'):'';
    const appearanceVersion=appearance?.document?(appearance.version??appearance.revision):undefined;
    const appearanceChanged=!appearance?.pending&&!appearance?.retryAt&&appearanceVersion!==r.appearanceVersion;
    if(r.actor&&!r.actor.encounter&&(r.signature!==signature||appearanceChanged||distance>DEFENDER_RELEASE_DISTANCE||!r.actor.root.parent)){
     host.removeActor(r.actorKey,r.actor);r.actor=null;
    }
    if(resident&&inRange&&!appearance?.pending&&!r.actor&&!built&&t>=(r.nextSpawn||0)){
     r.nextSpawn=t+2;built=true;r.actor=host.spawn(body,resident,r.actorKey,appearance?.document);
     if(r.actor){r.signature=signature;r.appearanceVersion=appearanceVersion;}
    }
    if(r.actor){r.actor.territoryLocationId=id;r.actor.territoryState=status;r.actor.territoryLocation=territory;}
   }
   for(const [id,r] of records)if(!seen.has(id))release(id,r);
   if(!publication)label=failed?'Confirmed territory data is unavailable':'Loading confirmed territory data…';
   else if(!publication.locations.length)label='No confirmed territories exist in this world';
   host.status?.(label);
  }
  // Explicit cube deployment replaces the automatic proximity prompt.
  function requestClaim(point,islandId){
   if(!host.active()||!publication||!host.canPrompt())return false;
   for(const [id,r] of records){
    if(r.body.site.id!==islandId||Math.hypot(r.body.root.position.x-point.x,r.body.root.position.z-point.z)>=6)continue;
    const territory=location(id);
    if(state(territory,publication.snapshot.timestamp)!=='claimable')continue;
    const match=opportunity(territory);
    if(match.kind!=='claim'||!host.ownsSelected?.()){
     const reason=match.kind!=='claim'?match.reason:'Connect the wallet that owns your BRO';
     host.notify?.('Cannot claim territory #'+id+' · '+reason);return false;
    }
    host.promptClaim(id);return true;
   }
   return false;
  }
  return {tick,accept,refresh,requestClaim,location,opportunity,minimapMarker,get publication(){return publication;}};
 }
 return {createLayout,MAX_WINDOW_TERRITORIES,state,availability,create};
});
