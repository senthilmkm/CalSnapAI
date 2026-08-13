import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MealRecord, UserGoals, NotificationSettings, HistorySettings, UserProfile, WeightEntry, StapleItem } from '../types/nutrition';

interface AppState {
  // User Profile & Auth
  profile: UserProfile;
  setProfile: (profile: Partial<UserProfile>) => void;
  toggleBiometricLock: (enabled: boolean) => void;
  dismissStreakFreezeBanner: () => void;
  signInWithApple: (email: string) => void;
  signOut: () => void;

  // Goals & Targets
  goals: UserGoals;
  updateGoals: (goals: Partial<UserGoals>) => void;
  setWeightUnit: (unit: 'lbs' | 'kg') => void;

  // Water Tracker
  water_target_ml: number;
  water_logs: Record<string, number>; // "YYYY-MM-DD" -> total mL
  addWater: (amount_ml: number, dateStr?: string) => void;
  setWaterTarget: (target_ml: number) => void;
  resetTodayWater: () => void;
  getTodayWater: () => { current: number; target: number; percentage: number };

  // Weight Tracker & History
  weight_entries: WeightEntry[];
  addWeightEntry: (weightValue: number, isKg?: boolean, note?: string) => void;
  deleteWeightEntry: (id: string) => void;
  getWeightStats: () => { current: number; starting: number; netChange: number; monthChange: number };

  // Fasting Tracker
  toggleFastState: () => void;
  setFastingProtocol: (protocol: '16:8' | '14:10' | '18:6') => void;

  // Meals & History
  meals: MealRecord[];
  addMeal: (meal: Omit<MealRecord, 'id' | 'timestamp'>) => MealRecord;
  updateMealSliders: (mealId: string, portionMultiplier: number, oilGrams: number) => void;
  deleteMeal: (mealId: string) => void;
  clearAllHistory: () => void;
  clearPhotoCache: () => void;

  // Usual Staples (1-Tap Quick Fill)
  staples: StapleItem[];
  addStaple: (staple: Omit<StapleItem, 'id'>) => void;
  deleteStaple: (id: string) => void;
  logStapleAsMeal: (staple: StapleItem, targetDateStr?: string) => MealRecord;

  // Settings
  notifications: NotificationSettings;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  historySettings: HistorySettings;
  updateHistorySettings: (settings: Partial<HistorySettings>) => void;

  // Derived Calculations
  getTodayMeals: () => MealRecord[];
  getTodayTotals: () => { calories: number; protein: number; carbs: number; fat: number };
  getMealsForDate: (dateStr: string) => MealRecord[];
  getTotalsForDate: (dateStr: string) => { calories: number; protein: number; carbs: number; fat: number };
  getWeeklyBankedCalories: () => number;
}

const DEFAULT_GOALS: UserGoals = {
  daily_calories: 2000,
  daily_protein_g: 140,
  daily_carbs_g: 200,
  daily_fat_g: 65,
  weekly_banked_calories: 350,
  cultural_preset: 'Standard',
  weight_goal: 'Maintain',
  weight_unit: 'lbs',
  target_weight_lbs: 162,
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  master_enabled: true,
  breakfast_reminder: true,
  breakfast_time: '08:30',
  lunch_reminder: true,
  lunch_time: '13:00',
  dinner_reminder: true,
  dinner_time: '19:30',
  streak_protection_alert: true,
  weekly_recap_alert: true,
};

const DEFAULT_HISTORY_SETTINGS: HistorySettings = {
  retention_days: -1, // Forever
};

const INITIAL_MEALS: MealRecord[] = [];

