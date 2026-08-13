import React, { useState } from 'react';
import pricingConfig from '../../config/pricing.json';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { Flame, Plus, ChevronRight, ChevronLeft, Calendar, Zap, ShieldCheck, Trash2, Sparkles, Scale, Clock, Timer } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../services/storage';
import { MacroRing } from '../../components/MacroRing';
import { WaterTrackerCard } from '../../components/WaterTrackerCard';
import { PortionSlider } from '../../components/PortionSlider';
import { OilSlider } from '../../components/OilSlider';
import { PaywallModal } from '../../components/PaywallModal';
import { MealDetailSheet } from '../../components/MealDetailSheet';
import { StaplesBar } from '../../components/StaplesBar';
import { QuickAddModal } from '../../components/QuickAddModal';
import { WeightLogModal } from '../../components/WeightLogModal';
import { MealRecord } from '../../types/nutrition';

export default function TodayDashboardScreen() {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [weightLogVisible, setWeightLogVisible] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [detailMeal, setDetailMeal] = useState<MealRecord | null>(null);
  const [selectedDateOffset, setSelectedDateOffset] = useState<number>(0); // 0 = Today, -1 = Yesterday, etc.

  const meals = useAppStore((state) => state.meals);
  const profile = useAppStore((state) => state.profile);
  const goals = useAppStore((state) => state.goals);
  const getMealsForDate = useAppStore((state) => state.getMealsForDate);
  const getTotalsForDate = useAppStore((state) => state.getTotalsForDate);
  const getWeeklyBankedCalories = useAppStore((state) => state.getWeeklyBankedCalories);
  const deleteMeal = useAppStore((state) => state.deleteMeal);
  const updateMealSliders = useAppStore((state) => state.updateMealSliders);
  const dismissStreakFreezeBanner = useAppStore((state) => state.dismissStreakFreezeBanner);
  const toggleFastState = useAppStore((state) => state.toggleFastState);

  const getTargetDateStr = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFastingInfo = () => {
    if (!profile.is_fasting || !profile.fast_start_timestamp) {
      return { hours: 0, minutes: 0, targetHours: 16, percentage: 0, isFasting: false };
    }
    const elapsedMs = Math.max(0, Date.now() - new Date(profile.fast_start_timestamp).getTime());
    const hoursFloat = elapsedMs / (1000 * 60 * 60);
    const targetHours = profile.fasting_protocol === '18:6' ? 18 : profile.fasting_protocol === '14:10' ? 14 : 16;
    const percentage = Math.min(100, Math.round((hoursFloat / targetHours) * 100));
    const hours = Math.floor(hoursFloat);
    const minutes = Math.floor((hoursFloat - hours) * 60);
    return { hours, minutes, targetHours, percentage, isFasting: true };
  };

  const fastingInfo = getFastingInfo();

  const selectedDateStr = getTargetDateStr(selectedDateOffset);
  const todayMeals = getMealsForDate(selectedDateStr);
  const totals = getTotalsForDate(selectedDateStr);
  const bankedCalories = getWeeklyBankedCalories();

  const getDateLabel = (offset: number) => {
    if (offset === 0) return 'Today';
    if (offset === -1) return 'Yesterday';
    if (offset === 1) return 'Tomorrow';
    const targetDate = new Date(Date.now() + offset * 86400000);
    return targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleConfirmDeleteMeal = (mealId: string, dishName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Meal?',
      `Are you sure you want to remove "${dishName}" from today's journal?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMeal(mealId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const getDynamicGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good Morning ☀️';
    if (hr < 17) return 'Good Afternoon 🌤️';
    return 'Good Evening 🌙';
  };

  const handleShieldPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      '🧊 Streak Freeze Protection',
      `You have ${profile.streak_freeze_count ?? 1} Streak Freeze active. If you ever miss logging meals for a day, your streak will be protected automatically!`
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getDynamicGreeting()}</Text>
          <Text style={styles.headerTitle}>Today's Nutrition</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Combined Streak & Freeze Badge */}
          <TouchableOpacity style={styles.streakBadge} onPress={handleShieldPress} activeOpacity={0.8}>
            <Flame size={15} color="#FF6B00" fill="#FF6B00" />
            <Text style={styles.streakText}>{profile.streak_days}d Streak  •  🧊 {profile.streak_freeze_count ?? 1}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Navigation Strip */}
      <View style={styles.dateSelectorBar}>
        <TouchableOpacity
          style={styles.dateArrowBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedDateOffset((prev) => prev - 1);
          }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color="#4F46E5" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateCenterBtn}
          onPress={() => {
            if (selectedDateOffset !== 0) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSelectedDateOffset(0);
            }
          }}
          activeOpacity={0.8}
        >
          <Calendar size={15} color="#4F46E5" style={{ marginRight: 6 }} />
          <Text style={styles.dateCenterText}>{getDateLabel(selectedDateOffset)}</Text>
          {selectedDateOffset !== 0 && (
            <View style={styles.todayPill}>
              <Text style={styles.todayPillText}>Back to Today ↩</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dateArrowBtn, selectedDateOffset >= 0 && { opacity: 0.3 }]}
          disabled={selectedDateOffset >= 0}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedDateOffset((prev) => Math.min(0, prev + 1));
          }}
          activeOpacity={0.7}
        >
          <ChevronRight size={18} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Celebratory Streak Freeze Saved Banner */}
      {profile.streak_freeze_saved_recently && (
        <View style={styles.freezeSavedBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Sparkles size={18} color="#4F46E5" />
            <Text style={styles.freezeSavedText}>
              🔥 Phew! Your Streak Freeze protected your {profile.streak_days}-day streak yesterday!
            </Text>
          </View>
          <TouchableOpacity style={styles.freezeDismissBtn} onPress={dismissStreakFreezeBanner}>
            <Text style={styles.freezeDismissText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pro Banner if Guest */}
      {profile.is_guest && (
        <TouchableOpacity style={styles.proBanner} onPress={() => setPaywallVisible(true)} activeOpacity={0.9}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color="#4F46E5" />
            <Text style={styles.proBannerText}>{pricingConfig.banner_text}</Text>
          </View>
          <ChevronRight size={16} color="#4F46E5" />
        </TouchableOpacity>
      )}

      {/* 1-Tap Staples & Quick Log Bar */}
      <StaplesBar selectedDateStr={selectedDateStr} />

      {/* 2-Card Row: Scale Weight & Intermittent Fasting Timer */}
      <View style={styles.quickCardsRow}>
        {/* Scale Weight Logger Card */}
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setWeightLogVisible(true);
          }}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Scale size={16} color="#4F46E5" />
            <Text style={styles.quickCardTitle}>Scale Weight</Text>
          </View>
          <Text style={styles.quickCardVal}>
            {profile.current_weight_kg ? `${profile.current_weight_kg} kg` : 'Tap to Log'}
          </Text>
          <Text style={styles.quickCardSub}>BMR Sync Active</Text>
        </TouchableOpacity>

        {/* Fasting Timer Card */}
        <TouchableOpacity
          style={[styles.quickCard, fastingInfo.isFasting && { borderColor: '#10B981', backgroundColor: '#ECFDF5' }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toggleFastState();
          }}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Timer size={16} color={fastingInfo.isFasting ? '#10B981' : '#F59E0B'} />
            <Text style={[styles.quickCardTitle, fastingInfo.isFasting && { color: '#047857' }]}>
              {fastingInfo.isFasting ? 'Fasting Active' : 'Eating Window'}
            </Text>
          </View>
          <Text style={[styles.quickCardVal, fastingInfo.isFasting && { color: '#047857' }]}>
            {fastingInfo.isFasting ? `${fastingInfo.hours}h ${fastingInfo.minutes}m` : 'Tap to Start'}
          </Text>
          <Text style={[styles.quickCardSub, fastingInfo.isFasting && { color: '#059669' }]}>
            {fastingInfo.isFasting ? `Target ${fastingInfo.targetHours}h (${fastingInfo.percentage}%)` : `${profile.fasting_protocol || '16:8'} Fast`}
          </Text>
        </TouchableOpacity>

        {/* Emergency 3-Sec Quick Add Button */}
        <TouchableOpacity
          style={styles.quickAddPillBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setQuickAddVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Zap size={16} color="#FFFFFF" />
          <Text style={styles.quickAddPillText}>3s Quick Add</Text>
        </TouchableOpacity>
      </View>

      {/* Macro Ring Hero Card (with Embedded Calorie Bank Pill) */}
      <View style={styles.ringCard}>
        <View style={styles.embeddedBankHeader}>
          <View style={styles.bankPillInRing}>
            <Text style={styles.bankPillText}>🏦 +{bankedCalories} kcal Banked for Flex Dining</Text>
          </View>
        </View>
        <MacroRing
          currentCalories={totals.calories}
          targetCalories={goals.daily_calories}
          proteinG={totals.protein}
          targetProteinG={goals.daily_protein_g}
          carbsG={totals.carbs}
          targetCarbsG={goals.daily_carbs_g}
          fatG={totals.fat}
          targetFatG={goals.daily_fat_g}
        />

        {/* Macro Breakdown Pills */}
        <View style={styles.macroPillsRow}>
          <View style={styles.macroPill}>
            <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroVal}>{Number(totals.protein).toFixed(2)}/{goals.daily_protein_g}g</Text>
          </View>

          <View style={styles.macroPill}>
            <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.macroLabel}>Carbs</Text>
            <Text style={styles.macroVal}>{Number(totals.carbs).toFixed(2)}/{goals.daily_carbs_g}g</Text>
          </View>

          <View style={styles.macroPill}>
            <View style={[styles.dot, { backgroundColor: '#8B5CF6' }]} />
            <Text style={styles.macroLabel}>Fat</Text>
            <Text style={styles.macroVal}>{Number(totals.fat).toFixed(2)}/{goals.daily_fat_g}g</Text>
          </View>
        </View>
      </View>

      {/* Water Tracker Component */}
      <WaterTrackerCard />

      {/* Glucose & Energy Crash Forecast */}
      <View style={styles.glucoseCard}>
        <View style={styles.glucoseHeader}>
          <ShieldCheck size={18} color={totals.protein >= totals.carbs * 0.4 ? '#10B981' : '#F59E0B'} />
          <Text style={[styles.glucoseTitle, { color: totals.protein >= totals.carbs * 0.4 ? '#065F46' : '#92400E' }]}>
            Glucose & Energy Stability
          </Text>
        </View>
        <Text style={[styles.glucoseText, { color: totals.protein >= totals.carbs * 0.4 ? '#047857' : '#B45309' }]}>
          {todayMeals.length === 0
            ? '⚪ Log your first meal to calculate real-time energy crash risks & glucose stability.'
            : totals.protein >= totals.carbs * 0.4
            ? '⚡ Stable Energy Forecast: High protein ratio prevents post-meal glucose spikes and afternoon fatigue!'
            : '⚠️ Carb Spike Alert: Consider adding lean protein to smooth out energy levels and avoid 3:00 PM crashes.'}
        </Text>
      </View>

      {/* Today's Meals Timeline */}
      <View style={styles.timelineSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>Today's Meals ({todayMeals.length})</Text>
          {todayMeals.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert('Clear Today\'s Meals?', 'Are you sure you want to clear all logged meals for today?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: () => {
                      todayMeals.forEach((m) => deleteMeal(m.id));
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    },
                  },
                ]);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>Clear Today</Text>
            </TouchableOpacity>
          )}
        </View>

        {todayMeals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No meals logged yet for this date</Text>
            <Text style={styles.emptySub}>Tap the camera button below to snap your plate in 1 second!</Text>
          </View>
        ) : (
          (['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const).map((mealType) => {
            const categoryMeals = todayMeals.filter((m) => m.meal_type === mealType);
            if (categoryMeals.length === 0) return null; // Zero empty clutter!

            const categoryCals = categoryMeals.reduce((acc, m) => acc + (Number(m.total_calories) || 0), 0);
            const categoryProtein = Math.round(categoryMeals.reduce((acc, m) => acc + (Number(m.total_protein_g) || 0), 0));
            const icon = mealType === 'Breakfast' ? '🌅' : mealType === 'Lunch' ? '☀️' : mealType === 'Dinner' ? '🌙' : '🍎';

            return (
              <View key={mealType} style={{ marginBottom: 18 }}>
                {/* Sleek Category Group Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>{icon}</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#1E293B' }}>{mealType}</Text>
                    <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#C7D2FE' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#4F46E5' }}>{categoryMeals.length}</Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#4F46E5' }}>
                    {Math.round(categoryCals)} <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700' }}>kcal</Text>
                    <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}> • {categoryProtein}g P</Text>
                  </Text>
                </View>

                {/* Category Meal Cards */}
                {categoryMeals.map((meal) => {
                  const isExpanded = expandedMealId === meal.id;
                  return (
                    <View key={meal.id} style={styles.mealCard}>
                      <View style={styles.mealHeader}>
                        {/* Food Photo Thumbnail — tap to open detail sheet */}
                        {meal.image_uri && meal.image_uri.length > 20 && meal.image_uri !== 'MOCK_IMAGE_DATA' ? (
                          <TouchableOpacity
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDetailMeal(meal); }}
                            activeOpacity={0.85}
                          >
                            <Image
                              source={{ uri: meal.image_uri }}
                              style={{
                                width: 52,
                                height: 52,
                                borderRadius: 14,
                                marginRight: 12,
                                backgroundColor: '#F1F5F9',
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                              }}
                            />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDetailMeal(meal); }}
                            activeOpacity={0.85}
                          >
                            <View
                              style={{
                                width: 52,
                                height: 52,
                                borderRadius: 14,
                                marginRight: 12,
                                backgroundColor: '#EEF2FF',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: '#C7D2FE',
                              }}
                            >
                              <Text style={{ fontSize: 24 }}>
                                {meal.meal_type === 'Breakfast' ? '🍳' : meal.meal_type === 'Lunch' ? '🥗' : meal.meal_type === 'Dinner' ? '🍲' : '🍎'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        )}

                        <View style={{ flex: 1 }}>
                          <Text style={styles.mealDish}>{meal.dish_name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                            <Text style={styles.mealMeta}>
                              {new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setExpandedMealId(isExpanded ? null : meal.id);
                              }}
                              activeOpacity={0.7}
                              style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#C7D2FE' }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: '800', color: '#4F46E5' }}>
                                {isExpanded ? '▼ Close Sliders' : '⚙️ Adjust Portion'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={styles.mealCals}>{meal.total_calories} kcal</Text>
                          <TouchableOpacity
                            onPress={() => {
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              deleteMeal(meal.id);
                            }}
                            activeOpacity={0.6}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            style={styles.trashBtn}
                          >
                            <Trash2 size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.mealMacroBar}>
                        <Text style={styles.macroTag}>P: {Number(meal.total_protein_g).toFixed(2)}g</Text>
                        <Text style={styles.macroTag}>C: {Number(meal.total_carbs_g).toFixed(2)}g</Text>
                        <Text style={styles.macroTag}>F: {Number(meal.total_fat_g).toFixed(2)}g</Text>
                        {meal.estimated_oil_g > 0 && <Text style={styles.oilTag}>🫒 {meal.estimated_oil_g}g oil</Text>}
                      </View>

                      {/* Expandable Recalibration Sliders */}
                      {isExpanded && (
                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#E2E8F0' }}>
                          <PortionSlider
                            multiplier={meal.portion_multiplier || 1.0}
                            onChangeMultiplier={(mult) => {
                              Haptics.selectionAsync();
                              updateMealSliders(meal.id, mult, meal.estimated_oil_g || 0);
                            }}
                          />
                          <OilSlider
                            currentOilGrams={meal.estimated_oil_g || 0}
                            onChangeOil={(oil) => {
                              Haptics.selectionAsync();
                              updateMealSliders(meal.id, meal.portion_multiplier || 1.0, oil);
                            }}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </View>

      {/* Quick Add Modal */}
      <QuickAddModal visible={quickAddVisible} onClose={() => setQuickAddVisible(false)} />

      {/* Scale Weight Log Modal */}
      <WeightLogModal visible={weightLogVisible} onClose={() => setWeightLogVisible(false)} />

      {/* Paywall Modal */}
      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />

      {/* Meal Detail Sheet */}
      <MealDetailSheet meal={detailMeal} onClose={() => setDetailMeal(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  shieldBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  shieldText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284C7',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  trashBtn: {
    padding: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C2410C',
  },
  proBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  proBannerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F46E5',
  },
  quickCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  quickCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  quickCardVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },
  quickCardSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  quickAddPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 6,
  },
  quickAddPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  freezeSavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 8,
  },
  freezeSavedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3730A3',
    flex: 1,
  },
  freezeDismissBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  freezeDismissText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  embeddedBankHeader: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  bankPillInRing: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  bankPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
  },
  ringCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  macroPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  macroPill: {
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  macroVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  glucoseCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  glucoseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  glucoseTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
  glucoseText: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 17,
  },
  timelineSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
  mealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  mealDish: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  mealMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  mealCals: {
    fontSize: 16,
    fontWeight: '900',
    color: '#6366F1',
  },
  mealMacroBar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  macroTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  oilTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  aiTipText: {
    fontSize: 12,
    color: '#4F46E5',
    fontStyle: 'italic',
    marginTop: 4,
  },
  dateSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateArrowBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  dateCenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dateCenterText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  todayPill: {
    marginLeft: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
});
