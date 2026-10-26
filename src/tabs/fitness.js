import { update, getState, uid } from '../store.js';
import { dateKey, addDays, fmtDay, startOfWeek, monthKey, weekdayShort } from '../lib/dates.js';
import { formatClock, formatDuration, formatNum, formatKm } from '../lib/format.js';
import {
  sessionVolume, sessionSetCount, sessionReps, exerciseHistory, personalRecords, newPrsInSession, isSetPr,
  gymDays, sessionsThisWeek, lastSetsFor, lastNDays, muscleSets, workoutKcal, prLabel, GYM_MET,
} from '../lib/stats.js';
import { loadLibrary, searchExercises, describe, demo, findByName, stepsHtml, GROUPS, TYPE_LABEL, groupEmoji } from '../lib/exercises.js';
import { healthStatus, connectHealth, syncSteps, openHealthSettings } from '../lib/health.js';
import { scheduleTimer, cancelTimer } from '../lib/reminders.js';
import { isNative, success, thud } from '../lib/platform.js';
import {
  esc, icon, ring, count, bar, barChart, lineChart, heatmap, swipeItem, openSheet, confirmSheet, toast, confetti, prBurst,
} from '../ui.js';

let sub = 'gym';
export function setSub(s) { if (s) sub = s; }

const rest = { endAt: 0 };
let ticker = null;
let syncing = false;
let libReady = false;

function weeksHeat(levelFor, weeks = 12) {
  const today = dateKey();
  const start = addDays(startOfWeek(today), -7 * (weeks - 1));
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const k = addDays(start, i);
    cells.push({ level: k > today ? 0 : levelFor(k), today: k === today, future: k > today });
  }
  return heatmap(cells);
}

export function render(s) {
  const seg = `<div class="seg">${[['gym', '🏋️ Gym'], ['steps', '👟 Steps'], ['body', '⚖️ Body']].map(([id, n]) =>
    `<button class="${sub === id ? 'on' : ''}" data-act="sub" data-id="${id}">${n}</button>`).join('')}</div>`;
  const head = `<header class="top"><div class="grow"><h1>Fitness 💪</h1><div class="sub">${s.gym.active ? 'Workout in progress' : 'Train, walk, track'}</div></div></header>`;
  const body = sub === 'gym' ? (s.gym.active ? renderActive(s) : renderGym(s)) : sub === 'steps' ? renderSteps(s) : renderBody(s);
  return head + seg + body;
}

// ---------- gym overview: kept short; detail lives in the Progress sheet ----------
function renderGym(s) {
  const today = dateKey();
  const days = gymDays(s.gym.sessions);
  const week = sessionsThisWeek(s.gym.sessions, today);
  const target = s.settings.gymWeeklyTarget;
  const wk = startOfWeek(today);
  const weekSessions = s.gym.sessions.filter((x) => x.date >= wk && x.date <= today);
  const weekKcal = weekSessions.reduce((a, x) => a + workoutKcal(x, s.profile.weightKg), 0);
  const weekReps = weekSessions.reduce((a, x) => a + sessionReps(x), 0);
  const sets = muscleSets(s.gym.sessions, wk, today);
  const recent = [...s.gym.sessions].sort((a, b) => b.start - a.start).slice(0, 3);
  const maxSets = Math.max(10, ...Object.values(sets));

  return `<div class="card hero">
      <div class="row" style="gap:18px">
        ${ring('gym-week', week / target, { size: 108, stroke: 11, inner: `<div><div class="mid-num">${week}/${target}</div><div class="muted small">days</div></div>` })}
        <div style="flex:1">
          <div class="muted small">${days.has(today) ? 'Trained today ✅' : 'This week'}</div>
          <div class="row" style="gap:6px;margin:6px 0 10px;flex-wrap:wrap">
            <span class="badge">🔁 ${formatNum(weekReps)} reps</span>
            ${weekKcal ? `<span class="badge">🔥 ~${formatNum(weekKcal)} kcal</span>` : ''}</div>
          <div class="week">${[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const k = addDays(wk, i);
            return `<div><div class="d">${weekdayShort(k)[0]}</div><div class="dot ${k === today ? 'today' : ''}" style="width:26px;height:26px;background:${days.has(k) ? 'rgb(255 255 255 / .92)' : 'rgb(255 255 255 / .2)'};color:var(--accent)">${days.has(k) ? '✓' : ''}</div></div>`;
          }).join('')}</div>
        </div></div></div>

    <div class="section-title">Start a workout</div>
    <div class="hscroll">${s.gym.templates.map((t) => `
      <button class="card tile pressable" style="text-align:left" data-act="start" data-id="${t.id}">
        <b style="font-size:16px">${esc(t.name)}</b><span class="muted small">${t.exercises.length} exercises</span></button>`).join('')}
      <button class="card tile pressable" style="text-align:left" data-act="start" data-id="">
        <b style="font-size:16px">➕ Empty</b><span class="muted small">Pick as you go</span></button>
    </div>

    <div class="row" style="gap:8px;margin-bottom:14px">
      <button class="btn plain small" style="flex:1" data-act="library">📚 Exercises</button>
      <button class="btn plain small" style="flex:1" data-act="progress">📈 Progress</button>
      <button class="btn plain small" style="flex:1" data-act="templates">✏️ Plans</button></div>

    <div class="card"><h2>🎯 Sets per muscle this week</h2>
      ${Object.keys(sets).length ? GROUPS.filter((g) => sets[g.id]).map((g) => `<div class="muscle-row"><span>${g.emoji} ${g.id}</span>${bar(sets[g.id] / maxSets)}<b>${sets[g.id]}</b></div>`).join('')
        + '<p class="hint">Many lifters aim for roughly 10-20 hard sets per muscle each week.</p>'
        : '<div class="empty small">Finish a workout to see which muscles you trained.</div>'}</div>

    ${recent.length ? `<div class="card"><h2>🕘 Recent</h2><div class="list">${recent.map((x) => `
      <button class="item pressable" style="text-align:left" data-act="session" data-id="${x.id}">
        <span class="grow"><span class="title">${esc(x.name)} · ${fmtDay(x.date)}</span>
        <span class="meta">${formatDuration((x.end - x.start) / 1000)} · ${sessionSetCount(x)} sets · ${formatNum(sessionReps(x))} reps</span></span>${icon('right', 'width="18" height="18"')}</button>`).join('')}</div></div>` : ''}`;
}

