import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';
import { Routes } from '@/constants/routes';

export default function ResultScreen() {
  const params = useLocalSearchParams<{
    level: string;
    score: string;
    correct: string;
    total: string;
    xp: string;
    tokens: string;
    passed: string;
  }>();
  const router = useRouter();

  const scoreNum = Number(params.score) || 0;
  const correctNum = Number(params.correct) || 0;
  const totalNum = Number(params.total) || 0;
  const xpNum = Number(params.xp) || 0;
  const tokensNum = Number(params.tokens) || 0;
  const passed = params.passed === '1';

  return (
    <View style={styles.container}>
      {/* Score Circle */}
      <View style={styles.scoreSection}>
        <View style={[styles.scoreRing, passed ? styles.scoreRingPass : styles.scoreRingFail]}>
          <Text style={styles.scoreText}>{scoreNum}%</Text>
        </View>
        <Text style={[styles.resultLabel, passed ? styles.passText : styles.failText]}>
          {passed ? 'Tahniah!' : 'Cuba Lagi'}
        </Text>
      </View>

      {/* Stats Bento */}
      <View style={styles.bento}>
        <View style={styles.bentoCard}>
          <Ionicons name="close-circle" size={24} color={Colors.error} />
          <Text style={styles.bentoVal}>{totalNum - correctNum}</Text>
          <Text style={styles.bentoLabel}>Salah</Text>
        </View>
        <View style={styles.bentoCard}>
          <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
          <Text style={styles.bentoVal}>{correctNum}</Text>
          <Text style={styles.bentoLabel}>Betul</Text>
        </View>
      </View>

      {/* Rewards */}
      <View style={styles.rewardsCard}>
        <View style={styles.rewardItem}>
          <Ionicons name="star" size={22} color={Colors.secondary} />
          <Text style={styles.rewardVal}>+{xpNum} XP</Text>
        </View>
        <View style={styles.rewardDivider} />
        <View style={styles.rewardItem}>
          <Ionicons name="ribbon" size={22} color={Colors.secondary} />
          <Text style={styles.rewardVal}>+{tokensNum} Token</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => router.replace(Routes.PETA)}
        >
          <Text style={styles.ctaText}>Kembali ke Peta</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace(Routes.HOME)}
        >
          <Text style={styles.secondaryText}>Halaman Utama</Text>
        </TouchableOpacity>
      </View>

      {/* Verse */}
      <Text style={styles.verse}>{'\u201C'}Mampu melakukan segala sesuatu melalui Dia yang menguatkan aku.{'\u201D'}</Text>
      <Text style={styles.verseRef}>— Filipi 4:13</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 80,
  },

  scoreSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  scoreRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  scoreRingPass: {
    borderColor: Colors.secondary,
    shadowColor: 'rgba(236,194,70,0.4)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 8,
  },
  scoreRingFail: {
    borderColor: Colors.error,
  },
  scoreText: {
    fontSize: 36,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
  },
  resultLabel: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
  },
  passText: { color: Colors.secondary },
  failText: { color: Colors.error },

  // Bento
  bento: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  bentoCard: {
    flex: 1,
    backgroundColor: 'rgba(14,42,77,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.15)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  bentoVal: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
  },
  bentoLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
  },

  // Rewards
  rewardsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(14,42,77,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.3)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rewardVal: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.secondary,
  },
  rewardDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(236,194,70,0.2)',
  },

  // Actions
  actions: {
    width: '100%',
    gap: 10,
    marginBottom: Spacing.xl,
  },
  ctaBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.sm,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.navyDark,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.2)',
    borderRadius: BorderRadius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },

  // Verse
  verse: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontStyle: 'italic',
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 4,
  },
  verseRef: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.secondary,
    opacity: 0.6,
  },
});
