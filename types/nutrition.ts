export type GlucoseImpact = 'LOW' | 'MEDIUM' | 'HIGH';
export type EnergyCrashRisk = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH';

export interface StapleItem {
  id: string;
  icon: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
}

export interface FoodItem {
  id: string;
  name: string;
  weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealRecord {
  id: string;
  timestamp: string; // ISO String
  dish_name: string;
  image_uri?: string;
  voice_transcript?: string;
  meal_type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  items: FoodItem[];
  estimated_oil_g: number;
  portion_multiplier: number; // Default 1.0 (50% to 150%)
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  glucose_impact_score: GlucoseImpact;
  energy_crash_risk: EnergyCrashRisk;
  ai_tip: string;
}

export interface UserGoals {
  daily_calories: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
  weekly_banked_calories: number;
  cultural_preset: 'Standard' | 'Indian Homestyle' | 'East Asian' | 'Middle Eastern' | 'Latin American';
  weight_goal: 'Lose Weight' | 'Maintain' | 'Build Muscle';
  weight_unit: 'lbs' | 'kg';
  target_weight_lbs: number;
  gemini_api_key?: string;
}

export interface NotificationSettings {
  master_enabled: boolean;
  breakfast_reminder: boolean;
  breakfast_time: string; // HH:mm
  lunch_reminder: boolean;
  lunch_time: string; // HH:mm
  dinner_reminder: boolean;
  dinner_time: string; // HH:mm
  streak_protection_alert: boolean;
  weekly_recap_alert: boolean;
}

export interface HistorySettings {
  retention_days: number; // 30, 90, 180, 365, or -1 (Forever)
}

export interface UserProfile {
  id: string;
  email?: string;
  is_guest: boolean;
  is_pro_subscriber: boolean;
  streak_days: number;
  streak_freeze_count: number;
  last_logged_date?: string;
  biometric_lock_enabled?: boolean;
  streak_freeze_saved_recently?: boolean;
  current_weight_kg?: number;
  weight_history?: WeightEntry[];
  is_fasting?: boolean;
  fast_start_timestamp?: string;
  fasting_protocol?: '16:8' | '14:10' | '18:6';
}

export interface WeightEntry {
  id: string;
  timestamp: string; // ISO String
  date?: string; // YYYY-MM-DD
  weight_kg?: number;
  weight_lbs: number;
  note?: string;
}

export interface BarcodeProduct {
  barcode: string;
  product_name: string;
  brand: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size: string;
  image_url?: string;
  is_fallback: boolean;
  is_incomplete?: boolean;
}

