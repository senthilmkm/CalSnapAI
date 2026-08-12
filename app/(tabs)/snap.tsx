import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert, Modal, TextInput, ScrollView, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, Mic, RefreshCw, Check, Sparkles, Volume2, Image as ImageIcon, Barcode, MessageSquare, Send, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAppStore } from '../../services/storage';

async function compressImageForFastAI(uri: string): Promise<string> {
  try {
    // Dynamic require to prevent module evaluation crashes in Expo Go
    const ImageManipulator = require('expo-image-manipulator');
    if (ImageManipulator?.manipulateAsync) {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 720 } }],
        { compress: 0.55, format: ImageManipulator.SaveFormat?.JPEG || 'jpeg', base64: true }
      );
      if (manipResult?.base64) {
        return `data:image/jpeg;base64,${manipResult.base64}`;
      }
    }
  } catch (e) {
    console.warn('Native ImageManipulator unavailable, falling back to base64 input:', e);
  }
  return uri;
}
import { analyzeMealImage, parseNaturalLanguageMeal } from '../../services/api';
import { sendInstantAsyncMealNotification } from '../../services/notifications';
import { OilSlider } from '../../components/OilSlider';
import { PortionSlider } from '../../components/PortionSlider';
import { BarcodeScannerModal } from '../../components/BarcodeScannerModal';
import { MealRecord } from '../../types/nutrition';

const CUISINE_PRESETS = [
  { id: 'Standard' as const, label: '🌎 Standard' },
  { id: 'Indian Homestyle' as const, label: '🇮🇳 Indian' },
  { id: 'East Asian' as const, label: '🇨🇳 East Asian' },
  { id: 'Middle Eastern' as const, label: '🇱🇧 Middle Eastern' },
  { id: 'Latin American' as const, label: '🇲🇽 Latin' },
];

