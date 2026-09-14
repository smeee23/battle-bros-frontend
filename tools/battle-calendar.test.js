'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../assets/battle-schedule.js');
const source={id:9n,registrationCloseTimestamp:1786003200n};
const schedule=S.createSchedule(source);
for(const timezone of ['UTC','America/Los_Angeles','Pacific/Kiritimati','America/New_York']) {
  process.env.TZ=timezone;
  const events=schedule.getScheduledEvents('2026-08-01','2027-09-01');
  assert.equal(new Set(events.map(e=>e.date)).size,events.length);
  for(let i=0;i<events.length;i++) {
    const e=events[i],weekday=new Date(e.date).getUTCDay();
    assert.equal(e.major,weekday===6,'Every Saturday is a major event, in every timezone');
    assert.equal(new Date(e.registrationClose).getUTCHours(),16);
    assert.equal(new Date(e.commitClose).getUTCHours(),21);
    assert.equal(new Date(e.revealClose).getUTCHours(),1);
    assert.equal(S.utcDay(e.revealClose)-S.utcDay(e.date),S.DAY);
    if(i)assert.equal(S.utcDay(e.date)-S.utcDay(events[i-1].date),S.DAY);
  }
  const championships=events.filter(e=>e.type==='Championship');
  for(let i=1;i<championships.length;i++)assert.equal(S.utcDay(championships[i].date)-S.utcDay(championships[i-1].date),28*S.DAY);
  const whole=schedule.getScheduledEvents('2026-12-01','2027-02-01');
  assert.deepEqual(whole,[...schedule.getScheduledEvents('2026-12-01','2027-01-01'),...schedule.getScheduledEvents('2027-01-01','2027-02-01')]);
  assert.equal(S.dateKey(S.monthRange('2026-12-31',1).start),'2027-01-01');
  assert.equal(S.dateKey(S.monthRange('2027-01-31',-1).start),'2026-12-01');
}
assert.equal(S.createSchedule({majorDate:'2028-02-05',majorRoundId:'28'}).getScheduledEvents('2028-02-01','2028-03-01').length,29);
assert.equal(S.createSchedule(null).getScheduledEvents('2026-09-01','2026-10-01').length,30);
assert.equal(S.createSchedule().getScheduledEvents('2025-01-01','2025-02-01').length,31,'Dates before the reference also have daily battles');
assert.throws(()=>S.createSchedule({majorDate:'2026-09-11',majorRoundId:'7'}));
// Cadence and clock parity with the authoritative contract, without editing schemas.
const contract=fs.readFileSync('../battle-bros-contracts/contracts/battle/BattleManager.sol','utf8');
for(const [name,value] of [['MAJOR_FREQUENCY',S.RULES.majorFrequency],['CHAMPIONSHIP_FREQUENCY',S.RULES.championshipFrequency],['REGISTRATION_CLOSE_UTC',S.RULES.registrationCloseHour],['MIN_REGISTRATION_DURATION',S.RULES.minimumRegistrationHours],['MATCHMAKING_WINDOW',S.RULES.matchmakingHours],['COMMIT_DURATION',S.RULES.commitHours],['REVEAL_DURATION',S.RULES.revealHours]])assert.match(contract,new RegExp(name+' = '+value+'(?: hours)?;'));

// DOM event harness: exercises actual UI code without a browser or screenshots.
class Element {
  constructor(){this.children=[];this.dataset={};this.attributes={};this.listeners={};this.hidden=true;}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  setAttribute(k,v){this.attributes[k]=v;}
  addEventListener(k,fn){this.listeners[k]=fn;}
  focus(){document.activeElement=this;}
  querySelector(selector){return this.children.find(e=>selector.includes(e.dataset.date)&&e.dataset.date);}
  click(){this.listeners.click({target:this});}
}
const elements=new Map(),document={getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement:()=>new Element()};
const window={BattleSchedule:S,__openTinyModal:m=>{m.hidden=false;},__closeTinyModal:m=>{m.hidden=true;}};
vm.runInNewContext(fs.readFileSync('assets/battle-calendar.js','utf8'),{window,document,Intl,Date,Map});
const el=id=>document.getElementById('battle-calendar-'+id);
document.getElementById('battlebro-calendar-action').click();assert.equal(el('modal').hidden,false);
const initial=el('month').textContent;
const currentRange=S.monthRange(Date.now());
assert.equal(el('grid').children.filter(e=>e.dataset.date).length,(currentRange.end-currentRange.start)/S.DAY);
for(const day of el('grid').children.filter(e=>e.dataset.date)) {
  assert(day.children.some(child=>['Daily','Major','Championship'].includes(child.textContent)),'Every date has a battle without public data');
  day.click();
  assert(!el('details').children.some(child=>/No battle|unavailable/.test(child.textContent||'')));
}

assert(el('grid').children.some(e=>e.attributes['aria-current']==='date'));
el('next').click();assert.notEqual(el('month').textContent,initial);el('prev').click();assert.equal(el('month').textContent,initial);
for(let i=0;i<8;i++)el('next').click();el('today').click();assert.equal(el('month').textContent,initial);
const saturday=el('grid').children.find(e=>e.className?.includes('is-major')||e.className?.includes('is-championship'));saturday.click();assert(el('details').children.some(e=>e.textContent?.includes('Major event')));
el('close').click();assert.equal(el('modal').hidden,true);
console.log('battle calendar: UTC/DST, month/year/leap boundaries, Saturday cadence, Championship precedence, unique dates, navigation, selection and modal controls OK');
