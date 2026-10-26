import { addDays, dateKey, daysInMonth, monthKey, startOfWeek, diffDays } from './dates.js';

// ---------- streaks (habits, gym) ----------

// `done` is a Set of date keys. The current streak stays alive through today
// even if today is not ticked yet, so it only breaks once a full day is missed.
export function currentStreak(done, today = dateKey()) {
  let day = done.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(done) {
  const days = [...done].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function habitDoneSet(habit) {
  return new Set(Object.keys(habit.log || {}).filter((k) => habit.log[k]));
}

// ---------- money ----------

export function monthSummary(expenses, ym) {
  const days = daysInMonth(ym);
  const byDay = new Array(days).fill(0);
  const byCategory = {};
  let total = 0;
  for (const e of expenses) {
    if (monthKey(e.date) !== ym) continue;
    total += e.amount;
    byDay[Number(e.date.slice(8, 10)) - 1] += e.amount;
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  }
  total = Math.round(total * 100) / 100;
  return { total, byDay, byCategory, days };
}

export function daySpend(expenses, key) {
  return expenses.reduce((s, e) => (e.date === key ? s + e.amount : s), 0);
}

export function expensesToCsv(expenses, categories) {
  const name = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [...expenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const [y, m, d] = e.date.split('-');
      return [`${d}-${m}-${y}`, q(name[e.category] || e.category), e.amount, q(e.note)].join(',');
    });
  return ['Date,Category,Amount (Rs),Note', ...rows].join('\r\n');
}

// ---------- gym ----------
// A set is { kg, reps, sec, done }. Exercise type decides what counts:
// weight = kg x reps, reps = bodyweight reps, time = seconds held.

// Epley estimate of one-rep max; a single rep is its own max
export function e1rm(kg, reps) {
  if (!kg || !reps) return 0;
  return reps === 1 ? kg : Math.round(kg * (1 + reps / 30) * 10) / 10;
}

export function setScore(type, set) {
  if (type === 'time') return set.sec || 0;
  if (type === 'reps') return set.reps || 0;
  return e1rm(set.kg || 0, set.reps || 0);
}

const typeOf = (ex) => ex.type || 'weight';
const doneSets = (ex) => ex.sets.filter((s) => s.done && setScore(typeOf(ex), s) > 0);

export function sessionVolume(session) {
  let v = 0;
  for (const ex of session.exercises) {
    if (typeOf(ex) !== 'weight') continue;
    for (const s of ex.sets) if (s.done) v += (s.kg || 0) * (s.reps || 0);
  }
  return Math.round(v);
}

export function sessionSetCount(session) {
  return session.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
}

export function sessionReps(session) {
  return session.exercises.reduce((n, ex) => n + (typeOf(ex) === 'time' ? 0 : ex.sets.reduce((m, s) => m + (s.done ? s.reps || 0 : 0), 0)), 0);
}

export function exerciseHistory(sessions, name) {
  const out = [];
  for (const s of sessions) {
    const ex = s.exercises.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!ex) continue;
    const done = doneSets(ex);
    if (!done.length) continue;
    const type = typeOf(ex);
    out.push({
      date: s.date,
      type,
      best: Math.max(...done.map((x) => setScore(type, x))),
      topKg: Math.max(...done.map((x) => x.kg || 0)),
      totalReps: done.reduce((v, x) => v + (x.reps || 0), 0),
      volume: type === 'weight' ? Math.round(done.reduce((v, x) => v + (x.kg || 0) * (x.reps || 0), 0)) : 0,
      sets: done.map((x) => ({ kg: x.kg, reps: x.reps, sec: x.sec })),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function personalRecords(sessions) {
  const prs = {};
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const type = typeOf(ex);
      for (const set of doneSets(ex)) {
        const score = setScore(type, set);
        const key = ex.name.toLowerCase();
        if (!prs[key] || score > prs[key].score) {
          prs[key] = { name: ex.name, type, group: ex.group, score, kg: set.kg || 0, reps: set.reps || 0, sec: set.sec || 0, date: s.date };
        }
      }
    }
  }
  return prs;
}

export function prLabel(pr) {
  if (pr.type === 'time') return `${pr.score}s hold`;
  if (pr.type === 'reps') return `${pr.score} reps`;
  return `~${pr.score} kg 1RM`;
}

// Exercises in a finished session that beat every earlier session
export function newPrsInSession(previousSessions, session) {
  const before = personalRecords(previousSessions);
  const hits = [];
  for (const ex of session.exercises) {
    const type = typeOf(ex);
    const best = Math.max(0, ...doneSets(ex).map((s) => setScore(type, s)));
    const old = before[ex.name.toLowerCase()];
    if (best > 0 && old && best > old.score) hits.push({ name: ex.name, type, score: best, previous: old.score });
  }
  return hits;
}

// Live check while logging: does this one set beat the saved record?
export function isSetPr(sessions, ex, set) {
  const old = personalRecords(sessions)[ex.name.toLowerCase()];
  const score = setScore(typeOf(ex), set);
  return Boolean(old && score > old.score);
}

export function gymDays(sessions) {
  return new Set(sessions.map((s) => s.date));
}

export function sessionsThisWeek(sessions, today = dateKey()) {
  const start = startOfWeek(today);
  const end = addDays(start, 6);
  return new Set(sessions.filter((s) => s.date >= start && s.date <= end).map((s) => s.date)).size;
}

// Done sets per muscle group between two date keys (inclusive)
export function muscleSets(sessions, from, to) {
  const out = {};
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue;
    for (const ex of s.exercises) {
      const n = ex.sets.filter((x) => x.done).length;
      if (n) out[ex.group || 'Other'] = (out[ex.group || 'Other'] || 0) + n;
    }
  }
  return out;
}

// ---------- gym calories ----------
// MET values from the Compendium of Physical Activities (pacompendium.com, conditioning exercise).
export const METS = {
  lift: 3.5, // 02054 resistance training, multiple exercises, 8-15 reps at varied resistance
  liftHard: 6.0, // 02050 weight lifting, power lifting or body building, vigorous effort
  squatDeadlift: 5.0, // 02052 resistance training, squats, deadlift
  bodyweight: 3.8, // 02022 calisthenics (pushups, sit ups, pull-ups, lunges), moderate effort
  bodyweightHard: 7.5, // 02020 calisthenics, vigorous effort
  core: 2.8, // 02024 calisthenics (curl ups, abdominal crunches, plank), light effort
  stretch: 2.3, // 02101 stretching, mild
};

// A set counts as hard when it reaches this share of your best on that exercise. This cut-off
// is the app's own choice; the Compendium only separates effort levels, not loads.
export const HARD_SHARE = 0.85;

const SQUAT_DEADLIFT = /squat|deadlift/i;

export function setMet(ex, set, best) {
  const type = typeOf(ex);
  if (ex.group === 'Stretch') return METS.stretch;
  if (ex.group === 'Abs' && type !== 'weight') return METS.core;
  const hard = best > 0 && setScore(type, set) >= HARD_SHARE * best;
  if (type === 'weight') {
    if (SQUAT_DEADLIFT.test(ex.name)) return hard ? METS.liftHard : METS.squatDeadlift;
    return hard ? METS.liftHard : METS.lift;
  }
  return hard ? METS.bodyweightHard : METS.bodyweight;
}

// Calories per exercise for one session. The real workout time is shared equally across the
// done sets (each set plus its rest), and each set is charged at the MET for its exercise
// and effort. Cardio machines are left out: their Compendium values depend on speed, which
// the app does not record, and the phone's active calories already cover them.
export function workoutKcalDetail(session, weightKg, history = []) {
  const empty = { total: 0, byExercise: [], skipped: [] };
  if (!weightKg || !session.end) return empty;
  const before = personalRecords(history.filter((h) => h.id !== session.id));
  const sets = [];
  const skipped = [];
  for (const ex of session.exercises) {
    const done = ex.sets.filter((x) => x.done);
    if (!done.length) continue;
    if (ex.group === 'Cardio') { skipped.push(ex.name); continue; }
    const type = typeOf(ex);
    const best = Math.max(before[ex.name.toLowerCase()]?.score || 0, ...done.map((x) => setScore(type, x)));
    for (const x of done) sets.push({ name: ex.name, met: setMet(ex, x, best) });
  }
  if (!sets.length) return { ...empty, skipped };
  const hours = Math.min(MAX_WORKOUT_MIN, Math.max(0, (session.end - session.start) / 60000)) / 60;
  const perSet = hours / sets.length;
  const byName = new Map();
  for (const st of sets) byName.set(st.name, (byName.get(st.name) || 0) + st.met * weightKg * perSet);
  const byExercise = [...byName].map(([name, kcal]) => ({ name, kcal: Math.round(kcal) }));
  const total = Math.round([...byName.values()].reduce((a, b) => a + b, 0));
  return { total, byExercise, skipped };
}

export function workoutKcal(session, weightKg, history = []) {
  return workoutKcalDetail(session, weightKg, history).total;
}

// Workout length the user enters, in minutes. The live timer only measures how long the
// logging screen was open, which is often much shorter than the real session.
export const MAX_WORKOUT_MIN = 360;

export function parseDurationMinutes(hours, minutes) {
  const h = hours === '' || hours == null ? 0 : Number(hours);
  const m = minutes === '' || minutes == null ? 0 : Number(minutes);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) return null;
  const total = Math.round(h * 60 + m);
  return total >= 1 && total <= MAX_WORKOUT_MIN ? total : null;
}

