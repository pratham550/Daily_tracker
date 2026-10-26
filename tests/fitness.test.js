import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  setScore, personalRecords, newPrsInSession, isSetPr, sessionReps, sessionVolume, muscleSets, workoutKcal,
  workoutKcalDetail, setMet, METS,
  smokeByDay, smokeWeekAvg, smokeLimitFor, lastNDays, parseDurationMinutes, sessionMinutes, withDuration,
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
  it('calories need body weight and a finished session', () => {
    expect(workoutKcal(day1, null)).toBe(0);
    expect(workoutKcal({ ...day1, end: undefined }, 70)).toBe(0);
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

describe('workout duration entered by hand', () => {
  it('parses hours and minutes, rejecting nonsense', () => {
    expect(parseDurationMinutes('1', '30')).toBe(90);
    expect(parseDurationMinutes('1.5', '')).toBe(90);
    expect(parseDurationMinutes('', '45')).toBe(45);
    expect(parseDurationMinutes('0', '0')).toBe(null);
    expect(parseDurationMinutes('-1', '30')).toBe(null);
    expect(parseDurationMinutes('abc', '10')).toBe(null);
    expect(parseDurationMinutes('7', '0')).toBe(null); // over 6 hours
    expect(parseDurationMinutes('6', '0')).toBe(360);
  });

  it('8 minutes of logging becomes the real 1.5 hour session, and calories follow', () => {
    const end = Date.parse('2026-10-26T19:30:00');
    const logged = { date: '2026-10-26', start: end - 8 * 60000, end, exercises: [] };
    expect(sessionMinutes(logged)).toBe(8);
    const fixed = withDuration(logged, 90);
    expect(fixed.end).toBe(end);
    expect(sessionMinutes(fixed)).toBe(90);
    // no sets in this session, so nothing to charge
    expect(workoutKcal(fixed, 70)).toBe(0);
  });
});

describe('calories per exercise, weight and reps', () => {
  const ex = (name, type, group, sets) => ({ name, type, group, sets: sets.map((s) => ({ done: true, ...s })) });
  const hour = 3600000;

  it('picks the Compendium value for the exercise and effort', () => {
    const squat = { name: 'Barbell Squat', type: 'weight', group: 'Legs' };
    const curl = { name: 'Barbell Curl', type: 'weight', group: 'Biceps' };
    const pull = { name: 'Pullups', type: 'reps', group: 'Back' };
    const plank = { name: 'Plank', type: 'time', group: 'Abs' };
    // best e1rm 116.7 (100 x 5): 100 x 5 is hard, 60 x 10 (e1rm 80, 69%) is a warm-up
    expect(setMet(squat, { kg: 100, reps: 5 }, 116.7)).toBe(METS.liftHard);
    expect(setMet(squat, { kg: 60, reps: 10 }, 116.7)).toBe(METS.squatDeadlift);
    expect(setMet(curl, { kg: 10, reps: 10 }, 40)).toBe(METS.lift);
    expect(setMet(pull, { reps: 10 }, 10)).toBe(METS.bodyweightHard);
    expect(setMet(pull, { reps: 8 }, 10)).toBe(METS.bodyweight); // 80% of best
    expect(setMet(plank, { sec: 60 }, 60)).toBe(METS.core);
  });

  it('a heavy session burns more than a light one of the same length', () => {
    const session = (sets) => ({ id: 'x', start: 0, end: hour, exercises: [ex('Barbell Squat', 'weight', 'Legs', sets)] });
    const history = [{ id: 'old', date: '2026-10-01', exercises: [ex('Barbell Squat', 'weight', 'Legs', [{ kg: 100, reps: 5 }])] }];
    const heavy = workoutKcal(session([{ kg: 100, reps: 5 }, { kg: 100, reps: 5 }]), 70, history);
    const light = workoutKcal(session([{ kg: 40, reps: 5 }, { kg: 40, reps: 5 }]), 70, history);
    expect(heavy).toBe(420); // 6.0 x 70 kg x 1 h
    expect(light).toBe(350); // 5.0 x 70 kg x 1 h
    expect(heavy).toBeGreaterThan(light);
  });

  it('worked example: 6 sets in 60 minutes, broken down by exercise', () => {
    const s = {
      id: 'w', start: 0, end: hour,
      exercises: [
        ex('Barbell Squat', 'weight', 'Legs', [{ kg: 100, reps: 5 }, { kg: 100, reps: 5 }, { kg: 60, reps: 10 }]),
        ex('Pullups', 'reps', 'Back', [{ reps: 10 }, { reps: 8 }]),
        ex('Plank', 'time', 'Abs', [{ sec: 60 }]),
      ],
    };
    // 10 minutes per set, 70 kg: squat 6.0 + 6.0 + 5.0, pull-ups 7.5 + 3.8, plank 2.8
    const d = workoutKcalDetail(s, 70, []);
    const perSet = 70 / 6;
    expect(d.byExercise).toEqual([
      { name: 'Barbell Squat', kcal: Math.round(17 * perSet) },
      { name: 'Pullups', kcal: Math.round(11.3 * perSet) },
      { name: 'Plank', kcal: Math.round(2.8 * perSet) },
    ]);
    expect(d.total).toBe(Math.round(31.1 * perSet)); // 363
  });

  it('leaves cardio machines out and gives their time back to nothing else', () => {
    const s = { id: 'c', start: 0, end: hour, exercises: [ex('Treadmill', 'time', 'Cardio', [{ sec: 1200 }])] };
    expect(workoutKcalDetail(s, 70, [])).toEqual({ total: 0, byExercise: [], skipped: ['Treadmill'] });
  });

  it('undone sets are ignored', () => {
    const s = { id: 'u', start: 0, end: hour, exercises: [{ name: 'Barbell Curl', type: 'weight', group: 'Biceps', sets: [{ kg: 20, reps: 10, done: false }] }] };
    expect(workoutKcal(s, 70, [])).toBe(0);
  });
});
