import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Calculator, Check, X, ShieldAlert, Sparkles, ChevronRight, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../services/storage';

interface MacroCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
}

export function MacroCalculatorModal({ visible, onClose }: MacroCalculatorModalProps) {
  const goals = useAppStore((state) => state.goals);
  const updateGoals = useAppStore((state) => state.updateGoals);

  // Form State
  const [sex, setSex] = useState<'Male' | 'Female'>('Male');
  const [age, setAge] = useState('30');
  const [heightFeet, setHeightFeet] = useState('5');
  const [heightInches, setHeightInches] = useState('10');
  const [weightLbs, setWeightLbs] = useState('165');
  const [activity, setActivity] = useState<'Sedentary' | 'Light' | 'Moderate' | 'Very Active'>('Light');
  const [weightGoal, setWeightGoal] = useState<'Lose Weight' | 'Maintain' | 'Build Muscle'>('Lose Weight');

  const [step, setStep] = useState<1 | 2>(1); // 1 = Form Inputs, 2 = Results

  // Clinical Calculations (Mifflin-St Jeor)
  const calculateMacros = () => {
    const ageVal = parseInt(age, 10) || 30;
    const ftVal = parseInt(heightFeet, 10) || 5;
    const inVal = parseInt(heightInches, 10) || 10;
    const wtLbsVal = parseFloat(weightLbs) || 165;

    // Convert height to cm and weight to kg
    const totalInches = ftVal * 12 + inVal;
    const heightCm = totalInches * 2.54;
    const weightKg = wtLbsVal / 2.20462;

    // 1. Base Metabolic Rate (BMR) - Mifflin-St Jeor
    let bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageVal;
    bmr = sex === 'Male' ? bmr + 5 : bmr - 161;

    // 2. Activity Multiplier (TDEE)
    let activityMultiplier = 1.375;
    if (activity === 'Sedentary') activityMultiplier = 1.2;
    if (activity === 'Light') activityMultiplier = 1.375;
    if (activity === 'Moderate') activityMultiplier = 1.55;
    if (activity === 'Very Active') activityMultiplier = 1.725;

    const tdee = bmr * activityMultiplier;

    // 3. Goal Calorie Adjustment
    let targetCalories = tdee;
    if (weightGoal === 'Lose Weight') targetCalories = tdee * 0.8; // 20% Deficit
    if (weightGoal === 'Build Muscle') targetCalories = tdee * 1.15; // 15% Surplus

    // Ensure safe calorie lower floor
    targetCalories = Math.max(1200, Math.round(targetCalories));

    // 4. Clinical Macro Ratio: 28% Protein, 40% Carbs, 29% Fat
    const proteinG = Math.round((targetCalories * 0.28) / 4);
    const carbsG = Math.round((targetCalories * 0.4) / 4);
    const fatG = Math.round((targetCalories * 0.29) / 9);

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      targetCalories,
      proteinG,
      carbsG,
      fatG,
    };
  };

  const results = calculateMacros();

  const handleApplyResults = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateGoals({
      daily_calories: results.targetCalories,
      daily_protein_g: results.proteinG,
      daily_carbs_g: results.carbsG,
      daily_fat_g: results.fatG,
      weight_goal: weightGoal,
    });
    Alert.alert(
      'Target Updated! 🎯',
      `Your daily goal has been set to ${results.targetCalories} kcal (${results.proteinG}g Protein, ${results.carbsG}g Carbs, ${results.fatG}g Fat).`
    );
    onClose();
    setStep(1);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calculator size={22} color="#4F46E5" />
              <Text style={styles.modalTitle}>Macro Goal Calculator</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Medical Disclaimer Banner */}
          <View style={styles.disclaimerBox}>
            <ShieldAlert size={16} color="#0EA5E9" style={{ marginTop: 2 }} />
            <Text style={styles.disclaimerText}>
              <Text style={{ fontWeight: '800' }}>Educational Guidance Only: </Text>
              Estimates daily calorie targets using standard clinical energy balance formulas (Mifflin-St Jeor). Not medical advice.
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
            {step === 1 ? (
              <View>
                {/* Sex Selection */}
                <Text style={styles.inputLabel}>Biological Sex</Text>
                <View style={styles.toggleRow}>
                  {(['Male', 'Female'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.toggleBtn, sex === s && styles.toggleBtnActive]}
                      onPress={() => setSex(s)}
                    >
                      <Text style={[styles.toggleText, sex === s && styles.toggleTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Age & Weight Inputs */}
                <View style={styles.rowTwoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Age (years)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={age}
                      onChangeText={setAge}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Weight (lbs)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={weightLbs}
                      onChangeText={setWeightLbs}
                    />
                  </View>
                </View>

                {/* Height Inputs */}
                <Text style={styles.inputLabel}>Height</Text>
                <View style={styles.rowTwoCol}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={heightFeet}
                      onChangeText={setHeightFeet}
                    />
                    <Text style={styles.inputSub}>Feet</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={heightInches}
                      onChangeText={setHeightInches}
                    />
                    <Text style={styles.inputSub}>Inches</Text>
                  </View>
                </View>

                {/* Physical Activity Level */}
                <Text style={styles.inputLabel}>Daily Activity Level</Text>
                <View style={styles.optionList}>
                  {[
                    { key: 'Sedentary', desc: 'Desk job, little/no exercise' },
                    { key: 'Light', desc: '1-3 light workouts per week' },
                    { key: 'Moderate', desc: '3-5 moderate workouts per week' },
                    { key: 'Very Active', desc: '6-7 hard workouts per week' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.optionCard, activity === item.key && styles.optionCardActive]}
                      onPress={() => setActivity(item.key as any)}
                    >
                      <Text style={[styles.optionTitle, activity === item.key && styles.optionTitleActive]}>
                        {item.key}
                      </Text>
                      <Text style={styles.optionDesc}>{item.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Primary Weight Goal */}
                <Text style={styles.inputLabel}>Primary Goal</Text>
                <View style={styles.toggleRow}>
                  {(['Lose Weight', 'Maintain', 'Build Muscle'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.toggleBtn, weightGoal === g && styles.toggleBtnActive]}
                      onPress={() => setWeightGoal(g)}
                    >
                      <Text style={[styles.toggleText, weightGoal === g && styles.toggleTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              /* Step 2: Results Screen */
              <View>
                <View style={styles.resultsHero}>
                  <Text style={styles.resultsTag}>YOUR RECOMMENDED TARGET</Text>
                  <Text style={styles.resultsBigVal}>{results.targetCalories} <Text style={{ fontSize: 18 }}>kcal/day</Text></Text>
                  <Text style={styles.resultsSub}>
                    {weightGoal === 'Lose Weight'
                      ? '20% Caloric Deficit for steady fat loss'
                      : weightGoal === 'Build Muscle'
                      ? '15% Caloric Surplus for lean muscle gain'
                      : 'Maintenance TDEE to hold current weight'}
                  </Text>
                </View>

                {/* Macro Split Card */}
                <View style={styles.macroCardRow}>
                  <View style={[styles.macroPill, { backgroundColor: '#EEF2FF' }]}>
                    <Text style={[styles.macroVal, { color: '#4F46E5' }]}>{results.proteinG}g</Text>
                    <Text style={styles.macroLbl}>Protein (28%)</Text>
                  </View>
                  <View style={[styles.macroPill, { backgroundColor: '#F0FDF4' }]}>
                    <Text style={[styles.macroVal, { color: '#10B981' }]}>{results.carbsG}g</Text>
                    <Text style={styles.macroLbl}>Carbs (40%)</Text>
                  </View>
                  <View style={[styles.macroPill, { backgroundColor: '#FFF7ED' }]}>
                    <Text style={[styles.macroVal, { color: '#F97316' }]}>{results.fatG}g</Text>
                    <Text style={styles.macroLbl}>Fat (29%)</Text>
                  </View>
                </View>

                {/* Energy Math Details */}
                <View style={styles.detailsBox}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Base Metabolic Rate (BMR):</Text>
                    <Text style={styles.detailVal}>{results.bmr} kcal/day</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Energy Expenditure (TDEE):</Text>
                    <Text style={styles.detailVal}>{results.tdee} kcal/day</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {step === 1 ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setStep(2);
                }}
              >
                <Text style={styles.primaryBtnText}>Calculate My Targets</Text>
                <ChevronRight size={18} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => setStep(1)}
                >
                  <RefreshCw size={16} color="#64748B" />
                  <Text style={styles.secondaryBtnText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleApplyResults}>
                  <Check size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryBtnText}>Apply Target</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  disclaimerBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#4F46E5',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  rowTwoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  inputSub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  optionList: {
    gap: 8,
  },
  optionCard: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
  },
  optionCardActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  optionTitleActive: {
    color: '#4F46E5',
  },
  optionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  resultsHero: {
    backgroundColor: '#4F46E5',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginVertical: 8,
  },
  resultsTag: {
    fontSize: 11,
    fontWeight: '900',
    color: '#C7D2FE',
    letterSpacing: 1,
  },
  resultsBigVal: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  resultsSub: {
    fontSize: 13,
    color: '#E0E7FF',
    fontWeight: '600',
    textAlign: 'center',
  },
  macroCardRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 14,
  },
  macroPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  macroVal: {
    fontSize: 16,
    fontWeight: '900',
  },
  macroLbl: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  actionRow: {
    marginTop: 14,
  },
  primaryBtn: {
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 6,
  },
  secondaryBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
});
