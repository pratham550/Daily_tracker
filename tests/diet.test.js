import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  calcTargets, nutritionFor, sumNutrition, searchFoods, suggestMeals, remainingSlots,
  MEAL_IDEAS, buildIdea, proteinDenseFoods,
} from '../src/lib/diet.js';

const db = JSON.parse(readFileSync(new URL('../src/data/foods.json', import.meta.url), 'utf8'));
const foods = db.foods;
const byId = Object.fromEntries(foods.map((f) => [f.id, f]));

describe('foods.json (generated from IFCT 2017)', () => {
  it('contains only vegetarian groups', () => {
    const nonVeg = /egg|poultry|meat|fish|shellfish|mollusk/i;
    expect(foods.length).toBeGreaterThan(300);
    for (const f of foods) expect(f.group).not.toMatch(nonVeg);
    // IFCT codes M..S are egg, poultry, meat and fish
    for (const f of foods) expect('MNOPQRS'.includes(f.id[0])).toBe(false);
  });

  it('energy agrees with protein, fat and carbs using IFCT factors', () => {
    // IFCT energy = 17p + 37f + 17c kJ (fibre not counted); allow 12% or 15 kcal.
    // Two published IFCT values legitimately differ: lemon juice (organic acids
    // and other components) and fenugreek seeds. We keep IFCT's figure for both.
    const knownExceptions = ['E033', 'G026'];
    const off = [];
    for (const f of foods) {
      if (knownExceptions.includes(f.id)) continue;
      const fromMacros = (f.p * 17 + f.f * 37 + f.c * 17) / 4.184;
      if (Math.abs(fromMacros - f.kcal) > Math.max(15, f.kcal * 0.12)) off.push(`${f.id} ${f.name}: ${f.kcal} vs ${Math.round(fromMacros)}`);
    }
    expect(off).toEqual([]);
  });

  it('has no duplicate ids and no negative values', () => {
    expect(new Set(foods.map((f) => f.id)).size).toBe(foods.length);
    for (const f of foods) for (const k of ['kcal', 'p', 'c', 'f', 'fi']) expect(f[k]).toBeGreaterThanOrEqual(0);
  });

  it('every meal idea refers to foods that exist', () => {
    for (const idea of MEAL_IDEAS) {
      for (const [id] of idea.items) expect(byId[id], `${idea.name} uses ${id}`).toBeDefined();
      expect(buildIdea(idea, byId, 1)).not.toBeNull();
    }
  });
});

describe('targets', () => {
  it('matches Mifflin-St Jeor worked by hand', () => {
    // male, 25 y, 175 cm, 70 kg: 700 + 1093.75 - 125 + 5 = 1673.75
    const t = calcTargets({ sex: 'male', age: 25, heightCm: 175, weightKg: 70, activity: 'moderate', goal: 'maintain' });
    expect(t.bmr).toBe(1674);
    expect(t.tdee).toBe(Math.round(1674 * 1.55));
    expect(t.kcal).toBe(Math.round(t.tdee / 10) * 10);
    expect(t.protein).toBe(112);
    expect(t.protein * 4 + t.fat * 9 + t.carbs * 4).toBeGreaterThan(t.kcal - 15);
    expect(t.protein * 4 + t.fat * 9 + t.carbs * 4).toBeLessThan(t.kcal + 15);
  });
  it('never goes below a safe floor', () => {
    const t = calcTargets({ sex: 'female', age: 60, heightCm: 145, weightKg: 40, activity: 'sedentary', goal: 'lose' });
    expect(t.kcal).toBe(1200);
  });
  it('returns null until the profile is filled', () => {
    expect(calcTargets({ sex: 'male' })).toBeNull();
  });
});

describe('portions and suggestions', () => {
  it('scales per-100 g values', () => {
    const paneer = byId.L003;
    const n = nutritionFor(paneer, 50);
    expect(n.kcal).toBe(Math.round(paneer.kcal / 2));
    // values are rounded to 0.1 g
    expect(Math.abs(n.p - paneer.p / 2)).toBeLessThanOrEqual(0.05 + 1e-9);
  });

  it('search finds Hindi names', () => {
    expect(searchFoods(foods, 'rajma').length).toBeGreaterThan(0);
    expect(searchFoods(foods, 'atta')[0].id).toBe('A019');
  });

  it('suggestions land near the calorie budget and their totals add up', () => {
    for (const slot of ['breakfast', 'lunch', 'snack', 'dinner']) {
      for (const kcal of [250, 500, 800]) {
        const s = suggestMeals({ slot, kcal, protein: 30, foodsById: byId });
        expect(s.length).toBeGreaterThan(0);
        for (const m of s) {
          expect(sumNutrition(m.parts)).toEqual(m.total);
          for (const p of m.parts) expect(p.grams).toBeGreaterThan(0);
        }
        // best match within 35% of target (portions are clamped to sensible sizes)
        expect(Math.abs(s[0].total.kcal - kcal) / kcal).toBeLessThan(0.35);
      }
    }
  });

  it('remaining budget is split across unlogged meals', () => {
    const t = { kcal: 2400, protein: 120 };
    const r = remainingSlots(t, [{ meal: 'breakfast', kcal: 600, p: 30 }]);
    expect(r.left).toEqual({ kcal: 1800, p: 90 });
    expect(r.slots.map((s) => s.id)).toEqual(['lunch', 'snack', 'dinner']);
    expect(r.slots.reduce((a, s) => a + s.kcal, 0)).toBeGreaterThanOrEqual(1798);
  });

  it('protein list shows eatable staples, not spices or leaves', () => {
    const top = proteinDenseFoods(foods, 10);
    expect(top.length).toBe(10);
    for (const f of top) {
      expect(f.p).toBeGreaterThanOrEqual(15);
      expect(f.group).not.toMatch(/Spices|Leafy/);
    }
    for (let i = 1; i < top.length; i++) expect(top[i - 1].density).toBeGreaterThanOrEqual(top[i].density);
  });
});