// ---------- active workout ----------
function setInputs(ex, st, i, j) {
  const inp = (field, ph, mode) => `<input class="input" inputmode="${mode}" data-set="${i}:${j}:${field}" value="${st[field] ?? ''}" placeholder="${ph}">`;
  if (ex.type === 'time') return `${inp('sec', 'seconds', 'numeric')}<span></span>`;
  if (ex.type === 'reps') return `${inp('reps', 'reps', 'numeric')}<span></span>`;
  return inp('kg', 'kg', 'decimal') + inp('reps', 'reps', 'numeric');
}

function setHead(ex) {
  if (ex.type === 'time') return '<span>Set</span><span>Seconds</span><span></span><span>✓</span>';
  if (ex.type === 'reps') return '<span>Set</span><span>Reps</span><span></span><span>✓</span>';
  return '<span>Set</span><span>kg</span><span>Reps</span><span>✓</span>';
}

const prevText = (ex, p) => (ex.type === 'time' ? `${p.sec}s` : ex.type === 'reps' ? `${p.reps}` : `${p.kg}×${p.reps}`);

function renderActive(s) {
  const a = s.gym.active;
  const elapsed = Math.round((Date.now() - a.start) / 1000);
  const restLeft = Math.max(0, Math.round((rest.endAt - Date.now()) / 1000));
  return `<div class="card hero">
      <div class="row between"><div><div class="muted small">Workout</div><div class="mid-num">${esc(a.name)}</div></div>
        <div style="text-align:right"><div class="muted small">Time</div><div class="mid-num" id="gym-elapsed">${formatClock(elapsed)}</div></div></div>
      <div class="row" style="margin-top:12px;gap:6px">
        <span class="badge">${sessionSetCount(a)} set${sessionSetCount(a) === 1 ? '' : 's'}</span><span class="badge">${formatNum(sessionReps(a))} reps</span>
        <span class="spacer" style="flex:1"></span>
        <button class="btn ghost small" data-act="discard">Discard</button></div></div>
    ${a.exercises.map((ex, i) => {
      const prev = lastSetsFor(s.gym.sessions, ex.name);
      return `<div class="card">
        <div class="row" style="margin-bottom:8px">
          <button data-act="exercise" data-id="${esc(ex.name)}" aria-label="How to do ${esc(ex.name)}">${demo(ex.exId, ex.group, 'thumb')}</button>
          <button class="grow" style="text-align:left;min-width:0" data-act="exercise" data-id="${esc(ex.name)}">
            <div class="title" style="font-weight:700">${esc(ex.name)}</div>
            <div class="muted small">${groupEmoji(ex.group)} ${esc(ex.group)}${prev ? ` · Last: ${prev.map((p) => prevText(ex, p)).join(', ')}` : ''}</div></button>
          <button class="btn plain small" data-act="removeEx" data-id="${i}" aria-label="Remove exercise">${icon('trash', 'width="16" height="16"')}</button></div>
        <div class="set-row head">${setHead(ex)}</div>
        ${ex.sets.map((st, j) => `<div class="set-row ${st.done ? 'ok' : ''}">
          <span class="n">${st.pr ? '<span class="pr-mark">🏆</span>' : j + 1}</span>${setInputs(ex, st, i, j)}
          <button class="check big ${st.done ? 'on' : ''}" data-act="tick" data-id="${i}:${j}" aria-label="Set done">${icon('check')}</button></div>`).join('')}
        <div class="row" style="margin-top:10px">
          <button class="btn ghost small" style="flex:1" data-act="addSet" data-id="${i}">+ Set</button>
          ${ex.sets.length > 1 ? `<button class="btn plain small" data-act="removeSet" data-id="${i}">− Set</button>` : ''}</div>
      </div>`;
    }).join('')}
    <button class="btn plain block" data-act="addEx" style="margin-bottom:12px">+ Add exercise</button>
    <button class="btn block" data-act="finish">🏁 Finish workout</button>
    ${restLeft > 0 ? `<div class="rest-bar"><span>⏱️</span><div class="grow"><div class="small" style="opacity:.85">Rest</div>
      <div class="t" id="rest-left">${formatClock(restLeft)}</div></div>
      <button class="btn ghost small" data-act="restAdd">+30s</button><button class="btn ghost small" data-act="restSkip">Skip</button></div>` : ''}`;
}

