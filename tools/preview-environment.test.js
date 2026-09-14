'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const start = source.indexOf('  let characterEnvironmentRequest =');
const end = source.indexOf('  let battleBroCharacterPreviewPanel=null;',start);
const events=[];
const context=vm.createContext({setTimeout,Promise,events, suppressSave:false,activeEnvironment:'EARTH',activeTerrainSeed:'test',
 battleBroCharacterPreviewPanel:{status:{}},environmentForBattleBro:()=> 'LUNAR',
 generateProceduralWorld:({environment,seed})=>({environment,seed,cells:[{x:0,z:0,terrain:'lava',terrainFloors:40}]}),
 getWorldCell:()=>({kind:'house',floors:2,buildingType:'tower'}),isTerraformKind:()=>false,isLifeKind:()=>false,
 selectBattleBroCharacterPreview:(variant,form)=>{events.push(['character',variant,form]);return {ok:true};},
 applyState:(data,opts)=>{events.push(['terrain',data]);context.suppressSave=true;setTimeout(()=>{context.activeEnvironment=data.environment;context.suppressSave=false;events.push(['done']);opts.onDone();},5);return true;}
});
vm.runInContext(source.slice(start,end),context);
(async()=>{
 await context.previewBattleBroEnvironment('lava',4,true);
 assert.equal(events[0][1].environment,'LUNAR');
 assert.equal(events[0][1].cells[0].kind,'house');
 assert.equal(events[0][1].cells[0].terrain,'stone');
 for(const variant of ['lava','sand','ice','plant']) {
 events.length=0;
 await context.previewBattleBroEnvironment(variant,4);
 assert.deepEqual(events.map(e=>e[0]),['character'],'Material changes preserve the lunar landscape');
 events.length=0;await context.previewBattleBroEnvironment(variant,7);
 assert.deepEqual(events.map(e=>e[0]),['character'],'Form-only change preserves terrain');
 }
 events.length=0;await context.previewBattleBroEnvironment('plant',4,true);
 assert.equal(events[0][0],'terrain','Initial preview replaces legacy terrain');
 events.length=0;const old=context.previewBattleBroEnvironment('sand',4,true);const latest=context.previewBattleBroEnvironment('ice',2);
 await Promise.all([old,latest]);
 assert.deepEqual(events.filter(e=>e[0]==='character'),[['character','ice',2]],'Latest selection wins while generation runs');
 console.log('preview-environment: mapping, initial load, form-only reuse, structure preservation and rapid switches OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
