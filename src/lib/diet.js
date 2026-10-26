// Diet maths: daily targets, portion nutrition and pure-veg meal suggestions.
// Every nutrition number comes from foods.json (IFCT 2017) or a food the user
// entered from a packet label; meal ideas below only choose foods and proportions.

export const MEALS = [
  { id: 'breakfast', name: 'Breakfast', emoji: '🌅', share: 0.25 },
  { id: 'lunch', name: 'Lunch', emoji: '🍛', share: 0.35 },
  { id: 'snack', name: 'Snack', emoji: '🍎', share: 0.1 },
  { id: 'dinner', name: 'Dinner', emoji: '🌙', share: 0.3 },
];

export const ACTIVITY = [
  { id: 'sedentary', name: 'Desk job, little exercise', factor: 1.2 },
  { id: 'light', name: 'Light exercise 1-3 days/week', factor: 1.375 },
  { id: 'moderate', name: 'Gym 3-5 days/week', factor: 1.55 },
  { id: 'active', name: 'Gym 6-7 days/week', factor: 1.725 },
  { id: 'athlete', name: 'Hard training twice a day', factor: 1.9 },
];

export const GOALS = [
  { id: 'lose', name: 'Lose fat', kcalDelta: -500, proteinPerKg: 2.0 },
  { id: 'maintain', name: 'Stay fit', kcalDelta: 0, proteinPerKg: 1.6 },
  { id: 'gain', name: 'Build muscle', kcalDelta: 300, proteinPerKg: 1.8 },
];

// Mifflin-St Jeor BMR, activity multiplier, then the goal adjustment.
// This is a standard estimate, not medical advice.
export function calcTargets(p) {
  if (!p || !p.weightKg || !p.heightCm || !p.age) return null;
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  const bmr = Math.round(p.sex === 'female' ? base - 161 : base + 5);
  const act = ACTIVITY.find((a) => a.id === p.activity) || ACTIVITY[2];
  const goal = GOALS.find((g) => g.id === p.goal) || GOALS[1];
  const tdee = Math.round(bmr * act.factor);
  const floor = p.sex === 'female' ? 1200 : 1500;
  const kcal = Math.max(floor, Math.round((tdee + goal.kcalDelta) / 10) * 10);
  const protein = Math.round(p.weightKg * goal.proteinPerKg);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const waterMl = Math.round((p.weightKg * 35) / 250) * 250;
  return { bmr, tdee, kcal, protein, fat, carbs, waterMl };
}

export function nutritionFor(food, grams) {
  const k = grams / 100;
  const r1 = (x) => Math.round(x * 10) / 10;
  return {
    kcal: Math.round(food.kcal * k),
    p: r1(food.p * k),
    c: r1(food.c * k),
    f: r1(food.f * k),
  };
}

export function sumNutrition(items) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const i of items) {
    t.kcal += i.kcal || 0;
    t.p += i.p || 0;
    t.c += i.c || 0;
    t.f += i.f || 0;
  }
  return { kcal: Math.round(t.kcal), p: Math.round(t.p * 10) / 10, c: Math.round(t.c * 10) / 10, f: Math.round(t.f * 10) / 10 };
}

export function dayEntries(dietLog, key) {
  return dietLog.filter((e) => e.date === key);
}