export function mounted(root, ctx) {
  clearInterval(ticker);
  if (!libReady) loadLibrary().then(() => { libReady = true; ctx.render(); });
  const s = getState();
  if (sub === 'gym' && s.gym.active) {
    ticker = setInterval(() => {
      const a = getState().gym.active;
      if (!a) { clearInterval(ticker); return; }
      const el = document.getElementById('gym-elapsed');
      if (el) el.textContent = formatClock((Date.now() - a.start) / 1000);
      const r = document.getElementById('rest-left');
      if (r) {
        const left = Math.round((rest.endAt - Date.now()) / 1000);
        r.textContent = formatClock(left);
        if (left <= 0) { thud(); ctx.render(); }
      }
    }, 1000);
  }
  if (sub === 'steps') autoSyncSteps(ctx);
}

export function unmounted() {
  clearInterval(ticker);
}

export function onChange(e) {
  const k = e.target.dataset.set;
  if (!k) return;
  const [i, j, field] = k.split(':');
  const v = Number(e.target.value);
  update((s) => { s.gym.active.exercises[i].sets[j][field] = e.target.value !== '' && Number.isFinite(v) && v >= 0 ? v : null; }, { silent: true });
}

function newExercise(name, sessions) {
  const info = describe(name);
  const prev = lastSetsFor(sessions, name);
  const blank = { kg: null, reps: null, sec: null, done: false };
  return {
    name, ...info,
    sets: prev ? prev.map((p) => ({ ...blank, kg: p.kg ?? null, reps: p.reps ?? null, sec: p.sec ?? null })) : [1, 2, 3].map(() => ({ ...blank })),
  };
}

async function startWorkout(templateId) {
  await loadLibrary();
  libReady = true;
  const s = getState();
  const t = s.gym.templates.find((x) => x.id === templateId);
  const exercises = (t ? t.exercises : []).map((name) => newExercise(name, s.gym.sessions));
  update((st) => { st.gym.active = { id: uid(), date: dateKey(), start: Date.now(), name: t ? t.name : 'Workout', exercises }; });
  success();
  if (!t) openLibrary('add');
}

function startRest(seconds) {
  rest.endAt = Date.now() + seconds * 1000;
  scheduleTimer('rest', new Date(rest.endAt), '⏱️ Rest over', 'Time for your next set. 💪');
}

