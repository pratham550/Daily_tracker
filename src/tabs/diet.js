import foodsData from '../data/foods.json';
import { update, getState, uid } from '../store.js';
import { dateKey, addDays, fmtDay } from '../lib/dates.js';
import {
  MEALS, ACTIVITY, GOALS, calcTargets, nutritionFor, sumNutrition, dayEntries, searchFoods,
  suggestMeals, remainingSlots, proteinDenseFoods,
} from '../lib/diet.js';
import { success } from '../lib/platform.js';
import { workoutKcal } from '../lib/stats.js';
import { formatNum } from '../lib/format.js';
import { esc, icon, ring, bar, count, swipeItem, openSheet, toast, confetti } from '../ui.js';

let day = null;
const viewDay = () => day || dateKey();

export function allFoods(s = getState()) {
  return [...s.diet.customFoods, ...foodsData.foods];
}

function foodsById(s = getState()) {
  return Object.fromEntries(allFoods(s).map((f) => [f.id, f]));
}

function mealForNow() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 19) return 'snack';
  return 'dinner';
}

function seedFor(key) {
  return Number(key.replace(/-/g, '')) % 97;
}

// ---------- render ----------
export function render(s) {
  const k = viewDay();
  const isToday = k === dateKey();
  const targets = calcTargets(s.profile);
  const entries = dayEntries(s.diet.log, k);
  const eaten = sumNutrition(entries);
  const burned = Math.round((s.steps.calories[k] || 0)
    + s.gym.sessions.filter((x) => x.date === k).reduce((a, x) => a + workoutKcal(x, s.profile.weightKg), 0));

  const header = `<header class="top"><div class="grow"><h1>Diet 🥗</h1><div class="sub">Pure veg · ${esc(fmtDay(k))}</div></div>
    <button class="icon-btn" data-act="prevDay" aria-label="Previous day">${icon('left')}</button>
    <button class="icon-btn" data-act="nextDay" aria-label="Next day" ${isToday ? 'disabled style="opacity:.4"' : ''}>${icon('right')}</button></header>`;

  let hero;
  if (!targets) {
    hero = `<div class="card hero">
      <div class="mid-num" style="margin-bottom:6px">Set your goal 🎯</div>
      <p class="muted" style="margin:0 0 14px">Tell me your age, height, weight and goal. I will work out your daily calories and protein, and suggest pure-veg meals to match.</p>
      <button class="btn ghost" data-act="goal">Set up in 30 seconds</button></div>`;
  } else {
    const left = targets.kcal - eaten.kcal;
    const goalName = GOALS.find((g) => g.id === s.profile.goal)?.name;
    const macro = (label, v, t) => `<div class="macro"><b>${label}</b>${bar(v / t, v > t * 1.1)}<span>${Math.round(v)} / ${t} g</span></div>`;
    hero = `<div class="card hero">
      <div class="row between" style="margin-bottom:12px"><span class="badge">🎯 ${esc(goalName)}</span>
        <button class="btn ghost small" data-act="goal">Edit goal</button></div>
      <div class="row" style="gap:18px">
        ${ring('diet-kcal', eaten.kcal / targets.kcal, { size: 128, stroke: 12, inner: `<div><div class="mid-num">${count('diet-left', Math.abs(left))}</div><div class="muted small">${left >= 0 ? 'kcal left' : 'kcal over'}</div></div>` })}
        <div style="flex:1;min-width:0">
          <div class="muted small">Eaten</div><div class="mid-num">${count('diet-eaten', eaten.kcal)} <span class="small muted">/ ${targets.kcal}</span></div>
          ${macro('Protein', eaten.p, targets.protein)}${macro('Carbs', eaten.c, targets.carbs)}${macro('Fat', eaten.f, targets.fat)}
        </div>
      </div>
      ${burned ? `<div class="small" style="margin-top:12px;opacity:.9">🔥 Burned about ${formatNum(burned)} kcal in activity today (steps + gym)</div>` : ''}</div>`;
  }

  // water
  const glassMl = s.settings.waterGlassMl;
  const glasses = s.diet.water[k] || 0;
  const goalGlasses = Math.max(4, Math.round((targets?.waterMl || 2500) / glassMl));
  const water = `<div class="card">
    <h2>💧 Water <span class="spacer"></span><span class="badge ${glasses >= goalGlasses ? 'good' : ''}">${(glasses * glassMl / 1000).toFixed(2)} / ${(goalGlasses * glassMl / 1000).toFixed(1)} L</span></h2>
    <div class="row">
      <button class="btn plain small" data-act="water" data-id="-1" aria-label="Remove a glass">−</button>
      <div class="drops">${Array.from({ length: Math.max(goalGlasses, glasses) }, (_, i) => `<span class="${i < glasses ? '' : 'off'}">💧</span>`).join('')}</div>
      <button class="btn small" data-act="water" data-id="1" aria-label="Add a glass">+</button></div></div>`;

  // meals
  const yKey = addDays(k, -1);
  const meals = MEALS.map((m) => {
    const list = entries.filter((e) => e.meal === m.id);
    const tot = sumNutrition(list);
    const yHas = dayEntries(s.diet.log, yKey).some((e) => e.meal === m.id);
    return `<div class="card">
      <h2>${m.emoji} ${m.name} <span class="spacer"></span>
        ${list.length ? `<span class="muted small">${tot.kcal} kcal · ${tot.p} g P</span>` : ''}
        <button class="btn ghost small" data-act="add" data-id="${m.id}">+ Add</button></h2>
      ${list.length ? `<div class="list">${list.map((e) => swipeItem(e.id, `
        <span class="grow"><span class="title">${esc(e.name)}</span>
        <span class="meta">${e.grams ? `${e.grams} g · ` : ''}${e.kcal} kcal · P ${e.p} g · C ${e.c} g · F ${e.f} g</span></span>`, { right: null })).join('')}</div>`
        : `<div class="row between"><span class="muted small">Nothing logged yet</span>
          ${yHas ? `<button class="btn plain small" data-act="copyY" data-id="${m.id}">↺ Same as yesterday</button>` : ''}</div>`}
    </div>`;
  }).join('');

  // suggestions
  let ideas = '';
  if (targets && isToday) {
    const rem = remainingSlots(targets, entries);
    if (rem.left.kcal < 80 && rem.left.p < 5) {
      ideas = `<div class="card center"><div style="font-size:34px">🎉</div><b>Today's target is done.</b><div class="muted small">Great discipline!</div></div>`;
    } else {
      const byId = foodsById(s);
      const next = rem.slots.slice(0, 2).map((sl) => {
        const best = suggestMeals({ slot: sl.id, kcal: sl.kcal, protein: sl.protein, foodsById: byId, seed: seedFor(k), count: 1 })[0];
        if (!best) return '';
        return `<button class="item pressable" style="text-align:left" data-act="ideas" data-id="${sl.id}">
          <span class="emoji">${sl.emoji}</span><span class="grow"><span class="title">${esc(best.name)}</span>
          <span class="meta">${sl.name} · ${best.total.kcal} kcal · ${best.total.p} g protein</span></span>${icon('right', 'width="18" height="18"')}</button>`;
      }).join('');
      ideas = `<div class="card">
        <h2>🌱 Veg meal ideas for you <span class="spacer"></span><span class="badge">${rem.left.kcal} kcal · ${rem.left.p} g P left</span></h2>
        <div class="list">${next || '<div class="empty small">All meals logged for today.</div>'}</div>
        <p class="hint">Portions are worked out to fit what is left of your day. Tap for more options.</p></div>`;
    }
  }

  const top = proteinDenseFoods(allFoods(s), 6);
  const protein = `<div class="card">
    <h2>💪 Best veg protein sources</h2>
    <div class="list">${top.map((f) => `<button class="item pressable" style="text-align:left" data-act="quickFood" data-id="${esc(f.id)}">
      <span class="grow"><span class="title">${esc(f.name)}${f.hi ? ` <span class="muted small">(${esc(f.hi)})</span>` : ''}</span>
      <span class="meta">${f.p} g protein · ${f.kcal} kcal per 100 g</span></span><span class="badge">${f.density} g/100 kcal</span></button>`).join('')}</div>
    <p class="hint">Curd, oats, soya chunks, tofu and whey are not in IFCT 2017. Add them once from the packet label under + Add → My foods.</p></div>`;

  return `${header}${hero}${water}${ideas}${meals}${protein}
    <p class="hint">Nutrition data: Indian Food Composition Tables 2017, NIN Hyderabad. Targets are estimates, not medical advice.</p>`;
}

