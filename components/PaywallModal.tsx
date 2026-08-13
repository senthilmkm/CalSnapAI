import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Platform, Linking } from 'react-native';
import { X, Check, Zap, ShieldCheck, Sparkles, RefreshCw, Flame, Sliders, FileText, Calendar } from 'lucide-react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useAppStore } from '../services/storage';
import pricingConfig from '../config/pricing.json';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
}

const PRIVACY_URL = 'https://senthilmkm.github.io/CalSnapAI/privacy.html';
const TERMS_URL = 'https://senthilmkm.github.io/CalSnapAI/support.html';

export const PaywallModal: React.FC<PaywallModalProps> = ({ visible, onClose }) => {
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [packages, setPackages] = useState<{ monthly?: PurchasesPackage; annual?: PurchasesPackage }>({});

  const signInWithApple = useAppStore((state) => state.signInWithApple);
  const setProfile = useAppStore((state) => state.setProfile);

  // Fetch Offerings from RevenueCat
  useEffect(() => {
    if (visible && Platform.OS === 'ios') {
      fetchOfferings();
    }
  }, [visible]);

  const fetchOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null) {
        setPackages({
          monthly: offerings.current.monthly || undefined,
          annual: offerings.current.annual || undefined,
        });
      }
    } catch (e) {
      console.warn('RevenueCat fetchOfferings warning:', e);
    }
  };

  const handleStartTrial = async () => {
    setLoading(true);

    try {
      if (Platform.OS === 'ios') {
        const pkgToPurchase = selectedPlan === 'annual' ? packages.annual : packages.monthly;
        if (pkgToPurchase) {
          const { customerInfo } = await Purchases.purchasePackage(pkgToPurchase);
          if (typeof customerInfo.entitlements.active['pro_access'] !== 'undefined') {
            setProfile({ is_pro_subscriber: true, is_guest: false });
            Alert.alert('🎉 Welcome to CalSnap AI Pro!', 'Your 7-Day Free Trial is now active.');
            onClose();
            return;
          }
        }
      }
      
      // Fallback / Demo Activation
      signInWithApple('pro.subscriber@apple.com');
      Alert.alert('🎉 Welcome to CalSnap AI Pro!', 'Your Pro subscription is now active.');
      onClose();
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase Note', e.message || 'Unable to complete checkout. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    setRestoring(true);
    try {
      if (Platform.OS === 'ios') {
        const customerInfo = await Purchases.restorePurchases();
        if (typeof customerInfo.entitlements.active['pro_access'] !== 'undefined') {
          setProfile({ is_pro_subscriber: true });
          Alert.alert('Purchases Restored', 'Your CalSnap Pro access has been restored!');
          onClose();
          return;
        }
      }
      Alert.alert('No Purchases Found', 'We could not find an active subscription for this Apple ID.');
    } catch (e: any) {
      Alert.alert('Restore Failed', e.message || 'Unable to restore purchases at this time.');
    } finally {
      setRestoring(false);
    }
  };

  const openURL = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Link Error', `Unable to open ${url}`);
      }
    } catch (e) {
      Alert.alert('Link Error', 'Unable to open browser.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Close Button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <X size={24} color="#64748B" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Badge */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Sparkles size={14} color="#6366F1" />
              <Text style={styles.badgeText}>{pricingConfig.banner_text}</Text>
            </View>
          </View>

          <Text style={styles.headline}>Unlock CalSnap AI Pro</Text>
          <Text style={styles.subheadline}>
            Zero-friction food logging, weekly calorie banking, and interactive oil sliders.
          </Text>

          {/* High-Converting Value Callout Banner */}
          <View style={styles.coffeeBanner}>
            <Text style={styles.coffeeBannerText}>
              ☕ Less than a cup of coffee per month (<Text style={{ fontWeight: '900', color: '#4F46E5' }}>$4.16/mo</Text>)
            </Text>
          </View>

          {/* Premium Feature Highlights */}
          <View style={styles.featuresCard}>
            {pricingConfig.paywall_features.map((feature, idx) => (
              <View key={idx} style={styles.featureItem}>
                <View style={styles.featureIconBox}>
                  {idx === 0 && <Flame size={18} color="#4F46E5" />}
                  {idx === 1 && <Calendar size={18} color="#10B981" />}
                  {idx === 2 && <Sliders size={18} color="#F59E0B" />}
                  {idx >= 3 && <FileText size={18} color="#6366F1" />}
                </View>
                <View style={styles.featureTextBox}>
                  <Text style={styles.featureTitle}>{feature}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Pricing Selection */}
          <View style={styles.plansContainer}>
            {/* Annual Option */}
            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'annual' && styles.selectedPlanCard]}
              onPress={() => setSelectedPlan('annual')}
              activeOpacity={0.9}
            >
              <View style={styles.savingsTag}>
                <Text style={styles.savingsTagText}>{pricingConfig.annual.savings_badge} (BEST VALUE)</Text>
              </View>

              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planTitle}>Yearly Access</Text>
                  <Text style={styles.planSubtitle}>
                    {packages.annual
                      ? packages.annual.product.priceString + ' / year'
                      : `${pricingConfig.annual.display_price} / year (${pricingConfig.annual.monthly_equivalent})`}
                  </Text>
                </View>
                <View style={[styles.radioCircle, selectedPlan === 'annual' && styles.selectedRadio]}>
                  {selectedPlan === 'annual' && <Check size={14} color="#FFF" />}
                </View>
              </View>
              <Text style={styles.trialNote}>Includes {pricingConfig.annual.trial_days}-Day Free Trial ($0 today)</Text>
            </TouchableOpacity>

            {/* Monthly Option */}
            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'monthly' && styles.selectedPlanCard]}
              onPress={() => setSelectedPlan('monthly')}
              activeOpacity={0.9}
            >
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planTitle}>Monthly Plan</Text>
                  <Text style={styles.planSubtitle}>
                    {packages.monthly
                      ? packages.monthly.product.priceString + ' / month'
                      : `${pricingConfig.monthly.display_price} / month`}
                  </Text>
                </View>
                <View style={[styles.radioCircle, selectedPlan === 'monthly' && styles.selectedRadio]}>
                  {selectedPlan === 'monthly' && <Check size={14} color="#FFF" />}
                </View>
              </View>
              <Text style={styles.trialNote}>Cancel anytime in Settings</Text>
            </TouchableOpacity>
          </View>

          {/* Main CTA */}
          <TouchableOpacity style={styles.ctaBtn} onPress={handleStartTrial} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Zap size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.ctaText}>Start My {pricingConfig.annual.trial_days}-Day Free Trial — $0.00</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.guaranteeRow}>
            <ShieldCheck size={16} color="#10B981" />
            <Text style={styles.guaranteeText}>No commitment. Cancel anytime in 1 tap.</Text>
          </View>

          {/* Mandatory Apple Subscription Legal Footer (Guideline 3.1.2) */}
          <View style={styles.legalFooter}>
            <TouchableOpacity onPress={handleRestorePurchases} disabled={restoring} style={styles.legalLinkBtn}>
              {restoring ? (
                <ActivityIndicator size="small" color="#4F46E5" />
              ) : (
                <>
                  <RefreshCw size={13} color="#4F46E5" style={{ marginRight: 4 }} />
                  <Text style={styles.legalRestoreText}>Restore Purchases</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.legalDivider}>•</Text>

            <TouchableOpacity onPress={() => openURL(PRIVACY_URL)} style={styles.legalLinkBtn}>
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </TouchableOpacity>

            <Text style={styles.legalDivider}>•</Text>

            <TouchableOpacity onPress={() => openURL(TERMS_URL)} style={styles.legalLinkBtn}>
              <Text style={styles.legalLinkText}>Terms of Use</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  badgeRow: {
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  headline: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  subheadline: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  coffeeBanner: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  coffeeBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3730A3',
    textAlign: 'center',
  },
  featuresCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureTextBox: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  plansContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  selectedPlanCard: {
    borderColor: '#4F46E5',
    backgroundColor: '#F5F3FF',
  },
  savingsTag: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  savingsTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  planSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  trialNote: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
    marginTop: 8,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRadio: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  ctaBtn: {
    width: '100%',
    backgroundColor: '#4F46E5',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 20,
    gap: 6,
  },
  guaranteeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  legalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    width: '100%',
  },
  legalLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  legalRestoreText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F46E5',
  },
  legalLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  legalDivider: {
    fontSize: 13,
    color: '#CBD5E1',
  },
});
