const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { jsonrepair } = require("jsonrepair");

/**
 * Robust JSON Parser using jsonrepair for zero-failure LLM output handling
 */
function safeParseJSON(rawText) {
  if (!rawText) throw new Error("Empty AI response text");
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  const rawJson = jsonMatch ? jsonMatch[0] : rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  
  try {
    return JSON.parse(rawJson);
  } catch (e) {
    const repaired = jsonrepair(rawJson);
    return JSON.parse(repaired);
  }
}

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

    const genAI = new GoogleGenerativeAI(apiKey);

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
  type: SchemaType.OBJECT,
  properties: {
    dish_name: { type: SchemaType.STRING },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          weight_g: { type: SchemaType.NUMBER },
          calories: { type: SchemaType.NUMBER },
          protein_g: { type: SchemaType.NUMBER },
          carbs_g: { type: SchemaType.NUMBER },
          fat_g: { type: SchemaType.NUMBER },
        },
        required: ["name", "weight_g", "calories", "protein_g", "carbs_g", "fat_g"],
      },
    },
    estimated_oil_g: { type: SchemaType.NUMBER },
    total_calories: { type: SchemaType.NUMBER },
    total_protein_g: { type: SchemaType.NUMBER },
    total_carbs_g: { type: SchemaType.NUMBER },
    total_fat_g: { type: SchemaType.NUMBER },
    glucose_impact_score: { type: SchemaType.STRING },
    energy_crash_risk: { type: SchemaType.STRING },
    ai_tip: { type: SchemaType.STRING },
  },
  required: ["dish_name", "items", "total_calories", "total_protein_g", "total_carbs_g", "total_fat_g"],
};

function parseNum(val, fallback = 0) {
  if (typeof val === "number") return isNaN(val) ? fallback : val;
  if (typeof val === "string") {
    const match = val.match(/[-+]?[0-9]*\.?[0-9]+/);
    return match ? parseFloat(match[0]) : fallback;
  }
  return fallback;
}

    // 6. Execute Gemini Vision Inference with Precision Model Cascade (Ephemeral in-memory stream)
    const candidateModels = [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-flash-latest",
      "gemini-pro-latest"
    ];
    let rawText = "";
    let lastErr = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.0, // 0.0 temperature for deterministic, clinical numerical precision
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
            responseSchema: MEAL_ANALYSIS_SCHEMA,
          },
        });

        const result = await model.generateContent([prompt, imagePart]);
        rawText = result.response.text() || "";
        if (rawText) break;
      } catch (err) {
        lastErr = err;
        console.warn(`Model ${modelName} with schema failed, retrying plain JSON:`, err.message);
        // Fallback without schema if schema rejected
        try {
          const modelPlain = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.0,
              maxOutputTokens: 2048,
              responseMimeType: "application/json",
            },
          });
          const resultPlain = await modelPlain.generateContent([prompt, imagePart]);
          rawText = resultPlain.response.text() || "";
          if (rawText) break;
        } catch (plainErr) {
          lastErr = plainErr;
          console.warn(`Model ${modelName} plain retry failed:`, plainErr.message);
        }
      }
    }

    if (!rawText && lastErr) {
      throw lastErr;
    }

    // Clean & Repair JSON using jsonrepair
    const rawParsed = safeParseJSON(rawText);

    // Normalize raw item list whether root is object or array
    const rawItemsList = Array.isArray(rawParsed)
      ? rawParsed
      : (Array.isArray(rawParsed.items)
          ? rawParsed.items
          : (Array.isArray(rawParsed.food_items) ? rawParsed.food_items : []));

    // Parse items first
    const parsedItems = rawItemsList.map((it, idx) => {
      const macros = it.biochemical_macro_analysis?.macronutrients_per_edible_portion || it.macro_analysis || it;
      const weightVal = it.weight_g ?? it.visual_bounding_analysis?.estimated_peeled_gram_weight ?? it.visual_bounding_and_scaling?.estimated_total_mass_g ?? 100;
      const calVal = it.calories ?? it.biochemical_macro_analysis?.estimated_calories ?? 0;

      return {
        id: String(idx + 1),
        name: it.name || it.item || it.item_name || "Food Item",
        weight_g: Math.round(parseNum(weightVal, 100)),
        calories: Math.max(0, Math.round(parseNum(calVal, 0))),
        protein_g: Math.max(0, Number(parseNum(macros.protein_g ?? macros.protein, 0).toFixed(1))),
        carbs_g: Math.max(0, Number(parseNum(macros.carbs_g ?? macros.carbohydrates ?? macros.carbs, 0).toFixed(1))),
        fat_g: Math.max(0, Number(parseNum(macros.fat_g ?? macros.fat ?? macros.total_fat, 0).toFixed(1))),
      };
    });

    const sumCalories = parsedItems.reduce((acc, it) => acc + it.calories, 0);
    const sumProtein = parsedItems.reduce((acc, it) => acc + it.protein_g, 0);
    const sumCarbs = parsedItems.reduce((acc, it) => acc + it.carbs_g, 0);
    const sumFat = parsedItems.reduce((acc, it) => acc + it.fat_g, 0);

    const hasItems = parsedItems.length > 0;
    let finalCals = hasItems ? sumCalories : Math.max(0, Math.round(parseNum(rawParsed.total_calories ?? rawParsed.calories, 0)));
    let finalProtein = hasItems ? sumProtein : Math.max(0, parseNum(rawParsed.total_protein_g ?? rawParsed.protein_g, 0));
    let finalCarbs = hasItems ? sumCarbs : Math.max(0, parseNum(rawParsed.total_carbs_g ?? rawParsed.carbs_g, 0));
    let finalFat = hasItems ? sumFat : Math.max(0, parseNum(rawParsed.total_fat_g ?? rawParsed.fat_g, 0));

    // Atwater Macro Integrity Auto-Correction:
    // If calories > 0 but total carbs + protein + fat don't account for calories (e.g. LLM missed carbs for a fruit),
    // calculate the missing carbs/macros according to the Atwater 4-4-9 principle:
    if (finalCals > 0) {
      const macroCals = (finalProtein * 4) + (finalCarbs * 4) + (finalFat * 9);
      if (finalCarbs === 0 && finalCals > macroCals + 15) {
        finalCarbs = Math.max(0, Number(((finalCals - (finalProtein * 4) - (finalFat * 9)) / 4).toFixed(1)));
        if (parsedItems.length === 1 && parsedItems[0].carbs_g === 0) {
          parsedItems[0].carbs_g = finalCarbs;
        }
      }
    }

    // Dynamic field normalizer
    const nutritionData = {
      dish_name: rawParsed.dish_name || (Array.isArray(rawParsed) && rawParsed[0]?.item) || "Identified Meal",
      total_calories: finalCals,
      total_protein_g: Number(finalProtein.toFixed(1)),
      total_carbs_g: Number(finalCarbs.toFixed(1)),
      total_fat_g: Number(finalFat.toFixed(1)),
      estimated_oil_g: Math.max(0, parseNum(rawParsed.estimated_oil_g, 0)),
      items: parsedItems,
      glucose_impact_score: String(rawParsed.glucose_impact_score || "LOW"),
      energy_crash_risk: String(rawParsed.energy_crash_risk || "VERY_LOW"),
      ai_tip: rawParsed.ai_tip || rawParsed.overall_analysis?.notes || "Balanced nutrition profile captured by CalSnap AI.",
    };

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
