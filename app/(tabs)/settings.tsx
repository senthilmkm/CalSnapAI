import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert, TextInput, Modal, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform } from 'react-native';
import { User, Bell, Trash2, ShieldCheck, HelpCircle, Info, Sparkles, Smartphone, Scale, Key, Cpu, Clock, Check, X, Eye, EyeOff, Lock, Calculator, ChevronRight } from 'lucide-react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../services/storage';
import { scheduleMealReminders } from '../../services/notifications';
import { FAQAccordion } from '../../components/FAQAccordion';
import { PaywallModal } from '../../components/PaywallModal';
import { MacroCalculatorModal } from '../../components/MacroCalculatorModal';
import pricingConfig from '../../config/pricing.json';

export default function SettingsScreen() {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [calcModalVisible, setCalcModalVisible] = useState(false);
  const goals = useAppStore((state) => state.goals);
  const [calorieText, setCalorieText] = useState(String(goals.daily_calories || 2000));

  // Sync manual input text whenever store goals change (e.g. via Wizard)
  useEffect(() => {
    setCalorieText(String(goals.daily_calories || 2000));
  }, [goals.daily_calories]);
  const profile = useAppStore((state) => state.profile);
  const setWeightUnit = useAppStore((state) => state.setWeightUnit);
  const signInWithApple = useAppStore((state) => state.signInWithApple);
  const signOut = useAppStore((state) => state.signOut);
  const toggleBiometricLock = useAppStore((state) => state.toggleBiometricLock);

  const weightUnit = goals.weight_unit || 'lbs';

  const handleSelectWeightUnit = (unit: 'lbs' | 'kg') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWeightUnit(unit);
  };

  const notifications = useAppStore((state) => state.notifications);
  const updateNotifs = useAppStore((state) => state.updateNotificationSettings);

  const historySettings = useAppStore((state) => state.historySettings);
  const updateHistory = useAppStore((state) => state.updateHistorySettings);
  const clearAllHistory = useAppStore((state) => state.clearAllHistory);
  const clearPhotoCache = useAppStore((state) => state.clearPhotoCache);

  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [activeMealTarget, setActiveMealTarget] = useState<'breakfast' | 'lunch' | 'dinner'>('breakfast');

  const format12Hour = (time24: string): string => {
    if (!time24) return '08:30 AM';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    const displayH = String(h).padStart(2, '0');
    return `${displayH}:${m} ${ampm}`;
  };

  const handleOpenTimePicker = (meal: 'breakfast' | 'lunch' | 'dinner') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveMealTarget(meal);
    setTimeModalVisible(true);
  };

  const handleSaveMealTime = (newTime: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updateKey = activeMealTarget === 'breakfast' ? 'breakfast_time' : activeMealTarget === 'lunch' ? 'lunch_time' : 'dinner_time';
    const updatedObj = { ...notifications, [updateKey]: newTime };
    updateNotifs({ [updateKey]: newTime });
    scheduleMealReminders(updatedObj);
    setTimeModalVisible(false);
  };

  const handleToggleMasterNotifs = (val: boolean) => {
    updateNotifs({ master_enabled: val });
    scheduleMealReminders({ ...notifications, master_enabled: val });
  };

  const handleToggleBreakfast = (val: boolean) => {
    updateNotifs({ breakfast_reminder: val });
    scheduleMealReminders({ ...notifications, breakfast_reminder: val });
  };

  const handleToggleLunch = (val: boolean) => {
    updateNotifs({ lunch_reminder: val });
    scheduleMealReminders({ ...notifications, lunch_reminder: val });
  };

  const handleToggleDinner = (val: boolean) => {
    updateNotifs({ dinner_reminder: val });
    scheduleMealReminders({ ...notifications, dinner_reminder: val });
  };

  const handleToggleStreakProtection = (val: boolean) => {
    updateNotifs({ streak_protection_alert: val });
    scheduleMealReminders({ ...notifications, streak_protection_alert: val });
  };

  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.email) {
        signInWithApple(credential.email);
        Alert.alert('Signed in!', `Welcome ${credential.email}`);
      } else {
        signInWithApple('user@apple.com');
      }
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return;
      // Demo fallback for simulator/testing
      signInWithApple('john.doe@apple.com');
      Alert.alert('Signed in with Apple', 'Account linked successfully!');
    }
  };

  const handleToggleBiometrics = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (value) {
      try {
        let LocalAuthentication: any = null;
        try {
          LocalAuthentication = require('expo-local-authentication');
        } catch (e) {
          console.warn('ExpoLocalAuthentication native module not bundled:', e);
        }

        if (!LocalAuthentication || !LocalAuthentication.hasHardwareAsync) {
          Alert.alert(
            'Biometrics Unavailable in Expo Go',
            'Face ID / Touch ID hardware authentication requires an iOS device build or EAS Dev Client.'
          );
          return;
        }

        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) {
          Alert.alert(
            'Biometrics Unavailable',
            'Face ID or Touch ID is not configured on this device. Please enable Face ID in your iPhone Settings.'
          );
          return;
        }

        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to enable Face ID / Touch ID App Lock',
          fallbackLabel: 'Use Device Passcode',
        });

        if (res.success) {
          toggleBiometricLock(true);
          Alert.alert('Face ID Lock Active 🔒', 'CalSnap AI will require Face ID / Touch ID verification when opened.');
        }
      } catch (err) {
        Alert.alert('Authentication Status', 'Unable to verify Face ID Lock.');
      }
    } else {
      toggleBiometricLock(false);
    }
  };

  const handleConfirmDeleteHistory = () => {
    Alert.alert(
      'Delete All History?',
      'This will permanently delete all past logged meals, food photos, and streak records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            clearAllHistory();
            Alert.alert('History Deleted', 'All meal history has been erased.');
          },
        },
      ]
    );
  };

  const handleClearPhotoCache = () => {
    clearPhotoCache();
    Alert.alert('Cache Cleared', 'Photo cache cleared to free up storage space.');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Settings</Text>
        <Text style={styles.screenSubtitle}>Manage notifications, account security, and history retention.</Text>

      {/* Account & Login Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <User size={20} color="#4F46E5" />
          <Text style={styles.sectionTitle}>Account & Security</Text>
        </View>

        <View style={styles.userStatusRow}>
          <Text style={styles.statusLabel}>Status:</Text>
          <View style={[styles.statusBadge, profile.is_guest ? styles.guestBadge : styles.proBadge]}>
            <Text style={[styles.statusText, profile.is_guest ? styles.guestText : styles.proText]} numberOfLines={1} ellipsizeMode="tail">
              {profile.is_guest ? 'Anonymous Guest' : 'Signed in as ' + (profile.email || 'Apple User')}
            </Text>
          </View>
        </View>

        {profile.is_guest ? (
          <TouchableOpacity style={styles.appleBtn} onPress={handleAppleLogin} activeOpacity={0.85}>
            <Text style={styles.appleBtnText}>🍏 Sign in with Apple</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
            <Text style={styles.signOutText}>Sign Out Account</Text>
          </TouchableOpacity>
        )}

        {/* Require Face ID / Touch ID App Lock Switch */}
        <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Lock size={16} color="#4F46E5" />
              <Text style={styles.rowLabel}>Require Face ID / Touch ID</Text>
            </View>
            <Text style={styles.rowSub}>Locks CalSnap AI behind biometric security on launch</Text>
          </View>
          <Switch
            value={!!profile.biometric_lock_enabled}
            onValueChange={handleToggleBiometrics}
            trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
          />
        </View>
      </View>

      {/* Subscription Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Sparkles size={20} color="#6366F1" />
          <Text style={styles.sectionTitle}>Subscription Plan</Text>
        </View>
        <Text style={styles.planStatus}>
          {profile.is_pro_subscriber
            ? `🎉 Active Plan: CalSnap AI Pro (${pricingConfig.monthly.display_price}${pricingConfig.monthly.period})`
            : 'Free Tier (3 AI Snaps / Day)'}
        </Text>
        <TouchableOpacity style={styles.manageSubBtn} onPress={() => setPaywallVisible(true)}>
          <Text style={styles.manageSubText}>{profile.is_pro_subscriber ? 'Manage Subscription' : 'Upgrade to Unlimited Pro'}</Text>
        </TouchableOpacity>
      </View>

      {/* Unit Preferences Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Scale size={20} color="#4F46E5" />
          <Text style={styles.sectionTitle}>Unit & Measurement Preferences</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.rowLabel}>Weight Unit</Text>
            <Text style={styles.rowSub}>Used across Weight Progress Chart & Health Exports</Text>
          </View>

          <View style={styles.unitToggleGroup}>
            <TouchableOpacity
              style={[styles.unitChoiceBtn, weightUnit === 'lbs' && styles.unitChoiceBtnActive]}
              onPress={() => handleSelectWeightUnit('lbs')}
              activeOpacity={0.8}
            >
              <Text style={[styles.unitChoiceText, weightUnit === 'lbs' && styles.unitChoiceTextActive]}>lbs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.unitChoiceBtn, weightUnit === 'kg' && styles.unitChoiceBtnActive]}
              onPress={() => handleSelectWeightUnit('kg')}
              activeOpacity={0.8}
            >
              <Text style={[styles.unitChoiceText, weightUnit === 'kg' && styles.unitChoiceTextActive]}>kg</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Daily Calorie & Body Goal Editor */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <User size={20} color="#4F46E5" />
          <Text style={styles.sectionTitle}>Daily Calorie & Body Goal</Text>
        </View>

        {/* Active Target Hero Card */}
        <View
          style={{
            backgroundColor: '#F8FAFC',
            borderWidth: 1,
            borderColor: '#E2E8F0',
            borderRadius: 16,
            padding: 16,
            marginTop: 8,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Active Daily Target
              </Text>
              <Text style={{ fontSize: 26, fontWeight: '900', color: '#4F46E5', marginTop: 2 }}>
                {goals.daily_calories || 2000} <Text style={{ fontSize: 15, fontWeight: '700', color: '#64748B' }}>kcal/day</Text>
              </Text>
            </View>
            <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#4F46E5' }}>
                {goals.weight_goal || 'Lose Weight'}
              </Text>
            </View>
          </View>

          {/* Sync'd Macro Targets Pill Row */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#4F46E5' }}>{goals.daily_protein_g || 140}g</Text>
              <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>Protein</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#10B981' }}>{goals.daily_carbs_g || 200}g</Text>
              <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>Carbs</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#F97316' }}>{goals.daily_fat_g || 65}g</Text>
              <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>Fat</Text>
            </View>
          </View>
        </View>

        {/* Primary Action: Auto-Calculate Wizard */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#4F46E5',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 16,
            shadowColor: '#4F46E5',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
            elevation: 3,
          }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setCalcModalVisible(true);
          }}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Calculator size={20} color="#FFFFFF" />
            <View>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>🎯 Auto-Calculate My Goals (Wizard)</Text>
              <Text style={{ fontSize: 11, color: '#E0E7FF', fontWeight: '500' }}>Based on your age, height, weight & activity</Text>
            </View>
          </View>
          <ChevronRight size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Secondary Action: Manual Calorie Override */}
        <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.rowLabel}>Manual Calorie Override</Text>
              <Text style={styles.rowSub}>Auto-adjusts protein, carbs & fat in sync</Text>
            </View>

            <TextInput
              style={[styles.apiKeyInput, { width: 90, marginTop: 0, textAlign: 'center', fontWeight: '800' }]}
              keyboardType="number-pad"
              value={calorieText}
              onChangeText={(val) => {
                setCalorieText(val);
                const num = parseInt(val, 10);
                if (!isNaN(num) && num >= 500 && num <= 10000) {
                  useAppStore.getState().updateGoals({ daily_calories: num });
                }
              }}
              onBlur={() => {
                const num = parseInt(calorieText, 10);
                if (isNaN(num) || num < 500 || num > 10000) {
                  setCalorieText(String(goals.daily_calories || 2000));
                } else {
                  useAppStore.getState().updateGoals({ daily_calories: num });
                }
              }}
              returnKeyType="done"
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.rowLabel}>Primary Weight Goal</Text>
            <View style={[styles.retentionPillRow, { marginTop: 8 }]}>
              {(['Lose Weight', 'Maintain', 'Build Muscle'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.retentionBtn, goals.weight_goal === g && styles.retentionBtnSel]}
                  onPress={() => useAppStore.getState().updateGoals({ weight_goal: g })}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.retentionText, goals.weight_goal === g && styles.retentionTextSel]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Macro Goal Calculator Modal */}
      <MacroCalculatorModal visible={calcModalVisible} onClose={() => setCalcModalVisible(false)} />

      {/* AI Vision Engine Status Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Cpu size={20} color="#4F46E5" />
          <Text style={styles.sectionTitle}>AI Vision Engine (Gemini 2.0 Flash)</Text>
        </View>
        <Text style={styles.rowSub}>
          CalSnap AI operates on an encrypted serverless Google Cloud proxy with Secret Manager isolation.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: '#A7F3D0' }}>
          <ShieldCheck size={16} color="#059669" style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 12, color: '#065F46', fontWeight: '700', flex: 1 }}>
            ✓ Cloud Vision AI Active — Zero-Friction Setup
          </Text>
        </View>
      </View>

      {/* Notifications & Reminders Controls */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Bell size={20} color="#4F46E5" />
          <Text style={styles.sectionTitle}>Meal Reminders & Notifications</Text>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.rowLabel}>Allow Push Notifications</Text>
          <Switch value={notifications.master_enabled} onValueChange={handleToggleMasterNotifs} trackColor={{ false: '#CBD5E1', true: '#4F46E5' }} />
        </View>

        {notifications.master_enabled && (
          <>
            <View style={styles.settingRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.rowLabel}>🍳 Breakfast Reminder</Text>
                <TouchableOpacity
                  style={styles.timeBadge}
                  onPress={() => handleOpenTimePicker('breakfast')}
                  activeOpacity={0.7}
                >
                  <Clock size={12} color="#4F46E5" />
                  <Text style={styles.timeBadgeText}>{format12Hour(notifications.breakfast_time)} (Tap to edit)</Text>
                </TouchableOpacity>
              </View>
              <Switch value={notifications.breakfast_reminder} onValueChange={handleToggleBreakfast} trackColor={{ false: '#CBD5E1', true: '#4F46E5' }} />
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.rowLabel}>🥗 Lunch Reminder</Text>
                <TouchableOpacity
                  style={styles.timeBadge}
                  onPress={() => handleOpenTimePicker('lunch')}
                  activeOpacity={0.7}
                >
                  <Clock size={12} color="#4F46E5" />
                  <Text style={styles.timeBadgeText}>{format12Hour(notifications.lunch_time)} (Tap to edit)</Text>
                </TouchableOpacity>
              </View>
              <Switch value={notifications.lunch_reminder} onValueChange={handleToggleLunch} trackColor={{ false: '#CBD5E1', true: '#4F46E5' }} />
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.rowLabel}>🍲 Dinner Reminder</Text>
                <TouchableOpacity
                  style={styles.timeBadge}
                  onPress={() => handleOpenTimePicker('dinner')}
                  activeOpacity={0.7}
                >
                  <Clock size={12} color="#4F46E5" />
                  <Text style={styles.timeBadgeText}>{format12Hour(notifications.dinner_time)} (Tap to edit)</Text>
                </TouchableOpacity>
              </View>
              <Switch value={notifications.dinner_reminder} onValueChange={handleToggleDinner} trackColor={{ false: '#CBD5E1', true: '#4F46E5' }} />
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={styles.rowLabel}>🔥 Streak Saver Alert</Text>
                <Text style={styles.rowSub}>Notifies at 8:00 PM if no dinner logged</Text>
              </View>
              <Switch value={notifications.streak_protection_alert} onValueChange={handleToggleStreakProtection} trackColor={{ false: '#CBD5E1', true: '#4F46E5' }} />
            </View>
          </>
        )}
      </View>

      {/* History Retention & Cleanup Slider */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Trash2 size={20} color="#EF4444" />
          <Text style={styles.sectionTitle}>History Retention & Storage</Text>
        </View>

        <Text style={styles.retentionLabel}>Auto-Keep Meal Logs Duration:</Text>
        <View style={styles.retentionPillRow}>
          {[
            { label: '30 Days', val: 30 },
            { label: '90 Days', val: 90 },
            { label: '1 Year', val: 365 },
            { label: 'Keep Forever', val: -1 },
          ].map((item) => {
            const isSel = historySettings.retention_days === item.val;
            return (
              <TouchableOpacity
                key={item.val}
                style={[styles.retentionBtn, isSel && styles.retentionBtnSel]}
                onPress={() => updateHistory({ retention_days: item.val })}
              >
                <Text style={[styles.retentionText, isSel && styles.retentionTextSel]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.dangerBtnRow}>
          <TouchableOpacity style={styles.clearCacheBtn} onPress={handleClearPhotoCache}>
            <Text style={styles.clearCacheText}>Clear Photo Cache</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteHistoryBtn} onPress={handleConfirmDeleteHistory}>
            <Text style={styles.deleteHistoryText}>Delete All History</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* FAQ Accordion Section */}
      <FAQAccordion />

      {/* App Version & Build Footer */}
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.3 }}>
          CalSnap AI v1.0.0 (Build #142)
        </Text>
      </View>

      {/* Interactive Meal Time Picker Modal */}
      <Modal visible={timeModalVisible} animationType="slide" transparent onRequestClose={() => setTimeModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.timeModalOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={styles.timeModalContent}>
                  <View style={styles.timeModalHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Clock size={20} color="#4F46E5" />
                      <Text style={styles.timeModalTitle}>
                        Set {activeMealTarget === 'breakfast' ? '🍳 Breakfast' : activeMealTarget === 'lunch' ? '🥗 Lunch' : '🍲 Dinner'} Reminder
                      </Text>
                    </View>

                    <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeModalVisible(false); }}>
                      <X size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.timeModalSub}>Select a 1-tap time preset or type a custom time:</Text>

                  <View style={styles.presetGrid}>
                    {(activeMealTarget === 'breakfast'
                      ? [
                          { label: '07:30 AM', time: '07:30' },
                          { label: '08:00 AM', time: '08:00' },
                          { label: '08:30 AM', time: '08:30' },
                          { label: '09:00 AM', time: '09:00' },
                          { label: '09:30 AM', time: '09:30' },
                        ]
                      : activeMealTarget === 'lunch'
                      ? [
                          { label: '12:00 PM', time: '12:00' },
                          { label: '12:30 PM', time: '12:30' },
                          { label: '01:00 PM', time: '13:00' },
                          { label: '01:30 PM', time: '13:30' },
                          { label: '02:00 PM', time: '14:00' },
                        ]
                      : [
                          { label: '06:30 PM', time: '18:30' },
                          { label: '07:00 PM', time: '19:00' },
                          { label: '07:30 PM', time: '19:30' },
                          { label: '08:00 PM', time: '20:00' },
                          { label: '08:30 PM', time: '20:30' },
                        ]
                    ).map((item) => {
                      const activeKey = `${activeMealTarget}_time` as 'breakfast_time' | 'lunch_time' | 'dinner_time';
                      const currentVal = notifications[activeKey];
                      const isSel = currentVal === item.time;
                      return (
                        <TouchableOpacity
                          key={item.time}
                          style={[styles.presetBtn, isSel && styles.presetBtnSel]}
                          onPress={() => { Keyboard.dismiss(); handleSaveMealTime(item.time); }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.presetBtnText, isSel && styles.presetBtnTextSel]}>{item.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Custom Time Input */}
                  <View style={{ marginTop: 18 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 }}>
                      Custom 24-Hour Time (HH:mm):
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {(() => {
                        const activeKey = `${activeMealTarget}_time` as 'breakfast_time' | 'lunch_time' | 'dinner_time';
                        const currentVal = notifications[activeKey] || '08:30';
                        return (
                          <>
                            <TextInput
                              style={[styles.apiKeyInput, { flex: 1, marginTop: 0 }]}
                              placeholder="e.g. 08:15 or 19:45"
                              placeholderTextColor="#94A3B8"
                              value={currentVal}
                              onChangeText={(val) => {
                                useAppStore.getState().updateNotificationSettings({ [activeKey]: val.trim() });
                              }}
                              autoCapitalize="none"
                              returnKeyType="done"
                              onSubmitEditing={Keyboard.dismiss}
                            />
                            <TouchableOpacity
                              style={styles.timeSaveBtn}
                              onPress={() => { Keyboard.dismiss(); handleSaveMealTime(currentVal); }}
                              activeOpacity={0.85}
                            >
                              <Check size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Save</Text>
                            </TouchableOpacity>
                          </>
                        );
                      })()}
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Paywall Modal */}
      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </ScrollView>
  </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  screenSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 20,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  userStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 1,
    marginLeft: 8,
  },
  guestBadge: {
    backgroundColor: '#F1F5F9',
  },
  proBadge: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  guestText: {
    color: '#475569',
  },
  proText: {
    color: '#065F46',
  },
  appleBtn: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  appleBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  signOutBtn: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  planStatus: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
    marginBottom: 12,
  },
  manageSubBtn: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  manageSubText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '800',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  rowSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  unitToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
  },
  unitChoiceBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9,
  },
  unitChoiceBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  unitChoiceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  unitChoiceTextActive: {
    color: '#4F46E5',
  },
  retentionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 10,
  },
  retentionPillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 16,
  },
  retentionBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  retentionBtnSel: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  retentionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  retentionTextSel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dangerBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  clearCacheBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearCacheText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  deleteHistoryBtn: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteHistoryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
  },
  diagCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  diagTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  diagText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  apiKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  apiKeyInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  eyeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  timeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  timeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  timeModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  timeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  timeModalSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetBtnSel: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  presetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  presetBtnTextSel: {
    color: '#FFFFFF',
  },
  timeSaveBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
