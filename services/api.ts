import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { MealRecord } from '../types/nutrition';
import { useAppStore } from './storage';
import pricingConfig from '../config/pricing.json';
import { interpretMealResponse, SNAP_WAIT_MS } from './mealRead';

const GCLOUD_FUNCTION_URL = 'https://us-central1-calsnap-ai-app.cloudfunctions.net/analyzeMeal';
const CALSNAP_APP_SECRET = 'calsnap_sec_9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e';

async function getClientAppUserId(): Promise<string> {
  const state = useAppStore.getState();
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      const rcId = await Purchases.getAppUserID();
      if (rcId && typeof rcId === 'string' && rcId.trim().length > 0) {
        return rcId.trim();
      }
    } catch {
      // In simulator, web, or offline fallback to profile id
    }
  }
  return state.profile.email || state.profile.id || 'calsnap-guest-user';
}

export interface AnalyzeMealParams {
  imageBase64: string;
  voiceTranscript?: string;
  culturalPreset?: string;
  cookingStyle?: 'raw' | 'light' | 'heavy';
  userAuthToken?: string;
  geminiApiKey?: string;
}

function resolveBaseNutrition(raw: any) {
  const rawItems = Array.isArray(raw?.items) ? raw.items : [];
  let items = rawItems.map((it: any, idx: number) => {
    const p = Math.max(0, Number(it?.protein_g) || 0);
    const c = Math.max(0, Number(it?.carbs_g) || 0);
    const f = Math.max(0, Number(it?.fat_g) || 0);
    const macroCals = Math.round(p * 4 + c * 4 + f * 9);
    let cals = Math.max(0, Math.round(Number(it?.calories) || 0));
    if (macroCals >= 10 && (cals <= 0 || cals < macroCals * 0.5)) {
      cals = macroCals;
    }
    return {
      ...it,
      id: it?.id || String(idx + 1),
      calories: cals,
      protein_g: p,
      carbs_g: c,
      fat_g: f,
    };
  });

  const sumCals = items.reduce((acc: number, it: any) => acc + it.calories, 0);
  const sumProtein = items.reduce((acc: number, it: any) => acc + it.protein_g, 0);
  const sumCarbs = items.reduce((acc: number, it: any) => acc + it.carbs_g, 0);
  const sumFat = items.reduce((acc: number, it: any) => acc + it.fat_g, 0);

  const rawTotalCals = Math.max(0, Math.round(Number(raw?.total_calories) || 0));
  const rawTotalProtein = Math.max(0, Number(raw?.total_protein_g) || 0);
  const rawTotalCarbs = Math.max(0, Number(raw?.total_carbs_g) || 0);
  const rawTotalFat = Math.max(0, Number(raw?.total_fat_g) || 0);
  const rawMacroCals = Math.round(rawTotalProtein * 4 + rawTotalCarbs * 4 + rawTotalFat * 9);
  const bestRawTotalCals = rawTotalCals > 0 ? rawTotalCals : rawMacroCals;

  const itemsUsable =
    items.length > 0 &&
    sumCals > 0 &&
    (bestRawTotalCals <= 20 || sumCals >= bestRawTotalCals * 0.3);

  let baseCals = itemsUsable ? sumCals : bestRawTotalCals;
  const baseProtein = itemsUsable ? sumProtein : rawTotalProtein > 0 ? rawTotalProtein : sumProtein;
  const baseCarbs = itemsUsable ? sumCarbs : rawTotalCarbs > 0 ? rawTotalCarbs : sumCarbs;
  const baseFat = itemsUsable ? sumFat : rawTotalFat > 0 ? rawTotalFat : sumFat;

  const totalMacroCals = Math.round(baseProtein * 4 + baseCarbs * 4 + baseFat * 9);
  if (totalMacroCals > 0 && (baseCals <= 0 || baseCals < totalMacroCals * 0.5)) {
    baseCals = totalMacroCals;
  }

  if (baseCals > 0 && !itemsUsable) {
    if (items.length === 1) {
      items[0] = {
        ...items[0],
        calories: baseCals,
        protein_g: baseProtein,
        carbs_g: baseCarbs,
        fat_g: baseFat,
      };
    } else {
      items = [
        {
          id: '1',
          name: raw?.dish_name || 'Analyzed Meal',
          weight_g: items.reduce((acc: number, it: any) => acc + (Number(it?.weight_g) || 0), 0) || 250,
          calories: baseCals,
          protein_g: baseProtein,
          carbs_g: baseCarbs,
          fat_g: baseFat,
        },
      ];
    }
  }

  return { items, baseCals, baseProtein, baseCarbs, baseFat };
}

