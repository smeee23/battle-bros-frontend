// Real Hardhat → PostgreSQL/indexer → publisher → HTTP → frontend read-model run.
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),backend=path.resolve(root,'../battle-bros-backend'),contracts=path.resolve(root,'../battle-bros-contracts');
const runId=Date.now()+'-'+process.pid,output=path.join(root,'.local-territory/runs',runId);
let previous={};try{previous=JSON.parse(await fs.readFile(path.join(root,'.local-territory/current.json'),'utf8'));}catch{}
const postgresBin=process.env.POSTGRES_BIN||previous.postgresBin;
const children=new Set();
function run(cwd,args,env={}){return new Promise((ok,bad)=>{
 const child=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:'inherit'});children.add(child);
 child.on('error',bad);child.on('exit',code=>{children.delete(child);code===0?ok():bad(Error(`${args[0]} failed (${code})`));});
});}
let server;
const stop=()=>{for(const child of children)child.kill('SIGTERM');};
process.on('SIGINT',()=>{stop();process.exitCode=130;});process.on('SIGTERM',()=>{stop();process.exitCode=143;});
try {
 if(!postgresBin&&!process.env.E2E_DATABASE_URL)throw Error('Set POSTGRES_BIN to installed PostgreSQL binaries, or E2E_DATABASE_URL to an isolated local test server.');
 if(process.env.E2E_DATABASE_URL&&!['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.E2E_DATABASE_URL).hostname))throw Error('E2E_DATABASE_URL must point to a local test server.');
 await run(contracts,['node_modules/hardhat/internal/cli/cli.js','compile'],{MAINNET_RPC_URL:''});
 for(const name of ['TerritoryBro','TerritoryVault','TerritoryCombat','TerritoryRandomness','NeedsOracle','TerritoryMatchmaker']) {
   const artifact=JSON.parse(await fs.readFile(path.join(contracts,`artifacts/contracts/territory/${name}.sol/${name}.json`),'utf8'));
   const canonical=JSON.parse(await fs.readFile(path.join(contracts,`abis/territory/${name}.json`),'utf8'));
   assert.deepEqual(artifact.abi,canonical,`Canonical ABI drift for ${name}; run contracts interfaces:sync`);
 }
 await run(backend,['scripts/sync-contracts.mjs','--check']);
 await run(backend,['scripts/sync-schemas.mjs','--check']);
 await run(root,['scripts/sync-schemas.mjs','--check']);
 await run(root,['scripts/export-territory-abi.mjs','--check']);
 await fs.mkdir(output,{recursive:true});
 let library=process.env.LD_LIBRARY_PATH||'';
 if(postgresBin){const candidate=path.resolve(postgresBin,'../../../x86_64-linux-gnu');if(existsSync(candidate))library=candidate+(library?':'+library:'');}
 await run(backend,['scripts/territory-e2e.mjs'],{E2E_OUTPUT_DIR:output,LD_LIBRARY_PATH:library,...(postgresBin?{POSTGRES_BIN:postgresBin}:{})});
 // Pin the candidate run for verification; current.json remains untouched on failure.
 server=spawn(process.execPath,['tools/dev-server.js','0'],{cwd:root,env:{...process.env,BATTLEBROS_LOCAL_RUN:runId,BATTLEBROS_MANIFEST_URL:'',BATTLEBROS_DEPLOYMENT_MANIFEST:''},stdio:['ignore','pipe','pipe']});children.add(server);
 const origin=await new Promise((ok,bad)=>{
   const timeout=setTimeout(()=>bad(Error('Frontend dev server did not start')),15000);
   let log='';server.stdout.on('data',d=>{log+=d;const match=log.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);ok(match[0]);}});
   server.stderr.on('data',d=>process.stderr.write(d));server.on('error',e=>{clearTimeout(timeout);bad(e);});server.on('exit',code=>{clearTimeout(timeout);bad(Error('Frontend dev server exited '+code));});
 });
 const configContext={window:{}};vm.runInNewContext(await (await fetch(origin+'/runtime-config.js')).text(),configContext);
 const config=configContext.window.__battleBrosPublicData;
 const manifestUrl=new URL(config.manifestUrl,origin),manifest=await (await fetch(manifestUrl)).json();
 const stateBody=await (await fetch(new URL(manifest.paths.gameState,manifestUrl))).text(),state=JSON.parse(stateBody);
 const deployment=JSON.parse(await fs.readFile(path.join(output,'deployment.json'),'utf8'));
 assert.equal(manifest.deploymentId.toLowerCase(),deployment.combat.toLowerCase());
 assert.equal(createHash('sha256').update(stateBody).digest('hex'),manifest.contentHash);
 assert.equal(state.battleBros.length,5);assert.equal(state.challenges[0].status,'EXPIRED');
 // Execute the actual frontend adapter and rendering code against the served publication.
 class Element {constructor(){this.children=[];this.textContent='';this.value='';this.hidden=false;} append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;this.textContent='';}setAttribute(){}addEventListener(){}focus(){}get text(){return this.textContent+this.children.map(n=>n.text||'').join(' ');}}
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const context=vm.createContext({window:{__battleBrosPublicData:config},document:{getElementById:el,createElement:()=>new Element()},URL,URLSearchParams,fetch,console,location:{href:origin+'/',hostname:'127.0.0.1',protocol:'http:',search:''}});
 const html=await (await fetch(origin+'/')).text();
 vm.runInContext(html.slice(html.indexOf('  const BATTLEBRO_FRONTEND_EMPTY'),html.indexOf('  const resources = {')),context);
 assert(await context.hydrateBattleBrosReadModel(),'Frontend hydration must succeed');
 assert.equal(el('battlebro-source-badge').textContent,'CONFIRMED TERRITORY V2');
 for(const bro of state.battleBros){await context.showBattleHistory(bro.tokenId);assert.equal(el('battle-history-error').hidden,true);assert(el('battle-history-title').textContent.includes('#'+bro.tokenId));}
 await context.showBattleHistory('1');assert.match(el('battle-history-content').text,/EXPIRED/);
 assert.match(el('battle-history-content').text,/Training weights/);assert.match(el('battle-history-content').text,/Defense weights/);
 // Atomic activation makes the next dev-server request select this deployment.
 const pointer=path.join(root,'.local-territory/current.json');
 await fs.writeFile(pointer+'.tmp',JSON.stringify({run:runId,...(postgresBin?{postgresBin}: {})},null,2)+'\n');await fs.rename(pointer+'.tmp',pointer);
 console.log(`PASS: published deployment ${manifest.deploymentId} → HTTP manifest → frontend stats and token history.`);
 console.log(`Activated ${path.relative(root,output)}. Run npm run dev to browse it; no manifest editing needed.`);
 console.log('Hardhat and test PostgreSQL shut down after the test. Published data stays available for browsing; wallet transactions need a running chain.');
} finally {
 stop();
 if(server)await new Promise(r=>{if(server.exitCode!==null)r();else server.once('exit',r);});
}
