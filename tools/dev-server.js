const http = require('http');
const fs = require('fs');
const path = require('path');

const {localRuntime}=require('./local-territory.cjs');
const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2] || process.env.PORT || 3000);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
};

const server = http.createServer(async (request, response) => {
  const urlPath = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
  const localFile=process.env.BATTLEBROS_LOCAL_RUNTIME_FILE;
  if(['/local-transactions.html','/build/local-harness.js','/api/local-dev'].includes(urlPath)&&!localFile){response.writeHead(404).end('Local development stack required');return;}
  if(urlPath==='/runtime-config.js'&&localFile){
    try{const config=JSON.parse(fs.readFileSync(localFile,'utf8'));if(config.wallet?.chainId!=='31337'||!config.localDev?.instanceId)throw Error('Invalid local runtime');
      response.writeHead(200,{'Content-Type':contentTypes['.js'],'Cache-Control':'no-store'}).end('window.__battleBrosPublicData = Object.freeze('+JSON.stringify(config)+');');
    }catch{response.writeHead(503).end('Local runtime unavailable');}return;
  }
  if(urlPath==='/api/local-dev'){
    try{
      const target=new URL(process.env.BATTLEBROS_LOCAL_CONTROL_ORIGIN);
      const allowed=[`127.0.0.1:${server.address().port}`,`localhost:${server.address().port}`];
      if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!allowed.includes(request.headers.host)||request.method!=='POST'||!request.headers['content-type']?.startsWith('application/json')||
        request.headers.origin&&!allowed.map(host=>'http://'+host).includes(request.headers.origin))throw Error('Local JSON request required');
      let body='';for await(const part of request){body+=part;if(body.length>2048)throw Error('Request too large');}
      const result=await fetch(new URL('/control',target),{method:'POST',headers:{'Content-Type':'application/json'},body});
      response.writeHead(result.status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(await result.text());
    }catch{response.writeHead(400).end('{"error":"Local command rejected"}');}return;
  }
  if(urlPath==='/runtime-config.js' && !process.env.BATTLEBROS_PUBLIC_DATA_CONFIG && !process.env.BATTLEBROS_MANIFEST_URL && !process.env.BATTLEBROS_DEPLOYMENT_MANIFEST && !process.env.BATTLEBROS_WALLET_CHAIN_ID && !process.env.BATTLEBROS_WALLET_RPC_URL) {
    try {
      const config=localRuntime(root,process.env.BATTLEBROS_LOCAL_RUN);
      if(config){response.writeHead(200,{'Content-Type':contentTypes['.js'],'Cache-Control':'no-store'});response.end('window.__battleBrosPublicData = Object.freeze('+JSON.stringify(config)+');');return;}
    } catch(error) {response.writeHead(503,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('Local territory data unavailable: '+error.message);return;}
  }
  const relative = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const filePath = path.resolve(root, relative);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(response);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`BattleBros frontend: http://127.0.0.1:${server.address().port}/`);
});
