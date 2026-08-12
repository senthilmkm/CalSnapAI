import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line as SvgLine, Text as SvgText } from 'react-native-svg';
import { Scale, TrendingDown, TrendingUp, Plus, Calendar, Trash2, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../services/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 80;
const CHART_HEIGHT = 180;
const PADDING = 25;

export function WeightTrendChart() {
  const [modalVisible, setModalVisible] = useState(false);
  const [inputWeight, setInputWeight] = useState('');
  const [inputNote, setInputNote] = useState('');

  const goals = useAppStore((state) => state.goals);
  const setWeightUnit = useAppStore((state) => state.setWeightUnit);
  const weightEntries = useAppStore((state) => state.weight_entries);
  const addWeightEntry = useAppStore((state) => state.addWeightEntry);
  const deleteWeightEntry = useAppStore((state) => state.deleteWeightEntry);
  const getWeightStats = useAppStore((state) => state.getWeightStats);

  const unit = goals.weight_unit || 'lbs';
  const setUnit = (newUnit: 'lbs' | 'kg') => setWeightUnit(newUnit);

  const stats = getWeightStats();

  const handleOpenAddModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputWeight(stats.current ? stats.current.toString() : '165.0');
    setInputNote('');
    setModalVisible(true);
  };

  const handleSaveEntry = () => {
    const val = parseFloat(inputWeight);
    if (isNaN(val) || val <= 0 || val > 1000) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight number.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const weightInLbs = unit === 'kg' ? Math.round(val * 2.20462 * 10) / 10 : val;
    addWeightEntry(weightInLbs, inputNote.trim() || undefined);
    setModalVisible(false);
  };

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteWeightEntry(id);
  };

  // Convert for unit display
  const displayVal = (weightLbs: number) => {
    if (unit === 'kg') {
      return (Math.round((weightLbs / 2.20462) * 10) / 10).toFixed(1);
    }
    return weightLbs.toFixed(1);
  };

  // Prepare SVG coordinates
  const sortedEntries = [...weightEntries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const values = sortedEntries.map((e) => (unit === 'kg' ? e.weight_lbs / 2.20462 : e.weight_lbs));
  const minVal = values.length ? Math.min(...values) - 1.5 : 150;
  const maxVal = values.length ? Math.max(...values) + 1.5 : 170;
  const range = maxVal - minVal || 1;

  const points = values.map((val, index) => {
    const x =
      values.length === 1
        ? CHART_WIDTH / 2
        : PADDING + (index / (values.length - 1)) * (CHART_WIDTH - 2 * PADDING);
    const y = CHART_HEIGHT - PADDING - ((val - minVal) / range) * (CHART_HEIGHT - 2 * PADDING);
    return { x, y, val, entry: sortedEntries[index] };
  });

  // Calculate smooth cubic bezier path
  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const cp1X = curr.x + (next.x - curr.x) / 3;
      const cp1Y = curr.y;
      const cp2X = curr.x + (2 * (next.x - curr.x)) / 3;
      const cp2Y = next.y;
      path += ` C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${next.x} ${next.y}`;
    }
    return path;
  };

  const linePath = createSmoothPath(points);
  const fillPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${CHART_HEIGHT - 10} L ${points[0].x} ${CHART_HEIGHT - 10} Z`
    : '';

  return (
    <View style={styles.card}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.iconCircle}>
            <Scale size={20} color="#4F46E5" />
          </View>
          <View>
            <Text style={styles.cardTitle}>Weight Progress & Trend</Text>
            <Text style={styles.cardSub}>Track body weight over time</Text>
          </View>
        </View>

        {/* Unit Toggle & Add Btn */}
        <View style={styles.headerActions}>
          <View style={styles.unitToggleContainer}>
            <TouchableOpacity
              style={[styles.unitBtn, unit === 'lbs' && styles.unitBtnActive]}
              onPress={() => setUnit('lbs')}
            >
              <Text style={[styles.unitBtnText, unit === 'lbs' && styles.unitBtnTextActive]}>lbs</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unitBtn, unit === 'kg' && styles.unitBtnActive]}
              onPress={() => setUnit('kg')}
            >
              <Text style={[styles.unitBtnText, unit === 'kg' && styles.unitBtnTextActive]}>kg</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddModal} activeOpacity={0.8}>
            <Plus size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Current</Text>
          <Text style={styles.statValue}>
            {displayVal(stats.current)} <Text style={styles.statUnit}>{unit}</Text>
          </Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Start</Text>
          <Text style={styles.statValue}>
            {displayVal(stats.starting)} <Text style={styles.statUnit}>{unit}</Text>
          </Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total Change</Text>
          <View style={styles.badgeRow}>
            {stats.netChange <= 0 ? (
              <View style={styles.greenBadge}>
                <TrendingDown size={14} color="#065F46" />
                <Text style={styles.greenBadgeText}>
                  {stats.netChange} {unit}
                </Text>
              </View>
            ) : (
              <View style={styles.blueBadge}>
                <TrendingUp size={14} color="#1E40AF" />
                <Text style={styles.blueBadgeText}>
                  +{stats.netChange} {unit}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* SVG Chart Container */}
      <View style={styles.chartContainer}>
        {points.length > 0 ? (
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="gradientFill" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#6366F1" stopOpacity="0.35" />
                <Stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Horizontal Grid lines */}
            {[0.2, 0.5, 0.8].map((ratio, idx) => (
              <SvgLine
                key={idx}
                x1={PADDING}
                y1={CHART_HEIGHT * ratio}
                x2={CHART_WIDTH - PADDING}
                y2={CHART_HEIGHT * ratio}
                stroke="#F1F5F9"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}

            {/* Gradient Fill under curve */}
            {fillPath ? <Path d={fillPath} fill="url(#gradientFill)" /> : null}

            {/* Target Weight Reference Line (Green Dashed) */}
            {(() => {
              const targetLbs = goals.target_weight_lbs || 162.0;
              const targetVal = unit === 'kg' ? targetLbs / 2.20462 : targetLbs;
              const targetY = CHART_HEIGHT - PADDING - ((targetVal - minVal) / range) * (CHART_HEIGHT - 2 * PADDING);
              if (targetY >= PADDING && targetY <= CHART_HEIGHT - PADDING) {
                return (
                  <React.Fragment>
                    <SvgLine
                      x1={PADDING}
                      y1={targetY}
                      x2={CHART_WIDTH - PADDING}
                      y2={targetY}
                      stroke="#10B981"
                      strokeWidth="1.5"
                      strokeDasharray="5 4"
                    />
                    <SvgText
                      x={CHART_WIDTH - PADDING - 4}
                      y={targetY - 4}
                      fill="#065F46"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      Target ({targetVal.toFixed(1)} {unit})
                    </SvgText>
                  </React.Fragment>
                );
              }
              return null;
            })()}

            {/* Curve Line */}
            <Path d={linePath} stroke="#4F46E5" strokeWidth="3" fill="none" strokeLinecap="round" />

            {/* Data Nodes & Value Labels */}
            {points.map((pt, i) => (
              <React.Fragment key={i}>
                <Circle cx={pt.x} cy={pt.y} r="6" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="3" />
                {i === points.length - 1 || i === 0 ? (
                  <SvgText
                    x={pt.x}
                    y={pt.y - 12}
                    fill="#3730A3"
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {pt.val.toFixed(1)}
                  </SvgText>
                ) : null}
              </React.Fragment>
            ))}
          </Svg>
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyText}>No weight entries logged yet</Text>
          </View>
        )}
      </View>

      {/* History Log List */}
      <Text style={styles.historyTitle}>Recent Weigh-Ins</Text>
      <View style={styles.historyList}>
        {sortedEntries.slice(-4).reverse().map((entry) => (
          <View key={entry.id} style={styles.historyRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calendar size={14} color="#64748B" />
              <View>
                <Text style={styles.historyDate}>
                  {new Date(entry.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </Text>
                {entry.note ? <Text style={styles.historyNote}>{entry.note}</Text> : null}
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={styles.historyVal}>
                {displayVal(entry.weight_lbs)} {unit}
              </Text>
              <TouchableOpacity onPress={() => handleDelete(entry.id)} activeOpacity={0.6}>
                <Trash2 size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Add Weight Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Log Weight Entry</Text>
                    <TouchableOpacity onPress={() => { Keyboard.dismiss(); setModalVisible(false); }}>
                      <X size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.inputLabel}>Weight ({unit})</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="decimal-pad"
                    value={inputWeight}
                    onChangeText={setInputWeight}
                    placeholder={`e.g. 165.0 ${unit}`}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    autoFocus
                  />

                  <Text style={styles.inputLabel}>Note (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={inputNote}
                    onChangeText={setInputNote}
                    placeholder="e.g. Morning fast, after workout"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />

                  <TouchableOpacity style={styles.saveModalBtn} onPress={() => { Keyboard.dismiss(); handleSaveEntry(); }} activeOpacity={0.85}>
                    <Text style={styles.saveModalBtnText}>Save Entry</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    backgroundColor: '#EEF2FF',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 2,
  },
  unitBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unitBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  unitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  unitBtnTextActive: {
    color: '#4F46E5',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statBox: {
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  badgeRow: {
    marginTop: 2,
  },
  greenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  greenBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  blueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  blueBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  emptyChart: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 8,
  },
  historyList: {
    gap: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  historyNote: {
    fontSize: 11,
    color: '#64748B',
  },
  historyVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
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
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
  },
  saveModalBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveModalBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