// ---------- exercise library: browse by muscle, search, see the demo ----------
async function openLibrary(mode = 'browse') {
  await loadLibrary();
  libReady = true;
  const st = { group: null, q: '', detail: null };
  const sheet = openSheet({ title: mode === 'add' ? 'Add exercise' : 'Exercises', html: '' });

  const drawList = () => {
    const box = sheet.body.querySelector('#ex-res');
    const res = searchExercises(st.q, st.group);
    const custom = st.q.trim() && mode === 'add' && !findByName(st.q.trim())
      ? `<button class="item pressable" style="text-align:left" data-custom><span class="emoji">✍️</span><span class="grow"><span class="title">Add “${esc(st.q.trim())}”</span><span class="meta">Your own exercise (kg × reps)</span></span></button>` : '';
    // in add mode a tap on the row adds it; the moving thumbnail opens the how-to
    box.innerHTML = custom + (res.map((e) => `<div class="item">
      <button data-info="${esc(e.name)}" aria-label="How to do ${esc(e.name)}">${demo(e.id, e.group, 'thumb')}</button>
      <button class="grow pressable" style="text-align:left;min-width:0" data-ex="${esc(e.name)}"><span class="title wrap">${esc(e.name)}</span>
      <span class="meta">${esc(e.equip)} · ${TYPE_LABEL[e.type]}</span></button>
      ${mode === 'add' ? `<button class="btn ghost small" data-ex="${esc(e.name)}" aria-label="Add">+</button>` : ''}</div>`).join('') || '<div class="empty small">No exercise found.</div>');
    if (mode === 'add') box.insertAdjacentHTML('beforeend', '<p class="hint">Tap a name to add it. Tap the picture to see how it is done.</p>');
  };

  const draw = () => {
    if (st.detail) {
      const e = findByName(st.detail);
      const pr = personalRecords(getState().gym.sessions)[e.name.toLowerCase()];
      sheet.setBody(`<button class="btn plain small" data-back style="margin-bottom:12px">${icon('left', 'width="16" height="16"')} Back</button>
        ${demo(e.id, e.group)}
        <h3 style="margin:0 0 6px">${esc(e.name)}</h3>
        <div class="row wrap" style="gap:6px;margin-bottom:12px"><span class="badge">${groupEmoji(e.group)} ${esc(e.group)}</span>
          <span class="badge">${esc(e.equip)}</span><span class="badge">${TYPE_LABEL[e.type]}</span><span class="badge">${esc(e.level)}</span>
          ${pr ? `<span class="badge good">🏆 ${prLabel(pr)}</span>` : ''}</div>
        <div class="muted small" style="margin-bottom:12px">Works: ${esc(e.muscles.join(', '))}</div>
        ${stepsHtml(e)}
        ${mode === 'add' ? '<button class="btn block" data-addex>Add to workout</button>' : ''}`);
      return;
    }
    sheet.setBody(`<input class="input" id="ex-q" placeholder="Search 873 exercises…" value="${esc(st.q)}" autocomplete="off" style="margin-bottom:10px">
      <div class="chips" style="margin-bottom:10px"><button class="chip ${!st.group ? 'on' : ''}" data-group="">All</button>
        ${GROUPS.map((g) => `<button class="chip ${st.group === g.id ? 'on' : ''}" data-group="${g.id}">${g.emoji} ${g.id}</button>`).join('')}</div>
      <div class="list" id="ex-res"></div>`);
    drawList();
  };

  const add = (name) => {
    update((s) => { s.gym.active.exercises.push(newExercise(name, s.gym.sessions)); });
    success();
    sheet.close();
  };

  sheet.body.addEventListener('input', (e) => { if (e.target.id === 'ex-q') { st.q = e.target.value; drawList(); } });
  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('group' in b.dataset) { st.group = b.dataset.group || null; draw(); return; }
    if (b.dataset.ex && mode === 'add') { add(b.dataset.ex); return; }
    if (b.dataset.ex || b.dataset.info) {
      st.detail = b.dataset.ex || b.dataset.info;
      draw();
      return;
    }
    if ('back' in b.dataset) { st.detail = null; draw(); return; }
    if ('addex' in b.dataset) { add(st.detail); return; }
    if ('custom' in b.dataset) add(st.q.trim());
  });
  draw();
}

// ---------- exercise progress ----------
async function openExercise(name) {
  await loadLibrary();
  const s = getState();
  const e = findByName(name);
  const h = exerciseHistory(s.gym.sessions, name);
  const pr = personalRecords(s.gym.sessions)[name.toLowerCase()];
  const type = e?.type || h[0]?.type || 'weight';
  const unit = type === 'time' ? 's' : type === 'reps' ? ' reps' : ' kg';
  const prev = (x) => (type === 'time' ? `${x.sec}s` : type === 'reps' ? `${x.reps}` : `${x.kg}×${x.reps}`);
  openSheet({
    title: name,
    html: `${demo(e?.id, e?.group || 'Other')}
      ${pr ? `<div class="kv" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
        <div><b>${prLabel(pr)}</b><span>personal record</span></div><div><b>${h.length}</b><span>sessions</span></div>
        <div><b>${formatNum(h.reduce((a, x) => a + x.totalReps, 0))}</b><span>total reps</span></div></div>` : ''}
      <div class="card"><h2>📈 ${type === 'weight' ? 'Estimated 1RM' : type === 'reps' ? 'Best reps' : 'Longest hold'}</h2>
        ${lineChart(h.slice(-20).map((x) => ({ v: x.best, label: fmtDay(x.date) })), { fmt: (v) => `${v}${unit}` })}</div>
      <div class="card"><h2>History</h2>${h.length ? `<div class="list">${[...h].reverse().slice(0, 12).map((x) => `
        <div class="row between small"><span>${fmtDay(x.date)}</span><span class="muted">${x.sets.map(prev).join(', ')}</span></div>`).join('')}</div>`
        : '<div class="empty small">No finished sets yet.</div>'}</div>
      ${e ? `<details class="card"><summary style="font-weight:700">How to do it</summary>
        ${stepsHtml(e)}</details>` : ''}
      ${type === 'weight' ? '<p class="hint">1RM is estimated with the Epley formula: kg × (1 + reps / 30).</p>' : ''}`,
  });
}

