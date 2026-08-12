import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X, Check, Zap, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useAppStore } from '../services/storage';
import pricingConfig from '../config/pricing.json';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ visible, onClose }) => {
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>(
    pricingConfig.annual?.enabled ? 'annual' : 'monthly'
  );
  const signInWithApple = useAppStore((state) => state.signInWithApple);

  const handleStartTrial = () => {
    signInWithApple('pro.user@apple.com');
    onClose();
  };

  const isAnnualEnabled = pricingConfig.annual?.enabled ?? true;
  const isMonthlyEnabled = pricingConfig.monthly?.enabled ?? true;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Close Button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <X size={24} color="#64748B" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Dynamic Header Badge from pricing.json */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Sparkles size={14} color="#6366F1" />
              <Text style={styles.badgeText}>{pricingConfig.banner_text}</Text>
            </View>
          </View>

          <Text style={styles.headline}>Unlock CalSnap AI Pro</Text>
          <Text style={styles.subheadline}>
            Zero-friction food logging, weekly calorie banking, and interactive portion sliders.
          </Text>

          {/* Pro Feature Checklist (Dynamic from pricing.json) */}
          <View style={styles.featuresCard}>
            <Text style={styles.featuresTitle}>What's Included in Pro:</Text>
            {pricingConfig.paywall_features.map((feat, idx) => (
              <View key={idx} style={styles.featureRow}>
                <View style={styles.checkIconWrapper}>
                  <Check size={14} color="#10B981" />
                </View>
                <Text style={styles.featureText}>{feat}</Text>
              </View>
            ))}
          </View>

          {/* Dynamic Pricing Selection from pricing.json */}
          <View style={styles.plansContainer}>
            {/* Annual Option */}
            {isAnnualEnabled && (
              <TouchableOpacity
                style={[styles.planCard, selectedPlan === 'annual' && styles.selectedPlanCard]}
                onPress={() => setSelectedPlan('annual')}
                activeOpacity={0.9}
              >
                <View style={styles.savingsTag}>
                  <Text style={styles.savingsTagText}>{pricingConfig.annual.savings_badge} (RECOMMENDED)</Text>
                </View>

                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planTitle}>Yearly Access</Text>
                    <Text style={styles.planSubtitle}>
                      {pricingConfig.annual.display_price} {pricingConfig.annual.period} ({pricingConfig.annual.monthly_equivalent})
                    </Text>
                  </View>
                  <View style={[styles.radioCircle, selectedPlan === 'annual' && styles.selectedRadio]}>
                    {selectedPlan === 'annual' && <Check size={14} color="#FFF" />}
                  </View>
                </View>
                <Text style={styles.trialNote}>Includes {pricingConfig.annual.trial_days}-Day Free Trial ($0 today)</Text>
              </TouchableOpacity>
            )}

            {/* Monthly Option */}
            {isMonthlyEnabled && (
              <TouchableOpacity
                style={[styles.planCard, selectedPlan === 'monthly' && styles.selectedPlanCard]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.9}
              >
                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planTitle}>Monthly Plan</Text>
                    <Text style={styles.planSubtitle}>
                      {pricingConfig.monthly.display_price} {pricingConfig.monthly.period}
                    </Text>
                  </View>
                  <View style={[styles.radioCircle, selectedPlan === 'monthly' && styles.selectedRadio]}>
                    {selectedPlan === 'monthly' && <Check size={14} color="#FFF" />}
                  </View>
                </View>
                <Text style={styles.trialNote}>Cancel anytime in Settings</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Main CTA */}
          <TouchableOpacity style={styles.ctaBtn} onPress={handleStartTrial} activeOpacity={0.85}>
            <Zap size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.ctaText}>
              Start My {selectedPlan === 'annual' ? pricingConfig.annual.trial_days : pricingConfig.monthly.trial_days}-Day Free Trial — $0.00
            </Text>
          </TouchableOpacity>

          <View style={styles.guaranteeRow}>
            <ShieldCheck size={16} color="#10B981" />
            <Text style={styles.guaranteeText}>No commitment. Cancel anytime in 1 tap.</Text>
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
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  featuresCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  checkIconWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
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
    gap: 6,
  },
  guaranteeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
