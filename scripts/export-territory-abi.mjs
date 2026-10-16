import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(resolve(import.meta.dirname,'../../battle-bros-contracts/package.json'));
const {id}=require('ethers');

const sources={
  TerritoryCombat:'../../battle-bros-contracts/abis/territory/TerritoryCombat.json',
  TerritoryBro:'../../battle-bros-contracts/abis/territory/TerritoryBro.json',
  NeedsOracle:'../../battle-bros-contracts/abis/territory/NeedsOracle.json',
  StETH:'../../battle-bros-backend/packages/contracts/abi/StETH.json',
};
const result={};
for(const [name,path] of Object.entries(sources)) {
  const artifact=JSON.parse(await readFile(resolve(import.meta.dirname,path),'utf8'));
  result[name]=(artifact.abi??artifact).filter(x=>x.type==='function').map(x=>{
    const signature=`${x.name}(${x.inputs.map(function type(i){return i.type.startsWith('tuple')?'('+i.components.map(type).join(',')+')'+i.type.slice(5):i.type;}).join(',')})`;
    return {name:x.name,signature,selector:id(signature).slice(0,10),inputs:x.inputs};
  });
}
const target=resolve(import.meta.dirname,'../assets/territory-abi.json'),body=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==body)throw Error('Frontend ABI drift');}else await writeFile(target,body);
