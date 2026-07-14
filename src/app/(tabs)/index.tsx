import { useMemo } from 'react';
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

const GLASS = {
  backgroundColor: 'rgba(14,42,77,0.6)',
  borderWidth: 1,
  borderColor: 'rgba(236,194,70,0.15)',
  borderRadius: BorderRadius.lg,
};

const CATEGORIES = [
  { icon: 'book', label: 'Alkitab', desc: 'Perjanjian Lama & Baru', color: '#4a90d9' },
  { icon: 'heart', label: 'Sakramen', desc: '7 Sakramen Kudus', color: '#d94a6b' },
  { icon: 'flame', label: 'Liturgi', desc: 'Tatacara Misa', color: '#d9a84a' },
  { icon: 'school', label: 'Katekismus', desc: 'Ajaran Gereja', color: '#4ad9a8' },
];

const DAILY_VERSES = [
  { text: 'Pergilah ke seluruh dunia, khabarkan Injil kepada semua makhluk.', ref: 'Markus 16:15' },
  { text: 'Kerana aku yakin, bahawa baik maut, baik hidup... semua itu tidak dapat memisahkan kita dari kasih Allah.', ref: 'Roma 8:38-39' },
  { text: 'Tuhanlah kekuatanku dan perlindunganku.', ref: 'Mazmur 18:2' },
];

export default function HomeScreen() {
  const { userData } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const xpProgress = useMemo(
    () => getXpProgress(userData?.totalXP ?? 0),
    [userData?.totalXP]
  );

  const verse = DAILY_VERSES[new Date().getDate() % DAILY_VERSES.length];
  const lives = userData?.lives ?? LIVES_CONFIG.MAX;

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBarLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {(userData?.displayName ?? 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.greeting}>Hai, {userData?.displayName ?? 'Saudara'}!</Text>
        </View>
        <View style={styles.tokenPill}>
          <Image source={require('../../../assets/token.png')} style={styles.tokenIcon} />
          <Text style={styles.tokenCount}>{userData?.tokens ?? 0}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Tahap Anda</Text>
          <Text style={styles.heroLevel}>Tahap {xpProgress.level}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${xpProgress.percentage}%` as any }]} />
          </View>
          <Text style={styles.xpText}>{xpProgress.current} / {xpProgress.required} XP</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={20} color={Colors.secondary} />
            <Text style={styles.statValue}>{userData?.streakDays ?? 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="heart" size={20} color={Colors.tertiary} />
            <Text style={styles.statValue}>{lives}/{LIVES_CONFIG.MAX}</Text>
            <Text style={styles.statLabel}>Nyawa</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="star" size={20} color={Colors.secondary} />
            <Text style={styles.statValue}>{userData?.totalXP?.toLocaleString() ?? '0'}</Text>
            <Text style={styles.statLabel}>XP</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="ribbon" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{userData?.tokens ?? 0}</Text>
            <Text style={styles.statLabel}>Token</Text>
          </View>
        </View>

        {/* Categories */}
        <Text style={styles.sectionTitle}>✝ Topik Kuiz</Text>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.label}
            style={styles.categoryRow}
            onPress={() => router.push(Routes.PETA)}
          >
            <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
              <Ionicons name={cat.icon as any} size={20} color={cat.color} />
            </View>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <Text style={styles.categoryDesc}>{cat.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
        ))}

        {/* Daily Verse */}
        <View style={styles.verseCard}>
          <Text style={styles.verseQuote}>{'\u201C'}{verse.text}{'\u201D'}</Text>
          <Text style={styles.verseRef}>— {verse.ref}</Text>
        </View>

        {/* Leaderboard Teaser */}
        <TouchableOpacity
          style={styles.leaderboardTeaser}
          onPress={() => router.push(Routes.LEADERBOARD)}
        >
          <Ionicons name="trophy" size={22} color={Colors.secondary} />
          <View style={styles.leaderboardInfo}>
            <Text style={styles.leaderboardTitle}>Papan Pendahulu</Text>
            <Text style={styles.leaderboardSub}>Lihat kedudukan anda</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>

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

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: 'rgba(18,20,17,0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(236,194,70,0.1)',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.navyDark,
  },
  greeting: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
  },
  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14,42,77,0.6)',
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tokenIcon: {
    width: 18,
    height: 18,
  },
  tokenCount: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.secondary,
  },

  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },

  // Hero
  heroCard: {
    ...GLASS,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderColor: 'rgba(236,194,70,0.3)',
    shadowColor: 'rgba(201,162,39,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  heroLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroLevel: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.secondary,
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(18,20,17,0.6)',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.secondary,
  },
  xpText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  statCard: {
    ...GLASS,
    width: '48%',
    flexGrow: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
  },

  // Section
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
    marginBottom: Spacing.sm,
  },

  // Category
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    ...GLASS,
    padding: Spacing.md,
    marginBottom: 8,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
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
    color: Colors.creamSoft,
  },
  categoryDesc: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },

  // Verse
  verseCard: {
    ...GLASS,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.secondary,
  },
  verseQuote: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    fontStyle: 'italic',
    color: Colors.creamSoft,
    lineHeight: 24,
    marginBottom: 8,
  },
  verseRef: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.secondary,
  },

  // Leaderboard Teaser
  leaderboardTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    ...GLASS,
    padding: Spacing.md,
  },
  leaderboardInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  leaderboardTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
  },
  leaderboardSub: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
});