function openProgress() {
  const s = getState();
  const days = gymDays(s.gym.sessions);
  const prs = Object.values(personalRecords(s.gym.sessions)).sort((a, b) => b.date.localeCompare(a.date));
  const all = [...s.gym.sessions].sort((a, b) => b.start - a.start);
  const month = new Set(s.gym.sessions.filter((x) => monthKey(x.date) === monthKey(dateKey())).map((x) => x.date)).size;
  const sheet = openSheet({
    title: 'Progress',
    html: `<div class="kv" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
        <div><b>${month}</b><span>days this month</span></div><div><b>${days.size}</b><span>days total</span></div>
        <div><b>${prs.length}</b><span>exercises with PRs</span></div></div>
      <div class="card"><h2>📅 Last 12 weeks</h2>${weeksHeat((k) => (days.has(k) ? 3 : 0))}</div>
      <div class="card"><h2>🏆 Personal records</h2>${prs.length ? `<div class="list">${prs.map((p) => `
        <button class="item pressable" style="text-align:left" data-ex="${esc(p.name)}">
          <span class="grow"><span class="title">${esc(p.name)}</span><span class="meta">${groupEmoji(p.group)} ${esc(p.group || '')} · ${fmtDay(p.date)}</span></span>
          <span class="badge">${prLabel(p)}</span></button>`).join('')}</div>` : '<div class="empty small">Records appear after your first workout.</div>'}</div>
      <div class="card"><h2>🗂️ All workouts</h2>${all.length ? `<div class="list">${all.map((x) => `
        <button class="item pressable" style="text-align:left" data-session="${x.id}"><span class="grow"><span class="title">${esc(x.name)} · ${fmtDay(x.date)}</span>
        <span class="meta">${sessionSetCount(x)} sets · ${formatNum(sessionReps(x))} reps · ${formatNum(sessionVolume(x))} kg</span></span></button>`).join('')}</div>`
        : '<div class="empty small">No workouts yet.</div>'}</div>`,
  });
  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ex],[data-session]');
    if (b?.dataset.ex) openExercise(b.dataset.ex);
    if (b?.dataset.session) openSession(b.dataset.session);
  });
}

async function finishWorkout() {
  const s = getState();
  const a = s.gym.active;
  if (!sessionSetCount(a)) {
    const ok = await confirmSheet({ title: 'No sets ticked', message: 'You have not ticked any set as done. Nothing will be saved.', confirm: 'Discard workout' });
    if (ok) update((st) => { st.gym.active = null; });
    return;
  }
  const session = {
    ...a, end: Date.now(),
    exercises: a.exercises.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done).map(({ pr: _pr, ...x }) => x) })).filter((e) => e.sets.length),
  };
  const prs = newPrsInSession(s.gym.sessions, session);
  const kcal = workoutKcal(session, s.profile.weightKg);
  update((st) => { st.gym.sessions.push(session); st.gym.active = null; });
  cancelTimer('rest');
  rest.endAt = 0;
  success();
  confetti();
  openSheet({
    title: 'Workout complete 🎉',
    html: `<div class="kv" style="margin-bottom:14px">
        <div><b>${formatDuration((session.end - session.start) / 1000)}</b><span>time</span></div>
        <div><b>${sessionSetCount(session)}</b><span>sets</span></div>
        <div><b>${formatNum(sessionReps(session))}</b><span>reps</span></div>
        <div><b>${kcal ? `~${kcal}` : '—'}</b><span>kcal</span></div></div>
      ${prs.length ? `<div class="card"><h2>🏆 New personal records</h2>${prs.map((p) => `<div class="row between" style="margin-top:6px"><span>${esc(p.name)}</span><b>${prLabel(p)}</b></div>`).join('')}</div>`
        : '<p class="center muted">Solid session. Consistency wins. 💪</p>'}
      <p class="hint">${kcal ? `Calories estimated at ${GYM_MET} METs (Compendium of Physical Activities, resistance training 8-15 reps).` : 'Add your weight in Diet → goal to see calories burned.'}</p>`,
  });
}

