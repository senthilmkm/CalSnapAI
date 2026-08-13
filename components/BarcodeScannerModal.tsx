import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Barcode, X, RefreshCw, Check, Sparkles, ShieldCheck, Globe, Zap, Flashlight, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { fetchProductByBarcode } from '../services/barcode';
import { useAppStore } from '../services/storage';
import { BarcodeProduct, MealRecord } from '../types/nutrition';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onMealLogged?: (meal: MealRecord) => void;
}

export function BarcodeScannerModal({ visible, onClose, onMealLogged }: BarcodeScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<BarcodeProduct | null>(null);
  const [customCalorieInput, setCustomCalorieInput] = useState<string>('');

  const addMeal = useAppStore((state) => state.addMeal);

  const handleToggleTorch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTorchEnabled((prev) => !prev);
  };

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const product = await fetchProductByBarcode(result.data);
      setScannedProduct(product);
      setCustomCalorieInput(String(product.calories));
    } catch (err) {
      Alert.alert('Scan Failed', 'Could not retrieve product info. Please try again.');
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogProduct = () => {
    if (!scannedProduct) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const activeCals = Math.max(0, parseInt(customCalorieInput, 10) || scannedProduct.calories);

    const mealData: Omit<MealRecord, 'id' | 'timestamp'> = {
      dish_name: scannedProduct.product_name,
      meal_type: 'Snack',
      items: [
        {
          id: `item-${Date.now()}`,
          name: scannedProduct.product_name,
          weight_g: 100,
          calories: activeCals,
          protein_g: scannedProduct.protein_g,
          carbs_g: scannedProduct.carbs_g,
          fat_g: scannedProduct.fat_g,
        },
      ],
      estimated_oil_g: 0,
      portion_multiplier: 1.0,
      total_calories: activeCals,
      total_protein_g: scannedProduct.protein_g,
      total_carbs_g: scannedProduct.carbs_g,
      total_fat_g: scannedProduct.fat_g,
      glucose_impact_score: scannedProduct.protein_g >= 12 ? 'LOW' : 'MEDIUM',
      energy_crash_risk: scannedProduct.protein_g >= 12 ? 'VERY_LOW' : 'LOW',
      ai_tip: scannedProduct.is_fallback
        ? `Logged via Smart Fallback for ${scannedProduct.brand}. Complete nutritional profile.`
        : `Verified product from OpenFoodFacts database (${scannedProduct.brand}).`,
      image_uri: scannedProduct.image_url,
    };

    const newMeal = addMeal(mealData);
    if (onMealLogged) {
      onMealLogged(newMeal);
    }

    handleReset();
    onClose();
  };

  const handleReset = () => {
    setScanned(false);
    setLoading(false);
    setScannedProduct(null);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Barcode size={22} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Native Barcode Scanner</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              style={[styles.closeBtn, torchEnabled && { backgroundColor: '#4F46E5' }]}
              onPress={handleToggleTorch}
              activeOpacity={0.7}
            >
              <Flashlight size={18} color={torchEnabled ? '#FFFFFF' : 'rgba(255,255,255,0.7)'} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Viewport */}
        {scannedProduct ? (
          /* Scanned Product Result Review Card */
          <View style={styles.resultContainer}>
            <View style={styles.productBadgeRow}>
              {scannedProduct.is_fallback ? (
                <View style={styles.fallbackBadge}>
                  <Zap size={14} color="#D97706" />
                  <Text style={styles.fallbackBadgeText}>Smart Offline Fallback</Text>
                </View>
              ) : (
                <View style={styles.openFoodBadge}>
                  <Globe size={14} color="#0284C7" />
                  <Text style={styles.openFoodBadgeText}>OpenFoodFacts Public Database</Text>
                </View>
              )}

              <TouchableOpacity style={styles.rescanBtn} onPress={handleReset}>
                <RefreshCw size={14} color="#6366F1" />
                <Text style={styles.rescanText}>Scan Next</Text>
              </TouchableOpacity>
            </View>

            {/* Product Image & Info */}
            <View style={styles.productHero}>
              {scannedProduct.image_url ? (
                <Image source={{ uri: scannedProduct.image_url }} style={styles.productImg} resizeMode="contain" />
              ) : (
                <View style={styles.productImgPlaceholder}>
                  <Barcode size={32} color="#4F46E5" />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.brandText}>{scannedProduct.brand}</Text>
                <Text style={styles.productTitle}>{scannedProduct.product_name}</Text>
                <Text style={styles.servingText}>Serving: {scannedProduct.serving_size}</Text>
                <Text style={styles.barcodeText}>UPC/EAN: {scannedProduct.barcode}</Text>
              </View>
            </View>

            {scannedProduct.is_incomplete && (
              <View style={styles.incompleteCallout}>
                <AlertCircle size={15} color="#D97706" />
                <Text style={styles.incompleteText}>
                  Nutritional data incomplete. Tap calorie number below to adjust:
                </Text>
              </View>
            )}

            {/* Macro Summary Hero */}
            <View style={styles.macroBox}>
              <View style={styles.inlineCalRow}>
                <TextInput
                  style={styles.macroCalInput}
                  value={customCalorieInput}
                  onChangeText={setCustomCalorieInput}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  maxLength={5}
                />
                <Text style={styles.macroCalUnit}>kcal</Text>
              </View>
              <Text style={styles.macroCalSubLabel}>Per Serving (Tap to edit)</Text>

              <View style={styles.macroGrid}>
                <View style={styles.macroCol}>
                  <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.macroLabel}>Protein</Text>
                  <Text style={styles.macroVal}>{scannedProduct.protein_g}g</Text>
                </View>

                <View style={styles.macroCol}>
                  <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.macroLabel}>Carbs</Text>
                  <Text style={styles.macroVal}>{scannedProduct.carbs_g}g</Text>
                </View>

                <View style={styles.macroCol}>
                  <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.macroLabel}>Fat</Text>
                  <Text style={styles.macroVal}>{scannedProduct.fat_g}g</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionFooter}>
              <TouchableOpacity style={styles.logBtn} onPress={handleLogProduct} activeOpacity={0.85}>
                <Check size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.logBtnText}>Log to Daily Journal</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Live Camera Viewfinder */
          <View style={styles.cameraWrapper}>
            {!permission ? (
              <View style={styles.permissionBox}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.permText}>Checking camera permissions...</Text>
              </View>
            ) : !permission.granted ? (
              <View style={styles.permissionBox}>
                <Text style={styles.permTitle}>Camera Access Needed</Text>
                <Text style={styles.permSub}>
                  CalSnapAI needs camera access to scan food product barcodes.
                </Text>
                <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                  <Text style={styles.grantBtnText}>Grant Permission</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torchEnabled}
                barcodeScannerSettings={{
                  barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128'],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              >
                {/* Viewfinder Target Reticle Overlay */}
                <View style={styles.overlay}>
                  <View style={styles.reticleFrame}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />

                    {loading ? (
                      <View style={styles.loadingReticle}>
                        <ActivityIndicator size="large" color="#6366F1" />
                        <Text style={styles.loadingReticleText}>Fetching OpenFoodFacts...</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.reticleHint}>
                    Align barcode inside frame • Supports EAN, UPC & QR
                  </Text>

                  <View style={styles.freeBadge}>
                    <ShieldCheck size={14} color="#10B981" />
                    <Text style={styles.freeBadgeText}>100% Free • OpenFoodFacts Database</Text>
                  </View>
                </View>
              </CameraView>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#0F172A',
    zIndex: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  permSub: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  permText: {
    color: '#94A3B8',
    marginTop: 12,
  },
  grantBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  reticleFrame: {
    width: 280,
    height: 200,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#6366F1',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  loadingReticle: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  loadingReticleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reticleHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  freeBadgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    justifyContent: 'space-between',
  },
  productBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  openFoodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  openFoodBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
  },
  fallbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fallbackBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rescanText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
  },
  productHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 16,
  },
  productImg: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  productImgPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
    textTransform: 'uppercase',
  },
  productTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  servingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  barcodeText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  incompleteCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  incompleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
  },
  macroBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inlineCalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  macroCalInput: {
    fontSize: 24,
    fontWeight: '900',
    color: '#4F46E5',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
    textAlign: 'center',
    minWidth: 80,
  },
  macroCalUnit: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4F46E5',
  },
  macroCalSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
    marginBottom: 12,
  },
  macroCalText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#4F46E5',
  },
  macroCalLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 14,
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  macroCol: {
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  macroVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  actionFooter: {
    paddingTop: 16,
  },
  logBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  logBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
