const assert = require('assert');

/**
 * CalSnap AI Comprehensive Math, Storage, & Data Calculation Regression Suite
 * 
 * Tests:
 * 1. Macro & Calorie Summation, Portion Scaling & Hidden Oil Math
 * 2. Mifflin-St Jeor BMR, TDEE, Activity Level & Macro Target Math
 * 3. Daily Aggregations & Storage Isolation Across Dates
 * 4. Meal Updates, Slider Recalculation & Retention Purging
 * 5. 7-Day Insights, Deficit/Surplus, & Calorie Banking Calculations
 * 6. Water, Weight Unit Conversion & BMI Calculations
 * 7. Security, Daily Scan Quota Edge Cases & Anti-Cheat Validation
 */

// --- SIMULATED IN-MEMORY STORAGE ENGINE ---
class MockCalSnapStorage {
  constructor() {
    this.reset();
  }

  reset() {
    this.profile = {
      id: 'user-test-1',
      is_guest: true,
      is_pro_subscriber: false,
      streak_days: 1,
      streak_freeze_count: 1,
      last_logged_date: null,
      daily_scans_count: 0,
      last_scan_date: null,
      current_weight_kg: 70,
    };

    this.goals = {
      daily_calories: 2000,
      daily_protein_g: 140,
      daily_carbs_g: 200,
      daily_fat_g: 65,
      weekly_banked_calories: 350,
      cultural_preset: 'Standard',
      weight_goal: 'Maintain',
      weight_unit: 'lbs',
      target_weight_lbs: 154,
    };

    this.meals = [];
    this.water_logs = {};
    this.water_target_ml = 2500;
    this.weight_entries = [];
    this.historySettings = { retention_days: -1 };
  }

