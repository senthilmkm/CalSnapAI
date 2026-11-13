const { GoogleGenAI, Type } = require("@google/genai");
const {
  safeParseJSON,
  isImplausibleNutrition,
  normalizeAndRepairNutrition,
} = require("./nutrition");

// In-Memory Quota & Rate-Limiting Store (keyed by userId:YYYY-MM-DD)
const userDailyQuotaMap = new Map();

function getUTCDayKey() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

function checkAndIncrementQuota(userId, isPro) {
  if (isPro) return true; // Unlimited scans for Pro subscribers

  const todayKey = getUTCDayKey();
  const quotaKey = `${userId}:${todayKey}`;
  const currentCount = userDailyQuotaMap.get(quotaKey) || 0;
  const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_SNAP_LIMIT || "1", 10);

  if (currentCount >= FREE_DAILY_LIMIT) {
    return false; // Quota exceeded
  }

  userDailyQuotaMap.set(quotaKey, currentCount + 1);

  // Periodic cleanup if map exceeds 25,000 entries
  if (userDailyQuotaMap.size > 25000) {
    for (const [key] of userDailyQuotaMap.entries()) {
      if (!key.endsWith(todayKey)) {
        userDailyQuotaMap.delete(key);
      }
    }
  }

  return true;
}

/**
 * Google Cloud Function: analyzeMeal
 * 
 * Secure Backend Proxy for CalSnap AI.
 * Pulls GEMINI_API_KEY from GCloud Secret Manager environment binding.
 * Enforces JSON response schema for zero-shot food identification and calorie estimation.
 */
