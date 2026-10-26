// Exercise library (free-exercise-db, public domain). Loaded on first use so the
// 745 KB list does not slow down app start.
import { escapeHtml as esc } from './format.js';

export const GROUPS = [
  { id: 'Chest', emoji: '🏋️' },
  { id: 'Back', emoji: '🦍' },
  { id: 'Biceps', emoji: '💪' },
  { id: 'Triceps', emoji: '🦾' },
  { id: 'Shoulders', emoji: '🤸' },
  { id: 'Legs', emoji: '🦵' },
  { id: 'Abs', emoji: '🍫' },
  { id: 'Forearms', emoji: '✊' },
  { id: 'Cardio', emoji: '🏃' },
  { id: 'Stretch', emoji: '🧘' },
];

export const groupEmoji = (g) => GROUPS.find((x) => x.id === g)?.emoji || '🏋️';

export const TYPE_LABEL = { weight: 'kg × reps', reps: 'Reps only', time: 'Timed hold' };

let lib = null;
let base = '';

export async function loadLibrary() {
  if (lib) return lib;
  const mod = await import('../data/exercises.json');
  const data = mod.default || mod;
  base = data.imageBase;
  lib = data.exercises;
  lib.byName = new Map(lib.map((e) => [e.name.toLowerCase(), e]));
  lib.byId = new Map(lib.map((e) => [e.id, e]));
  return lib;
}

export function stepsHtml(e) {
  if (!e.steps.length) return '<p class="muted small">No written steps for this one in the source data. Please follow the demo pictures.</p>';
  return `<ol style="margin:10px 0 16px;padding-left:20px;line-height:1.55">${e.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
}

export function findByName(name) {
  return lib?.byName.get(name.toLowerCase()) || null;
}

export function findById(id) {
  return lib?.byId.get(id) || null;
}

export function searchExercises(q, group = null, limit = 60) { // limit Infinity to count
  if (!lib) return [];
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return lib
    .filter((e) => (!group || e.group === group) && words.every((w) => e.name.toLowerCase().includes(w) || e.equip.includes(w)))
    .sort((a, b) => (a.level === 'beginner' ? 0 : 1) - (b.level === 'beginner' ? 0 : 1) || a.name.length - b.name.length)
    .slice(0, limit);
}

// What a session exercise needs to know about itself
export function describe(name) {
  const e = findByName(name);
  return e ? { exId: e.id, group: e.group, type: e.type } : { exId: null, group: 'Other', type: 'weight' };
}

// Two photos (start and end position) shown alternately, like a GIF
export function demo(exId, group, size = 'big') {
  if (!exId || !base) return `<div class="demo ${size} noimg"><span>${groupEmoji(group)}</span></div>`;
  const src = (i) => `${base}${encodeURI(exId)}/${i}.jpg`;
  return `<div class="demo ${size}"><span>${groupEmoji(group)}</span>
    <img src="${esc(src(0))}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg')">
    <img class="f1" src="${esc(src(1))}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg')"></div>`;
}