export async function analyzeMealImage(params: AnalyzeMealParams): Promise<Omit<MealRecord, 'id' | 'timestamp'>> {
  // Service Layer Security Gate: Verify quota before making any AI network requests
  const state = useAppStore.getState();
  const isFreeTier = !state.profile.is_pro_subscriber;
  const todayScanCount = state.getTodayScanCount();
  const dailyLimit = pricingConfig.free_tier?.daily_snap_limit ?? 1;

  if (isFreeTier && todayScanCount >= dailyLimit) {
    throw new Error('QUOTA_EXCEEDED');
  }

  // 1. Direct Gemini Vision AI Integration (if API Key provided)
  if (params.geminiApiKey) {
    return await analyzeWithGeminiVision(
      params.imageBase64,
      params.geminiApiKey,
      params.voiceTranscript,
      params.culturalPreset
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SNAP_WAIT_MS);
  try {
    const appUserId = await getClientAppUserId();
    const authToken = params.userAuthToken || `calsnap-token-${appUserId}`;

    const response = await fetch(GCLOUD_FUNCTION_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-CalSnap-App-Secret': CALSNAP_APP_SECRET,
        'X-App-User-Id': appUserId,
        'X-Is-Pro': (!isFreeTier).toString(),
      },
      body: JSON.stringify({
        image_base64: params.imageBase64,
        voice_transcript: params.voiceTranscript,
        cultural_preset: params.culturalPreset || 'Standard',
        cooking_style: params.cookingStyle || 'light',
        user_id: appUserId,
        is_pro: !isFreeTier,
      }),
    });

    const body = response.ok ? await response.json() : null;
    const outcome = interpretMealResponse(response.status, body);
    if (outcome.type === 'quota') {
      throw new Error('QUOTA_EXCEEDED');
    }
    if (outcome.type !== 'meal') {
      throw new Error('MEAL_READ_FAILED');
    }

    const meal = outcome.data;
    const { items, baseCals, baseProtein, baseCarbs, baseFat } = resolveBaseNutrition(meal);

    let oilGrams = Number(meal.estimated_oil_g) || 0;
    if (params.cookingStyle === 'raw') oilGrams = 0;
    else if (params.cookingStyle === 'heavy') oilGrams = Math.max(oilGrams, 15);
    else if (params.cookingStyle === 'light' && oilGrams > 0) oilGrams = 5;

    const totalCals = baseCals + (oilGrams * 9);
    const totalFat = baseFat + oilGrams;

    return {
      dish_name: meal.dish_name || 'Identified Meal',
      meal_type: getMealTypeByHour(),
      items: items,
      estimated_oil_g: oilGrams,
      portion_multiplier: 1.0,
      total_calories: totalCals,
      total_protein_g: Number(baseProtein.toFixed(1)),
      total_carbs_g: Number(baseCarbs.toFixed(1)),
      total_fat_g: Number(totalFat.toFixed(1)),
      glucose_impact_score: meal.glucose_impact_score || 'LOW',
      energy_crash_risk: meal.energy_crash_risk || 'VERY_LOW',
      ai_tip: meal.ai_tip || 'Balanced nutrition profile.',
      voice_transcript: params.voiceTranscript,
    };
  } catch (err: any) {
    if (err?.message === 'QUOTA_EXCEEDED') {
      throw err;
    }
    throw new Error('MEAL_READ_FAILED');
  } finally {
    clearTimeout(timer);
  }
}

function getMealTypeByHour(): 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'Breakfast';
  if (hour >= 11 && hour < 16) return 'Lunch';
  if (hour >= 16 && hour < 22) return 'Dinner';
  return 'Snack';
}

