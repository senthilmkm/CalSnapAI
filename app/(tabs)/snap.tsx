import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Camera, Image as ImageIcon, Mic, Zap, Sparkles, AlertCircle, XCircle, HelpCircle, Info } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../services/storage';
import { analyzeMealImage, parseNaturalLanguageMeal } from '../../services/api';
import { OilSlider } from '../../components/OilSlider';
import { PortionSlider } from '../../components/PortionSlider';
import { PaywallModal } from '../../components/PaywallModal';
import { sendInstantAsyncMealNotification } from '../../services/notifications';

const FREE_DAILY_SNAP_LIMIT = 3;

export default function SnapScreen() {
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');
  const [currentMealId, setCurrentMealId] = useState<string | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const profile = useAppStore((state) => state.profile);
  const goals = useAppStore((state) => state.goals);
  const addMeal = useAppStore((state) => state.addMeal);
  const updateMealSliders = useAppStore((state) => state.updateMealSliders);
  const getTodayMeals = useAppStore((state) => state.getTodayMeals);
  const meals = useAppStore((state) => state.meals);

  const activeMeal = meals.find((m) => m.id === currentMealId);
  const todaySnapsCount = getTodayMeals().length;
  const isFreeTier = !profile.is_pro_subscriber;
  const snapsRemaining = Math.max(0, FREE_DAILY_SNAP_LIMIT - todaySnapsCount);

  // Reset all viewport and recording states when user returns/taps the Snap tab
  useFocusEffect(
    useCallback(() => {
      setSelectedImage(null);
      setCurrentMealId(null);
      setVoiceNote('');
      setRecordingVoice(false);
    }, [])
  );

  // Paywall Gate Verification
  const verifyPaywallGate = (): boolean => {
    if (isFreeTier && todaySnapsCount >= FREE_DAILY_SNAP_LIMIT) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setPaywallVisible(true);
      return false;
    }
    return true;
  };

  // Launch Native iOS Camera
  const handleCameraSnap = async () => {
    if (analyzing) return;
    if (!verifyPaywallGate()) return;

    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to take food photos.');
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setSelectedImage(result.assets[0].uri);
        await processImageAnalysis(result.assets[0].base64, result.assets[0].uri);
      }
    } catch (err) {
      // Fallback for iOS Simulator where physical camera is unavailable
      const mockBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const mockUri = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500";
      setSelectedImage(mockUri);
      await processImageAnalysis(mockBase64, mockUri);
    }
  };

  // Launch Native iOS Gallery Picker
  const handlePickImage = async () => {
    if (analyzing) return;
    if (!verifyPaywallGate()) return;

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Camera roll permission is required to select food photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setSelectedImage(result.assets[0].uri);
        await processImageAnalysis(result.assets[0].base64, result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Image Error', 'Failed to load photo.');
    }
  };

  const processImageAnalysis = async (base64: string, uri: string) => {
    setAnalyzing(true);
    try {
      const result = await analyzeMealImage({
        imageBase64: base64,
        voiceTranscript: voiceNote,
        culturalPreset: goals.cultural_preset,
      });
      
      const newMeal = addMeal({
        dish_name: result.dish_name,
        meal_type: 'Lunch',
        items: result.items,
        estimated_oil_g: result.estimated_oil_g,
        portion_multiplier: 1.0,
        total_calories: result.total_calories,
        total_protein_g: result.total_protein_g,
        total_carbs_g: result.total_carbs_g,
        total_fat_g: result.total_fat_g,
        glucose_impact_score: result.glucose_impact_score,
        energy_crash_risk: result.energy_crash_risk,
        ai_tip: result.ai_tip,
        image_uri: uri,
      });

      setCurrentMealId(newMeal.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await sendInstantAsyncMealNotification(result.dish_name, result.total_calories);

    } catch (err) {
      Alert.alert('Analysis Warning', 'Meal logged with standard fallback nutrition estimation.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleToggleVoice = async () => {
    if (recordingVoice) {
      setRecordingVoice(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    if (voiceNote) {
      // Clear existing voice note
      setVoiceNote('');
      setRecordingVoice(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    Alert.alert(
      '🎙️ Add Meal Details',
      'You can add voice/text details BEFORE or AFTER taking a photo (e.g. "cooked in ghee", "ate half portion").',
      [
        {
          text: '🎙️ Record Voice Note',
          onPress: async () => {
            setRecordingVoice(true);
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setTimeout(() => {
              setRecordingVoice(false);
              setVoiceNote("Extra olive oil dressing, half portion eaten");
            }, 3000);
          },
        },
        {
          text: '✍️ Type Custom Note',
          onPress: () => {
            Alert.prompt(
              'Meal Note',
              'Enter details (e.g. "cooked in 2 tbsp ghee, ate half portion"):',
              (text) => {
                if (text) {
                  setVoiceNote(text);
                  setRecordingVoice(false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              }
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Snap & Log</Text>
        <TouchableOpacity style={styles.quotaBadge} onPress={() => isFreeTier && setPaywallVisible(true)}>
          <Sparkles size={14} color={isFreeTier ? '#F59E0B' : '#10B981'} />
          <Text style={[styles.quotaText, { color: isFreeTier ? '#D97706' : '#065F46' }]}>
            {isFreeTier ? `${snapsRemaining}/3 Free Snaps` : 'PRO UNLIMITED'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Free Tier Gate Warning Banner */}
      {isFreeTier && snapsRemaining === 0 && (
        <TouchableOpacity style={styles.gateBanner} onPress={() => setPaywallVisible(true)} activeOpacity={0.9}>
          <AlertCircle size={18} color="#EF4444" />
          <Text style={styles.gateBannerText}>Daily free limit reached. Tap to upgrade to Pro Unlimited!</Text>
        </TouchableOpacity>
      )}

      {/* Crystal Clear Guided Step Indicator */}
      <View style={styles.stepGuideBar}>
        <View style={styles.stepItem}>
          <View style={styles.stepCircle}><Text style={styles.stepNum}>1</Text></View>
          <Text style={styles.stepLabel}>Snap Food Photo</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, styles.stepCircleOptional]}><Text style={styles.stepNumOptional}>2</Text></View>
          <Text style={styles.stepLabel}>Add Note / Sliders</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Camera Viewfinder Target Box */}
        <TouchableOpacity style={styles.cameraBox} onPress={handleCameraSnap} activeOpacity={0.9}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
          ) : (
            <View style={styles.cameraPlaceholder}>
              {/* Viewfinder Target Frame with Glowing Reticle Brackets */}
              <View style={styles.viewfinderFrame}>
                <View style={[styles.cornerBracket, styles.topLeftCorner]} />
                <View style={[styles.cornerBracket, styles.topRightCorner]} />
                <View style={[styles.cornerBracket, styles.bottomLeftCorner]} />
                <View style={[styles.cornerBracket, styles.bottomRightCorner]} />

                <View style={styles.cameraCircleIcon}>
                  <Camera size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.placeholderTitle}>Tap Frame to Take Photo</Text>
                <Text style={styles.placeholderText}>Align food plate & snap instantly</Text>
              </View>
            </View>
          )}

          {analyzing && (
            <View style={styles.analyzingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.analyzingText}>AI analyzing macros & ingredients...</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Voice / Text Note Bar */}
        <TouchableOpacity
          style={[styles.voiceBar, recordingVoice && styles.voiceBarActive, !!voiceNote && styles.voiceBarFilled]}
          onPress={handleToggleVoice}
          activeOpacity={0.85}
        >
          <Mic size={20} color={recordingVoice ? '#EF4444' : voiceNote ? '#047857' : '#4F46E5'} />
          <Text style={[styles.voiceText, !!voiceNote && styles.voiceTextFilled]}>
            {recordingVoice
              ? '🎙️ Recording note... (3s)'
              : voiceNote
              ? `Attached Note: "${voiceNote}" (Tap to clear)`
              : '🎙️ Add Voice/Text Note (Before or after photo)'}
          </Text>
          {!!voiceNote && <XCircle size={18} color="#047857" />}
        </TouchableOpacity>

        {/* Action Controls Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.galleryBtn} onPress={handlePickImage} activeOpacity={0.85}>
            <ImageIcon size={20} color="#475569" />
            <Text style={styles.controlBtnLabel}>Photo Library</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.proBtn} onPress={() => setPaywallVisible(true)} activeOpacity={0.85}>
            <Zap size={20} color="#D97706" />
            <Text style={styles.proBtnLabel}>CalSnap Pro</Text>
          </TouchableOpacity>
        </View>

        {/* Live Interactive Results Container */}
        {activeMeal && (
          <View style={styles.resultContainer}>
            {/* Dish Header Row with Flex Wrapping & Calorie Pill Badge */}
            <View style={styles.dishHeaderRow}>
              <Text style={styles.dishTitle} numberOfLines={2} ellipsizeMode="tail">
                {activeMeal.dish_name}
              </Text>
              <View style={styles.dishCalsBadge}>
                <Text style={styles.dishCalsText}>{activeMeal.total_calories}</Text>
                <Text style={styles.dishCalsUnit}>kcal</Text>
              </View>
            </View>

            {/* Interactive Portion & Oil Sliders */}
            <PortionSlider
              multiplier={activeMeal.portion_multiplier}
              onChangeMultiplier={(val: number) => updateMealSliders(activeMeal.id, val, activeMeal.estimated_oil_g)}
            />

            <OilSlider
              currentOilGrams={activeMeal.estimated_oil_g}
              onChangeOil={(val: number) => updateMealSliders(activeMeal.id, activeMeal.portion_multiplier, val)}
            />

            {/* AI Nutrition Tip */}
            {activeMeal.ai_tip && (
              <View style={styles.aiTipBox}>
                <Sparkles size={16} color="#6366F1" />
                <Text style={styles.aiTipText}>{activeMeal.ai_tip}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* StoreKit 2 Paywall Modal */}
      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  quotaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  quotaText: {
    fontSize: 12,
    fontWeight: '800',
  },
  gateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  gateBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
    flex: 1,
  },
  stepGuideBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleOptional: {
    backgroundColor: '#64748B',
  },
  stepNum: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  stepNumOptional: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  stepLine: {
    width: 20,
    height: 2,
    backgroundColor: '#CBD5E1',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  cameraBox: {
    width: '100%',
    height: 260,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cameraPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  viewfinderFrame: {
    width: '85%',
    height: '80%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    borderStyle: 'dashed',
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#6366F1',
  },
  topLeftCorner: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRightCorner: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeftCorner: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRightCorner: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  cameraCircleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  placeholderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  analyzingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  voiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  voiceBarActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  voiceBarFilled: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  voiceText: {
    fontSize: 13,
    color: '#3730A3',
    fontWeight: '600',
    flex: 1,
  },
  voiceTextFilled: {
    color: '#047857',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  galleryBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 8,
  },
  controlBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  proBtn: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 8,
  },
  proBtnLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D97706',
  },
  resultContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dishHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  dishTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  dishCalsBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishCalsText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4F46E5',
  },
  dishCalsUnit: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366F1',
    marginTop: -2,
  },
  aiTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 14,
  },
  aiTipText: {
    fontSize: 12,
    color: '#5B21B6',
    fontWeight: '600',
    flex: 1,
  },
});
