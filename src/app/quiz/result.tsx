import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, Link } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

export default function QuizResultScreen() {
  const { level, score, tokens, unlocked } = useLocalSearchParams<{
    level: string;
    score: string;
    tokens: string;
    unlocked: string;
  }>();
  const insets = useSafeAreaInsets();

  const scoreNum = parseInt(score || '0', 10);
  const tokensNum = parseInt(tokens || '0', 10);
  const unlockedBool = unlocked === 'true';
  const levelNum = parseInt(level || '1', 10);

  const isPerfect = scoreNum === 100;
  const isPassed = scoreNum >= 80;

  let achievementTitle = 'Teruskan Usaha!';
  let achievementSubtitle = 'Cuba lagi untuk mencapai skor sempurna';
  let achievementEmoji = '💪';

  if (isPerfect) {
    achievementTitle = 'Skor Sempurna!';
    achievementSubtitle = 'Prestasi cemerlang anda menetapkan standard keunggulan untuk semua orang';
    achievementEmoji = '🏆';
  } else if (isPassed) {
    achievementTitle = 'Tahniah!';
    achievementSubtitle = 'Anda telah lulus tahap ini dengan jayanya';
    achievementEmoji = '🎉';
  }

  const shareAchievement = async () => {
    try {
      await Share.share({
        message: `Saya telah ${isPerfect ? 'memperolehi skor sempurna' : 'lulus'} di Tahap ${levelNum} KatolikGo dengan skor ${scoreNum}%! ${tokensNum > 0 ? `+${tokensNum} token` : ''} #KatolikGo`,
      });
    } catch {
      // user cancelled share sheet; nothing to do
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Visual Section */}
      <View style={styles.topSection}>
        {/* Decorative sparkles */}
        <Text style={[styles.sparkle, styles.sparkleLeft]}>✨</Text>
        <Text style={[styles.sparkle, styles.sparkleRight]}>⭐</Text>

        {/* Achievement icon */}
        <View style={[styles.iconCircle, isPerfect && styles.iconCircleGold]}>
          <Text style={styles.iconEmoji}>{achievementEmoji}</Text>
        </View>

        {/* Confetti for perfect score */}
        {isPerfect && (
          <>
            <Text style={[styles.confetti, { top: '20%', left: '10%' }]}>🎊</Text>
            <Text style={[styles.confetti, { top: '30%', right: '15%' }]}>🎉</Text>
            <Text style={[styles.confetti, { bottom: '10%', left: '20%' }]}>⭐</Text>
            <Text style={[styles.confetti, { bottom: '20%', right: '10%' }]}>✨</Text>
          </>
        )}
      </View>

      {/* Content Card */}
      <View style={styles.contentCard}>
        <Text style={styles.achievementTitle}>{achievementTitle}</Text>
        <Text style={styles.achievementSubtitle}>{achievementSubtitle}</Text>

        {/* Score Display */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Skor Anda</Text>
          <Text style={[styles.scoreValue, isPerfect && styles.scoreValueGold]}>
            {scoreNum}%
          </Text>

          {/* Reward Indicator */}
          {tokensNum > 0 && (
            <View style={styles.rewardBadge}>
              <View style={styles.coinStack}>
                <Text style={styles.coinEmoji}>🪙</Text>
              </View>
              <View style={styles.coinPill}>
                <Text style={styles.coinPillText}>+{tokensNum}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Level Badge */}
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeLabel}>TAHAP</Text>
          <Text style={styles.levelBadgeValue}>{levelNum}</Text>
        </View>

        {/* Unlocked notification */}
        {unlockedBool && (
          <View style={styles.unlockedBanner}>
            <Text style={styles.unlockedEmoji}>🔓</Text>
            <Text style={styles.unlockedText}>Tahap {levelNum + 1} dibuka!</Text>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.actions}>
          {unlockedBool || isPassed ? (
            <Link href="/(tabs)/quiz" asChild>
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  {unlockedBool ? `Tahap ${levelNum + 1} →` : 'Tahap Seterusnya →'}
                </Text>
              </TouchableOpacity>
            </Link>
          ) : null}

          <TouchableOpacity style={styles.secondaryButton} onPress={shareAchievement}>
            <Text style={styles.secondaryButtonText}>Kongsi dengan Rakan</Text>
          </TouchableOpacity>

          <Link href="/(tabs)/quiz" asChild>
            <TouchableOpacity style={styles.tertiaryButton}>
              <Text style={styles.tertiaryButtonText}>Kembali ke Kuiz</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8EC', // warm cream background
  },
  topSection: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8EC',
    position: 'relative',
  },
  sparkle: {
    position: 'absolute',
    fontSize: 24,
  },
  sparkleLeft: {
    top: 80,
    left: 30,
    fontSize: 28,
  },
  sparkleRight: {
    top: 100,
    right: 40,
    fontSize: 22,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FFE8D5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 6,
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  iconCircleGold: {
    backgroundColor: '#FFE8D5',
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
  },
  iconEmoji: {
    fontSize: 80,
  },
  confetti: {
    position: 'absolute',
    fontSize: 24,
  },
  contentCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    marginTop: -32,
    alignItems: 'center',
  },
  achievementTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  achievementSubtitle: {
    fontSize: FontSize.md,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  scoreCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.md,
    width: '100%',
  },
  scoreLabel: {
    fontSize: FontSize.sm,
    color: Colors.white,
    opacity: 0.8,
    marginBottom: 4,
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: 'bold',
    color: Colors.white,
    lineHeight: 64,
  },
  scoreValueGold: {
    color: Colors.accent,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 8,
  },
  coinStack: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinEmoji: {
    fontSize: 24,
  },
  coinPill: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  coinPillText: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.white,
  },
  levelBadge: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  levelBadgeLabel: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  levelBadgeValue: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  unlockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    marginBottom: Spacing.lg,
    gap: 6,
  },
  unlockedEmoji: {
    fontSize: 16,
  },
  unlockedText: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.success,
  },
  actions: {
    width: '100%',
    gap: Spacing.sm,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  tertiaryButton: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    color: Colors.light.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});