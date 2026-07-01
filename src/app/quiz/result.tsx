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

  const shareAchievement = async () => {
    try {
      await Share.share({
        message: `Saya telah lulus Tahap ${levelNum} KatolikGo dengan skor ${scoreNum}%! #KatolikGo`,
      });
    } catch (error) {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Text style={styles.emoji}>!</Text>

        <Text style={styles.congrats}>Tahniah!</Text>

        {unlockedBool ? (
          <Text style={styles.unlocked}>Tahap baru telah dibuka!</Text>
        ) : (
          scoreNum >= 80 ? (
            <Text style={styles.passed}>Anda lulus tahap ini!</Text>
          ) : (
            <Text style={styles.failed}>Cuba lagi untuk lulus tahap ini</Text>
          )
        )}

        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Skor Anda</Text>
          <Text style={styles.scoreValue}>{scoreNum}%</Text>

          {tokensNum > 0 && (
            <View style={styles.rewardRow}>
              <Text style={styles.rewardText}>+ {tokensNum} Token</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareButton} onPress={shareAchievement}>
            <Text style={styles.shareText}>Kongsi Pencapaian</Text>
          </TouchableOpacity>

          <Link href="/(tabs)/quiz" asChild>
            <TouchableOpacity style={styles.continueButton}>
              <Text style={styles.continueText}>Kembali ke Kuiz</Text>
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
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  content: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: Spacing.md,
    color: Colors.accent,
  },
  congrats: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  unlocked: {
    fontSize: FontSize.lg,
    color: Colors.accent,
    marginBottom: Spacing.lg,
  },
  passed: {
    fontSize: FontSize.lg,
    color: Colors.success,
    marginBottom: Spacing.lg,
  },
  failed: {
    fontSize: FontSize.lg,
    color: Colors.error,
    marginBottom: Spacing.lg,
  },
  scoreCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    width: '100%',
  },
  scoreLabel: {
    fontSize: FontSize.md,
    color: Colors.white,
    opacity: 0.8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.white,
  },
  rewardRow: {
    marginTop: Spacing.md,
  },
  rewardText: {
    fontSize: FontSize.lg,
    color: Colors.accent,
    fontWeight: '600',
  },
  actions: {
    width: '100%',
    gap: Spacing.sm,
  },
  shareButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareText: {
    color: Colors.white,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueText: {
    color: Colors.white,
    fontWeight: '600',
  },
});