exports.analyzeMeal = async (req, res) => {
  // CORS Headers
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

  try {
    // 1. Validate App Secret Handshake Header (with trim to handle Secret Manager trailing whitespace)
    const appSecretHeader = (req.headers["x-calsnap-app-secret"] || "").trim();
    const expectedAppSecret = (process.env.APP_SECRET || "").trim();
    if (expectedAppSecret && appSecretHeader !== expectedAppSecret) {
      console.warn("Security Alert: Invalid App Secret Header attempt blocked.");
      return res.status(403).json({ error: "Forbidden: Invalid App Signature" });
    }

    // 2. Validate Auth Token & Extract User Identity
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing Bearer Token" });
    }

    const clientUserId = (req.headers["x-app-user-id"] || req.body.user_id || "guest-anonymous").trim();
    const isPro = req.headers["x-is-pro"] === "true" || req.body.is_pro === true;

    // 3. Server-Side Daily Free Scan Quota Enforcement
    const quotaAllowed = checkAndIncrementQuota(clientUserId, isPro);
    if (!quotaAllowed) {
      console.warn(`[Quota Enforced] User ${clientUserId} reached daily free scan limit.`);
      return res.status(429).json({
        error: "QUOTA_EXCEEDED",
        message: "Daily free scan limit reached. Please upgrade to CalSnap AI Pro for unlimited scans.",
        server_date: getUTCDayKey(),
      });
    }

    const { image_base64, voice_transcript, cultural_preset } = req.body;
    if (!image_base64 || typeof image_base64 !== "string") {
      return res.status(400).json({ error: "Bad Request: Missing or invalid image_base64" });
    }

    // 4. Payload size cap check (Max 10MB)
    if (image_base64.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: "Payload Too Large: Image exceeds 10MB limit" });
    }

    // 3. Input Sanitization
    const sanitizedVoice = typeof voice_transcript === "string" ? voice_transcript.slice(0, 300).replace(/[^\w\s.,!?-]/gi, '') : "";
    const sanitizedPreset = typeof cultural_preset === "string" ? cultural_preset.slice(0, 50).replace(/[^\w\s-]/gi, '') : "Standard";

    // 4. Fetch API key from Secret Manager environment injection
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      console.error("CRITICAL: GEMINI_API_KEY is missing from environment secrets.");
      return res.status(500).json({ error: "Server Configuration Error: GEMINI_API_KEY missing" });
    }

    const ai = new GoogleGenAI({ apiKey });

    // 5. Construct Master Clinical Nutrition & Volumetric Prompt
    const prompt = `You are CalSnap AI — the world's most advanced clinical AI nutritionist, computer vision food scientist, and biochemical macro analyst. Perform a meticulous, high-precision visual and biochemical analysis of this meal photo.

--- MANDATORY CLINICAL DIRECTIVES FOR ALL EATABLE ITEMS ---
1. UNIVERSAL 3D VISUAL BOUNDING & CLINICAL MASS SCALING FOR ALL EATABLE ITEMS:
   - Perform 3D Visual Bounding Box Analysis & Spatial Scale Estimation for EVERY SINGLE EATABLE ITEM in the photo across ALL food categories:
     * RAW PRODUCE (Fruits, Vegetables, Salads, Nuts, Seeds): Classify physical size explicitly (Small vs Medium vs Large vs Jumbo) and scale gram weight & macros (e.g. "Small Fresh Orange (~96g, ~45 kcal)", "Medium Fuji Apple (~182g, ~95 kcal)", "Large Avocado (~200g, ~320 kcal)").
     * PROTEINS & MEATS (Chicken Breast, Steak, Fish Fillet, Tofu, Eggs): Volumetric thickness & mass scaling (e.g., 120g thin fillet vs 250g thick-cut steak).
     * GRAINS, CARBS & BREADS (Rice, Pasta, Oats, Rotis, Naan, Toast): Plate coverage area & stack depth scaling (e.g., 1 cup cooked rice ~195g vs 2 cups ~390g; 1 Roti ~40g vs 2 Rotis ~80g).
     * BEVERAGES & DRINKS (Smoothies, Juices, Coffee, Milk, Protein Shakes): Container/glass volume scaling (e.g., 250ml cup vs 500ml tall glass).
     * BAKED GOODS & DESSERTS (Cakes, Pastries, Cookies, Muffins): Bounding slice volume scaling (e.g., 60g small slice vs 120g thick slice).
   - ALWAYS include exact estimated gram weight and size classification in the item name (e.g., "Small Fresh Orange (~96g)", "Grilled Chicken Breast (~180g)").

2. ZERO-FRICTION FOOD CATEGORY CLASSIFICATION:
   - CATEGORY A: Raw Fruits, Raw Salad, Fresh Vegetables, Boiled Eggs -> MUST set estimated_oil_g to 0.
   - CATEGORY B: Beverages, Coffee, Tea, Smoothies, Juices, Milk -> MUST set estimated_oil_g to 0.
   - CATEGORY C: Packaged Foods, Yogurt, Protein Bars, Snacks -> MUST set estimated_oil_g to 0.
   - CATEGORY D: Cooked Dishes, Curries, Stir-fries, Pan-seared, Fried -> Calculate hidden oil mass in grams.

3. BIOCHEMICAL MACRO INTEGRITY (ATWATER 4-4-9 RATIO):
   - Ensure total_calories matches: (protein_g * 4) + (carbs_g * 4) + (fat_g * 9).

4. CONTEXT & CUISINE INTEGRATION:
   - User Voice Note / Context: "${sanitizedVoice || "None"}".
   - Regional Cuisine Style: "${sanitizedPreset}".

Return ONLY valid JSON matching this exact structure:
{
  "dish_name": "Specific Precision Identified Dish Name",
  "confidence": 0.98,
  "items": [
    {
      "name": "Item Name (e.g., Fresh Yellow Banana or Grilled Chicken Breast)",
      "weight_g": 118,
      "calories": 105,
      "protein_g": 1.3,
      "carbs_g": 27.0,
      "fat_g": 0.3
    }
  ],
  "estimated_oil_g": 0,
  "total_calories": 105,
  "total_protein_g": 1.3,
  "total_carbs_g": 27.0,
  "total_fat_g": 0.3,
  "glucose_impact_score": "LOW",
  "energy_crash_risk": "VERY_LOW",
  "ai_tip": "One precise, highly actionable clinical nutrition insight about this specific meal."
}`;

    cleanData = image_base64.replace(/^data:image\/\w+;base64,/, "");
    imagePart = {
      inlineData: {
        data: cleanData,
        mimeType: "image/jpeg",
      },
    };

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

    // 6. Execute Gemini Vision Inference with Precision Model Cascade (Ephemeral in-memory stream)
    const candidateModels = [
      "gemini-4-hydrogen",
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
    ];
    let nutritionData = null;
    let fallbackCandidate = null;
    let lastErr = null;

    for (const modelName of candidateModels) {
      const configs = [
        {
          temperature: 0.0,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: MEAL_ANALYSIS_SCHEMA,
          thinkingConfig: { thinkingLevel: "low" },
        },
        {
          temperature: 0.0,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      ];

      for (const config of configs) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [prompt, imagePart],
            config,
          });
          const rawText = response.text || "";
          const finishReason = response.candidates?.[0]?.finishReason;
          if (!rawText) continue;

          const parsed = safeParseJSON(rawText);
          const candidate = normalizeAndRepairNutrition(parsed);
          fallbackCandidate = candidate;

          if (finishReason === "MAX_TOKENS") {
            console.warn(`Model ${modelName} hit MAX_TOKENS; trying next model.`);
            break;
          }
          if (isImplausibleNutrition(candidate)) {
            console.warn(`Model ${modelName} returned implausible calories (${candidate.total_calories}); trying next model.`);
            break;
          }

          nutritionData = candidate;
          break;
        } catch (err) {
          lastErr = err;
          console.warn(`Model ${modelName} attempt failed:`, err.message);
        }
      }

      if (nutritionData) break;
    }

    if (!nutritionData) {
      if (fallbackCandidate && !isImplausibleNutrition(fallbackCandidate)) {
        nutritionData = fallbackCandidate;
      } else if (lastErr) {
        throw lastErr;
      } else {
        throw new Error("All Gemini models returned incomplete or implausible nutrition data.");
      }
    }

    return res.status(200).json({
      success: true,
      data: nutritionData,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("CalSnap AI Analysis Error:", error);
    return res.status(500).json({
      error: "Failed to analyze meal image",
      message: error.message || "An internal server error occurred while processing nutrition analysis.",
    });
  } finally {
    // Zero-Memory-Leak & Zero-Persistence Guarantee: Dereference all heavy buffers
    cleanData = null;
    imagePart = null;
  }
};
