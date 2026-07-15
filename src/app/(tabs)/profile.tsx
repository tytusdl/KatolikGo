import { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/authService';
import { isAdminUnlockConfigured } from '@/config/adminUnlock';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';
import { Routes } from '@/constants/routes';

const MENU_ITEMS = [
  { icon: 'settings' as const, label: 'Tetapan Akaun' },
  { icon: 'notifications' as const, label: 'Notifikasi' },
  { icon: 'help-circle' as const, label: 'Bantuan & Sokongan' },
];

export default function ProfileScreen() {
  const { userData } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const versionHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionHeldAnim = useRef(new Animated.Value(0)).current;

  const startVersionHold = useCallback(() => {
    if (!isAdminUnlockConfigured() || userData?.isAdmin) return;
    if (versionHoldRef.current) clearTimeout(versionHoldRef.current);
    Animated.timing(versionHeldAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
    versionHoldRef.current = setTimeout(() => {
      versionHoldRef.current = null;
      Alert.alert('Akses Pentadbir', 'Gunakan pilihan "🔐 Admin Access" di halaman Log Masuk untuk mengaktifkan mod pentadbir.');
    }, 5000);
  }, [userData, versionHeldAnim]);

  const releaseVersionHold = useCallback(() => {
    if (versionHoldRef.current) {
      clearTimeout(versionHoldRef.current);
      versionHoldRef.current = null;
    }
    Animated.timing(versionHeldAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [versionHeldAnim]);

  const handleSignOut = () => {
    Alert.alert('Log Keluar', 'Pasti mahu log keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Log Keluar',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace(Routes.LOGIN);
        },
      },
    ]);
  };

  const handleMenu = (label: string) => {
    if (label === 'Tetapan Akaun' || label === 'Notifikasi' || label === 'Bantuan & Sokongan') {
      Alert.alert(label, 'Halaman ini akan datang.');
    }
  };

  const completedQuizzes = (userData?.levelsCompleted ?? []).length;
  const rank = `#${Math.max(1, 12 - (userData?.totalXP ?? 0) % 10)}`;

  const versionColor = versionHeldAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.textMuted, Colors.accent],
  });

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {(userData?.displayName ?? 'S').charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.name}>{userData?.displayName ?? 'Saudara'}</Text>
        <Text style={styles.role}>PEMBELAJAR</Text>

        <View style={styles.statsRow}>
          <View style={[styles.statItem, styles.statBordered]}>
            <Text style={styles.statVal}>{((userData?.totalXP ?? 0) / 1000).toFixed(1)}k</Text>
            <Text style={styles.statLabel}>JUMLAH XP</Text>
          </View>
          <View style={[styles.statItem, styles.statBordered]}>
            <Text style={styles.statVal}>{rank}</Text>
            <Text style={styles.statLabel}>PERINGKAT</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{completedQuizzes}</Text>
            <Text style={styles.statLabel}>KUIZ SELESAI</Text>
          </View>
        </View>

        <View style={styles.goalCard}>
          <Text style={styles.goalTitle}>Sasaran Mingguan</Text>
          <Text style={styles.goalDesc}>
            {completedQuizzes > 0
              ? `${Math.max(0, 12 - completedQuizzes)} lagi kuiz untuk capai sasaran.`
              : 'Main kuiz pertama untuk mula mengumpul XP.'}
          </Text>
          <View style={styles.goalBar}>
            <View
              style={[
                styles.goalBarFill,
                { width: `${Math.min(100, (completedQuizzes / 12) * 100)}%` as any },
              ]}
            />
          </View>
        </View>

        {userData?.isAdmin && (
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => router.push(Routes.ADMIN)}
          >
            <Ionicons name="build" size={20} color={Colors.white} />
            <Text style={styles.adminBtnText}>Panel Pentadbir</Text>
          </TouchableOpacity>
        )}

        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuRow}
              onPress={() => handleMenu(item.label)}
            >
              <Ionicons name={item.icon} size={22} color={Colors.text} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out" size={20} color={Colors.error} />
          <Text style={styles.signOutText}>Log Keluar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPressIn={startVersionHold}
          onPressOut={releaseVersionHold}
          activeOpacity={1}
          style={styles.versionWrap}
        >
          <Animated.Text style={[styles.versionText, { color: versionColor }]}>
            KatolikGo v1.0.0
          </Animated.Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    alignItems: 'center',
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },

  name: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: 4,
  },
  role: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.lg,
  },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: 4,
  },
  statBordered: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  statVal: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },

  goalCard: {
    width: '100%',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  goalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.text,
    marginBottom: 4,
  },
  goalDesc: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  goalBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  goalBarFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },

  adminBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: Spacing.md,
    backgroundColor: Colors.text,
    borderRadius: BorderRadius.md,
  },
  adminBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.white,
  },

  menuSection: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    marginBottom: 6,
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.text,
    marginLeft: Spacing.md,
  },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.error,
    marginBottom: Spacing.lg,
  },
  signOutText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.error,
  },

  versionWrap: {
    marginBottom: Spacing.sm,
    paddingVertical: 8,
  },
  versionText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontWeight: '400',
  },
});
