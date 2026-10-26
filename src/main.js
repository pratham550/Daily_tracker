import { App } from '@capacitor/app';
import { load, getState, subscribe, update, saveNow } from './store.js';
import { applyTheme, watchSystemTheme } from './themes.js';
import { SVG_DEFS, icon, animateIn, closeTopSheet, enableSwipe, toast } from './ui.js';
import { isNative, tap } from './lib/platform.js';
import { setupNotifications, syncReminders } from './lib/reminders.js';
import { fetchWeather } from './lib/weather.js';
import { runAutoBackup } from './lib/autobackup.js';
import * as home from './tabs/home.js';
import * as diet from './tabs/diet.js';
import * as fitness from './tabs/fitness.js';
import * as money from './tabs/money.js';
import * as habits from './tabs/habits.js';
import * as onboarding from './tabs/onboarding.js';
import { openSettings } from './tabs/settings.js';

const TABS = [
  { id: 'home', name: 'Home', icon: 'home', mod: home },
  { id: 'diet', name: 'Diet', icon: 'diet', mod: diet },
  { id: 'fitness', name: 'Fitness', icon: 'fit', mod: fitness },
  { id: 'money', name: 'Money', icon: 'money', mod: money },
  { id: 'habits', name: 'Habits', icon: 'habits', mod: habits },
];

const view = document.getElementById('view');
const app = document.getElementById('app');
let current = 'home';
let renderQueued = false;

const ctx = {
  go(tab, opts = {}) {
    if (opts.sub) TABS.find((t) => t.id === tab).mod.setSub?.(opts.sub);
    switchTab(tab);
  },
  render: () => queueRender(),
  openSettings: () => openSettings(ctx),
  refreshWeather: (force) => refreshWeather(force),
  get tab() { return current; },
};

function activeMod() {
  return getState().setupDone ? TABS.find((t) => t.id === current).mod : onboarding;
}

function render(enter = false) {
  renderQueued = false;
  const state = getState();
  const mod = activeMod();
  view.innerHTML = mod.render(state, ctx);
  view.classList.toggle('view-enter', enter);
  animateIn(view);
  mod.mounted?.(view, ctx);
  renderChrome();
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => render(false));
}

function switchTab(id) {
  if (id === current) { view.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  activeMod().unmounted?.();
  current = id;
  view.scrollTop = 0;
  render(true);
}

// ---------- bottom nav + FAB ----------
const nav = document.createElement('nav');
nav.className = 'nav';
nav.innerHTML = '<span class="pill"></span>' + TABS.map((t) =>
  `<button data-tab="${t.id}" aria-label="${t.name}">${icon(t.icon)}<span>${t.name}</span></button>`).join('');
const fab = document.createElement('button');
fab.className = 'fab';
fab.setAttribute('aria-label', 'Add');
fab.innerHTML = icon('plus');

nav.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  tap();
  switchTab(b.dataset.tab);
});
fab.addEventListener('click', () => {
  const fn = activeMod().fab?.(ctx);
  if (fn) { tap(); fn(); }
});

const tabEnabled = (id) => id !== 'money' || getState().settings.features.money;

function renderChrome() {
  const setup = getState().setupDone;
  if (!tabEnabled(current)) { current = 'home'; queueRender(); }
  nav.style.display = setup ? '' : 'none';
  const mod = activeMod();
  fab.classList.toggle('hide', !setup || !mod.fab || !mod.fab(ctx));
  nav.querySelectorAll('button').forEach((b) => {
    b.style.display = tabEnabled(b.dataset.tab) ? '' : 'none';
    const on = b.dataset.tab === current;
    b.classList.toggle('on', on);
    if (on) {
      const pill = nav.querySelector('.pill');
      pill.style.width = `${b.offsetWidth}px`;
      pill.style.transform = `translateX(${b.offsetLeft - 6}px)`;
      pill.style.left = '6px';
    }
  });
}

// ---------- delegated events for the active tab ----------
view.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = activeMod().actions?.[el.dataset.act];
  if (fn) { tap(); fn(el.dataset.id, el, e, ctx); }
});
view.addEventListener('change', (e) => activeMod().onChange?.(e, ctx));
view.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('[data-enter]')) {
    e.preventDefault();
    activeMod().actions?.[e.target.dataset.enter]?.(e.target.dataset.id, e.target, e, ctx);
  }
});
enableSwipe(view, {
  onRight: (id, el) => activeMod().swipe?.right?.(id, el, ctx),
  onLeft: (id, el) => activeMod().swipe?.left?.(id, el, ctx),
});

// ---------- lifecycle ----------
async function refreshWeather(force = false) {
  const s = getState();
  if (!s.profile.city) return;
  if (!force && s.weather && Date.now() - s.weather.at < 30 * 60 * 1000) return;
  try {
    const w = await fetchWeather(s.profile.city);
    update((st) => { st.weather = w; });
  } catch (err) {
    console.warn('[weather]', err.message);
    if (force) toast('Could not load weather. Please check your internet.');
  }
}

async function autoBackup() {
  if (!getState().setupDone) return;
  const day = await runAutoBackup(getState());
  if (day) update((s) => { s.settings.lastAutoBackupDay = day; }, { silent: true });
}

async function onResume() {
  autoBackup();
  refreshWeather();
  fitness.autoSyncSteps?.(ctx);
  queueRender();
}

async function start() {
  document.body.insertAdjacentHTML('afterbegin', SVG_DEFS);
  await load();
  applyTheme(getState().settings);
  watchSystemTheme(() => getState().settings);
  app.append(nav, fab);
  subscribe(() => queueRender());
  render(true);
  window.addEventListener('resize', renderChrome);

  if (isNative()) {
    await setupNotifications();
    syncReminders(getState());
    App.addListener('backButton', () => {
      if (closeTopSheet()) return;
      if (current !== 'home' && getState().setupDone) { switchTab('home'); return; }
      App.minimizeApp();
    });
    App.addListener('resume', onResume);
    App.addListener('pause', () => { saveNow(); autoBackup(); });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveNow(); else if (!isNative()) onResume();
  });
  onResume();
}

start();