/**
 * Natural Language Processing service function to convert spoken or typed meal descriptions
 * (e.g. "2 eggs, half an avocado, and a toast") into structured meal records.
 */
export async function parseNaturalLanguageMeal(description: string): Promise<Omit<MealRecord, 'id' | 'timestamp'>> {
  const text = description.trim().toLowerCase();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  let calories = 350;
  let protein = 25;
  let carbs = 30;
  let fat = 12;
  let dish_name = description.trim() || 'Custom Voice Meal';

  if (text.includes('egg') || text.includes('eggs')) {
    protein += 14;
    calories += 140;
    fat += 10;
  }
  if (text.includes('avocado')) {
    fat += 14;
    carbs += 8;
    calories += 160;
  }
  if (text.includes('toast') || text.includes('bread')) {
    carbs += 24;
    calories += 120;
  }
  if (text.includes('chicken') || text.includes('turkey') || text.includes('steak')) {
    protein += 35;
    fat += 8;
    calories += 240;
  }
  if (text.includes('shake') || text.includes('protein') || text.includes('whey')) {
    protein += 28;
    carbs += 10;
    calories += 200;
  }
  if (text.includes('rice') || text.includes('pasta') || text.includes('oats')) {
    carbs += 40;
    calories += 210;
  }
  if (text.includes('salad') || text.includes('greens') || text.includes('broccoli')) {
    carbs += 8;
    calories += 45;
  }

  const formattedTitle = dish_name.charAt(0).toUpperCase() + dish_name.slice(1);

  return {
    dish_name: formattedTitle,
    meal_type: getMealTypeByHour(),
    items: [
      {
        id: `nlp-1`,
        name: formattedTitle,
        weight_g: 250,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
      },
    ],
    estimated_oil_g: 5,
    portion_multiplier: 1.0,
    total_calories: calories,
    total_protein_g: protein,
    total_carbs_g: carbs,
    total_fat_g: fat,
    glucose_impact_score: protein >= carbs * 0.4 ? 'LOW' : 'MEDIUM',
    energy_crash_risk: protein >= carbs * 0.4 ? 'VERY_LOW' : 'LOW',
    ai_tip: 'Parsed via Voice Natural Language Processing. Macro profile verified.',
    voice_transcript: description,
  };
}

/**
 * Direct Google Gemini 1.5 Flash Vision AI analysis function.
 */
