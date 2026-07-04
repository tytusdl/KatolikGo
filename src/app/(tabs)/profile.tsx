import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Pressable, Animated } from 'react-native';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/authService';
import { GuestModeBanner } from '@/components/GuestModeBanner';
import { LivesIndicator, openLivesExhaustedModal } from '@/components/LivesIndicator';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { isAdminUnlockConfigured } from '@/config/adminUnlock';
import { AdminUnlockModal } from '@/admin/AdminUnlockModal';

// Length of the hidden hold-gesture on the avatar that surfaces the
// admin unlock modal. 5s is long enough that an accidental press
// won't trigger it, short enough that a developer who knows the
// gesture won't get bored. The Auth-screen text-link is still
// available as a fallback for the "no idea where the entry went"
// case.
const ADMIN_HOLD_DURATION_MS = 3000;

export default function ProfileScreen() {
  const { user, userData, refreshUserData } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Admin unlock modal — gated by env passphrase so it stays hidden
  // entirely when the dev hasn't configured one. The trigger is a
  // hidden 5s long-press on the avatar (no visible button / menu item
  // / text hint), so regular users don't see any path to admin.
  // The AuthScreen still surfaces a small text-link fallback for
  // cases where the gesture was forgotten.
  const adminUnlockAvailable = isAdminUnlockConfigured();
  const [adminUnlockOpen, setAdminUnlockOpen] = useState(false);

  const openAdminUnlock = useCallback(() => {
    setAdminUnlockOpen(true);
  }, []);
  const closeAdminUnlock = useCallback(() => {
    setAdminUnlockOpen(false);
  }, []);

  // After a successful unlock, the modal flips `userData.isAdmin`
  // server-side but the cached `userData` in context is still
  // stale. Refresh before navigating so the next render of this
  // screen shows the "🛠️ Panel Pentadbir" entry (not the gesture
  // trigger again — though we no longer have a visible entry, the
  // gate still skips the gesture for admins).
  const handleAdminUnlockSuccess = useCallback(async () => {
    await refreshUserData();
    router.replace('/admin');
  }, [refreshUserData, router]);

  // === Hidden avatar-hold gesture ===
  // Long-press the profile avatar for ADMIN_HOLD_DURATION_MS to
  // open the admin unlock modal. Progress is driven by an
  // Animated.Value that the Pressable binds to on press-in/out, so
  // the bar fills while held and snaps back if released early.
  // No visible trigger (button / hint text) — only the avatar
  // itself, and a subtle progress bar that appears mid-hold so the
  // developer knows the gesture registered.
  const [avatarHolding, setAvatarHolding] = useState(false);
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAvatarHold = useCallback(() => {
    // Skip the gesture entirely if the env passphrase is empty
    // — no-op feedback for users without the .env config, so the
    // gesture feels inert rather than buggy.
    if (!adminUnlockAvailable) return;
    if (userData?.isAdmin === true) return;
    setAvatarHolding(true);
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: ADMIN_HOLD_DURATION_MS,
      useNativeDriver: false,
    }).start();
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      setAvatarHolding(false);
      holdProgress.setValue(0);
      openAdminUnlock();
    }, ADMIN_HOLD_DURATION_MS);
  }, [adminUnlockAvailable, userData?.isAdmin, holdProgress, openAdminUnlock]);

  const cancelAvatarHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setAvatarHolding(false);
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [holdProgress]);

  // Make sure the timer doesn't survive a screen unmount mid-hold.
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const handleSignOut = async () => {
    Alert.alert(
      'Log Keluar',
      'Anda pasti mahu log keluar?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Log Keluar',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch {
              Alert.alert('Ralat', 'Gagal log keluar');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil Saya</Text>
          <TouchableOpacity style={styles.settingsBtn}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Guest banner — compact variant to leave room for the rest
            of the profile content. Renders only for Firebase anonymous
            users. */}
        {userData?.isGuest && (
          <View style={{ paddingHorizontal: Spacing.lg }}>
            <GuestModeBanner compact />
          </View>
        )}

        {/* Lives card — same dark-blue + gold "NYAWA ANDA" surface as
            the Home tab so the design language is consistent across
            screens. Tapping the gold "Tambah" CTA jumps straight
            into the lives-exhausted modal. */}
        <LivesIndicator onPress={() => openLivesExhaustedModal(router)} />

        {/* Avatar + Name */}
        <View style={styles.profileSection}>
          {/* Avatar is wrapped in a Pressable for the hidden admin
              hold-gesture (see startAvatarHold). No visible button /
              hint — only the progress bar that appears while held
              gives feedback, so regular users never see an admin
              entry. Avatar is always pressable (even when the env
              passphrase is empty) but the handler is a no-op in
              that case, so the gesture feels inert rather than
              visibly broken. */}
          <Pressable
            onPressIn={startAvatarHold}
            onPressOut={cancelAvatarHold}
            // Don't bind onPress — we only care about press-in vs
            // press-out, not "tapped and released". A tap without
            // a long hold is a release (onPressOut), which cancels
            // cleanly. Mapping onPress too would race with
            // onPressOut in some Pressable event orderings.
            //
            // delayLongPress pinned to ADMIN_HOLD_DURATION_MS so
            // Pressable's own "long press" detection fires at the
            // same moment our setTimeout completes — the gesture
            // resolves into a single state transition rather than
            // two competing timers.
            delayLongPress={ADMIN_HOLD_DURATION_MS}
            // The avatar lives inside a ScrollView. ScrollView
            // can capture a held touch if the finger drifts even a
            // few pixels (especially on iOS). `unstable_pressDelay`
            // is undocumented but reduces that interaction —
            // setting it to 0 means the press claim is immediate
            // rather than waiting the default ~130ms.
            unstable_pressDelay={0}
            // Disable accessibility hint when gesture is a no-op
            // (empty env or already-admin). Keeps screen readers
            // from announcing a hidden feature.
            accessibilityLabel="Avatar profil"
            accessibilityRole="image"
          >
            <View
              style={[
                styles.avatarOuter,
                avatarHolding && styles.avatarOuterActive,
              ]}
            >
              <View style={styles.avatarInner}>
                <Text style={styles.avatarEmoji}>
                  {userData?.displayName?.charAt(0).toUpperCase() || 'K'}
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Hold-progress bar — sits right below the avatar, only
              fades in while held. Width interpolates from 0 → 100%
              driven by the Animated.Value the Pressable mutates.
              pointerEvents="none" so it never eats a tap meant for
              the avatar itself. */}
          <View
            style={[
              styles.holdProgressTrack,
              !avatarHolding && styles.holdProgressHidden,
            ]}
            pointerEvents="none"
          >
            <Animated.View
              style={[
                styles.holdProgressFill,
                {
                  width: holdProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          <Text style={styles.userName}>{userData?.displayName || 'Saudara'}</Text>
          
          <View style={styles.handleBadge}>
            <Text style={styles.handleText}>
              @{user?.email?.split('@')[0] || 'katolikgo'}
            </Text>
          </View>
        </View>

        {/* Decorative sparkles */}
        <Text style={[styles.sparkle, styles.sparkleLeft]}>✨</Text>
        <Text style={[styles.sparkle, styles.sparkleRight]}>⭐</Text>

        {/* Stats Grid 2x2 */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Text style={styles.statIcon}>🪙</Text>
            </View>
            <View>
              <Text style={styles.statValue}>{userData?.streakDays || 0}</Text>
              <Text style={styles.statLabel}>Streak Menang</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#D1FAE5' }]}>
              <Text style={styles.statIcon}>📚</Text>
            </View>
            <View>
              <Text style={styles.statValue}>{userData?.levelsCompleted?.length || 0}</Text>
              <Text style={styles.statLabel}>Jumlah Kuiz</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#E0E7FF' }]}>
              <Text style={styles.statIcon}>👥</Text>
            </View>
            <View>
              <Text style={styles.statValue}>{userData?.friendsCount || 0}</Text>
              <Text style={styles.statLabel}>Rakan</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#D1FAE5' }]}>
              <Text style={styles.statIcon}>📈</Text>
            </View>
            <View>
              <Text style={styles.statValue}>{userData?.accuracy || 0}%</Text>
              <Text style={styles.statLabel}>Skor Tinggi</Text>
            </View>
          </View>
        </View>

        {/* Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.waveIcon}>〰️</Text>
            <TouchableOpacity style={styles.monthlyBtn}>
              <Text style={styles.monthlyText}>Bulanan</Text>
              <Text style={styles.monthlyArrow}>▾</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.progressMessage}>
            Anda telah bermain sebanyak
          </Text>
          <Text style={styles.progressHighlight}>
            {userData?.quizzesThisMonth || 24} kuiz bulan ini!
          </Text>

          {/* Donut Chart */}
          <View style={donutStyles.container}>
            <DonutChart percentage={74} />
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <MenuItem
            icon="🏆"
            iconBg="#FEF3C7"
            title="Pencapaian & Lencana"
            onPress={() => Alert.alert('Pencapaian', 'Ciri akan datang!')}
          />

          <MenuItem
            icon="⛪"
            iconBg="#DBEAFE"
            title="Parish Saya"
            subtitle={userData?.parishName || 'Tetapkan parish'}
            onPress={() => Alert.alert('Parish', 'Ciri akan datang!')}
          />

          <MenuItem
            icon="👑"
            iconBg="#FCE7F3"
            title={userData?.isPremium ? 'Pro Aktif' : 'Naik Taraf ke Pro'}
            subtitle={userData?.isPremium ? 'Anda ahli Pro!' : 'Akses semua topik premium'}
            onPress={() => Alert.alert('Premium', 'Ciri akan datang!')}
          />

          {/* Developer-only entry point to the in-app admin panel.
              Visible only when the current user is already an
              admin. Non-admin users get no visible menu entry at
              all — promotion happens via the hidden avatar-hold
              gesture (see startAvatarHold) or the Auth-screen
              text-link fallback. */}
          {userData?.isAdmin && (
            <MenuItem
              icon="🛠️"
              iconBg="#E0E7FF"
              title="Panel Pentadbir"
              subtitle="Urus token, XP, nyawa & level"
              onPress={() => router.push('/admin')}
            />
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutIcon}>🚪</Text>
          <Text style={styles.signOutText}>Log Keluar</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>KatolikGo v1.0.0</Text>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Shared unlock modal — same component the AuthScreen uses.
          The `onSuccess` overrides the default "navigate to /admin"
          so we can refresh userData first (so the menu entries
          re-render correctly: unlock entry gone, panel entry
          visible). */}
      <AdminUnlockModal
        visible={adminUnlockOpen}
        onClose={closeAdminUnlock}
        user={user}
        onSuccess={handleAdminUnlockSuccess}
      />
    </View>
  );
}

// Donut Chart Component
function DonutChart({ percentage }: { percentage: number }) {
  return (
    <View style={donutStyles.container}>
      <View style={donutStyles.ringWrap}>
        {/* Use multiple views to simulate donut */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i / 24) * 360;
          return (
            <View
              key={i}
              style={[
                donutStyles.dot,
                {
                  transform: [
                    { rotate: `${angle}deg` },
                    { translateY: -58 },
                  ],
                  backgroundColor:
                    i < Math.round((percentage / 100) * 24)
                      ? Colors.accent
                      : Colors.light.border,
                },
              ]}
            />
          );
        })}
        <View style={donutStyles.center}>
          <Text style={donutStyles.percent}>{percentage}%</Text>
          <Text style={donutStyles.label}>Selesai</Text>
        </View>
      </View>
    </View>
  );
}

