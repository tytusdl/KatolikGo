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
  { id: 'alkitab', label: 'Alkitab', range: [1, 20] },
  { id: 'sakramen', label: 'Sakramen', range: [21, 40] },
  { id: 'liturgi', label: 'Liturgi', range: [41, 60] },
  { id: 'katekismus', label: 'Katekismus', range: [61, 80] },
  { id: 'santo', label: 'Santo', range: [81, 100] },
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
              <Text style={styles.catLabel}>{cat.label}</Text>
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
                    >
                      {isCompleted && (
                        <Ionicons name="checkmark" size={18} color={Colors.navyDark} />
                      )}
                      {isCurrent && (
                        <Ionicons name="play" size={18} color={Colors.navyDark} />
                      )}
                      {isLocked && (
                        <Ionicons name="lock-closed" size={14} color={Colors.onSurfaceVariant} />
                      )}
                      {!isCompleted && !isCurrent && !isLocked && (
                        <Text style={styles.levelNum}>{level}</Text>
                      )}
                      {(isCompleted || isCurrent) && (
                        <Text style={styles.levelNumActive}>{level}</Text>
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: 'rgba(18,20,17,0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(236,194,70,0.1)',
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.secondary,
  },
  headerSub: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },

  // Category
  categorySection: {
    marginBottom: Spacing.lg,
  },
  catLabel: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
    marginBottom: Spacing.sm,
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
    backgroundColor: 'rgba(14,42,77,0.6)',
    borderWidth: 2,
    borderColor: 'rgba(236,194,70,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeCompleted: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  nodeCurrent: {
    backgroundColor: 'rgba(236,194,70,0.2)',
    borderColor: Colors.secondary,
    shadowColor: 'rgba(236,194,70,0.4)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  nodeLocked: {
    opacity: 0.4,
  },
  levelNum: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.onSurfaceVariant,
  },
  levelNumActive: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.navyDark,
  },
});