// ---------- goal sheet ----------
export function openGoalSheet() {
  const s = getState();
  const p = { ...s.profile };
  const sheet = openSheet({ title: 'Your goal', html: '' });
  const draw = () => {
    const t = calcTargets(p);
    sheet.setBody(`
      <div class="seg">${['male', 'female'].map((x) => `<button class="${p.sex === x ? 'on' : ''}" data-sex="${x}">${x === 'male' ? '👨 Male' : '👩 Female'}</button>`).join('')}</div>
      <div class="row" style="gap:10px">
        <label class="field" style="flex:1"><span>Age</span><input class="input" inputmode="numeric" data-k="age" value="${p.age ?? ''}" placeholder="years"></label>
        <label class="field" style="flex:1"><span>Height</span><input class="input" inputmode="numeric" data-k="heightCm" value="${p.heightCm ?? ''}" placeholder="cm"></label>
        <label class="field" style="flex:1"><span>Weight</span><input class="input" inputmode="decimal" data-k="weightKg" value="${p.weightKg ?? ''}" placeholder="kg"></label>
      </div>
      <label class="field"><span>How active are you?</span><select class="input" data-k="activity">
        ${ACTIVITY.map((a) => `<option value="${a.id}" ${p.activity === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select></label>
      <span class="muted small" style="display:block;margin:0 0 6px 4px;font-weight:600">Goal</span>
      <div class="seg">${GOALS.map((g) => `<button class="${p.goal === g.id ? 'on' : ''}" data-goal="${g.id}">${g.name}</button>`).join('')}</div>
      ${t ? `<div class="kv" style="margin-bottom:8px">
        <div><b>${t.kcal}</b><span>kcal/day</span></div><div><b>${t.protein} g</b><span>protein</span></div>
        <div><b>${t.carbs} g</b><span>carbs</span></div><div><b>${t.fat} g</b><span>fat</span></div></div>
        <p class="hint" style="margin-bottom:14px">Maintenance is about ${t.tdee} kcal (Mifflin-St Jeor). Water target ${(t.waterMl / 1000).toFixed(1)} L.</p>`
        : '<p class="hint" style="margin-bottom:14px">Fill age, height and weight to see your targets.</p>'}
      <button class="btn block" data-save ${t ? '' : 'disabled'}>Save goal</button>`);
  };
  draw();
  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sex],[data-goal],[data-save]');
    if (!b) return;
    if (b.dataset.sex) p.sex = b.dataset.sex;
    if (b.dataset.goal) p.goal = b.dataset.goal;
    if (b.hasAttribute('data-save')) {
      update((st) => { Object.assign(st.profile, p); });
      success();
      sheet.close();
      toast('Goal saved. Your targets are ready 🎯');
      return;
    }
    draw();
  });
  sheet.body.addEventListener('change', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    p[k] = k === 'activity' ? e.target.value : (Number(e.target.value) || null);
    draw();
  });
}

// ---------- add food sheet ----------
export function openAddFood(meal = mealForNow(), presetFoodId = null) {
  const st = { meal, tab: 'search', q: '', food: null, grams: 100 };
  const sheet = openSheet({ title: 'Add food', html: '' });

  const mealChips = () => `<div class="chips" style="margin-bottom:10px">${MEALS.map((m) =>
    `<button class="chip ${st.meal === m.id ? 'on' : ''}" data-meal="${m.id}">${m.emoji} ${m.name}</button>`).join('')}</div>`;

  const foodRow = (f) => `<button class="item pressable" style="text-align:left" data-food="${esc(f.id)}">
    <span class="grow"><span class="title">${esc(f.name)}${f.hi ? ` <span class="muted small">(${esc(f.hi)})</span>` : ''}</span>
    <span class="meta">${f.custom ? '⭐ My food · ' : ''}${f.kcal} kcal · ${f.p} g protein per 100 g</span></span>${icon('plus', 'width="18" height="18"')}</button>`;

  const drawResults = () => {
    const box = sheet.body.querySelector('#food-res');
    if (!box) return;
    const res = searchFoods(allFoods(), st.q);
    box.innerHTML = st.q
      ? (res.map(foodRow).join('') || '<div class="empty small">No match. Try another name, or use Quick add.</div>')
      : '<div class="empty small">Type a food name in English or Hindi, e.g. paneer, rajma, atta, chawal, badam.</div>';
  };

  const draw = () => {
    if (st.food) {
      const f = st.food;
      const n = nutritionFor(f, st.grams || 0);
      const presets = [...new Set([f.servingG, 25, 50, 100, 150, 200, 250].filter(Boolean))];
      sheet.setBody(`${mealChips()}
        <button class="btn plain small" data-back style="margin-bottom:12px">${icon('left', 'width="16" height="16"')} Back</button>
        <div class="card tight"><b>${esc(f.name)}</b>${f.hi ? ` <span class="muted">(${esc(f.hi)})</span>` : ''}
          <div class="muted small">${f.custom ? 'Your food (from label)' : 'IFCT 2017 · values for the raw / edible food'}</div></div>
        <label class="field"><span>How many grams?</span>
          <input class="input amount-input" id="grams" inputmode="decimal" value="${st.grams || ''}"></label>
        <div class="chips" style="margin-bottom:12px">${presets.map((g) => `<button class="chip ${Number(st.grams) === g ? 'on' : ''}" data-g="${g}">${g === f.servingG ? `1 serving (${g} g)` : `${g} g`}</button>`).join('')}</div>
        <div class="kv" style="margin-bottom:16px"><div><b>${n.kcal}</b><span>kcal</span></div><div><b>${n.p}</b><span>protein g</span></div>
          <div><b>${n.c}</b><span>carbs g</span></div><div><b>${n.f}</b><span>fat g</span></div></div>
        <button class="btn block" data-addfood ${st.grams > 0 ? '' : 'disabled'}>Add to ${MEALS.find((m) => m.id === st.meal).name}</button>`);
      return;
    }
    const tabs = `<div class="seg">${[['search', '🔍 Search'], ['mine', '⭐ My foods'], ['quick', '⚡ Quick add']].map(([id, n]) =>
      `<button class="${st.tab === id ? 'on' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>`;
    if (st.tab === 'search') {
      sheet.setBody(`${mealChips()}${tabs}
        <input class="input" id="food-q" placeholder="Search 327 veg foods…" value="${esc(st.q)}" autocomplete="off" style="margin-bottom:12px">
        <div class="list food-res" id="food-res"></div>`);
      drawResults();
      setTimeout(() => sheet.body.querySelector('#food-q')?.focus(), 350);
    } else if (st.tab === 'mine') {
      const mine = getState().diet.customFoods;
      sheet.setBody(`${mealChips()}${tabs}
        <div class="list" style="margin-bottom:14px">${mine.map(foodRow).join('') || '<div class="empty small">No foods yet. Add curd, oats, whey or anything from a packet label.</div>'}</div>
        <div class="card tight"><b>➕ New food from packet label</b>
          <label class="field" style="margin-top:10px"><span>Name</span><input class="input" id="cf-name" placeholder="e.g. Whey protein (my brand)"></label>
          <div class="seg"><button class="on" data-basis="100">Per 100 g</button><button data-basis="serving">Per serving</button></div>
          <label class="field" id="cf-serv-wrap" style="display:none"><span>Serving size (g)</span><input class="input" id="cf-serv" inputmode="decimal" placeholder="e.g. 32"></label>
          <div class="row" style="gap:8px">
            <label class="field" style="flex:1"><span>kcal</span><input class="input" id="cf-kcal" inputmode="decimal"></label>
            <label class="field" style="flex:1"><span>Protein g</span><input class="input" id="cf-p" inputmode="decimal"></label></div>
          <div class="row" style="gap:8px">
            <label class="field" style="flex:1"><span>Carbs g</span><input class="input" id="cf-c" inputmode="decimal"></label>
            <label class="field" style="flex:1"><span>Fat g</span><input class="input" id="cf-f" inputmode="decimal"></label></div>
          <button class="btn block" data-savefood>Save food</button></div>`);
    } else {
      sheet.setBody(`${mealChips()}${tabs}
        <p class="muted small" style="margin-top:0">For eating out or when you only know the calories.</p>
        <label class="field"><span>What did you eat?</span><input class="input" id="qa-name" placeholder="e.g. Office canteen thali"></label>
        <div class="row" style="gap:8px">
          <label class="field" style="flex:1"><span>kcal</span><input class="input" id="qa-kcal" inputmode="decimal"></label>
          <label class="field" style="flex:1"><span>Protein g (optional)</span><input class="input" id="qa-p" inputmode="decimal"></label></div>
        <button class="btn block" data-quick>Add</button>`);
    }
  };

  sheet.body.addEventListener('input', (e) => {
    if (e.target.id === 'food-q') { st.q = e.target.value; drawResults(); }
    if (e.target.id === 'grams') {
      st.grams = Number(e.target.value) || 0;
      const n = nutritionFor(st.food, st.grams);
      const kv = sheet.body.querySelectorAll('.kv b');
      [n.kcal, n.p, n.c, n.f].forEach((v, i) => { kv[i].textContent = v; });
      sheet.body.querySelector('[data-addfood]').disabled = !(st.grams > 0);
      sheet.body.querySelectorAll('[data-g]').forEach((c) => c.classList.toggle('on', Number(c.dataset.g) === st.grams));
    }
  });

  sheet.body.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.meal) { st.meal = d.meal; draw(); return; }
    if (d.tab) { st.tab = d.tab; draw(); return; }
    if (d.food) {
      st.food = foodsById()[d.food];
      st.grams = st.food.servingG || 100;
      draw();
      return;
    }
    if (d.g) { st.grams = Number(d.g); draw(); return; }
    if ('back' in d) { st.food = null; draw(); return; }
    if (d.basis) {
      sheet.body.querySelectorAll('[data-basis]').forEach((b) => b.classList.toggle('on', b === t));
      sheet.body.querySelector('#cf-serv-wrap').style.display = d.basis === 'serving' ? '' : 'none';
      return;
    }
    if ('addfood' in d) {
      const f = st.food;
      const n = nutritionFor(f, st.grams);
      logEntry({ meal: st.meal, name: f.name, grams: st.grams, foodId: f.id, ...n });
      sheet.close();
      return;
    }
    if ('quick' in d) {
      const name = sheet.body.querySelector('#qa-name').value.trim() || 'Quick add';
      const kcal = Number(sheet.body.querySelector('#qa-kcal').value);
      const p = Number(sheet.body.querySelector('#qa-p').value) || 0;
      if (!(kcal > 0)) { toast('Please enter the calories'); return; }
      logEntry({ meal: st.meal, name, grams: null, foodId: null, kcal: Math.round(kcal), p, c: 0, f: 0 });
      sheet.close();
      return;
    }
    if ('savefood' in d) {
      const v = (id) => Number(sheet.body.querySelector(id).value) || 0;
      const name = sheet.body.querySelector('#cf-name').value.trim();
      const perServing = sheet.body.querySelector('[data-basis="serving"]').classList.contains('on');
      const serv = v('#cf-serv');
      if (!name || !(v('#cf-kcal') > 0)) { toast('Name and kcal are needed'); return; }
      if (perServing && !(serv > 0)) { toast('Please enter the serving size in grams'); return; }
      const k = perServing ? 100 / serv : 1;
      const r1 = (x) => Math.round(x * 10) / 10;
      const food = {
        id: 'C-' + uid(), name, hi: '', custom: true, kcal: Math.round(v('#cf-kcal') * k),
        p: r1(v('#cf-p') * k), c: r1(v('#cf-c') * k), f: r1(v('#cf-f') * k), fi: 0,
        ...(perServing ? { servingG: serv } : {}),
      };
      update((s) => { s.diet.customFoods.unshift(food); });
      toast(`${name} saved to My foods`);
      st.food = food;
      st.grams = food.servingG || 100;
      draw();
    }
  });

  if (presetFoodId) {
    st.food = foodsById()[presetFoodId];
    st.grams = st.food?.servingG || 100;
  }
  draw();
}

function logEntry(entry) {
  const k = viewDay();
  const before = calcTargets(getState().profile);
  const wasUnder = before && sumNutrition(dayEntries(getState().diet.log, k)).p < before.protein;
  update((s) => { s.diet.log.push({ id: uid(), date: k, ...entry }); });
  success();
  const now = sumNutrition(dayEntries(getState().diet.log, k));
  if (before && wasUnder && now.p >= before.protein) {
    confetti();
    toast('Protein target hit for today 💪');
  } else {
    toast(`Added ${entry.name} · ${entry.kcal} kcal`);
  }
}

// ---------- ideas sheet ----------
function openIdeas(slotId) {
  const s = getState();
  const targets = calcTargets(s.profile);
  const k = viewDay();
  const rem = remainingSlots(targets, dayEntries(s.diet.log, k));
  const slot = rem.slots.find((x) => x.id === slotId) || { ...MEALS.find((m) => m.id === slotId), kcal: 400, protein: 20 };
  const ideas = suggestMeals({ slot: slotId, kcal: slot.kcal, protein: slot.protein, foodsById: foodsById(s), seed: seedFor(k), count: 4 });
  const sheet = openSheet({
    title: `${slot.emoji} ${slot.name} ideas`,
    html: `<p class="muted small" style="margin-top:0">Aim for about <b>${slot.kcal} kcal</b> and <b>${slot.protein} g protein</b> in this meal.</p>
      ${ideas.map((m, i) => `<div class="card">
        <h2>${esc(m.name)} <span class="spacer"></span><span class="badge">${m.total.kcal} kcal · ${m.total.p} g P</span></h2>
        <div class="list">${m.parts.map((p) => `<div class="row between small"><span>${esc(p.name)}${p.hi ? ` <span class="muted">(${esc(p.hi)})</span>` : ''}</span><b>${p.grams} g</b></div>`).join('')}</div>
        <button class="btn ghost block" style="margin-top:12px" data-use="${i}">Add this to ${slot.name}</button></div>`).join('')}
      <p class="hint">Grams are for raw ingredients before cooking. Values from IFCT 2017.</p>`,
  });
  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-use]');
    if (!b) return;
    const m = ideas[Number(b.dataset.use)];
    update((st) => {
      for (const p of m.parts) st.diet.log.push({ id: uid(), date: k, meal: slotId, name: p.name, grams: p.grams, foodId: p.id, kcal: p.kcal, p: p.p, c: p.c, f: p.f });
    });
    success();
    sheet.close();
    toast(`${m.name} added to ${slot.name}`);
  });
}