// Menu Item Component
function MenuItem({ 
  icon, 
  iconBg, 
  title, 
  subtitle, 
  onPress 
}: { 
  icon: string; 
  iconBg: string; 
  title: string; 
  subtitle?: string; 
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
        <Text style={styles.menuIconText}>{icon}</Text>
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background, // same as other screens
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  settingsBtn: {
    position: 'absolute',
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsIcon: {
    fontSize: 18,
    color: Colors.primary,
  },
  
  // Profile Section
  profileSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  // Active state while the user is mid-hold — slightly wider /
  // softer ring so the avatar visually "lights up" to confirm the
  // gesture registered. Subtle on purpose so regular users don't
  // notice anything special.
  avatarOuterActive: {
    transform: [{ scale: 1.04 }],
    shadowColor: Colors.accent,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  avatarInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F5D77E', // lighter orange/gold
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.white,
  },
  userName: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  handleBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  handleText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.white,
  },

  // Sparkles
  sparkle: {
    position: 'absolute',
    fontSize: 20,
  },
  sparkleLeft: {
    top: 100,
    left: 20,
  },
  sparkleRight: {
    top: 110,
    right: 30,
    fontSize: 16,
  },
  
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  statIcon: {
    fontSize: 22,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  
  // Progress Card
  progressCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  waveIcon: {
    fontSize: 20,
  },
  monthlyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceAlt,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  monthlyText: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  monthlyArrow: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  progressMessage: {
    fontSize: FontSize.md,
    color: Colors.primary,
    textAlign: 'center',
  },
  progressHighlight: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.accent,
    textAlign: 'center',
    marginTop: 2,
  },
  
  // Menu
  menuSection: {
    marginBottom: Spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuIconText: {
    fontSize: 20,
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  menuSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 28,
    color: Colors.light.textSecondary,
  },
  
  // Sign Out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.error,
    marginBottom: Spacing.lg,
  },
  signOutIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  signOutText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.error,
  },
  
  // Version
  versionText: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  // === Hold-gesture progress bar (admin unlock) ===
  // Thin gold track that appears below the avatar while held.
  // Width 0% → 100% is driven by the Animated.Value the
  // Pressable mutates. Hidden entirely (opacity 0 + height 0)
  // when not holding, so regular users see no UI change at all.
  holdProgressTrack: {
    width: 96,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(229, 184, 90, 0.18)',
    marginTop: -Spacing.sm,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  holdProgressHidden: {
    height: 0,
    opacity: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  holdProgressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
});

// Donut chart styles
const donutStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  ringWrap: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
  },
  percent: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
  },
});