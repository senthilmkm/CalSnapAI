const { jsonrepair } = require("jsonrepair");

function safeParseJSON(rawText) {
  if (!rawText) throw new Error("Empty AI response text");
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  const rawJson = jsonMatch ? jsonMatch[0] : rawText.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(rawJson);
  } catch {
    const repaired = jsonrepair(rawJson);
    return JSON.parse(repaired);
  }
}

function parseNum(val, fallback = 0) {
  if (typeof val === "number") return Number.isNaN(val) ? fallback : val;
  if (typeof val === "string") {
    const match = val.match(/[-+]?[0-9]*\.?[0-9]+/);
    return match ? parseFloat(match[0]) : fallback;
  }
  return fallback;
}

const ZERO_CAL_BEVERAGE_RE = /\b(water|sparkling water|mineral water|seltzer|black coffee|espresso|americano|plain tea|green tea|herbal tea|black tea|unsweetened tea|diet soda|diet coke|coke zero|zero sugar)\b/i;
const SOLID_FOOD_RE = /\b(rice|egg|eggs|chicken|beef|pork|fish|salmon|shrimp|dal|lentil|curry|bread|roti|naan|pasta|noodle|salad|vegetable|veggie|fruit|banana|apple|oat|cheese|yogurt|milk|latte|smoothie|juice|cake|cookie|pizza|burger|sandwich|bowl|plate)\b/i;

function isZeroCalorieBeverage(dishName, items = []) {
  const combined = [dishName || "", ...items.map((it) => it?.name || "")].join(" ");
  return ZERO_CAL_BEVERAGE_RE.test(combined) && !SOLID_FOOD_RE.test(combined);
}

function isImplausibleNutrition(nutritionData) {
  if (!nutritionData) return true;
  const items = Array.isArray(nutritionData.items) ? nutritionData.items : [];
  if (isZeroCalorieBeverage(nutritionData.dish_name, items)) {
    return false;
  }

  const totalCals = Number(nutritionData.total_calories) || 0;
  const totalWeight = items.reduce((acc, it) => acc + (Number(it.weight_g) || 0), 0);

  if (totalCals <= 0) return true;
  if (totalCals <= 10 && (totalWeight >= 50 || items.length > 0)) return true;
  return false;
}

