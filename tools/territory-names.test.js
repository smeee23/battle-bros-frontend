const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('territory.js', 'utf8');
const context = vm.createContext({document:{createElement:()=>({})}});
for (const name of ['broLabel', 'make', 'labelLevels']) {
  const line = source.split('\n').find(line=>line.startsWith(`function ${name}(`));
  vm.runInContext(line, context);
}
assert.equal(vm.runInContext('broLabel({tokenId:"42",name:null})', context), '#42');
assert.equal(vm.runInContext('broLabel({tokenId:"42",name:"Nova"})', context), 'Nova (#42)');
const label = vm.runInContext('make("span", "", broLabel({tokenId:"42",name:"<img src=x onerror=alert(1)>"}))', context);
assert.equal(label.textContent, '<img src=x onerror=alert(1)> (#42)');
assert.equal(label.innerHTML, undefined);
console.log('Territory names render as plain text with token IDs.');

assert.equal(vm.runInContext('labelLevels({minLevel:"5",maxLevel:"17"})', context), 'Levels 5–17');
assert.equal(vm.runInContext('labelLevels({minLevel:"20",maxLevel:"0"})', context), 'Level 20+');
assert.equal(vm.runInContext('labelLevels({minLevel:"1",maxLevel:"0"})', context), 'Open · Any level');
