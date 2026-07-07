import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LivesIndicator, openLivesExhaustedModal } from '@/components/LivesIndicator';
import { GuestModeBanner } from '@/components/GuestModeBanner';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { getXpProgress } from '@/constants/xp.constants';

// ---------------------------------------------------------------------------
// v2 "Brain Rush" — Home screen.
//
// Design intent (per mockups/mymock.html v2 tokens, lines 153-177 +
// v2 HOME STYLES lines 1858-1985):
//   - Top 38% saturated blue gradient with white text + golden "name"
//     highlight (Home header).
//   - 3 glass "stat pills" (Tahap / Total XP / Nyawa) inside the header —
//     each pill: white circle emoji, value (Fredoka display), label.
//   - Horizontal scrollable category chip row (Alkitab / Sakramen / Liturgi
//     / Katekismus / Santo) — active chip = bright yellow CTA pill with
//     embedded colored emoji circle.
//   - Bottom 62% pale blue (`primaryPale`) surface hosting the section
//     title "Kuiz Terkini" + scrollable quiz list (white card, colored
//     category icon, name, meta line, blue chevron circle).
//   - Daily verse card at the bottom with gold accent line.
//
// Semantic stays 100% identical to the previous Home (XP progress,
// currentLevel, lives, daily verse rotation, guest banner, navigates
// to level 1). Only the visual layer changed.
// ---------------------------------------------------------------------------

interface QuizCategoryChip {
  id: string;
  emoji: string;
  title: string;
  /** v2 color pair for the chip icon background (CSS gradient feel in RN). */
  iconColors: [string, string];
}

const QUIZ_CATEGORIES: readonly QuizCategoryChip[] = [
  { id: 'alkitab', emoji: '📚', title: 'Alkitab', iconColors: ['#ffd6e7', Colors.categoryAlkitab] },
  { id: 'sakramen', emoji: '⛪', title: 'Sakramen', iconColors: ['#d6e8ff', Colors.categorySakramen] },
  { id: 'liturgi', emoji: '✨', title: 'Liturgi', iconColors: ['#fff0c2', Colors.categoryLiturgi] },
  { id: 'katekismus', emoji: '🎯', title: 'Katekismus', iconColors: ['#d6f8e7', Colors.categoryKatekismus] },
  { id: 'santo', emoji: '🕊️', title: 'Santo', iconColors: ['#ffe4d6', Colors.categorySanto] },
];

interface DailyVerse {
  verse: string;
  ref: string;
}

const DAILY_VERSES: readonly DailyVerse[] = [
  { verse: '“Sebarkanlah Injil ke segala makhluk, sebab di situlah Iman sejati.”', ref: 'Markus 16:15' },
  { verse: '“Aku adalah jalan, kebenaran, dan kehidupan. Tiada seorang pun yang datang kepada Bapa, melainkan melalui Aku.”', ref: 'Yohanes 14:6' },
  { verse: '“Kasihilah Tuhan, Allahmu, dengan segenap hatimu dan dengan segenap jiwamu dan dengan segenap akal budimu.”', ref: 'Matius 22:37' },
  { verse: '“Berbahagialah orang yang miskin di hadapan Allah, kerana mereka yang memiliki Kerajaan Surga.”', ref: 'Matius 5:3' },
  { verse: '“Janganlah takut, sebab Aku menyertai engkau ke manapun engkau pergi.”', ref: 'Kejadian 28:15' },
  { verse: '“Segala sesuatu dapat dilakukan bagi orang yang percaya.”', ref: 'Markus 9:23' },
  { verse: '“Aku memberikan kepadamu kehidupan yang kekal; mereka tidak akan binasa untuk selama-lamanya.”', ref: 'Yohanes 10:28' },
  { verse: '“Hendaklah kamu saling mengasihi, seperti Aku telah mengasihi kamu.”', ref: 'Yohanes 13:34' },
  { verse: '“Berbahagialah orang yang membawa damai, kerana mereka akan dinamai anak-anak Allah.”', ref: 'Matius 5:9' },
  { verse: '“Percayalah kepada Tuhan Yesus, maka kamu dan seisi rumahmu akan diselamatkan.”', ref: 'Kisah Para Rasul 16:31' },
  { verse: '“TUHAN adalah gembalaku, aku tidak kekurangan suatu apa pun.”', ref: 'Mazmur 23:1' },
  { verse: '“Datanglah kepada-Ku, semua yang letih lesu dan menanggung beban, maka Aku akan memberi kelegaan kepadamu.”', ref: 'Matius 11:28' },
];

