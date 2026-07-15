import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, FontSize, FontFamily } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { TOTAL_LEVELS } from '@/types';

const CATEGORIES = [
  { id: 'alkitab', label: 'Alkitab', range: [1, 20], icon: 'book' as const },
  { id: 'sakramen', label: 'Sakramen', range: [21, 40], icon: 'business' as const },
  { id: 'liturgi', label: 'Liturgi', range: [41, 60], icon: 'globe' as const },
  { id: 'katekismus', label: 'Katekismus', range: [61, 80], icon: 'school' as const },
  { id: 'santo', label: 'Santo', range: [81, 100], icon: 'people' as const },
];

export default function PetaScreen() {
  const { userData } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentLevel = userData?.currentLevel ?? 1;
  const levelProgress = userData?.levelProgress ?? {};

  const levels = useMemo(() => {
    const arr: number[] = [];
    for (let i = 1; i <= TOTAL_LEVELS; i++) arr.push(i);
    return arr;
  }, []);

  const handleLevelPress = (level: number) => {
    if (level <= currentLevel) {
      router.push(Routes.QUIZ_LEVEL(level));
    } else {
      Alert.alert('Tahap Terkunci', 'Selesaikan tahap sebelumnya untuk membuka.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Peta Kuiz</Text>
        <Text style={styles.headerSub}>Tahap {currentLevel} / {TOTAL_LEVELS}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {CATEGORIES.map((cat) => {
          const start = cat.range[0];
          const end = cat.range[1];
          return (
            <View key={cat.id} style={styles.categorySection}>
              <View style={styles.catHeader}>
                <Ionicons name={cat.icon} size={18} color={Colors.text} />
                <Text style={styles.catLabel}>{cat.label}</Text>
              </View>
              <View style={styles.levelGrid}>
                {levels.slice(start - 1, end).map((level) => {
                  const prog = levelProgress[String(level)];
                  const isCompleted = prog?.completed === true;
                  const isCurrent = level === currentLevel;
                  const isLocked = level > currentLevel;

                  return (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.levelNode,
                        isCompleted && styles.nodeCompleted,
                        isCurrent && styles.nodeCurrent,
                        isLocked && styles.nodeLocked,
                      ]}
                      onPress={() => handleLevelPress(level)}
                      disabled={isLocked}
                      activeOpacity={0.7}
                    >
                      {isCompleted ? (
                        <Ionicons name="checkmark" size={20} color={Colors.white} />
                      ) : isCurrent ? (
                        <Ionicons name="play" size={20} color={Colors.white} />
                      ) : isLocked ? (
                        <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
                      ) : (
                        <Text style={styles.levelNum}>{level}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  headerSub: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },

  categorySection: {
    marginBottom: Spacing.lg,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  catLabel: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  levelNode: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeCompleted: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  nodeCurrent: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  nodeLocked: {
    opacity: 0.4,
  },
  levelNum: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
});
