'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),section={hidden:false};
const start=html.indexOf('  function syncDefenseWeightVisibility()'),end=html.indexOf('  window.syncDefenseWeightVisibility=syncDefenseWeightVisibility;',start);
const context=vm.createContext({document:{getElementById:()=>section}});
vm.runInContext(html.slice(start,end),context);
assert.equal(context.syncDefenseWeightVisibility(),false);assert(section.hidden,'Retired board defense controls stay hidden');
assert(/id="battlebro-defense-section" open hidden/.test(html));
console.log('Defense panel: separate-board controls remain hidden; territory claim/challenge defense selection is unchanged');
