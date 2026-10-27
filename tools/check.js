const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
const inlineApp = scripts.at(-1)?.[1];

if (!inlineApp) throw new Error('Could not locate the inline BattleBros app script.');
new vm.Script(inlineApp, { filename: 'index.inline.js' });

for (const relativePath of [
  'vendor/three/three.r128.min.js',
  'assets/battlebro-encounter.js',
  'assets/territory-world.js',
  'assets/longneck-animation.js',
  'assets/juggernaut-animation.js',
  'assets/monster-animation.js',
  'assets/specter-animation.js',
  'assets/battlebro-jump.js',
  'assets/transport-cube.js',
  'assets/battlebro-terrain.js',
  'runtime-config.js',
  'vendor/three/GLTFLoader.r128.js',
  'vendor/tiny-crowd-layer.js',
  'models/stunt_plane.glb',
  'schemas/territory-state.schema.json',
  'schemas/manifest.schema.json',
  'assets/territory-abi.json',
  'territory.js',
]) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Missing runtime asset: ${relativePath}`);
  }
}

for(const name of ['territory-world','battlebro-encounter','longneck-animation','juggernaut-animation','monster-animation','specter-animation','battlebro-jump','transport-cube','battlebro-terrain'])
  new vm.Script(fs.readFileSync(path.join(root,'assets/'+name+'.js'),'utf8'),{filename:name+'.js'});

console.log('check: inline JavaScript syntax and runtime assets OK');
