const fs=require('node:fs'),path=require('node:path');
function localRuntime(root,runOverride) {
  let run=runOverride;
  if(!run){const pointer=path.join(root,'.local-territory/current.json');if(!fs.existsSync(pointer))return null;run=JSON.parse(fs.readFileSync(pointer,'utf8')).run;}
  if(typeof run!=='string'||!/^[a-zA-Z0-9-]+$/.test(run))throw Error('Invalid local territory run identifier');
  const relative=`.local-territory/runs/${run}/public/manifest.json`;
  const manifest=JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));
  if(manifest.schemaVersion!==4||manifest.projectionVersion!==5)throw Error('Unsupported local territory publication');
  const game=JSON.parse(fs.readFileSync(path.resolve(root,path.dirname(relative),manifest.paths.gameState),'utf8'));
  if(game.deploymentId!==manifest.deploymentId||JSON.stringify(game.snapshot)!==JSON.stringify(manifest.snapshot))throw Error('Local territory publication mismatch');
  return {schemaVersion:4,manifestUrl:'/'+relative,tokenId:game.battleBros.find(b=>b.active)?.tokenId??null};
}
module.exports={localRuntime};
