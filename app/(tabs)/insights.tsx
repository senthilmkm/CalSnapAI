import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import { FileText, Download, TrendingUp, Award, Flame, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../services/storage';
import { exportNutritionPDFReport, exportNutritionCSVReport } from '../../services/pdfExport';
import { WeightTrendChart } from '../../components/WeightTrendChart';

const SCREEN_W = Dimensions.get('window').width;
const BAR_AREA_W = SCREEN_W - 56; // 20px padding each side + 16px internal

function getLastDays(numDays: number): { key: string; label: string }[] {
  const days: { key: string; label: string }[] = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = i === 0 ? 'Today' : numDays > 14 ? `${d.getMonth() + 1}/${d.getDate()}` : d.toLocaleDateString([], { weekday: 'short' });
    days.push({ key, label });
  }
  return days;
}

export default function InsightsScreen() {
  const [exporting, setExporting] = useState(false);
  const [chartRange, setChartRange] = useState<7 | 14 | 30>(7);
  const meals = useAppStore((state) => state.meals);
  const goals = useAppStore((state) => state.goals);
  const profile = useAppStore((state) => state.profile);

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      await exportNutritionPDFReport(meals, goals);
    } catch {
      Alert.alert('Export Failed', 'Unable to generate PDF report.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      await exportNutritionCSVReport(meals);
    } catch {
      Alert.alert('Export Failed', 'Unable to generate CSV report.');
    } finally {
      setExporting(false);
    }
  };

  // Build local date keys & labels based on selected chartRange (7D, 14D, 30D)
  const days = getLastDays(chartRange);
  const dayKeySet = new Set(days.map((d) => d.key));

  // Filter meals strictly within the selected range window using local timezone date keys
  const rangeMeals = meals.filter((meal) => {
    if (!meal || !meal.timestamp) return false;
    const itemDate = new Date(meal.timestamp);
    const dateKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
    return dayKeySet.has(dateKey);
  });

  // Calculate daily calorie totals for the selected range
  const dailyCalories: Record<string, number> = {};
  for (const meal of rangeMeals) {
    const itemDate = new Date(meal.timestamp);
    const dateKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
    dailyCalories[dateKey] = (dailyCalories[dateKey] || 0) + (Number(meal.total_calories) || 0);
  }

  const barValues = days.map((d) => dailyCalories[d.key] || 0);
  const maxBar = Math.max(...barValues, goals.daily_calories || 2000, 1);

  // Streak from store profile
  const streak = profile?.streak_days ?? 0;

  // Range Metrics (Mathematically aligned)
  const totalRangeCalories = barValues.reduce((acc, v) => acc + v, 0);
  const totalRangeMeals = rangeMeals.length;
  const avgKcalPerMeal = totalRangeMeals > 0 ? Math.round(totalRangeCalories / totalRangeMeals) : 0;

  // Real calculated Weekly Calorie Bank
  const getWeeklyBankedCalories = useAppStore((state) => state.getWeeklyBankedCalories);
  const realBankedCalories = getWeeklyBankedCalories();

  // Clinical Grade Nutrition Quality Score Algorithm
  let qualityScore = 0;
  let qualityBadge = 'NO DATA';
  let qualityDesc = 'Log your first meal to calculate your personalized Clinical Nutrition Quality Score.';

  if (meals.length > 0) {
    const targetProteinPerMeal = (goals.daily_protein_g || 140) / 3;
    const avgProtein = Math.round(meals.reduce((acc, m) => acc + (Number(m.total_protein_g) || 0), 0) / meals.length);
    
    // 1. Protein Adequacy (Max 40 pts)
    const proteinRatio = Math.min(1.5, avgProtein / Math.max(1, targetProteinPerMeal));
    const proteinPts = Math.round(proteinRatio * 40);

    // 2. Glycemic Stability (Max 40 pts)
    const lowGlucoseMeals = meals.filter((m) => m.glucose_impact_score === 'LOW').length;
    const glycemicRatio = lowGlucoseMeals / meals.length;
    const glycemicPts = Math.round(glycemicRatio * 40);

    // 3. Oil Control (Max 20 pts)
    const avgOil = meals.reduce((acc, m) => acc + (Number(m.estimated_oil_g) || 0), 0) / meals.length;
    const oilPts = avgOil <= 12 ? 20 : avgOil <= 20 ? 12 : 5;

    qualityScore = Math.min(100, Math.max(40, proteinPts + glycemicPts + oilPts));
    qualityBadge = qualityScore >= 85 ? 'EXCELLENT' : qualityScore >= 70 ? 'GOOD' : 'FAIR';
    qualityDesc = `Your ${chartRange}-day avg is ${avgProtein}g protein/meal with ${Math.round(glycemicRatio * 100)}% stable glycemic meals. ${
      qualityScore >= 85
        ? 'Outstanding high-protein distribution with stable blood sugar!'
        : 'Increase protein & pair carbs with fiber/protein to improve score.'
    }`;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Text style={styles.screenTitle}>Insights & Trends</Text>
      <Text style={styles.screenSubtitle}>Your nutrition trends at a glance, plus weight progress and streak.</Text>

      {/* Streak + Total Banner */}
      <View style={styles.bannerRow}>
        <View style={[styles.bannerCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
          <Flame size={22} color="#F97316" />
          <Text style={[styles.bannerNum, { color: '#F97316' }]}>{streak}</Text>
          <Text style={styles.bannerLabel}>Day Streak 🔥</Text>
        </View>
        <View style={[styles.bannerCard, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
          <Zap size={22} color="#4F46E5" />
          <Text style={[styles.bannerNum, { color: '#4F46E5' }]}>{totalRangeMeals}</Text>
          <Text style={styles.bannerLabel}>{chartRange}D Meals</Text>
        </View>
        <View style={[styles.bannerCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
          <TrendingUp size={22} color="#10B981" />
          <Text style={[styles.bannerNum, { color: '#10B981' }]}>{avgKcalPerMeal}</Text>
          <Text style={styles.bannerLabel}>Avg kcal/Meal</Text>
        </View>
      </View>

      {/* Dynamic Calorie Intake Bar Chart Card */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View>
            <Text style={styles.cardTitle}>📊 Calorie Intake Chart</Text>
            <Text style={styles.cardSubtitle}>Target: {goals.daily_calories} kcal/day</Text>
          </View>

          {/* Time Range Selector (7D | 14D | 30D) */}
          <View style={styles.rangePillRow}>
            {([7, 14, 30] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.rangeBtn,
                  chartRange === r && styles.rangeBtnActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setChartRange(r);
                }}
              >
                <Text style={[styles.rangeBtnText, chartRange === r && styles.rangeBtnTextActive]}>{r}D</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Scrollable Bar Chart for 14D & 30D */}
        <ScrollView horizontal={chartRange > 7} showsHorizontalScrollIndicator={false}>
          <View style={[styles.barChart, chartRange > 7 && { minWidth: chartRange * 36 }]}>
            {barValues.map((val, i) => {
              const barH = Math.max(4, (val / maxBar) * 120);
              const isOver = val > goals.daily_calories;
              const isToday = days[i].label === 'Today';
              const barColor = val === 0 ? '#E2E8F0' : isOver ? '#EF4444' : '#4F46E5';
              return (
                <View key={days[i].key} style={styles.barCol}>
                  <Text style={styles.barValLabel} numberOfLines={1}>
                    {val > 0 ? (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val)) : ''}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barH,
                          backgroundColor: barColor,
                          opacity: isToday ? 1 : 0.85,
                          borderWidth: isToday ? 2 : 0,
                          borderColor: '#4F46E5',
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barDayLabel, isToday && { color: '#4F46E5', fontWeight: '900' }]}>
                    {days[i].label}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>Under target</Text>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444', marginLeft: 14 }]} />
          <Text style={styles.legendText}>Over target</Text>
        </View>
      </View>

      {/* Weight Progress SVG Trend Chart */}
      <WeightTrendChart />

      {/* Nutrition Quality Score */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Award size={20} color="#F59E0B" />
          <Text style={styles.cardTitle}>Nutrition Quality Score</Text>
        </View>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreNumber}>{meals.length > 0 ? `${qualityScore}/100` : '--/100'}</Text>
          <Text style={styles.scoreBadge}>{qualityBadge}</Text>
        </View>
        <Text style={styles.scoreDesc}>{qualityDesc}</Text>
      </View>

      {/* Weekly Calorie Banking */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <TrendingUp size={20} color="#10B981" />
          <Text style={styles.cardTitle}>Weekly Calorie Bank</Text>
        </View>
        <Text style={styles.bankBigVal}>+{realBankedCalories} kcal</Text>
        <Text style={styles.bankSubText}>
          {`Saved +${realBankedCalories} kcal this week below your daily ${goals.daily_calories} kcal target. Perfect for weekend flex dining!`}
        </Text>
      </View>

      {/* Export Card */}
      <View style={styles.exportCard}>
        <View style={styles.exportHeader}>
          <FileText size={24} color="#4F46E5" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.exportTitle}>Export Health Report</Text>
            <Text style={styles.exportDesc}>Generate a PDF or CSV summary for your doctor or coach.</Text>
          </View>
        </View>
        <View style={styles.exportBtnRow}>
          <TouchableOpacity style={styles.pdfBtn} onPress={handleExportPDF} disabled={exporting} activeOpacity={0.85}>
            <Download size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.pdfBtnText}>Export PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.csvBtn} onPress={handleExportCSV} disabled={exporting} activeOpacity={0.85}>
            <Text style={styles.csvBtnText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  contentContainer: { padding: 20, paddingTop: 60, paddingBottom: 100 },
  screenTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  screenSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 20 },

  bannerRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  bannerCard: {
    flex: 1, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', paddingVertical: 14, gap: 4,
  },
  bannerNum: { fontSize: 22, fontWeight: '900' },
  bannerLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', textAlign: 'center' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  cardSubtitle: { fontSize: 12, color: '#94A3B8' },

  rangePillRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  rangeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  rangeBtnActive: {
    backgroundColor: '#4F46E5',
  },
  rangeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  rangeBtnTextActive: {
    color: '#FFFFFF',
  },

  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 160 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValLabel: { fontSize: 8, fontWeight: '800', color: '#64748B', marginBottom: 3, textAlign: 'center', width: '100%' },
  barTrack: { width: '100%', alignItems: 'center', justifyContent: 'flex-end', height: 120 },
  bar: { width: '80%', borderRadius: 6, minHeight: 4 },
  barDayLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', marginTop: 6 },

  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  legendDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4F46E5' },
  legendText: { fontSize: 11, color: '#64748B', marginLeft: 5 },

  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  scoreNumber: { fontSize: 32, fontWeight: '900', color: '#0F172A' },
  scoreBadge: {
    fontSize: 12, fontWeight: '800', color: '#D97706',
    backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  scoreDesc: { fontSize: 13, color: '#64748B', lineHeight: 18 },

  bankBigVal: { fontSize: 28, fontWeight: '900', color: '#10B981', marginBottom: 4 },
  bankSubText: { fontSize: 13, color: '#64748B', lineHeight: 18 },

  exportCard: {
    backgroundColor: '#EEF2FF', borderRadius: 20, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: '#C7D2FE',
  },
  exportHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  exportTitle: { fontSize: 16, fontWeight: '800', color: '#3730A3' },
  exportDesc: { fontSize: 12, color: '#4338CA', marginTop: 2, lineHeight: 16 },
  exportBtnRow: { flexDirection: 'row', gap: 10 },
  pdfBtn: {
    flex: 2, backgroundColor: '#4F46E5', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  pdfBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  csvBtn: {
    flex: 1, backgroundColor: '#FFFFFF', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  csvBtnText: { fontSize: 14, fontWeight: '800', color: '#4F46E5' },
});
