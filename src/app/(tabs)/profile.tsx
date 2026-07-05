import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Pressable } from 'react-native';
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

/**
 * Long-press duration (ms) on the version text that surfaces the
 * admin unlock modal. Five seconds is long enough that casual
 * scroll-drag pauses on the version line won't trigger it, short
 * enough that a developer who knows the gesture can fire it in
 * one deliberate hold. The version text sits at the very bottom
 * of the scroll area (below Sign Out) — entirely outside the
 * ScrollView's heavy gesture zones so this Pressable reliably
 * receives onPressIn/onPressOut even with the scroll container
 * above it. This is the ONLY admin unlock trigger in the app
 * (the avatar triple-tap was removed for reliability).
 */
const VERSION_HOLD_DURATION_MS = 5000;

export default function ProfileScreen() {
  const { user, userData, refreshUserData } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // === Hidden long-press on version text (the ONLY admin unlock
  // gesture in the app). Press & hold "KatolikGo v1.0.0" for
  // VERSION_HOLD_DURATION_MS to open the admin modal. See the
  // constant's doc-comment above for why this location is
  // reliable.
  const adminUnlockAvailable = isAdminUnlockConfigured();
  const [adminUnlockOpen, setAdminUnlockOpen] = useState(false);
  const [versionHeld, setVersionHeld] = useState(false);
  // Auto-firing setTimeout that opens the modal AT the 5s mark,
  // mid-hold. Press-out cancels it. Strict-hold semantics: any
  // tap whose release happens before the timer fires produces no
  // modal — only a continuous 5s press where the user keeps
  // their finger down will fire onAdminUnlock. The ref is reset
  // defensively on each press-in (cancels any pre-existing
  // timer) so finger-drift during a hold never leaks an orphan
  // timer.
  const versionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openAdminUnlock = useCallback(() => {
    setAdminUnlockOpen(true);
  }, []);
  const closeAdminUnlock = useCallback(() => {
    setAdminUnlockOpen(false);
  }, []);

  const handleAdminUnlockSuccess = useCallback(async () => {
    setAdminUnlockOpen(false);
    await refreshUserData();
    router.replace('/admin');
  }, [refreshUserData, router]);

  const startVersionHold = useCallback(() => {
    // Defensive: clear any pre-existing timer before we even
    // check the gate. If a previous press cycle's timer somehow
    // survived (shouldn't, but guard anyway), kill it.
    if (versionTimerRef.current) {
      clearTimeout(versionTimerRef.current);
      versionTimerRef.current = null;
    }
    if (!adminUnlockAvailable) return;
    if (userData?.isAdmin === true) return;
    setVersionHeld(true);
    versionTimerRef.current = setTimeout(() => {
      versionTimerRef.current = null;
      setVersionHeld(false);
      openAdminUnlock();
    }, VERSION_HOLD_DURATION_MS);
  }, [adminUnlockAvailable, userData?.isAdmin, openAdminUnlock]);

  const releaseVersionHold = useCallback(() => {
    setVersionHeld(false);
    // Cancel the pending timer. If the timer already fired
    // (modal opening) the ref is null and this is a clean
    // no-op. If the user releases before 5s, the timer is
    // cancelled and the modal never opens.
    if (versionTimerRef.current) {
      clearTimeout(versionTimerRef.current);
      versionTimerRef.current = null;
    }
  }, []);

  // Cleanup pending timer on screen unmount so a callback can't
  // fire openAdminUnlock on a torn-down component.
  useEffect(() => {
    return () => {
      if (versionTimerRef.current) clearTimeout(versionTimerRef.current);
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
          {/* Avatar is purely decorative here — the admin-unlock
              gesture lives on the version text at the bottom of
              the page (long-press for 5s). No Pressable wrapper,
              no gesture, no flash. */}
          <View style={styles.avatarOuter}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarEmoji}>
                {userData?.displayName?.charAt(0).toUpperCase() || 'K'}
              </Text>
            </View>
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

        {/* HIDDEN admin unlock — long-press on the version text
            for VERSION_HOLD_DURATION_MS opens the admin modal.
            No visible button / menu / hint — the only feedback is
            a subtle color shift while held (handled by
            versionHeld state below). Sits at the bottom of the
            scroll area, below the Sign Out button, in a quiet
            zone where the Pressable reliably receives onPressIn
            /onPressOut even with the ScrollView wrapper above. */}
        <Pressable
          onPressIn={startVersionHold}
          onPressOut={releaseVersionHold}
          hitSlop={20}
          // Pin delayLongPress to VERSION_HOLD_DURATION_MS so
          // Pressable's built-in long-press classification aligns
          // with our timestamp-based hold measurement — keeps
          // Pressable from swallowing the release event with its
          // own competing state at ~500ms.
          delayLongPress={VERSION_HOLD_DURATION_MS}
          accessibilityLabel="Versi aplikasi"
          accessibilityRole="text"
        >
          <Text
            style={[
              styles.versionText,
              versionHeld && styles.versionTextHeld,
            ]}
          >
            KatolikGo v1.0.0
          </Text>
        </Pressable>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Hidden triple-tap on the avatar opens this. The Auth-screen
          also surfaces a small text-link fallback for cases where
          the gesture was forgotten. */}
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

  // Dev-only admin unlock trigger. Visible button (renders only
  // when env passphrase is configured and user isn't yet admin).
  // Subdued styling so it doesn't stand out for normal users who
  // shouldn't have this rendered anyway — the gate above keeps it
  // out of their hands.
  adminTrigger: {
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.lg,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    alignItems: 'center',
  },
  adminTriggerText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.accent,
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
  // Subtle color + weight shift while the version text is being
  // held for the admin-unlock gesture. Confirms to the developer
  // that the press registered, without being noticeable to a
  // regular user who'd never hold it long enough to fire.
  versionTextHeld: {
    color: Colors.accent,
    fontWeight: '600',
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