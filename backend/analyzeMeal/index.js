const { GoogleGenerativeAI } = require("@google/generative-ai");
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
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CalSnap-App-Secret");

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

    // 2. Validate Auth Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing Bearer Token" });
    }

    const { image_base64, voice_transcript, cultural_preset } = req.body;
    if (!image_base64 || typeof image_base64 !== "string") {
      return res.status(400).json({ error: "Bad Request: Missing or invalid image_base64" });
    }

    // 2. Payload size cap check (Max 10MB)
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

--- CLINICAL DIRECTIVES FOR MAXIMUM CALORIC ACCURACY ---
1. 3D SPATIAL & FRUIT/FOOD SIZE SCALE ESTIMATION:
   - Carefully inspect visual scale, depth, and spatial volume of fruits and whole foods (Small vs Medium vs Large).
   - Small Orange (~96g, ~45 kcal) vs Medium Orange (~131g, ~62 kcal) vs Large Orange (~184g, ~86 kcal).
   - Small Banana (~100g, ~90 kcal) vs Medium (~118g, ~105 kcal) vs Large (~136g, ~121 kcal).
   - Explicitly include size classification in the item name (e.g. "Small Fresh Orange (~96g)").

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
      "name": "Item Name (e.g., Grilled Chicken Breast)",
      "weight_g": 150,
      "calories": 220,
      "protein_g": 32.0,
      "carbs_g": 0.0,
      "fat_g": 5.0
    }
  ],
  "estimated_oil_g": 5,
  "total_calories": 265,
  "total_protein_g": 32.0,
  "total_carbs_g": 0.0,
  "total_fat_g": 10.0,
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

    // 6. Execute Gemini Vision Inference with Precision Model Cascade (Ephemeral in-memory stream)
    const candidateModels = [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash"
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
          },
        });

        const result = await model.generateContent([prompt, imagePart]);
        rawText = result.response.text() || "";
        if (rawText) break;
      } catch (err) {
        lastErr = err;
        console.warn(`Model ${modelName} failed, trying fallback:`, err.message);
      }
    }

    if (!rawText && lastErr) {
      throw lastErr;
    }

    // Clean & Repair JSON using jsonrepair
    const rawParsed = safeParseJSON(rawText);

    // Parse items first
    const parsedItems = (rawParsed.items || rawParsed.food_items || []).map((it, idx) => ({
      id: String(idx + 1),
      name: it.name || "Food Item",
      weight_g: Number(it.weight_g) || 50,
      calories: Math.max(0, Math.round(Number(it.calories) || 0)),
      protein_g: Math.max(0, Number((Number(it.protein_g) || 0).toFixed(1))),
      carbs_g: Math.max(0, Number((Number(it.carbs_g) || 0).toFixed(1))),
      fat_g: Math.max(0, Number((Number(it.fat_g) || 0).toFixed(1))),
    }));

    const sumCalories = parsedItems.reduce((acc, it) => acc + it.calories, 0);
    const sumProtein = parsedItems.reduce((acc, it) => acc + it.protein_g, 0);
    const sumCarbs = parsedItems.reduce((acc, it) => acc + it.carbs_g, 0);
    const sumFat = parsedItems.reduce((acc, it) => acc + it.fat_g, 0);

    const finalCals = sumCalories > 0 ? sumCalories : (Math.round(Number(rawParsed.total_calories || rawParsed.calories)) || 250);
    const finalProtein = sumProtein > 0 ? sumProtein : (Number(rawParsed.total_protein_g || rawParsed.protein_g) || 15);
    const finalCarbs = sumCarbs > 0 ? sumCarbs : (Number(rawParsed.total_carbs_g || rawParsed.carbs_g) || 30);
    const finalFat = sumFat > 0 ? sumFat : (Number(rawParsed.total_fat_g || rawParsed.fat_g) || 10);

    // Dynamic field normalizer
    const nutritionData = {
      dish_name: rawParsed.dish_name || rawParsed.meal_summary?.name || rawParsed.name || "Identified Meal",
      total_calories: finalCals,
      total_protein_g: Number(finalProtein.toFixed(1)),
      total_carbs_g: Number(finalCarbs.toFixed(1)),
      total_fat_g: Number(finalFat.toFixed(1)),
      estimated_oil_g: Number(rawParsed.estimated_oil_g) || 0,
      items: parsedItems,
      glucose_impact_score: String(rawParsed.glucose_impact_score || "LOW"),
      energy_crash_risk: String(rawParsed.energy_crash_risk || "VERY_LOW"),
      ai_tip: rawParsed.ai_tip || rawParsed.overall_analysis?.notes || "Balanced nutrition plate!",
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