/** DST-safe day-of-year index. Mirrors previous Home implementation. */
function dayOfYearIndex(now: Date = new Date()): number {
  const start = new Date(now.getFullYear(), 0, 1);
  const ms = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default function HomeScreen() {
  const { userData } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const xpProgress = getXpProgress(userData?.totalXP || 0);

  const dailyVerse = DAILY_VERSES[dayOfYearIndex() % DAILY_VERSES.length];

  // v2 visual: bottom 62% pale blue surface needs enough content to
  // fill without a giant blank gap on tall phones, but doesn't need
  // to push content under the tab bar. Same dynamic-spacer trick as
  // before — clear the tab bar on every device class.
  const tabBarBaseHeight = Platform.OS === 'ios' ? 88 : 72;
  const tabBarPaddingBottom =
    Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 20);
  const bottomSpacerHeight = Math.max(
    tabBarBaseHeight + tabBarPaddingBottom + Spacing.md,
    screenHeight * 0.04
  );

  const userName = userData?.displayName || 'Saudara';

  return (
    <View style={styles.root}>
      {/* Guest banner — sits inside the scrollable pale-blue body so it
          reads as "above" the regular content but stays clear of the
          blue header gradient. */}
      {userData?.isGuest && (
        <View style={[styles.guestBannerWrap, { paddingTop: insets.top + 8 }]}>
          <GuestModeBanner />
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            // If the guest banner is rendered, push the blue header
            // down so it doesn't overlap the banner.
            paddingTop: userData?.isGuest ? Spacing.sm : insets.top + Spacing.sm,
            paddingBottom: bottomSpacerHeight,
          },
        ]}
      >
        {/* ============================================================
            BLUE HEADER (38% of screen) — greeting + bell + 3 stat pills
            ============================================================ */}
        <View
          style={[
            styles.header,
            userData?.isGuest ? { paddingTop: Spacing.sm } : null,
          ]}
        >
          {/* Greeting row */}
          <View style={styles.greetingRow}>
            <View
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Selamat datang, ${userName}`}
            >
              <Text style={styles.helloText}>
                Hai, <Text style={styles.helloName}>{userName}!</Text>
              </Text>
            </View>

            {/* Bell + token badge cluster — sits on the right side of
                the greeting row. LivesIndicator uses the existing
                pill component (which already handles tap-to-refill). */}
            <View style={styles.headerRightCluster}>
              <LivesIndicator onPress={() => openLivesExhaustedModal(router)} />
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
                <Text style={styles.tokenAmount}>{userData?.tokens ?? 0}</Text>
              </View>
            </View>
          </View>

          {/* Stat pills row (Tahap / Total XP / Nyawa) */}
          <View style={styles.statPillsRow}>
            <View style={styles.statPill}>
              <View style={styles.statPillEmoji}>
                <Text style={styles.statPillEmojiText}>📊</Text>
              </View>
              <View>
                <Text style={styles.statPillVal}>{userData?.currentLevel || 1}</Text>
                <Text style={styles.statPillLabel}>Tahap</Text>
              </View>
            </View>
            <View style={styles.statPill}>
              <View style={styles.statPillEmoji}>
                <Text style={styles.statPillEmojiText}>⚡</Text>
              </View>
              <View>
                <Text style={styles.statPillVal}>{userData?.totalXP || 0}</Text>
                <Text style={styles.statPillLabel}>Total XP</Text>
              </View>
            </View>
            <View style={styles.statPill}>
              <View style={styles.statPillEmoji}>
                <Text style={styles.statPillEmojiText}>❤️</Text>
              </View>
              <View>
                {/* LivesIndicator 'inline' variant is too wide for
                    this compact pill — render a plain "{n}/{MAX}" line
                    that stays within the pill height. */}
                <Text style={styles.statPillVal}>
                  {(userData as { lives?: number } | null)?.lives ?? 5}/5
                </Text>
                <Text style={styles.statPillLabel}>Nyawa</Text>
              </View>
            </View>
          </View>

          {/* XP progress bar — small inline pill directly under the
              stat pills. Carries over the previous Home's XP-derived
              progress; visual is a slim translucent bar with bright
              yellow fill, so it feels native to the blue header. */}
          <View style={styles.xpBarWrap}>
            <View style={styles.xpBarTrack}>
              <View
                style={[
                  styles.xpBarFill,
                  {
                    width: `${Math.max(
                      0,
                      Math.min(100, xpProgress.percentage)
                    )}%` as `${number}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.xpBarLabel}>
              {xpProgress.current} / {xpProgress.required} XP
            </Text>
          </View>
        </View>

        {/* ============================================================
            PALE BLUE BODY — category chips + Kuiz Terkini list
            ============================================================ */}
        {/* Horizontal scrolling category chip row.
            showsHorizontalScrollIndicator=false for clean look. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {QUIZ_CATEGORIES.map((cat, idx) => {
            const active = idx === 0; // v2 mockup highlights the first chip.
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catChip, active && styles.catChipActive]}
                activeOpacity={0.85}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Topik ${cat.title}`}
                accessibilityHint={`Tapis kuiz ikut topik ${cat.title}`}
                onPress={() => router.push(Routes.QUIZ_LEVEL(1) as never)}
              >
                <View
                  style={[
                    styles.catChipEmoji,
                    {
                      // Mimic CSS linear-gradient via backgroundColor;
                      // RN doesn't render two-color gradients without
                      // an extra lib, so we pick the deeper color and
                      // add a subtle border for the gradient feel.
                      backgroundColor: cat.iconColors[1],
                      borderColor: cat.iconColors[0],
                    },
                  ]}
                >
                  <Text style={styles.catChipEmojiText}>{cat.emoji}</Text>
                </View>
                <Text
                  style={[styles.catChipLabel, active && styles.catChipLabelActive]}
                >
                  {cat.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Kuiz Terkini section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Kuiz Terkini</Text>
            <TouchableOpacity
              onPress={() => router.push(Routes.QUIZ_PICKER as never)}
              accessibilityRole="button"
              accessibilityLabel="Lihat semua kuiz"
            >
              <Text style={styles.seeAll}>Lihat semua ›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quizList}>
            {QUIZ_CATEGORIES.slice(0, 4).map((cat) => (
              <TouchableOpacity
                key={`quiz-${cat.id}`}
                style={styles.quizCard}
                activeOpacity={0.85}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Buka kuiz ${cat.title}`}
                accessibilityHint={`Memulakan kuiz tahap 1 topik ${cat.title}`}
                onPress={() => router.push(Routes.QUIZ_LEVEL(1) as never)}
              >
                <View
                  style={[
                    styles.quizIcon,
                    {
                      backgroundColor: cat.iconColors[1],
                      borderColor: cat.iconColors[0],
                    },
                  ]}
                >
                  <Text style={styles.quizIconText}>{cat.emoji}</Text>
                </View>
                <View style={styles.quizInfo}>
                  <Text style={styles.quizName} numberOfLines={1}>
                    {cat.title} — Tahap 1
                  </Text>
                  <Text style={styles.quizMeta}>
                    <Text style={styles.quizStar}>★</Text> Tahap 1 · 5 soalan
                  </Text>
                </View>
                <View style={styles.quizChevron}>
                  <Text style={styles.quizChevronText}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ============================================================
            DAILY VERSE CARD — pale blue body with gold accent line
            ============================================================ */}
        <View
          style={styles.verseCard}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Ayat harian ${dailyVerse.ref}: ${dailyVerse.verse.replace(/^"|"$/g, '')}`}
        >
          <View style={styles.verseIcon}>
            <Text style={styles.verseIconText}>✝️</Text>
          </View>
          <View style={styles.verseContent}>
            <Text style={styles.verseText}>{dailyVerse.verse}</Text>
            <Text style={styles.verseRef}>— {dailyVerse.ref}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.primaryPale,
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
  guestBannerWrap: {
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: Spacing.lg,
  },

  // ================================================================
  // BLUE HEADER
  // ================================================================
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  helloText: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  helloName: {
    color: Colors.cta,
  },
  headerRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cta,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    gap: 4,
  },
  tokenIcon: {
    width: 18,
    height: 18,
  },
  tokenAmount: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.navy,
  },

  // Stat pills row
  statPillsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BorderRadius.inner,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  statPillEmoji: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statPillEmojiText: {
    fontSize: 14,
  },
  statPillVal: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '800',
    lineHeight: 18,
  },
  statPillLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // XP bar
  xpBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  xpBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.cta,
  },
  xpBarLabel: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.9,
    minWidth: 80,
    textAlign: 'right',
  },

  // ================================================================
  // CATEGORY CHIPS (horizontal scroll)
  // ================================================================
  catRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.md,
    borderRadius: BorderRadius.round,
    shadowColor: '#142850',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  catChipActive: {
    backgroundColor: Colors.cta,
  },
  catChipEmoji: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  catChipEmojiText: {
    fontSize: 14,
  },
  catChipLabel: {
    color: Colors.navy,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  catChipLabelActive: {
    color: Colors.navy,
  },

  // ================================================================
  // KUIZ TERKINI SECTION
  // ================================================================
  section: {
    paddingHorizontal: Spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.navy,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  seeAll: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  quizList: {
    gap: Spacing.sm,
  },
  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    gap: Spacing.md,
    shadowColor: '#142850',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  quizIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.inner,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  quizIconText: {
    fontSize: 24,
  },
  quizInfo: {
    flex: 1,
    minWidth: 0,
  },
  quizName: {
    color: Colors.navy,
    fontSize: FontSize.md,
    fontWeight: '800',
    lineHeight: 18,
  },
  quizMeta: {
    color: '#6b7280',
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginTop: 4,
  },
  quizStar: {
    color: Colors.accent,
  },
  quizChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizChevronText: {
    color: Colors.primary,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
  },

  // ================================================================
  // DAILY VERSE CARD
  // ================================================================
  verseCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    alignItems: 'flex-start',
    shadowColor: '#142850',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  verseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryPale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  verseIconText: {
    fontSize: 20,
  },
  verseContent: {
    flex: 1,
  },
  verseText: {
    color: Colors.navy,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    fontWeight: '600',
    lineHeight: 20,
  },
  verseRef: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: '800',
    marginTop: Spacing.sm,
  },
});