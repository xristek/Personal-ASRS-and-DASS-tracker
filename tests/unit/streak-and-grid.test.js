const test = require('node:test');
const assert = require('node:assert/strict');

function calculateStreaks(entries, referenceDateStr) {
  const datesSet = new Set(entries.map(e => e.date).filter(Boolean));
  const todayISO = referenceDateStr || new Date().toISOString().split('T')[0];
  const refDate = new Date(todayISO + 'T00:00:00');

  const yesterday = new Date(refDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().split('T')[0];

  let currentStreak = 0;
  let checkDate = new Date(refDate);

  if (datesSet.has(todayISO)) {
    while (datesSet.has(checkDate.toISOString().split('T')[0])) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  } else if (datesSet.has(yesterdayISO)) {
    checkDate = new Date(yesterday);
    while (datesSet.has(checkDate.toISOString().split('T')[0])) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  } else {
    currentStreak = 0;
  }

  // Best streak calculation
  const sortedDates = Array.from(datesSet).sort();
  let bestStreak = 0;
  let tempStreak = 0;
  let lastDate = null;

  for (const dStr of sortedDates) {
    const cur = new Date(dStr + 'T00:00:00');
    if (!lastDate) {
      tempStreak = 1;
    } else {
      const diffDays = Math.round((cur - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }
    if (tempStreak > bestStreak) bestStreak = tempStreak;
    lastDate = cur;
  }

  return {
    currentStreak,
    bestStreak,
    totalLogged: datesSet.size
  };
}

function generateGridDays(refDateStr) {
  const ref = new Date(refDateStr + 'T00:00:00');
  const dayOfWeek = ref.getDay(); // 0 = Sun, 1 = Mon ...
  const daysUntilSunday = (7 - dayOfWeek) % 7;
  const endOfGrid = new Date(ref);
  endOfGrid.setDate(ref.getDate() + daysUntilSunday);

  const days = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(endOfGrid);
    d.setDate(endOfGrid.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

test('Daily Logging Streak Calculations', async (t) => {
  const entries = [
    { date: '2026-10-14' },
    { date: '2026-10-15' },
    { date: '2026-10-16' },
    { date: '2026-10-17' },
    { date: '2026-10-18' }
  ];

  await t.test('Includes today when today is logged', () => {
    const stats = calculateStreaks(entries, '2026-10-18');
    assert.equal(stats.currentStreak, 5);
    assert.equal(stats.totalLogged, 5);
    assert.equal(stats.bestStreak, 5);
  });

  await t.test('Maintains active streak from yesterday if today is not yet logged', () => {
    const stats = calculateStreaks(entries, '2026-10-19');
    assert.equal(stats.currentStreak, 5);
    assert.equal(stats.bestStreak, 5);
  });

  await t.test('Resets streak to 0 if neither today nor yesterday was logged', () => {
    const stats = calculateStreaks(entries, '2026-10-21');
    assert.equal(stats.currentStreak, 0);
    assert.equal(stats.bestStreak, 5);
  });

  await t.test('Tracks historical best streak across broken streaks', () => {
    const multiPeriodEntries = [
      // 4-day streak
      { date: '2026-09-01' },
      { date: '2026-09-02' },
      { date: '2026-09-03' },
      { date: '2026-09-04' },
      // gap
      // 7-day streak (best)
      { date: '2026-09-10' },
      { date: '2026-09-11' },
      { date: '2026-09-12' },
      { date: '2026-09-13' },
      { date: '2026-09-14' },
      { date: '2026-09-15' },
      { date: '2026-09-16' },
      // gap
      // 2-day current streak
      { date: '2026-10-01' },
      { date: '2026-10-02' }
    ];

    const stats = calculateStreaks(multiPeriodEntries, '2026-10-02');
    assert.equal(stats.currentStreak, 2);
    assert.equal(stats.bestStreak, 7);
    assert.equal(stats.totalLogged, 13);
  });
});

test('35-Day Trailing Heatmap Grid Generation', async (t) => {
  await t.test('Generates exactly 35 days', () => {
    const grid = generateGridDays('2026-10-18');
    assert.equal(grid.length, 35);
  });

  await t.test('Aligns grid so column 1 is Monday and column 7 is Sunday', () => {
    const grid = generateGridDays('2026-10-18');
    const firstDay = new Date(grid[0] + 'T00:00:00');
    const lastDay = new Date(grid[grid.length - 1] + 'T00:00:00');

    // getDay(): 0 = Sun, 1 = Mon ...
    assert.equal(firstDay.getDay(), 1, 'First day must be a Monday');
    assert.equal(lastDay.getDay(), 0, 'Last day must be a Sunday');
  });

  await t.test('Grid includes reference date', () => {
    const refDateStr = '2026-10-18';
    const grid = generateGridDays(refDateStr);
    assert.equal(grid.includes(refDateStr), true);
  });
});