function openSession(id) {
  const x = getState().gym.sessions.find((ss) => ss.id === id);
  if (!x) return;
  const fmtSet = (e, p) => (e.type === 'time' ? `${p.sec ?? 0}s` : e.type === 'reps' ? `${p.reps ?? 0} reps` : `${p.kg ?? 0} kg × ${p.reps ?? 0}`);
  const sheet = openSheet({
    title: `${x.name} · ${fmtDay(x.date)}`,
    html: `<div class="kv" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
        <div><b>${formatDuration((x.end - x.start) / 1000)}</b><span>time</span></div>
        <div><b>${sessionSetCount(x)}</b><span>sets</span></div>
        <div><b>${formatNum(sessionReps(x))}</b><span>reps</span></div></div>
      ${x.exercises.map((e) => `<div class="card tight"><b>${esc(e.name)}</b>
        <div class="muted small">${e.sets.map((p) => fmtSet(e, p)).join(' · ')}</div></div>`).join('')}
      <button class="btn danger block" data-del>Delete this workout</button>`,
  });
  sheet.body.querySelector('[data-del]').onclick = async () => {
    if (!(await confirmSheet({ title: 'Delete workout?', message: 'This removes the workout and its sets from your history.' }))) return;
    update((s) => { s.gym.sessions = s.gym.sessions.filter((ss) => ss.id !== id); });
    sheet.close();
    toast('Workout deleted');
  };
}

function openTemplates() {
  const sheet = openSheet({ title: 'My plans', html: '' });
  let editing = null;
  const draw = () => {
    const s = getState();
    if (editing) {
      const t = editing === 'new' ? { name: '', exercises: [] } : s.gym.templates.find((x) => x.id === editing);
      sheet.setBody(`<label class="field"><span>Plan name</span><input class="input" id="tp-name" value="${esc(t.name)}" placeholder="e.g. Chest + Triceps"></label>
        <label class="field"><span>Exercises, one per line (use names from 📚 Exercises to get demos)</span>
          <textarea class="input" id="tp-ex" style="min-height:200px">${esc(t.exercises.join('\n'))}</textarea></label>
        <div class="row">${editing !== 'new' ? '<button class="btn danger" data-tdel>Delete</button>' : ''}
          <button class="btn plain" data-tback>Cancel</button><button class="btn" style="flex:1" data-tsave>Save</button></div>`);
      return;
    }
    sheet.setBody(`<div class="list" style="margin-bottom:12px">${s.gym.templates.map((t) => `
      <button class="item pressable" style="text-align:left" data-tedit="${t.id}"><span class="grow"><span class="title">${esc(t.name)}</span>
      <span class="meta">${esc(t.exercises.join(', '))}</span></span>${icon('edit', 'width="18" height="18"')}</button>`).join('')}</div>
      <button class="btn block" data-tnew>+ New plan</button>`);
  };
  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.tedit) { editing = d.tedit; draw(); }
    if ('tnew' in d) { editing = 'new'; draw(); }
    if ('tback' in d) { editing = null; draw(); }
    if ('tsave' in d) {
      const name = sheet.body.querySelector('#tp-name').value.trim();
      const exercises = sheet.body.querySelector('#tp-ex').value.split('\n').map((x) => x.trim()).filter(Boolean);
      if (!name) { toast('Please give the plan a name'); return; }
      update((s) => {
        if (editing === 'new') s.gym.templates.push({ id: uid(), name, exercises });
        else Object.assign(s.gym.templates.find((x) => x.id === editing), { name, exercises });
      });
      editing = null;
      draw();
    }
    if ('tdel' in d) {
      update((s) => { s.gym.templates = s.gym.templates.filter((x) => x.id !== editing); });
      editing = null;
      draw();
    }
  });
  draw();
}

// ---------- steps ----------
let health = null;

