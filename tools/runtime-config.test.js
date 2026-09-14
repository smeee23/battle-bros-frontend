const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'runtime-config.js'), 'utf8');
const deploymentConfig = JSON.parse(fs.readFileSync(path.join(root, 'deployment/public-data.json'), 'utf8'));
const deploymentManifestPath = path.resolve(root, 'deployment', deploymentConfig.deploymentManifest);
const deploymentManifest = JSON.parse(fs.readFileSync(deploymentManifestPath, 'utf8'));
const context = { window: {} };
vm.runInNewContext(source, context, { filename: 'runtime-config.js' });

const expectedManifestUrl = `https://${deploymentConfig.bucket}.s3.${deploymentConfig.region}.amazonaws.com/`
  + `${deploymentConfig.prefix}/manifests/${deploymentManifest.chainId}/`
  + `${deploymentManifest.battleManager.toLowerCase()}/manifest.json`;
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(context.window.__battleBrosPublicData)),
  {
    manifestUrl: expectedManifestUrl,
  },
);
assert(Object.isFrozen(context.window.__battleBrosPublicData));
console.log('runtime-config: deployment-derived S3 manifest URL OK');
