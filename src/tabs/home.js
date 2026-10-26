import { update, getState, uid } from '../store.js';
import { dateKey, fmtLongDate, greeting, monthKey, startOfWeek, addDays, weekdayShort } from '../lib/dates.js';
import { formatClock, formatRsShort } from '../lib/format.js';
import { monthSummary, daySpend, sessionsThisWeek, gymDays } from '../lib/stats.js';
import { calcTargets, dayEntries, sumNutrition } from '../lib/diet.js';
import { describeWeather } from '../lib/weather.js';
import { scheduleTimer, cancelTimer } from '../lib/reminders.js';
import { success } from '../lib/platform.js';
import { esc, icon, ring, bar, count, swipeItem, openSheet, toast, confetti } from '../ui.js';
import { openAddExpense } from './money.js';
import { openAddFood, addWater } from './diet.js';
import { smokeCard, logCigarette, toggleHabit } from './habits.js';

let showDone = false;

// ---------- focus timer (kept in memory; the end is also a scheduled notification) ----------
const focus = { mode: 'focus', running: false, endAt: 0, left: null, tick: null };

function focusLength(s) {
  return (focus.mode === 'focus' ? s.settings.focusMinutes : s.settings.breakMinutes) * 60;
}

function focusLeft(s) {
  if (focus.running) return Math.max(0, Math.round((focus.endAt - Date.now()) / 1000));
  return focus.left ?? focusLength(s);
}

function startTicker() {
  clearInterval(focus.tick);
  focus.tick = setInterval(() => {
    const s = getState();
    const left = focusLeft(s);
    const el = document.getElementById('focus-time');
    if (el) el.textContent = formatClock(left);
    const r = document.querySelector('[data-ring="focus"]');
    if (r) {
      const c = Number(r.getAttribute('stroke-dasharray'));
      r.style.strokeDashoffset = c * (left / focusLength(s));
    }
    if (left <= 0) finishFocus();
  }, 1000);
}

function finishFocus() {
  clearInterval(focus.tick);
  focus.running = false;
  focus.left = null;
  const wasFocus = focus.mode === 'focus';
  if (wasFocus) {
    update((s) => { const k = dateKey(); s.focusLog[k] = (s.focusLog[k] || 0) + 1; });
    success();
    confetti();
    toast('Focus session done. Take a short break 🙌');
  } else {
    toast('Break over. Ready for the next one?');
  }
  focus.mode = wasFocus ? 'break' : 'focus';
  update(() => {});
}

