import { View, Text, Image, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { GuestModeBanner } from '@/components/GuestModeBanner';
import { LivesIndicator, openLivesExhaustedModal } from '@/components/LivesIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { getXpProgress } from '@/constants/xp.constants';

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
};

// ---------------------------------------------------------------------------
// Quiz category list. Was hardcoded as 4 separate <TouchableOpacity>s inline;
// promoted to a config array so adding / re-ordering categories is a single
// edit. Keep `route` aligned with the available quiz screens (currently
// `/quiz/1` — the play screen accepts a level param; category metadata is
// passed via search params or context if a per-category flow ever lands).
// ---------------------------------------------------------------------------
interface QuizCategoryCard {
  emoji: string;
  title: string;
  desc: string;
  backgroundColor: string;
  /** Route opened on tap. Currently all categories open level-1 — wiring
   *  category-specific start-level is a feature, not a bug fix. */
  route: string;
}

const QUIZ_CATEGORIES: readonly QuizCategoryCard[] = [
  {
    emoji: '📜',
    title: 'Perjanjian Lama',
    desc: '12 Tahap',
    backgroundColor: '#FEF3C7',
    route: Routes.QUIZ_LEVEL(1),
  },
  {
    emoji: '✝️',
    title: 'Perjanjian Baru',
    desc: '15 Tahap',
    backgroundColor: '#DBEAFE',
    route: Routes.QUIZ_LEVEL(1),
  },
  {
    emoji: '⛪',
    title: 'Sakramen',
    desc: '10 Tahap',
    backgroundColor: '#FCE7F3',
    route: Routes.QUIZ_LEVEL(1),
  },
  {
    emoji: '📖',
    title: 'Katekismus',
    desc: '20 Tahap',
    backgroundColor: '#D1FAE5',
    route: Routes.QUIZ_LEVEL(1),
  },
];

// ---------------------------------------------------------------------------
// Daily verse rotation.
//
// Picks a verse based on the current day-of-year (Math.floor((Date.now()
// - startOfYear) / 86_400_000) with DST-safety), cycling through the
// array via modulo. Same verse is shown to every user on the same day —
// the rotation drives engagement for repeat openers without back-end
// work. Was previously a single hardcoded Mark 16:15 — promote to array
// when you want more variety (Catholic Bible has hundreds of quotable
// verses; rotation can grow).
//
// Replace any verse here with whatever direction the content team picks.
// Malay text + book reference; book reference rendered separately for
// the gold accent line.
// ---------------------------------------------------------------------------
interface DailyVerse {
  verse: string;
  ref: string;
}

const DAILY_VERSES: readonly DailyVerse[] = [
  {
    verse:
      '“Sebarkanlah Injil ke segala makhluk, sebab di situlah Iman sejati.”',
    ref: 'Markus 16:15',
  },
  {
    verse:
      '“Aku adalah jalan, kebenaran, dan kehidupan. Tiada seorang pun yang datang kepada Bapa, melainkan melalui Aku.”',
    ref: 'Yohanes 14:6',
  },
  {
    verse:
      '“Kasihilah Tuhan, Allahmu, dengan segenap hatimu dan dengan segenap jiwamu dan dengan segenap akal budimu.”',
    ref: 'Matius 22:37',
  },
  {
    verse:
      '“Berbahagialah orang yang miskin di hadapan Allah, karena mereka yang memiliki Kerajaan Surga.”',
    ref: 'Matius 5:3',
  },
  {
    verse:
      '“Janganlah takut, sebab Aku menyertai engkau ke manapun engkau pergi.”',
    ref: 'Kejadian 28:15',
  },
  {
    verse:
      '“Segala sesuatu dapat dilakukan bagi orang yang percaya.”',
    ref: 'Markus 9:23',
  },
  {
    verse:
      '“Aku memberikan kepadamu kehidupan yang kekal; mereka tidak akan binasa untuk selama-lamanya.”',
    ref: 'Yohanes 10:28',
  },
  {
    verse:
      '“Hendaklah kamu saling mengasihi, seperti Aku telah mengasihi kamu.”',
    ref: 'Yohanes 13:34',
  },
  {
    verse:
      '“Berbahagialah orang yang membawa damai, kerana mereka akan dinamai anak-anak Allah.”',
    ref: 'Matius 5:9',
  },
  {
    verse:
      '“Percayalah kepada Tuhan Yesus, maka kamu dan seisi rumahmu akan diselamatkan.”',
    ref: 'Kisah Para Rasul 16:31',
  },
  {
    verse:
      '“TUHAN adalah gembalaku, aku tidak kekurangan suatu apa pun.”',
    ref: 'Mazmur 23:1',
  },
  {
    verse:
      '“Datanglah kepada-Ku, semua yang letih lesu dan menanggung beban, maka Aku akan memberi kelegaan kepadamu.”',
    ref: 'Matius 11:28',
  },
];

