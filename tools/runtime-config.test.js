const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {localRuntime}=require('./local-territory.cjs');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'territory-config-'));
const clean=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('BATTLEBROS_')));
const config=path.join(temp,'config.json'),output=path.join(temp,'runtime.js');
const generate=env=>{execFileSync(process.execPath,['scripts/generate-runtime-config.mjs','--config',config,'--output',output],{cwd:root,env:{...clean,...env}});const ctx={window:{}};vm.runInNewContext(fs.readFileSync(output,'utf8'),ctx);return ctx.window.__battleBrosPublicData;};
try {
 fs.writeFileSync(config,'{}');assert.equal(generate().manifestUrl,undefined,'No fake deployment by default');
 assert.equal(generate({BATTLEBROS_MANIFEST_URL:'http://localhost:1234/manifest.json'}).manifestUrl,'http://localhost:1234/manifest.json','Explicit URL needs no deployment file or S3 settings');
 const deployment={schemaVersion:2,chainId:'31337',combat:'0x'+'a'.repeat(40),bros:'0x'+'b'.repeat(40),vault:'0x'+'c'.repeat(40),needs:'0x'+'d'.repeat(40)};
 fs.writeFileSync(path.join(temp,'deployment.json'),JSON.stringify(deployment));
 fs.writeFileSync(config,JSON.stringify({deploymentManifest:'deployment.json',publicDataOrigin:'http://localhost:1234',prefix:'test'}));
 assert.equal(generate().manifestUrl,`http://localhost:1234/test/v2/31337/${deployment.combat}/manifest.json`);
 assert.equal(generate({BATTLEBROS_MANIFEST_URL:'http://localhost:1235/manifest.json'}).manifestUrl,'http://localhost:1235/manifest.json');
 fs.writeFileSync(config,JSON.stringify({deploymentManifest:'deleted-old-deployment.json'}));
 assert.equal(generate({BATTLEBROS_MANIFEST_URL:'http://localhost:1235/manifest.json'}).manifestUrl,'http://localhost:1235/manifest.json','URL override bypasses stale deployment files');
 assert.equal(localRuntime(temp),null);
 for(const run of ['first','second']){
   const directory=path.join(temp,'.local-territory/runs',run,'public');fs.mkdirSync(directory,{recursive:true});
   const snapshot={blockNumber:run==='first'?'1':'2'},manifest={schemaVersion:2,projectionVersion:3,deploymentId:run,snapshot,paths:{gameState:'state.json'}};
   fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest));fs.writeFileSync(path.join(directory,'state.json'),JSON.stringify({deploymentId:run,snapshot,battleBros:[{tokenId:'1',active:true}]}));
   fs.writeFileSync(path.join(temp,'.local-territory/current.json'),JSON.stringify({run}));
   assert.equal(localRuntime(temp).manifestUrl,`/.local-territory/runs/${run}/public/manifest.json`,'Latest deployment is discovered on every request');
 }
 assert.match(localRuntime(temp,'first').manifestUrl,/first/,'Candidate run can be tested before activation');
 assert.throws(()=>localRuntime(temp,'../escape'));
 console.log('Runtime configuration: unconfigured defaults, explicit URLs, deployment-derived identity and automatic local-run switching passed');
} finally {fs.rmSync(temp,{recursive:true,force:true});}
