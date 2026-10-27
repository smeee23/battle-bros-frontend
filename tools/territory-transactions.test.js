const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Interface}=require('../../battle-bros-contracts/node_modules/ethers');
const source=fs.readFileSync('territory.js','utf8'),ABI=JSON.parse(fs.readFileSync('assets/territory-abi.json'));
const context=vm.createContext({ABI,TextEncoder,BigInt,Array,Number,Error,u:x=>BigInt(x??0)});
vm.runInContext(source.slice(source.indexOf('function encodeValue'),source.indexOf('async function transact')).replace('export function','function'),context);
for(const [contract,name,args] of [
 ['TerritoryBro','hatch',['1',0,[3334,3333,3333],[10000,0,0],'Nova 🚀']],
 ['TerritoryMatchmaker','advanceMatching',['1',32]],
 ['TerritoryMatchmaker','resolveSide',['1']],
 ['TerritoryCombat','claim',['1','2','3',[10000,0,0]]],
 ['TerritoryCombat','challenge',['1','2',0,10,'3','4',1900000000,[10000,0,0]]]
]){
 const abi=JSON.parse(fs.readFileSync(`../battle-bros-contracts/abis/territory/${contract}.json`));
 assert.equal(context.encode(contract,name,args),new Interface(abi).encodeFunctionData(name,args));
}
assert.match(source,/10n\*\*18n/);
assert.doesNotMatch(source,/10n\*\*17n/);
console.log('Territory transaction encoding matches canonical contract ABI');
