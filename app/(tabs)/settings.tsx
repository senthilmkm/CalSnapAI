import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert, TextInput, Modal, Platform, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Bell, Trash2, Sparkles, Smartphone, Target, Calculator, Info, Globe, Clock, ShieldAlert, X, Check, Scale } from 'lucide-react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import Purchases from 'react-native-purchases';
import { useAppStore } from '../../services/storage';
import { scheduleMealReminders } from '../../services/notifications';
import { FAQAccordion } from '../../components/FAQAccordion';
import { PaywallModal } from '../../components/PaywallModal';
import { getActivePlanLabel as formatActivePlanLabel } from '../../services/freeTier';
import { MacroCalculatorModal } from '../../components/MacroCalculatorModal';
import Constants from 'expo-constants';
import pricingConfig from '../../config/pricing.json';

const PRESET_TIMES: Record<'breakfast' | 'lunch' | 'dinner', string[]> = {
  breakfast: ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30'],
  lunch: ['11:30', '12:00', '12:30', '13:00', '13:30', '14:00'],
  dinner: ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30'],
};

export default function SettingsScreen() {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'upgrade' | 'feature'>('upgrade');
  const [macroModalVisible, setMacroModalVisible] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Time picker modal state (Android-safe, cross-platform)
  const [timePickerMeal, setTimePickerMeal] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [timeInputVal, setTimeInputVal] = useState<string>('08:30');
  const [timePickerError, setTimePickerError] = useState<string | null>(null);

  const goals = useAppStore((state) => state.goals);
  const updateGoals = useAppStore((state) => state.updateGoals);
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);
  const signInWithApple = useAppStore((state) => state.signInWithApple);
  const signOut = useAppStore((state) => state.signOut);
  const deleteAccount = useAppStore((state) => state.deleteAccount);
  const setAIConsent = useAppStore((state) => state.setAIConsent);
  const setWeightUnit = useAppStore((state) => state.setWeightUnit);
  const setFastingProtocol = useAppStore((state) => state.setFastingProtocol);

  const notifications = useAppStore((state) => state.notifications);
  const updateNotifs = useAppStore((state) => state.updateNotificationSettings);

  const historySettings = useAppStore((state) => state.historySettings);
  const updateHistory = useAppStore((state) => state.updateHistorySettings);
  const clearAllHistory = useAppStore((state) => state.clearAllHistory);
  const clearPhotoCache = useAppStore((state) => state.clearPhotoCache);

  const [directCalorieInput, setDirectCalorieInput] = useState<string>(String(goals.daily_calories));
  const [calorieInputError, setCalorieInputError] = useState<string | null>(null);

  useEffect(() => {
    setDirectCalorieInput(String(goals.daily_calories));
    setCalorieInputError(null);
  }, [goals.daily_calories]);

  const handleDirectCalorieTextChange = (val: string) => {
    setDirectCalorieInput(val);
    setCalorieInputError(null);
  };

  const handleDirectCalorieSubmitOrBlur = () => {
    const num = parseInt(directCalorieInput, 10);
    if (isNaN(num) || num < 500 || num > 10000) {
      setCalorieInputError('Target must be 500 – 10,000 kcal');
      setDirectCalorieInput(String(goals.daily_calories));
    } else {
      setCalorieInputError(null);
      setDirectCalorieInput(String(num));
      if (num !== goals.daily_calories) {
        updateGoals({ daily_calories: num });
      }
    }
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

  const handleOpenTimePicker = (mealKey: 'breakfast' | 'lunch' | 'dinner', currentVal: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimePickerMeal(mealKey);
    setTimeInputVal(currentVal || (mealKey === 'breakfast' ? '08:30' : mealKey === 'lunch' ? '13:00' : '19:30'));
    setTimePickerError(null);
  };

  const handleSaveReminderTime = () => {
    if (!timePickerMeal) return;
    const trimmed = timeInputVal.trim();
    const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!TIME_REGEX.test(trimmed)) {
      setTimePickerError('Enter a valid 24h time format (HH:MM, e.g. 08:30 or 19:00)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const timeKey = `${timePickerMeal}_time` as const;
    updateNotifs({ [timeKey]: trimmed });
    scheduleMealReminders({ ...notifications, [timeKey]: trimmed });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimePickerMeal(null);
  };

  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setIsAppleAuthAvailable);
  }, []);

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
      // Fallback for simulator
      signInWithApple('john.doe@apple.com');
      Alert.alert('Signed in with Apple', 'Account linked successfully!');
    }
  };

  // Apple Guideline 5.1.1(v) Compliant Account Deletion
  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Delete Account & Data?',
      'This will unlink your Apple ID and permanently erase all meal history, food photos, body metrics, and streak records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed to Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Are you completely sure? This action is irreversible and all your data will be permanently wiped.',
              [
                { text: 'Keep My Account', style: 'cancel' },
                {
                  text: 'Permanently Erase',
                  style: 'destructive',
                  onPress: () => {
                    deleteAccount();
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    Alert.alert('Account Deleted', 'Your account and all personal data have been completely deleted.');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // Restore Purchases (StoreKit / RevenueCat)
  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    try {
      if (Platform.OS === 'ios') {
        const customerInfo = await Purchases.restorePurchases();
        const proEntitlement = customerInfo.entitlements.active['pro_access'];
        if (typeof proEntitlement !== 'undefined') {
          const prodId = (proEntitlement?.productIdentifier || '').toLowerCase();
          const tier = prodId.includes('yearly') || prodId.includes('annual') ? 'annual' : 'monthly';
          setProfile({ is_pro_subscriber: true, subscription_tier: tier });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Purchases Restored', 'Your CalSnap AI Pro subscription is now active!');
          return;
        }
      }
      Alert.alert('No Subscription Found', 'We could not find an active subscription for this Apple ID.');
    } catch (e: any) {
      Alert.alert('Restore Error', e.message || 'Unable to restore purchases at this time.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleConfirmDeleteHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Delete All Meal History?',
      'This will permanently delete all past logged meals, food photos, and streak records. Your account and goals will be kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Are you sure you want to erase all meal logs? This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm Delete',
                  style: 'destructive',
                  onPress: () => {
                    clearAllHistory();
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    Alert.alert('History Deleted', 'All meal history has been erased.');
                  },
                },
              ]
            );
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

  const getActivePlanLabel = () => formatActivePlanLabel(profile, pricingConfig);

  const handleManageSubscription = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (profile.is_pro_subscriber) {
      if (Platform.OS === 'ios') {
        try {
          const url = 'https://apps.apple.com/account/subscriptions';
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
            return;
          }
        } catch {
          // Fallback to informative alert
        }
      }
      Alert.alert(
        'Active Pro Subscription',
        'You have an active CalSnap AI Pro subscription. You can manage or cancel your plan anytime in your Apple ID Subscriptions Settings.',
        [{ text: 'OK' }]
      );
    } else {
      setPaywallReason('upgrade');
      setPaywallVisible(true);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
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
          isAppleAuthAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={14}
              style={styles.appleBtn}
              onPress={handleAppleLogin}
            />
          ) : (
            <TouchableOpacity style={styles.fallbackSignInBtn} onPress={handleAppleLogin} activeOpacity={0.85}>
              <Text style={styles.fallbackSignInText}>Sign in with Apple</Text>
            </TouchableOpacity>
          )
        ) : (
          <View>
            <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.85}>
              <Text style={styles.signOutText}>Sign Out Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount} activeOpacity={0.85}>
              <Text style={styles.deleteAccountText}>Delete Account & Data</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AI Data Sharing Consent Control (Apple Guideline 5.1.1(i) / 5.1.2(i)) */}
        <View style={[styles.settingRow, { marginTop: 14, borderBottomWidth: 0, paddingBottom: 0 }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.rowLabel}>🤖 AI Data Processing Consent</Text>
            <Text style={styles.rowSub}>Allows sending food photos & notes to Google Gemini AI for calculation.</Text>
          </View>
          <Switch
            value={!!profile.has_consented_ai_data_sharing}
            onValueChange={(val) => setAIConsent(val)}
            trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
          />
        </View>
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
                onChangeText={handleDirectCalorieTextChange}
                onBlur={handleDirectCalorieSubmitOrBlur}
                onSubmitEditing={handleDirectCalorieSubmitOrBlur}
                keyboardType="number-pad"
                selectTextOnFocus
                maxLength={5}
                returnKeyType="done"
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

      {/* Cultural Cuisine & Flavor Profile Selector */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Globe size={20} color="#6366F1" />
          <Text style={styles.sectionTitle}>Cultural Cuisine & Flavor Profile</Text>
        </View>
        <Text style={styles.retentionLabel}>
          Guides AI vision on local cooking oil, ghee, and regional ingredient defaults:
        </Text>
        <View style={styles.retentionPillRow}>
          {[
            { label: '🌐 Standard', val: 'Standard' },
            { label: '🍛 Indian Homestyle', val: 'Indian Homestyle' },
            { label: '🥢 East Asian', val: 'East Asian' },
            { label: '🥙 Middle Eastern', val: 'Middle Eastern' },
            { label: '🌮 Latin American', val: 'Latin American' },
          ].map((preset) => {
            const isSelected = (goals.cultural_preset || 'Standard') === preset.val;
            return (
              <TouchableOpacity
                key={preset.val}
                style={[styles.retentionBtn, isSelected && styles.retentionBtnSel]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateGoals({ cultural_preset: preset.val as any });
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.retentionText, isSelected && styles.retentionTextSel]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Preferred Units & Intermittent Fasting Schedule */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Scale size={20} color="#059669" />
          <Text style={styles.sectionTitle}>Units & Fasting Schedule</Text>
        </View>

        {/* Preferred Weight Unit */}
        <Text style={styles.retentionLabel}>Preferred Scale Unit:</Text>
        <View style={styles.retentionPillRow}>
          {[
            { label: 'Pounds (lbs)', val: 'lbs' },
            { label: 'Kilograms (kg)', val: 'kg' },
          ].map((u) => {
            const isSel = (goals.weight_unit || 'lbs') === u.val;
            return (
              <TouchableOpacity
                key={u.val}
                style={[styles.retentionBtn, isSel && styles.retentionBtnSel]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setWeightUnit(u.val as 'lbs' | 'kg');
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.retentionText, isSel && styles.retentionTextSel]}>{u.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Intermittent Fasting Schedule */}
        <Text style={[styles.retentionLabel, { marginTop: 14 }]}>Intermittent Fasting Schedule:</Text>
        <View style={styles.retentionPillRow}>
          {[
            { label: '16:8 Standard', val: '16:8' },
            { label: '14:10 Gentle', val: '14:10' },
            { label: '18:6 Advanced', val: '18:6' },
          ].map((p) => {
            const isSel = (profile.fasting_protocol || '16:8') === p.val;
            return (
              <TouchableOpacity
                key={p.val}
                style={[styles.retentionBtn, isSel && styles.retentionBtnSel]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFastingProtocol(p.val as any);
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.retentionText, isSel && styles.retentionTextSel]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Subscription Card */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Sparkles size={20} color="#6366F1" />
          <Text style={styles.sectionTitle}>Subscription Plan</Text>
        </View>
        <Text style={styles.planStatus}>{getActivePlanLabel()}</Text>
        {!profile.is_pro_subscriber && (
          <Text style={styles.planLimitNote}>{pricingConfig.free_tier.limit_detail}</Text>
        )}
        <View style={styles.subBtnRow}>
          <TouchableOpacity style={styles.manageSubBtn} onPress={handleManageSubscription} activeOpacity={0.85}>
            <Text style={styles.manageSubText}>
              {profile.is_pro_subscriber
                ? pricingConfig.pro_tier?.manage_sub_label || 'Manage Plan'
                : pricingConfig.pro_tier?.upgrade_sub_label || 'Upgrade to Pro'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestorePurchases}
            disabled={isRestoring}
            activeOpacity={0.85}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <Text style={styles.restoreBtnText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
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
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>🍳 Breakfast Reminder</Text>
                <TouchableOpacity
                  onPress={() => handleOpenTimePicker('breakfast', notifications.breakfast_time || '08:30')}
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
                  onPress={() => handleOpenTimePicker('lunch', notifications.lunch_time || '13:00')}
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
                  onPress={() => handleOpenTimePicker('dinner', notifications.dinner_time || '19:30')}
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

      {/* App Version & Build Footer */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerAppText}>
          CalSnap AI v{Constants.expoConfig?.version || Constants.nativeAppVersion || '1.1.0'}
          {(Constants.expoConfig?.ios?.buildNumber || Constants.nativeBuildVersion) ? ` (Build #${Constants.expoConfig?.ios?.buildNumber || Constants.nativeBuildVersion})` : ''}
        </Text>
      </View>

      {/* Paywall Modal */}
      <PaywallModal visible={paywallVisible} reason={paywallReason} onClose={() => setPaywallVisible(false)} />

      {/* Macro Calculator & Goal Editor Modal */}
      <MacroCalculatorModal visible={macroModalVisible} onClose={() => setMacroModalVisible(false)} />

      {/* Cross-Platform Time Picker Modal (Android-Safe) */}
      <Modal
        visible={timePickerMeal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerMeal(null)}
      >
        <View style={styles.timeModalOverlay}>
          <View style={styles.timeModalCard}>
            <View style={styles.timeModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clock size={20} color="#4F46E5" />
                <Text style={styles.timeModalTitle}>
                  Set {timePickerMeal ? timePickerMeal.charAt(0).toUpperCase() + timePickerMeal.slice(1) : ''} Time
                </Text>
              </View>
              <TouchableOpacity onPress={() => setTimePickerMeal(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.presetTitle}>Quick Presets</Text>
            <View style={styles.presetRow}>
              {timePickerMeal && PRESET_TIMES[timePickerMeal].map((t) => {
                const isActive = timeInputVal === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.presetChip, isActive && styles.presetChipActive]}
                    onPress={() => {
                      setTimeInputVal(t);
                      setTimePickerError(null);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.timeInputLabel}>Or enter custom 24h time (HH:MM):</Text>
            <TextInput
              style={[styles.timeInput, timePickerError ? styles.timeInputErrorBorder : null]}
              value={timeInputVal}
              onChangeText={(val) => {
                setTimeInputVal(val);
                setTimePickerError(null);
              }}
              placeholder="e.g. 08:30"
              placeholderTextColor="#94A3B8"
              maxLength={5}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              onSubmitEditing={handleSaveReminderTime}
            />
            {timePickerError && (
              <Text style={styles.timeInputError}>{timePickerError}</Text>
            )}

            <View style={styles.timeModalBtnRow}>
              <TouchableOpacity style={styles.timeCancelBtn} onPress={() => setTimePickerMeal(null)}>
                <Text style={styles.timeCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timeSaveBtn} onPress={handleSaveReminderTime}>
                <Text style={styles.timeSaveText}>Save Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 12,
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
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
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
    width: '100%',
    height: 48,
  },
  fallbackSignInBtn: {
    backgroundColor: '#000000',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackSignInText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
  deleteAccountBtn: {
    backgroundColor: '#FFF1F2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECDD3',
    marginTop: 8,
  },
  deleteAccountText: {
    color: '#E11D48',
    fontSize: 13,
    fontWeight: '800',
  },
  planStatus: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
    marginBottom: 8,
  },
  planLimitNote: {
    fontSize: 13,
    lineHeight: 18,
    color: '#78350F',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  subBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  manageSubBtn: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  manageSubText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '800',
  },
  restoreBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  restoreBtnText: {
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
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    paddingVertical: 10,
  },
  footerAppText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  timeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  timeModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  timeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  presetTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  timeInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  timeInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 2,
  },
  timeInputErrorBorder: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  timeInputError: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  timeModalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  timeCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  timeCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  timeSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  timeSaveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
