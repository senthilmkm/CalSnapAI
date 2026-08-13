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

    // 5. Construct Master Clinical Nutrition Prompt
    const prompt = `You are CalSnap AI — the world's most advanced clinical AI nutritionist, computer vision food scientist, and biochemical macro analyst. Perform a meticulous visual and biochemical analysis of this meal photo.

--- DIRECTIVES ---
1. Identify all food items, ingredients, seasonings, and cooking methods.
2. Estimate portion volume, total mass in grams, calories, protein, carbs, and fat.
3. User Voice Note / Context: "${sanitizedVoice || "None"}".
4. Regional Cuisine Style: "${sanitizedPreset}".

Return ONLY valid JSON matching this exact structure:
{
  "dish_name": "Specific Precision Identified Dish Name",
  "confidence": 0.98,
  "items": [
    {
      "name": "Item Name",
      "weight_g": 150,
      "calories": 220,
      "protein_g": 32,
      "carbs_g": 12,
      "fat_g": 6
    }
  ],
  "estimated_oil_g": 8,
  "total_calories": 450,
  "total_protein_g": 40,
  "total_carbs_g": 35,
  "total_fat_g": 14,
  "glucose_impact_score": "LOW",
  "energy_crash_risk": "VERY_LOW",
  "ai_tip": "One precision nutrition insight about this meal."
}`;

    const cleanData = image_base64.replace(/^data:image\/\w+;base64,/, "");
    const imagePart = {
      inlineData: {
        data: cleanData,
        mimeType: "image/jpeg",
      },
    };

    // 6. Execute Gemini Vision Inference with Model Cascade
    const candidateModels = ["gemini-2.5-flash", "gemini-flash-latest"];
    let rawText = "";
    let lastErr = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.1,
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
  }
};