// ---------- render ----------
export function render(s) {
  const today = dateKey();
  const f = s.settings.features;
  const name = s.profile.name ? `, <span class="nowrap">${esc(s.profile.name.split(' ')[0])} 👋</span>` : ' 👋';
  const w = s.weather;
  const wd = w ? describeWeather(w.code) : null;
  const weather = !f.weather ? '' : s.profile.city
    ? (w ? `<button class="weather-chip" data-act="weather">${wd.icon} ${w.temp}° ${esc(s.profile.city.name)}
        <span class="muted small">H ${w.max}° · L ${w.min}° · ${w.rain ?? 0}% rain</span></button>`
      : `<button class="weather-chip" data-act="weather">⏳ Loading weather for ${esc(s.profile.city.name)}</button>`)
    : '<button class="weather-chip" data-act="settings">📍 Add your city for weather</button>';

  // tiles
  const steps = s.steps.daily[today] || 0;
  const stepPct = steps / s.settings.stepGoal;
  const targets = calcTargets(s.profile);
  const eaten = sumNutrition(dayEntries(s.diet.log, today));
  const spentToday = daySpend(s.expenses, today);
  const month = monthSummary(s.expenses, monthKey(today));
  const gymWeek = sessionsThisWeek(s.gym.sessions, today);
  const gymSet = gymDays(s.gym.sessions);
  const wk = startOfWeek(today);

  const tiles = `<div class="grid2">
    <button class="card tile pressable" data-act="go" data-id="fitness:steps">
      <span class="label">👟 Steps</span>
      <div class="row">${ring('home-steps', stepPct, { size: 54, stroke: 7 })}
        <div><div class="val">${count('home-steps', steps)}</div><div class="muted small">of ${s.settings.stepGoal.toLocaleString('en-IN')}</div></div></div>
    </button>
    <button class="card tile pressable" data-act="go" data-id="diet">
      <span class="label">🥗 Calories</span>
      <div class="val">${count('home-kcal', eaten.kcal)}<span class="muted small"> / ${targets ? targets.kcal : '—'}</span></div>
      <div class="muted small">${eaten.p} g protein${targets ? ` of ${targets.protein}` : ''}</div>
      ${bar(targets ? eaten.kcal / targets.kcal : 0, targets && eaten.kcal > targets.kcal * 1.05)}
    </button>
    ${f.money ? `<button class="card tile pressable" data-act="go" data-id="money">
      <span class="label">💸 Spent today</span>
      <div class="val">${count('home-spent', spentToday, 'rs')}</div>
      <div class="muted small">${formatRsShort(month.total)} this month</div>
      ${bar(month.total / s.settings.budget, month.total > s.settings.budget)}
    </button>` : ''}
    <button class="card tile pressable" data-act="go" data-id="fitness:gym">
      <span class="label">🏋️ Gym this week</span>
      <div class="val">${gymWeek}<span class="muted small"> / ${s.settings.gymWeeklyTarget} days</span></div>
      <div class="row" style="gap:4px;margin-top:auto">${[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const k = addDays(wk, i);
        return `<span title="${weekdayShort(k)}" style="flex:1;height:8px;border-radius:9px;background:${gymSet.has(k) ? 'linear-gradient(90deg,var(--accent),var(--accent-2))' : 'var(--track)'};${k === today ? 'outline:1.5px solid var(--accent);outline-offset:1px' : ''}"></span>`;
      }).join('')}</div>
    </button>
  </div>`;

  // habits
  const doneHabits = s.habits.filter((h) => h.log[today]).length;
  const habitsCard = s.habits.length ? `<div class="card">
    <h2>✅ Habits today <span class="spacer"></span><span class="badge ${doneHabits === s.habits.length ? 'good' : ''}">${doneHabits}/${s.habits.length}</span></h2>
    <div class="chips wrap">${s.habits.map((h) => `<button class="chip ${h.log[today] ? 'on' : ''}" data-act="habit" data-id="${h.id}">${h.emoji} ${esc(h.name)}</button>`).join('')}</div>
  </div>` : '';

  // todos
  const open = s.todos.filter((t) => !t.done);
  const done = s.todos.filter((t) => t.done);
  const todoItem = (t) => swipeItem(t.id, `
      <button class="check ${t.done ? 'on' : ''}" data-act="todo" data-id="${t.id}" aria-label="Done">${icon('check')}</button>
      <span class="grow"><span class="title wrap">${esc(t.text)}</span></span>`, { cls: t.done ? 'done' : '', right: t.done ? '↺ Undo' : '✓ Done' });
  const todos = `<div class="card">
    <h2>📝 To-do <span class="spacer"></span>${open.length ? `<span class="badge">${open.length} left</span>` : ''}</h2>
    <div class="inline-add" style="margin-bottom:12px">
      <input class="input" id="todo-in" placeholder="Add a task and press Enter" data-enter="addTodo" enterkeyhint="done">
      <button class="btn" data-act="addTodo" aria-label="Add task">+</button></div>
    <div class="list">${open.map(todoItem).join('') || '<div class="empty"><span class="big">🎉</span>Nothing pending. Enjoy your day!</div>'}</div>
    ${done.length ? `<div class="row" style="margin-top:12px">
      <button class="btn plain small" data-act="toggleDone">${showDone ? 'Hide' : 'Show'} done (${done.length})</button>
      <span class="spacer" style="flex:1"></span>
      <button class="btn plain small" data-act="clearDone">Clear done</button></div>
      ${showDone ? `<div class="list" style="margin-top:10px">${done.map(todoItem).join('')}</div>` : ''}` : ''}
    ${open.length ? '<p class="hint">Swipe right to finish, left to delete</p>' : ''}
  </div>`;

  // focus
  const left = focusLeft(s);
  const sessions = s.focusLog[today] || 0;
  const focusCard = `<div class="card">
    <h2>🎯 Focus timer <span class="spacer"></span><span class="badge">${sessions} today</span></h2>
    <div class="row" style="gap:18px">
      ${ring('focus', left / focusLength(s), { size: 120, stroke: 10, inner: `<div><div class="mid-num" id="focus-time">${formatClock(left)}</div><div class="muted small">${focus.mode === 'focus' ? 'Focus' : 'Break'}</div></div>` })}
      <div class="grow stack" style="flex:1">
        <div class="seg" style="margin:0">
          <button class="${focus.mode === 'focus' ? 'on' : ''}" data-act="focusMode" data-id="focus">${s.settings.focusMinutes}m</button>
          <button class="${focus.mode === 'break' ? 'on' : ''}" data-act="focusMode" data-id="break">${s.settings.breakMinutes}m break</button></div>
        <div class="row">
          <button class="btn" style="flex:1" data-act="focusToggle">${icon(focus.running ? 'pause' : 'play', 'width="20" height="20"')} ${focus.running ? 'Pause' : 'Start'}</button>
          <button class="btn plain" data-act="focusReset" aria-label="Reset">${icon('reset', 'width="20" height="20"')}</button></div>
      </div>
    </div>
  </div>`;

  // notes
  const notes = `<div class="card">
    <h2>🗒️ Notes <span class="spacer"></span><button class="btn ghost small" data-act="newNote">+ New</button></h2>
    ${s.notes.length ? `<div class="list">${[...s.notes].sort((a, b) => b.updatedAt - a.updatedAt).map((n) => `
      <button class="item pressable" style="text-align:left;align-items:flex-start" data-act="editNote" data-id="${n.id}">
        <span class="grow note-card">${esc(n.text)}</span></button>`).join('')}</div>`
      : '<div class="empty small">Jot down ideas, shopping lists, anything.</div>'}
  </div>`;

  return `<header class="top"><div class="grow"><h1>${greeting()}${name}</h1><div class="sub">${fmtLongDate()}</div></div>
      <button class="icon-btn" data-act="settings" aria-label="Settings">${icon('gear')}</button></header>
    ${weather ? `<div class="row wrap" style="margin:-4px 0 14px">${weather}</div>` : ''}
    ${tiles}${f.smoking ? smokeCard(s, true) : ''}${habitsCard}${todos}${f.focus ? focusCard : ''}${f.notes ? notes : ''}`;
}

