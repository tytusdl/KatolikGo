import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/authService';
import { Colors, Spacing, FontSize } from '@/constants/theme';

export default function ProfileScreen() {
  const { user, userData } = useAuth();
  const insets = useSafeAreaInsets();

  const handleSignOut = async () => {
    Alert.alert(
      'Log Keluar',
      'Anda pasti mahu log keluar?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Log Keluar',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Ralat', 'Gagal log keluar');
            }
          },
        },
      ]
    );
  };

  const handlePremium = () => {
    Alert.alert('Premium', 'Ciri premium akan datang tidak lama lagi!');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {userData?.displayName?.charAt(0) || 'U'}
          </Text>
        </View>
        <Text style={styles.displayName}>{userData?.displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.statsSection}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Level</Text>
          <Text style={styles.statValue}>{userData?.currentLevel || 1}/100</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>XP Jumlah</Text>
          <Text style={styles.statValue}>{userData?.totalXP?.toLocaleString() || 0}</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Token</Text>
          <Text style={styles.statValue}>{userData?.tokens || 0}</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Premium</Text>
          <Text style={[styles.statValue, userData?.isPremium && styles.premiumActive]}>
            {userData?.isPremium ? 'Aktif' : 'Tidak Aktif'}
          </Text>
        </View>
      </View>

      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.actionButton} onPress={handlePremium}>
          <Text style={styles.actionText}>Dapatkan Token / Premium</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Log Keluar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  profileHeader: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: 32,
    color: Colors.white,
  },
  displayName: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  email: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
  },
  statsSection: {
    padding: Spacing.lg,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  statLabel: {
    fontSize: FontSize.md,
    color: Colors.light.textSecondary,
  },
  statValue: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  premiumActive: {
    color: Colors.success,
  },
  actionsSection: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  actionButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionText: {
    color: Colors.white,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: Colors.error,
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutText: {
    color: Colors.white,
    fontWeight: '600',
  },
});
