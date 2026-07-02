import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToGlobalLeaderboard } from '@/services/leaderboardService';
import type { LeaderboardEntry } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

type TimeFilter = 'today' | 'weekly' | 'monthly';

export default function LeaderboardScreen() {
  const { userData } = useAuth();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimeFilter>('monthly');

  useEffect(() => {
    const unsubscribe = subscribeToGlobalLeaderboard((data) => {
      setEntries(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const topThree = entries.slice(0, 3);
  const restEntries = entries.slice(3);

  // Mock trend data (in real app, this comes from history)
  const getTrend = (userId: string): { value: number; direction: 'up' | 'down' } | null => {
    const hash = userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const value = (hash % 25) + 1;
    return { value, direction: hash % 2 === 0 ? 'up' : 'down' };
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Papan Pendahulu</Text>
            <TouchableOpacity style={styles.menuBtn}>
              <Text style={styles.menuBtnText}>⋯</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>{filter === 'today' ? 'Hari Ini' : filter === 'weekly' ? 'Mingguan' : 'Bulanan'} 2026</Text>
        </View>
        
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyEmoji}>🏆</Text>
          </View>
          <Text style={styles.emptyTitle}>Belum Ada Peserta</Text>
          <Text style={styles.emptySubtitle}>
            Jadilah yang pertama! Jawab kuiz dan kumpul XP untuk berada di carta!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Papan Pendahulu</Text>
          <TouchableOpacity style={styles.menuBtn}>
            <Text style={styles.menuBtnText}>⋯</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          {filter === 'today' ? 'Hari Ini' : filter === 'weekly' ? 'Mingguan' : 'Bulanan'} 2026
        </Text>
      </View>

      {/* Time Filter Pills */}
      <View style={styles.filterContainer}>
        <FilterButton label="Hari Ini" active={filter === 'today'} onPress={() => setFilter('today')} />
        <FilterButton label="Mingguan" active={filter === 'weekly'} onPress={() => setFilter('weekly')} />
        <FilterButton label="Bulanan" active={filter === 'monthly'} onPress={() => setFilter('monthly')} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Top 3 Podium */}
        {topThree.length > 0 && (
          <View style={styles.podiumSection}>
            <View style={styles.podiumContainer}>
              <PodiumCard 
                entry={topThree[1]} 
                rank={2} 
                color="#9CA3AF" 
                height={100} 
              />
              <PodiumCard 
                entry={topThree[0]} 
                rank={1} 
                color={Colors.accent} 
                height={130} 
              />
              <PodiumCard 
                entry={topThree[2]} 
                rank={3} 
                color="#B45309" 
                height={80} 
              />
            </View>
          </View>
        )}

        {/* Rest of Leaderboard - White Card */}
        <View style={styles.listContainer}>
          {restEntries.map((item, index) => {
            const isCurrentUser = item.userId === userData?.uid;
            const actualRank = index + 4;
            const trend = getTrend(item.userId);

            return (
              <View 
                key={item.userId} 
                style={[styles.entryCard, isCurrentUser && styles.currentUserEntry]}
              >
                <View style={styles.rankContainer}>
                  <Text style={[styles.rank, isCurrentUser && styles.currentUserText]}>
                    #{actualRank}
                  </Text>
                </View>

                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarSmallInitial}>
                    {item.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.userInfo}>
                  <Text style={[styles.displayName, isCurrentUser && styles.currentUserText]} numberOfLines={1}>
                    {item.displayName}
                    {isCurrentUser && ' (Anda)'}
                  </Text>
                  <Text style={[styles.parish, isCurrentUser && styles.currentUserText]} numberOfLines={1}>
                    {item.parishName || `${item.totalXP.toLocaleString()} coins`}
                  </Text>
                </View>

                {/* Trend Badge */}
                {trend && (
                  <View style={[
                    styles.trendBadge,
                    trend.direction === 'up' ? styles.trendUp : styles.trendDown,
                    isCurrentUser && styles.trendBadgeCurrent
                  ]}>
                    <Text style={styles.trendValue}>{trend.value}</Text>
                    <Text style={[
                      styles.trendArrow,
                      trend.direction === 'up' ? styles.trendArrowUp : styles.trendArrowDown
                    ]}>
                      {trend.direction === 'up' ? '▲' : '▼'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {restEntries.length === 0 && (
            <View style={styles.emptyList}>
              <Text style={styles.emptyListText}>Tiada peserta lain lagi</Text>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <View style={styles.filterButtonWrap}>
      <Text 
        onPress={onPress}
        style={[styles.filterButton, active && styles.filterButtonActive]}
      >
        {label}
      </Text>
    </View>
  );
}

function PodiumCard({ 
  entry, 
  rank, 
  color, 
  height,
}: { 
  entry?: LeaderboardEntry; 
  rank: number; 
  color: string;
  height: number;
}) {
  if (!entry) {
    return (
      <View style={styles.podiumItem}>
        <View style={[styles.podiumCircle, { borderColor: color, backgroundColor: Colors.light.surfaceAlt }]}>
          <Text style={[styles.podiumInitial, { color: Colors.light.textSecondary }]}>?</Text>
        </View>
        <Text style={styles.podiumName}>Kosong</Text>
        <View style={[styles.podiumBase, { height, backgroundColor: color, opacity: 0.5 }]}>
          <Text style={styles.podiumBaseRank}>{rank}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.podiumItem}>
      {/* Crown untuk 1st place */}
      {rank === 1 && <Text style={styles.crownEmoji}>👑</Text>}
      
      <View style={[styles.podiumCircle, { borderColor: color }]}>
        <Text style={styles.podiumInitial}>
          {entry.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      
      <Text style={styles.podiumName} numberOfLines={1}>
        {entry.displayName}
      </Text>
      
      <Text style={styles.podiumScore}>{entry.totalXP.toLocaleString()}</Text>
      
      <View style={[styles.podiumBase, { height, backgroundColor: color }]}>
        <Text style={styles.podiumBaseRank}>{rank}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF8EC', // Warm cream
  },
  
  // Header
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  menuBtnText: {
    fontSize: 20,
    color: Colors.primary,
  },
  
  // Filter
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    padding: 4,
    borderRadius: BorderRadius.round,
    marginBottom: Spacing.lg,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterButtonWrap: {
    flex: 1,
  },
  filterButton: {
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    borderRadius: BorderRadius.round,
    overflow: 'hidden',
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    color: Colors.white,
    fontWeight: '600',
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.light.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // Podium
  podiumSection: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 110,
    marginHorizontal: 4,
  },
  crownEmoji: {
    fontSize: 28,
    marginBottom: -10,
  },
  podiumCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumInitial: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  podiumName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  podiumScore: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  podiumBase: {
    width: '100%',
    marginTop: Spacing.sm,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
  },
  podiumBaseRank: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.white,
  },
  
  // List
  listContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  currentUserEntry: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  rankContainer: {
    width: 40,
    marginRight: Spacing.sm,
  },
  rank: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.light.textSecondary,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarSmallInitial: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.white,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  parish: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    gap: 4,
  },
  trendUp: {
    backgroundColor: '#D1FAE5',
  },
  trendDown: {
    backgroundColor: '#FED7AA',
  },
  trendBadgeCurrent: {
    backgroundColor: Colors.accent,
  },
  trendValue: {
    fontSize: FontSize.xs,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  currentUserText: {
    color: Colors.white,
  },
  trendArrow: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  trendArrowUp: {
    color: Colors.success,
  },
  trendArrowDown: {
    color: Colors.error,
  },
  emptyList: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: FontSize.md,
    color: Colors.light.textSecondary,
  },
});