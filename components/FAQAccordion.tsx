import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react-native';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: "How accurate is CalSnap AI's calorie estimation?",
    answer: "CalSnap AI uses Google's multimodal Gemini 2.0 Flash API to recognize food items and recipes zero-shot. In addition, our live Portion and Cooking Oil sliders let you fine-tune the meal in 1 swipe for 100% precision.",
  },
  {
    question: "What is Weekly Calorie Banking?",
    answer: "Calorie Banking lets you save 150-300 kcal on weekdays so you can enjoy weekend meals or dining out with zero guilt and without ruining your streak.",
  },
  {
    question: "Does CalSnap AI work for regional or home-cooked dishes?",
    answer: "Yes! CalSnap AI is trained on global food datasets (Indian, East Asian, Middle Eastern, Latin American, European, African) and accounts for home-style cooking oils and spices.",
  },
  {
    question: "How is my photo data & privacy protected?",
    answer: "Photos are processed via secure serverless edge functions for nutrition calculation only. We never sell, store, or share your food photos or personal health data with third parties.",
  },
  {
    question: "How do I export my data for my doctor or coach?",
    answer: "Navigate to the Insights tab and tap 'Export PDF Report' or 'Export CSV' to generate a shareable document via the native iOS share sheet.",
  },
  {
    question: "How do I manage or cancel my subscription?",
    answer: "Tap 'Manage Subscription' in the Settings tab to open your official Apple ID subscription settings on iOS. You can cancel anytime in 1 tap.",
  },
];

export const FAQAccordion: React.FC = () => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <HelpCircle size={18} color="#4F46E5" />
        <Text style={styles.title}>Frequently Asked Questions</Text>
      </View>

      {FAQS.map((faq, index) => {
        const isOpen = expandedIndex === index;
        return (
          <View key={index} style={styles.faqCard}>
            <TouchableOpacity style={styles.questionBtn} onPress={() => toggleExpand(index)} activeOpacity={0.7}>
              <Text style={styles.questionText}>{faq.question}</Text>
              {isOpen ? <ChevronUp size={18} color="#4F46E5" /> : <ChevronDown size={18} color="#94A3B8" />}
            </TouchableOpacity>

            {isOpen && <Text style={styles.answerText}>{faq.answer}</Text>}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  questionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    paddingRight: 10,
  },
  answerText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 2,
  },
});
