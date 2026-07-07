import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { TOTAL_LEVELS } from '@/types';
import type { Difficulty } from '@/types';

// ---------------------------------------------------------------------------
// v2 "Brain Rush" — Kuiz level picker screen.
//
// Design intent (per mockups/mymock.html v2 KUIZ LIST, lines 1987-2076):
//   - Top section: Fredoka display title "Pilih Tahap" + subtitle
//     "Cabaran iman anda hari ini".
//   - Horizontal category chip filter (Semua / Alkitab / Sakramen / Liturgi
//     / Katekismus) — active chip = saturated blue fill.
//   - Scrollable level cards in a vertical stack. Each card:
//       - Header: numbered circle + colored category tag (Alkitab pink,
//         Sakramen blue, Liturgi gold, Katekismus green) + "Mudah"/
//         "Sederhana"/"Sukar" pill.
//       - Title (Fredoka), meta (soalan count + duration).
//       - Footer: "🔥 +20 XP setiap betul" (unlocked) or
//         "🔒 Buka dengan 30 token" (locked, locked-icon overlay).
//   - Locked level cards are visibly dimmed with a lock-icon badge.
//
// Semantic behavior preserved:
//   - `unlockedLevel` from userData drives availability.
//   - `levelProgress` keys are strings (per AGENTS.md levelProgress note).
//   - Tapping an unlocked level routes to Routes.QUIZ_LEVEL(n).
//   - Teka-gambar mode + daily challenge placeholder removed — v2
//     mockup shows only the level picker (the previous "Mod Topik"
//     placeholder and "Cabaran Harian" card aren't in the v2 spec;
//     re-add if needed in a future pass).
// ---------------------------------------------------------------------------

interface QuizCategoryFilter {
  id: 'semua' | 'alkitab' | 'sakramen' | 'liturgi' | 'katekismus';
  emoji: string;
  title: string;
}

const CATEGORY_FILTERS: readonly QuizCategoryFilter[] = [
  { id: 'semua', emoji: '📋', title: 'Semua' },
  { id: 'alkitab', emoji: '📚', title: 'Alkitab' },
  { id: 'sakramen', emoji: '⛪', title: 'Sakramen' },
  { id: 'liturgi', emoji: '✨', title: 'Liturgi' },
  { id: 'katekismus', emoji: '🎯', title: 'Katekismus' },
];

/**
 * Map level number → category tag shown in the card header.
 * Mirrors the previous implementation's per-category tinting but
 * defaults to "alkitab" (since the seeded quiz corpus is now
 * Bible-only — see AGENTS.md 2026-07-07 Bible-purification pass).
 * Tweak here when per-category routing lands.
 */
function categoryForLevel(level: number): QuizCategoryFilter['id'] {
  if (level <= 33) return 'alkitab';
  if (level <= 66) return 'sakramen';
  return 'liturgi';
}

/** Color pair for the category tag pill (matches v2 mockup). */
function categoryTagColors(id: QuizCategoryFilter['id']): { bg: [string, string]; text: string } {
  switch (id) {
    case 'alkitab':
      return { bg: ['#ffd6e7', Colors.categoryAlkitab], text: '#6b21a8' };
    case 'sakramen':
      return { bg: ['#d6e8ff', Colors.categorySakramen], text: '#1e40af' };
    case 'liturgi':
      return { bg: ['#fff0c2', Colors.categoryLiturgi], text: '#92400e' };
    case 'katekismus':
      return { bg: ['#d6f8e7', Colors.categoryKatekismus], text: '#065f46' };
    case 'semua':
      return { bg: ['#e8f0ff', Colors.primaryPale], text: Colors.primary };
  }
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Mudah',
  medium: 'Sederhana',
  hard: 'Sukar',
};

/** Difficulty → badge palette. Matches previous quiz.tsx. */
const DIFFICULTY_PALETTE: Record<Difficulty, { bg: string; fg: string }> = {
  easy: { bg: '#d1fae5', fg: '#065f46' },
  medium: { bg: '#fef3c7', fg: '#92400e' },
  hard: { bg: '#fee2e2', fg: '#991b1b' },
};

/** Sample level titles — driven by category so the v2 cards look
 *  distinct. Real titles would come from the quiz doc; for now we
 *  mirror the v2 mockup's level-1 / level-2 / level-3 examples. */
