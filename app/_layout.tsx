import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAppStore } from '../services/storage';

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const profile = useAppStore((state) => state.profile);
  const [unlocked, setUnlocked] = useState<boolean>(!profile?.biometric_lock_enabled);

  const triggerBiometricUnlock = async () => {
    try {
      const LocalAuthentication = require('expo-local-authentication');
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock CalSnap AI Journal',
        fallbackLabel: 'Use Passcode',
      });
      if (res.success) {
        setUnlocked(true);
      }
    } catch {
      setUnlocked(true);
    }
  };

  useEffect(() => {
    if (profile?.biometric_lock_enabled && !unlocked) {
      triggerBiometricUnlock();
    }
  }, [profile?.biometric_lock_enabled]);

  if (profile?.biometric_lock_enabled && !unlocked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 }}>CalSnap AI Locked</Text>
        <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 32 }}>
          Face ID / Touch ID authentication is required to access your nutrition journal.
        </Text>
        <TouchableOpacity
          onPress={triggerBiometricUnlock}
          style={{ backgroundColor: '#4F46E5', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Unlock with Face ID</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
