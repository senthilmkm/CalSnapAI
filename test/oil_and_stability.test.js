const assert = require('assert');
const { test } = require('node:test');
const { cookingOilGrams, totalsWithOil, pillForOil, finiteOil } = require('../services/oilMath');
const { summarizeDayStability, describeDayStability } = require('../services/dayStability');

test('cooking oil is added once and the model amount is kept', () => {
  assert.equal(finiteOil('no'), 0);
  assert.equal(finiteOil(-2), 0);
  assert.equal(finiteOil(0), 0);
  assert.equal(finiteOil(8), 8);

  assert.equal(cookingOilGrams(12, 'raw'), 0);
  assert.equal(cookingOilGrams(12, 'light'), 12);
  assert.equal(cookingOilGrams(3, 'heavy'), 3);
  assert.equal(cookingOilGrams('none', 'light'), 0);

  const plated = totalsWithOil(105, 0.3, 8);
  assert.equal(plated.oilGrams, 8);
  assert.equal(plated.totalCalories, 177);
  assert.equal(plated.totalFat, 8.3);

  const rawPlate = totalsWithOil(105, 0.3, 0);
  assert.equal(rawPlate.totalCalories, 105);
  assert.equal(rawPlate.totalFat, 0.3);

  const blank = totalsWithOil('bad', undefined, 5);
  assert.equal(blank.totalCalories, 45);
  assert.equal(blank.totalFat, 5);

  assert.equal(pillForOil(0), 'raw');
  assert.equal(pillForOil(5), 'light');
  assert.equal(pillForOil(15), 'heavy');
  assert.equal(pillForOil(8), null);
  assert.equal(pillForOil(-1), 'raw');
});

test('the home card uses the strongest saved glucose and energy labels', () => {
  const empty = describeDayStability(null);
  assert.equal(empty.tone, 'empty');
  assert.match(empty.text, /Log a meal/);

  const none = summarizeDayStability([]);
  assert.equal(none.hasMeals, false);
  assert.equal(none.glucose, 'LOW');
  assert.equal(none.crash, 'VERY_LOW');
  assert.equal(none.calm, true);

  const steady = describeDayStability([
    { glucose_impact_score: 'LOW', energy_crash_risk: 'VERY_LOW' },
    { glucose_impact_score: 'low', energy_crash_risk: 'very low' },
  ]);
  assert.equal(steady.tone, 'calm');
  assert.equal(steady.text, 'Glucose impact is low. Energy crash risk is very low.');

  const lowCrash = describeDayStability([{ glucose_impact_score: 'LOW', energy_crash_risk: 'LOW' }]);
  assert.equal(lowCrash.tone, 'calm');
  assert.equal(lowCrash.text, 'Glucose impact is low. Energy crash risk is low.');

  const mixed = describeDayStability([
    null,
    { glucose_impact_score: 'LOW', energy_crash_risk: 'LOW' },
    { glucose_impact_score: 'MEDIUM', energy_crash_risk: 'not-a-score' },
    { glucose_impact_score: 'HIGH', energy_crash_risk: 'MODERATE' },
    { glucose_impact_score: 'MEDIUM', energy_crash_risk: 'HIGH' },
  ]);
  assert.equal(mixed.tone, 'caution');
  assert.equal(mixed.text, 'Glucose impact is high. Energy crash risk is high.');

  const moderate = summarizeDayStability([{ glucose_impact_score: '', energy_crash_risk: 'MEDIUM' }]);
  assert.equal(moderate.glucose, 'LOW');
  assert.equal(moderate.crash, 'MEDIUM');
  assert.equal(moderate.calm, false);
});