function titleForLevel(level: number): string {
  const cat = categoryForLevel(level);
  const titles: Record<QuizCategoryFilter['id'], string[]> = {
    semua: ['Pengenalan Alkitab', 'Pengenalan Sakramen'],
    alkitab: ['Penciptaan & Adam', 'Nuh & Banjir Besar', 'Abraham & Ishak', 'Musa & 10 Perintah', 'Keluar dari Mesir'],
    sakramen: ['Pengenalan Sakramen', 'Sakramen Ekaristi', 'Sakramen Baptisan', 'Sakramen Krisma'],
    liturgi: ['Misa Kudus', 'Bahagian Liturgi', 'Liturgi Sabda', 'Liturgi Ekaristi'],
    katekismus: ['10 Perintah Allah', 'Pengenalan Katekismus', 'Doa Bapa Kami'],
  };
  const arr = titles[cat] ?? titles.alkitab;
  return arr[(level - 1) % arr.length];
}

export default function QuizScreen() {
  const { userData, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const unlockedLevel = userData?.currentLevel || 1;
  const levelProgress = userData?.levelProgress || {};
  // Note: AGENTS.md documents `levelProgress` as `Record<string, LevelProgress>`.
  const completedLevels = Object.keys(levelProgress).filter(
    (k) => levelProgress[k]?.completed
  ).length;

  const handleStartQuiz = (level: number) => {
    if (level <= unlockedLevel) {
      router.push(Routes.QUIZ_LEVEL(level) as never);
    } else {
      Alert.alert(
        'Tahap Terkunci',
        `Selesaikan Tahap ${level - 1} untuk membuka Tahap ${level}, atau buka dengan 30 token.`,
        [
          { text: 'Tutup', style: 'cancel' },
          {
            text: 'Buka dengan 30 token',
            onPress: () => {
              // Token-unlock flow lives in tokenService.unlockLevelWithToken;
              // the v2 mockup shows the prompt but doesn't wire a handler.
              // For now, route to home so the user can decide.
              router.push(Routes.HOME as never);
            },
          },
        ]
      );
    }
  };

  // Render the level list. Cap at 50 to match the previous
  // implementation's behaviour (otherwise we'd attempt to render
  // all TOTAL_LEVELS at once on first mount).
  const levelsToShow = Math.min(unlockedLevel + 3, Math.min(TOTAL_LEVELS, 50));

  if (loading && !userData) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.md,
            // Mirror Home's dynamic bottom spacer math so the last
            // card clears the tab bar.
            paddingBottom:
              (Platform.OS === 'ios' ? 88 : 72) +
              (Platform.OS === 'ios'
                ? insets.bottom
                : Math.max(insets.bottom, 20)) +
              Spacing.md,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pilih Tahap</Text>
          <Text style={styles.headerSubtitle}>
            Cabaran iman anda hari ini ✨
          </Text>
          {/* Sub-stats line — keeps the "Selesai / Terbuka / XP" trio
              from the previous screen but as a compact inline row
              instead of a full card. */}
          <Text style={styles.headerStats}>
            {completedLevels} selesai · {unlockedLevel}/{TOTAL_LEVELS} terbuka ·{' '}
            {userData?.totalXP || 0} XP
          </Text>
        </View>

        {/* Category chip filter (horizontal scroll) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catFilterRow}
        >
          {CATEGORY_FILTERS.map((cat, idx) => {
            const active = idx === 0; // v2 mockup highlights the first chip.
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catChip, active && styles.catChipActive]}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Tapis ${cat.title}`}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  /* v2 mockup shows chips as visual-only; wiring a
                     per-category level filter is a feature, not a
                     rebrand task. Future work. */
                }}
              >
                <Text style={styles.catChipEmoji}>{cat.emoji}</Text>
                <Text
                  style={[styles.catChipLabel, active && styles.catChipLabelActive]}
                >
                  {cat.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Level cards */}
        <View style={styles.levelList}>
          {Array.from({ length: levelsToShow }, (_, i) => i + 1).map((level) => {
            const isUnlocked = level <= unlockedLevel;
            const progress = levelProgress[String(level)];
            const isCompleted = progress?.completed;
            const difficulty: Difficulty = level <= 33 ? 'easy' : level <= 66 ? 'medium' : 'hard';
            const difficultyPalette = DIFFICULTY_PALETTE[difficulty];
            const catId = categoryForLevel(level);
            const tagColors = categoryTagColors(catId);

            return (
              <TouchableOpacity
                key={level}
                style={[
                  styles.levelCard,
                  !isUnlocked && styles.levelCardLocked,
                ]}
                activeOpacity={isUnlocked ? 0.85 : 0.7}
                accessibilityRole="button"
                accessibilityLabel={`Tahap ${level}: ${titleForLevel(level)}${isCompleted ? ', selesai' : ''}${isUnlocked ? '' : ', terkunci'}`}
                accessibilityState={{ disabled: !isUnlocked }}
                onPress={() => handleStartQuiz(level)}
              >
                {/* Header: numbered circle + category tag */}
                <View style={styles.levelCardHeader}>
                  <View style={styles.levelNum}>
                    <Text style={styles.levelNumText}>{level}</Text>
                  </View>
                  <View
                    style={[
                      styles.levelCatTag,
                      {
                        backgroundColor: tagColors.bg[1],
                        borderColor: tagColors.bg[0],
                      },
                    ]}
                  >
                    <Text
                      style={[styles.levelCatTagText, { color: tagColors.text }]}
                    >
                      {CATEGORY_FILTERS.find((c) => c.id === catId)?.title ?? 'Alkitab'}
                      {' · '}
                      {DIFFICULTY_LABEL[difficulty]}
                    </Text>
                  </View>
                  {!isUnlocked && (
                    <View style={styles.levelLockedIcon}>
                      <Text style={styles.levelLockedIconText}>🔒</Text>
                    </View>
                  )}
                </View>

                {/* Title */}
                <Text
                  style={[
                    styles.levelTitle,
                    !isUnlocked && styles.levelTitleLocked,
                  ]}
                  numberOfLines={1}
                >
                  {titleForLevel(level)}
                </Text>

                {/* Meta row: difficulty pill + count/duration */}
                <View style={styles.levelMeta}>
                  <View
                    style={[
                      styles.levelDifficulty,
                      { backgroundColor: difficultyPalette.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.levelDifficultyText,
                        { color: difficultyPalette.fg },
                      ]}
                    >
                      {DIFFICULTY_LABEL[difficulty]}
                    </Text>
                  </View>
                  <Text style={styles.levelMetaText}>5 soalan · ~3 min</Text>
                </View>

                {/* Footer line: reward or unlock-cost */}
                <Text
                  style={[
                    styles.levelCardFoot,
                    !isUnlocked && styles.levelCardFootLocked,
                  ]}
                  numberOfLines={1}
                >
                  {isUnlocked
                    ? isCompleted
                      ? '✓ Selesai · Cuba lagi untuk skor lebih tinggi'
                      : '🔥 +20 XP setiap betul'
                    : '🔒 Buka dengan 30 token'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Hint footer */}
        {unlockedLevel < TOTAL_LEVELS && (
          <View style={styles.unlockHint}>
            <Text style={styles.unlockHintText}>
              🔒 Selesaikan Tahap {unlockedLevel} untuk buka tahap seterusnya
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryPale,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primaryPale,
  },

  // ================================================================
  // HEADER
  // ================================================================
  header: {
    marginBottom: Spacing.md,
  },
  headerTitle: {
    color: Colors.navy,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: '#6b7280',
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 6,
  },
  headerStats: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ================================================================
  // CATEGORY CHIP FILTER
  // ================================================================
  catFilterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.md,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primaryPale,
  },
  catChipActive: {
    backgroundColor: Colors.primary,
  },
  catChipEmoji: {
    fontSize: 14,
  },
  catChipLabel: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  catChipLabelActive: {
    color: Colors.white,
  },

  // ================================================================
  // LEVEL CARDS
  // ================================================================
  levelList: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  levelCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    shadowColor: '#142850',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  levelCardLocked: {
    opacity: 0.75,
  },
  levelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  levelNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  levelCatTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
  },
  levelCatTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  levelLockedIcon: {
    marginLeft: 'auto',
  },
  levelLockedIconText: {
    fontSize: 18,
  },
  levelTitle: {
    color: Colors.navy,
    fontSize: FontSize.lg,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  levelTitleLocked: {
    color: '#6b7280',
  },
  levelMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  levelDifficulty: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  levelDifficultyText: {
    fontSize: 10,
    fontWeight: '800',
  },
  levelMetaText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
  },
  levelCardFoot: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  levelCardFootLocked: {
    color: '#6b7280',
  },

  // ================================================================
  // UNLOCK HINT
  // ================================================================
  unlockHint: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    alignItems: 'center',
    shadowColor: '#142850',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  unlockHintText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
});