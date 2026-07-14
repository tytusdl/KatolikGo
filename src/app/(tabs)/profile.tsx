import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/authService';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { getXpProgress } from '@/constants/xp.constants';

const GLASS = {
  backgroundColor: 'rgba(14,42,77,0.6)',
  borderWidth: 1,
  borderColor: 'rgba(236,194,70,0.15)',
  borderRadius: BorderRadius.lg,
};

const MENU_ITEMS = [
  { icon: 'trophy', label: 'Papan Pendahulu', route: Routes.LEADERBOARD },
  { icon: 'map', label: 'Peta Kuiz', route: Routes.PETA },
  { icon: 'settings', label: 'Tetapan', route: null },
];

export default function ProfileScreen() {
  const { userData } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const xpProgress = useMemo(
    () => getXpProgress(userData?.totalXP ?? 0),
    [userData?.totalXP]
  );

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

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
      >
        {/* Avatar with halo */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarHalo} />
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {(userData?.displayName ?? 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{userData?.displayName ?? 'Saudara'}</Text>
          <Text style={styles.role}>Tahap {xpProgress.level}</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="flame" size={20} color={Colors.secondary} />
            <Text style={styles.statVal}>{userData?.streakDays ?? 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="star" size={20} color={Colors.secondary} />
            <Text style={styles.statVal}>{userData?.totalXP?.toLocaleString() ?? '0'}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="ribbon" size={20} color={Colors.primary} />
            <Text style={styles.statVal}>{userData?.tokens ?? 0}</Text>
            <Text style={styles.statLabel}>Token</Text>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuRow}
              onPress={() => item.route && router.push(item.route)}
            >
              <Ionicons name={item.icon as any} size={22} color={Colors.secondary} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out" size={20} color={Colors.error} />
          <Text style={styles.signOutText}>Log Keluar</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footer}>Tuhan memberkati hari anda</Text>
        <Text style={styles.footerSmall}>KatolikGo v1.0.0</Text>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarHalo: {
    position: 'absolute',
    top: -6,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(236,194,70,0.2)',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.secondary,
    marginBottom: Spacing.sm,
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.navyDark,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
    marginBottom: 4,
  },
  role: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    ...GLASS,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statVal: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(236,194,70,0.15)',
  },

  // Menu
  menuSection: {
    gap: 8,
    marginBottom: Spacing.lg,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    ...GLASS,
    padding: Spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.creamSoft,
    marginLeft: Spacing.md,
  },

  // Sign Out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.3)',
    marginBottom: Spacing.xl,
  },
  signOutText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.error,
  },

  // Footer
  footer: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontStyle: 'italic',
    color: Colors.onSurfaceVariant,
    opacity: 0.5,
    marginBottom: 4,
  },
  footerSmall: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
    opacity: 0.3,
  },
});