function renderSteps(s) {
  const goal = s.settings.stepGoal;
  if (!isNative()) {
    return `<div class="card center"><div style="font-size:40px">📱</div><b>Steps come from your phone</b>
      <p class="muted">Install the Android app on your phone. It reads your steps from Health Connect.</p></div>`;
  }
  if (!s.steps.connected) {
    return `<div class="card hero"><div style="font-size:40px">👟</div>
      <div class="mid-num" style="margin:6px 0">Connect your steps</div>
      <p class="muted" style="margin:0 0 14px">Daily Hub reads steps, distance and active calories from Health Connect. It only reads; it never writes or shares anything.</p>
      <button class="btn ghost" data-act="connect">Connect Health Connect</button>
      ${health && !health.available ? `<p class="small" style="margin-top:12px">⚠️ ${esc(health.reason || 'Health Connect is not available on this phone.')}</p>` : ''}</div>`;
  }
  const today = dateKey();
  const steps = s.steps.daily[today] || 0;
  const week = lastNDays(7, today);
  const month = lastNDays(30, today).map((k) => s.steps.daily[k] || 0);
  const recorded = month.filter((v) => v > 0);
  const avg = recorded.length ? Math.round(recorded.reduce((a, b) => a + b, 0) / recorded.length) : 0;
  const best = Math.max(0, ...month);
  const hit = month.filter((v) => v >= goal).length;
  let streak = 0;
  for (let k = steps >= goal ? today : addDays(today, -1); (s.steps.daily[k] || 0) >= goal; k = addDays(k, -1)) streak++;
  const synced = s.steps.lastSync ? new Date(s.steps.lastSync).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : 'never';

  return `<div class="card hero center">
      ${ring('steps-today', steps / goal, { size: 190, stroke: 16, inner: `<div><div style="font-size:30px">👟</div><div class="big-num">${count('steps-big', steps)}</div><div class="muted small">of ${formatNum(goal)} steps</div></div>` })}
      <div class="row" style="justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap">
        <span class="badge">📏 ${formatKm(s.steps.distance[today] || 0)}</span>
        <span class="badge">🔥 ${formatNum(s.steps.calories[today] || 0)} kcal</span>
        ${streak ? `<span class="badge">⚡ ${streak} day streak</span>` : ''}</div></div>
    <div class="card"><h2>Last 7 days <span class="spacer"></span><button class="btn plain small" data-act="syncSteps">${icon('refresh', 'width="16" height="16"')} ${syncing ? 'Syncing…' : 'Sync'}</button></h2>
      ${barChart(week.map((k) => s.steps.daily[k] || 0), week.map((k) => weekdayShort(k)), { goal, highlight: 6, fmt: formatNum })}
      <p class="hint">Dashed line is your goal. Last synced ${synced}.</p></div>
    <div class="kv" style="margin-bottom:14px"><div><b>${formatNum(avg)}</b><span>30-day avg</span></div><div><b>${formatNum(best)}</b><span>best day</span></div>
      <div><b>${hit}</b><span>goal days</span></div><div><b>${streak}</b><span>streak</span></div></div>
    <details class="card"><summary style="font-weight:700">Steps showing 0?</summary>
      <p class="muted small" style="margin:8px 0 10px">Daily Hub only reads what Health Connect has. Open Health Connect and check that an app, for example Fitbit or Google Fit, is recording your steps, and that Daily Hub has permission.</p>
      <button class="btn plain small" data-act="hcSettings">Open Health Connect</button></details>`;
}

export async function autoSyncSteps(ctx, force = false) {
  const s = getState();
  if (!isNative() || !s.steps.connected || syncing) return;
  if (!force && s.steps.lastSync && Date.now() - s.steps.lastSync < 5 * 60 * 1000) return;
  syncing = true;
  try {
    const r = await syncSteps(30);
    update((st) => {
      Object.assign(st.steps.daily, r.steps);
      Object.assign(st.steps.distance, r.distance);
      Object.assign(st.steps.calories, r.calories);
      st.steps.lastSync = Date.now();
    });
  } catch (err) {
    console.error('[steps]', err);
    if (force) toast('Could not read steps. Please check Health Connect permission.');
  } finally {
    syncing = false;
    ctx?.render();
  }
}

// ---------- body weight ----------
function renderBody(s) {
  const list = [...s.gym.bodyWeight].sort((a, b) => a.date.localeCompare(b.date));
  const cur = list[list.length - 1];
  const monthAgo = list.filter((x) => x.date <= addDays(dateKey(), -30)).pop();
  const change = cur && monthAgo ? Math.round((cur.kg - monthAgo.kg) * 10) / 10 : null;
  const bmi = cur && s.profile.heightCm ? Math.round((cur.kg / (s.profile.heightCm / 100) ** 2) * 10) / 10 : null;
  return `<div class="card hero">
      <div class="muted small">Current weight</div>
      <div class="big-num">${cur ? `${cur.kg} kg` : '—'}</div>
      <div class="row" style="margin-top:8px;gap:8px">
        ${change !== null ? `<span class="badge">${change > 0 ? '▲' : change < 0 ? '▼' : '●'} ${Math.abs(change)} kg in 30 days</span>` : ''}
        ${bmi ? `<span class="badge">BMI ${bmi}</span>` : ''}</div>
      <button class="btn ghost" style="margin-top:14px" data-act="addWeight">+ Log weight</button></div>
    <div class="card"><h2>Trend</h2>${lineChart(list.slice(-30).map((x) => ({ v: x.kg, label: fmtDay(x.date) })), { fmt: (v) => `${v} kg` })}</div>
    ${list.length ? `<div class="card"><h2>Entries</h2><div class="list">${[...list].reverse().slice(0, 10).map((x) => swipeItem(x.date,
      `<span class="grow"><span class="title">${x.kg} kg</span><span class="meta">${fmtDay(x.date)}</span></span>`, { right: null })).join('')}</div>
      <p class="hint">Swipe left to delete</p></div>` : ''}`;
}