export function mounted() {
  if (focus.running) startTicker();
}

export function unmounted() {
  clearInterval(focus.tick);
}

function openNote(note) {
  const sheet = openSheet({
    title: note ? 'Edit note' : 'New note',
    html: `<textarea class="input" id="note-text" placeholder="Write anything…" style="min-height:220px">${esc(note?.text || '')}</textarea>
      <div class="row" style="margin-top:12px">
        ${note ? '<button class="btn danger" data-del>Delete</button>' : ''}
        <button class="btn" style="flex:1" data-save>Save</button></div>`,
  });
  const ta = sheet.body.querySelector('#note-text');
  setTimeout(() => ta.focus(), 350);
  sheet.body.querySelector('[data-save]').onclick = () => {
    const text = ta.value.trim();
    if (!text) { sheet.close(); return; }
    update((s) => {
      if (note) Object.assign(s.notes.find((n) => n.id === note.id), { text, updatedAt: Date.now() });
      else s.notes.push({ id: uid(), text, updatedAt: Date.now() });
    });
    sheet.close();
  };
  sheet.body.querySelector('[data-del]')?.addEventListener('click', () => {
    const copy = { ...note };
    update((s) => { s.notes = s.notes.filter((n) => n.id !== note.id); });
    sheet.close();
    toast('Note deleted', { action: 'Undo', onAction: () => update((s) => { s.notes.push(copy); }) });
  });
}

function toggleTodo(id) {
  let finished = false;
  update((s) => {
    const t = s.todos.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
    finished = t.done && !s.todos.some((x) => !x.done);
  });
  success();
  if (finished) confetti();
}

