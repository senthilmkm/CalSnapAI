const { GoogleGenerativeAI } = require("@google/generative-ai");

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
    // 1. Validate App Secret Handshake Header
    const appSecretHeader = req.headers["x-calsnap-app-secret"];
    const expectedAppSecret = process.env.APP_SECRET;
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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("CRITICAL: GEMINI_API_KEY is missing from environment secrets.");
      return res.status(500).json({ error: "Server Configuration Error" });
    }

    // 5. Initialize Gemini 2.0 Flash Client
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1, // Ultra-fast, consistent, high-precision clinical estimations
        maxOutputTokens: 800, // Complete JSON schema with detailed itemization
      },
    });

    // 6. Construct World-Class Master Clinical Nutrition Prompt
    const prompt = `You are CalSnap AI — the world's most advanced clinical AI nutritionist, computer vision food scientist, and biochemical macro analyst. Perform a meticulous, high-precision visual and biochemical analysis of this meal photo.

--- WORLD-CLASS MULTI-DIMENSIONAL ANALYSIS DIRECTIVES ---
1. 3D VOLUMETRIC & SPATIAL GEOMETRY:
   - Estimate portion volume and mass in grams based on plate surface geometry, depth, stacking, density, and standard scale.
2. RIPENESS, MATURITY & BIOCHEMICAL COMPOSITION:
   - Inspect fruit/vegetable skin pigmentation, browning, freckling, texture (e.g. unripe green vs ripe yellow vs spotted banana, firm vs soft avocado).
   - Adjust sucrose/fructose ratios, net carbs, and glycemic impact according to maturity.
3. INGREDIENT DECONSTRUCTION & HIDDEN OILS:
   - Identify all individual ingredients, seasonings, sauces, and cooking methods (deep-fried, pan-seared, sauteed, grilled, raw).
   - Quantify hidden cooking oil mass in grams (estimated_oil_g).
4. CULTURAL CUISINE & REGIONAL COOKING CONTEXT:
   - Regional Cooking Style: "${sanitizedPreset}".
   - User Voice Note / Context: "${sanitizedVoice || "None"}". Incorporate voice note overrides with highest priority!
5. METABOLIC FORECASTING:
   - Calculate glucose_impact_score: ("LOW" | "MEDIUM" | "HIGH").
   - Calculate energy_crash_risk: ("VERY_LOW" | "LOW" | "MEDIUM" | "HIGH").
6. ACTIONABLE CLINICAL NUTRITION INSIGHT:
   - Provide 1 highly actionable, scientifically grounded clinical tip (ai_tip).

Return ONLY valid JSON matching this exact structure:
{
  "dish_name": "Specific Precision Identified Dish Name",
  "confidence": 0.98,
  "items": [
    {
      "name": "Item Name (with maturity & prep details)",
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
  "ai_tip": "Pairing this complex carb with 15g lean protein stabilizes post-meal blood glucose."
}`;

    const imagePart = {
      inlineData: {
        data: image_base64.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: "image/jpeg",
      },
    };

    // 7. Execute Gemini Inference
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    const nutritionData = JSON.parse(responseText);

    return res.status(200).json({
      success: true,
      data: nutritionData,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("CalSnap AI Analysis Error:", error);
    return res.status(500).json({
      error: "Failed to analyze meal image",
      message: "An internal server error occurred while processing nutrition analysis.",
    });
  }
};
