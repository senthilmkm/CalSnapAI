import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Droplet, Plus, RotateCcw, Sparkles, X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../services/storage';

export function WaterTrackerCard() {
  const [targetModalVisible, setTargetModalVisible] = useState(false);

  const water_logs = useAppStore((state) => state.water_logs);
  const water_target_ml = useAppStore((state) => state.water_target_ml);
  const getTodayWater = useAppStore((state) => state.getTodayWater);
  const addWater = useAppStore((state) => state.addWater);
  const setWaterTarget = useAppStore((state) => state.setWaterTarget);
  const resetTodayWater = useAppStore((state) => state.resetTodayWater);

  const { current, target, percentage } = getTodayWater();

  const handleAddWater = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addWater(amount);
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetTodayWater();
  };

  const handleSelectTarget = (newTarget: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWaterTarget(newTarget);
    setTargetModalVisible(false);
  };

  const remaining = Math.max(0, target - current);

  const targetOptions = [1500, 2000, 2500, 3000, 3500, 4000];

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.iconCircle}>
            <Droplet size={20} color="#0284C7" fill="#0284C7" />
          </View>
          <View>
            <Text style={styles.cardTitle}>Daily Water Intake</Text>
            <Text style={styles.cardSub}>Track your hydration levels</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.targetBadge}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTargetModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.targetText}>{target.toLocaleString()} mL Goal ✏️</Text>
        </TouchableOpacity>
      </View>

      {/* Hero Stats */}
      <View style={styles.heroRow}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text style={styles.currentVal}>{current.toLocaleString()}</Text>
          <Text style={styles.unitVal}>mL</Text>
        </View>

        <View style={styles.percentBadge}>
          <Text style={styles.percentText}>{percentage}%</Text>
        </View>
      </View>

      {/* Liquid Progress Bar */}
      <View style={styles.trackBackground}>
        <View style={[styles.liquidFill, { width: `${Math.min(100, Math.max(0, percentage))}%` }]} />
      </View>

      {/* Subtext info */}
      <View style={styles.statusRow}>
        {percentage >= 100 ? (
          <View style={styles.completedTag}>
            <Sparkles size={14} color="#065F46" />
            <Text style={styles.completedText}>Target Reached! Great Job! 🎉</Text>
          </View>
        ) : (
          <Text style={styles.remainingText}>
            💧 {remaining.toLocaleString()} mL remaining for today
          </Text>
        )}

        <TouchableOpacity onPress={handleReset} style={styles.resetBtn} activeOpacity={0.7}>
          <RotateCcw size={14} color="#94A3B8" />
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Intake Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.quickAddBtn}
          onPress={() => handleAddWater(250)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Plus size={16} color="#0284C7" />
          <Text style={styles.quickAddText}>+250 mL</Text>
          <Text style={styles.quickAddSub}>1 Glass 🥛</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickAddBtn, styles.quickAddBtnPrimary]}
          onPress={() => handleAddWater(500)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={[styles.quickAddText, { color: '#FFFFFF' }]}>+500 mL</Text>
          <Text style={[styles.quickAddSub, { color: 'rgba(255,255,255,0.8)' }]}>1 Bottle 🍾</Text>
        </TouchableOpacity>
      </View>

      {/* Target Water Goal Selection Modal */}
      <Modal visible={targetModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Daily Water Goal</Text>
              <TouchableOpacity onPress={() => setTargetModalVisible(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>Select your optimal hydration target per day:</Text>

            <View style={styles.optionsGrid}>
              {targetOptions.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionBtn, target === opt && styles.optionBtnActive]}
                  onPress={() => handleSelectTarget(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.optionText, target === opt && styles.optionTextActive]}>
                    {opt.toLocaleString()} mL
                  </Text>
                  {target === opt && <Check size={16} color="#0284C7" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  targetBadge: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  targetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  currentVal: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0284C7',
  },
  unitVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  percentBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  percentText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  trackBackground: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },
  liquidFill: {
    height: '100%',
    backgroundColor: '#0284C7',
    borderRadius: 6,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  completedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  remainingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  resetText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAddBtn: {
    flex: 1,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  quickAddBtnPrimary: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  quickAddText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284C7',
  },
  quickAddSub: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  optionsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  optionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionBtnActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  optionTextActive: {
    color: '#0284C7',
    fontWeight: '800',
  },
});
