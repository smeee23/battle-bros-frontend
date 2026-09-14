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
  'runtime-config.js',
  'assets/home-world-lod.js',
  'vendor/three/GLTFLoader.r128.js',
  'vendor/tiny-crowd-layer.js',
  'models/stunt_plane.glb',
  'schemas/game-state.schema.json',
  'schemas/battle-bro.schema.json',
  'assets/mock-public/manifest.json',
  'assets/mock-public/current/game-state.json',
  'assets/mock-public/current/battle-bros/12.json',
  'assets/mock-public/rounds/8.json',
]) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Missing runtime asset: ${relativePath}`);
  }
}

console.log('check: inline JavaScript syntax and runtime assets OK');
