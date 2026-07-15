import { useEffect, useState, useRef } from 'react';
import { View, Image, Text, StyleSheet, StatusBar } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { seedQuizzesIfEmpty } from '@/services/seedService';
import { Colors, FontFamily } from '@/constants/theme';
import { Routes } from '@/constants/routes';

function AuthGate() {
  const { user, loading, userDataLoading, onboarded, onboardingChecked } = useAuth();
  const router = useRouter();
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const navigatedRef = useRef(false);

  // 8s safety-net — if auth hangs, force into the app
  useEffect(() => {
    const timer = setTimeout(() => setAuthTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  const waiting = loading || userDataLoading || !onboardingChecked;
  const ready = !waiting || authTimedOut;

  useEffect(() => {
    if (!ready || navigatedRef.current) return;

    if (!user) {
      navigatedRef.current = true;
      router.replace(Routes.LOGIN);
      return;
    }

    if (user.isAnonymous) {
      navigatedRef.current = true;
      router.replace(Routes.LOGIN);
      return;
    }

    if (!onboarded) {
      navigatedRef.current = true;
      router.replace(Routes.ONBOARDING);
      return;
    }

    navigatedRef.current = true;
    router.replace(Routes.HOME);
  }, [ready, user, onboarded, router]);

  return (
    <>
      <Slot />
      {waiting && (
        <View style={styles.splash} pointerEvents="none">
          <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
          <Image
            source={require('../../assets/logo.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
          <Text style={styles.splashText}>KatolikGo</Text>
          <Text style={styles.splashSub}>Memuatkan…</Text>
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    seedQuizzesIfEmpty().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  splashLogo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  splashText: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
    marginBottom: 8,
  },
  splashSub: {
    fontSize: 14,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
});
