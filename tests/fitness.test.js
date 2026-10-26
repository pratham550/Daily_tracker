import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  setScore, personalRecords, newPrsInSession, isSetPr, sessionReps, sessionVolume, muscleSets, workoutKcal,
  smokeByDay, smokeWeekAvg, smokeLimitFor, lastNDays,
} from '../src/lib/stats.js';
import { addDays, keyToDate } from '../src/lib/dates.js';
import { defaultState } from '../src/store.js';

const lib = JSON.parse(readFileSync(new URL('../src/data/exercises.json', import.meta.url), 'utf8'));
const byName = new Map(lib.exercises.map((e) => [e.name.toLowerCase(), e]));

describe('exercises.json (generated from free-exercise-db)', () => {
  it('has valid groups, types and unique ids', () => {
    const groups = new Set(['Chest', 'Back', 'Biceps', 'Triceps', 'Shoulders', 'Legs', 'Abs', 'Forearms', 'Cardio', 'Stretch']);
    expect(lib.exercises.length).toBeGreaterThan(800);
    expect(new Set(lib.exercises.map((e) => e.id)).size).toBe(lib.exercises.length);
    for (const e of lib.exercises) {
      expect(groups.has(e.group), `${e.name} group ${e.group}`).toBe(true);
      expect(['weight', 'reps', 'time']).toContain(e.type);
      // 5 source entries have no written steps; the app shows the demo pictures instead
      expect(Array.isArray(e.steps)).toBe(true);
    }
  });

  it('every exercise in the default plans exists in the library', () => {
    for (const t of defaultState().gym.templates) {
      for (const name of t.exercises) expect(byName.has(name.toLowerCase()), `${t.name}: ${name}`).toBe(true);
    }
  });

  it('classifies familiar exercises sensibly', () => {
    expect(byName.get('pullups').type).toBe('reps');
    expect(byName.get('plank').type).toBe('time');
    expect(byName.get('barbell squat').type).toBe('weight');
    expect(byName.get('barbell curl').group).toBe('Biceps');
    expect(byName.get('triceps pushdown').group).toBe('Triceps');
    expect(byName.get('wide-grip lat pulldown').group).toBe('Back');
  });
});

const ex = (name, type, group, sets) => ({ name, type, group, sets: sets.map((s) => ({ done: true, ...s })) });

describe('PRs by exercise type', () => {
  const day1 = {
    date: '2026-10-01', start: 0, end: 3600000,
    exercises: [
      ex('Pullups', 'reps', 'Back', [{ reps: 8 }, { reps: 6 }]),
      ex('Plank', 'time', 'Abs', [{ sec: 60 }]),
      ex('Barbell Squat', 'weight', 'Legs', [{ kg: 100, reps: 5 }]),
    ],
  };
  it('scores sets by type', () => {
    expect(setScore('reps', { reps: 12 })).toBe(12);
    expect(setScore('time', { sec: 45 })).toBe(45);
    expect(setScore('weight', { kg: 100, reps: 1 })).toBe(100);
  });
  it('keeps the best per exercise', () => {
    const prs = personalRecords([day1]);
    expect(prs.pullups.score).toBe(8);
    expect(prs.plank.score).toBe(60);
    expect(prs['barbell squat'].kg).toBe(100);
  });
  it('detects a live PR set and session PRs', () => {
    expect(isSetPr([day1], { name: 'Pullups', type: 'reps' }, { reps: 9 })).toBe(true);
    expect(isSetPr([day1], { name: 'Pullups', type: 'reps' }, { reps: 8 })).toBe(false);
    expect(isSetPr([day1], { name: 'New move', type: 'reps' }, { reps: 50 })).toBe(false); // first time is not a PR
    const day2 = { date: '2026-10-03', exercises: [ex('Plank', 'time', 'Abs', [{ sec: 75 }])] };
    expect(newPrsInSession([day1], day2)).toEqual([{ name: 'Plank', type: 'time', score: 75, previous: 60 }]);
  });
  it('reps and volume only count what makes sense', () => {
    expect(sessionReps(day1)).toBe(8 + 6 + 5);
    expect(sessionVolume(day1)).toBe(500);
  });
  it('counts sets per muscle group within the dates', () => {
    const out = muscleSets([day1, { ...day1, date: '2026-09-20' }], '2026-09-28', '2026-10-04');
    expect(out).toEqual({ Back: 2, Abs: 1, Legs: 1 });
  });
  it('workout calories use 3.5 METs x kg x hours', () => {
    expect(workoutKcal(day1, 70)).toBe(245); // 3.5 x 70 x 1 h
    expect(workoutKcal({ start: 0, end: 10 * 3600000 }, 70)).toBe(735); // capped at 3 h
    expect(workoutKcal(day1, null)).toBe(0);
  });
});

describe('smoking tracker', () => {
  const today = '2026-10-26';
  it('counts per local day and averages over 7 days', () => {
    const log = [];
    lastNDays(14, today).forEach((k, i) => {
      for (let n = 0; n < (i < 7 ? 10 : 7); n++) log.push(keyToDate(k).getTime() + (8 + n) * 3600000);
    });
    const byDay = smokeByDay(log);
    expect(byDay[today]).toBe(7);
    expect(smokeWeekAvg(byDay, today)).toBe(7);
    expect(smokeWeekAvg(byDay, addDays(today, -7))).toBe(10);
  });
  it('step-down plan lowers the limit by one per full week, never below zero', () => {
    const sm = { limit: 10, stepDown: true, planStart: '2026-10-01' };
    expect(smokeLimitFor(sm, '2026-10-07')).toBe(10);
    expect(smokeLimitFor(sm, '2026-10-08')).toBe(9);
    expect(smokeLimitFor(sm, '2026-10-26')).toBe(7);
    expect(smokeLimitFor(sm, '2027-12-31')).toBe(0);
    expect(smokeLimitFor({ ...sm, stepDown: false }, '2027-12-31')).toBe(10);
    expect(smokeLimitFor({ limit: null }, today)).toBe(null);
  });
});
