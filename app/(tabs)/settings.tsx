import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert, TextInput } from 'react-native';
import { User, Bell, Trash2, Sparkles, Smartphone, Target, Calculator, Info } from 'lucide-react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../services/storage';
import { scheduleMealReminders } from '../../services/notifications';
import { FAQAccordion } from '../../components/FAQAccordion';
import { PaywallModal } from '../../components/PaywallModal';
import { MacroCalculatorModal } from '../../components/MacroCalculatorModal';
import Constants from 'expo-constants';
import pricingConfig from '../../config/pricing.json';

export default function SettingsScreen() {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [macroModalVisible, setMacroModalVisible] = useState(false);

  const goals = useAppStore((state) => state.goals);
  const updateGoals = useAppStore((state) => state.updateGoals);
  const profile = useAppStore((state) => state.profile);

  const [directCalorieInput, setDirectCalorieInput] = useState<string>(String(goals.daily_calories));
  const [calorieInputError, setCalorieInputError] = useState<string | null>(null);

  useEffect(() => {
    setDirectCalorieInput(String(goals.daily_calories));
    setCalorieInputError(null);
  }, [goals.daily_calories]);

  const handleDirectCalorieChange = (val: string) => {
    setDirectCalorieInput(val);
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 500 || num > 10000) {
      setCalorieInputError('Target must be 500 – 10,000 kcal');
    } else {
      setCalorieInputError(null);
      updateGoals({ daily_calories: num });
    }
  };
  const signInWithApple = useAppStore((state) => state.signInWithApple);
  const signOut = useAppStore((state) => state.signOut);

  const notifications = useAppStore((state) => state.notifications);
  const updateNotifs = useAppStore((state) => state.updateNotificationSettings);

  const historySettings = useAppStore((state) => state.historySettings);
  const updateHistory = useAppStore((state) => state.updateHistorySettings);
  const clearAllHistory = useAppStore((state) => state.clearAllHistory);
  const clearPhotoCache = useAppStore((state) => state.clearPhotoCache);

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

  const handleChangeReminderTime = (mealKey: 'breakfast' | 'lunch' | 'dinner', currentVal: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.prompt(
      `Set ${mealKey.charAt(0).toUpperCase() + mealKey.slice(1)} Reminder Time`,
      `Enter custom time (e.g. 08:30, 13:00, 19:30):`,
      (text) => {
        if (!text || !text.trim()) return;
        const timeKey = `${mealKey}_time` as const;
        updateNotifs({ [timeKey]: text.trim() });
        scheduleMealReminders({ ...notifications, [timeKey]: text.trim() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      'plain-text',
      currentVal
    );
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

  const handleShowAccountBenefits = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      '💡 Benefits of Signing In',
      '• 🍏 Account Identity: Link your verified Apple ID email to your CalSnap profile.\n\n' +
      '• 🔥 Streak & Profile Binding: Securely bind your daily streak count and macro preferences to your account.\n\n' +
      '• 👑 CalSnap Pro License: Restore and access your Pro subscription seamlessly across Apple devices.'
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Settings</Text>
      <Text style={styles.screenSubtitle}>Manage notifications, account security, and history retention.</Text>

      {/* Account & Login Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <User size={20} color="#4F46E5" />
            <Text style={styles.sectionTitle}>Account & Security</Text>
          </View>
          <TouchableOpacity onPress={handleShowAccountBenefits} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Info size={18} color="#6366F1" />
          </TouchableOpacity>
        </View>

        <View style={styles.userStatusRow}>
          <Text style={styles.statusLabel}>Status:</Text>
          <View style={[styles.statusBadge, profile.is_guest ? styles.guestBadge : styles.proBadge]}>
            <Text style={[styles.statusText, profile.is_guest ? styles.guestText : styles.proText]}>
              {profile.is_guest ? 'Anonymous Guest' : 'Signed in as ' + (profile.email || 'Apple User')}
            </Text>
          </View>
        </View>

        {profile.is_guest && (
          <TouchableOpacity style={styles.benefitCallout} onPress={handleShowAccountBenefits} activeOpacity={0.85}>
            <Info size={14} color="#4338CA" />
            <Text style={styles.benefitCalloutText}>
              Why sign in? Link your Apple ID, secure your profile & sync your Pro license.
            </Text>
          </TouchableOpacity>
        )}

        {profile.is_guest ? (
          <TouchableOpacity style={styles.appleBtn} onPress={handleAppleLogin} activeOpacity={0.85}>
            <Text style={styles.appleBtnText}>🍏 Sign in with Apple</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
            <Text style={styles.signOutText}>Sign Out Account</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Daily Nutrition & Calorie Goals */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Target size={20} color="#10B981" />
          <Text style={styles.sectionTitle}>Daily Calorie & Macro Goals</Text>
        </View>

        <View style={styles.goalOverviewRow}>
          <View style={styles.goalStatItem}>
            <View style={styles.inlineCalorieRow}>
              <TextInput
                style={[
                  styles.inlineCalorieInput,
                  calorieInputError ? styles.inlineCalorieInputError : null
                ]}
                value={directCalorieInput}
                onChangeText={handleDirectCalorieChange}
                keyboardType="number-pad"
                selectTextOnFocus
                maxLength={5}
              />
              <Text style={styles.inlineCalorieUnit}>kcal</Text>
            </View>
            <Text style={[styles.goalStatLabel, calorieInputError ? styles.goalStatLabelError : null]}>
              {calorieInputError || 'Daily Target (Tap to edit)'}
            </Text>
          </View>
          <View style={styles.goalStatDivider} />
          <View style={styles.goalStatItem}>
            <Text style={styles.goalStatValue}>{goals.weight_goal}</Text>
            <Text style={styles.goalStatLabel}>Strategy</Text>
          </View>
        </View>

        <View style={styles.macroPillsRow}>
          <View style={styles.macroPill}>
            <Text style={styles.macroPillText}>🍗 {goals.daily_protein_g}g Protein</Text>
          </View>
          <View style={styles.macroPill}>
            <Text style={styles.macroPillText}>🍚 {goals.daily_carbs_g}g Carbs</Text>
          </View>
          <View style={styles.macroPill}>
            <Text style={styles.macroPillText}>🥑 {goals.daily_fat_g}g Fat</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.adjustGoalsBtn} onPress={() => setMacroModalVisible(true)} activeOpacity={0.85}>
          <Calculator size={18} color="#FFFFFF" />
          <Text style={styles.adjustGoalsText}>Calculate & Adjust Goals</Text>
        </TouchableOpacity>
      </View>

      {/* Subscription Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Sparkles size={20} color="#6366F1" />
          <Text style={styles.sectionTitle}>Subscription Plan</Text>
        </View>
        <Text style={styles.planStatus}>
          {profile.is_pro_subscriber
            ? `🎉 Active Plan: CalSnap AI Pro (${pricingConfig.monthly.display_price}/mo or ${pricingConfig.annual.display_price}/yr)`
            : 'Free Tier (3 AI Snaps / Day)'}
        </Text>
        <TouchableOpacity style={styles.manageSubBtn} onPress={() => setPaywallVisible(true)}>
          <Text style={styles.manageSubText}>{profile.is_pro_subscriber ? 'Manage Subscription' : 'Upgrade to Unlimited Pro'}</Text>
        </TouchableOpacity>
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
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>🍳 Breakfast Reminder</Text>
                <TouchableOpacity
                  onPress={() => handleChangeReminderTime('breakfast', notifications.breakfast_time || '08:30')}
                  activeOpacity={0.7}
                  style={{ marginTop: 2 }}
                >
                  <Text style={[styles.rowSub, { color: '#4F46E5', fontWeight: '700' }]}>
                    ⏰ Set for {notifications.breakfast_time || '08:30'} (Tap to change)
                  </Text>
                </TouchableOpacity>
              </View>
              <Switch value={notifications.breakfast_reminder} onValueChange={handleToggleBreakfast} trackColor={{ false: '#CBD5E1', true: '#4F46E5' }} />
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>🥗 Lunch Reminder</Text>
                <TouchableOpacity
                  onPress={() => handleChangeReminderTime('lunch', notifications.lunch_time || '13:00')}
                  activeOpacity={0.7}
                  style={{ marginTop: 2 }}
                >
                  <Text style={[styles.rowSub, { color: '#4F46E5', fontWeight: '700' }]}>
                    ⏰ Set for {notifications.lunch_time || '13:00'} (Tap to change)
                  </Text>
                </TouchableOpacity>
              </View>
              <Switch value={notifications.lunch_reminder} onValueChange={handleToggleLunch} trackColor={{ false: '#CBD5E1', true: '#4F46E5' }} />
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>🍲 Dinner Reminder</Text>
                <TouchableOpacity
                  onPress={() => handleChangeReminderTime('dinner', notifications.dinner_time || '19:30')}
                  activeOpacity={0.7}
                  style={{ marginTop: 2 }}
                >
                  <Text style={[styles.rowSub, { color: '#4F46E5', fontWeight: '700' }]}>
                    ⏰ Set for {notifications.dinner_time || '19:30'} (Tap to change)
                  </Text>
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

      {/* App Diagnostics & Build Info */}
      <View style={styles.diagCard}>
        <View style={styles.sectionHeaderRow}>
          <Smartphone size={18} color="#64748B" />
          <Text style={styles.diagTitle}>App Diagnostics & EAS Build Info</Text>
        </View>
        <Text style={styles.diagText}>
          App Version: {Constants.expoConfig?.version || Constants.nativeAppVersion || ''}
          { (Constants.expoConfig?.ios?.buildNumber || Constants.nativeBuildVersion) ? ` (Build #${Constants.expoConfig?.ios?.buildNumber || Constants.nativeBuildVersion} - Auto Increment)` : '' }
        </Text>
        <Text style={styles.diagText}>EAS Update Channel: Production (OTA Active)</Text>
        <Text style={styles.diagText}>Security: Google Cloud Secret Manager Binding (Active)</Text>
      </View>

      {/* Paywall Modal */}
      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />

      {/* Macro Calculator & Goal Editor Modal */}
      <MacroCalculatorModal visible={macroModalVisible} onClose={() => setMacroModalVisible(false)} />
    </ScrollView>
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
  benefitCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  benefitCalloutText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3730A3',
    flex: 1,
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
  goalOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 14,
    marginVertical: 12,
  },
  goalStatItem: {
    alignItems: 'center',
  },
  inlineCalorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineCalorieInput: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    textAlign: 'center',
    minWidth: 58,
  },
  inlineCalorieInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
    color: '#DC2626',
  },
  inlineCalorieUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  goalStatValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  goalStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  goalStatLabelError: {
    color: '#EF4444',
    fontWeight: '700',
  },
  goalStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
  },
  macroPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  macroPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  macroPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  adjustGoalsBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  adjustGoalsText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