export function sessionMinutes(session) {
  return Math.max(1, Math.round((session.end - session.start) / 60000));
}

// Keeps the end time and moves the start so the session lasts `minutes`
export function withDuration(session, minutes) {
  return { ...session, start: session.end - minutes * 60000 };
}

// The last time an exercise was done, used to pre-fill sets in a new workout
export function lastSetsFor(sessions, name) {
  const h = exerciseHistory(sessions, name);
  return h.length ? h[h.length - 1].sets : null;
}

// ---------- smoking ----------
// The log is a list of timestamps (ms), one per cigarette.

export function smokeByDay(log) {
  const out = {};
  for (const t of log) {
    const k = dateKey(new Date(t));
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// Average per day over the 7 days ending on `end` (days with zero count as zero)
export function smokeWeekAvg(byDay, end) {
  let n = 0;
  for (let i = 0; i < 7; i++) n += byDay[addDays(end, -i)] || 0;
  return Math.round((n / 7) * 10) / 10;
}

// Optional gentle plan: the limit drops by one each full week since the plan started
export function smokeLimitFor(smoke, today = dateKey()) {
  if (smoke.limit == null) return null;
  if (!smoke.stepDown || !smoke.planStart) return smoke.limit;
  const weeks = Math.floor(Math.max(0, diffDays(smoke.planStart, today)) / 7);
  return Math.max(0, smoke.limit - weeks);
}

// ---------- steps ----------

// Health Connect returns day buckets as ISO instants. Key each bucket by the local
// date at its midpoint, so a bucket starting at local midnight never slips a day.
export function stepBucketsToDaily(samples) {
  const out = {};
  for (const s of samples) {
    const mid = new Date((new Date(s.startDate).getTime() + new Date(s.endDate).getTime()) / 2);
    const k = dateKey(mid);
    out[k] = (out[k] || 0) + Math.round(s.value || 0);
  }
  return out;
}

export function lastNDays(n, today = dateKey()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}
