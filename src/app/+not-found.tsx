import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { Colors, FontSize, Spacing } from '@/constants/theme';

/**
 * Custom 404 / unmatched-route fallback.
 *
 * Auto-bounces the user back to `/` (the home tab) after a brief flash
 * so they don't end up staring at a dead end when a deep link, share
 * intent, or transient race condition leaves them on a URL that has no
 * matching route.
 */
export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/');
    }, 800);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ title: 'Halaman Tidak Dijumpai' }} />
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.subtitle}>Pergi ke halaman utama…</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