const INITIAL_STAPLES: StapleItem[] = [
  { id: 'st-1', icon: '☕', name: 'Black Coffee', calories: 5, protein_g: 0, carbs_g: 0, fat_g: 0, meal_type: 'Breakfast' },
  { id: 'st-2', icon: '🥤', name: 'Whey Protein Shake', calories: 160, protein_g: 26, carbs_g: 3, fat_g: 2, meal_type: 'Snack' },
  { id: 'st-3', icon: '🥛', name: 'Oat Milk Latte', calories: 140, protein_g: 3, carbs_g: 16, fat_g: 5, meal_type: 'Breakfast' },
  { id: 'st-4', icon: '🥚', name: '2 Eggs & Toast', calories: 260, protein_g: 15, carbs_g: 22, fat_g: 11, meal_type: 'Breakfast' },
  { id: 'st-5', icon: '🍌', name: 'Banana & Almonds', calories: 190, protein_g: 4, carbs_g: 28, fat_g: 8, meal_type: 'Snack' },
];

const INITIAL_WEIGHT_ENTRIES: WeightEntry[] = [
  { id: 'w-1', timestamp: new Date(Date.now() - 25 * 86400000).toISOString(), weight_lbs: 168.5, note: 'Starting weight check-in' },
  { id: 'w-2', timestamp: new Date(Date.now() - 20 * 86400000).toISOString(), weight_lbs: 167.8, note: 'Morning weigh-in' },
  { id: 'w-3', timestamp: new Date(Date.now() - 15 * 86400000).toISOString(), weight_lbs: 167.0, note: 'Post workout' },
  { id: 'w-4', timestamp: new Date(Date.now() - 10 * 86400000).toISOString(), weight_lbs: 166.4, note: 'Mid-month check' },
  { id: 'w-5', timestamp: new Date(Date.now() - 5 * 86400000).toISOString(), weight_lbs: 165.8, note: 'Morning fast' },
  { id: 'w-6', timestamp: new Date().toISOString(), weight_lbs: 165.3, note: 'Latest weigh-in' },
];

