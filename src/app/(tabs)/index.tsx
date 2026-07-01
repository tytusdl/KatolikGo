import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, FontSize } from '@/constants/theme';

export default function HomeScreen() {
  const { userData } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={{ flex: 1 }}>
      <View style={styles.content}>
        <Text style={styles.welcome}>Selamat Datang,</Text>
        <Text style={styles.name}>{userData?.displayName || 'Para pelajar'}</Text>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>Level {userData?.currentLevel || 1}</Text>
            <Text style={styles.statLabel}>Kemajuan</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userData?.tokens || 0}</Text>
            <Text style={styles.statLabel}>Token</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userData?.totalXP || 0}</Text>
            <Text style={styles.statLabel}>XP Jumlah</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mod Permainan</Text>
          <View style={styles.gameModeCard}>
            <Text style={styles.gameModeTitle}>❓ Kuiz Alkitab & Katolik</Text>
            <Text style={styles.gameModeDesc}>
              Kuiz aneka pilihan tentang Perjanjian Lama, Perjanjian Baru, Katekisus, Sakramen, dan Liturgi
            </Text>
          </View>
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>
            "Sebarkanlah ayat-ayatku ini, sebab ia adalah kesaksihan hidup." - Roma 10:14
          </Text>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    padding: Spacing.lg,
  },
  welcome: {
    fontSize: FontSize.lg,
    color: Colors.light.textSecondary,
  },
  name: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.white,
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: Colors.white,
    opacity: 0.8,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  gameModeCard: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    padding: Spacing.md,
  },
  gameModeTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  gameModeDesc: {
    fontSize: FontSize.sm,
    color: Colors.white,
    opacity: 0.9,
  },
  quoteCard: {
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  quoteText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontStyle: 'italic',
  },
});