export function addWater(n) {
  const k = viewDay();
  update((s) => { s.diet.water[k] = Math.max(0, (s.diet.water[k] || 0) + n); });
  if (n > 0) { success(); toast('💧 Glass of water added', { ms: 1500 }); }
}

export const actions = {
  prevDay(_, __, ___, ctx) { day = addDays(viewDay(), -1); ctx.render(); },
  nextDay(_, __, ___, ctx) {
    if (viewDay() === dateKey()) return;
    day = addDays(viewDay(), 1);
    if (day === dateKey()) day = null;
    ctx.render();
  },
  goal: () => openGoalSheet(),
  water: (n) => addWater(Number(n)),
  add: (meal) => openAddFood(meal),
  quickFood: (id) => openAddFood(mealForNow(), id),
  ideas: (slot) => openIdeas(slot),
  copyY(meal) {
    const k = viewDay();
    const y = dayEntries(getState().diet.log, addDays(k, -1)).filter((e) => e.meal === meal);
    update((s) => { for (const e of y) s.diet.log.push({ ...e, id: uid(), date: k }); });
    success();
    toast(`Copied ${y.length} item${y.length > 1 ? 's' : ''} from yesterday`);
  },
};

export const swipe = {
  left(id) {
    const s = getState();
    const i = s.diet.log.findIndex((e) => e.id === id);
    if (i < 0) return;
    const copy = s.diet.log[i];
    update((st) => { st.diet.log.splice(i, 1); });
    toast(`Removed ${copy.name}`, { action: 'Undo', onAction: () => update((st) => { st.diet.log.splice(i, 0, copy); }) });
  },
};

export function fab() {
  return () => openAddFood();
}
