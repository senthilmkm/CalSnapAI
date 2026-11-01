import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import {
  Target,
  Sparkles,
  Calendar,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Flame,
  Globe,
  Activity,
  Award,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../services/storage';

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
}

export function OnboardingModal({ visible, onClose }: OnboardingModalProps) {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const skipOnboarding = useAppStore((state) => state.skipOnboarding);
  const goals = useAppStore((state) => state.goals);
  const profile = useAppStore((state) => state.profile);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Body & Goal
  const [sex, setSex] = useState<'Male' | 'Female'>('Male');
  const [age, setAge] = useState<string>('28');
  const [heightFeet, setHeightFeet] = useState<string>('5');
  const [heightInches, setHeightInches] = useState<string>('10');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>(goals.weight_unit || 'lbs');

  const getInitialCurrentWeight = (unit: 'lbs' | 'kg') => {
    if (profile.current_weight_kg && profile.current_weight_kg > 0) {
      return unit === 'kg'
        ? String(Math.round(profile.current_weight_kg * 10) / 10)
        : String(Math.round(profile.current_weight_kg * 2.20462));
    }
    return unit === 'kg' ? '75' : '165';
  };

  const getInitialTargetWeight = (unit: 'lbs' | 'kg') => {
    if (goals.target_weight_lbs && goals.target_weight_lbs > 0) {
      return unit === 'kg'
        ? String(Math.round((goals.target_weight_lbs / 2.20462) * 10) / 10)
        : String(Math.round(goals.target_weight_lbs * 10) / 10);
    }
    return unit === 'kg' ? '68' : '150';
  };

  const [currentWeightInput, setCurrentWeightInput] = useState<string>(() =>
    getInitialCurrentWeight(goals.weight_unit || 'lbs')
  );
  const [targetWeightInput, setTargetWeightInput] = useState<string>(() =>
    getInitialTargetWeight(goals.weight_unit || 'lbs')
  );
  const [weightGoal, setWeightGoal] = useState<'Lose Weight' | 'Maintain' | 'Build Muscle'>(
    goals.weight_goal || 'Lose Weight'
  );

  // Reset or sync when modal becomes visible
  useEffect(() => {
    if (visible) {
      setStep(1);
      setValidationError(null);
      const unit = goals.weight_unit || 'lbs';
      setWeightUnit(unit);
      setCurrentWeightInput(getInitialCurrentWeight(unit));
      setTargetWeightInput(getInitialTargetWeight(unit));
      if (goals.weight_goal) {
        setWeightGoal(goals.weight_goal);
      }
      if (goals.cultural_preset) {
        setCulturalPreset(goals.cultural_preset);
      }
    }
  }, [visible]);

  // Step 2: Activity & Cuisine
  const [activity, setActivity] = useState<'Sedentary' | 'Light' | 'Moderate' | 'Very Active'>('Light');
  const [culturalPreset, setCulturalPreset] = useState<
    'Standard' | 'Indian Homestyle' | 'East Asian' | 'Middle Eastern' | 'Latin American'
  >(goals.cultural_preset || 'Standard');

  // Validation Error
  const [validationError, setValidationError] = useState<string | null>(null);

  // Safe Weight Unit Conversion
  const convertWeightInput = (val: string, toUnit: 'lbs' | 'kg') => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      return toUnit === 'lbs' ? '165' : '75';
    }
    return toUnit === 'lbs'
      ? String(Math.round(num * 2.20462))
      : String(Math.round((num / 2.20462) * 10) / 10);
  };

  // Clinical Mifflin-St Jeor & Projected Finish Line Calculations
  const computeRoadmap = () => {
    const ageVal = Math.max(13, Math.min(100, parseInt(age, 10) || 28));
    const ftVal = Math.max(3, Math.min(7, parseInt(heightFeet, 10) || 5));
    const inVal = Math.max(0, Math.min(11, parseInt(heightInches, 10) || 10));
    const currWtVal = Math.max(30, parseFloat(currentWeightInput) || (weightUnit === 'kg' ? 75 : 165));
    const targWtVal = Math.max(30, parseFloat(targetWeightInput) || (weightUnit === 'kg' ? 68 : 150));

    // Height in cm
    const totalInches = ftVal * 12 + inVal;
    const heightCm = totalInches * 2.54;

    // Weight in kg and lbs
    const currentKg = weightUnit === 'kg' ? currWtVal : currWtVal / 2.20462;
    const currentLbs = weightUnit === 'lbs' ? currWtVal : currWtVal * 2.20462;
    const targetLbs = weightUnit === 'lbs' ? targWtVal : targWtVal * 2.20462;

    // 1. Base Metabolic Rate (BMR) - Mifflin-St Jeor Formula
    let bmr = 10 * currentKg + 6.25 * heightCm - 5 * ageVal;
    bmr = sex === 'Male' ? bmr + 5 : bmr - 161;

    // 2. Activity Multiplier (TDEE)
    let activityMultiplier = 1.375;
    if (activity === 'Sedentary') activityMultiplier = 1.2;
    if (activity === 'Light') activityMultiplier = 1.375;
    if (activity === 'Moderate') activityMultiplier = 1.55;
    if (activity === 'Very Active') activityMultiplier = 1.725;

    const tdee = bmr * activityMultiplier;

    // 3. Goal Adjustment & Daily Calorie Target
    let targetCalories = tdee;

    if (weightGoal === 'Lose Weight') {
      targetCalories = tdee * 0.8; // 20% clinical deficit
    } else if (weightGoal === 'Build Muscle') {
      targetCalories = tdee * 1.15; // 15% lean surplus
    }

    // Safety Floor: 1,200 kcal
    targetCalories = Math.max(1200, Math.round(targetCalories));
    const effectiveDeficit = Math.max(0, Math.round(tdee - targetCalories));

    // 4. Clinical Macro Split: 28% Protein, 40% Carbs, 29% Fat
    const proteinG = Math.round((targetCalories * 0.28) / 4);
    const carbsG = Math.round((targetCalories * 0.4) / 4);
    const fatG = Math.round((targetCalories * 0.29) / 9);

    // 5. Projected Goal Date & Timeline
    let daysToGoal = 0;
    let projectedDateStr = '';
    let weeksToGoal = 0;

    if (weightGoal === 'Lose Weight') {
      const weightDeltaLbs = Math.max(0, currentLbs - targetLbs);
      if (weightDeltaLbs > 0) {
        const totalDeficitNeeded = weightDeltaLbs * 3500; // 3,500 kcal per lb of fat
        const safeDailyDeficit = Math.max(250, effectiveDeficit);
        daysToGoal = Math.ceil(totalDeficitNeeded / safeDailyDeficit);
        weeksToGoal = Math.max(1, Math.round(daysToGoal / 7));
        const finishDate = new Date(Date.now() + daysToGoal * 86400000);
        projectedDateStr = finishDate.toISOString().split('T')[0];
      } else {
        daysToGoal = 0;
        weeksToGoal = 0;
        projectedDateStr = '';
      }
    } else if (weightGoal === 'Build Muscle') {
      const weightDeltaLbs = Math.max(0, targetLbs - currentLbs);
      if (weightDeltaLbs > 0) {
        // Realistic lean muscle gain: ~0.5 lb / week
        weeksToGoal = Math.max(2, Math.round(weightDeltaLbs / 0.5));
        daysToGoal = weeksToGoal * 7;
        const finishDate = new Date(Date.now() + daysToGoal * 86400000);
        projectedDateStr = finishDate.toISOString().split('T')[0];
      } else {
        daysToGoal = 0;
        weeksToGoal = 0;
        projectedDateStr = '';
      }
    } else {
      // Maintain
      daysToGoal = 0;
      weeksToGoal = 0;
      projectedDateStr = '';
    }

    return {
      currentKg,
      currentLbs,
      targetLbs,
      tdee: Math.round(tdee),
      targetCalories,
      proteinG,
      carbsG,
      fatG,
      daysToGoal,
      weeksToGoal,
      projectedDateStr,
    };
  };

  const roadmap = computeRoadmap();

  const handleNextStep1 = () => {
    Keyboard.dismiss();
    const curr = parseFloat(currentWeightInput);
    const targ = parseFloat(targetWeightInput);
    if (!curr || isNaN(curr) || curr < 30 || curr > 700) {
      setValidationError('Please enter a realistic current weight.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!targ || isNaN(targ) || targ < 30 || targ > 700) {
      setValidationError('Please enter a realistic goal weight.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (weightGoal === 'Lose Weight' && curr <= targ) {
      setValidationError('For weight loss, your goal weight should be lower than your current weight.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (weightGoal === 'Build Muscle' && curr >= targ) {
      setValidationError('For muscle building, your goal weight should be higher than your current weight.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setValidationError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(2);
  };

  const handleNextStep2 = () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep(3);
  };

  const handleComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeOnboarding({
      current_weight_kg: roadmap.currentKg,
      target_weight_lbs: Math.round(roadmap.targetLbs * 10) / 10,
      weight_goal: weightGoal,
      cultural_preset: culturalPreset,
      weight_unit: weightUnit,
      daily_calories: roadmap.targetCalories,
      daily_protein_g: roadmap.proteinG,
      daily_carbs_g: roadmap.carbsG,
      daily_fat_g: roadmap.fatG,
      target_date: roadmap.projectedDateStr,
    });
    onClose();
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    skipOnboarding();
    onClose();
  };

  const formatDisplayDate = (isoStr?: string) => {
    if (!isoStr) return '';
    const [y, m, d] = isoStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleSkip}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          {step > 1 ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStep((prev) => (prev - 1) as any);
              }}
              style={styles.backBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={22} color="#0F172A" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 28 }} />
          )}

          {/* 3-Step Dots */}
          <View style={styles.dotsRow}>
            <View style={[styles.dot, step >= 1 && styles.dotActive]} />
            <View style={[styles.dot, step >= 2 && styles.dotActive]} />
            <View style={[styles.dot, step >= 3 && styles.dotActive]} />
          </View>

          {step < 3 ? (
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.skipBtnText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 1: Body Metrics & Strategy */}
          {step === 1 && (
            <View>
              <View style={styles.headerBlock}>
                <View style={styles.iconCircle}>
                  <Target size={24} color="#4F46E5" />
                </View>
                <Text style={styles.stepTitle}>Let's Build Your Roadmap</Text>
                <Text style={styles.stepSubtitle}>
                  CalSnap AI customizes your calorie budget to your exact biology and goal.
                </Text>
              </View>

              {/* Sex Selector */}
              <Text style={styles.inputLabel}>Biological Sex</Text>
              <View style={styles.pillRow}>
                {(['Male', 'Female'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.choicePill, sex === s && styles.choicePillActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSex(s);
                    }}
                  >
                    <Text style={[styles.choicePillText, sex === s && styles.choicePillTextActive]}>
                      {s === 'Male' ? '👨 Male' : '👩 Female'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Age & Height */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Age</Text>
                  <TextInput
                    style={styles.textInput}
                    value={age}
                    onChangeText={setAge}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>

                <View style={{ flex: 2 }}>
                  <Text style={styles.inputLabel}>Height</Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={heightFeet}
                      onChangeText={setHeightFeet}
                      keyboardType="number-pad"
                      maxLength={1}
                    />
                    <Text style={styles.unitLabel}>ft</Text>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={heightInches}
                      onChangeText={setHeightInches}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={styles.unitLabel}>in</Text>
                  </View>
                </View>
              </View>

              {/* Weight & Unit Toggle */}
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={[styles.inputLabel, { marginBottom: 0 }]}>Body Weight</Text>
                  <View style={styles.unitToggleRow}>
                    <TouchableOpacity
                      style={[styles.unitToggleBtn, weightUnit === 'lbs' && styles.unitToggleBtnActive]}
                      onPress={() => {
                        if (weightUnit !== 'lbs') {
                          setWeightUnit('lbs');
                          setCurrentWeightInput(convertWeightInput(currentWeightInput, 'lbs'));
                          setTargetWeightInput(convertWeightInput(targetWeightInput, 'lbs'));
                          setValidationError(null);
                        }
                      }}
                    >
                      <Text style={[styles.unitToggleText, weightUnit === 'lbs' && styles.unitToggleTextActive]}>lbs</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitToggleBtn, weightUnit === 'kg' && styles.unitToggleBtnActive]}
                      onPress={() => {
                        if (weightUnit !== 'kg') {
                          setWeightUnit('kg');
                          setCurrentWeightInput(convertWeightInput(currentWeightInput, 'kg'));
                          setTargetWeightInput(convertWeightInput(targetWeightInput, 'kg'));
                          setValidationError(null);
                        }
                      }}
                    >
                      <Text style={[styles.unitToggleText, weightUnit === 'kg' && styles.unitToggleTextActive]}>kg</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subInputLabel}>Current</Text>
                    <TextInput
                      style={styles.textInput}
                      value={currentWeightInput}
                      onChangeText={(val) => {
                        setCurrentWeightInput(val);
                        setValidationError(null);
                      }}
                      keyboardType="decimal-pad"
                      maxLength={5}
                      placeholder={weightUnit === 'lbs' ? '165' : '75'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subInputLabel}>Goal Target</Text>
                    <TextInput
                      style={styles.textInput}
                      value={targetWeightInput}
                      onChangeText={(val) => {
                        setTargetWeightInput(val);
                        setValidationError(null);
                      }}
                      keyboardType="decimal-pad"
                      maxLength={5}
                      placeholder={weightUnit === 'lbs' ? '150' : '68'}
                    />
                  </View>
                </View>
              </View>

              {/* Goal Strategy Selection */}
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Primary Goal</Text>
              <View style={styles.strategyRow}>
                {(['Lose Weight', 'Maintain', 'Build Muscle'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.strategyCard, weightGoal === g && styles.strategyCardActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setWeightGoal(g);
                      setValidationError(null);
                    }}
                  >
                    <Text style={styles.strategyEmoji}>
                      {g === 'Lose Weight' ? '🔥' : g === 'Maintain' ? '⚖️' : '💪'}
                    </Text>
                    <Text style={[styles.strategyTitle, weightGoal === g && styles.strategyTitleActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {validationError && (
                <Text style={styles.validationErrorText}>⚠️ {validationError}</Text>
              )}

              <TouchableOpacity style={styles.primaryActionBtn} onPress={handleNextStep1} activeOpacity={0.85}>
                <Text style={styles.primaryActionBtnText}>Next: Activity & Diet</Text>
                <ChevronRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: Activity & Cultural Cuisine */}
          {step === 2 && (
            <View>
              <View style={styles.headerBlock}>
                <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
                  <Activity size={24} color="#10B981" />
                </View>
                <Text style={styles.stepTitle}>Lifestyle & Cooking Style</Text>
                <Text style={styles.stepSubtitle}>
                  Guides AI vision on local cooking oil, ghee, and true metabolic expenditure.
                </Text>
              </View>

              <Text style={styles.inputLabel}>Daily Activity Level</Text>
              <View style={{ gap: 8 }}>
                {[
                  { key: 'Sedentary', title: '🛋️ Sedentary', desc: 'Little to no exercise, desk work' },
                  { key: 'Light', title: '🚶 Light Active', desc: '1–3 light workouts or daily walking' },
                  { key: 'Moderate', title: '🏃 Moderate Active', desc: '3–5 gym sessions or sports per week' },
                  { key: 'Very Active', title: '⚡ Highly Active', desc: '6–7 days of intense athletic training' },
                ].map((act) => (
                  <TouchableOpacity
                    key={act.key}
                    style={[styles.activityOptionCard, activity === act.key && styles.activityOptionCardActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActivity(act.key as any);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activityTitle, activity === act.key && styles.activityTitleActive]}>
                        {act.title}
                      </Text>
                      <Text style={styles.activityDesc}>{act.desc}</Text>
                    </View>
                    {activity === act.key && <Check size={18} color="#4F46E5" />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Cultural Cuisine Selection */}
              <Text style={[styles.inputLabel, { marginTop: 18 }]}>Typical Home Cuisine (AI Vision Tuning)</Text>
              <View style={styles.cuisineGrid}>
                {[
                  { key: 'Standard', label: '🌐 Standard / Western' },
                  { key: 'Indian Homestyle', label: '🍛 Indian (Ghee/Tadka)' },
                  { key: 'East Asian', label: '🥢 East Asian (Wok/Soy)' },
                  { key: 'Middle Eastern', label: '🥙 Middle Eastern (Tahini)' },
                  { key: 'Latin American', label: '🌮 Latin (Avocado/Corn)' },
                ].map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.cuisineChip, culturalPreset === c.key && styles.cuisineChipActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCulturalPreset(c.key as any);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cuisineChipText, culturalPreset === c.key && styles.cuisineChipTextActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.primaryActionBtn} onPress={handleNextStep2} activeOpacity={0.85}>
                <Sparkles size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>Calculate My Finish Line</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 3: The Roadmap Reveal (The WOW Moment) */}
          {step === 3 && (
            <View>
              <View style={styles.headerBlock}>
                <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                  <Award size={26} color="#059669" />
                </View>
                <Text style={styles.stepTitle}>Your Personal Roadmap</Text>
                <Text style={styles.stepSubtitle}>
                  Here is your scientifically calculated calorie budget and goal finish line.
                </Text>
              </View>

              {/* Giant Finish Line Highlight Card */}
              <View style={styles.revealHeroCard}>
                <View style={styles.revealHeroHeader}>
                  <Text style={styles.revealHeroTag}>🎯 PERSONALIZED TRANSFORMATION PLAN</Text>
                </View>

                <View style={styles.targetCalsRow}>
                  <Text style={styles.targetCalsNumber}>{roadmap.targetCalories}</Text>
                  <Text style={styles.targetCalsUnit}>kcal / day</Text>
                </View>

                {weightGoal !== 'Maintain' && roadmap.projectedDateStr && roadmap.daysToGoal > 0 ? (
                  <View style={styles.timelineBanner}>
                    <Calendar size={18} color="#065F46" />
                    <Text style={styles.timelineBannerText}>
                      Projected Goal: <Text style={{ fontWeight: '900' }}>{formatDisplayDate(roadmap.projectedDateStr)}</Text>
                      {' '}(~{roadmap.weeksToGoal} {roadmap.weeksToGoal === 1 ? 'week' : 'weeks'})
                    </Text>
                  </View>
                ) : weightGoal !== 'Maintain' && roadmap.daysToGoal === 0 ? (
                  <View style={styles.timelineBanner}>
                    <Sparkles size={18} color="#065F46" />
                    <Text style={styles.timelineBannerText}>
                      🎉 You are already at or beyond your goal target!
                    </Text>
                  </View>
                ) : null}

                <View style={styles.statsPillRow}>
                  <View style={styles.statPill}>
                    <Text style={styles.statPillVal}>{roadmap.tdee} kcal</Text>
                    <Text style={styles.statPillLabel}>Daily Burn (TDEE)</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statPill}>
                    <Text style={styles.statPillVal}>
                      {weightGoal === 'Lose Weight'
                        ? `-${Math.abs(roadmap.tdee - roadmap.targetCalories)} kcal`
                        : weightGoal === 'Build Muscle'
                        ? `+${Math.abs(roadmap.targetCalories - roadmap.tdee)} kcal`
                        : '0 (Balanced)'}
                    </Text>
                    <Text style={styles.statPillLabel}>
                      {weightGoal === 'Build Muscle' ? 'Daily Surplus' : 'Daily Deficit'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Macro Distribution Cards */}
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Clinical Macro Targets</Text>
              <View style={styles.macroRow}>
                <View style={[styles.macroCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                  <Text style={[styles.macroEmoji, { color: '#047857' }]}>🍗 Protein</Text>
                  <Text style={styles.macroVal}>{roadmap.proteinG}g</Text>
                  <Text style={styles.macroRatio}>28% ratio</Text>
                </View>

                <View style={[styles.macroCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <Text style={[styles.macroEmoji, { color: '#B45309' }]}>🍚 Carbs</Text>
                  <Text style={styles.macroVal}>{roadmap.carbsG}g</Text>
                  <Text style={styles.macroRatio}>40% ratio</Text>
                </View>

                <View style={[styles.macroCard, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                  <Text style={[styles.macroEmoji, { color: '#6D28D9' }]}>🥑 Healthy Fat</Text>
                  <Text style={styles.macroVal}>{roadmap.fatG}g</Text>
                  <Text style={styles.macroRatio}>29% ratio</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.launchBtn} onPress={handleComplete} activeOpacity={0.85}>
                <Text style={styles.launchBtnText}>Start My Journey 🚀</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    backgroundColor: '#4F46E5',
  },
  skipBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
  },
  subInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  unitLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choicePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  choicePillActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  choicePillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  choicePillTextActive: {
    color: '#4F46E5',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  unitToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  unitToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unitToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unitToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  unitToggleTextActive: {
    color: '#4F46E5',
  },
  strategyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  strategyCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  strategyCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  strategyEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  strategyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'center',
  },
  strategyTitleActive: {
    color: '#4F46E5',
  },
  validationErrorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  primaryActionBtn: {
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    marginTop: 24,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  activityOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  activityOptionCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  activityTitleActive: {
    color: '#4F46E5',
  },
  activityDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cuisineChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  cuisineChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  cuisineChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  cuisineChipTextActive: {
    color: '#4F46E5',
  },
  revealHeroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  revealHeroHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  revealHeroTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#818CF8',
    letterSpacing: 1,
  },
  targetCalsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 10,
  },
  targetCalsNumber: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  targetCalsUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94A3B8',
  },
  timelineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  timelineBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  statsPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  statPill: {
    alignItems: 'center',
  },
  statPillVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  statPillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  macroCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
  },
  macroEmoji: {
    fontSize: 11,
    fontWeight: '800',
  },
  macroVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: 2,
  },
  macroRatio: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  launchBtn: {
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  launchBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