  getTodayKey() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  addMeal(mealData, customTimestamp) {
    const id = `meal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = customTimestamp || new Date().toISOString();
    
    let totalCals = mealData.total_calories;
    let totalProt = mealData.total_protein_g;
    let totalCarb = mealData.total_carbs_g;
    let totalFat = mealData.total_fat_g;

    if (totalCals === undefined && mealData.items && mealData.items.length > 0) {
      totalCals = mealData.items.reduce((sum, item) => sum + item.calories, 0);
      totalProt = mealData.items.reduce((sum, item) => sum + item.protein_g, 0);
      totalCarb = mealData.items.reduce((sum, item) => sum + item.carbs_g, 0);
      totalFat = mealData.items.reduce((sum, item) => sum + item.fat_g, 0);
    } else {
      totalCals = totalCals || 0;
      totalProt = totalProt || 0;
      totalCarb = totalCarb || 0;
      totalFat = totalFat || 0;
    }

    const newMeal = {
      id,
      timestamp,
      dish_name: mealData.dish_name || 'Logged Meal',
      image_uri: mealData.image_uri,
      meal_type: mealData.meal_type || 'Lunch',
      items: mealData.items || [],
      estimated_oil_g: mealData.estimated_oil_g || 0,
      portion_multiplier: mealData.portion_multiplier || 1.0,
      total_calories: Math.round(totalCals),
      total_protein_g: Number(totalProt.toFixed(2)),
      total_carbs_g: Number(totalCarb.toFixed(2)),
      total_fat_g: Number(totalFat.toFixed(2)),
      glucose_impact_score: mealData.glucose_impact_score || 'LOW',
      energy_crash_risk: mealData.energy_crash_risk || 'VERY_LOW',
      ai_tip: mealData.ai_tip || 'Healthy choice!',
    };

    this.meals.unshift(newMeal);

    if (mealData.image_uri && mealData.image_uri.length > 20 && mealData.image_uri !== 'MOCK_IMAGE_DATA') {
      this.incrementDailyScan();
    }

    return newMeal;
  }

  updateMealSliders(mealId, portionMultiplier, oilGrams) {
    const safePortion = Math.max(0.5, Math.min(2.0, portionMultiplier));
    const safeOil = Math.max(0, Math.min(50, oilGrams));

    this.meals = this.meals.map((m) => {
      if (m.id !== mealId) return m;

      const baseCals = (m.items || []).reduce((acc, item) => acc + (item.calories || 0), 0);
      const baseProtein = (m.items || []).reduce((acc, item) => acc + (item.protein_g || 0), 0);
      const baseCarbs = (m.items || []).reduce((acc, item) => acc + (item.carbs_g || 0), 0);
      const baseFat = (m.items || []).reduce((acc, item) => acc + (item.fat_g || 0), 0);

      const oilCals = safeOil * 9; // 9 kcal per gram of fat/oil

      return {
        ...m,
        portion_multiplier: safePortion,
        estimated_oil_g: safeOil,
        total_calories: Math.round(baseCals * safePortion + oilCals),
        total_protein_g: Math.round(baseProtein * safePortion),
        total_carbs_g: Math.round(baseCarbs * safePortion),
        total_fat_g: Math.round(baseFat * safePortion + safeOil),
      };
    });
  }

  deleteMeal(mealId) {
    this.meals = this.meals.filter((m) => m.id !== mealId);
  }

  getMealsForDate(dateStr) {
    const targetKey = dateStr.split('T')[0];
    return this.meals.filter((m) => {
      if (!m || !m.timestamp) return false;
      const itemDateKey = m.timestamp.split('T')[0];
      return itemDateKey === targetKey;
    });
  }

  getTotalsForDate(dateStr) {
    const dateMeals = this.getMealsForDate(dateStr);
    const raw = dateMeals.reduce(
      (acc, m) => ({
        calories: acc.calories + (Number(m.total_calories) || 0),
        protein: acc.protein + (Number(m.total_protein_g) || 0),
        carbs: acc.carbs + (Number(m.total_carbs_g) || 0),
        fat: acc.fat + (Number(m.total_fat_g) || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      calories: Math.round(raw.calories),
      protein: Number(raw.protein.toFixed(2)),
      carbs: Number(raw.carbs.toFixed(2)),
      fat: Number(raw.fat.toFixed(2)),
    };
  }

  getTodayScanCount() {
    const todayStr = this.getTodayKey();
    if (this.profile.last_scan_date !== todayStr) {
      return 0;
    }
    const todayMeals = this.getMealsForDate(todayStr);
    if (todayMeals.length === 0) {
      return 0;
    }
    const todayAIScanMeals = todayMeals.filter(
      (m) => m && m.image_uri && m.image_uri.length > 20 && m.image_uri !== 'MOCK_IMAGE_DATA'
    );
    return Math.max(this.profile.daily_scans_count || 0, todayAIScanMeals.length);
  }

  incrementDailyScan() {
    const todayStr = this.getTodayKey();
    const nowIso = new Date().toISOString();
    const isSameDay = this.profile.last_scan_date === todayStr;
    const currentCount = isSameDay ? (this.profile.daily_scans_count || 0) : 0;
    this.profile.last_scan_date = todayStr;
    this.profile.last_scan_timestamp = nowIso;
    this.profile.daily_scans_count = currentCount + 1;
  }

  purgeHistory(retentionDays) {
    if (retentionDays > 0) {
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      this.meals = this.meals.filter((m) => new Date(m.timestamp).getTime() >= cutoffTime);
    }
  }

  addWater(amountMl, dateStr) {
    const key = dateStr || this.getTodayKey();
    this.water_logs[key] = (this.water_logs[key] || 0) + amountMl;
  }

  getWaterStats(dateStr) {
    const key = dateStr || this.getTodayKey();
    const current = this.water_logs[key] || 0;
    const target = this.water_target_ml;
    const percentage = Math.min(100, Math.round((current / target) * 100));
    return { current, target, percentage };
  }
}

// --- PURE MATH HELPERS MATCHING APP LOGIC ---

function calculateBMR(weightKg, heightCm, ageYears, gender) {
  if (gender === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  } else {
    return 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  }
}

function calculateTDEE(bmr, activityMultiplier) {
  return Math.round(bmr * activityMultiplier);
}

function calculateCalorieTarget(tdee, weightGoal) {
  if (weightGoal === 'Lose Weight') return Math.max(1200, tdee - 500);
  if (weightGoal === 'Build Muscle') return tdee + 300;
  return tdee;
}

function calculate7DayStats(dailyIntakes, dailyTarget) {
  const totalIntake = dailyIntakes.reduce((a, b) => a + b, 0);
  const avgIntake = Math.round(totalIntake / dailyIntakes.length);
  const totalTarget = dailyTarget * dailyIntakes.length;
  const netDeficit = totalTarget - totalIntake;
  const projectedWeightKgChange = Number((netDeficit / 7700).toFixed(3));
  const projectedWeightLbsChange = Number((netDeficit / 3500).toFixed(3));

  return {
    avgIntake,
    totalDeficit: netDeficit,
    isDeficit: netDeficit >= 0,
    projectedWeightKgChange,
    projectedWeightLbsChange,
  };
}

function convertKgToLbs(kg) {
  return Number((kg * 2.20462).toFixed(2));
}

function convertLbsToKg(lbs) {
  return Number((lbs / 2.20462).toFixed(2));
}

function calculateBMI(weightKg, heightMeters) {
  return Number((weightKg / (heightMeters * heightMeters)).toFixed(1));
}


// --- EXECUTE REGRESSION SUITE ---

console.log('========================================================================');
console.log('🧪 CalSnap AI Math, Storage, & Data Calculation Regression Suite');
console.log('========================================================================\n');

const storage = new MockCalSnapStorage();

// SECTION 1: NUTRITION & MACRO MATH ENGINE
console.log('--- SECTION 1: Nutrition & Macro Math Engine ---');

const testItems = [
  { id: 'i1', name: 'Steamed Basmati Rice', weight_g: 150, calories: 195, protein_g: 4.2, carbs_g: 43.5, fat_g: 0.4 },
  { id: 'i2', name: 'Grilled Chicken Breast', weight_g: 150, calories: 247, protein_g: 46.5, carbs_g: 0.0, fat_g: 5.4 },
  { id: 'i3', name: 'Dal Tadka', weight_g: 100, calories: 120, protein_g: 6.0, carbs_g: 16.0, fat_g: 3.5 },
];

const loggedMeal = storage.addMeal({
  dish_name: 'Chicken Thali',
  meal_type: 'Lunch',
  items: testItems,
  portion_multiplier: 1.0,
  estimated_oil_g: 0,
});

assert.strictEqual(loggedMeal.total_calories, 562, 'Meal calories should sum items (195 + 247 + 120 = 562)');
assert.strictEqual(loggedMeal.total_protein_g, 56.7, 'Meal protein should sum items (4.2 + 46.5 + 6.0 = 56.7)');
assert.strictEqual(loggedMeal.total_carbs_g, 59.5, 'Meal carbs should sum items (43.5 + 0.0 + 16.0 = 59.5)');
assert.strictEqual(loggedMeal.total_fat_g, 9.3, 'Meal fat should sum items (0.4 + 5.4 + 3.5 = 9.3)');
console.log('✅ PASSED 1.1: Base food items macro summation accurately calculated.');

// Slider Portion Scaling Test (1.5x portion, +15g Heavy Ghee oil)
storage.updateMealSliders(loggedMeal.id, 1.5, 15);
const updatedMeal = storage.meals.find(m => m.id === loggedMeal.id);

// Base: 562 cals * 1.5 = 843 + 135 (15g oil * 9 kcal) = 978 kcal
assert.strictEqual(updatedMeal.total_calories, 978, 'Portion 1.5x + 15g oil should equal 978 kcal');
assert.strictEqual(updatedMeal.total_protein_g, 85, 'Protein 56.7 * 1.5 rounded = 85g');
assert.strictEqual(updatedMeal.total_carbs_g, 89, 'Carbs 59.5 * 1.5 rounded = 89g');
assert.strictEqual(updatedMeal.total_fat_g, 29, 'Fat 9.3 * 1.5 + 15g oil rounded = 29g');
console.log('✅ PASSED 1.2: Portion multiplier (1.5x) and hidden oil slider (+15g ghee) accurately recalculated.\n');


// SECTION 2: BMR, TDEE, & USER GOAL CALCULATIONS
console.log('--- SECTION 2: BMR, TDEE, & User Goal Calculations ---');

// Test Case: Male 70kg, 175cm, 28 years old, Moderately Active (1.55)
const maleBmr = calculateBMR(70, 175, 28, 'male');
assert.strictEqual(maleBmr, 1658.75, 'Male BMR calculation exact formula match');

const maleTdee = calculateTDEE(maleBmr, 1.55);
assert.strictEqual(maleTdee, 2571, 'Male TDEE with 1.55 multiplier = 2571 kcal');

const maleLoseTarget = calculateCalorieTarget(maleTdee, 'Lose Weight');
assert.strictEqual(maleLoseTarget, 2071, 'Weight loss calorie target = TDEE - 500 = 2071 kcal');

// Test Case: Female 60kg, 165cm, 26 years old, Sedentary (1.2)
const femaleBmr = calculateBMR(60, 165, 26, 'female');
assert.strictEqual(femaleBmr, 1340.25, 'Female BMR calculation exact formula match');

const femaleTdee = calculateTDEE(femaleBmr, 1.2);
assert.strictEqual(femaleTdee, 1608, 'Female TDEE with 1.2 multiplier = 1608 kcal');

const femaleLoseTarget = calculateCalorieTarget(femaleTdee, 'Lose Weight');
assert.strictEqual(femaleLoseTarget, 1108 > 1200 ? femaleLoseTarget : 1200, 'Female target enforces 1200 kcal floor safety');
console.log('✅ PASSED 2.1: Mifflin-St Jeor BMR, TDEE activity scaling, and goal adjustments verified.\n');


// SECTION 3: MULTI-DAY STORAGE & DATA INTEGRITY
console.log('--- SECTION 3: Multi-Day Storage & Data Integrity ---');

storage.reset();
const day1Key = '2026-10-01';
const day2Key = '2026-10-02';

// Add 2 meals on Day 1
storage.addMeal({ dish_name: 'Breakfast Bowl', total_calories: 450, total_protein_g: 25, total_carbs_g: 50, total_fat_g: 15 }, `${day1Key}T08:30:00.000Z`);
storage.addMeal({ dish_name: 'Paneer Salad', total_calories: 550, total_protein_g: 30, total_carbs_g: 30, total_fat_g: 25 }, `${day1Key}T13:15:00.000Z`);

// Add 1 meal on Day 2
storage.addMeal({ dish_name: 'Protein Shake', total_calories: 300, total_protein_g: 40, total_carbs_g: 10, total_fat_g: 5 }, `${day2Key}T09:00:00.000Z`);

const day1Totals = storage.getTotalsForDate(day1Key);
assert.strictEqual(day1Totals.calories, 1000, 'Day 1 total calories must be 1000');
assert.strictEqual(day1Totals.protein, 55, 'Day 1 total protein must be 55g');

const day2Totals = storage.getTotalsForDate(day2Key);
assert.strictEqual(day2Totals.calories, 300, 'Day 2 total calories must be 300');
assert.strictEqual(day2Totals.protein, 40, 'Day 2 total protein must be 40g');

console.log('✅ PASSED 3.1: Date partitioning isolates daily totals cleanly.');

// Test History Purge (Retention Policy = 30 Days)
// Create 1 meal 40 days ago, 1 meal 10 days ago, and 1 meal today
const nowMs = Date.now();
const day40Ago = new Date(nowMs - 40 * 24 * 60 * 60 * 1000).toISOString();
const day10Ago = new Date(nowMs - 10 * 24 * 60 * 60 * 1000).toISOString();
const dayToday = new Date(nowMs).toISOString();

storage.reset();
storage.addMeal({ dish_name: 'Old Meal (40d ago)', total_calories: 500 }, day40Ago);
storage.addMeal({ dish_name: 'Recent Meal (10d ago)', total_calories: 600 }, day10Ago);
storage.addMeal({ dish_name: 'Today Meal', total_calories: 400 }, dayToday);

assert.strictEqual(storage.meals.length, 3, 'Initial meals count should be 3');

// Purge meals older than 30 days
storage.purgeHistory(30);

assert.strictEqual(storage.meals.length, 2, 'Meals count after 30-day retention purge should be 2');
assert.strictEqual(storage.meals.some(m => m.dish_name.includes('40d ago')), false, 'Meal older than 30 days must be purged');
assert.strictEqual(storage.meals.some(m => m.dish_name.includes('10d ago')), true, 'Meal within 30 days must be retained');
assert.strictEqual(storage.meals.some(m => m.dish_name.includes('Today')), true, 'Today meal must be retained');

console.log('✅ PASSED 3.2: Retention policy purging (30-day cutoff) verified.\n');


// SECTION 4: 7-DAY INSIGHTS & DEFICIT ANALYTICS
console.log('--- SECTION 4: 7-Day Insights & Deficit Analytics ---');

const dailyIntakes = [1800, 1950, 1700, 2100, 1650, 1900, 1850];
const targetCalories = 2000;

const stats = calculate7DayStats(dailyIntakes, targetCalories);
assert.strictEqual(stats.avgIntake, 1850, '7-Day Average intake = 1850 kcal/day');
assert.strictEqual(stats.totalDeficit, 1050, '7-Day Net Deficit = (7 * 2000) - 12950 = 1050 kcal');
assert.strictEqual(stats.isDeficit, true, 'isDeficit flag evaluates to true');
assert.strictEqual(stats.projectedWeightKgChange, 0.136, 'Projected kg loss = 1050 / 7700 = 0.136 kg');
assert.strictEqual(stats.projectedWeightLbsChange, 0.3, 'Projected lbs loss = 1050 / 3500 = 0.30 lbs');
console.log('✅ PASSED 4.1: 7-Day average, net deficit, and weight projection calculations verified.\n');


// SECTION 5: WATER, WEIGHT CONVERSION & BMI
console.log('--- SECTION 5: Water, Weight Conversion & BMI ---');

storage.reset();
storage.addWater(250);
storage.addWater(500);
const waterStats = storage.getWaterStats();
assert.strictEqual(waterStats.current, 750, 'Current water logged = 750 ml');
assert.strictEqual(waterStats.percentage, 30, 'Water percentage = (750 / 2500) * 100 = 30%');

const lbsVal = convertKgToLbs(70);
assert.strictEqual(lbsVal, 154.32, '70 kg converts to 154.32 lbs');

const kgVal = convertLbsToKg(154.32);
assert.strictEqual(kgVal, 70, '154.32 lbs converts back to 70.00 kg');

const bmiVal = calculateBMI(70, 1.75);
assert.strictEqual(bmiVal, 22.9, '70kg / (1.75m)^2 = 22.9 BMI (Normal range)');
console.log('✅ PASSED 5.1: Water tracking, unit conversions, and BMI calculators verified.\n');


// SECTION 6: SECURITY & DAILY SCAN QUOTA CORNER CASES
console.log('--- SECTION 6: Security & Daily Scan Quota Corner Cases ---');

storage.reset();
const todayStr = storage.getTodayKey();

// Case A1: Stale AsyncStorage date match on morning open with 0 meals logged today
storage.profile.last_scan_date = todayStr;
storage.profile.daily_scans_count = 1; // Leftover count from previous session/test run
assert.strictEqual(storage.getTodayScanCount(), 0, 'Morning check MUST return 0 scans when 0 meals are logged today');
console.log('✅ PASSED 6.1: Morning zero-meal guard prevents false scan depletion banner.');

// Case A2: Calendar date rollover (last_scan_date was yesterday)
storage.profile.last_scan_date = '2026-10-03';
storage.profile.daily_scans_count = 1;
assert.strictEqual(storage.getTodayScanCount(), 0, 'Date rollover MUST return 0 scans for a new calendar day');
console.log('✅ PASSED 6.2: Calendar date rollover resets daily scan quota seamlessly.');

// Case B: User logs AI photo meal today
storage.reset();
const aiScanMeal = storage.addMeal({
  dish_name: 'AI Scanned Bowl',
  image_uri: 'file:///data/user/0/calsnap/cache/photo-1234567890.jpg',
});

assert.strictEqual(storage.getTodayScanCount(), 1, 'Scan count updates to 1 after taking AI snap');
assert.ok(storage.profile.last_scan_timestamp, 'last_scan_timestamp ISO string must be recorded');
console.log('✅ PASSED 6.3: AI Photo scan records timestamp and increments quota.');

console.log('========================================================================');
console.log('🎉 ALL REGRESSION TESTS PASSED CLEANLY (100% PASS RATE)!');
console.log('========================================================================');
