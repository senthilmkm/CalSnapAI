import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { useAppStore } from '../services/storage';

const REVENUECAT_PUBLIC_KEY = 'appl_ESiuNWKJXRZSzKvlrDYqeSWTfZp';

export default function RootLayout() {
  const setProfile = useAppStore((state) => state.setProfile);

  useEffect(() => {
    // Configure RevenueCat on Native iOS platform
    if (Platform.OS === 'ios') {
      try {
        Purchases.configure({ apiKey: REVENUECAT_PUBLIC_KEY });

        // Listen for subscription status updates
        Purchases.addCustomerInfoUpdateListener((info) => {
          const isPro = typeof info.entitlements.active['pro_access'] !== 'undefined';
          setProfile({ is_pro_subscriber: isPro });
        });
      } catch (e) {
        console.warn('RevenueCat SDK Initialization Warning:', e);
      }
    }
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