function openAddWeight() {
  const last = [...getState().gym.bodyWeight].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const sheet = openSheet({
    title: 'Log weight',
    html: `<input class="input amount-input" id="wt" inputmode="decimal" placeholder="kg" value="${last ? last.kg : ''}">
      <p class="hint" style="margin-bottom:14px">Saved for today. Logging again today replaces it.</p>
      <button class="btn block" data-save>Save</button>`,
  });
  const input = sheet.body.querySelector('#wt');
  setTimeout(() => { input.focus(); input.select(); }, 350);
  sheet.body.querySelector('[data-save]').onclick = () => {
    const kg = Math.round(Number(input.value) * 10) / 10;
    if (!(kg > 20 && kg < 400)) { toast('Please enter a weight in kg'); return; }
    const k = dateKey();
    update((s) => {
      s.gym.bodyWeight = s.gym.bodyWeight.filter((x) => x.date !== k);
      s.gym.bodyWeight.push({ date: k, kg });
      s.profile.weightKg = kg;
    });
    success();
    sheet.close();
  };
}

// ---------- actions ----------
export const actions = {
  sub(id, _, __, ctx) { sub = id; ctx.render(); },
  start: (id) => startWorkout(id),
  templates: () => openTemplates(),
  library: () => openLibrary('browse'),
  progress: () => openProgress(),
  exercise: (name) => openExercise(name),
  session: (id) => openSession(id),
  tick(id) {
    const [i, j] = id.split(':').map(Number);
    const s = getState();
    const ex = s.gym.active.exercises[i];
    const set = ex.sets[j];
    const nowDone = !set.done;
    const pr = nowDone && isSetPr(s.gym.sessions, ex, set);
    update((st) => {
      const x = st.gym.active.exercises[i].sets[j];
      x.done = nowDone;
      x.pr = pr;
    });
    if (!nowDone) return;
    success();
    if (pr) {
      const label = ex.type === 'time' ? `${set.sec}s hold` : ex.type === 'reps' ? `${set.reps} reps` : `${set.kg} kg × ${set.reps}`;
      prBurst(ex.name, label);
    }
    startRest(getState().settings.restSeconds);
  },
  addSet(i) {
    update((s) => {
      const sets = s.gym.active.exercises[i].sets;
      const last = sets[sets.length - 1] || {};
      sets.push({ kg: last.kg ?? null, reps: last.reps ?? null, sec: last.sec ?? null, done: false });
    });
  },
  removeSet(i) { update((s) => { s.gym.active.exercises[i].sets.pop(); }); },
  async removeEx(i) {
    const name = getState().gym.active.exercises[i].name;
    if (await confirmSheet({ title: `Remove ${name}?`, message: 'Its sets in this workout will be removed.', confirm: 'Remove' })) {
      update((s) => { s.gym.active.exercises.splice(Number(i), 1); });
    }
  },
  addEx: () => openLibrary('add'),
  finish: () => finishWorkout(),
  async discard() {
    if (await confirmSheet({ title: 'Discard workout?', message: 'Everything logged in this workout will be lost.', confirm: 'Discard' })) {
      update((s) => { s.gym.active = null; });
      cancelTimer('rest');
      rest.endAt = 0;
    }
  },
  restAdd(_, __, ___, ctx) {
    rest.endAt += 30000;
    scheduleTimer('rest', new Date(rest.endAt), '⏱️ Rest over', 'Time for your next set. 💪');
    ctx.render();
  },
  restSkip(_, __, ___, ctx) { rest.endAt = 0; cancelTimer('rest'); ctx.render(); },
  async connect(_, __, ___, ctx) {
    health = await healthStatus();
    if (!health.available) { ctx.render(); return; }
    try {
      const st = await connectHealth();
      if (!st.readAuthorized?.includes('steps')) {
        toast('Steps permission was not given. You can allow it in Health Connect.');
        return;
      }
      update((s) => { s.steps.connected = true; });
      success();
      autoSyncSteps(ctx, true);
    } catch (err) {
      toast('Could not connect: ' + (err.message || err));
    }
  },
  syncSteps: (_, __, ___, ctx) => autoSyncSteps(ctx, true),
  hcSettings: () => openHealthSettings(),
  addWeight: () => openAddWeight(),
};

export const swipe = {
  left(date) {
    const s = getState();
    const copy = s.gym.bodyWeight.find((x) => x.date === date);
    if (!copy) return;
    update((st) => { st.gym.bodyWeight = st.gym.bodyWeight.filter((x) => x.date !== date); });
    toast('Entry deleted', { action: 'Undo', onAction: () => update((st) => { st.gym.bodyWeight.push(copy); }) });
  },
};

export function fab() {
  if (sub === 'gym' && getState().gym.active) return () => openLibrary('add');
  if (sub === 'gym') return () => startWorkout('');
  if (sub === 'body') return () => openAddWeight();
  return null;
}
