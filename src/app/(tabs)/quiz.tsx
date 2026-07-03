import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { TOTAL_LEVELS } from '@/types';
import { QUESTIONS_STATS } from '@/services/quizService';
import type { Difficulty } from '@/types';
import { useState } from 'react';

type GameMode = {
  id: 'classic' | 'teka-gambar';
  title: string;
  subtitle: string;
  description: string;
  emoji: string;
  badge?: string;
  badgeColor?: string;
  gradient: [string, string];
  stats: string;
};

const GAME_MODES: GameMode[] = [
  {
    id: 'classic',
    title: 'Kuiz Alkitab & Katolik',
    subtitle: 'Pelajaran & Latihan',
    description: 'Jawab soalan Perjanjian Lama, Baru, Sakramen, Liturgi & Katekismus',
    emoji: '📖',
    badge: 'Populer',
    badgeColor: Colors.accent,
    gradient: ['#1a3a5c', '#2a5a8c'],
    stats: `${QUESTIONS_STATS.totalClassic} Soalan`,
  },
  {
    id: 'teka-gambar',
    title: 'Teka Gambar',
    subtitle: '"Siapa Saya?"',
    description: 'Teka tokoh Alkitab, Para Kudus, Paus & objek liturgi',
    emoji: '🖼️',
    badge: 'Visual',
    badgeColor: Colors.success,
    gradient: ['#7B1FA2', '#9C27B0'],
    stats: `${QUESTIONS_STATS.totalTekaGambar} Soalan`,
  },
];

