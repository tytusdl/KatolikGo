import { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { getXpProgress, LIVES_CONFIG } from '@/constants/xp.constants';
import {
  subscribeToGlobalLeaderboard,
} from '@/services/leaderboardService';
import type { LeaderboardEntry } from '@/types';

const CATEGORIES = [
  {
    icon: 'book' as const,
    label: 'Alkitab',
    desc: 'Perjanjian Lama & Baru',
  },
  {
    icon: 'business' as const,
    label: 'Katekismus',
    desc: 'Ajaran Iman Katolik',
  },
  {
    icon: 'globe' as const,
    label: 'Sejarah Gereja',
    desc: 'Warisan 2000 Tahun',
  },
];

export default function HomeScreen() {
  const { userData } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const xpProgress = useMemo(
    () => getXpProgress(userData?.totalXP ?? 0),
    [userData?.totalXP]
  );

  const lives = userData?.lives ?? LIVES_CONFIG.MAX;
  const [topThree, setTopThree] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const unsub = subscribeToGlobalLeaderboard((entries) => {
      setTopThree(entries.slice(0, 3));
    }, 10);
    return () => unsub();
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brandRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {(userData?.displayName ?? 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.brand}>KatolikGo</Text>
        </View>
        <View style={styles.topBarRight}>
          <View style={styles.tokenPill}>
            <Text style={styles.tokenCount}>{(userData?.tokens ?? 0).toLocaleString()}</Text>
            <Image source={require('../../../assets/token.png')} style={styles.tokenIcon} />
          </View>
          <View style={styles.livesPill}>
            <Text style={styles.livesCount}>{lives}</Text>
            <Ionicons name="heart" size={14} color={Colors.error} />
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={styles.heroCard}
          activeOpacity={0.85}
          onPress={() => router.push(Routes.PETA)}
        >
          <View style={styles.heroContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>CABARAN TERKINI</Text>
              <Text style={styles.heroTitle}>Kuiz Hari Ini</Text>
              <Text style={styles.heroDesc}>Uji pengetahuan iman anda hari ini.</Text>
            </View>
            <View style={styles.heroPlay}>
              <Ionicons name="play" size={28} color={Colors.white} />
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pencapaian Mingguan</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{xpProgress.percentage.toFixed(0)}%</Text>
              <Ionicons name="trending-up" size={16} color={Colors.accent} />
            </View>
            <View style={styles.statBar}>
              <View
                style={[
                  styles.statBarFill,
                  { width: `${Math.min(100, xpProgress.percentage)}%` as any },
                ]}
              />
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Berita Gereja</Text>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statSub}>ARTIKEL BAHARU DIBACA</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Kategori Utama</Text>
          <TouchableOpacity onPress={() => router.push(Routes.PETA)}>
            <Text style={styles.sectionLink}>Lihat Semua</Text>
          </TouchableOpacity>
        </View>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.label}
            style={styles.categoryRow}
            activeOpacity={0.7}
            onPress={() => router.push(Routes.PETA)}
          >
            <View style={styles.categoryIcon}>
              <Ionicons name={cat.icon} size={24} color={Colors.accent} />
            </View>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <Text style={styles.categoryDesc}>{cat.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}

        <View style={styles.boardCard}>
          <View style={styles.boardHeader}>
            <View style={styles.boardHeaderLeft}>
              <Ionicons name="trophy" size={18} color={Colors.accent} />
              <Text style={styles.boardTitle}>Papan Pendahulu</Text>
            </View>
            <Text style={styles.boardSub}>Top 3 Mingguan</Text>
          </View>
          {topThree.length === 0 ? (
            <Text style={styles.boardEmpty}>Belum ada data pendahulu.</Text>
          ) : (
            topThree.map((entry, idx) => (
              <View key={entry.userId} style={styles.boardRow}>
                <Text style={styles.boardRank}>{idx + 1}</Text>
                <View style={styles.boardAvatar}>
                  <Text style={styles.boardAvatarText}>
                    {entry.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.boardName} numberOfLines={1}>
                  {entry.displayName}
                </Text>
                <Text style={styles.boardXP}>
                  {entry.weeklyXP.toLocaleString()} pts
                </Text>
              </View>
            ))
          )}
          <TouchableOpacity
            style={styles.boardLink}
            onPress={() => router.push(Routes.LEADERBOARD)}
          >
            <Text style={styles.boardLinkText}>Lihat Papan Penuh</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
          </TouchableOpacity>
        </View>

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

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  brand: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tokenIcon: {
    width: 16,
    height: 16,
  },
  tokenCount: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  livesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  livesCount: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },

  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },

  heroCard: {
    height: 140,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.text,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  heroContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  heroEyebrow: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.white,
    marginBottom: 4,
  },
  heroDesc: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  heroPlay: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
    lineHeight: 32,
  },
  statSub: {
    fontSize: 9,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  statBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  sectionLink: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.accent,
  },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  categoryDesc: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    marginTop: 2,
  },

  boardCard: {
    padding: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
  },
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  boardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boardTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  boardSub: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  boardRank: {
    width: 24,
    fontSize: FontSize.md,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  boardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  boardAvatarText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  boardName: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  boardXP: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  boardEmpty: {
    paddingVertical: Spacing.md,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  boardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: Spacing.sm,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  boardLinkText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: FontFamily.body,
    color: Colors.accent,
  },
});