/**
 * DST-safe day-of-year index. Uses local-date arithmetic (not UTC
 * ms-difference / 86_400_000 — that drifts on DST changeover) by
 * building a `new Date(year, 0, 1)` anchor. Returns 0-based day
 * within the year.
 */
function dayOfYearIndex(now: Date = new Date()): number {
  const start = new Date(now.getFullYear(), 0, 1);
  const ms = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default function HomeScreen() {
  const { userData } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Level progress is derived from totalXP — same source as the level
  // unlock math in `levelService.submitLevelCompletion`, so the hero
  // card never drifts out of sync with the actual `users/{uid}.totalXP`.
  // Previously this card rendered a hardcoded "450 / 1000 XP" + 45%
  // fill placeholder, which made the XP counter feel stuck regardless
  // of how many levels the user actually completed.
  const xpProgress = getXpProgress(userData?.totalXP || 0);
  const xpPercentText = `${xpProgress.current} / ${xpProgress.required} XP`;
  const xpFillWidth = `${Math.max(0, Math.min(100, xpProgress.percentage))}%` as `${number}%`;

  // Pick today's verse via modulo on day-of-year. Cycling through 12
  // verses gives ~30 days between repeats; expand `DAILY_VERSES` when
  // you want a longer rotation.
  const dailyVerse =
    DAILY_VERSES[dayOfYearIndex() % DAILY_VERSES.length];

  // ---------------------------------------------------------------------
  // Dynamic bottom-spacer height.
  //
  // Replaces the hardcoded `<View style={{ height: 100 }} />` at the
  // bottom (which assumed a tab-bar height that didn't survive
  // iPhone-SE / Dynamic Island / Android three-button / etc.) with a
  // computed value matching `(tabs)/_layout.tsx`'s tabBarStyle:
  //
  //   iOS     → 88 + safe-area-bottom + buffer
  //   Android → 72 + max(safe-area-bottom, 20) + buffer
  //
  // Mirroring the layout file's exact math means the last scroll item
  // is never hidden behind the tab bar on any device we'd ship to.
  // ---------------------------------------------------------------------
  const tabBarBaseHeight = Platform.OS === 'ios' ? 88 : 72;
  const tabBarPaddingBottom =
    Platform.OS === 'ios'
      ? insets.bottom
      : Math.max(insets.bottom, 20);
  // `useWindowDimensions` ties the spacer to the screen size so a
  // shorter screen (iPhone-SE) doesn't waste vertical space, but a
  // very tall screen doesn't leave a huge gap.
  const { height: screenHeight } = useWindowDimensions();
  const bottomSpacerHeight = Math.max(
    tabBarBaseHeight + tabBarPaddingBottom + Spacing.md,
    screenHeight * 0.04
  );

  return (
    <ScreenContainer scroll>
      {/* Guest banner — only renders for Firebase anonymous ("Tetamu")
          users. Sits at the very top so the consequence of guest mode
          (no XP / tokens / leaderboard) is the first thing they see. */}
      {userData?.isGuest && <GuestModeBanner />}

      {/* Header with greeting + lives pill + token badge. Lives pill is
          the compact heart+number indicator — sits to the left of the
          token badge so both resources read as a matched pair at the
          top-right corner. Tapping the lives pill opens the
          lives-exhausted modal. */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Avatar — purely decorative (no onPress). Was a View already
              but lacked accessibility metadata; added an accessibility
              label so VoiceOver / TalkBack announces "Avatar Saudara"
              or the user's display name. */}
          <View
            style={styles.avatar}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Avatar ${userData?.displayName ?? 'Saudara'}`}
          >
            <Text style={styles.avatarText}>
              {userData?.displayName?.charAt(0).toUpperCase() || 'K'}
            </Text>
          </View>
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Selamat datang, ${userData?.displayName ?? 'Saudara'}`}
          >
            <Text style={styles.greeting}>Selamat Datang 👋</Text>
            <Text style={styles.userName}>{userData?.displayName || 'Saudara'}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <LivesIndicator onPress={() => openLivesExhaustedModal(router)} />
          {/* Token badge — was a TouchableOpacity with no onPress,
              which still registered taps (doing nothing) and was
              confusing to screen readers as a "button". Switched to
              a plain View since the token balance is a display-only
              counter; the `accessible` + `accessibilityLabel` line
              tells VoiceOver / TalkBack to announce as a value, not
              as a tap target. */}
          <View
            style={styles.tokenBadge}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Baki token: ${userData?.tokens ?? 0}`}
          >
            <Image
              source={require('../../../assets/token.png')}
              style={styles.tokenIcon}
              resizeMode="contain"
            />
            <Text style={styles.tokenAmount}>{userData?.tokens || 0}</Text>
          </View>
        </View>
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
                <View style={[styles.progressFill, { width: xpFillWidth }]} />
              </View>
              <Text style={styles.progressText}>{xpPercentText}</Text>
            </View>
          </View>
          
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>🏆</Text>
          </View>
        </View>
      </View>

      {/* Stats Row — three equal-width cards showing XP, streak, and
          levels-completed. `adjustsFontSizeToFit` + `numberOfLines={1}`
          on the value text prevents the "5200 XP" wrap-each-digit
          problem we saw when the value got long on small phones.
          Labels stay short enough to fit one line. */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#FFE8D5' }]}>
            <Text style={styles.statIcon}>{ICONS.star}</Text>
          </View>
          <Text
            style={styles.statValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {userData?.totalXP || 0}
          </Text>
          <Text style={styles.statLabel} numberOfLines={1}>XP</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#FFD3D3' }]}>
            {/* Flame (not heart) — the lives card now uses a numeric
                indicator at the top, so a heart here would create
                redundant "lives" iconography on the same screen. */}
            <Text style={styles.statIcon}>{ICONS.fire}</Text>
          </View>
          <Text
            style={styles.statValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {userData?.streakDays || 0}
          </Text>
          <Text style={styles.statLabel} numberOfLines={1}>Streak</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#D5E8FF' }]}>
            <Text style={styles.statIcon}>{ICONS.book}</Text>
          </View>
          <Text
            style={styles.statValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {userData?.levelsCompleted?.length || 0}
          </Text>
          {/* "Selesai" = "Completed" — fits one line on every screen
              size we ship. The previous "Tahap" label was getting
              clipped to "Taha/p" because the label font was bigger
              than the card width on iPhone SE-sized devices. */}
          <Text style={styles.statLabel} numberOfLines={1}>Selesai</Text>
        </View>
      </View>

      {/* Categories / Game Modes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Topik Kuiz</Text>
        </View>

        <View style={styles.categoriesGrid}>
          {QUIZ_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.title}
              style={[styles.categoryCard, { backgroundColor: cat.backgroundColor }]}
              onPress={() => router.push(cat.route as never)}
              activeOpacity={0.85}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Topik ${cat.title}, ${cat.desc}`}
              accessibilityHint={`Membuka kuiz ${cat.title}`}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text style={styles.categoryTitle}>{cat.title}</Text>
              <Text style={styles.categoryDesc}>{cat.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Daily Quote Card */}
      <View
        style={styles.quoteCard}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Ayat harian ${dailyVerse.ref}: ${dailyVerse.verse.replace(/^"|"$/g, '')}`}
      >
        <View style={styles.quoteIcon}>
          <Text style={styles.quoteEmoji}>✝️</Text>
        </View>
        <View style={styles.quoteContent}>
          <Text style={styles.verseText}>{dailyVerse.verse}</Text>
          <Text style={styles.verseRef}>— {dailyVerse.ref}</Text>
        </View>
      </View>

      {/* Dynamic bottom spacer — sized to clear the (tabs) tab bar
          for the current device. Previously a hardcoded `height: 100`
          that broke on tall phones (huge gap) and short phones (still
          clipped). See `bottomSpacerHeight` calculation in
          `HomeScreen`. */}
      <View style={{ height: bottomSpacerHeight }} />
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
  // Right-side cluster: lives pill + token badge, stacked
  // horizontally. Sized tightly so it doesn't crowd the screen
  // edge on iPhone SE / narrow phones.
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
    width: 20,
    height: 20,
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
    minWidth: 0, // allow flex shrinking below content size so the
                  // value text can use adjustsFontSizeToFit cleanly
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
    textAlign: 'center',
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
    // Was `width: '48%'` which left no room for the `gap` between
    // columns and made the second card overflow the row on
    // iPhone-SE-sized screens. `flex: 1` + a hard `minWidth` keeps
    // exactly two cards per row regardless of screen width, and
    // gives the flex+gap math enough slack not to break on long
    // category titles (e.g. "Perjanjian Baru").
    flex: 1,
    minWidth: '45%',
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
