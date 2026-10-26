// Builds src/data/foods.json (pure-veg foods, per 100 g) from the Indian Food
// Composition Tables 2017 (NIN, Hyderabad), as packaged in the `ifct2017` npm package.
//
// Usage: node scripts/build-foods.mjs <path-to>/compositions/index.csv
//
// Only the data CSV is read; no code from that package is run.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/build-foods.mjs <compositions/index.csv>');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// IFCT group letters A-L and T are vegetarian; M (egg) to S (fish) are not.
const VEG_GROUPS = new Set('ABCDEFGHIJKLT'.split(''));
// Toddy is an alcoholic drink, not a food anyone wants suggested.
const EXCLUDE = new Set(['K001']);

// kJ per gram. IFCT's published energy matches 17/37/17 with fibre not counted
// (checked against every food in tests/diet.test.js), so fibre is 0 here too.
const KJ = { protein: 17, fat: 37, carb: 17, fibre: 0 };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function hindiName(lang) {
  // "lang" looks like "A. Moida; B. Maida; H. Maida; ..." and H. is Hindi
  for (const part of lang.split(';')) {
    const m = part.trim().match(/^(?:[A-Za-z]+\.,\s*)*H\.\s*(.+)$/);
    if (m) return m[1].replace(/\.$/, '').trim();
  }
  return '';
}

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const foods = [];
for (const r of rows) {
  const group = r.code[0];
  if (!VEG_GROUPS.has(group) || EXCLUDE.has(r.code)) continue;
  if (!r.tags.split(/\s+/).includes('veg')) continue;
  const p = num(r.protcnt);
  const f = num(r.fatce);
  const c = num(r.choavldf);
  const fi = num(r.fibtg);
  let kj = num(r.enerc);
  let calc = false;
  if (kj <= 0) {
    kj = p * KJ.protein + f * KJ.fat + c * KJ.carb + fi * KJ.fibre;
    calc = true;
  }
  const round1 = (x) => Math.round(x * 10) / 10;
  foods.push({
    id: r.code,
    name: r.name,
    hi: hindiName(r.lang),
    group: r.grup,
    kcal: Math.round(kj / 4.184),
    p: round1(p),
    c: round1(c),
    f: round1(f),
    fi: round1(fi),
    ...(calc ? { calc: true } : {}),
  });
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../src/data/foods.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({
  source: 'Indian Food Composition Tables 2017, NIN Hyderabad (via ifct2017 npm package 2.1.2)',
  per: '100 g edible portion',
  foods,
}) + '\n');
console.log(`Wrote ${foods.length} veg foods to ${out} (${foods.filter((x) => x.calc).length} with energy calculated from macros)`);
