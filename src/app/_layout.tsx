import '../global.css';
import { useEffect, useRef, useState } from 'react';
import { Slot, useRouter, usePathname } from 'expo-router';
import { ActivityIndicator, Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Colors, FontSize, Spacing } from '@/constants/theme';
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
  const [imageFailed, setImageFailed] = useState(false);

  // Track the user we saw on the previous effect run so we can detect
  // mid-session sign-in transitions (null → anon, null → registered).
  // On the very first run after mount, `isFirstRoutingRun` is true —
  // cold-start session restore looks like a null → non-null flip too,
  // and we don't want to "kick" the user from /home to /home on mount.
  const prevUserRef = useRef<typeof user>(null);
  const isFirstRoutingRun = useRef(true);

  useEffect(() => {
    // Wait until auth and onboarding flag have settled so the redirect
    // decision is based on real state, not initial defaults.
    if (loading || userDataLoading || !onboardingChecked) return;

    // Snapshot + advance the prev-state refs up front so they accurately
    // reflect the previous effect run regardless of which branch we
    // take below.
    const prevUser = prevUserRef.current;
    const firstRun = isFirstRoutingRun.current;
    isFirstRoutingRun.current = false;
    prevUserRef.current = user;

    // Layout-group parens are stripped from the pathname in expo-router v6,
    // so we can use it directly to decide which screen we're on.
    const inAuthGroup = pathname === '/login' || pathname === '/register';
    const isOnboarding = pathname === '/onboarding';

    if (isOnboarding) {
      // Returning users and authenticated users should never replay the
      // intro slides. Push them to where they actually belong.
      if (user) {
        router.replace('/(tabs)/index');
      } else if (onboarded) {
        router.replace('/(auth)/login');
      }
      return;
    }

    // Mid-session sign-in (register / login / "Terus sebagai Tetamu"):
    // user went null → non-null while the app was already running, and
    // they're still sitting on the auth screen where the action happened.
    // Land them on home regardless of whether `user.isAnonymous` is true
    // or false — covers both anonymous guest sign-in AND register/login
    // flips from null user.
    //
    // Cold-start persistence restore sees `user` go null → non-null too,
    // but we ignore those via `firstRun` so a user opening the app on
    // /home doesn't get a useless redirect from /home to /home.
    //
    // Manual navigation from /home → /register for an already-authed
    // guest does NOT change `user`, so this branch doesn't fire there.
    const justGotUser =
      !firstRun && prevUser === null && user !== null && !isOnboarding;
    if (justGotUser && pathname !== '/') {
      router.replace('/(tabs)/index');
      return;
    }

    if (user) {
      if (user.isAnonymous) {
        // Guest (Firebase anonymous / "Tetamu") — allowed to remain on
        // /login and /register so they can convert to a registered
        // account via the banner buttons in GuestModeBanner.
        // Firebase anonymous users are real `User` objects, so plain
        // `if (user)` redirects would silently trap them on those
        // screens without ever rendering the form.
        //
        // Post-conversion (their user object flips to non-anonymous),
        // the registered branch below kicks them to home automatically.
        return;
      }
      // Registered (non-anonymous) users always go to the main app,
      // regardless of whether they finished onboarding.
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
      <View style={styles.loadingContainer}>
        {/* Override the root's `dark-content` while the dark-blue splash
            is showing — white time/battery icons here on `#0e2a4d`
            stays readable. See /AGENTS.md §"Status bar" for the rules. */}
        <StatusBar barStyle="light-content" backgroundColor="#0e2a4d" />
        {/* Try the real brand asset first; fall back to a JS cross if the
            image hasn't prebundled yet (1.3MB can race on first cold start). */}
        {imageFailed ? (
          <View style={styles.loadingCircle}>
            <Text style={styles.loadingCross}>✝</Text>
          </View>
        ) : (
          <Image
            source={require('../../assets/logo.png')}
            style={styles.loadingLogo}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
          />
        )}
        <Text style={styles.loadingTitle}>KatolikGo</Text>
        <Text style={styles.loadingTagline}>Belajar · Bermain · Bertumbuh dalam Iman</Text>
        <View style={styles.loadingSpinnerRow}>
          <ActivityIndicator size="small" color="#d4a437" />
          <Text style={styles.loadingSpinnerText}>Memuatkan…</Text>
        </View>
      </View>
    );
  }

  // <Slot /> rather than <Stack /> here, per the official expo-router v6
  // auth flow pattern. Slot has no navigator of its own — it just renders
  // whatever route matches the current URL, leaving the layout-group
  // navigators ((auth)/_layout.tsx's <Stack>, (tabs)/_layout.tsx's <Tabs>,
  // quiz/_layout.tsx's <Stack>) to own their own screens and screenOptions.
  //
  // Why not <Stack> with explicit children? In v6, registering ANY sibling
  // Stack.Screen (including `name="onboarding"`, `name="quiz/[level]"`)
  // shadows the auto-resolved URL '/' that maps to (tabs)/index.tsx,
  // surfacing "Unmatched Route — Page could not be found" after login.
  //
  // The branded overlay rendered above already called SplashScreen.hideAsync()
  // in its own effect — we don't need another transition here. The Slot
  // takes over seamlessly once ready flips true.
  return <Slot />;
}

export default function RootLayout() {
  useEffect(() => {
    seedQuizzesIfEmpty();
  }, []);

  return (
    <SafeAreaProvider>
      {/*
        Default: dark-content so the time / battery icons stay legible on
        the light backgrounds used by (tabs), (auth), onboarding, and
        the result screen. The splash block below and the quiz play
        screen override this with their own `<StatusBar barStyle="light-content">`
        where they need white icons against dark backgrounds — the last
        StatusBar mounted in the tree wins per RN's contract.
      */}
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0e2a4d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 220,
    height: 220,
  },
  loadingCross: {
    fontSize: 64,
    color: '#0e2a4d',
    fontWeight: '700',
  },
  loadingTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 1,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  loadingTagline: {
    fontSize: FontSize.md,
    color: 'rgba(255, 255, 255, 0.78)',
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingSpinnerRow: {
    marginTop: Spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingSpinnerText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});
