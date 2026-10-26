import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { update, getState, replaceState } from '../store.js';
import { THEMES, MODES, applyTheme } from '../themes.js';
import { makeBackup, parseBackup, backupFileName } from '../lib/backup.js';
import { searchCity } from '../lib/weather.js';
import {
  syncReminders, ensurePermission, exactAlarmStatus, openExactAlarmSettings, testNotification,
} from '../lib/reminders.js';
import { isNative, success } from '../lib/platform.js';
import { fmtDay, dateKey } from '../lib/dates.js';
import { esc, openSheet, confirmSheet, toast } from '../ui.js';
import { openGoalSheet } from './diet.js';

const FEATURES = [
  ['money', '💰 Money tracker', 'Spends, budget and bill reminders'],
  ['smoking', '🚬 Smoking tracker', 'Count cigarettes and cut down slowly'],
  ['focus', '🎯 Focus timer', 'Pomodoro timer on Home'],
  ['notes', '🗒️ Notes', 'Quick notes on Home'],
  ['weather', '🌤️ Weather', 'Weather for your city on Home'],
];

const toggle = (path, on) => `<span class="toggle"><input type="checkbox" data-path="${path}" ${on ? 'checked' : ''}><i></i></span>`;
const num = (path, val, suffix = '') => `<input class="input" style="width:110px;min-height:42px;text-align:center" inputmode="numeric" data-path="${path}" data-num value="${val ?? ''}">${suffix}`;
const time = (path, val) => `<input class="input" type="time" style="width:120px;min-height:42px" data-path="${path}" value="${val}">`;
const row = (title, sub, control) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--border)">
  <div style="flex:1;min-width:0"><b>${title}</b>${sub ? `<div class="muted small">${sub}</div>` : ''}</div>${control}</div>`;

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
}

function body(s, exact) {
  const r = s.settings.reminders;
  const f = s.settings.features;
  return `
  <div class="section-title" style="margin-top:4px">You</div>
  <div class="card">
    <label class="field"><span>Name</span><input class="input" data-path="profile.name" value="${esc(s.profile.name)}"></label>
    ${f.weather ? `<span class="muted small" style="display:block;margin:0 0 6px 4px;font-weight:600">City for weather</span>
    <div class="inline-add"><input class="input" id="city-q" placeholder="${esc(s.profile.city?.name || 'Search city')}"><button class="btn" data-city aria-label="Search">🔍</button></div>
    <div class="list" id="city-res" style="margin-top:8px"></div>` : ''}
    <button class="btn plain block" style="margin-top:12px" data-goal>🎯 Body and diet goal</button>
  </div>

  <div class="section-title">Look</div>
  <div class="card">
    <div class="swatches" style="margin-bottom:14px">${THEMES.map((t) => `
      <button class="swatch ${s.settings.theme === t.id ? 'on' : ''}" data-theme="${t.id}">
        <div class="blob" style="background:linear-gradient(135deg,${t.a},${t.b})"></div>${t.name}</button>`).join('')}</div>
    <div class="seg" style="margin:0">${MODES.map((m) => `<button class="${s.settings.mode === m.id ? 'on' : ''}" data-mode="${m.id}">${m.icon} ${m.name}</button>`).join('')}</div>
  </div>

  <div class="section-title">Goals</div>
  <div class="card" style="padding-top:6px;padding-bottom:6px">
    ${row('Daily steps', '', num('settings.stepGoal', s.settings.stepGoal))}
    ${row('Gym days a week', '', num('settings.gymWeeklyTarget', s.settings.gymWeeklyTarget))}
    ${f.money ? row('Monthly budget', 'In Rs', num('settings.budget', s.settings.budget)) : ''}
    ${row('Rest between sets', 'Seconds', num('settings.restSeconds', s.settings.restSeconds))}
    ${f.focus ? row('Focus / break', 'Minutes', `<div class="row" style="gap:6px">${num('settings.focusMinutes', s.settings.focusMinutes)}${num('settings.breakMinutes', s.settings.breakMinutes)}</div>`) : ''}
    ${row('Glass size', 'ml, for water tracking', num('settings.waterGlassMl', s.settings.waterGlassMl))}
  </div>

  <div class="section-title">Features</div>
  <div class="card" style="padding-top:6px;padding-bottom:6px">
    ${FEATURES.map(([k, t, d]) => row(t, d, toggle(`settings.features.${k}`, f[k]))).join('')}
    ${row('📳 Vibration on tap', '', toggle('settings.haptics', s.settings.haptics))}
  </div>

  <div class="section-title">Reminders</div>
  <div class="card" style="padding-top:6px;padding-bottom:6px">
    ${row('💧 Drink water', `Every ${r.water.everyHours} h, ${r.water.start}:00 to ${r.water.end}:00`, toggle('settings.reminders.water.on', r.water.on))}
    ${r.water.on ? row('Every (hours)', '', `<div class="row" style="gap:6px">${num('settings.reminders.water.everyHours', r.water.everyHours)}</div>`)
      + row('Window', 'From / to hour (24 h)', `<div class="row" style="gap:6px">${num('settings.reminders.water.start', r.water.start)}${num('settings.reminders.water.end', r.water.end)}</div>`) : ''}
    ${row('✅ Habit check-in', '', `<div class="row" style="gap:8px">${r.habits.on ? time('settings.reminders.habits.time', r.habits.time) : ''}${toggle('settings.reminders.habits.on', r.habits.on)}</div>`)}
    ${row('🏋️ Gym time', '', `<div class="row" style="gap:8px">${r.gym.on ? time('settings.reminders.gym.time', r.gym.time) : ''}${toggle('settings.reminders.gym.on', r.gym.on)}</div>`)}
    ${row('🥗 Log meals', '', `<div class="row" style="gap:8px">${r.diet.on ? time('settings.reminders.diet.time', r.diet.time) : ''}${toggle('settings.reminders.diet.on', r.diet.on)}</div>`)}
    ${f.money ? row('💡 Bills due', '9 am on the due day', toggle('settings.reminders.bills.on', r.bills.on)) : ''}
    ${isNative() ? `<div class="row" style="gap:8px;margin:12px 0 6px">
      <button class="btn plain small" style="flex:1" data-test>🔔 Test (in 1 min)</button>
      ${exact !== 'granted' ? '<button class="btn ghost small" style="flex:1" data-exact>⏰ Allow exact timing</button>' : ''}</div>
      ${exact !== 'granted' ? '<p class="hint">Without exact timing, Android may deliver reminders a few minutes late.</p>' : ''}` : ''}
  </div>

  <div class="section-title">Backup</div>
  <div class="card">
    ${isNative() ? row('🗂️ Daily auto backup', `Saved to Documents/DailyHub on this phone (last 7 kept). These files stay even if you uninstall the app.${s.settings.lastAutoBackupDay ? ` Last: ${fmtDay(s.settings.lastAutoBackupDay)}.` : ''}`, toggle('settings.autoBackup', s.settings.autoBackup)) : ''}
    <p class="muted small" style="margin:12px 0">To be safe even if the phone is lost, also save a backup to Google Drive now and then.
      ${s.settings.lastBackupAt ? `<br>Last saved backup: <b>${fmtDay(dateKey(new Date(s.settings.lastBackupAt)))}</b>` : '<br><b>No backup saved yet.</b>'}</p>
    <div class="row" style="gap:8px">
      <button class="btn" style="flex:1" data-export>⬆️ Save backup</button>
      <label class="btn plain" style="flex:1">⬇️ Restore<input type="file" accept="application/json,.json" data-import hidden></label></div>
  </div>

  <div class="section-title">About</div>
  <div class="card small muted">
    <b style="color:var(--text)">Daily Hub 1.1</b><br>
    Food data: Indian Food Composition Tables 2017, NIN Hyderabad.<br>
    Exercises: free-exercise-db (public domain).<br>
    Weather: Open-Meteo. Steps: Health Connect (read only).<br>
    Gym calories: Compendium of Physical Activities, 3.5 METs.<br>
    Targets and estimates are a guide, not medical advice.
    <div style="margin-top:8px"><a href="privacypolicy.html" style="color:var(--accent-text)">Privacy policy</a></div>
  </div>`;
}

export async function openSettings(ctx) {
  const exact = await exactAlarmStatus();
  const sheet = openSheet({ title: 'Settings', html: body(getState(), exact) });
  let cities = [];
  let remindersChanged = false;
  const redraw = async () => {
    const top = sheet.body.scrollTop;
    sheet.setBody(body(getState(), await exactAlarmStatus()));
    sheet.body.scrollTop = top;
  };

  sheet.body.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.matches('[data-import]')) { restoreFromFile(el.files[0]); el.value = ''; return; }
    const path = el.dataset.path;
    if (!path) return;
    let value = el.type === 'checkbox' ? el.checked : el.value;
    if ('num' in el.dataset) {
      value = Math.round(Number(value));
      if (!Number.isFinite(value) || value < 0) { toast('Please enter a number'); el.value = getPath(getState(), path); return; }
    }
    if (path.startsWith('settings.reminders') && value === true && !(await ensurePermission()) && isNative()) {
      toast('Please allow notifications for Daily Hub in Android settings');
      el.checked = false;
      return;
    }
    update((s) => { setPath(s, path, value); });
    if (path.startsWith('settings.reminders')) remindersChanged = true;
    if (el.type === 'checkbox') redraw();
  });

  sheet.body.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.theme || d.mode) {
      update((s) => { if (d.theme) s.settings.theme = d.theme; if (d.mode) s.settings.mode = d.mode; });
      applyTheme(getState().settings);
      redraw();
    }
    if ('goal' in d) openGoalSheet();
    if ('city' in d) {
      const q = sheet.body.querySelector('#city-q').value.trim();
      if (!q) return;
      try { cities = await searchCity(q); } catch { toast('Could not search. Please check your internet.'); return; }
      sheet.body.querySelector('#city-res').innerHTML = cities.map((c, i) => `<button class="item pressable" style="text-align:left" data-pick="${i}">
        <span class="grow"><span class="title">📍 ${esc(c.name)}</span><span class="meta">${esc(c.region)}</span></span></button>`).join('') || '<div class="empty small">No city found.</div>';
    }
    if (d.pick) {
      update((s) => { s.profile.city = cities[Number(d.pick)]; s.weather = null; });
      toast(`City set to ${cities[Number(d.pick)].name}`);
      ctx?.refreshWeather(true);
      redraw();
    }
    if ('test' in d) {
      if (await testNotification()) toast('A test reminder will come in about 1 minute. You can close the app.');
      else toast('Notifications are blocked. Please allow them in Android settings.');
    }
    if ('exact' in d) { await openExactAlarmSettings(); redraw(); }
    if ('export' in d) exportBackup();
  });

  // reminders are rebuilt once when the sheet closes, not on every keystroke
  const observer = new MutationObserver(() => {
    if (!document.body.contains(sheet.el)) {
      observer.disconnect();
      if (remindersChanged) syncReminders(getState());
    }
  });
  observer.observe(document.body, { childList: true });
}

async function exportBackup() {
  const text = makeBackup(getState());
  const name = backupFileName();
  try {
    if (isNative()) {
      const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: 'Daily Hub backup', text: 'Daily Hub backup file', files: [uri] });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    update((s) => { s.settings.lastBackupAt = Date.now(); });
    success();
  } catch (err) {
    if (!String(err.message || err).toLowerCase().includes('cancel')) toast('Backup failed: ' + (err.message || err));
  }
}

export async function restoreFromFile(file) {
  if (!file) return false;
  let parsed;
  try {
    parsed = parseBackup(await file.text());
  } catch (err) {
    toast(err.message, { ms: 5000 });
    return false;
  }
  const when = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('en-IN') : 'an unknown date';
  const ok = await confirmSheet({
    title: 'Restore this backup?',
    message: `This backup was saved on ${when}. Everything currently in the app will be replaced by it.`,
    confirm: 'Restore', danger: true,
  });
  if (!ok) return false;
  replaceState({ ...parsed.state, setupDone: true });
  applyTheme(getState().settings);
  syncReminders(getState());
  success();
  toast('Backup restored ✅');
  return true;
}
