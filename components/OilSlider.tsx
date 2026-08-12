import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface OilSliderProps {
  currentOilGrams: number;
  onChangeOil: (grams: number) => void;
}

export const OilSlider: React.FC<OilSliderProps> = ({ currentOilGrams, onChangeOil }) => {
  const options = [
    { label: 'None (0g)', grams: 0, cals: '+0 kcal' },
    { label: 'Light (5g)', grams: 5, cals: '+45 kcal' },
    { label: 'Medium (10g)', grams: 10, cals: '+90 kcal' },
    { label: 'Heavy (20g)', grams: 20, cals: '+180 kcal' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🫒 Cooking Oil & Sauces</Text>
        <Text style={styles.badge}>{currentOilGrams}g oil ({currentOilGrams * 9} kcal)</Text>
      </View>

      <View style={styles.buttonRow}>
        {options.map((opt) => {
          const isSelected = currentOilGrams === opt.grams;
          return (
            <TouchableOpacity
              key={opt.grams}
              style={[styles.optionBtn, isSelected && styles.selectedBtn]}
              onPress={() => onChangeOil(opt.grams)}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionLabel, isSelected && styles.selectedLabel]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  selectedBtn: {
    backgroundColor: '#4338CA',
    borderColor: '#4338CA',
  },
  optionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  selectedLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
