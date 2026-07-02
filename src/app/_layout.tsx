import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { seedQuizzesIfEmpty } from '@/services/seedService';

function AuthGate() {
  const {
    user,
    loading,
    userDataLoading,
    onboarded,
    onboardingChecked,
  } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || userDataLoading || !onboardingChecked) return;

    // Detect the current screen via pathname (URL with layout-group parens
    // stripped). Don't rely on `segments[0] === '(auth)'` — in expo-router
    // v6 the layout-group identifier doesn't always survive in segments
    // and the check is silently false, which previously wedged users on
    // the login screen after a successful sign-in.
    const inAuthGroup = pathname === '/login' || pathname === '/register';
    const isOnboarding = pathname === '/onboarding';

    if (isOnboarding) {
      // Authenticated users and already-onboarded users should never replay
      // the intro slides. Push them to where they actually belong.
      if (user) {
        router.replace('/(tabs)/index');
      } else if (onboarded) {
        router.replace('/(auth)/login');
      }
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
  }, [user, loading, userDataLoading, onboardingChecked, onboarded, pathname, router]);

  if (loading || userDataLoading || !onboardingChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    // Layout groups `(auth)` / `(tabs)` are auto-discovered. We only register
    // explicit Stack.Screen entries for routes that need options or that we
    // want to be reachable as the literal Stack name. The root URL itself
    // is served by `(tabs)/index.tsx`.
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="quiz/[level]" />
      <Stack.Screen name="quiz/result" />
      {/* `(auth)` and `(tabs)` are layout groups — auto-discovered from the
          file system, never registered as Stack.Screen (parens-prefixed name
          vs. normalized URL causes "Unmatched Route" at `/`). */}
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
