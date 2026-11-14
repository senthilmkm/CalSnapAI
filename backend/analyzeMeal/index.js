const { Type } = require("@google/genai");
const {
  safeParseJSON,
  isImplausibleNutrition,
  normalizeAndRepairNutrition,
} = require("./nutrition");
const {
  MODEL_NAME,
  ANALYSIS_BUDGET_MS,
  buildMealPrompt,
  generationConfig,
  analyzeMealPhoto,
} = require("./analysis");
const { canUseDailySnap, recordDailySnap, dailySnapLimit, dayKey } = require("./quota");

const userDailyQuotaMap = new Map();

const MEAL_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    dish_name: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          weight_g: { type: Type.NUMBER },
          calories: { type: Type.NUMBER },
          protein_g: { type: Type.NUMBER },
          carbs_g: { type: Type.NUMBER },
          fat_g: { type: Type.NUMBER },
        },
        required: ["name", "weight_g", "calories", "protein_g", "carbs_g", "fat_g"],
      },
    },
    estimated_oil_g: { type: Type.NUMBER },
    total_calories: { type: Type.NUMBER },
    total_protein_g: { type: Type.NUMBER },
    total_carbs_g: { type: Type.NUMBER },
    total_fat_g: { type: Type.NUMBER },
    glucose_impact_score: { type: Type.STRING },
    energy_crash_risk: { type: Type.STRING },
    ai_tip: { type: Type.STRING },
  },
  required: ["dish_name", "items", "total_calories", "total_protein_g", "total_carbs_g", "total_fat_g"],
};

function sanitizeVoice(value) {
  return typeof value === "string" ? value.slice(0, 300).replace(/[^\w\s.,!?-]/gi, "") : "";
}

function sanitizePreset(value) {
  return typeof value === "string" && value.trim()
    ? value.slice(0, 50).replace(/[^\w\s-]/gi, "")
    : "Standard";
}

function defaultGeminiFactory(apiKey) {
  const { GoogleGenAI } = require("@google/genai");
  return new GoogleGenAI({ apiKey });
}

let geminiFactory = defaultGeminiFactory;

async function generateWithGemini(apiKey, request) {
  const ai = geminiFactory(apiKey);
  return ai.models.generateContent(request);
}

function analysisErrorMessage(error) {
  return error && error.message
    ? error.message
    : "An internal server error occurred while processing nutrition analysis.";
}

function setGeminiFactoryForTests(factory) {
  geminiFactory = factory;
}

async function analyzeMeal(req, res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CalSnap-App-Secret, X-App-User-Id, X-Is-Pro");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let cleanData = null;
  let imagePart = null;
  let outcome = null;

  try {
    const appSecretHeader = (req.headers["x-calsnap-app-secret"] || "").trim();
    const expectedAppSecret = (process.env.APP_SECRET || "").trim();
    if (expectedAppSecret && appSecretHeader !== expectedAppSecret) {
      console.warn("Security Alert: Invalid App Secret Header attempt blocked.");
      return res.status(403).json({ error: "Forbidden: Invalid App Signature" });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing Bearer Token" });
    }

    const body = req.body || {};
    const clientUserId = (req.headers["x-app-user-id"] || body.user_id || "guest-anonymous").trim();
    const isPro = req.headers["x-is-pro"] === "true" || body.is_pro === true;
    const now = new Date();
    const limit = dailySnapLimit(process.env.FREE_DAILY_SNAP_LIMIT);

    if (!canUseDailySnap(userDailyQuotaMap, clientUserId, isPro, now, limit)) {
      console.warn(`[Quota Enforced] User ${clientUserId} reached daily free scan limit.`);
      return res.status(429).json({
        error: "QUOTA_EXCEEDED",
        message: "Daily free scan limit reached. Please upgrade to CalSnap AI Pro for unlimited scans.",
        server_date: dayKey(now),
      });
    }

    const imageBase64 = body.image_base64;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "Bad Request: Missing or invalid image_base64" });
    }

    if (imageBase64.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: "Payload Too Large: Image exceeds 10MB limit" });
    }

    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      console.error("CRITICAL: GEMINI_API_KEY is missing from environment secrets.");
      return res.status(500).json({ error: "Server Configuration Error: GEMINI_API_KEY missing" });
    }

    const sanitizedVoice = sanitizeVoice(body.voice_transcript);
    const sanitizedPreset = sanitizePreset(body.cultural_preset);
    cleanData = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    imagePart = {
      inlineData: {
        data: cleanData,
        mimeType: "image/jpeg",
      },
    };

    const generate = analyzeMeal.generate || generateWithGemini;
    const nutritionData = await analyzeMealPhoto({
      budgetMs: ANALYSIS_BUDGET_MS,
      contents: [buildMealPrompt(sanitizedVoice, sanitizedPreset), imagePart],
      config: generationConfig(MEAL_ANALYSIS_SCHEMA),
      generate: (request) => generate(apiKey, request),
      parse: safeParseJSON,
      repair: normalizeAndRepairNutrition,
      isImplausible: isImplausibleNutrition,
    });

    recordDailySnap(userDailyQuotaMap, clientUserId, isPro, now);
    outcome = {
      status: 200,
      body: {
        success: true,
        data: nutritionData,
        timestamp: now.toISOString(),
      },
    };
  } catch (error) {
    console.error("CalSnap AI Analysis Error:", error);
    outcome = {
      status: 500,
      body: {
        error: "Failed to analyze meal image",
        message: analysisErrorMessage(error),
      },
    };
  } finally {
    cleanData = null;
    imagePart = null;
  }

  return res.status(outcome.status).json(outcome.body);
}

analyzeMeal.generate = null;

function resetQuotaForTests() {
  userDailyQuotaMap.clear();
  analyzeMeal.generate = null;
  geminiFactory = defaultGeminiFactory;
}

module.exports = {
  analyzeMeal,
  resetQuotaForTests,
  setGeminiFactoryForTests,
  defaultGeminiFactory,
  analysisErrorMessage,
  MODEL_NAME,
};
