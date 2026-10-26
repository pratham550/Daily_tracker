import { update, getState } from '../store.js';
import { THEMES, MODES, applyTheme } from '../themes.js';
import { esc, icon, toast } from '../ui.js';
import { searchCity } from '../lib/weather.js';
import { restoreFromFile } from './settings.js';

let step = 0;
let cityResults = [];
let cityQuery = '';

export function render(state) {
  const dots = `<div class="steps-dots">${[0, 1, 2].map((i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (step === 0) {
    body = `<div class="logo">🌱</div>
      <h1 class="center" style="margin:0 0 6px;font-size:28px">Welcome to Daily Hub</h1>
      <p class="center muted" style="margin:0 0 26px">Your day in one place: diet, gym, steps, money, habits and to-dos.
      Everything stays on this phone.</p>
      <label class="field"><span>What should I call you?</span>
        <input class="input" id="ob-name" placeholder="Your name" value="${esc(state.profile.name)}" autocomplete="given-name" data-enter="next"></label>
      <button class="btn block" data-act="next">Continue ${icon('right', 'width="20" height="20"')}</button>
      <label class="btn plain block" style="margin-top:10px">♻️ Reinstalling? Restore from a backup
        <input type="file" accept="application/json,.json" data-restore hidden></label>
      <p class="hint">Pick the latest file from Documents/DailyHub, or a backup you saved to Google Drive.</p>`;
  } else if (step === 1) {
    body = `<h1 class="center" style="margin:0 0 6px">Pick your look</h1>
      <p class="center muted" style="margin:0 0 20px">Tap a theme to try it. You can change it any time in Settings.</p>
      <div class="swatches" style="margin-bottom:16px">${THEMES.map((t) => `
        <button class="swatch ${state.settings.theme === t.id ? 'on' : ''}" data-act="theme" data-id="${t.id}">
          <div class="blob" style="background:linear-gradient(135deg,${t.a},${t.b})"></div>${t.name}</button>`).join('')}</div>
      <div class="seg">${MODES.map((m) => `<button class="${state.settings.mode === m.id ? 'on' : ''}" data-act="mode" data-id="${m.id}">${m.icon} ${m.name}</button>`).join('')}</div>
      <button class="btn block" data-act="next">Looks good ${icon('right', 'width="20" height="20"')}</button>`;
  } else {
    body = `<h1 class="center" style="margin:0 0 6px">Your city</h1>
      <p class="center muted" style="margin:0 0 20px">Used only to show the weather on your home screen. You can skip this.</p>
      <div class="inline-add" style="margin-bottom:12px">
        <input class="input" id="ob-city" placeholder="e.g. Pune" value="${esc(cityQuery)}" data-enter="findCity">
        <button class="btn" data-act="findCity" aria-label="Search">🔍</button></div>
      <div class="list" style="margin-bottom:16px">${cityResults.map((c, i) => `
        <button class="item pressable" data-act="pickCity" data-id="${i}" style="text-align:left">
          <span class="emoji">📍</span><span class="grow"><span class="title">${esc(c.name)}</span>
          <span class="meta">${esc(c.region)}</span></span>
          ${state.profile.city && state.profile.city.lat === c.lat ? '<span class="badge good">Selected</span>' : ''}</button>`).join('')}</div>
      ${state.profile.city ? `<p class="center">📍 <b>${esc(state.profile.city.name)}</b> selected</p>` : ''}
      <button class="btn block" data-act="finish">${state.profile.city ? 'Start using Daily Hub' : 'Skip for now'} 🚀</button>`;
  }
  return `<div class="onboard">${body}${dots}</div>`;
}

function saveName() {
  const el = document.getElementById('ob-name');
  if (el) update((s) => { s.profile.name = el.value.trim(); }, { silent: true });
}

export async function onChange(e) {
  if (!e.target.matches('[data-restore]')) return;
  const file = e.target.files[0];
  e.target.value = '';
  if (await restoreFromFile(file)) step = 0;
}

export const actions = {
  next(_, __, ___, ctx) {
    if (step === 0) {
      saveName();
      if (!getState().profile.name) { toast('Please type your name first'); return; }
    }
    step++;
    ctx.render();
  },
  theme(id) {
    update((s) => { s.settings.theme = id; });
    applyTheme(getState().settings);
  },
  mode(id) {
    update((s) => { s.settings.mode = id; });
    applyTheme(getState().settings);
  },
  async findCity(_, __, ___, ctx) {
    const q = document.getElementById('ob-city')?.value.trim();
    if (!q) return;
    cityQuery = q;
    try {
      cityResults = await searchCity(q);
      if (!cityResults.length) toast('No city found with that name');
    } catch {
      toast('Could not search. Please check your internet.');
    }
    ctx.render();
  },
  pickCity(i, _, __, ctx) {
    const c = cityResults[Number(i)];
    update((s) => { s.profile.city = c; s.weather = null; });
    ctx.refreshWeather(true);
  },
  finish() {
    update((s) => { s.setupDone = true; });
  },
};
