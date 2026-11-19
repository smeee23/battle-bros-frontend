/* Confirmed territory state and streamed visual adapters. No physics or render loop. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EndlessTerritories=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Preserve the original four sites; further confirmed IDs use native islands
 // in deterministic outward rings. Contract IDs are monotonic decimal strings.
 const original=[{id:'1',sx:1,sz:0,biome:'LAVA'},{id:'2',sx:2,sz:0,biome:'ICE'},{id:'3',sx:0,sz:2,biome:'DESERT'},{id:'4',sx:-2,sz:0,biome:'EARTH'}];
 function createLayout({exists=()=>true}={}){
  let signature='',byId=new Map(),bySector=new Map();
  function* candidates(){
   for(let r=3;;r++)for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++){
    if(Math.max(Math.abs(x),Math.abs(z))===r&&exists(x,z))yield {sx:x,sz:z};
   }
  }
  return {
   update(locations){
    const ids=[...new Set(locations.map(l=>String(l.locationId)).filter(id=>/^[1-9]\d*$/.test(id)))].sort((a,b)=>BigInt(a)<BigInt(b)?-1:BigInt(a)>BigInt(b)?1:0);
    const next=ids.join(',');if(next===signature)return false;
    signature=next;byId=new Map();bySector=new Map();const available=candidates();
    for(const id of ids){
     const pinned=original.find(p=>p.id===id);
     const placement=pinned?{...pinned}:{id,...available.next().value,biome:['LAVA','ICE','DESERT','EARTH'][Number((BigInt(id)-1n)%4n)]};
     byId.set(id,placement);bySector.set(placement.sx+','+placement.sz,placement);
    }
    return true;
   },
   get:id=>byId.get(String(id)),binding:(sx,sz,part)=>part===0?bySector.get(sx+','+sz):undefined
  };
 }
 function state(location,timestamp){if(!location)return 'locked';if(location.pendingChallengeId!=='0')return 'pending';if(!location.enabled)return 'locked';if(location.occupant==='0')return 'claimable';if(BigInt(location.cooldownUntil)>BigInt(timestamp)||location.departing)return 'cooldown';return 'ready';}
 function eligible(bro,location,config){if(bro?.riskableYieldWei!==undefined&&BigInt(bro.riskableYieldWei)<2000000000000000n)return false;if(bro?.projectedReserves&&bro.capacity&&config?.minimumBps){const min=(BigInt(bro.capacity)*BigInt(config.minimumBps)+9999n)/10000n;if(!bro.projectedReserves.some(n=>BigInt(n)>=min))return false;}return !!bro?.active&&bro.hatchedAt!=='0'&&!bro.need?.active&&bro.locationId===null&&bro.pendingChallengeId===null&&BigInt(bro.level)>=BigInt(location.minLevel)&&(location.maxLevel==='0'||BigInt(bro.level)<=BigInt(location.maxLevel));}
 function create(THREE,host){
  const records=new Map();let publication=null,age=0,fetching=false;
  // Cache each status palette once; streamed markers share its geometry and materials.
  const logoTemplate=host.createEthereumLogo(THREE),ringGeometry=new THREE.TorusGeometry(1.8,.12,3,24);
  const palettes={ready:0x86edff,cooldown:0xff5555,pending:0xff5555,claimable:0x55ee88,locked:0x71818c};
  const logoPalettes=new Map([['ready',logoTemplate]]);
  function statusLogo(status){
   const key=status==='pending'?'cooldown':status;
   if(logoPalettes.has(key))return logoPalettes.get(key);
   const logo=logoTemplate.clone(true),hue=key==='claimable'?1/3:0;
   logo.traverse(part=>{
    if(part.isMesh){
     part.geometry=part.geometry.clone();part.material=part.material.clone();
     const colors=part.geometry.getAttribute('color'),tint=new THREE.Color(),hsl={};
     for(let i=0;i<colors.count;i++){
      tint.fromBufferAttribute(colors,i).getHSL(hsl);
      tint.setHSL(hue,key==='locked'?0:.8,hsl.l);colors.setXYZ(i,tint.r,tint.g,tint.b);
     }
     part.material.emissive.setHex(key==='locked'?0x000000:key==='claimable'?0x083710:0x370808);
    }else if(part.isLineSegments){part.material=part.material.clone();part.material.color.setHex(palettes[key]);}
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
  function refresh(){if(fetching||!host.read)return;fetching=true;
   Promise.resolve().then(()=>host.read()).then(doc=>{host.setLocations?.(doc.locations);publication=doc;},()=>{publication=null;}).finally(()=>{fetching=false;});
  }
  function tick(t,dt){
   if(!host.active()){for(const [id,r] of records)release(id,r);publication=null;age=0;host.closePrompt?.();host.status?.('');return;}
   age-=dt;if(age<=0){age=3;refresh();}
   const bodies=host.bodies(),seen=new Set(),player=host.player();let built=false,nearest=18,label='';
   for(const body of bodies){const id=body.site.territoryId;seen.add(id);let r=records.get(id);if(r&&r.body!==body){release(id,r);r=null;}if(!r){r=marker(body);records.set(id,r);}
    const location=publication?.locations.find(l=>l.locationId===id),status=state(location,publication?.snapshot.timestamp??'0');r.location=location;
    if(r.state!==status){r.state=status;r.material.color.setHex(palettes[status]);r.material.emissive.setHex(status==='locked'?0x000000:0x082137);
     const paletteLogo=statusLogo(status);
     r.logo.children.forEach((part,i)=>{part.geometry=paletteLogo.children[i].geometry;part.material=paletteLogo.children[i].material;});
     r.marker.userData.state=status;
    }
    // The existing world tick supplies paused time; no independent animation loop.
    r.logo.position.y=4+Math.sin(t*.9)*.35;
    r.logo.rotation.y=(t*.12)%(Math.PI*2);
    const distance=Math.hypot(body.root.position.x-player.x,body.root.position.z-player.z);
    if(distance<nearest){nearest=distance;label='Territory #'+id+' · '+({ready:'Ready to attack',cooldown:'Cooldown',pending:'Battle pending',claimable:'Claimable · Throw your BRO cube near the logo to claim',locked:'Unavailable / awaiting confirmed data'})[status];}
    const bro=location?.occupant!=='0'?publication?.battleBros.find(b=>b.active&&b.tokenId===location?.occupant&&b.locationId===id):null;
    const signature=bro?.active?[bro.tokenId,bro.kind,bro.level,bro.appearance?.revision??''].join(':'):'';
    if(r.actor&&!r.actor.encounter&&(r.signature!==signature||distance>70||!r.actor.root.parent)){host.removeActor(r.actorKey,r.actor);r.actor=null;}
    if(bro&&distance<42&&!r.actor&&!built&&t>=(r.nextSpawn||0)){r.nextSpawn=t+2;built=true;r.actor=host.spawn(body,bro,r.actorKey);if(r.actor)r.signature=signature;}
    if(r.actor){r.actor.territoryLocationId=id;r.actor.territoryState=status;r.actor.territoryLocation=location;}
   }
   for(const [id,r] of records)if(!seen.has(id))release(id,r);
   host.status?.(label);
  }
  // Explicit cube deployment replaces the automatic proximity prompt.
  function requestClaim(point,islandId){
   if(!host.active()||!publication||!host.canPrompt())return false;
   for(const [id,r] of records){
    if(r.body.site.id!==islandId||Math.hypot(r.body.root.position.x-point.x,r.body.root.position.z-point.z)>=6)continue;
    const location=publication.locations.find(l=>l.locationId===id);
    if(state(location,publication.snapshot.timestamp)!=='claimable')continue;
    if(!host.canClaim?.(location,publication)){
     host.notify?.(host.claimBlockedMessage?.(location,publication)||'Your selected BRO is not eligible to claim this territory.');return false;
    }
    host.promptClaim(id);return true;
   }
   return false;
  }
  return {tick,refresh,requestClaim,location:id=>publication?.locations.find(l=>l.locationId===String(id)),bro:id=>publication?.battleBros.find(b=>b.tokenId===String(id)),get publication(){return publication;}};
 }
 return {createLayout,state,eligible,create};
});
