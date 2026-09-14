/* Local recurring UTC calendar. Cadence/windows mirror BattleManager.sol;
   Saturday alignment is presentation policy, not an onchain round transition. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BattleSchedule = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000;
  const RULES = Object.freeze({ majorFrequency: 7, championshipFrequency: 28,
    registrationCloseHour: 16, matchmakingHours: 1, commitHours: 4, revealHours: 4,
    minimumRegistrationHours: 8 });
  function utcDay(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid calendar date');
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }
  const dateKey = value => new Date(utcDay(value)).toISOString().slice(0,10);
  function monthRange(value, offset = 0) {
    const date = new Date(utcDay(value));
    const start = Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+offset,1);
    return { start, end: Date.UTC(new Date(start).getUTCFullYear(),new Date(start).getUTCMonth()+1,1) };
  }
  function createSchedule(source) {
    // The default needs no network, player state, or deployment data.
    // An explicit anchor can be supplied by a future schedule configuration.
    // Fixed display cycle: retain the Saturday Championship phase already
    // used by the calendar (26 September 2026), independent of live rounds.
    // This is a recurrence anchor, not a list of manually scheduled events.
    let anchor = { date: Date.UTC(2026, 8, 26), id: 28n };
    const majorFrequency = BigInt(RULES.majorFrequency);
    if (source?.majorDate && source?.majorRoundId) {
      anchor = { date: utcDay(source.majorDate), id: BigInt(source.majorRoundId) };
      if (new Date(anchor.date).getUTCDay() !== 6 || anchor.id <= 0n || anchor.id % majorFrequency) throw new Error('Invalid Major calendar anchor');
    } else if (source?.registrationCloseTimestamp !== undefined && source?.id !== undefined) {
      const id = BigInt(source.id), seconds = BigInt(source.registrationCloseTimestamp);
      if (id <= 0n || seconds <= 0n || seconds > 8640000000000n) throw new Error('Invalid round calendar anchor');
      const delta = (majorFrequency - id % majorFrequency) % majorFrequency;
      const nominal = utcDay(Number(seconds * 1000n)) + Number(delta) * DAY;
      const weekday = new Date(nominal).getUTCDay() || 7;
      anchor = { date: nominal + (6-weekday)*DAY, id: id+delta };
    }
    return Object.freeze({
      available: !!anchor,
      getScheduledEvents(startDate,endDate) {
        const start=utcDay(startDate),end=utcDay(endDate);
        if (end<start || end-start>DAY*3660) throw new Error('Invalid calendar range');
        if (!anchor) return [];
        const events=[];
        for(let date=start;date<end;date+=DAY) {
          const roundId=anchor.id+BigInt(Math.round((date-anchor.date)/DAY));
          // Recurrence applies in both directions from the display anchor;
          // this counter is not an actual onchain round ID.
          const type=roundId%BigInt(RULES.championshipFrequency)===0n ? 'Championship'
            : roundId%BigInt(RULES.majorFrequency)===0n ? 'Major' : 'Daily';
          const registrationClose=date+RULES.registrationCloseHour*3600000;
          const matchmakingClose=registrationClose+RULES.matchmakingHours*3600000;
          const commitClose=matchmakingClose+RULES.commitHours*3600000;
          events.push(Object.freeze({date:dateKey(date),type,major:type!=='Daily',
            registrationClose,matchmakingClose,commitClose,revealClose:commitClose+RULES.revealHours*3600000,
            minimumLevel:type==='Championship'?6:type==='Major'?3:1}));
        }
        return events;
      },
    });
  }
  return { RULES, DAY, utcDay, dateKey, monthRange, createSchedule };
});
