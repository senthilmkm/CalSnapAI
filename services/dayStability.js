const GLUCOSE_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const CRASH_RANK = { VERY_LOW: 0, LOW: 1, MEDIUM: 2, MODERATE: 2, HIGH: 3 };

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function strongest(current, next, ranks) {
  if (!Object.prototype.hasOwnProperty.call(ranks, next)) return current;
  if (current === null || ranks[next] > ranks[current]) return next;
  return current;
}

function summarizeDayStability(meals) {
  const list = Array.isArray(meals) ? meals : [];
  let glucose = null;
  let crash = null;

  for (const meal of list) {
    glucose = strongest(glucose, normalizeToken(meal && meal.glucose_impact_score), GLUCOSE_RANK);
    crash = strongest(crash, normalizeToken(meal && meal.energy_crash_risk), CRASH_RANK);
  }

  return {
    hasMeals: list.length > 0,
    glucose: glucose || "LOW",
    crash: crash || "VERY_LOW",
    calm: (glucose === null || glucose === "LOW") && (crash === null || crash === "VERY_LOW" || crash === "LOW"),
  };
}

function stabilityWords(token) {
  return String(token).toLowerCase().replace(/_/g, " ");
}

function describeDayStability(meals) {
  const summary = summarizeDayStability(meals);
  if (!summary.hasMeals) {
    return {
      tone: "empty",
      text: "Log a meal to see its glucose impact and energy crash risk.",
    };
  }
  return {
    tone: summary.calm ? "calm" : "caution",
    text: `Glucose impact is ${stabilityWords(summary.glucose)}. Energy crash risk is ${stabilityWords(summary.crash)}.`,
  };
}

module.exports = {
  summarizeDayStability,
  describeDayStability,
};
