import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToGlobalLeaderboard } from '@/services/leaderboardService';
import type { LeaderboardEntry } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';

const GLASS = {
  backgroundColor: 'rgba(14,42,77,0.6)',
  borderWidth: 1,
  borderColor: 'rgba(236,194,70,0.15)',
  borderRadius: BorderRadius.lg,
};

type TimeFilter = 'today' | 'weekly' | 'monthly';

export default function LeaderboardScreen() {
  const { userData } = useAuth();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimeFilter>('monthly');

  useEffect(() => {
    const unsub = subscribeToGlobalLeaderboard((data) => {
      setEntries(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Papan Pendahulu</Text>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {(['today', 'weekly', 'monthly'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'today' ? 'Hari Ini' : f === 'weekly' ? 'Mingguan' : 'Bulanan'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Podium */}
        {topThree.length >= 3 && (
          <View style={styles.podium}>
            {/* 2nd */}
            <View style={styles.podiumItem}>
              <View style={styles.podiumAvatar}>
                <Text style={styles.podiumInitial}>{topThree[1].displayName.charAt(0)}</Text>
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>{topThree[1].displayName}</Text>
              <View style={[styles.podiumBar, { height: 80, backgroundColor: '#C3C6CF' }]}>
                <Text style={styles.podiumRank}>2</Text>
              </View>
            </View>
            {/* 1st */}
            <View style={styles.podiumItem}>
              <Ionicons name="trophy" size={24} color={Colors.secondary} />
              <View style={[styles.podiumAvatar, styles.podiumAvatarGold]}>
                <Text style={styles.podiumInitialGold}>{topThree[0].displayName.charAt(0)}</Text>
              </View>
              <Text style={styles.podiumNameGold} numberOfLines={1}>{topThree[0].displayName}</Text>
              <View style={[styles.podiumBar, { height: 110, backgroundColor: Colors.secondary }]}>
                <Text style={styles.podiumRankGold}>1</Text>
              </View>
            </View>
            {/* 3rd */}
            <View style={styles.podiumItem}>
              <View style={styles.podiumAvatar}>
                <Text style={styles.podiumInitial}>{topThree[2].displayName.charAt(0)}</Text>
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>{topThree[2].displayName}</Text>
              <View style={[styles.podiumBar, { height: 60, backgroundColor: '#A67C52' }]}>
                <Text style={styles.podiumRank}>3</Text>
              </View>
            </View>
          </View>
        )}

        {/* Rank List */}
        <View style={styles.listSection}>
          {rest.map((entry, idx) => {
            const rank = idx + 4;
            const isMe = entry.userId === userData?.uid;
            return (
              <View
                key={entry.userId}
                style={[styles.rankRow, isMe && styles.rankRowMe]}
              >
                <Text style={[styles.rankNum, isMe && styles.rankNumMe]}>#{rank}</Text>
                <View style={styles.rankAvatar}>
                  <Text style={styles.rankAvatarText}>{entry.displayName.charAt(0)}</Text>
                </View>
                <View style={styles.rankInfo}>
                  <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
                    {entry.displayName}{isMe ? ' (Anda)' : ''}
                  </Text>
                  <Text style={styles.rankXP}>{entry.totalXP.toLocaleString()} XP</Text>
                </View>
              </View>
            );
          })}
        </View>

        {entries.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={Colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>Belum Ada Peserta</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

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

  // Filter
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.round,
    backgroundColor: 'rgba(14,42,77,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.1)',
  },
  filterPillActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  filterText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  filterTextActive: {
    color: Colors.navyDark,
  },

  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },

  // Podium
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  podiumAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(14,42,77,0.8)',
    borderWidth: 2,
    borderColor: 'rgba(236,194,70,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  podiumAvatarGold: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(236,194,70,0.2)',
  },
  podiumInitial: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.onSurfaceVariant,
  },
  podiumInitialGold: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.secondary,
  },
  podiumName: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
    marginBottom: 6,
    textAlign: 'center',
  },
  podiumNameGold: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.display,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  podiumBar: {
    width: '100%',
    maxWidth: 80,
    borderTopLeftRadius: BorderRadius.sm,
    borderTopRightRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumRank: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.white,
  },
  podiumRankGold: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.navyDark,
  },

  // Rank List
  listSection: {
    gap: 8,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    ...GLASS,
    padding: Spacing.md,
  },
  rankRowMe: {
    borderColor: Colors.secondary,
    borderWidth: 2,
  },
  rankNum: {
    width: 36,
    fontSize: FontSize.sm,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.onSurfaceVariant,
  },
  rankNumMe: {
    color: Colors.secondary,
  },
  rankAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(14,42,77,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(236,194,70,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  rankAvatarText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.secondary,
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.creamSoft,
  },
  rankNameMe: {
    color: Colors.secondary,
  },
  rankXP: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: 12,
  },
  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    fontFamily: FontFamily.display,
    color: Colors.onSurfaceVariant,
  },
});
