import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { X, Check, Scale } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../services/storage';

interface WeightLogModalProps {
  visible: boolean;
  onClose: () => void;
}

export function WeightLogModal({ visible, onClose }: WeightLogModalProps) {
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [weightInput, setWeightInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');

  const addWeightEntry = useAppStore((state) => state.addWeightEntry);

  const handleSaveWeight = () => {
    const num = parseFloat(weightInput);
    if (isNaN(num) || num <= 0 || num > 500) {
      Alert.alert('Invalid Weight', 'Please enter a valid scale weight.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addWeightEntry(num, unit === 'kg', noteInput);

    setWeightInput('');
    setNoteInput('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardContainer}
          >
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Scale size={20} color="#4F46E5" />
                  <Text style={styles.title}>Log Scale Weight</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Unit Switcher */}
              <View style={styles.unitContainer}>
                <TouchableOpacity
                  style={[styles.unitBtn, unit === 'kg' && styles.unitBtnActive]}
                  onPress={() => setUnit('kg')}
                >
                  <Text style={[styles.unitText, unit === 'kg' && styles.unitTextActive]}>Kilograms (kg)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.unitBtn, unit === 'lbs' && styles.unitBtnActive]}
                  onPress={() => setUnit('lbs')}
                >
                  <Text style={[styles.unitText, unit === 'lbs' && styles.unitTextActive]}>Pounds (lbs)</Text>
                </TouchableOpacity>
              </View>

              {/* Weight Input Box */}
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.weightInput}
                  placeholder={unit === 'kg' ? '74.5' : '164.2'}
                  placeholderTextColor="#CBD5E1"
                  keyboardType="decimal-pad"
                  value={weightInput}
                  onChangeText={setWeightInput}
                  selectTextOnFocus
                />
                <Text style={styles.unitSuffix}>{unit}</Text>
              </View>

              {/* Optional Note */}
              <Text style={styles.fieldLabel}>Notes (Optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="e.g. Fasted Morning Weight, Post Workout"
                placeholderTextColor="#94A3B8"
                value={noteInput}
                onChangeText={setNoteInput}
              />

              {/* Submit Button */}
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveWeight} activeOpacity={0.85}>
                <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.submitBtnText}>Save Scale Weight</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  keyboardContainer: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
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
  unitContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  unitBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  unitTextActive: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  weightInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '900',
    color: '#4F46E5',
  },
  unitSuffix: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4F46E5',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  noteInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 20,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
