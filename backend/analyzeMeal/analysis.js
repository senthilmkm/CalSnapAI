const MODEL_NAME = "gemini-3.5-flash-lite";
const ANALYSIS_BUDGET_MS = 18000;
const MIN_ATTEMPT_MS = 1000;
const MAX_ATTEMPTS = 2;

function buildMealPrompt(voice, preset) {
  const note = typeof voice === "string" && voice.trim() ? voice.trim() : "None";
  const style = typeof preset === "string" && preset.trim() ? preset.trim() : "Standard";
  return [
    "You are CalSnap AI. Identify the meal in this photo and estimate an adult serving.",
    `Voice note: "${note}". Cuisine: "${style}".`,
    "List each visible food with a realistic gram weight.",
    "Raw fruit, salad, vegetables, boiled eggs, drinks, and packaged snacks have 0g oil. Cooked dishes include hidden oil.",
    "total_calories must match protein_g*4 + carbs_g*4 + fat_g*9.",
    "glucose_impact_score is LOW, MEDIUM, or HIGH.",
    "energy_crash_risk is VERY_LOW, LOW, MEDIUM, or HIGH.",
    "ai_tip is one short sentence about this meal.",
    "Return JSON only.",
  ].join("\n");
}

function generationConfig(schema) {
  return {
    temperature: 0,
    maxOutputTokens: 2048,
    responseMimeType: "application/json",
    responseSchema: schema,
    thinkingConfig: { thinkingBudget: 0 },
  };
}

function timeoutError() {
  const error = new Error("Meal analysis timed out");
  error.code = "ANALYSIS_TIMEOUT";
  return error;
}

function withDeadline(work, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(timeoutError()), ms);
  });
  return Promise.race([Promise.resolve(work), timeout]).finally(() => clearTimeout(timer));
}

async function analyzeMealPhoto(options) {
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const budgetMs = Number.isFinite(options.budgetMs) ? options.budgetMs : ANALYSIS_BUDGET_MS;
  const maxAttempts = Number.isFinite(options.maxAttempts) ? options.maxAttempts : MAX_ATTEMPTS;
  const startedAt = now();
  let lastError = null;

  if (maxAttempts < 1) {
    throw new Error("Meal analysis failed");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const remaining = budgetMs - (now() - startedAt);
    if (remaining < MIN_ATTEMPT_MS) {
      throw timeoutError();
    }

    try {
      const response = await withDeadline(
        options.generate({
          model: MODEL_NAME,
          contents: options.contents,
          config: options.config,
        }),
        remaining
      );
      const rawText = response && typeof response.text === "string" ? response.text : "";
      const finishReason =
        response && response.candidates && response.candidates[0]
          ? response.candidates[0].finishReason
          : "";
      if (!rawText) {
        lastError = new Error("Empty meal analysis");
        continue;
      }

      const candidate = options.repair(options.parse(rawText));
      if (finishReason === "MAX_TOKENS") {
        lastError = new Error("Meal analysis was cut off");
        continue;
      }
      if (options.isImplausible(candidate)) {
        lastError = new Error("Meal analysis was incomplete");
        continue;
      }
      return candidate;
    } catch (err) {
      lastError = err || new Error("Meal analysis failed");
      if (lastError.code === "ANALYSIS_TIMEOUT") {
        throw lastError;
      }
    }
  }

  throw lastError;
}

module.exports = {
  MODEL_NAME,
  ANALYSIS_BUDGET_MS,
  MIN_ATTEMPT_MS,
  MAX_ATTEMPTS,
  buildMealPrompt,
  generationConfig,
  timeoutError,
  withDeadline,
  analyzeMealPhoto,
};
