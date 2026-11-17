'use strict';
const assert=require('node:assert/strict'),create=require('../assets/practice-battle-setup');
const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,value:'',setAttribute(){},focus(){}});return nodes.get(id);};
const setup=create({getElementById:get}),field=id=>get('practice-setup-'+id);
let choices=null,cancels=0;const start=value=>choices=value;
setup.open({progression:{capacity:105n},defense:{weightsBps:{attack:1250n,defend:6025n,counter:2725n}}},start,()=>cancels++);
assert(setup.active);assert.equal(field('counter-weight').value,'27.25');
assert.equal(field('strength-label').textContent,'10% · 11 power');
field('attack-weight').value='60';field('defend-weight').value='50';field('attack-weight').oninput();
assert(field('start').disabled);field('form').onsubmit({preventDefault(){}});assert.equal(choices,null);
for(const invalid of ['', '-1', '1e2', '20.001']){field('attack-weight').value=invalid;field('attack-weight').oninput();assert(field('start').disabled);}
field('attack-weight').value='20.25';field('defend-weight').value='30.75';field('action').value='2';field('strength').value='75';field('strength').oninput();
assert.equal(field('counter-weight').value,'49');assert(!field('start').disabled);
field('form').onsubmit({preventDefault(){}});
assert.deepEqual(choices,{defenseWeights:[2025,3075,4900],action:2,commitmentPercent:75,power:79,capacity:105});
choices=null;field('form').onsubmit({preventDefault(){}});assert.equal(choices,null,'Repeated submit cannot begin another session');
setup.close();assert(!setup.active);
setup.open(null,start,()=>{cancels++;setup.close();});field('cancel').onclick();assert.equal(cancels,1);assert(!setup.active);assert.equal(choices,null);
setup.open(null,start,()=>{});assert.equal(field('attack-weight').value,'33.34');assert.equal(field('action').value,'0');assert.equal(field('strength').value,'10');
console.log('Practice setup: defaults, exact percentage totals, capacity rounding, validation, single submit, cancellation and draft reset passed.');

// Run the actual capture-phase shortcut handler before simulating browser input.
// Directly assigning input.value misses swallowed keyboard digits.
{
 const fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync('index.html','utf8');
 const start=html.indexOf("  window.addEventListener('keydown',e=>{",html.indexOf("  renderer.domElement.addEventListener('pointerdown',e=>{\n    if(!fpToolsAvailable())"));
 const end=html.indexOf("  window.addEventListener('blur',()=>{excavation.swing=null;});",start);
 assert(start>=0&&end>start);
 let keydown,equipped=0;
 const context=vm.createContext({window:{addEventListener:(name,fn)=>{if(name==='keydown')keydown=fn;}},fpToolsAvailable:()=>true,
  FP_TOOLS:[1,2,3,4].map(key=>({key:String(key),id:String(key)})),fpToolMenu:{hidden:true},broEncounterMenu:{hidden:false},
  equipExcavationTool:()=>equipped++,toggleFPToolMenu:()=>equipped++,escapeFP:()=>equipped++});
 vm.runInContext(html.slice(start,end),context);
 const key=(value,target)=>{let prevented=false;keydown({key:value,code:/^\d$/.test(value)?'Digit'+value:'Key'+value.toUpperCase(),target,preventDefault(){prevented=true;},stopImmediatePropagation(){}});return prevented;};
 for(const value of ['10','50','100','33.34']){
  field('attack-weight').value='';field('defend-weight').value='0';
  for(const digit of value){assert(!key(digit,{closest:()=>field('attack-weight')}),'Typing percentages must not activate tools');field('attack-weight').value+=digit;field('attack-weight').oninput();}
  assert.equal(field('attack-weight').value,value);assert(!field('start').disabled);
 }
 assert.equal(equipped,0);
 assert(!key('1',null),'Dialog blocks tool shortcuts even without an editable event target');
 context.broEncounterMenu.hidden=true;
 assert(!key('2',{closest:()=>({})}),'Editable fields remain protected outside the encounter');
 assert(key('1',null),'Normal exploration tool shortcut still works');assert.equal(equipped,1);
 console.log('Practice percentage typing: multiple digits, 100%, decimals, dialog isolation and normal tool shortcuts passed.');
}
