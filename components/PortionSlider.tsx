import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface PortionSliderProps {
  multiplier: number;
  onChangeMultiplier: (multiplier: number) => void;
  isPro?: boolean;
  onPressLock?: () => void;
  mode?: 'plate' | 'servings';
}

export const PortionSlider: React.FC<PortionSliderProps> = ({
  multiplier,
  onChangeMultiplier,
  isPro = true,
  onPressLock,
  mode = 'plate',
}) => {
  const isServingsMode = mode === 'servings';

  const portions = isServingsMode
    ? [
        { label: '½ Serving', sub: '0.5x', val: 0.5 },
        { label: '¾ Serving', sub: '0.75x', val: 0.75 },
        { label: '1 Serving', sub: '1.0x', val: 1.0 },
        { label: '1½ Servings', sub: '1.5x', val: 1.5 },
        { label: '2 Servings', sub: '2.0x', val: 2.0 },
      ]
    : [
        { label: '½ Plate', sub: '50%', val: 0.5 },
        { label: '¾ Plate', sub: '75%', val: 0.75 },
        { label: 'Whole Plate', sub: 'AI Default', val: 1.0 },
        { label: '+Extra Scoop', sub: '125%', val: 1.25 },
        { label: 'Had Seconds', sub: '150%', val: 1.5 },
      ];

  const getMultiplierLabel = (val: number) => {
    if (isServingsMode) {
      if (val === 1.0) return '1 Serving (1.0x)';
      if (val === 0.5) return '½ Serving (0.5x)';
      if (val === 0.75) return '¾ Serving (0.75x)';
      if (val === 1.5) return '1½ Servings (1.5x)';
      if (val === 2.0) return '2 Servings (2.0x)';
      return `${val}x Servings`;
    }
    if (val === 1.0) return 'Whole Plate (1.0x)';
    if (val === 0.5) return '½ Plate (0.5x)';
    if (val === 0.75) return '¾ Plate (0.75x)';
    if (val === 1.25) return '+Extra Scoop (1.25x)';
    if (val === 1.5) return 'Had Seconds (1.5x)';
    return `${Math.round(val * 100)}% of plate`;
  };

  const getHelperText = (val: number) => {
    if (isServingsMode) {
      if (val === 1.0) {
        return 'Standard 1 serving from nutrition facts label. Adjust if you ate more or less.';
      }
      if (val < 1.0) {
        return `Portion scaled down to ${Math.round(val * 100)}% of standard serving.`;
      }
      return `Portion scaled up to ${val}x servings (+${Math.round((val - 1.0) * 100)}% calories).`;
    }
    if (val === 1.0) {
      return 'Standard adult plate detected by AI. Change only if you ate less or had seconds.';
    }
    if (val < 1.0) {
      return `Portion reduced (${Math.round(val * 100)}% calories applied).`;
    }
    return `Portion increased (+${Math.round((val - 1.0) * 100)}% calories for extra serving).`;
  };

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.title}>
            {isServingsMode ? '📦 Servings / Quantity' : '🍽️ Portion Scale'}
          </Text>
          {!isPro && <Text style={styles.lockBadge}>🔒 PRO</Text>}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {multiplier !== 1.0 && (
            <TouchableOpacity
              onPress={() => onChangeMultiplier(1.0)}
              style={styles.resetBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.resetBtnText}>↩ Reset</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.badge}>{getMultiplierLabel(multiplier)}</Text>
        </View>
      </View>

      {/* Button Row */}
      <View style={styles.buttonRow}>
        {portions.map((p) => {
          const isSelected = Math.abs(multiplier - p.val) < 0.05;
          return (
            <TouchableOpacity
              key={p.val}
              style={[styles.optionBtn, isSelected && styles.selectedBtn]}
              onPress={() => {
                if (!isPro && onPressLock) {
                  onPressLock();
                } else {
                  onChangeMultiplier(p.val);
                }
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.optionLabel, isSelected && styles.selectedLabel]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {p.label}
              </Text>
              <Text style={[styles.optionSub, isSelected && styles.selectedSub]}>
                {p.sub}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Live Reassuring Helper Subtext */}
      <Text style={styles.helperText}>{getHelperText(multiplier)}</Text>
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
  lockBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4F46E5',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  resetBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
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
    paddingVertical: 8,
    paddingHorizontal: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  selectedBtn: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  optionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  selectedLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  optionSub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  selectedSub: {
    color: '#E0E7FF',
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 10,
    lineHeight: 15,
  },
});

