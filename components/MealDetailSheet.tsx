import React from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { X, Zap, Flame, Droplets, Beef } from 'lucide-react-native';
import { MealRecord } from '../types/nutrition';

interface Props {
  meal: MealRecord | null;
  onClose: () => void;
}

const GLUCOSE_COLOR: Record<string, string> = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
};

const CRASH_COLOR: Record<string, string> = {
  VERY_LOW: '#10B981',
  LOW: '#34D399',
  MODERATE: '#F59E0B',
  HIGH: '#EF4444',
};

export function MealDetailSheet({ meal, onClose }: Props) {
  if (!meal) return null;

  const hasPhoto = meal.image_uri && meal.image_uri.length > 20 && meal.image_uri !== 'MOCK_IMAGE_DATA';

  return (
    <Modal animationType="slide" transparent={false} visible={!!meal} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{meal.dish_name}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Food Photo */}
          {hasPhoto ? (
            <Image
              source={{ uri: meal.image_uri }}
              style={styles.foodPhoto}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.foodPhoto, styles.noPhotoPlaceholder]}>
              <Text style={{ fontSize: 64 }}>
                {meal.meal_type === 'Breakfast' ? '🍳' : meal.meal_type === 'Lunch' ? '🥗' : meal.meal_type === 'Dinner' ? '🍲' : '🍎'}
              </Text>
              <Text style={styles.noPhotoLabel}>{meal.meal_type}</Text>
            </View>
          )}

          {/* Meal Meta */}
          <View style={styles.metaRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{meal.meal_type}</Text>
            </View>
            <Text style={styles.metaTime}>
              {new Date(meal.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {/* Calorie Hero */}
          <View style={styles.calsCard}>
            <Flame size={28} color="#F97316" />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.calsNumber}>{meal.total_calories} kcal</Text>
              <Text style={styles.calsLabel}>Total Energy · {(meal.portion_multiplier || 1).toFixed(1)}x portion</Text>
            </View>
          </View>

          {/* Macro Pills */}
          <View style={styles.macrosRow}>
            <View style={[styles.macroPill, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
              <Beef size={16} color="#4F46E5" />
              <Text style={[styles.macroVal, { color: '#4F46E5' }]}>{Number(meal.total_protein_g).toFixed(1)}g</Text>
              <Text style={styles.macroLbl}>Protein</Text>
            </View>
            <View style={[styles.macroPill, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
              <Zap size={16} color="#F97316" />
              <Text style={[styles.macroVal, { color: '#F97316' }]}>{Number(meal.total_carbs_g).toFixed(1)}g</Text>
              <Text style={styles.macroLbl}>Carbs</Text>
            </View>
            <View style={[styles.macroPill, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
              <Droplets size={16} color="#D97706" />
              <Text style={[styles.macroVal, { color: '#D97706' }]}>{Number(meal.total_fat_g).toFixed(1)}g</Text>
              <Text style={styles.macroLbl}>Fat</Text>
            </View>
          </View>

          {meal.estimated_oil_g > 0 && (
            <View style={styles.oilRow}>
              <Text style={styles.oilText}>🫒 Cooking Oil: {meal.estimated_oil_g}g</Text>
            </View>
          )}

          {/* Glucose & Energy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Metabolic Impact</Text>
            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, { borderColor: (GLUCOSE_COLOR[meal.glucose_impact_score] || '#10B981') + '44' }]}>
                <Text style={styles.metricLabel}>Blood Sugar Impact</Text>
                <Text style={[styles.metricValue, { color: GLUCOSE_COLOR[meal.glucose_impact_score] || '#10B981' }]}>
                  {meal.glucose_impact_score}
                </Text>
              </View>
              <View style={[styles.metricCard, { borderColor: (CRASH_COLOR[meal.energy_crash_risk] || '#10B981') + '44' }]}>
                <Text style={styles.metricLabel}>Energy Crash Risk</Text>
                <Text style={[styles.metricValue, { color: CRASH_COLOR[meal.energy_crash_risk] || '#10B981' }]}>
                  {meal.energy_crash_risk?.replace('_', ' ')}
                </Text>
              </View>
            </View>
          </View>

          {/* Food Items */}
          {meal.items && meal.items.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Food Breakdown</Text>
              {meal.items.map((item, i) => (
                <View key={item.id || String(i)} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>{item.weight_g}g · P:{item.protein_g}g C:{item.carbs_g}g F:{item.fat_g}g</Text>
                  </View>
                  <Text style={styles.itemCals}>{item.calories} kcal</Text>
                </View>
              ))}
            </View>
          )}

          {meal.ai_tip ? (
            <View style={styles.aiTipCard}>
              <Text style={styles.aiTipTitle}>💡 AI Nutrition Insight</Text>
              <Text style={styles.aiTipText}>{meal.ai_tip}</Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0F172A',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginHorizontal: 10,
  },
  content: { paddingBottom: 60, backgroundColor: '#F8FAFC' },
  foodPhoto: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#0F172A' },
  noPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2FF' },
  noPhotoLabel: { marginTop: 8, fontSize: 15, fontWeight: '700', color: '#4F46E5' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  badge: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#C7D2FE' },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#4F46E5' },
  metaTime: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  calsCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginTop: 14,
    backgroundColor: '#FFF7ED', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  calsNumber: { fontSize: 26, fontWeight: '900', color: '#F97316' },
  calsLabel: { fontSize: 12, color: '#9A3412', fontWeight: '600', marginTop: 2 },
  macrosRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 12 },
  macroPill: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  macroVal: { fontSize: 17, fontWeight: '900' },
  macroLbl: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  oilRow: {
    marginHorizontal: 20, marginTop: 10,
    backgroundColor: '#F0FDF4', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  oilText: { fontSize: 13, fontWeight: '700', color: '#166534' },
  section: { marginHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginBottom: 10 },
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1.5, alignItems: 'center' },
  metricLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', textAlign: 'center', marginBottom: 6 },
  metricValue: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  itemName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  itemMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  itemCals: { fontSize: 14, fontWeight: '800', color: '#F97316' },
  aiTipCard: { marginHorizontal: 20, marginTop: 20, backgroundColor: '#F0FDF4', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  aiTipTitle: { fontSize: 13, fontWeight: '800', color: '#166534', marginBottom: 6 },
  aiTipText: { fontSize: 14, color: '#15803D', lineHeight: 20 },
});
