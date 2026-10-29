// Isolated, long-running local EVM → PostgreSQL → existing publisher → local HTTP.
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),backend=path.resolve(root,'../battle-bros-backend'),contracts=path.resolve(root,'../battle-bros-contracts');
const requireBackend=createRequire(path.join(backend,'package.json')),requireContracts=createRequire(path.join(contracts,'package.json'));
const {default:pg}=await import(requireBackend.resolve('pg')), {ethers}=requireContracts('ethers');
const exec=promisify(execFile),children=new Set();
const clean=Object.fromEntries(['PATH','HOME','USER','LANG','LD_LIBRARY_PATH'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const cli=path.join(contracts,'node_modules/hardhat/internal/cli/cli.js');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const listen=(server,port)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve(server.address().port));});
const port=async()=>{const s=createServer();const p=await listen(s,0);await new Promise(r=>s.close(r));return p;};
async function run(file,args,cwd,extra={}) {return exec(file,args,{cwd,env:{...clean,...extra},maxBuffer:8*1024*1024});}
function start(file,args,cwd,env,log) {
  const child=spawn(file,args,{cwd,env:{...clean,...env},stdio:['ignore','pipe','pipe']});children.add(child);
  child.on('error',error=>console.error(error.message));child.once('exit',()=>children.delete(child));
  for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{fs.appendFile(log,data).catch(()=>{});});
  return child;
}
export async function startLocalDev(options={}) {
  const runId=randomUUID(),privateDir=path.join(backend,'.local-dev',runId),publicDir=path.join(root,'.local-territory/runs',runId,'public');
  await fs.mkdir(privateDir,{recursive:true,mode:0o700});await fs.mkdir(publicDir,{recursive:true});
  const rpcPort=options.rpcPort===0?await port():options.rpcPort??Number(process.env.LOCAL_RPC_PORT??8545),frontendPort=options.frontendPort??Number(process.env.LOCAL_FRONTEND_PORT??3012);
  const confirmations=options.confirmations??2;
  let pgBin=process.env.POSTGRES_BIN;
  if(!pgBin){try{pgBin=JSON.parse(await fs.readFile(path.join(root,'.local-territory/current.json'),'utf8')).postgresBin;}catch{}}
  if(!pgBin||!existsSync(path.join(pgBin,'initdb'))){
    try{pgBin=(await exec('pg_config',['--bindir'])).stdout.trim();}catch{}
  }
  const externalDB=process.env.LOCAL_DATABASE_URL;
  if(externalDB&&!['127.0.0.1','localhost','[::1]'].includes(new URL(externalDB).hostname))throw Error('LOCAL_DATABASE_URL must point to a local PostgreSQL server.');
  if(!externalDB&&(!pgBin||!existsSync(path.join(pgBin,'initdb'))))throw Error('Set POSTGRES_BIN to PostgreSQL binaries, or LOCAL_DATABASE_URL to a local development database.');
  if(pgBin){const libs=path.resolve(pgBin,'../../../x86_64-linux-gnu');if(existsSync(libs))clean.LD_LIBRARY_PATH=libs+(clean.LD_LIBRARY_PATH?':'+clean.LD_LIBRARY_PATH:'');}
  let pool,provider,sink,front,node,pgStarted=false,stopping=false,workers={},runtime;
  const logs=name=>path.join(privateDir,name+'.log');
  async function stopChild(child) {
    if(!child||child.exitCode!==null)return;
    const ended=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');
    let timeout;await Promise.race([ended,new Promise(resolve=>{timeout=setTimeout(()=>{child.kill('SIGKILL');resolve();},6000);})]);clearTimeout(timeout);
  }
  async function stop() {
    if(stopping)return;stopping=true;
    for(const signal of ['SIGINT','SIGTERM'])process.removeListener(signal,onSignal);
    await Promise.all(Object.values(workers).map(stopChild));
    await stopChild(front);await stopChild(node);
    if(sink){sink.closeAllConnections();await new Promise(r=>sink.close(r));}
    await pool?.end();provider?.destroy();
    if(pgStarted)await run(path.join(pgBin,'pg_ctl'),['-D',path.join(privateDir,'pg'),'-m','fast','-w','stop'],backend).catch(()=>{});
  }
  const onSignal=()=>{stop().finally(()=>process.exit());};
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,onSignal);
  try {
    console.log('Compiling contracts and building wallet assets…');
    await run(process.execPath,[cli,'compile'],contracts,{MAINNET_RPC_URL:''});
    for(const name of ['TerritoryBro','TerritoryVault','TerritoryCombat','TerritoryRandomness','NeedsOracle','TerritoryMatchmaker']){
      const artifact=JSON.parse(await fs.readFile(path.join(contracts,`artifacts/contracts/territory/${name}.sol/${name}.json`),'utf8'));
      const abi=JSON.parse(await fs.readFile(path.join(contracts,`abis/territory/${name}.json`),'utf8'));
      if(JSON.stringify(artifact.abi)!==JSON.stringify(abi))throw Error('Compiled ABI drift: '+name);
    }
    await run(process.execPath,['scripts/build-wallet.mjs'],root);
    // Check release interfaces before starting any indexer.
    await run(process.execPath,['scripts/sync-contracts.mjs','--check'],backend);
    await run(process.execPath,['scripts/sync-schemas.mjs','--check'],backend);
    await run(process.execPath,['scripts/sync-schemas.mjs','--check'],root);
    node=start(process.execPath,[cli,'node','--hostname','127.0.0.1','--port',String(rpcPort)],contracts,{MAINNET_RPC_URL:''},logs('hardhat'));
    await new Promise((resolve,reject)=>{let text='';const timeout=setTimeout(()=>reject(Error('Hardhat startup timed out')),20000);node.stdout.on('data',data=>{text+=data;if(text.includes('Started HTTP and WebSocket JSON-RPC server')){clearTimeout(timeout);resolve();}});node.once('exit',()=>{clearTimeout(timeout);reject(Error('Hardhat could not bind its port; see '+logs('hardhat')));});});
    const rpc=`http://127.0.0.1:${rpcPort}`;provider=new ethers.JsonRpcProvider(rpc,31337,{cacheTimeout:-1,staticNetwork:true});
    for(let i=0;;i++){if(node.exitCode!==null)throw Error('Hardhat could not start; see '+logs('hardhat'));try{await provider.getBlockNumber();break;}catch{if(i>100)throw Error('Local RPC did not start');await delay(100);}}
    // Fresh node only: refuse an occupied endpoint even if another node answered.
    await delay(150);if(node.exitCode!==null)throw Error('Local RPC port is already in use.');
    const admin=await provider.getSigner(0);
    async function deploy(name,args=[]) {
      const category=name.endsWith('Mock')?'mocks':'territory';
      const artifact=JSON.parse(await fs.readFile(path.join(contracts,`artifacts/contracts/${category}/${name}.sol/${name}.json`),'utf8'));
      const x=await new ethers.ContractFactory(artifact.abi,artifact.bytecode,admin).deploy(...args);await x.waitForDeployment();return x;
    }
    const deploymentBlock=String((await provider.getBlockNumber())+1);
    const stETH=await deploy('StETHMock'),vrf=await deploy('VRFCoordinatorV2PlusMock');
    const randomness=await deploy('TerritoryRandomness',[admin.address,vrf.target,ethers.ZeroHash,1,3,1200000,'0x']);
    const needs=await deploy('NeedsOracle',[admin.address,randomness.target,0]);
    const vault=await deploy('TerritoryVault',[admin.address,stETH.target,ethers.ZeroAddress]);
    const bros=await deploy('TerritoryBro',[admin.address,vault.target,needs.target]);
    const combat=await deploy('TerritoryCombat',[admin.address,bros.target,vault.target,randomness.target]);
    for(const tx of [await randomness.wire(combat.target,needs.target),await bros.wire(combat.target),await vault.wireModules(bros.target,combat.target)])await tx.wait();
    await (await combat.createLocations(1,4,1)).wait();
    const deployment={schemaVersion:2,chainId:'31337',deploymentBlock,stETH:String(stETH.target),randomness:String(randomness.target),needs:String(needs.target),vault:String(vault.target),bros:String(bros.target),combat:String(combat.target),matchmaker:String(await combat.matchmaker())};
    const deploymentFile=path.join(privateDir,'deployment.json');await fs.writeFile(deploymentFile,JSON.stringify(deployment));
    let dbURL=externalDB;
    if(!dbURL){
      const pgPort=await port(),data=path.join(privateDir,'pg');
      await run(path.join(pgBin,'initdb'),['-D',data,'--auth=trust','--no-locale'],backend);
      await run(path.join(pgBin,'pg_ctl'),['-D',data,'-l',logs('postgres'),'-o',`-p ${pgPort} -h 127.0.0.1 -k /tmp`,'-w','start'],backend);pgStarted=true;
      dbURL=`postgresql://${process.env.USER??'openclaw'}@127.0.0.1:${pgPort}/postgres`;
    }
    pool=new pg.Pool({connectionString:dbURL});
    const schema='local_'+runId.replaceAll('-','');await pool.query(`create schema ${schema}`);
    const scoped=new URL(dbURL);scoped.searchParams.set('options',`-c search_path=${schema}`);
    const db=new pg.Pool({connectionString:scoped.href});
    try{for(const file of (await fs.readdir(path.join(backend,'packages/database/migrations'))).sort()){
      const sql=(await fs.readFile(path.join(backend,'packages/database/migrations',file),'utf8')).split('-- Down Migration')[0];await db.query(sql);
    }}finally{await db.end();}
    const prefix=`/local-battlebros/battle-bros/v2/31337/${deployment.combat.toLowerCase()}/`;
    let origin;
    const common={DEPLOYMENT_MANIFEST_PATH:deploymentFile,RPC_HTTP_URL:rpc,DATABASE_URL:scoped.href,CONFIRMATION_BLOCKS:String(confirmations),RUN_ONCE:'false'};
    const workerEnv={indexer:common,publisher:{DATABASE_URL:scoped.href,AWS_REGION:'us-east-1',S3_BUCKET:'local-battlebros',S3_PREFIX:'battle-bros',AWS_ACCESS_KEY_ID:'local',AWS_SECRET_ACCESS_KEY:'local',AWS_EC2_METADATA_DISABLED:'true'}};
    function startWorker(kind){workers[kind]=start(process.execPath,[`scripts/territory-${kind}.mjs`],backend,workerEnv[kind],logs(kind));}
    async function control(command,address) {
      if(stopping)throw Error('Local development stack is stopping');
      if(command==='pausePublisher'||command==='pauseIndexer'){const kind=command==='pausePublisher'?'publisher':'indexer';await stopChild(workers[kind]);workers[kind]=null;}
      else if(command==='resumePublisher'||command==='resumeIndexer'){const kind=command==='resumePublisher'?'publisher':'indexer';if(!workers[kind]||workers[kind].exitCode!==null)startWorker(kind);}
      else if(command==='holdMining'){await provider.send('evm_setAutomine',[false]);await provider.send('evm_setIntervalMining',[0]);}
      else if(command==='resumeMining'){await provider.send('evm_setAutomine',[true]);await provider.send('evm_setIntervalMining',[1000]);await provider.send('evm_mine',[]);}
      else if(command==='mine')await provider.send('evm_mine',[]);
      else if(command==='fund') {if(!/^0x[0-9a-fA-F]{40}$/.test(address??''))throw Error('Valid local wallet address required');await provider.send('hardhat_setBalance',[address,'0x'+(100n*10n**18n).toString(16)]);}
      else throw Error('Unknown local development command');
      return {indexer:!!workers.indexer&&workers.indexer.exitCode===null,publisher:!!workers.publisher&&workers.publisher.exitCode===null};
    }
    sink=createServer(async(req,res)=>{
      try {
        if(req.headers.origin&&req.headers.origin!==origin)throw Error('Origin rejected');
        const pathname=new URL(req.url,'http://localhost').pathname;
        if(pathname==='/control'){
          if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json'))throw Error('JSON POST required');
          let body='';for await(const part of req){body+=part;if(body.length>2048)throw Error('Request too large');}
          const {command,address}=JSON.parse(body),result=await control(command,address);
          res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(result));return;
        }
        const key=decodeURIComponent(pathname);
        if(req.method!=='PUT'||!key.startsWith(prefix)||key.split('/').some(x=>x==='..'||x==='.')||!key.endsWith('.json'))throw Error('Invalid local publication path');
        let body='';for await(const part of req){body+=part;if(body.length>16*1024*1024)throw Error('Publication too large');}
        const file=path.join(publicDir,key);await fs.mkdir(path.dirname(file),{recursive:true});
        if(key.endsWith('/manifest.json')){await fs.writeFile(file+'.tmp',body);await fs.rename(file+'.tmp',file);}
        else {try{await fs.writeFile(file,body,{flag:'wx'});}catch(error){if(error.code!=='EEXIST'||await fs.readFile(file,'utf8')!==body)throw error;}}
        res.writeHead(200,{'ETag':'"local"'}).end();
      }catch(error){res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}));}
    });
    const sinkPort=await listen(sink,0);workerEnv.publisher.S3_ENDPOINT=`http://127.0.0.1:${sinkPort}`;
    const anchor=await provider.getBlock('latest');
    runtime={schemaVersion:4,manifestUrl:`/.local-territory/runs/${runId}/public${prefix}manifest.json`,localDev:{instanceId:runId},
      wallet:{chainId:'31337',rpcUrl:rpc,instanceId:runId,confirmations,anchor:{number:String(anchor.number),hash:anchor.hash},
        deployment:{chainId:'31337',deploymentId:deployment.combat,contracts:Object.fromEntries(['combat','bros','vault','needs','randomness','matchmaker','stETH'].map(key=>[key,deployment[key]]))}}};
    const runtimeFile=path.join(privateDir,'runtime.json');await fs.writeFile(runtimeFile,JSON.stringify(runtime));
    front=start(process.execPath,['tools/dev-server.js',String(frontendPort)],root,{BATTLEBROS_LOCAL_RUNTIME_FILE:runtimeFile,BATTLEBROS_LOCAL_CONTROL_ORIGIN:workerEnv.publisher.S3_ENDPOINT},logs('frontend'));
    origin=await new Promise((resolve,reject)=>{let text='';const timeout=setTimeout(()=>reject(Error('Frontend could not start; see '+logs('frontend'))),10000);front.stdout.on('data',data=>{text+=data;const match=text.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve(match[0]);}});front.once('exit',()=>{clearTimeout(timeout);reject(Error('Frontend port unavailable'));});});
    await provider.send('evm_setIntervalMining',[1000]);startWorker('indexer');startWorker('publisher');
    console.log(`Local development ready: ${origin}/local-transactions.html`);
    console.log(`Local RPC: ${rpc} (chain 31337). Publications use an isolated S3 HTTP sink. Logs: ${privateDir}`);
    return {origin,rpc,runtime,runId,privateDir,provider,control,stop};
  }catch(error){await stop();throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){
  let stack;
  try{stack=await startLocalDev();}
  catch(error){console.error(error.message);process.exitCode=1;}
}