const getTodayKey = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: {
        id: 'guest-user-101',
        is_guest: true,
        is_pro_subscriber: false,
        streak_days: 5,
        streak_freeze_count: 1,
        last_logged_date: new Date().toISOString().split('T')[0],
      },
      setProfile: (updatedProfile) =>
        set((state) => ({ profile: { ...state.profile, ...updatedProfile } })),

      toggleBiometricLock: (enabled) =>
        set((state) => ({ profile: { ...state.profile, biometric_lock_enabled: enabled } })),

      dismissStreakFreezeBanner: () =>
        set((state) => ({
          profile: {
            ...state.profile,
            streak_freeze_saved_recently: false,
          },
        })),

      signInWithApple: (email) =>
        set((state) => ({
          profile: {
            ...state.profile,
            email,
            is_guest: false,
            is_pro_subscriber: true,
          },
        })),

      signOut: () =>
        set((state) => ({
          profile: {
            ...state.profile,
            email: undefined,
            is_guest: true,
          },
        })),

      goals: DEFAULT_GOALS,
      updateGoals: (newGoals) =>
        set((state) => {
          const updated = { ...state.goals, ...newGoals };
          if (newGoals.daily_calories && newGoals.daily_calories !== state.goals.daily_calories) {
            const cals = newGoals.daily_calories;
            // Clinical Ratio: 28% Protein (4 kcal/g), 40% Carbs (4 kcal/g), 29% Fat (9 kcal/g)
            updated.daily_protein_g = Math.round((cals * 0.28) / 4);
            updated.daily_carbs_g = Math.round((cals * 0.40) / 4);
            updated.daily_fat_g = Math.round((cals * 0.29) / 9);
          }
          return { goals: updated };
        }),
      setWeightUnit: (unit) =>
        set((state) => ({ goals: { ...state.goals, weight_unit: unit } })),

      // Water Tracker
      water_target_ml: 2500,
      water_logs: {
        [getTodayKey()]: 1250, // Pre-seeded with 1,250 mL today
      },
      addWater: (amount_ml, dateStr) => {
        const targetDate = dateStr || getTodayKey();
        const utcDate = new Date().toISOString().split('T')[0];
        set((state) => {
          const current = (state.water_logs && (state.water_logs[targetDate] || state.water_logs[utcDate])) || 0;
          const nextVal = Math.max(0, current + amount_ml);
          return {
            water_logs: {
              ...(state.water_logs || {}),
              [targetDate]: nextVal,
              [utcDate]: nextVal,
            },
          };
        });
      },
      setWaterTarget: (target_ml) => set({ water_target_ml: target_ml }),
      resetTodayWater: () => {
        const todayStr = getTodayKey();
        const utcDate = new Date().toISOString().split('T')[0];
        set((state) => ({
          water_logs: {
            ...(state.water_logs || {}),
            [todayStr]: 0,
            [utcDate]: 0,
          },
        }));
      },
      getTodayWater: () => {
        const todayStr = getTodayKey();
        const utcDate = new Date().toISOString().split('T')[0];
        const logs = get().water_logs || {};
        const current = Math.max(0, logs[todayStr] ?? logs[utcDate] ?? 0);
        const target = Math.max(1, get().water_target_ml || 2500);
        const percentage = Math.round((current / target) * 100);
        return { current, target, percentage };
      },

      // Weight Tracker
      weight_entries: INITIAL_WEIGHT_ENTRIES,
      addWeightEntry: (weightValue, isKg = false, note) => {
        const numWeight = parseFloat(String(weightValue));
        if (isNaN(numWeight) || numWeight <= 0 || !Number.isFinite(numWeight)) return;

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        const weight_lbs = isKg ? Math.round(numWeight * 2.20462 * 10) / 10 : Math.round(numWeight * 10) / 10;
        const weight_kg = isKg ? Math.round(numWeight * 10) / 10 : Math.round((numWeight / 2.20462) * 10) / 10;

        const newEntry: WeightEntry = {
          id: `w-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now.toISOString(),
          date: todayStr,
          weight_lbs,
          weight_kg,
          note: note ? note.trim() : undefined,
        };
        set((state) => ({
          weight_entries: [...(state.weight_entries || []), newEntry].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          ),
          profile: {
            ...state.profile,
            current_weight_kg: weight_kg,
          },
        }));
      },

      toggleFastState: () => {
        set((state) => {
          const currentlyFasting = !!state.profile.is_fasting;
          return {
            profile: {
              ...state.profile,
              is_fasting: !currentlyFasting,
              fast_start_timestamp: !currentlyFasting ? new Date().toISOString() : undefined,
              fasting_protocol: state.profile.fasting_protocol || '16:8',
            },
          };
        });
      },

      setFastingProtocol: (protocol) => {
        set((state) => ({
          profile: {
            ...state.profile,
            fasting_protocol: protocol,
          },
        }));
      },
      deleteWeightEntry: (id) => {
        set((state) => ({
          weight_entries: (state.weight_entries || []).filter((w) => w.id !== id),
        }));
      },
      getWeightStats: () => {
        const entries = (get().weight_entries || []).filter(
          (e) => e && typeof e.weight_lbs === 'number' && !isNaN(e.weight_lbs) && e.weight_lbs > 0
        );
        if (entries.length === 0) {
          return { current: 0, starting: 0, netChange: 0, monthChange: 0 };
        }
        const sorted = [...entries].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const starting = sorted[0].weight_lbs;
        const current = sorted[sorted.length - 1].weight_lbs;
        const netChange = Math.round((current - starting) * 10) / 10;

        // Month change
        const thirtyDaysAgo = Date.now() - 30 * 86400000;
        const monthStartEntry = sorted.find(
          (e) => new Date(e.timestamp).getTime() >= thirtyDaysAgo
        ) || sorted[0];
        const monthChange = Math.round((current - monthStartEntry.weight_lbs) * 10) / 10;

        return { current, starting, netChange, monthChange };
      },

      meals: INITIAL_MEALS,

      addMeal: (mealData) => {
        const timestamp = new Date().toISOString();
        const id = `meal-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

        const newMeal: MealRecord = {
          ...mealData,
          id,
          timestamp,
        };

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        set((state) => {
          let newStreak = state.profile.streak_days;
          let freezeCount = state.profile.streak_freeze_count;
          let freezeTriggered = false;

          if (state.profile.last_logged_date && state.profile.last_logged_date !== todayStr) {
            const lastDate = new Date(state.profile.last_logged_date);
            const currentDate = new Date(todayStr);
            const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

            if (diffDays === 1) {
              newStreak += 1;
            } else if (diffDays > 1) {
              if (freezeCount > 0) {
                freezeCount -= 1;
                freezeTriggered = true;
                newStreak += 1; // Freeze saved streak
              } else {
                newStreak = 1; // Reset streak
              }
            }
          } else if (!state.profile.last_logged_date) {
            newStreak = 1;
          }

          return {
            meals: [newMeal, ...state.meals],
            profile: {
              ...state.profile,
              streak_days: newStreak,
              streak_freeze_count: freezeCount,
              streak_freeze_saved_recently: freezeTriggered,
              last_logged_date: todayStr,
            },
          };
        });

        return newMeal;
      },

      updateMealSliders: (mealId, portionMultiplier, oilGrams) => {
        const safePortion = Math.max(0.25, Math.min(3.0, portionMultiplier));
        const safeOil = Math.max(0, Math.min(100, oilGrams));

        set((state) => ({
          meals: state.meals.map((meal) => {
            if (meal.id !== mealId) return meal;

            const items = meal.items || [];
            const baseCal = items.reduce((acc, item) => acc + (Number(item.calories) || 0), 0);
            const baseProtein = items.reduce((acc, item) => acc + (Number(item.protein_g) || 0), 0);
            const baseCarbs = items.reduce((acc, item) => acc + (Number(item.carbs_g) || 0), 0);
            const baseFat = items.reduce((acc, item) => acc + (Number(item.fat_g) || 0), 0);

            const oilCalories = safeOil * 9;

            return {
              ...meal,
              portion_multiplier: safePortion,
              estimated_oil_g: safeOil,
              total_calories: Math.round(baseCal * safePortion + oilCalories),
              total_protein_g: Math.round(baseProtein * safePortion),
              total_carbs_g: Math.round(baseCarbs * safePortion),
              total_fat_g: Math.round(baseFat * safePortion + safeOil),
            };
          }),
        }));
      },

      deleteMeal: (mealId) =>
        set((state) => ({
          meals: state.meals.filter((m) => m.id !== mealId),
        })),

      clearAllHistory: () =>
        set(() => ({
          meals: [],
          profile: { ...get().profile, streak_days: 0 },
        })),

      clearPhotoCache: () =>
        set((state) => ({
          meals: state.meals.map((m) => ({ ...m, image_uri: undefined })),
        })),

      // Usual Staples (1-Tap Quick Fill)
      staples: INITIAL_STAPLES,
      addStaple: (stapleData) => {
        const id = `st-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newStaple: StapleItem = { ...stapleData, id };
        set((state) => ({ staples: [...(state.staples || []), newStaple] }));
      },
      deleteStaple: (id) =>
        set((state) => ({ staples: (state.staples || []).filter((s) => s.id !== id) })),

      logStapleAsMeal: (staple, targetDateStr) => {
        let timestamp = new Date().toISOString();
        if (targetDateStr) {
          const now = new Date();
          const [year, month, day] = targetDateStr.split('-').map(Number);
          const d = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
          timestamp = d.toISOString();
        }

        const mealData: Omit<MealRecord, 'id' | 'timestamp'> = {
          dish_name: `${staple.icon || '☕'} ${staple.name}`,
          meal_type: staple.meal_type || 'Breakfast',
          items: [
            {
              id: `item-${Date.now()}`,
              name: staple.name,
              weight_g: 150,
              calories: staple.calories,
              protein_g: staple.protein_g,
              carbs_g: staple.carbs_g,
              fat_g: staple.fat_g,
            },
          ],
          estimated_oil_g: 0,
          portion_multiplier: 1.0,
          total_calories: staple.calories,
          total_protein_g: staple.protein_g,
          total_carbs_g: staple.carbs_g,
          total_fat_g: staple.fat_g,
          glucose_impact_score: 'LOW',
          energy_crash_risk: 'VERY_LOW',
          ai_tip: '1-Tap Quick Fill staple logged instantly.',
        };

        const id = `meal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newMeal: MealRecord = { ...mealData, id, timestamp };

        const itemDate = new Date(timestamp);
        const year = itemDate.getFullYear();
        const month = String(itemDate.getMonth() + 1).padStart(2, '0');
        const day = String(itemDate.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;

        set((state) => {
          let newStreak = state.profile.streak_days;
          if (state.profile.last_logged_date !== dateKey) {
            newStreak += 1;
          }
          return {
            meals: [newMeal, ...state.meals],
            profile: { ...state.profile, streak_days: newStreak, last_logged_date: dateKey },
          };
        });

        return newMeal;
      },

      notifications: DEFAULT_NOTIFICATIONS,
      updateNotificationSettings: (newNotifs) =>
        set((state) => ({
          notifications: { ...state.notifications, ...newNotifs },
        })),

      historySettings: DEFAULT_HISTORY_SETTINGS,
      updateHistorySettings: (newHist) => {
        set((state) => ({
          historySettings: { ...state.historySettings, ...newHist },
        }));

        // Execute purge if retention days is set
        if (newHist.retention_days && newHist.retention_days > 0) {
          const cutoffTime = Date.now() - newHist.retention_days * 24 * 60 * 60 * 1000;
          set((state) => ({
            meals: state.meals.filter((m) => new Date(m.timestamp).getTime() >= cutoffTime),
          }));
        }
      },

      getTodayMeals: () => {
        const todayKey = getTodayKey();
        return (get().meals || []).filter((m) => {
          if (!m || !m.timestamp) return false;
          const itemDate = new Date(m.timestamp);
          const year = itemDate.getFullYear();
          const month = String(itemDate.getMonth() + 1).padStart(2, '0');
          const day = String(itemDate.getDate()).padStart(2, '0');
          const itemDateKey = `${year}-${month}-${day}`;
          return itemDateKey === todayKey;
        });
      },

      getTodayTotals: () => {
        const todayMeals = get().getTodayMeals();
        const raw = todayMeals.reduce(
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
      },

      getMealsForDate: (dateStr) => {
        if (!dateStr) return get().getTodayMeals();
        const targetDateKey = dateStr.split('T')[0];

        return (get().meals || []).filter((m) => {
          if (!m || !m.timestamp) return false;
          const itemDate = new Date(m.timestamp);
          const year = itemDate.getFullYear();
          const month = String(itemDate.getMonth() + 1).padStart(2, '0');
          const day = String(itemDate.getDate()).padStart(2, '0');
          const itemDateKey = `${year}-${month}-${day}`;
          return itemDateKey === targetDateKey;
        });
      },

      getTotalsForDate: (dateStr) => {
        const dateMeals = get().getMealsForDate(dateStr);
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
      },

      getWeeklyBankedCalories: () => {
        const target = get().goals.daily_calories || 2000;
        const meals = get().meals || [];
        const now = new Date();
        let totalBanked = 0;

        for (let i = 1; i <= 6; i++) {
          const day = new Date(now.getTime() - i * 86400000);
          const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const dayUtcKey = day.toISOString().split('T')[0];
          const dayLocalStr = day.toDateString();

          const dayMeals = meals.filter((m) => {
            if (!m || !m.timestamp) return false;
            const itemDate = new Date(m.timestamp);
            return (
              m.timestamp.startsWith(dateKey) ||
              m.timestamp.startsWith(dayUtcKey) ||
              itemDate.toDateString() === dayLocalStr
            );
          });

          const dayCals = dayMeals.reduce((acc, m) => acc + (Number(m.total_calories) || 0), 0);
          if (dayCals > 0 && dayCals < target) {
            totalBanked += Math.round(target - dayCals);
          }
        }

        return totalBanked;
      },
    }),
    {
      name: 'calsnap-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
