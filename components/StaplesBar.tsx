import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Plus, Zap, Check, X, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../services/storage';
import { StapleItem } from '../types/nutrition';

interface StaplesBarProps {
  selectedDateStr: string;
}

export function StaplesBar({ selectedDateStr }: StaplesBarProps) {
  const staples = useAppStore((state) => state.staples) || [];
  const logStapleAsMeal = useAppStore((state) => state.logStapleAsMeal);
  const addStaple = useAppStore((state) => state.addStaple);
  const deleteStaple = useAppStore((state) => state.deleteStaple);

  const [modalVisible, setModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states for new custom staple
  const [icon, setIcon] = useState('☕');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('150');
  const [protein, setProtein] = useState('10');
  const [carbs, setCarbs] = useState('15');
  const [fat, setFat] = useState('5');
  const [mealType, setMealType] = useState<'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'>('Breakfast');

  const handleTapStaple = (staple: StapleItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logStapleAsMeal(staple, selectedDateStr);

    setToastMessage(`Added ${staple.icon} ${staple.name} (+${staple.calories} kcal)`);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleLongPressStaple = (staple: StapleItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      `Delete Staple?`,
      `Remove "${staple.name}" from your 1-Tap Staples bar?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteStaple(staple.id),
        },
      ]
    );
  };

  const handleSaveCustomStaple = () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your staple.');
      return;
    }
    const calVal = parseInt(calories, 10) || 0;
    const pVal = parseInt(protein, 10) || 0;
    const cVal = parseInt(carbs, 10) || 0;
    const fVal = parseInt(fat, 10) || 0;

    addStaple({
      icon: icon.trim() || '🍱',
      name: name.trim(),
      calories: calVal,
      protein_g: pVal,
      carbs_g: cVal,
      fat_g: fVal,
      meal_type: mealType,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
    setName('');
  };

  return (
    <View style={styles.container}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <View style={styles.toastBanner}>
          <Zap size={16} color="#10B981" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Zap size={18} color="#4F46E5" />
          <Text style={styles.title}>1-Tap Usual Staples</Text>
        </View>
        <Text style={styles.subtext}>Log daily favorites in 0.1s</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {staples.map((staple) => (
          <TouchableOpacity
            key={staple.id}
            style={styles.stapleChip}
            onPress={() => handleTapStaple(staple)}
            onLongPress={() => handleLongPressStaple(staple)}
            activeOpacity={0.75}
          >
            <Text style={styles.stapleIcon}>{staple.icon}</Text>
            <View style={styles.stapleTextGroup}>
              <Text style={styles.stapleName} numberOfLines={1}>
                {staple.name}
              </Text>
              <Text style={styles.stapleCal}>+{staple.calories} kcal</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Add Custom Staple Button */}
        <TouchableOpacity
          style={styles.addChip}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#4F46E5" />
          <Text style={styles.addText}>Custom</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Staple Creation Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✨ Add Custom 1-Tap Staple</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Emoji & Name</Text>
              <View style={styles.iconNameRow}>
                <TextInput
                  style={styles.iconInput}
                  value={icon}
                  onChangeText={setIcon}
                  maxLength={4}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="e.g. Whey Protein & Banana"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            <View style={styles.macroRow}>
              <View style={styles.macroCol}>
                <Text style={styles.inputLabel}>Calories</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={calories}
                  onChangeText={setCalories}
                />
              </View>
              <View style={styles.macroCol}>
                <Text style={styles.inputLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={protein}
                  onChangeText={setProtein}
                />
              </View>
              <View style={styles.macroCol}>
                <Text style={styles.inputLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={carbs}
                  onChangeText={setCarbs}
                />
              </View>
              <View style={styles.macroCol}>
                <Text style={styles.inputLabel}>Fat (g)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={fat}
                  onChangeText={setFat}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCustomStaple} activeOpacity={0.85}>
              <Check size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Save 1-Tap Staple</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 12,
    gap: 8,
  },
  toastText: {
    color: '#065F46',
    fontWeight: '700',
    fontSize: 13,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  subtext: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 10,
  },
  stapleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1.5,
    gap: 8,
  },
  stapleIcon: {
    fontSize: 20,
  },
  stapleTextGroup: {
    justifyContent: 'center',
  },
  stapleName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    maxWidth: 110,
  },
  stapleCal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
    marginTop: 1,
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
    gap: 4,
  },
  addText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
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
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconNameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  iconInput: {
    width: 50,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 22,
    paddingVertical: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  macroCol: {
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
});
