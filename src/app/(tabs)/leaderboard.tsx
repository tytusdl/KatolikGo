import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToGlobalLeaderboard } from '@/services/leaderboardService';
import type { LeaderboardEntry } from '@/types';
import { Colors, Spacing, FontSize } from '@/constants/theme';

export default function LeaderboardScreen() {
  const { userData } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToGlobalLeaderboard((data) => {
      setEntries(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isCurrentUser = item.userId === userData?.uid;

    return (
      <View style={[styles.entryCard, isCurrentUser && styles.currentUserEntry]}>
        <View style={styles.rankContainer}>
          <Text style={[styles.rank, isCurrentUser && styles.currentUserText]}>
            {item.rank}
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

        <Text style={[styles.xp, isCurrentUser && styles.currentUserText]}>
          {item.totalXP.toLocaleString()} XP
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Papan Pendahulu</Text>

      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.primary,
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: 8,
    marginBottom: Spacing.xs,
  },
  currentUserEntry: {
    backgroundColor: Colors.primary,
  },
  rankContainer: {
    width: 40,
  },
  rank: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
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
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
  },
  xp: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.accent,
  },
  currentUserText: {
    color: Colors.white,
  },
});