function normalizeAndRepairNutrition(rawParsed) {
  const rawItemsList = Array.isArray(rawParsed)
    ? rawParsed
    : Array.isArray(rawParsed.items)
      ? rawParsed.items
      : Array.isArray(rawParsed.food_items)
        ? rawParsed.food_items
        : [];

  let parsedItems = rawItemsList.map((it, idx) => {
    const macros = it.biochemical_macro_analysis?.macronutrients_per_edible_portion || it.macro_analysis || it;
    const weightVal =
      it.weight_g ??
      it.visual_bounding_analysis?.estimated_peeled_gram_weight ??
      it.visual_bounding_and_scaling?.estimated_total_mass_g ??
      100;
    const calVal = it.calories ?? it.biochemical_macro_analysis?.estimated_calories ?? 0;

    const protein = Math.max(0, Number(parseNum(macros.protein_g ?? macros.protein, 0).toFixed(1)));
    const carbs = Math.max(0, Number(parseNum(macros.carbs_g ?? macros.carbohydrates ?? macros.carbs, 0).toFixed(1)));
    const fat = Math.max(0, Number(parseNum(macros.fat_g ?? macros.fat ?? macros.total_fat, 0).toFixed(1)));
    const macroCals = Math.round(protein * 4 + carbs * 4 + fat * 9);

    let calories = Math.max(0, Math.round(parseNum(calVal, 0)));
    if (macroCals >= 10 && (calories <= 0 || calories < macroCals * 0.5)) {
      calories = macroCals;
    }

    return {
      id: String(idx + 1),
      name: it.name || it.item || it.item_name || "Food Item",
      weight_g: Math.max(0, Math.round(parseNum(weightVal, 100))),
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
    };
  });

  const sumCalories = parsedItems.reduce((acc, it) => acc + it.calories, 0);
  const sumProtein = parsedItems.reduce((acc, it) => acc + it.protein_g, 0);
  const sumCarbs = parsedItems.reduce((acc, it) => acc + it.carbs_g, 0);
  const sumFat = parsedItems.reduce((acc, it) => acc + it.fat_g, 0);

  const rawTotalCals = Math.max(0, Math.round(parseNum(rawParsed.total_calories ?? rawParsed.calories, 0)));
  const rawTotalProtein = Math.max(0, parseNum(rawParsed.total_protein_g ?? rawParsed.protein_g, 0));
  const rawTotalCarbs = Math.max(0, parseNum(rawParsed.total_carbs_g ?? rawParsed.carbs_g, 0));
  const rawTotalFat = Math.max(0, parseNum(rawParsed.total_fat_g ?? rawParsed.fat_g, 0));
  const rawMacroCals = Math.round(rawTotalProtein * 4 + rawTotalCarbs * 4 + rawTotalFat * 9);
  const bestRawTotalCals = rawTotalCals > 0 ? rawTotalCals : rawMacroCals;

  const itemsAreUsable =
    parsedItems.length > 0 &&
    sumCalories > 0 &&
    (bestRawTotalCals <= 20 || sumCalories >= bestRawTotalCals * 0.3);

  let finalCals = itemsAreUsable ? sumCalories : bestRawTotalCals;
  let finalProtein = itemsAreUsable ? sumProtein : rawTotalProtein > 0 ? rawTotalProtein : sumProtein;
  let finalCarbs = itemsAreUsable ? sumCarbs : rawTotalCarbs > 0 ? rawTotalCarbs : sumCarbs;
  let finalFat = itemsAreUsable ? sumFat : rawTotalFat > 0 ? rawTotalFat : sumFat;

  const totalMacroCals = finalProtein * 4 + finalCarbs * 4 + finalFat * 9;
  if (finalCals <= 0 && totalMacroCals > 0) {
    finalCals = Math.round(totalMacroCals);
  } else if (finalCals > 0 && totalMacroCals > 0 && finalCals < totalMacroCals * 0.5) {
    finalCals = Math.round(totalMacroCals);
  }

  // Fill missing carbs if calories are present but carbs were omitted
  if (finalCals > 0) {
    const macroCals = finalProtein * 4 + finalCarbs * 4 + finalFat * 9;
    if (finalCarbs === 0 && finalCals > macroCals + 15) {
      finalCarbs = Math.max(0, Number(((finalCals - finalProtein * 4 - finalFat * 9) / 4).toFixed(1)));
      if (parsedItems.length === 1 && parsedItems[0].carbs_g === 0) {
        parsedItems[0].carbs_g = finalCarbs;
      }
    }
  }

  const dishName =
    rawParsed.dish_name || (Array.isArray(rawParsed) && rawParsed[0]?.item) || "Identified Meal";

  // Keep items consistent with repaired totals so portion/oil sliders never snap to 0
  if (finalCals > 0 && !itemsAreUsable) {
    const totalWeight = parsedItems.reduce((acc, it) => acc + (it.weight_g || 0), 0);
    if (parsedItems.length === 1) {
      parsedItems[0] = {
        ...parsedItems[0],
        calories: Math.round(finalCals),
        protein_g: Number(finalProtein.toFixed(1)),
        carbs_g: Number(finalCarbs.toFixed(1)),
        fat_g: Number(finalFat.toFixed(1)),
      };
    } else {
      parsedItems = [
        {
          id: "1",
          name: dishName,
          weight_g: totalWeight > 0 ? totalWeight : 250,
          calories: Math.round(finalCals),
          protein_g: Number(finalProtein.toFixed(1)),
          carbs_g: Number(finalCarbs.toFixed(1)),
          fat_g: Number(finalFat.toFixed(1)),
        },
      ];
    }
  }

  return {
    dish_name: dishName,
    total_calories: Math.round(finalCals),
    total_protein_g: Number(finalProtein.toFixed(1)),
    total_carbs_g: Number(finalCarbs.toFixed(1)),
    total_fat_g: Number(finalFat.toFixed(1)),
    estimated_oil_g: Math.max(0, parseNum(rawParsed.estimated_oil_g, 0)),
    items: parsedItems,
    glucose_impact_score: String(rawParsed.glucose_impact_score || "LOW"),
    energy_crash_risk: String(rawParsed.energy_crash_risk || "VERY_LOW"),
    ai_tip:
      rawParsed.ai_tip ||
      rawParsed.overall_analysis?.notes ||
      "Balanced nutrition profile captured by CalSnap AI.",
  };
}

module.exports = {
  safeParseJSON,
  parseNum,
  isZeroCalorieBeverage,
  isImplausibleNutrition,
  normalizeAndRepairNutrition,
};

