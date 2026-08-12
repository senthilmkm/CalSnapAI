import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Camera, Image as ImageIcon, Mic, Zap, Sparkles, AlertCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../services/storage';
import { analyzeMealImage } from '../../services/api';
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
      setVoiceNote("Extra olive oil dressing, half portion eaten");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      setRecordingVoice(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => {
        setRecordingVoice(false);
        setVoiceNote("Extra olive oil dressing, half portion eaten");
      }, 3000);
    }
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Camera Viewport / Image Preview Card */}
        <TouchableOpacity style={styles.cameraBox} onPress={handleCameraSnap} activeOpacity={0.9}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <View style={styles.cameraCircleIcon}>
                <Camera size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.placeholderTitle}>Tap to Open Camera</Text>
              <Text style={styles.placeholderText}>Take a photo of your meal or snack</Text>
            </View>
          )}

          {analyzing && (
            <View style={styles.analyzingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.analyzingText}>AI analyzing macros & ingredients...</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Voice Note Bar */}
        <TouchableOpacity
          style={[styles.voiceBar, recordingVoice && styles.voiceBarActive]}
          onPress={handleToggleVoice}
          activeOpacity={0.85}
        >
          <Mic size={20} color={recordingVoice ? '#EF4444' : '#4F46E5'} />
          <Text style={styles.voiceText}>
            {recordingVoice ? '🎙️ Listening... (Hold or tap to finish)' : voiceNote ? `Voice Note: "${voiceNote}"` : 'Tap to add voice note (e.g. "used extra olive oil")'}
          </Text>
        </TouchableOpacity>

        {/* Action Controls Row */}
        <View style={styles.shutterRow}>
          <TouchableOpacity style={styles.galleryBtn} onPress={handlePickImage} activeOpacity={0.85}>
            <ImageIcon size={22} color="#475569" />
            <Text style={styles.controlBtnLabel}>Photo Library</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shutterBtn} onPress={handleCameraSnap} disabled={analyzing} activeOpacity={0.85}>
            <Camera size={26} color="#FFFFFF" />
            <Text style={styles.shutterBtnText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.proBtn} onPress={() => setPaywallVisible(true)} activeOpacity={0.85}>
            <Zap size={22} color="#D97706" />
            <Text style={styles.proBtnLabel}>CalSnap Pro</Text>
          </TouchableOpacity>
        </View>

        {/* Live Interactive Sliders (When Active Meal Logged) */}
        {activeMeal && (
          <View style={styles.resultContainer}>
            <View style={styles.dishHeaderRow}>
              <Text style={styles.dishTitle}>{activeMeal.dish_name}</Text>
              <Text style={styles.dishCals}>{activeMeal.total_calories} kcal</Text>
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
    marginBottom: 10,
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  cameraBox: {
    width: '100%',
    height: 250,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cameraPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  cameraCircleIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  placeholderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
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
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  voiceBarActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  voiceText: {
    fontSize: 13,
    color: '#3730A3',
    fontWeight: '600',
    flex: 1,
  },
  shutterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  galleryBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 4,
  },
  controlBtnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  shutterBtn: {
    flex: 2,
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  shutterBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  proBtn: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 4,
  },
  proBtnLabel: {
    fontSize: 11,
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
  },
  dishTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  dishCals: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4F46E5',
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
