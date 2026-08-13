import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { X, Check, Zap, PlusCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../services/storage';
import { MealRecord } from '../types/nutrition';

interface QuickAddModalProps {
  visible: boolean;
  onClose: () => void;
  onMealLogged?: (meal: MealRecord) => void;
}

const PRESET_CHIPS = [
  { label: '200 cal', cals: 200, p: 10, c: 25, f: 6 },
  { label: '350 cal', cals: 350, p: 20, c: 40, f: 12 },
  { label: '500 cal', cals: 500, p: 30, c: 55, f: 16 },
  { label: '750 cal', cals: 750, p: 40, c: 80, f: 24 },
];

export function QuickAddModal({ visible, onClose, onMealLogged }: QuickAddModalProps) {
  const [dishName, setDishName] = useState<string>('');
  const [caloriesInput, setCaloriesInput] = useState<string>('');
  const [proteinInput, setProteinInput] = useState<string>('');
  const [carbsInput, setCarbsInput] = useState<string>('');
  const [fatInput, setFatInput] = useState<string>('');

  const addMeal = useAppStore((state) => state.addMeal);

  const handleApplyPreset = (preset: typeof PRESET_CHIPS[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCaloriesInput(String(preset.cals));
    setProteinInput(String(preset.p));
    setCarbsInput(String(preset.c));
    setFatInput(String(preset.f));
  };

  const handleSaveQuickMeal = () => {
    const cals = parseInt(caloriesInput, 10);
    if (isNaN(cals) || cals <= 0) {
      Alert.alert('Invalid Calories', 'Please enter a valid calorie amount.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const name = dishName.trim() || 'Quick Calorie Log';
    const p = Math.max(0, parseFloat(proteinInput) || 0);
    const c = Math.max(0, parseFloat(carbsInput) || 0);
    const f = Math.max(0, parseFloat(fatInput) || 0);

    const mealData: Omit<MealRecord, 'id' | 'timestamp'> = {
      dish_name: name,
      meal_type: 'Snack',
      items: [
        {
          id: `item-${Date.now()}`,
          name: name,
          weight_g: 150,
          calories: cals,
          protein_g: p,
          carbs_g: c,
          fat_g: f,
        },
      ],
      estimated_oil_g: 0,
      portion_multiplier: 1.0,
      total_calories: cals,
      total_protein_g: p,
      total_carbs_g: c,
      total_fat_g: f,
      glucose_impact_score: p >= 15 ? 'LOW' : 'MEDIUM',
      energy_crash_risk: p >= 15 ? 'VERY_LOW' : 'LOW',
      ai_tip: 'Quick calorie entry saved successfully.',
    };

    const newMeal = addMeal(mealData);
    if (onMealLogged) onMealLogged(newMeal);

    // Reset state & close
    setDishName('');
    setCaloriesInput('');
    setProteinInput('');
    setCarbsInput('');
    setFatInput('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Zap size={20} color="#4F46E5" />
              <Text style={styles.title}>3-Sec Quick Add</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Quick Presets */}
            <Text style={styles.sectionLabel}>Quick Calorie Presets</Text>
            <View style={styles.presetsRow}>
              {PRESET_CHIPS.map((chip, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.presetChip}
                  onPress={() => handleApplyPreset(chip)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Inputs Form */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Dish or Food Description (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Protein Smoothie, Dinner at Restaurant"
                placeholderTextColor="#94A3B8"
                value={dishName}
                onChangeText={setDishName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Total Calories (Required)</Text>
              <View style={styles.calInputContainer}>
                <TextInput
                  style={styles.calInput}
                  placeholder="450"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="number-pad"
                  value={caloriesInput}
                  onChangeText={setCaloriesInput}
                  maxLength={5}
                />
                <Text style={styles.calUnit}>kcal</Text>
              </View>
            </View>

            {/* Macros Row */}
            <Text style={styles.sectionLabel}>Macronutrients (Optional)</Text>
            <View style={styles.macroRow}>
              <View style={styles.macroCol}>
                <Text style={[styles.macroLabel, { color: '#10B981' }]}>Protein (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  placeholder="25"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="number-pad"
                  value={proteinInput}
                  onChangeText={setProteinInput}
                />
              </View>

              <View style={styles.macroCol}>
                <Text style={[styles.macroLabel, { color: '#F59E0B' }]}>Carbs (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  placeholder="40"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="number-pad"
                  value={carbsInput}
                  onChangeText={setCarbsInput}
                />
              </View>

              <View style={styles.macroCol}>
                <Text style={[styles.macroLabel, { color: '#EF4444' }]}>Fat (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  placeholder="12"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="number-pad"
                  value={fatInput}
                  onChangeText={setFatInput}
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitBtn} onPress={handleSaveQuickMeal} activeOpacity={0.85}>
              <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.submitBtnText}>Log Quick Meal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  calInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  calInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: '#4F46E5',
  },
  calUnit: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4F46E5',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  macroCol: {
    flex: 1,
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  macroInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
