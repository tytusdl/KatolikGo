import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView } from 'react-native';
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

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Empty State
  if (entries.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.headerTitle}>Papan Pendahulu</Text>
          <Text style={styles.headerSubtitle}>Bersaing dengan komuniti Katolik</Text>
        </View>
        
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyEmoji}>🏆</Text>
          </View>
          <Text style={styles.emptyTitle}>Belum Ada Pendahulu</Text>
          <Text style={styles.emptySubtitle}>
            Jadi yang pertama!{'\n'}Jawab kuiz dan kumpul XP untuk berada di carta!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Papan Pendahulu</Text>
        <Text style={styles.headerSubtitle}>Bersaing dengan komuniti Katolik</Text>
      </View>

      {/* Time Filter */}
      <View style={styles.filterContainer}>
        <FilterButton label="Hari Ini" active={filter === 'today'} onPress={() => setFilter('today')} />
        <FilterButton label="Mingguan" active={filter === 'weekly'} onPress={() => setFilter('weekly')} />
        <FilterButton label="Bulanan" active={filter === 'monthly'} onPress={() => setFilter('monthly')} />
      </View>

      {/* Top 3 Podium */}
      {topThree.length > 0 && (
        <View style={styles.podiumContainer}>
          {/* 2nd Place */}
          <PodiumCard 
            entry={topThree[1]} 
            rank={2} 
            color="#9CA3AF" 
            height={100} 
            medalEmoji="🥈" 
          />
          
          {/* 1st Place */}
          <PodiumCard 
            entry={topThree[0]} 
            rank={1} 
            color={Colors.accent} 
            height={130} 
            medalEmoji="🥇" 
          />
          
          {/* 3rd Place */}
          <PodiumCard 
            entry={topThree[2]} 
            rank={3} 
            color="#B45309" 
            height={80} 
            medalEmoji="🥉" 
          />
        </View>
      )}

      {/* Rest of Leaderboard */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>Senarai Pemenang</Text>
          <Text style={styles.listHeaderCount}>{restEntries.length} peserta</Text>
        </View>
        
        <FlatList
          data={restEntries}
          scrollEnabled={false}
          renderItem={({ item, index }) => {
            const isCurrentUser = item.userId === userData?.uid;
            const actualRank = index + 4;

            return (
              <View style={[styles.entryCard, isCurrentUser && styles.currentUserEntry]}>
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
                  <Text style={[styles.displayName, isCurrentUser && styles.currentUserText]}>
                    {item.displayName}
                    {isCurrentUser && ' (Anda)'}
                  </Text>
                  {item.parishName && (
                    <Text style={[styles.parish, isCurrentUser && styles.currentUserText]}>
                      {item.parishName}
                    </Text>
                  )}
                </View>

                <View style={styles.xpContainer}>
                  <View style={styles.xpBadge}>
                    <Text style={styles.xpBadgeText}>{item.totalXP.toLocaleString()}</Text>
                    <Text style={styles.xpBadgeLabel}>XP</Text>
                  </View>
                </View>
              </View>
            );
          }}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Text style={styles.emptyListText}>Tiada peserta lain lagi</Text>
            </View>
          }
        />
      </View>

      {/* Bottom spacing for tab bar */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// Filter Button Component
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

// Podium Card Component
function PodiumCard({ 
  entry, 
  rank, 
  color, 
  height,
  medalEmoji,
}: { 
  entry?: LeaderboardEntry; 
  rank: number; 
  color: string;
  height: number;
  medalEmoji: string;
}) {
  if (!entry) {
    return (
      <View style={styles.podiumItem}>
        <View style={[styles.podiumCircle, { borderColor: color, backgroundColor: Colors.light.surfaceAlt }]}>
          <Text style={[styles.podiumInitial, { color: Colors.light.textSecondary }]}>?</Text>
        </View>
        <Text style={styles.podiumName}>Kosong</Text>
        <View style={[styles.podiumBase, { height, backgroundColor: color, opacity: 0.5 }]} />
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
      
      <View style={[styles.medalBadge, { backgroundColor: color }]}>
        <Text style={styles.medalText}>{rank}</Text>
      </View>
      
      <Text style={styles.podiumName} numberOfLines={1}>
        {entry.displayName}
      </Text>
      
      <Text style={styles.podiumXP}>{entry.totalXP.toLocaleString()} XP</Text>
      
      <View style={[styles.podiumBase, { height, backgroundColor: color }]}>
        <Text style={styles.podiumBaseRank}>#{rank}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    paddingBottom: Spacing.lg,
  },
  
  // Header
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
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
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 110,
    marginHorizontal: 4,
  },
  crownEmoji: {
    fontSize: 24,
    marginBottom: -6,
  },
  podiumCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumInitial: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  medalBadge: {
    marginTop: -12,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.light.background,
  },
  medalText: {
    fontSize: FontSize.xs,
    fontWeight: 'bold',
    color: Colors.white,
  },
  podiumName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  podiumXP: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    fontWeight: '500',
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
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.white,
  },
  
  // List
  listContainer: {
    paddingHorizontal: Spacing.lg,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  listHeaderText: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  listHeaderCount: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
  },
  list: {
    gap: Spacing.sm,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  rank: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  xpContainer: {
    alignItems: 'flex-end',
  },
  xpBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    minWidth: 60,
  },
  xpBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.white,
  },
  xpBadgeLabel: {
    fontSize: 9,
    color: Colors.white,
    opacity: 0.9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  currentUserText: {
    color: Colors.white,
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
