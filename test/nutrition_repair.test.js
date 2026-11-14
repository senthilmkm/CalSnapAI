const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isZeroCalorieBeverage,
  isImplausibleNutrition,
  normalizeAndRepairNutrition,
} = require('../backend/analyzeMeal/nutrition');

test('repairs broken/tiny item calories using raw total_calories (prevents 48 kcal bug)', () => {
  const raw = {
    dish_name: 'Home-style Rice with Vegetables, Egg, and Cooked Eggplant',
    items: [
      { name: 'Rice with Vegetables', weight_g: 220, calories: 3, protein_g: 0, carbs_g: 0, fat_g: 0 },
      { name: 'Boiled Egg', weight_g: 50, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    ],
    estimated_oil_g: 5,
    total_calories: 485,
    total_protein_g: 16,
    total_carbs_g: 68,
    total_fat_g: 14,
  };

  const result = normalizeAndRepairNutrition(raw);
  assert.equal(result.total_calories, 485);
  assert.equal(result.items.reduce((s, it) => s + it.calories, 0), 485);
  assert.equal(isImplausibleNutrition(result), false);
});

test('repairs item calories from Atwater 4-4-9 macros when item calories are 0 or under-reported', () => {
  const raw = {
    dish_name: 'Grilled Chicken & Rice',
    items: [
      { name: 'Grilled Chicken Breast (~150g)', weight_g: 150, calories: 0, protein_g: 40, carbs_g: 0, fat_g: 5 },
      { name: 'Steamed Rice (~180g)', weight_g: 180, calories: 3, protein_g: 4, carbs_g: 50, fat_g: 0.5 },
    ],
    estimated_oil_g: 5,
    total_calories: 0,
    total_protein_g: 44,
    total_carbs_g: 50,
    total_fat_g: 5.5,
  };

  const result = normalizeAndRepairNutrition(raw);
  assert.equal(result.items[0].calories, 205);
  assert.equal(result.items[1].calories, 221);
  assert.equal(result.total_calories, 426);
  assert.equal(isImplausibleNutrition(result), false);
});

test('flags solid food with <= 10 kcal as implausible for model fallback', () => {
  const broken = normalizeAndRepairNutrition({
    dish_name: 'Home-style Rice with Vegetables and Egg',
    items: [{ name: 'Rice', weight_g: 200, calories: 3, protein_g: 0, carbs_g: 0, fat_g: 0 }],
    total_calories: 3,
    total_protein_g: 0,
    total_carbs_g: 0,
    total_fat_g: 0,
  });

  assert.equal(isImplausibleNutrition(broken), true);
});

test('allows legitimate zero-calorie beverages without flagging implausible', () => {
  const water = normalizeAndRepairNutrition({
    dish_name: 'Glass of Cold Water',
    items: [{ name: 'Water', weight_g: 250, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }],
    total_calories: 0,
    total_protein_g: 0,
    total_carbs_g: 0,
    total_fat_g: 0,
  });

  assert.equal(isZeroCalorieBeverage(water.dish_name, water.items), true);
  assert.equal(isImplausibleNutrition(water), false);
  assert.equal(water.total_calories, 0);
});

test('backend analyzeMeal module loads cleanly with one fast Gemini model', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '../backend/analyzeMeal/analysis.js'), 'utf8');
  const handlerSrc = fs.readFileSync(path.join(__dirname, '../backend/analyzeMeal/index.js'), 'utf8');
  assert.match(handlerSrc, /@google\/genai/);
  assert.match(src, /gemini-3\.5-flash-lite/);
  const handler = require('../backend/analyzeMeal/index.js');
  assert.equal(typeof handler.analyzeMeal, 'function');
  assert.equal(handler.MODEL_NAME, 'gemini-3.5-flash-lite');
});

