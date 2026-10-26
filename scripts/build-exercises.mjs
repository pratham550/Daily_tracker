// Builds src/data/exercises.json from free-exercise-db (github.com/yuhonas/free-exercise-db,
// public domain / Unlicense). Images are not bundled; the app loads them from jsDelivr on demand.
//
// Usage: node scripts/build-exercises.mjs <path-to>/dist/exercises.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/build-exercises.mjs <exercises.json>');
  process.exit(1);
}

// Dataset muscle -> the group a gym-goer thinks in
const GROUP = {
  chest: 'Chest',
  lats: 'Back', 'middle back': 'Back', 'lower back': 'Back', traps: 'Back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  shoulders: 'Shoulders', neck: 'Shoulders',
  quadriceps: 'Legs', hamstrings: 'Legs', glutes: 'Legs', calves: 'Legs', adductors: 'Legs', abductors: 'Legs',
  abdominals: 'Abs',
  forearms: 'Forearms',
};

function groupOf(x) {
  if (x.category === 'cardio') return 'Cardio';
  if (x.category === 'stretching') return 'Stretch';
  return GROUP[x.primaryMuscles[0]] || 'Other';
}

// weight = kg x reps, reps = bodyweight reps only, time = seconds (holds, stretches, cardio)
function typeOf(x) {
  if (x.category === 'cardio' || x.category === 'stretching' || x.force === 'static') return 'time';
  if (x.equipment === 'body only' || x.equipment === null) return 'reps';
  return 'weight';
}

const raw = JSON.parse(readFileSync(src, 'utf8'));
const out = raw
  .filter((x) => x.images.length >= 2)
  .map((x) => ({
    id: x.id,
    name: x.name,
    group: groupOf(x),
    muscles: [...x.primaryMuscles, ...x.secondaryMuscles],
    equip: x.equipment || 'body only',
    type: typeOf(x),
    level: x.level,
    steps: x.instructions,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, '../src/data/exercises.json');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify({
  source: 'free-exercise-db by yuhonas (public domain, Unlicense)',
  imageBase: 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/',
  exercises: out,
}) + '\n');

const by = {};
for (const e of out) by[e.group] = (by[e.group] || 0) + 1;
console.log(`Wrote ${out.length} exercises to ${dest}`, by);