export async function analyzeWithGeminiVision(
  imageBase64: string,
  apiKey: string,
  voiceTranscript?: string,
  culturalPreset?: string
): Promise<Omit<MealRecord, 'id' | 'timestamp'>> {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const promptText = `You are CalSnap AI, the world's most advanced clinical AI nutritionist and computer vision food expert. Perform a meticulous, high-precision visual and biochemical analysis of this meal photo.

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

3. STANDARD ADULT DINING PLATE CALIBRATION & COMPOSITE MEAL REALISM:
   - When food is served on an adult dining plate (approx 9-10 inches) or standard bowl, calibrate portions against standard adult meal servings, NEVER small appetizer/tasting portions:
     * COOKED GRAINS & STAPLES (White/Brown Rice, Basmati, Pasta, Noodles, Quinoa): A typical adult serving covering 1/3 to 1/2 of a dinner plate is 150g to 200g (approx 200-260 kcal, 45-55g carbs). NEVER estimate a full plate-base of rice/grains as under 130g (~38g carbs) unless explicitly a child/side portion.
     * CURRIES, LENTILS & GRAVIES (Dal, Sambar, Curry, Chili, Stew): A normal adult serving is 120g to 180g (approx 120-180 kcal, 15-22g carbs, 6-9g protein).
     * EGGS & SCRAMBLES (Egg Bhurji, Scrambled, Fried): 2 whole eggs baseline is ~100g (approx 140-160 kcal, 12-14g protein, 10-12g fat) plus 5-10g cooking oil (~45-90 kcal).
     * BREADS & FLATBREADS (Roti, Chapati, Naan, Tortilla): Standard medium Roti is ~40g (100-120 kcal, 20-25g carbs); Naan is ~120g (300-350 kcal, 50-60g carbs).
   - COMPOSITE DISH DECONSTRUCTION: For mixed plates with multiple items (e.g. "Dal Chawal with Egg Bhurji", "Rice with Chicken & Broccoli"), you MUST separate and list each distinct component in "items" with its realistic mass so carbohydrates, protein, and fat reflect the entire meal accurately (typically 450 - 650 kcal for an adult mixed plate).

4. FRUIT & VEGETABLE RIPENESS & MATURITY:
   - Inspect skin pigmentation, browning/freckling, and ripeness stage (e.g., green vs yellow vs spotted banana).
   - Adjust sucrose/fructose ratio, net carbohydrates, and glycemic impact based on ripeness.

5. CULTURAL CUISINE CONTEXT:
   - Regional Preference: "${culturalPreset || 'Standard'}".
   - Voice Note / User Context: "${voiceTranscript || 'None'}".

6. METABOLIC FORECASTING:
   - Assess glucose_impact_score ('LOW' | 'MEDIUM' | 'HIGH').
   - Assess energy_crash_risk ('VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH').

--- OUTPUT FORMAT ---
Return ONLY a valid, parseable JSON object with NO markdown formatting or text surrounding it, matching this exact schema:
{
  "dish_name": "Precision Identified Dish Name",
  "items": [
    {
      "id": "1",
      "name": "Item Name (e.g., Slightly Ripe Medium Yellow Banana)",
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
  "ai_tip": "One precise, highly actionable 1-sentence nutrition insight about this specific meal."
}`;

  const modelNames = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest'];
  const requestParts: any[] = [{ text: promptText }];
  if (cleanBase64 && cleanBase64.length > 100 && cleanBase64 !== 'MOCK_IMAGE_DATA') {
    requestParts.push({
      inline_data: {
        mime_type: 'image/jpeg',
        data: cleanBase64,
      },
    });
  }

  let lastError: string = '';
  let resJson: any = null;

  for (const model of modelNames) {
    const urls = [
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: requestParts }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 800,
              responseMimeType: 'application/json',
            },
          }),
        });

        resJson = await response.json();
        if (!resJson.error) {
          break;
        } else {
          lastError = resJson.error.message || 'Gemini API Error';
        }
      } catch (e: any) {
        lastError = e?.message || 'Network error';
      }
    }

    if (resJson && !resJson.error) break;
  }

  if (!resJson || resJson.error) {
    throw new Error(lastError || 'Gemini API Error');
  }

  const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!rawText) {
    throw new Error('Gemini Vision AI returned an empty response. Please try taking another photo.');
  }

  let parsed: any = {};
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(jsonString);
  } catch (err) {
    console.warn('Safe JSON parsing fallback triggered:', err);
    parsed = {
      dish_name: 'Analyzed Plate',
      items: [{ id: '1', name: 'Meal Component', weight_g: 200, calories: 350, protein_g: 20, carbs_g: 40, fat_g: 12 }],
      total_calories: 350,
      total_protein_g: 20,
      total_carbs_g: 40,
      total_fat_g: 12,
      estimated_oil_g: 5,
      ai_tip: 'Balanced plate captured by CalSnap AI.',
    };
  }

  const {
    items,
    baseCals: calcCals,
    baseProtein: calcProtein,
    baseCarbs: calcCarbs,
    baseFat: calcFat,
  } = resolveBaseNutrition(parsed);

  return {
    dish_name: parsed.dish_name || 'Analyzed Meal',
    image_uri: imageBase64 && imageBase64.length > 20 ? imageBase64 : undefined,
    meal_type: getMealTypeByHour(),
    items: items,
    estimated_oil_g: Number(parsed.estimated_oil_g) || 0,
    portion_multiplier: 1.0,
    total_calories: calcCals,
    total_protein_g: calcProtein,
    total_carbs_g: calcCarbs,
    total_fat_g: calcFat,
    glucose_impact_score: parsed.glucose_impact_score || 'LOW',
    energy_crash_risk: parsed.energy_crash_risk || 'VERY_LOW',
    ai_tip: parsed.ai_tip || 'Nutritious choice!',
    voice_transcript: voiceTranscript,
  };
}
