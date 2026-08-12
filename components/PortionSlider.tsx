import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface PortionSliderProps {
  multiplier: number;
  onChangeMultiplier: (multiplier: number) => void;
}

export const PortionSlider: React.FC<PortionSliderProps> = ({ multiplier, onChangeMultiplier }) => {
  const portions = [
    { label: '50%', val: 0.5 },
    { label: '75%', val: 0.75 },
    { label: '100% (Full)', val: 1.0 },
    { label: '125%', val: 1.25 },
    { label: '150%', val: 1.5 },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🍽️ Portion Scale</Text>
        <Text style={styles.badge}>{Math.round(multiplier * 100)}% of plate</Text>
      </View>

      <View style={styles.buttonRow}>
        {portions.map((p) => {
          const isSelected = multiplier === p.val;
          return (
            <TouchableOpacity
              key={p.val}
              style={[styles.optionBtn, isSelected && styles.selectedBtn]}
              onPress={() => onChangeMultiplier(p.val)}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionLabel, isSelected && styles.selectedLabel]}>{p.label}</Text>
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
    color: '#4F46E5',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
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
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
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
