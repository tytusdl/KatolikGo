import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { seedQuizzesIfEmpty } from '@/services/seedService';
import { hasOnboarded } from '@/utils/onboarding';

function AuthGate() {
  const { user, loading, userDataLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  // Load the onboarding-completed flag exactly once on cold start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const done = await hasOnboarded();
      if (!cancelled) setOnboarded(done);
      if (!cancelled) setOnboardingChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || userDataLoading || !onboardingChecked) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isOnboarding = segments[0] === 'onboarding';

    if (isOnboarding) {
      // Authenticated users should never see the onboarding flow — push
      // them to the main app even if they somehow landed here.
      if (user) router.replace('/(tabs)/index');
      return;
    }

    if (user) {
      // Authenticated users always go to the main app, regardless of
      // whether they finished onboarding.
      if (inAuthGroup) router.replace('/(tabs)/index');
      return;
    }

    // Unauthenticated paths:
    //   - returning users who've seen onboarding → login
    //   - first-time users                       → onboarding
    if (!inAuthGroup) {
      router.replace(onboarded ? '/(auth)/login' : '/onboarding');
    }
  }, [user, loading, userDataLoading, onboardingChecked, onboarded, segments, router]);

  if (loading || userDataLoading || !onboardingChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="quiz/[level]" />
      <Stack.Screen name="quiz/result" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    seedQuizzesIfEmpty();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
