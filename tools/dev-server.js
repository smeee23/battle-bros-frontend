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

const server = http.createServer((request, response) => {
  const urlPath = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
  if(urlPath==='/runtime-config.js' && !process.env.BATTLEBROS_MANIFEST_URL && !process.env.BATTLEBROS_DEPLOYMENT_MANIFEST) {
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