export function searchFoods(foods, query, limit = 30) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  const scored = [];
  for (const f of foods) {
    const hay = `${f.name} ${f.hi || ''}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    const name = f.name.toLowerCase();
    const hi = (f.hi || '').toLowerCase();
    let score = 3;
    if (name.startsWith(q) || hi.startsWith(q)) score = 0;
    else if (name.includes(q) || hi.includes(q)) score = 1;
    if (f.custom) score -= 0.5;
    scored.push([score, f]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length).slice(0, limit).map((x) => x[1]);
}

// Best veg protein sources people actually eat in quantity: at least 15 g protein
// per 100 g, spices and leafy greens left out, ranked by grams of protein per 100 kcal
const NOT_STAPLES = new Set(['Condiments and Spices', 'Green Leafy Vegetables']);
export function proteinDenseFoods(foods, n = 8) {
  return foods
    .filter((f) => f.kcal > 0 && f.p >= 15 && !NOT_STAPLES.has(f.group))
    .map((f) => ({ ...f, density: Math.round((f.p / f.kcal) * 1000) / 10 }))
    .sort((a, b) => b.density - a.density)
    .slice(0, n);
}

// Meal ideas: food ids (IFCT codes) and grams for one base serving.
// Portions are scaled to fit the meal's calorie budget before they are shown.
export const MEAL_IDEAS = [
  { name: 'Besan chilla', slots: ['breakfast'], items: [['B001', 50, 'Besan (chana dal flour)'], ['G017', 20], ['D075', 30], ['T005', 5]] },
  { name: 'Moong dal chilla with paneer', slots: ['breakfast', 'dinner'], items: [['B010', 50], ['L003', 40], ['G017', 20], ['T005', 5]] },
  { name: 'Ragi porridge with milk', slots: ['breakfast'], items: [['A010', 40], ['L002', 200], ['I001', 10]] },
  { name: 'Milk, banana and almonds', slots: ['breakfast', 'snack'], items: [['L002', 250], ['E012', 100], ['H001', 15]] },
  { name: 'Moong sprouts chaat', slots: ['breakfast', 'snack'], items: [['B011', 60], ['G017', 20], ['D075', 40], ['D043', 50], ['E033', 5]] },
  { name: 'Peanuts with jaggery', slots: ['snack'], items: [['H012', 30], ['I001', 10]] },
  { name: 'Fruit bowl with walnuts', slots: ['snack'], items: [['E001', 150], ['E028', 100], ['H021', 10]] },
  { name: 'Roasted chana and milk', slots: ['snack'], items: [['B002', 30], ['L002', 200]] },
  { name: 'Toor dal, rice and palak', slots: ['lunch', 'dinner'], items: [['B021', 50], ['A015', 70], ['C033', 100], ['T013', 5]] },
  { name: 'Rajma chawal', slots: ['lunch'], items: [['B020', 60], ['A015', 70], ['G017', 20], ['D075', 40], ['T005', 5]] },
  { name: 'Chole with roti', slots: ['lunch', 'dinner'], items: [['B002', 60], ['A019', 60], ['G017', 20], ['D075', 40], ['T005', 5]] },
  { name: 'Palak paneer with roti', slots: ['lunch', 'dinner'], items: [['C033', 150], ['L003', 80], ['T005', 5], ['A019', 60]] },
  { name: 'Paneer bhurji with roti', slots: ['dinner', 'breakfast'], items: [['L003', 80], ['G017', 30], ['D075', 40], ['T005', 5], ['A019', 60]] },
  { name: 'Soya bean curry with roti', slots: ['lunch', 'dinner'], items: [['B025', 40], ['A019', 60], ['G017', 20], ['D075', 40], ['T005', 5]] },
  { name: 'Veg pulao with paneer and peas', slots: ['lunch'], items: [['A015', 70], ['D061', 40], ['F002', 30], ['L003', 40], ['T013', 5]] },
  { name: 'Moong dal khichdi', slots: ['dinner', 'lunch'], items: [['A015', 50], ['B010', 40], ['D061', 30], ['T013', 5]] },
  { name: 'Bajra roti with moong dal', slots: ['dinner', 'lunch'], items: [['A003', 60], ['B010', 40], ['T013', 5]] },
];

function roundGrams(g, base) {
  const step = base >= 150 ? 10 : 5;
  return Math.max(step, Math.round(g / step) * step);
}

export function buildIdea(idea, foodsById, scale) {
  const parts = [];
  for (const [id, grams, label] of idea.items) {
    const food = foodsById[id];
    if (!food) return null; // data missing: never show a half-computed meal
    const g = roundGrams(grams * scale, grams);
    parts.push({ id, name: label || food.name, hi: food.hi, grams: g, ...nutritionFor(food, g) });
  }
  return { name: idea.name, parts, total: sumNutrition(parts) };
}

// Picks meal ideas for a slot whose portions best hit the calorie and protein
// budget. `seed` rotates ties so the list changes from day to day.
export function suggestMeals({ slot, kcal, protein, foodsById, seed = 0, count = 3 }) {
  if (kcal <= 0) return [];
  const out = [];
  for (const idea of MEAL_IDEAS) {
    if (!idea.slots.includes(slot)) continue;
    const base = buildIdea(idea, foodsById, 1);
    if (!base || base.total.kcal <= 0) continue;
    const scale = Math.min(2.5, Math.max(0.5, kcal / base.total.kcal));
    const meal = buildIdea(idea, foodsById, scale);
    const kErr = Math.abs(meal.total.kcal - kcal) / kcal;
    const pErr = protein > 0 ? Math.max(0, protein - meal.total.p) / protein : 0;
    out.push({ ...meal, slot, score: kErr + pErr * 1.5 });
  }
  out.sort((a, b) => a.score - b.score);
  // rotate among the close candidates so the same three don't show every day
  const good = out.filter((m) => m.score <= out[0]?.score + 0.25);
  const rest = out.filter((m) => !good.includes(m));
  const shift = good.length ? seed % good.length : 0;
  return [...good.slice(shift), ...good.slice(0, shift), ...rest].slice(0, count);
}

// Splits what is left of today's budget across the meals not logged yet
export function remainingSlots(targets, entries) {
  const eaten = sumNutrition(entries);
  const logged = new Set(entries.map((e) => e.meal));
  const open = MEALS.filter((m) => !logged.has(m.id));
  const shareSum = open.reduce((s, m) => s + m.share, 0);
  const leftK = Math.max(0, targets.kcal - eaten.kcal);
  const leftP = Math.max(0, targets.protein - eaten.p);
  return {
    eaten,
    left: { kcal: leftK, p: Math.round(leftP) },
    slots: open.map((m) => ({
      ...m,
      kcal: shareSum ? Math.round((leftK * m.share) / shareSum) : 0,
      protein: shareSum ? Math.round((leftP * m.share) / shareSum) : 0,
    })),
  };
}
