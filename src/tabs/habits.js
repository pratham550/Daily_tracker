import { update, getState, uid } from '../store.js';
import { dateKey, addDays, weekdayShort, startOfWeek } from '../lib/dates.js';
import { formatRs } from '../lib/format.js';
import { currentStreak, bestStreak, habitDoneSet, lastNDays, smokeByDay, smokeWeekAvg, smokeLimitFor } from '../lib/stats.js';
import { syncReminders } from '../lib/reminders.js';
import { success, thud } from '../lib/platform.js';
import { esc, icon, ring, barChart, heatmap, openSheet, confirmSheet, toast, confetti, EMOJIS } from '../ui.js';

let sinceTimer = null;

// ---------- smoking card (also shown small on Home) ----------
function sinceText(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

export function smokeCard(s, compact = false) {
  const today = dateKey();
  const byDay = smokeByDay(s.smoke.log);
  const n = byDay[today] || 0;
  const limit = smokeLimitFor(s.smoke, today);
  const last = s.smoke.log.length ? s.smoke.log[s.smoke.log.length - 1] : null;
  const since = last ? `<span id="smoke-since">${sinceText(Date.now() - last)}</span> since the last one` : 'No cigarettes logged yet';

  if (compact) {
    return `<div class="card"><div class="row">
      <span class="emoji" style="font-size:22px;width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:var(--surface-2)">🚬</span>
      <div class="grow" style="flex:1;min-width:0"><b>${n}${limit != null ? ` / ${limit}` : ''} today</b><div class="muted small">${since}</div></div>
      <button class="btn small" data-act="smoke" aria-label="Log one cigarette">+1</button></div></div>`;
  }

  const week = lastNDays(7, today);
  const avg = smokeWeekAvg(byDay, today);
  const prevAvg = smokeWeekAvg(byDay, addDays(today, -7));
  const diff = Math.round((avg - prevAvg) * 10) / 10;
  const weekCount = week.reduce((a, k) => a + (byDay[k] || 0), 0);
  const over = limit != null && n > limit;
  return `<div class="card">
    <h2>🚬 Smoking <span class="spacer"></span><button class="btn plain small" data-act="smokeSettings" aria-label="Smoking settings">${icon('gear', 'width="16" height="16"')}</button></h2>
    <div class="row" style="gap:16px">
      ${ring('smoke', limit ? n / limit : 0, { size: 96, stroke: 10, inner: `<div><div class="mid-num">${n}</div><div class="muted small">${limit != null ? `of ${limit}` : 'today'}</div></div>` })}
      <div style="flex:1;min-width:0">
        <div class="small muted">${since}</div>
        ${over ? '<div class="small" style="margin-top:4px">Over today\'s limit. Tomorrow is a fresh start.</div>' : ''}
        <div class="row" style="margin-top:10px;gap:8px">
          <button class="btn" style="flex:1" data-act="smoke">+1 cigarette</button>
          ${n ? '<button class="btn plain small" data-act="smokeUndo" aria-label="Undo last">↺</button>' : ''}</div>
      </div></div>
    ${barChart(week.map((k) => byDay[k] || 0), week.map((k) => weekdayShort(k)), { height: 90, goal: limit, goalIsMax: true, highlight: 6 })}
    <div class="row wrap" style="gap:6px;margin-top:6px">
      <span class="badge">${avg}/day this week</span>
      ${prevAvg ? `<span class="badge ${diff < 0 ? 'good' : diff > 0 ? 'warn' : ''}">${diff < 0 ? '▼' : diff > 0 ? '▲' : '●'} ${Math.abs(diff)} vs last week</span>` : ''}
      ${s.smoke.price ? `<span class="badge">${formatRs(Math.round(weekCount * s.smoke.price))} this week</span>` : ''}
    </div></div>`;
}

export function logCigarette() {
  update((s) => { s.smoke.log.push(Date.now()); });
  thud();
  const s = getState();
  const n = smokeByDay(s.smoke.log)[dateKey()] || 0;
  const limit = smokeLimitFor(s.smoke);
  toast(limit != null && n === limit ? `That's ${n} of ${limit} for today` : `Logged · ${n} today`, {
    action: 'Undo', onAction: () => update((st) => { st.smoke.log.pop(); }), ms: 3000,
  });
}

function openSmokeSettings() {
  const sm = getState().smoke;
  const sheet = openSheet({
    title: 'Smoking tracker',
    html: `<p class="muted small" style="margin-top:0">Set a daily limit that feels doable. Cutting down slowly works better for many people than a sudden stop.</p>
      <div class="row" style="gap:10px">
        <label class="field" style="flex:1"><span>Daily limit</span><input class="input" id="sm-limit" inputmode="numeric" value="${sm.limit ?? ''}" placeholder="e.g. 8"></label>
        <label class="field" style="flex:1"><span>Price per cigarette (Rs)</span><input class="input" id="sm-price" inputmode="decimal" value="${sm.price ?? ''}" placeholder="e.g. 18"></label></div>
      <label class="row card tight" style="margin-bottom:14px"><span class="grow" style="flex:1"><b>Reduce by 1 every week</b>
        <div class="muted small">Your limit goes down by one each week from today.</div></span>
        <span class="toggle"><input type="checkbox" id="sm-step" ${sm.stepDown ? 'checked' : ''}><i></i></span></label>
      <button class="btn block" data-save>Save</button>
      <p class="hint" style="margin-top:16px">Want support? National Tobacco Quitline (free, Govt. of India):
        <a href="tel:1800112356" style="color:var(--accent-text);font-weight:700">1800-11-2356</a></p>`,
  });
  sheet.body.querySelector('[data-save]').onclick = () => {
    const limit = sheet.body.querySelector('#sm-limit').value.trim();
    const price = sheet.body.querySelector('#sm-price').value.trim();
    const stepDown = sheet.body.querySelector('#sm-step').checked;
    update((s) => {
      s.smoke.limit = limit === '' ? null : Math.max(0, Math.round(Number(limit)) || 0);
      s.smoke.price = price === '' ? null : Math.max(0, Number(price) || 0);
      if (stepDown && !s.smoke.stepDown) s.smoke.planStart = dateKey();
      s.smoke.stepDown = stepDown;
    });
    sheet.close();
    toast('Saved');
  };
}

// ---------- habits ----------
export function render(s) {
  const today = dateKey();
  const done = s.habits.filter((h) => h.log[today]).length;
  const last7 = lastNDays(7, today);
  const list = s.habits.map((h) => {
    const set = habitDoneSet(h);
    const streak = currentStreak(set, today);
    return `<div class="item" style="background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow);min-height:72px">
      <button class="check big ${h.log[today] ? 'on' : ''}" data-act="toggle" data-id="${h.id}" aria-label="Done today">${icon('check')}</button>
      <button class="grow" style="text-align:left;min-width:0" data-act="open" data-id="${h.id}">
        <span class="title">${h.emoji} ${esc(h.name)}</span>
        <span class="row" style="gap:4px;margin-top:6px" title="Last 7 days">${last7.map((k) => {
          return `<i style="width:9px;height:9px;border-radius:3px;background:${set.has(k) ? 'var(--accent)' : 'var(--track)'};${k === today ? 'outline:1.5px solid var(--accent-2);outline-offset:1px' : ''}"></i>`;
        }).join('')}</span></button>
      <span class="badge ${streak >= 7 ? 'good' : ''}" title="Current streak">🔥 ${streak}</span></div>`;
  }).join('');

  return `<header class="top"><div class="grow"><h1>Habits ✅</h1><div class="sub">Small steps, every day</div></div></header>
    ${s.habits.length ? `<div class="card hero"><div class="row" style="gap:16px">
      ${ring('habits-today', s.habits.length ? done / s.habits.length : 0, { size: 84, stroke: 9, inner: `<b>${done}/${s.habits.length}</b>` })}
      <div><div class="mid-num">${done === s.habits.length ? 'All done! 🎉' : `${s.habits.length - done} to go today`}</div>
      <div class="muted small">Tap a circle to tick. Tap a habit for its history.</div></div></div></div>` : ''}
    ${s.settings.features.smoking ? smokeCard(s) : ''}
    <div class="list" style="gap:10px;margin-bottom:14px">${list || '<div class="card empty"><span class="big">🌱</span>Add your first habit with the + button.</div>'}</div>`;
}

export function mounted() {
  clearInterval(sinceTimer);
  sinceTimer = setInterval(() => {
    const el = document.getElementById('smoke-since');
    const log = getState().smoke.log;
    if (el && log.length) el.textContent = sinceText(Date.now() - log[log.length - 1]);
  }, 30000);
}

export function unmounted() {
  clearInterval(sinceTimer);
}

export function toggleHabit(id) {
  const k = dateKey();
  let all = false;
  update((s) => {
    const h = s.habits.find((x) => x.id === id);
    if (h.log[k]) delete h.log[k]; else h.log[k] = true;
    all = s.habits.every((x) => x.log[k]);
  });
  success();
  if (all) { confetti(); toast('All habits done today. Superb! 🔥'); }
}

function openHabit(id) {
  const h = getState().habits.find((x) => x.id === id);
  if (!h) return;
  const set = habitDoneSet(h);
  const today = dateKey();
  const start = addDays(startOfWeek(today), -7 * 11);
  const cells = Array.from({ length: 84 }, (_, i) => {
    const k = addDays(start, i);
    return { level: set.has(k) ? 3 : 0, today: k === today, future: k > today };
  });
  const last30 = lastNDays(30, today).filter((k) => set.has(k)).length;
  const sheet = openSheet({
    title: `${h.emoji} ${h.name}`,
    html: `<div class="kv" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
        <div><b>🔥 ${currentStreak(set, today)}</b><span>current streak</span></div>
        <div><b>${bestStreak(set)}</b><span>best streak</span></div>
        <div><b>${Math.round((last30 / 30) * 100)}%</b><span>last 30 days</span></div></div>
      <div class="card"><h2>Last 12 weeks</h2>${heatmap(cells)}</div>
      <div class="row"><button class="btn danger" data-del>Delete</button><button class="btn plain" style="flex:1" data-edit>Edit</button></div>`,
  });
  sheet.body.querySelector('[data-edit]').onclick = () => { sheet.close(); openHabitEditor(h); };
  sheet.body.querySelector('[data-del]').onclick = async () => {
    if (!(await confirmSheet({ title: 'Delete habit?', message: `${h.name} and its history will be removed.` }))) return;
    update((s) => { s.habits = s.habits.filter((x) => x.id !== id); });
    sheet.close();
  };
}

function openHabitEditor(habit = null) {
  const st = { emoji: habit?.emoji || EMOJIS[0] };
  const sheet = openSheet({
    title: habit ? 'Edit habit' : 'New habit',
    html: `<label class="field"><span>Habit</span><input class="input" id="h-name" value="${esc(habit?.name || '')}" placeholder="e.g. Drink 3 L water, Meditate 10 min"></label>
      <span class="muted small" style="display:block;margin:0 0 8px 4px;font-weight:600">Icon</span>
      <div class="emoji-grid" style="margin-bottom:16px">${EMOJIS.map((e) => `<button class="${e === st.emoji ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>
      <button class="btn block" data-save>${habit ? 'Save' : 'Add habit'}</button>`,
  });
  const name = sheet.body.querySelector('#h-name');
  if (!habit) setTimeout(() => name.focus(), 350);
  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-e]');
    if (b) {
      st.emoji = b.dataset.e;
      sheet.body.querySelectorAll('[data-e]').forEach((x) => x.classList.toggle('on', x === b));
      return;
    }
    if (!e.target.closest('[data-save]')) return;
    const n = name.value.trim();
    if (!n) { toast('Please name your habit'); return; }
    update((s) => {
      if (habit) Object.assign(s.habits.find((x) => x.id === habit.id), { name: n, emoji: st.emoji });
      else s.habits.push({ id: uid(), name: n, emoji: st.emoji, log: {}, createdAt: Date.now() });
    });
    syncReminders(getState());
    success();
    sheet.close();
  });
}

export const actions = {
  toggle: (id) => toggleHabit(id),
  open: (id) => openHabit(id),
  smoke: () => logCigarette(),
  smokeUndo() {
    update((s) => { s.smoke.log.pop(); });
    toast('Removed the last one');
  },
  smokeSettings: () => openSmokeSettings(),
};

export function fab() {
  return () => openHabitEditor();
}
