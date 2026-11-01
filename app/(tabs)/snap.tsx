import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Camera, Image as ImageIcon, Mic, Zap, Sparkles, AlertCircle, XCircle, HelpCircle, Info, Barcode, Check } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../services/storage';
import { analyzeMealImage, parseNaturalLanguageMeal } from '../../services/api';
import { OilSlider } from '../../components/OilSlider';
import { PortionSlider } from '../../components/PortionSlider';
import { PaywallModal } from '../../components/PaywallModal';
import { BarcodeScannerModal } from '../../components/BarcodeScannerModal';
import { AIDataConsentModal } from '../../components/AIDataConsentModal';
import { sendInstantAsyncMealNotification } from '../../services/notifications';
import pricingConfig from '../../config/pricing.json';

const FREE_DAILY_SNAP_LIMIT = pricingConfig.free_tier?.daily_snap_limit ?? 1;

export default function SnapScreen() {
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');
  const [customNoteModalVisible, setCustomNoteModalVisible] = useState(false);
  const [customNoteDraft, setCustomNoteDraft] = useState('');
  const [currentMealId, setCurrentMealId] = useState<string | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [barcodeModalVisible, setBarcodeModalVisible] = useState(false);
  const [aiConsentModalVisible, setAiConsentModalVisible] = useState(false);
  const [pendingAIAction, setPendingAIAction] = useState<'camera' | 'gallery' | null>(null);
  const [cookingStyle, setCookingStyle] = useState<'raw' | 'light' | 'heavy'>('light');

  // Scanner HUD Animated State
  const scanAnim = useRef(new Animated.Value(0)).current;
  const [scanPhaseIndex, setScanPhaseIndex] = useState(0);

  // Dynamic context-adaptive scan phases
  const getScanPhases = () => {
    if (cookingStyle === 'raw') {
      return [
        { tag: '3D GEOMETRY', text: 'Scanning 3D food geometry & plate depth...', icon: '🔍' },
        { tag: 'PRODUCE DETECTION', text: 'Identifying natural produce & piece size...', icon: '🍎' },
        { tag: 'FIBER & DENSITY', text: 'Evaluating dietary fiber & moisture density...', icon: '🌿' },
        { tag: 'CLINICAL NUTRITION', text: 'Computing clinical calories & macro distribution...', icon: '📊' },
      ];
    }
    if (cookingStyle === 'heavy') {
      return [
        { tag: '3D GEOMETRY', text: 'Scanning 3D food geometry & portion volume...', icon: '🔍' },
        { tag: 'DISH SEGMENTATION', text: 'Segmenting individual items & curry bases...', icon: '🍛' },
        { tag: 'FAT CALIBRATION', text: 'Calibrating cooking oil & sauce absorption...', icon: '🧈' },
        { tag: 'CLINICAL NUTRITION', text: 'Computing clinical calories & macro distribution...', icon: '🎯' },
      ];
    }
    return [
      { tag: '3D GEOMETRY', text: 'Scanning 3D food geometry & plate dimensions...', icon: '🔍' },
      { tag: 'PORTION MASS', text: 'Identifying food items & calculating portion mass...', icon: '🥗' },
      { tag: 'PREPARATION STYLE', text: 'Evaluating prep style & moisture density...', icon: '⚖️' },
      { tag: 'CLINICAL NUTRITION', text: 'Computing clinical calories & macro distribution...', icon: '🎯' },
    ];
  };

  const scanPhases = getScanPhases();

  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    let intervalId: any = null;

    if (analyzing) {
      setScanPhaseIndex(0);
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1100,
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();

      intervalId = setInterval(() => {
        setScanPhaseIndex((prev) => {
          const next = (prev + 1) % 4;
          Haptics.selectionAsync();
          return next;
        });
      }, 650);
    } else {
      scanAnim.setValue(0);
      setScanPhaseIndex(0);
    }

    return () => {
      if (animLoop) animLoop.stop();
      if (intervalId) clearInterval(intervalId);
    };
  }, [analyzing]);

  const profile = useAppStore((state) => state.profile);
  const setAIConsent = useAppStore((state) => state.setAIConsent);
  const goals = useAppStore((state) => state.goals);
  const addMeal = useAppStore((state) => state.addMeal);
  const updateMealSliders = useAppStore((state) => state.updateMealSliders);
  const getTodayScanCount = useAppStore((state) => state.getTodayScanCount);
  const incrementDailyScan = useAppStore((state) => state.incrementDailyScan);
  const meals = useAppStore((state) => state.meals);

  const activeMeal = meals.find((m) => m.id === currentMealId);
  const todaySnapsCount = getTodayScanCount();
  const isFreeTier = !profile.is_pro_subscriber;
  const snapsRemaining = Math.max(0, FREE_DAILY_SNAP_LIMIT - todaySnapsCount);

  // Reset all viewport and recording states when user returns/taps the Snap tab
  useFocusEffect(
    useCallback(() => {
      setSelectedImage(null);
      setCurrentMealId(null);
      setVoiceNote('');
      setRecordingVoice(false);
      setCookingStyle('light');
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

  // AI Data Privacy & Sharing Consent Gate (Apple Guideline 5.1.1(i) / 5.1.2(i))
  const ensureAIConsent = (action: 'camera' | 'gallery'): boolean => {
    const hasConsented = !!useAppStore.getState().profile.has_consented_ai_data_sharing;
    if (hasConsented) {
      return true;
    }
    setPendingAIAction(action);
    setAiConsentModalVisible(true);
    return false;
  };

  const executeCameraLaunch = async () => {
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

  const executeGalleryLaunch = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Photo library permission is required to select food photos.');
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

  const handleConsentAgree = () => {
    setAIConsent(true);
    setAiConsentModalVisible(false);
    const actionToRun = pendingAIAction;
    setPendingAIAction(null);

    if (!verifyPaywallGate()) return;

    // Direct execution of pending action after consent granted
    if (actionToRun === 'camera') {
      setTimeout(() => {
        executeCameraLaunch();
      }, 250);
    } else if (actionToRun === 'gallery') {
      setTimeout(() => {
        executeGalleryLaunch();
      }, 250);
    }
  };

  const handleConsentDecline = () => {
    setAiConsentModalVisible(false);
    setPendingAIAction(null);
    Alert.alert(
      'AI Analysis Disabled',
      'Food recognition requires sending images to Google Gemini AI for calculation. You can grant permission anytime in Settings or when scanning a meal.'
    );
  };

  // Launch Native iOS Camera
  const handleCameraSnap = async () => {
    if (analyzing) return;
    if (!verifyPaywallGate()) return;
    if (!ensureAIConsent('camera')) return;
    await executeCameraLaunch();
  };

  // Launch Native iOS Gallery Picker
  const handlePickImage = async () => {
    if (analyzing) return;
    if (!verifyPaywallGate()) return;
    if (!ensureAIConsent('gallery')) return;
    await executeGalleryLaunch();
  };

  const isRawFoodItem = (dishName: string, items: any[] = []): boolean => {
    const rawKeywords = [
      'orange', 'apple', 'banana', 'fruit', 'berries', 'berry', 'watermelon',
      'grape', 'citrus', 'mango', 'pineapple', 'papaya', 'peach', 'plum',
      'melon', 'strawberry', 'blueberry', 'raw salad', 'fresh salad', 'raw vegetable', 'boiled egg'
    ];
    const lowerDish = (dishName || '').toLowerCase();
    if (rawKeywords.some((kw) => lowerDish.includes(kw))) return true;
    return items.some((it) => {
      const lowerItem = (it?.name || '').toLowerCase();
      return rawKeywords.some((kw) => lowerItem.includes(kw));
    });
  };

  const processImageAnalysis = async (base64: string, uri: string) => {
    setAnalyzing(true);
    try {
      const result = await analyzeMealImage({
        imageBase64: base64,
        voiceTranscript: voiceNote,
        culturalPreset: goals.cultural_preset,
        cookingStyle: cookingStyle,
      });

      const isRaw = cookingStyle === 'raw' || isRawFoodItem(result.dish_name, result.items);
      const finalOilGrams = isRaw ? 0 : result.estimated_oil_g;

      if (isRaw) {
        setCookingStyle('raw');
      }

      // Recalculate fat and calories if oil was zeroed out for raw food
      const oilDiffGrams = result.estimated_oil_g - finalOilGrams;
      const oilDiffCals = oilDiffGrams * 9;
      const finalFatG = Math.max(0, result.total_fat_g - oilDiffGrams);
      const finalCalories = Math.max(0, result.total_calories - oilDiffCals);
      
      const newMeal = addMeal({
        dish_name: result.dish_name,
        meal_type: result.meal_type || 'Lunch',
        items: result.items,
        estimated_oil_g: finalOilGrams,
        portion_multiplier: 1.0,
        total_calories: finalCalories,
        total_protein_g: result.total_protein_g,
        total_carbs_g: result.total_carbs_g,
        total_fat_g: finalFatG,
        glucose_impact_score: result.glucose_impact_score,
        energy_crash_risk: result.energy_crash_risk,
        ai_tip: result.ai_tip,
        image_uri: uri,
        voice_transcript: voiceNote || undefined,
      });

      setCurrentMealId(newMeal.id);
      incrementDailyScan();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await sendInstantAsyncMealNotification(result.dish_name, result.total_calories);

    } catch (err: any) {
      if (err?.message === 'QUOTA_EXCEEDED') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setPaywallVisible(true);
        return;
      }
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
            setCustomNoteDraft(voiceNote || '');
            setCustomNoteModalVisible(true);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const laserTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 220],
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Snap & Log</Text>
        <TouchableOpacity style={styles.quotaBadge} onPress={() => isFreeTier && setPaywallVisible(true)}>
          <Sparkles size={14} color={isFreeTier ? (snapsRemaining > 0 ? '#10B981' : '#EF4444') : '#10B981'} />
          <Text style={[styles.quotaText, { color: isFreeTier ? (snapsRemaining > 0 ? '#065F46' : '#DC2626') : '#065F46' }]}>
            {isFreeTier
              ? snapsRemaining > 0
                ? pricingConfig.free_tier?.badge_text_available || '1 Free Snap Left'
                : pricingConfig.free_tier?.badge_text_used || '0 Free Snaps Left'
              : pricingConfig.pro_tier?.badge_text || 'PRO UNLIMITED'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Free Tier Gate Warning Banner */}
      {isFreeTier && snapsRemaining === 0 && (
        <TouchableOpacity style={styles.gateBanner} onPress={() => setPaywallVisible(true)} activeOpacity={0.9}>
          <AlertCircle size={18} color="#EF4444" />
          <Text style={styles.gateBannerText}>
            {pricingConfig.free_tier?.banner_text || '🔒 Daily 1 Free AI Scan used. Tap to upgrade to Pro Unlimited!'}
          </Text>
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
              {/* Animated Laser Scanning Beam */}
              <Animated.View
                style={[
                  styles.laserBeam,
                  {
                    transform: [{ translateY: laserTranslateY }],
                  },
                ]}
              />

              {/* Glowing Corner HUD Reticle */}
              <View style={styles.hudOverlayFrame} pointerEvents="none">
                <View style={[styles.hudBracket, styles.hudTopLeft]} />
                <View style={[styles.hudBracket, styles.hudTopRight]} />
                <View style={[styles.hudBracket, styles.hudBottomLeft]} />
                <View style={[styles.hudBracket, styles.hudBottomRight]} />
              </View>

              {/* Center AI Vision Status Card */}
              <View style={styles.aiStatusCard}>
                <View style={styles.aiStatusHeader}>
                  <View style={styles.radarLiveDot} />
                  <Text style={styles.aiStatusBadge}>
                    AI RADAR • {scanPhases[scanPhaseIndex]?.tag || 'ANALYZING'}
                  </Text>
                </View>

                <Text style={styles.aiPhaseText}>
                  {scanPhases[scanPhaseIndex]?.icon} {scanPhases[scanPhaseIndex]?.text}
                </Text>

                {/* 4-Phase Progress Indicator */}
                <View style={styles.phaseDotsRow}>
                  {[0, 1, 2, 3].map((idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.phaseDot,
                        scanPhaseIndex >= idx && styles.phaseDotActive,
                        scanPhaseIndex === idx && styles.phaseDotCurrent,
                      ]}
                    />
                  ))}
                </View>
              </View>
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

        {/* Cooking Style Oil Selector Pills */}
        <View style={styles.cookingStyleRow}>
          <TouchableOpacity
            style={[styles.stylePill, cookingStyle === 'raw' && styles.stylePillActiveRaw]}
            onPress={() => setCookingStyle('raw')}
            activeOpacity={0.85}
          >
            <Text style={[styles.stylePillText, cookingStyle === 'raw' && styles.stylePillTextActive]}>
              🥗 Raw/Boiled (0g)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.stylePill, cookingStyle === 'light' && styles.stylePillActiveLight]}
            onPress={() => setCookingStyle('light')}
            activeOpacity={0.85}
          >
            <Text style={[styles.stylePillText, cookingStyle === 'light' && styles.stylePillTextActive]}>
              🍳 Light Oil (+5g)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.stylePill, cookingStyle === 'heavy' && styles.stylePillActiveHeavy]}
            onPress={() => setCookingStyle('heavy')}
            activeOpacity={0.85}
          >
            <Text style={[styles.stylePillText, cookingStyle === 'heavy' && styles.stylePillTextActive]}>
              🧈 Butter / Ghee (+15g)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Controls Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.galleryBtn} onPress={handlePickImage} activeOpacity={0.85}>
            <ImageIcon size={18} color="#475569" />
            <Text style={styles.controlBtnLabel}>Photo Library</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.barcodeBtn} onPress={() => setBarcodeModalVisible(true)} activeOpacity={0.85}>
            <Barcode size={18} color="#4F46E5" />
            <Text style={styles.barcodeBtnLabel}>Scan Barcode</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.proBtn} onPress={() => setPaywallVisible(true)} activeOpacity={0.85}>
            <Zap size={18} color="#D97706" />
            <Text style={styles.proBtnLabel}>Pro</Text>
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
              isPro={profile.is_pro_subscriber}
              onPressLock={() => setPaywallVisible(true)}
              onChangeMultiplier={(val: number) => updateMealSliders(activeMeal.id, val, activeMeal.estimated_oil_g)}
            />

            <OilSlider
              currentOilGrams={activeMeal.estimated_oil_g}
              isPro={profile.is_pro_subscriber}
              onPressLock={() => setPaywallVisible(true)}
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

      {/* Real-time OpenFoodFacts Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={barcodeModalVisible}
        onClose={() => setBarcodeModalVisible(false)}
        onMealLogged={(meal) => setCurrentMealId(meal.id)}
      />

      {/* AI Data Processing & Privacy Consent Modal (Guideline 5.1.1(i) / 5.1.2(i)) */}
      <AIDataConsentModal
        visible={aiConsentModalVisible}
        onAgree={handleConsentAgree}
        onDecline={handleConsentDecline}
      />

      {/* Cross-Platform Custom Note Modal (Android-Safe) */}
      <Modal
        visible={customNoteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomNoteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.noteModalOverlay}
        >
          <View style={styles.noteModalCard}>
            <Text style={styles.noteModalTitle}>Add Meal Details</Text>
            <Text style={styles.noteModalSub}>
              Helps AI precision (e.g. "cooked in olive oil", "half portion", "2 boiled eggs")
            </Text>
            <TextInput
              style={styles.noteModalInput}
              value={customNoteDraft}
              onChangeText={setCustomNoteDraft}
              placeholder="e.g. 1 tbsp ghee, ate half..."
              placeholderTextColor="#94A3B8"
              autoFocus
              maxLength={120}
              returnKeyType="done"
            />
            <View style={styles.noteModalBtnRow}>
              <TouchableOpacity
                style={styles.noteCancelBtn}
                onPress={() => setCustomNoteModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.noteCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.noteSaveBtn}
                onPress={() => {
                  const trimmed = customNoteDraft.trim();
                  if (trimmed) {
                    setVoiceNote(trimmed);
                    setRecordingVoice(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                  setCustomNoteModalVisible(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.noteSaveBtnText}>Save Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  laserBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 10,
  },
  hudOverlayFrame: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    left: 14,
    right: 14,
  },
  hudBracket: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#10B981',
  },
  hudTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  hudTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  hudBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  hudBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  aiStatusCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
    maxWidth: '92%',
    zIndex: 20,
  },
  aiStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  radarLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  aiStatusBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#818CF8',
    letterSpacing: 1.2,
  },
  aiPhaseText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
    minHeight: 36,
  },
  phaseDotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  phaseDot: {
    width: 14,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#334155',
  },
  phaseDotActive: {
    backgroundColor: '#6366F1',
  },
  phaseDotCurrent: {
    backgroundColor: '#10B981',
    width: 22,
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
  cookingStyleRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  stylePill: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stylePillActiveRaw: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  stylePillActiveLight: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  stylePillActiveHeavy: {
    backgroundColor: '#FFEDD5',
    borderColor: '#FDBA74',
  },
  stylePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  stylePillTextActive: {
    color: '#0F172A',
    fontWeight: '800',
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
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  barcodeBtn: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 6,
  },
  barcodeBtnLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4338CA',
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
    gap: 6,
  },
  proBtnLabel: {
    fontSize: 12,
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
  noteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noteModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  noteModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  noteModalSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 16,
  },
  noteModalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 18,
  },
  noteModalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  noteCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  noteCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  noteSaveBtn: {
    flex: 1,
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  noteSaveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