function deleteTodo(id) {
  const s = getState();
  const idx = s.todos.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const copy = s.todos[idx];
  update((st) => { st.todos.splice(idx, 1); });
  toast('Task deleted', { action: 'Undo', onAction: () => update((st) => { st.todos.splice(idx, 0, copy); }) });
}

export const actions = {
  settings: (_, __, ___, ctx) => ctx.openSettings(),
  go(id, _, __, ctx) {
    const [tab, sub] = id.split(':');
    ctx.go(tab, { sub });
  },
  weather(_, __, ___, ctx) {
    toast('Refreshing weather…', { ms: 1500 });
    ctx.refreshWeather(true);
  },
  habit: (id) => toggleHabit(id),
  smoke: () => logCigarette(),
  addTodo() {
    const el = document.getElementById('todo-in');
    const text = el.value.trim();
    if (!text) return;
    update((s) => { s.todos.unshift({ id: uid(), text, done: false, createdAt: Date.now() }); });
    requestAnimationFrame(() => document.getElementById('todo-in')?.focus());
  },
  todo: (id) => toggleTodo(id),
  toggleDone(_, __, ___, ctx) { showDone = !showDone; ctx.render(); },
  clearDone() {
    const copy = getState().todos.filter((t) => t.done);
    update((s) => { s.todos = s.todos.filter((t) => !t.done); });
    toast(`Cleared ${copy.length} done task${copy.length > 1 ? 's' : ''}`, { action: 'Undo', onAction: () => update((s) => { s.todos.push(...copy); }) });
  },
  focusMode(mode, _, __, ctx) {
    if (focus.running) { toast('Pause the timer first'); return; }
    focus.mode = mode;
    focus.left = null;
    ctx.render();
  },
  focusToggle(_, __, ___, ctx) {
    const s = getState();
    if (focus.running) {
      focus.left = focusLeft(s);
      focus.running = false;
      clearInterval(focus.tick);
      cancelTimer('focus');
    } else {
      const left = focus.left ?? focusLength(s);
      focus.endAt = Date.now() + left * 1000;
      focus.running = true;
      startTicker();
      scheduleTimer('focus', new Date(focus.endAt),
        focus.mode === 'focus' ? '🎯 Focus session done' : '☕ Break over',
        focus.mode === 'focus' ? 'Great work. Time for a short break.' : 'Ready for the next focus session?');
    }
    ctx.render();
  },
  focusReset(_, __, ___, ctx) {
    focus.running = false;
    focus.left = null;
    clearInterval(focus.tick);
    cancelTimer('focus');
    ctx.render();
  },
  newNote: () => openNote(null),
  editNote: (id) => openNote(getState().notes.find((n) => n.id === id)),
};

export const swipe = {
  right: (id) => toggleTodo(id),
  left: (id) => deleteTodo(id),
};

export function fab(ctx) {
  return () => {
    const f = getState().settings.features;
    const sheet = openSheet({
      title: 'Quick add',
      html: `<div class="grid2" style="margin:0">
        ${[['task', '📝', 'Task'], f.money && ['expense', '💸', 'Expense'], ['food', '🥗', 'Food'], ['water', '💧', 'Glass of water'],
          ['workout', '🏋️', 'Start workout'], f.notes && ['note', '🗒️', 'Note'], f.smoking && ['smoke', '🚬', 'Cigarette +1']].filter(Boolean).map(([id, e, n]) => `
          <button class="card tile pressable" style="margin:0;align-items:center;text-align:center" data-q="${id}">
            <span style="font-size:30px">${e}</span><b>${n}</b></button>`).join('')}</div>`,
    });
    sheet.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-q]');
      if (!b) return;
      sheet.close();
      const q = b.dataset.q;
      if (q === 'task') setTimeout(() => document.getElementById('todo-in')?.focus(), 300);
      if (q === 'expense') openAddExpense();
      if (q === 'food') openAddFood();
      if (q === 'water') addWater(1);
      if (q === 'workout') ctx.go('fitness', { sub: 'gym' });
      if (q === 'note') openNote(null);
      if (q === 'smoke') logCigarette();
    });
  };
}