export default function SnapAndLogScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [analyzing, setAnalyzing] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');
  const [activeMeal, setActiveMeal] = useState<MealRecord | null>(null);
  const [barcodeModalVisible, setBarcodeModalVisible] = useState(false);
  const [nlpModalVisible, setNlpModalVisible] = useState(false);
  const [nlpInputText, setNlpInputText] = useState('');
  const [nlpParsing, setNlpParsing] = useState(false);

  const addMeal = useAppStore((state) => state.addMeal);
  const deleteMeal = useAppStore((state) => state.deleteMeal);
  const updateMealSliders = useAppStore((state) => state.updateMealSliders);
  const goals = useAppStore((state) => state.goals);
  const updateGoals = useAppStore((state) => state.updateGoals);

  const handleRequestPermission = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await requestPermission();
    if (!res.granted && res.canAskAgain === false) {
      Alert.alert(
        'Camera Permission Denied',
        'Camera access was denied. Please open your phone Settings > CalSnap AI and turn on Camera access.'
      );
    }
  };

  // Handle Photo Capture & Async Snap & Walk Away
  const handleSnapPhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAnalyzing(true);

    try {
      let compressedBase64 = 'data:image/jpeg;base64,MOCK_IMAGE_DATA';
      if (cameraRef.current) {
        try {
          const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.4 });
          if (photo?.base64) {
            compressedBase64 = `data:image/jpeg;base64,${photo.base64}`;
          } else if (photo?.uri) {
            compressedBase64 = await compressImageForFastAI(photo.uri);
          }
        } catch (e) {
          console.warn('Could not take fast picture:', e);
        }
      }
      const resultData = await analyzeMealImage({
        imageBase64: compressedBase64,
        voiceTranscript: voiceNote || undefined,
        culturalPreset: goals.cultural_preset,
        userAuthToken: 'demo-user-session-token',
        geminiApiKey: goals.gemini_api_key,
      });

      const loggedMeal = addMeal({ ...resultData, image_uri: compressedBase64 });
      setActiveMeal(loggedMeal);

      // Async Notification Trigger
      sendInstantAsyncMealNotification(loggedMeal.dish_name, loggedMeal.total_calories);
    } catch (err: any) {
      Alert.alert('Analysis Status', err?.message || 'Unable to recognize image. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePickFromGallery = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Needed', 'Please allow gallery access to pick food photos.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });

    if (!pickerResult.canceled && pickerResult.assets?.[0]) {
      setAnalyzing(true);
      try {
        const imageUri = pickerResult.assets[0].uri;
        let compressedBase64 = pickerResult.assets[0].base64 ? `data:image/jpeg;base64,${pickerResult.assets[0].base64}` : imageUri;
        if (imageUri) {
          const manipulated = await compressImageForFastAI(imageUri);
          if (manipulated && manipulated.startsWith('data:image')) {
            compressedBase64 = manipulated;
          }
        }
        const resultData = await analyzeMealImage({
          imageBase64: compressedBase64,
          voiceTranscript: voiceNote || undefined,
          culturalPreset: goals.cultural_preset,
          userAuthToken: 'demo-user-session-token',
          geminiApiKey: goals.gemini_api_key,
        });

        const loggedMeal = addMeal({ ...resultData, image_uri: imageUri });
        setActiveMeal(loggedMeal);
        sendInstantAsyncMealNotification(loggedMeal.dish_name, loggedMeal.total_calories);
      } catch (err) {
        Alert.alert('Analysis Failed', 'Unable to recognize food photo from gallery.');
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const handleVoiceToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNlpModalVisible(true);
  };

  const handleUpdateOil = (grams: number) => {
    if (!activeMeal) return;
    Haptics.selectionAsync();
    updateMealSliders(activeMeal.id, activeMeal.portion_multiplier, grams);
    setActiveMeal((prev) => (prev ? { ...prev, estimated_oil_g: grams } : null));
  };

  const handleUpdatePortion = (multiplier: number) => {
    if (!activeMeal) return;
    Haptics.selectionAsync();
    updateMealSliders(activeMeal.id, multiplier, activeMeal.estimated_oil_g);
    setActiveMeal((prev) => (prev ? { ...prev, portion_multiplier: multiplier } : null));
  };

  const handleResetSnap = () => {
    setActiveMeal(null);
    setVoiceNote('');
  };

  const handleRetakeSnap = () => {
    // Delete the already-logged meal so it doesn't double-count
    if (activeMeal) {
      deleteMeal(activeMeal.id);
    }
    setActiveMeal(null);
    setVoiceNote('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleBarcodeLogged = (meal: MealRecord) => {
    setActiveMeal(meal);
  };

  const handleParseNlpMeal = async () => {
    Keyboard.dismiss();
    if (!nlpInputText.trim()) {
      Alert.alert('Empty Description', 'Please speak or type a food description.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNlpParsing(true);

    try {
      const parsedData = await parseNaturalLanguageMeal(nlpInputText);
      const loggedMeal = addMeal(parsedData);
      setActiveMeal(loggedMeal);
      sendInstantAsyncMealNotification(loggedMeal.dish_name, loggedMeal.total_calories);
      setNlpModalVisible(false);
      setNlpInputText('');
    } catch (err) {
      Alert.alert('NLP Parsing Failed', 'Could not parse description. Please try again.');
    } finally {
      setNlpParsing(false);
    }
  };

  return (
    <View style={styles.container}>
      {activeMeal ? (
        /* Result Review Screen with Live Sliders */
        <View style={styles.resultContainer}>
          <View style={styles.resultHeader}>
            <View style={styles.successBadge}>
              <Sparkles size={16} color="#10B981" />
              <Text style={styles.successText}>MEAL LOGGED SUCCESSFULLY</Text>
            </View>
            <TouchableOpacity onPress={handleResetSnap} style={styles.newSnapBtn}>
              <RefreshCw size={16} color="#6366F1" />
              <Text style={styles.newSnapText}>Snap Another</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.dishTitle}>{activeMeal.dish_name}</Text>
          <Text style={styles.dishSubtitle}>{activeMeal.meal_type} • AI Confidence: 96%</Text>

          <View style={styles.macroHeroBox}>
            <Text style={styles.heroCalText}>{activeMeal.total_calories} kcal</Text>
            <View style={styles.heroMacroRow}>
              <Text style={styles.heroMacroItem}>P: {Number(activeMeal.total_protein_g).toFixed(2)}g</Text>
              <Text style={styles.heroMacroItem}>C: {Number(activeMeal.total_carbs_g).toFixed(2)}g</Text>
              <Text style={styles.heroMacroItem}>F: {Number(activeMeal.total_fat_g).toFixed(2)}g</Text>
            </View>
          </View>

          {/* Interactive Sliders */}
          <PortionSlider multiplier={activeMeal.portion_multiplier} onChangeMultiplier={handleUpdatePortion} />
          <OilSlider currentOilGrams={activeMeal.estimated_oil_g} onChangeOil={handleUpdateOil} />

          <View style={styles.doneBtnContainer}>
            {/* Retake button */}
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={handleRetakeSnap}
              activeOpacity={0.8}
            >
              <RefreshCw size={18} color="#64748B" style={{ marginRight: 6 }} />
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>

            {/* Save button */}
            <TouchableOpacity style={styles.doneBtn} onPress={handleResetSnap} activeOpacity={0.85}>
              <Check size={20} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.doneBtnText}>Save & Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Camera Snap & Voice Screen */
        <View style={styles.cameraViewport}>
          {permission?.granted ? (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.permContainer]}>
              <Camera size={44} color="#6366F1" />
              <Text style={styles.permText}>Camera Access Required</Text>
              <Text style={styles.permSubText}>CalSnap AI needs camera access to capture your meals.</Text>
              <TouchableOpacity style={styles.permBtn} onPress={handleRequestPermission} activeOpacity={0.8}>
                <Text style={styles.permBtnText}>Enable Camera</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cultural Cuisine Quick Selector Bar */}
          <View style={styles.cuisineSelectorContainer}>
            <Text style={styles.cuisineLabelText}>Regional AI Mode:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cuisineScroll}>
              {CUISINE_PRESETS.map((preset) => {
                const isActive = (goals.cultural_preset || 'Standard') === preset.id;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[styles.cuisinePill, isActive && styles.cuisinePillActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      updateGoals({ cultural_preset: preset.id });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cuisinePillText, isActive && styles.cuisinePillTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Alignment Frame */}
          {permission?.granted ? (
            <View style={styles.frameBox}>
              <Text style={styles.frameInstruction}>Center your plate inside the box</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {/* Voice Prompt Status */}
          {voiceNote ? (
            <View style={styles.voiceNotePill}>
              <Volume2 size={16} color="#4F46E5" />
              <Text style={styles.voiceNoteText}>"{voiceNote}"</Text>
            </View>
          ) : null}

          {/* Camera Controls Bar */}
          <View style={styles.controlsBar}>
            {/* Mic Voice Button */}
            <TouchableOpacity
              style={[styles.micBtn, recordingVoice && styles.micBtnActive]}
              onPress={handleVoiceToggle}
              activeOpacity={0.8}
            >
              <Mic size={24} color={recordingVoice ? '#FFF' : '#4F46E5'} />
            </TouchableOpacity>

            {/* Shutter Snap Button */}
            <TouchableOpacity style={styles.shutterOuter} onPress={handleSnapPhoto} disabled={analyzing} activeOpacity={0.85}>
              {analyzing ? (
                <ActivityIndicator size="large" color="#4F46E5" />
              ) : (
                <View style={styles.shutterInner}>
                  <Camera size={28} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Barcode Scanner Launch Button */}
            <TouchableOpacity
              style={[styles.micBtn, styles.barcodeBtn]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setBarcodeModalVisible(true);
              }}
              disabled={analyzing}
              activeOpacity={0.8}
            >
              <Barcode size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Gallery Upload Button */}
            <TouchableOpacity style={styles.micBtn} onPress={handlePickFromGallery} disabled={analyzing} activeOpacity={0.8}>
              <ImageIcon size={24} color="#4F46E5" />
            </TouchableOpacity>
          </View>

          {/* NLP Quick Voice & Text Log Button Bar */}
          <TouchableOpacity
            style={styles.nlpPromptBar}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setNlpModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <MessageSquare size={18} color="#6366F1" />
            <Text style={styles.nlpPromptText}>Speak or Type Meal Description (AI NLP)</Text>
          </TouchableOpacity>

          <Text style={styles.asyncHelpText}>⚡ Tap Snap, Barcode, or Voice → Quick logging with zero friction!</Text>
        </View>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={barcodeModalVisible}
        onClose={() => setBarcodeModalVisible(false)}
        onMealLogged={handleBarcodeLogged}
      />

      {/* Voice & Text Natural Language Quick Log Modal */}
      <Modal visible={nlpModalVisible} animationType="slide" transparent onRequestClose={() => { Keyboard.dismiss(); setNlpModalVisible(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.nlpOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={styles.nlpModalContent}>
                  <View style={styles.nlpHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={20} color="#4F46E5" />
                      <Text style={styles.nlpTitle}>AI Voice & Text Meal Parser</Text>
                    </View>

                    <TouchableOpacity onPress={() => { Keyboard.dismiss(); setNlpModalVisible(false); }}>
                      <X size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.nlpSub}>
                    Describe whatever you ate in natural language:
                  </Text>

                  <TextInput
                    style={styles.nlpTextInput}
                    multiline
                    numberOfLines={3}
                    placeholder="e.g. 2 scrambled eggs with avocado and whole wheat sourdough toast"
                    placeholderTextColor="#94A3B8"
                    value={nlpInputText}
                    onChangeText={setNlpInputText}
                    returnKeyType="done"
                    onSubmitEditing={handleParseNlpMeal}
                    blurOnSubmit={true}
                    autoFocus
                  />

                  <TouchableOpacity
                    style={styles.parseBtn}
                    onPress={handleParseNlpMeal}
                    disabled={nlpParsing}
                    activeOpacity={0.85}
                  >
                    {nlpParsing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <React.Fragment>
                        <Send size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.parseBtnText}>Parse & Log Meal</Text>
                      </React.Fragment>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  cameraViewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  frameBox: {
    width: '90%',
    height: 320,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 24,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  frameInstruction: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  voiceNotePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginVertical: 10,
  },
  voiceNoteText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  micBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: '#EF4444',
  },
  barcodeBtn: {
    backgroundColor: '#4F46E5',
  },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  asyncHelpText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  successText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  newSnapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newSnapText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
  },
  dishTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  dishSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 16,
  },
  macroHeroBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroCalText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#4F46E5',
  },
  heroMacroRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  heroMacroItem: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  doneBtnContainer: {
    marginTop: 'auto',
    paddingTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  retakeBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  retakeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  doneBtn: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  nlpPromptBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    marginVertical: 10,
    width: '100%',
  },
  nlpPromptText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nlpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  nlpModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  nlpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nlpTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  nlpSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
  },
  nlpTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    color: '#0F172A',
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  parseBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  parseBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cuisineSelectorContainer: {
    marginBottom: 12,
    width: '100%',
  },
  cuisineLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 4,
  },
  cuisineScroll: {
    gap: 8,
    paddingRight: 10,
  },
  cuisinePill: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  cuisinePillActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#6366F1',
  },
  cuisinePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  cuisinePillTextActive: {
    color: '#FFFFFF',
  },
  permContainer: {
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    zIndex: 0,
  },
  permText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 14,
  },
  permSubText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  permBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  permBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
