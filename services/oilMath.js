function finiteOil(value) {
  const oil = Number(value);
  if (!Number.isFinite(oil) || oil <= 0) return 0;
  return oil;
}

function cookingOilGrams(modelOil, cookingStyle) {
  if (cookingStyle === "raw") return 0;
  return finiteOil(modelOil);
}

function totalsWithOil(baseCalories, baseFat, oilGrams) {
  const oil = finiteOil(oilGrams);
  const foodCalories = Number.isFinite(Number(baseCalories)) ? Number(baseCalories) : 0;
  const foodFat = Number.isFinite(Number(baseFat)) ? Number(baseFat) : 0;
  return {
    oilGrams: oil,
    totalCalories: Math.round(foodCalories + oil * 9),
    totalFat: Math.round((foodFat + oil) * 10) / 10,
  };
}

function pillForOil(oilGrams) {
  const oil = finiteOil(oilGrams);
  if (oil === 0) return "raw";
  if (oil === 5) return "light";
  if (oil === 15) return "heavy";
  return null;
}

module.exports = {
  finiteOil,
  cookingOilGrams,
  totalsWithOil,
  pillForOil,
};
