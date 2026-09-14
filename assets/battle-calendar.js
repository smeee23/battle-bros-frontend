(function () {
  'use strict';
  const S=window.BattleSchedule, modal=document.getElementById('battle-calendar-modal');
  const grid=document.getElementById('battle-calendar-grid'), details=document.getElementById('battle-calendar-details');
  let month=S.monthRange(Date.now()).start, selected=S.dateKey(Date.now()), events=new Map();
  let schedule=S.createSchedule(null);
  const format=(value,options)=>new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',...options}).format(new Date(value));
  const clock=value=>format(value,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  function showDetails() {
    details.replaceChildren();
    const event=events.get(selected);
    const heading=document.createElement('h3');
    heading.textContent=format(selected,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    details.append(heading);
    const lines=event ? [event.type+' battle · '+(event.major?'Major event':'Regular event'),
      'Registration closes '+clock(event.registrationClose)+' UTC. Matchmaking: '+clock(event.registrationClose)+'–'+clock(event.matchmakingClose)+' UTC.',
      'Commitments close '+clock(event.commitClose)+' UTC. Reveal: '+clock(event.commitClose)+'–'+clock(event.revealClose)+' UTC the following day.',
      'Registration opens after the previous round completes, with at least '+S.RULES.minimumRegistrationHours+' hours to register.',
      'Level '+event.minimumLevel+'+ required.'+(event.type==='Championship'?' Available yield must be at least 0.2% of protected principal.':'')]
      : [schedule.available?'No battle scheduled for this date.':'The battle schedule is unavailable until public game data loads.'];
    for(const line of lines){const p=document.createElement('p');p.textContent=line;details.append(p);}
  }
  function render() {
    const range=S.monthRange(month); events=new Map(schedule.getScheduledEvents(range.start,range.end).map(event=>[event.date,event]));
    document.getElementById('battle-calendar-month').textContent=format(month,{month:'long',year:'numeric'});
    grid.replaceChildren();
    const first=new Date(month).getUTCDay();
    for(let i=0;i<first;i++){const blank=document.createElement('span');blank.setAttribute('aria-hidden','true');grid.append(blank);}
    const today=S.dateKey(Date.now());
    for(let date=range.start;date<range.end;date+=S.DAY){
      const key=S.dateKey(date), event=events.get(key),button=document.createElement('button');button.type='button';button.dataset.date=key;
      button.className='battle-calendar-day'+(event?' is-'+event.type.toLowerCase():'');
      button.setAttribute('aria-label',format(date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})+(event?', '+event.type+' battle':'')+', UTC');
      button.setAttribute('aria-pressed',String(key===selected));
      if(key===today) button.setAttribute('aria-current','date');
      const number=document.createElement('span');number.textContent=new Date(date).getUTCDate();button.append(number);
      if(event){const badge=document.createElement('small');badge.textContent=event.type;button.append(badge);}
      button.addEventListener('click',()=>{selected=key;render();grid.querySelector('[data-date="'+key+'"]').focus();});grid.append(button);
    }
    showDetails();
  }
  function navigate(offset){month=S.monthRange(month,offset).start;selected=S.dateKey(month);render();}
  document.getElementById('battle-calendar-prev').addEventListener('click',()=>navigate(-1));
  document.getElementById('battle-calendar-next').addEventListener('click',()=>navigate(1));
  document.getElementById('battle-calendar-today').addEventListener('click',()=>{month=S.monthRange(Date.now()).start;selected=S.dateKey(Date.now());render();});
  const close=()=>window.__closeTinyModal(modal);
  document.getElementById('battle-calendar-close').addEventListener('click',close);
  modal.addEventListener('click',event=>{if(event.target===modal)close();});
  // Keep keyboard controls and pointer interaction inside the calendar overlay.
  modal.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    if(event.target.dataset.date && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();event.stopPropagation();
      const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
      selected=S.dateKey(S.utcDay(event.target.dataset.date)+delta*S.DAY);month=S.monthRange(selected).start;render();grid.querySelector('[data-date="'+selected+'"]').focus();
    }
  });
  document.getElementById('battlebro-calendar-action').addEventListener('click',()=>{render();window.__openTinyModal(modal,document.getElementById('battle-calendar-close'));});
  window.setBattleCalendarSource=source=>{try{schedule=S.createSchedule(source);}catch{schedule=S.createSchedule(null);}if(!modal.hidden)render();};

})();