export default function QuizScreen() {
  const { userData, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [showLevelSelector, setShowLevelSelector] = useState(false);

  const unlockedLevel = userData?.currentLevel || 1;
  const totalXP = userData?.totalXP || 0;
  const levelProgress = userData?.levelProgress || {};
  const completedLevels = Object.keys(levelProgress).filter(
    (k) => levelProgress[Number(k)]?.completed
  ).length;

  const handleStartQuiz = (level: number) => {
    if (level <= unlockedLevel) {
      router.push(`/quiz/${level}` as any);
    }
  };

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
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mod Kuiz</Text>
          <Text style={styles.headerSubtitle}>Pilih cabaran kegemaran anda</Text>
        </View>

        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{completedLevels}</Text>
            <Text style={styles.miniStatLabel}>Selesai</Text>
          </View>
          <View style={styles.miniStatDivider} />
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{unlockedLevel}/{TOTAL_LEVELS}</Text>
            <Text style={styles.miniStatLabel}>Tahap Terbuka</Text>
          </View>
          <View style={styles.miniStatDivider} />
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{totalXP}</Text>
            <Text style={styles.miniStatLabel}>Jumlah XP</Text>
          </View>
        </View>

        {/* Game Modes */}
        <Text style={styles.sectionTitle}>Mod Permainan</Text>
        
        <View style={styles.modesContainer}>
          {GAME_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[styles.modeCard, { backgroundColor: mode.gradient[0] }]}
              onPress={() => {
                if (mode.id === 'teka-gambar') {
                  Alert.alert('Teka Gambar', 'Mod visual akan datang tidak lama lagi!');
                } else {
                  setShowLevelSelector(!showLevelSelector);
                }
              }}
              activeOpacity={0.85}
            >
              {mode.badge && (
                <View style={[styles.modeBadge, { backgroundColor: mode.badgeColor }]}>
                  <Text style={styles.modeBadgeText}>{mode.badge}</Text>
                </View>
              )}
              
              <View style={styles.modeContent}>
                <View style={styles.modeLeft}>
                  <Text style={styles.modeEmoji}>{mode.emoji}</Text>
                </View>
                <View style={styles.modeRight}>
                  <Text style={styles.modeSubtitle}>{mode.subtitle}</Text>
                  <Text style={styles.modeTitle}>{mode.title}</Text>
                  <Text style={styles.modeDescription}>{mode.description}</Text>
                  <View style={styles.modeStatsBadge}>
                    <Text style={styles.modeStatsText}>{mode.stats}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.modeArrow}>
                <Text style={styles.modeArrowText}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Level Selection Panel */}
        {showLevelSelector && (
          <View style={styles.levelPanel}>
            <View style={styles.levelPanelHeader}>
              <Text style={styles.levelPanelTitle}>📚 Pilih Tahap Kuiz</Text>
              <TouchableOpacity onPress={() => setShowLevelSelector(false)}>
                <Text style={styles.closeBtn}>✕ Tutup</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.levelPanelHint}>
              Tahap {unlockedLevel} sudah terbuka untuk anda
            </Text>
            
            <View style={styles.levelGrid}>
              {[...Array(Math.min(unlockedLevel, 50))].map((_, i) => {
                const level = i + 1;
                const progress = levelProgress[level];
                const isCompleted = progress?.completed;
                const difficulty: Difficulty = level <= 33 ? 'easy' : level <= 66 ? 'medium' : 'hard';
                const difficultyColor = difficulty === 'easy' ? '#22C55E' : difficulty === 'medium' ? '#F59E0B' : '#EF4444';

                return (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.levelBtn,
                      isCompleted && styles.levelBtnCompleted,
                      { borderColor: difficultyColor },
                    ]}
                    onPress={() => handleStartQuiz(level)}
                    activeOpacity={0.7}
                  >
                    {isCompleted && <Text style={styles.checkIcon}>✓</Text>}
                    <Text style={[
                      styles.levelBtnText,
                      isCompleted && styles.levelBtnTextCompleted,
                    ]}>
                      {level}
                    </Text>
                    <Text style={[styles.difficultyDot, { backgroundColor: difficultyColor }]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {unlockedLevel < TOTAL_LEVELS && (
              <View style={styles.lockedHint}>
                <Text style={styles.lockedHintText}>
                  🔒 Selesaikan Tahap {unlockedLevel} untuk buka tahap seterusnya
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Topik Pantas removed — game mode (Mod Permainan) already
            covers all unlocked levels. Placeholder reserves the slot in
            case a topic-based quick-play gets added back later. */}
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderEmoji}>🎯</Text>
          <Text style={styles.placeholderTitle}>Mod Topik</Text>
          <Text style={styles.placeholderHint}>Akan ditambah tidak lama lagi</Text>
        </View>

        {/* Daily Challenge */}
        <TouchableOpacity style={styles.dailyCard} onPress={() => Alert.alert('Cabaran Harian', 'Memuatkan...')}>
          <View style={styles.dailyLeft}>
            <Text style={styles.dailyEmoji}>🎯</Text>
          </View>
          <View style={styles.dailyContent}>
            <Text style={styles.dailyTitle}>Cabaran Harian</Text>
            <Text style={styles.dailySubtitle}>5 soalan khas — +50 XP!</Text>
          </View>
          <View style={styles.dailyButton}>
            <Text style={styles.dailyButtonText}>Main</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  
  // Header
  header: { marginBottom: Spacing.lg },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  miniStat: { flex: 1, alignItems: 'center' },
  miniStatDivider: { width: 1, backgroundColor: Colors.light.border },
  miniStatValue: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  miniStatLabel: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  
  // Sections
  sectionHeader: { marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  sectionSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },

  // Placeholder box (reserved slot for "Topik Pantas" — currently unused)
  placeholderBox: {
    backgroundColor: Colors.light.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  placeholderEmoji: {
    fontSize: 28,
    marginBottom: Spacing.xs,
    opacity: 0.6,
  },
  placeholderTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  placeholderHint: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    marginTop: 2,
    opacity: 0.8,
  },
  
  // Game Modes
  modesContainer: { marginBottom: Spacing.lg, gap: Spacing.sm },
  modeCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    position: 'relative',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  modeBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
    zIndex: 1,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.white,
  },
  modeContent: { flexDirection: 'row', alignItems: 'center', paddingRight: 40 },
  modeLeft: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  modeEmoji: { fontSize: 36 },
  modeRight: { flex: 1 },
  modeSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: '600',
    marginBottom: 2,
  },
  modeTitle: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 2,
  },
  modeDescription: {
    fontSize: 11,
    color: Colors.white,
    opacity: 0.8,
    lineHeight: 14,
    marginBottom: 4,
  },
  modeStatsBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
    alignSelf: 'flex-start',
  },
  modeStatsText: { fontSize: 10, color: Colors.white, fontWeight: '600' },
  modeArrow: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeArrowText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    marginTop: -3,
  },
  
  // Level Selection Panel
  levelPanel: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  levelPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  levelPanelTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  closeBtn: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  levelPanelHint: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  levelBtn: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    position: 'relative',
  },
  levelBtnCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  levelBtnText: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.white,
  },
  levelBtnTextCompleted: { color: Colors.white },
  checkIcon: {
    position: 'absolute',
    top: 2,
    right: 2,
    fontSize: 10,
    color: Colors.white,
    fontWeight: 'bold',
  },
  difficultyDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  lockedHint: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  lockedHintText: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },

  // Daily Challenge
  dailyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  dailyLeft: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  dailyEmoji: { fontSize: 24 },
  dailyContent: { flex: 1 },
  dailyTitle: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.white,
  },
  dailySubtitle: {
    fontSize: FontSize.xs,
    color: Colors.white,
    opacity: 0.85,
    marginTop: 2,
  },
  dailyButton: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
  },
  dailyButtonText: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.accent,
  },
});
