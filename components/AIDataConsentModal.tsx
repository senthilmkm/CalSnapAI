import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import { ShieldCheck, Cpu, Camera, Mic, FileText, Lock, ExternalLink, CheckCircle2, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface AIDataConsentModalProps {
  visible: boolean;
  onAgree: () => void;
  onDecline: () => void;
}

const PRIVACY_POLICY_URL = 'https://senthilmkm.github.io/CalSnapAI/privacy.html';

export const AIDataConsentModal: React.FC<AIDataConsentModalProps> = ({ visible, onAgree, onDecline }) => {
  const handleOpenPrivacyPolicy = async () => {
    try {
      const supported = await Linking.canOpenURL(PRIVACY_POLICY_URL);
      if (supported) {
        await Linking.openURL(PRIVACY_POLICY_URL);
      } else {
        Alert.alert('Privacy Policy', `Visit our privacy policy online at: ${PRIVACY_POLICY_URL}`);
      }
    } catch {
      Alert.alert('Privacy Policy', `Visit our privacy policy online at: ${PRIVACY_POLICY_URL}`);
    }
  };

  const handleAgreePress = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAgree();
  };

  const handleDeclinePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDecline();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDecline}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.topHeader}>
          <View style={styles.badge}>
            <ShieldCheck size={16} color="#4F46E5" />
            <Text style={styles.badgeText}>Data Privacy & Protection</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={handleDeclinePress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.headline}>AI Data Sharing Disclosure</Text>
          <Text style={styles.subheadline}>
            Before analyzing your meals, please review and grant permission for how your data is processed.
          </Text>

          {/* Section 1: What Data is Sent */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeaderRow}>
              <Cpu size={18} color="#4F46E5" />
              <Text style={styles.cardTitle}>1. What Data is Sent</Text>
            </View>
            <View style={styles.dataItem}>
              <Camera size={16} color="#10B981" style={styles.itemIcon} />
              <View style={styles.itemTextGroup}>
                <Text style={styles.itemTitle}>Food Photos & Images</Text>
                <Text style={styles.itemSub}>Images captured via camera or selected from photo library.</Text>
              </View>
            </View>
            <View style={styles.dataItem}>
              <Mic size={16} color="#F59E0B" style={styles.itemIcon} />
              <View style={styles.itemTextGroup}>
                <Text style={styles.itemTitle}>Voice Transcripts & Audio Notes</Text>
                <Text style={styles.itemSub}>Spoken meal descriptions recorded for quick logging.</Text>
              </View>
            </View>
            <View style={styles.dataItem}>
              <FileText size={16} color="#6366F1" style={styles.itemIcon} />
              <View style={styles.itemTextGroup}>
                <Text style={styles.itemTitle}>Text Meal Entries</Text>
                <Text style={styles.itemSub}>Custom food names, portion sizes, or ingredient notes.</Text>
              </View>
            </View>
          </View>

          {/* Section 2: Who Data is Sent To */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeaderRow}>
              <Cpu size={18} color="#059669" />
              <Text style={styles.cardTitle}>2. Third-Party AI Provider</Text>
            </View>
            <Text style={styles.cardText}>
              Your data is transmitted securely to <Text style={styles.boldText}>Google Gemini AI</Text> (via encrypted HTTPS endpoints) to recognize ingredients, estimate weight, and compute calories & macro values.
            </Text>
          </View>

          {/* Section 3: Data Protection Commitments */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeaderRow}>
              <Lock size={18} color="#4F46E5" />
              <Text style={styles.cardTitle}>3. Privacy & Security Guarantees</Text>
            </View>
            <View style={styles.checkItem}>
              <CheckCircle2 size={16} color="#10B981" />
              <Text style={styles.checkText}>Transmitted over encrypted HTTPS (TLS 1.3).</Text>
            </View>
            <View style={styles.checkItem}>
              <CheckCircle2 size={16} color="#10B981" />
              <Text style={styles.checkText}><Text style={styles.boldText}>Zero AI Training:</Text> Your data is NOT used to train public AI models.</Text>
            </View>
            <View style={styles.checkItem}>
              <CheckCircle2 size={16} color="#10B981" />
              <Text style={styles.checkText}>Data is processed ephemerally and never sold to third parties.</Text>
            </View>
          </View>

          {/* Privacy Policy Link */}
          <TouchableOpacity style={styles.privacyLinkBtn} onPress={handleOpenPrivacyPolicy} activeOpacity={0.8}>
            <Text style={styles.privacyLinkText}>Read full CalSnap AI Privacy Policy</Text>
            <ExternalLink size={14} color="#4F46E5" />
          </TouchableOpacity>

          {/* Action Buttons */}
          <TouchableOpacity style={styles.agreeBtn} onPress={handleAgreePress} activeOpacity={0.85}>
            <ShieldCheck size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.agreeBtnText}>Allow & Continue to AI Analysis</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.declineBtn} onPress={handleDeclinePress} activeOpacity={0.7}>
            <Text style={styles.declineBtnText}>Decline (Disable AI Analysis)</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headline: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
  },
  subheadline: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  boldText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  itemIcon: {
    marginTop: 2,
  },
  itemTextGroup: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  itemSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  checkText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  privacyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 14,
    paddingVertical: 6,
  },
  privacyLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
    textDecorationLine: 'underline',
  },
  agreeBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 10,
  },
  agreeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  declineBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
});
