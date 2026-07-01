import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { TOTAL_LEVELS } from '@/types';

export default function QuizScreen() {
  const { userData } = useAuth();
  const router = useRouter();

  const handleLevelPress = (level: number) => {
    if (level <= (userData?.currentLevel || 1)) {
      router.push(`/quiz/${level}`);
    }
  };

  if (!userData) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const unlockedLevel = userData.currentLevel;

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>Pilih Tahap Kuiz</Text>
      <Text style={styles.subtitle}>
        Tahap kunci: {unlockedLevel}/{TOTAL_LEVELS}
      </Text>

      <View style={styles.levelsGrid}>
        {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((level) => {
          const isUnlocked = level <= unlockedLevel;
          const progress = userData.levelProgress[level];

          return (
            <TouchableOpacity
              key={level}
              style={[
                styles.levelCard,
                !isUnlocked && styles.lockedCard,
              ]}
              onPress={() => handleLevelPress(level)}
              disabled={!isUnlocked}
            >
              <Text style={[
                styles.levelNumber,
                !isUnlocked && styles.lockedText,
              ]}>
                {level}
              </Text>
              {progress && (
                <Text style={styles.completionBadge}>
                  V
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.lg,
  },
  levelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  levelCard: {
    width: '18%',
    aspectRatio: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  lockedCard: {
    backgroundColor: Colors.light.surfaceAlt,
  },
  levelNumber: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
  lockedText: {
    color: Colors.light.textSecondary,
  },
  completionBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    color: Colors.success,
    fontSize: 12,
  },
});
