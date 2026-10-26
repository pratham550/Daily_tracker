import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export const SCHEMA = 1;
const FILE = 'dailyhub-data.json';
const LS_KEY = 'dailyhub:data';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const T = (name, exercises) => ({ id: uid(), name, exercises });

export function defaultState() {
  return {
    schema: SCHEMA,
    setupDone: false,
    profile: { name: '', city: null, sex: 'male', age: null, heightCm: null, weightKg: null, activity: 'active', goal: 'maintain' },
    settings: {
      theme: 'indigo',
      mode: 'auto',
      stepGoal: 8000,
      gymWeeklyTarget: 6,
      budget: 20000,
      restSeconds: 90,
      focusMinutes: 25,
      breakMinutes: 5,
      waterGlassMl: 250,
      haptics: true,
      // modules that can be switched off to keep the app simple
      features: { money: true, weather: true, focus: true, notes: true, smoking: true },
      reminders: {
        water: { on: false, everyHours: 2, start: 9, end: 21 },
        habits: { on: false, time: '21:00' },
        gym: { on: false, time: '18:00' },
        diet: { on: false, time: '13:30' },
        bills: { on: true },
      },
      lastBackupAt: null,
      autoBackup: true,
      lastAutoBackupDay: null,
    },
    todos: [],
    notes: [],
    expenses: [],
    categories: [
      { id: 'food', name: 'Food', emoji: '🍔' },
      { id: 'grocery', name: 'Groceries', emoji: '🛒' },
      { id: 'travel', name: 'Travel', emoji: '🚕' },
      { id: 'bills', name: 'Bills', emoji: '💡' },
      { id: 'shopping', name: 'Shopping', emoji: '🛍️' },
      { id: 'health', name: 'Health', emoji: '💊' },
      { id: 'fun', name: 'Fun', emoji: '🎬' },
      { id: 'other', name: 'Other', emoji: '📦' },
    ],
    bills: [],
    habits: [
      { id: uid(), name: 'Read 10 pages', emoji: '📖', log: {}, createdAt: Date.now() },
      { id: uid(), name: 'Sleep by 11 pm', emoji: '😴', log: {}, createdAt: Date.now() },
      { id: uid(), name: 'No junk food', emoji: '🥗', log: {}, createdAt: Date.now() },
    ],
    gym: {
      templates: [
        T('Push', ['Barbell Bench Press - Medium Grip', 'Dumbbell Shoulder Press', 'Incline Dumbbell Press', 'Side Lateral Raise', 'Triceps Pushdown']),
        T('Pull', ['Barbell Deadlift', 'Wide-Grip Lat Pulldown', 'Seated Cable Rows', 'Face Pull', 'Barbell Curl']),
        T('Legs', ['Barbell Squat', 'Romanian Deadlift', 'Leg Press', 'Lying Leg Curls', 'Seated Calf Raise']),
        T('Upper', ['Barbell Bench Press - Medium Grip', 'Bent Over Barbell Row', 'Barbell Shoulder Press', 'Pullups', 'Barbell Curl', 'Triceps Pushdown']),
        T('Lower', ['Barbell Squat', 'Romanian Deadlift', 'Barbell Walking Lunge', 'Leg Extensions', 'Seated Calf Raise']),
        T('Full body', ['Barbell Squat', 'Barbell Bench Press - Medium Grip', 'Bent Over Barbell Row', 'Barbell Shoulder Press', 'Plank']),
      ],
      sessions: [],
      active: null,
      bodyWeight: [],
    },
    diet: {
      log: [],
      customFoods: [],
      savedMeals: [],
      water: {},
    },
    steps: { daily: {}, distance: {}, calories: {}, lastSync: null, connected: false },
    weather: null,
    focusLog: {},
    smoke: { log: [], limit: null, price: null, stepDown: false, planStart: null },
  };
}

// Fills in anything a newer app version added, without touching what the user has.
export function migrate(data) {
  const base = defaultState();
  const merge = (def, cur) => {
    if (cur === undefined || cur === null) return def;
    if (Array.isArray(def) || typeof def !== 'object' || def === null) return cur;
    if (typeof cur !== 'object' || Array.isArray(cur)) return def;
    const out = { ...cur };
    for (const k of Object.keys(def)) out[k] = merge(def[k], cur[k]);
    return out;
  };
  const merged = merge(base, data);
  merged.schema = SCHEMA;
  return merged;
}

let state = defaultState();
const listeners = new Set();
let saveTimer = null;

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function update(mutator, { silent = false } = {}) {
  mutator(state);
  scheduleSave();
  if (!silent) listeners.forEach((fn) => fn(state));
}

export function replaceState(next) {
  state = migrate(next);
  scheduleSave(0);
  listeners.forEach((fn) => fn(state));
}

const native = () => Capacitor.isNativePlatform();

export async function load() {
  try {
    let text = null;
    if (native()) {
      try {
        const r = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
        text = r.data;
      } catch {
        text = null; // first launch
      }
    } else {
      text = localStorage.getItem(LS_KEY);
    }
    if (text) state = migrate(JSON.parse(text));
  } catch (err) {
    console.error('[store] could not load saved data, starting fresh', err);
    state = defaultState();
  }
  return state;
}

function scheduleSave(delay = 400) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, delay);
}

export async function saveNow() {
  clearTimeout(saveTimer);
  const text = JSON.stringify(state);
  try {
    if (native()) {
      // write to a temp file first so a crash mid-write can't corrupt the real one
      await Filesystem.writeFile({ path: FILE + '.tmp', data: text, directory: Directory.Data, encoding: Encoding.UTF8 });
      await Filesystem.rename({ from: FILE + '.tmp', to: FILE, directory: Directory.Data, toDirectory: Directory.Data });
    } else {
      localStorage.setItem(LS_KEY, text);
    }
  } catch (err) {
    console.error('[store] save failed', err);
  }
}
