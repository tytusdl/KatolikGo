import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { grantTokens, grantXp, setLives, setPremium, fetchSnapshot } from '@/admin/adminService';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';

export default function AdminScreen() {
  const { userData, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);

  // Assert admin on render
  if (!userData?.isAdmin) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed" size={48} color={Colors.error} />
        <Text style={styles.deniedText}>Akses Ditolak</Text>
        <Text style={styles.deniedSub}>Anda bukan pentadbir.</Text>
      </View>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
      await refreshUserData();
    } catch (err: any) {
      Alert.alert('Ralat', err?.message ?? 'Operasi gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Panel Pentadbir</Text>

      {/* Tokens */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Token</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => run(async () => { await grantTokens(userData, 100); })}
          >
            <Text style={styles.actionText}>+100</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => run(async () => { await grantTokens(userData, 500); })}
          >
            <Text style={styles.actionText}>+500</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => run(async () => { await grantTokens(userData, 1000); })}
          >
            <Text style={styles.actionText}>+1000</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* XP */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>XP</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => run(async () => { await grantXp(userData, 100); })}
          >
            <Text style={styles.actionText}>+100 XP</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => run(async () => { await grantXp(userData, 500); })}
          >
            <Text style={styles.actionText}>+500 XP</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => run(async () => { await grantXp(userData, 1000); })}
          >
            <Text style={styles.actionText}>+1000 XP</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lives */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nyawa</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => run(async () => { await setLives(userData, 5); })}
          >
            <Text style={styles.actionText}>Penuh (5)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => run(async () => { await setLives(userData, 0); })}
          >
            <Text style={styles.actionText}>Kosong (0)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Premium */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Premium</Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => run(async () => { await setPremium(userData, !userData.isPremium); })}
        >
          <Text style={styles.actionText}>
            {userData.isPremium ? 'Nyahaktif Premium' : 'Aktifkan Premium'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Refresh */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.refreshBtn]}
          onPress={() => run(async () => { await fetchSnapshot(userData); })}
        >
          <Ionicons name="refresh" size={18} color={Colors.secondary} />
          <Text style={styles.actionText}>Refresh dari Server</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: 8 },
  deniedText: { fontSize: FontSize.lg, fontWeight: '700', fontFamily: FontFamily.display, color: Colors.error },
  deniedSub: { fontSize: FontSize.sm, fontFamily: FontFamily.body, color: Colors.onSurfaceVariant },

  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.secondary,
    marginBottom: Spacing.lg,
  },
  section: {
    backgroundColor: 'rgba(14,42,77,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.15)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(26,58,92,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.2)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.creamSoft,
  },
  refreshBtn: {
    width: '100%',
    justifyContent: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
