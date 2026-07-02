import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';

interface GuestModeBannerProps {
  /**
   * Optional compact variant for screens with less vertical room
   * (e.g. profile, leaderboard). Drops the description line and uses
   * a tighter padding.
   */
  compact?: boolean;
}

/**
 * Banner shown to Firebase anonymous ("Tetamu") users on Home and other
 * in-app screens. Surfaces the consequences of guest mode (no XP, no
 * tokens, no leaderboard) and gives a clear path out: Daftar (register)
 * or Log Masuk (sign in to an existing account).
 *
 * Why this exists: the `Terus sebagai Tetamu` button on the auth screen
 * advertises a frictionless trial, but services gate XP / token awards,
 * token spending, and leaderboard visibility for guests. Without an
 * in-app nudge explaining the limits, users would hit "0 tokens" on the
 * result screen with no context. Banner closes that loop.
 *
 * Returns `null` for non-guest sessions so it's safe to drop at the top
 * of any tab screen without conditional rendering at the call site.
 */
export function GuestModeBanner({ compact = false }: GuestModeBannerProps) {
  const router = useRouter();

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.iconWrap}>
        <Ionicons name="person-circle-outline" size={compact ? 20 : 24} color="#fff" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Anda log masuk sebagai Tetamu</Text>
        {!compact && (
          <Text style={styles.subtitle}>
            XP, token dan kedudukan papan pendahulu tidak akan disimpan.
            Daftar untuk simpan progress anda.
          </Text>
        )}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Daftar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Log Masuk</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
    gap: Spacing.md,
  },
  containerCompact: {
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.white,
  },
  primaryButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.accent,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  secondaryButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.white,
  },
});