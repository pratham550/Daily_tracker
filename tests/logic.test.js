import { describe, it, expect } from 'vitest';
import { dateKey, addDays, diffDays, startOfWeek, daysInMonth, addMonths, fmtDMY, keyToDate } from '../src/lib/dates.js';
import { formatRs, formatRsShort, parseAmount, formatClock } from '../src/lib/format.js';
import {
  currentStreak, bestStreak, monthSummary, expensesToCsv, e1rm, sessionVolume,
  exerciseHistory, personalRecords, newPrsInSession, sessionsThisWeek, stepBucketsToDaily, lastNDays,
} from '../src/lib/stats.js';
import { makeBackup, parseBackup, backupFileName } from '../src/lib/backup.js';
import { defaultState, migrate } from '../src/store.js';
import { filesToPrune, autoFileName } from '../src/lib/autobackup.js';

// Deterministic pseudo-random generator so generated test data is reproducible
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('dates', () => {
  it('walks every day across leap years and year ends without skipping', () => {
    let k = '2023-12-25';
    for (let i = 0; i < 800; i++) {
      const next = addDays(k, 1);
      expect(diffDays(k, next)).toBe(1);
      expect(keyToDate(next) > keyToDate(k)).toBe(true);
      k = next;
    }
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('weeks start on Monday', () => {
    expect(startOfWeek('2026-10-26')).toBe('2026-10-26'); // Monday
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26'); // Sunday
    expect(startOfWeek('2027-01-02')).toBe('2026-12-28');
  });

  it('month helpers', () => {
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(fmtDMY('2026-10-26')).toBe('26-10-2026');
  });

  it('dateKey uses the local calendar day', () => {
    expect(dateKey(new Date(2026, 9, 26, 23, 59))).toBe('2026-10-26');
    expect(dateKey(new Date(2026, 9, 27, 0, 1))).toBe('2026-10-27');
  });
});

describe('format', () => {
  it('uses Indian digit grouping', () => {
    expect(formatRs(125000)).toBe('Rs 1,25,000');
    expect(formatRs(12345678.5)).toBe('Rs 1,23,45,678.5');
    expect(formatRs(-450)).toBe('-Rs 450');
  });
  it('short form uses K, lakh and crore', () => {
    expect(formatRsShort(950)).toBe('Rs 950');
    expect(formatRsShort(12500)).toBe('Rs 12.5K');
    expect(formatRsShort(125000)).toBe('Rs 1.25 L');
    expect(formatRsShort(24000000)).toBe('Rs 2.4 Cr');
  });
  it('parses typed amounts', () => {
    expect(parseAmount('1,250')).toBe(1250);
    expect(parseAmount(' 99.999 ')).toBe(100);
    expect(parseAmount('0')).toBe(null);
    expect(parseAmount('abc')).toBe(null);
    expect(parseAmount('-5')).toBe(null);
  });
  it('clock', () => {
    expect(formatClock(90)).toBe('01:30');
    expect(formatClock(-3)).toBe('00:00');
  });
});

describe('streaks', () => {
  const today = '2026-10-26';
  it('stays alive when today is not ticked yet', () => {
    const done = new Set(lastNDays(5, addDays(today, -1)));
    expect(currentStreak(done, today)).toBe(5);
    done.add(today);
    expect(currentStreak(done, today)).toBe(6);
  });
  it('breaks after a missed full day', () => {
    const done = new Set([addDays(today, -2), addDays(today, -3)]);
    expect(currentStreak(done, today)).toBe(0);
  });
  it('best streak matches a brute-force count on generated data', () => {
    const r = rng(7);
    for (let trial = 0; trial < 50; trial++) {
      const days = lastNDays(120, today).filter(() => r() < 0.7);
      const set = new Set(days);
      let best = 0;
      let run = 0;
      for (const d of lastNDays(120, today)) {
        run = set.has(d) ? run + 1 : 0;
        best = Math.max(best, run);
      }
      expect(bestStreak(set)).toBe(best);
    }
  });
});

describe('money', () => {
  it('month summary totals equal the sum of generated expenses', () => {
    const r = rng(42);
    const cats = ['food', 'travel', 'bills'];
    const expenses = [];
    for (let i = 0; i < 500; i++) {
      const day = 1 + Math.floor(r() * 61);
      const date = addDays('2026-09-30', day - 30); // spans Sep, Oct, Nov
      expenses.push({ amount: Math.round(r() * 200000) / 100, category: cats[i % 3], date, note: '' });
    }
    const oct = expenses.filter((e) => e.date.startsWith('2026-10'));
    const expected = Math.round(oct.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    const s = monthSummary(expenses, '2026-10');
    expect(s.total).toBeCloseTo(expected, 2);
    expect(s.byDay.length).toBe(31);
    expect(s.byDay.reduce((a, b) => a + b, 0)).toBeCloseTo(expected, 2);
    expect(Object.values(s.byCategory).reduce((a, b) => a + b, 0)).toBeCloseTo(expected, 2);
  });

  it('CSV quotes commas and quotes in notes and uses DD-MM-YYYY', () => {
    const csv = expensesToCsv(
      [{ date: '2026-10-05', category: 'food', amount: 250, note: 'Lunch, with "Raj"' }],
      [{ id: 'food', name: 'Food' }],
    );
    expect(csv.split('\r\n')[1]).toBe('05-10-2026,"Food",250,"Lunch, with ""Raj"""');
  });
});

describe('gym', () => {
  const S = (date, name, sets) => ({ date, exercises: [{ name, sets: sets.map(([kg, reps, done = true]) => ({ kg, reps, done })) }] });
  it('e1rm', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBe(133.3);
    expect(e1rm(0, 5)).toBe(0);
  });
  it('volume counts only completed sets', () => {
    expect(sessionVolume(S('2026-10-01', 'Squat', [[100, 5], [100, 5, false]]))).toBe(500);
  });
  it('history and PRs', () => {
    const sessions = [S('2026-10-01', 'Squat', [[100, 5]]), S('2026-10-03', 'squat', [[105, 5], [80, 12]])];
    const h = exerciseHistory(sessions, 'Squat');
    expect(h.map((x) => x.topKg)).toEqual([100, 105]);
    expect(personalRecords(sessions).squat.kg).toBe(105);
    const next = S('2026-10-05', 'Squat', [[110, 5]]);
    expect(newPrsInSession(sessions, next)).toHaveLength(1);
    expect(newPrsInSession(sessions, S('2026-10-05', 'Squat', [[90, 5]]))).toHaveLength(0);
  });
  it('counts distinct gym days in the current Monday week', () => {
    const sessions = ['2026-10-25', '2026-10-26', '2026-10-26', '2026-10-28'].map((d) => S(d, 'Squat', [[1, 1]]));
    expect(sessionsThisWeek(sessions, '2026-10-28')).toBe(2);
  });
});

describe('steps', () => {
  it('keys Health Connect day buckets by local date', () => {
    const days = lastNDays(7, '2026-10-26');
    const samples = days.map((k, i) => {
      const start = keyToDate(k);
      const end = keyToDate(addDays(k, 1));
      return { startDate: start.toISOString(), endDate: end.toISOString(), value: 1000 * (i + 1) };
    });
    const daily = stepBucketsToDaily(samples);
    expect(Object.keys(daily)).toEqual(days);
    expect(daily['2026-10-26']).toBe(7000);
  });
});

describe('backup', () => {
  it('round-trips the full state', () => {
    const s = defaultState();
    s.expenses.push({ id: 'x', amount: 125.5, category: 'food', date: '2026-10-26', note: 'chai' });
    s.profile.name = 'Test';
    const { state } = parseBackup(makeBackup(s));
    expect(state).toEqual(migrate(JSON.parse(JSON.stringify(s))));
  });
  it('rejects junk, other apps, newer schema and damaged data', () => {
    expect(() => parseBackup('not json')).toThrow(/not a Daily Hub backup/);
    expect(() => parseBackup('{"app":"other","data":{}}')).toThrow(/not a Daily Hub backup/);
    expect(() => parseBackup('{"app":"daily-hub","schema":99,"data":{}}')).toThrow(/newer version/);
    expect(() => parseBackup('{"app":"daily-hub","schema":1,"data":{"todos":"x"}}')).toThrow(/damaged/);
    expect(() => parseBackup('{"app":"daily-hub","schema":1,"data":{"expenses":[{"amount":"5","date":"2026-10-01"}]}}')).toThrow(/damaged/);
  });
  it('migrate fills missing sections from older backups', () => {
    const s = migrate({ profile: { name: 'A' }, todos: [{ id: 1 }] });
    expect(s.profile.name).toBe('A');
    expect(s.profile.goal).toBe('maintain');
    expect(s.todos).toHaveLength(1);
    expect(Array.isArray(s.diet.log)).toBe(true);
    expect(s.settings.reminders.water.everyHours).toBe(2);
  });
  it('file name uses YYYYMMDD', () => {
    expect(backupFileName(new Date(2026, 9, 5))).toBe('DailyHub_backup_20261005.json');
  });
});

describe('daily auto backup', () => {
  it('names files by day', () => {
    expect(autoFileName('2026-10-26')).toBe('DailyHub_auto_20261026.json');
  });
  it('keeps the newest 7 and never touches other files', () => {
    const days = lastNDays(10, '2026-10-26').map(autoFileName);
    const names = [...days, 'DailyHub_backup_20261001.json', 'notes.txt'];
    expect(filesToPrune(names)).toEqual(days.slice(0, 3).reverse());
  });
  it('old data restored from a backup gets the new settings with defaults', () => {
    const s = migrate({ settings: { theme: 'ocean' } });
    expect(s.settings.autoBackup).toBe(true);
    expect(s.settings.theme).toBe('ocean');
  });
});
