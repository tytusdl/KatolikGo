import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { GuestModeBanner } from '@/components/GuestModeBanner';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

const ICONS = {
  trophy: '🏆',
  book: '📖',
  church: '⛪',
  cross: '✝️',
  heart: '❤️',
  star: '⭐',
  crown: '👑',
  fire: '🔥',
  bell: '🔔',
  diamond: '💎',
  coin: '🪙',
};

export default function HomeScreen() {
  const { userData } = useAuth();

  return (
    <ScreenContainer scroll>
      {/* Guest banner — only renders for Firebase anonymous ("Tetamu")
          users. Sits at the very top so the consequence of guest mode
          (no XP / tokens / leaderboard) is the first thing they see. */}
      {userData?.isGuest && <GuestModeBanner />}

      {/* Header with greeting */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userData?.displayName?.charAt(0).toUpperCase() || 'K'}
            </Text>
          </View>
          <View>
            <Text style={styles.greeting}>Selamat Datang 👋</Text>
            <Text style={styles.userName}>{userData?.displayName || 'Saudara'}</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.tokenBadge}>
          <Text style={styles.tokenIcon}>{ICONS.coin}</Text>
          <Text style={styles.tokenAmount}>{userData?.tokens || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Level Progress Card - Hero */}
      <View style={styles.heroCard}>
        <View style={styles.heroContent}>
          <View>
            <Text style={styles.heroLabel}>TAHAP ANDA</Text>
            <Text style={styles.heroLevel}>Level {userData?.currentLevel || 1}</Text>
            <Text style={styles.heroSubtext}>Teruskan usaha, anda hampir ke puncak!</Text>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '45%' }]} />
              </View>
              <Text style={styles.progressText}>450 / 1000 XP</Text>
            </View>
          </View>
          
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>🏆</Text>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#FFE8D5' }]}>
            <Text style={styles.statIcon}>{ICONS.star}</Text>
          </View>
          <Text style={styles.statValue}>{userData?.totalXP || 0}</Text>
          <Text style={styles.statLabel}>XP</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#FFD3D3' }]}>
            <Text style={styles.statIcon}>{ICONS.heart}</Text>
          </View>
          <Text style={styles.statValue}>{userData?.streakDays || 0}</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#D5E8FF' }]}>
            <Text style={styles.statIcon}>{ICONS.book}</Text>
          </View>
          <Text style={styles.statValue}>{userData?.levelsCompleted?.length || 0}</Text>
          <Text style={styles.statLabel}>Tahap</Text>
        </View>
      </View>

      {/* Categories / Game Modes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Topik Kuiz</Text>
        </View>
        
        <View style={styles.categoriesGrid}>
          <TouchableOpacity style={[styles.categoryCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.categoryEmoji}>📜</Text>
            <Text style={styles.categoryTitle}>Perjanjian Lama</Text>
            <Text style={styles.categoryDesc}>12 Tahap</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.categoryCard, { backgroundColor: '#DBEAFE' }]}>
            <Text style={styles.categoryEmoji}>✝️</Text>
            <Text style={styles.categoryTitle}>Perjanjian Baru</Text>
            <Text style={styles.categoryDesc}>15 Tahap</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.categoryCard, { backgroundColor: '#FCE7F3' }]}>
            <Text style={styles.categoryEmoji}>⛪</Text>
            <Text style={styles.categoryTitle}>Sakramen</Text>
            <Text style={styles.categoryDesc}>10 Tahap</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.categoryCard, { backgroundColor: '#D1FAE5' }]}>
            <Text style={styles.categoryEmoji}>📖</Text>
            <Text style={styles.categoryTitle}>Katekismus</Text>
            <Text style={styles.categoryDesc}>20 Tahap</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Daily Quote Card */}
      <View style={styles.quoteCard}>
        <View style={styles.quoteIcon}>
          <Text style={styles.quoteEmoji}>✝️</Text>
        </View>
        <View style={styles.quoteContent}>
          <Text style={styles.verseText}>
            &ldquo;Sebarkanlah Injil ke segala makhluk, sebab di situlah Iman sejati.&rdquo;
          </Text>
          <Text style={styles.verseRef}>— Markus 16:15</Text>
        </View>
      </View>

      {/* Bottom spacing for tab bar */}
      <View style={{ height: 100 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
  },
  userName: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 2,
  },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    gap: 4,
  },
  tokenIcon: {
    fontSize: 18,
  },
  tokenAmount: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.white,
  },

  // Hero Card
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  heroLevel: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    marginTop: 4,
  },
  heroSubtext: {
    fontSize: FontSize.xs,
    color: Colors.white,
    opacity: 0.7,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: Spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  progressText: {
    fontSize: FontSize.xs,
    color: Colors.white,
    opacity: 0.8,
    marginTop: 4,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(201,162,39,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroEmoji: {
    fontSize: 40,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statIcon: {
    fontSize: 20,
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

  // Sections
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },

  // Categories Grid
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryCard: {
    width: '48%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'flex-start',
  },
  categoryEmoji: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  categoryTitle: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 2,
  },
  categoryDesc: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
  },

  // Quote Card
  quoteCard: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'flex-start',
  },
  quoteIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  quoteEmoji: {
    fontSize: 24,
  },
  quoteContent: {
    flex: 1,
  },
  verseText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  verseRef: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: 'bold',
    marginTop: Spacing.sm,
  },
});
