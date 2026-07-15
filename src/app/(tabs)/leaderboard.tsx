import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToGlobalLeaderboard,
  getParishLeaderboard,
} from '@/services/leaderboardService';
import type { LeaderboardEntry } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';

type ScopeFilter = 'global' | 'paroki';

export default function LeaderboardScreen() {
  const { userData } = useAuth();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<ScopeFilter>('global');
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setHasLoaded(false);
    if (scope === 'global') {
      const unsub = subscribeToGlobalLeaderboard((data) => {
        setEntries(data);
        setLoading(false);
        setHasLoaded(true);
      });
      return () => unsub();
    } else {
      if (!userData?.parishId) {
        setEntries([]);
        setLoading(false);
        setHasLoaded(true);
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          const data = await getParishLeaderboard(userData.parishId);
          if (!cancelled) {
            setEntries(data);
            setLoading(false);
            setHasLoaded(true);
          }
        } catch {
          if (!cancelled) {
            setLoading(false);
            setHasLoaded(true);
          }
        }
      })();
      return () => { cancelled = true; };
    }
  }, [scope, userData?.parishId]);

  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brandRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {(userData?.displayName ?? 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.brand}>KatolikGo</Text>
        </View>
        <View style={styles.tokenPill}>
          <Text style={styles.tokenCount}>{(userData?.tokens ?? 0).toLocaleString()}</Text>
          <Image source={require('../../../assets/token.png')} style={styles.tokenIcon} />
        </View>
      </View>

      <View style={styles.scopeRow}>
        <View style={styles.scopePill}>
          <TouchableOpacity
            style={[styles.scopeTab, scope === 'global' && styles.scopeTabActive]}
            onPress={() => setScope('global')}
          >
            <Text style={[styles.scopeText, scope === 'global' && styles.scopeTextActive]}>
              Global
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scopeTab, scope === 'paroki' && styles.scopeTabActive]}
            onPress={() => setScope('paroki')}
          >
            <Text style={[styles.scopeText, scope === 'paroki' && styles.scopeTextActive]}>
              Paroki
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {topThree.length >= 3 ? (
            <View style={styles.podium}>
              <View style={styles.podiumItem}>
                <View style={[styles.podiumAvatar, styles.podiumAvatar2]}>
                  <Text style={styles.podiumInitial}>
                    {topThree[1].displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.podiumName} numberOfLines={1}>
                  {topThree[1].displayName}
                </Text>
                <View style={[styles.podiumBar, styles.podiumBar2]}>
                  <Text style={styles.podiumRank}>2</Text>
                </View>
              </View>

              <View style={styles.podiumItem}>
                <Ionicons name="trophy" size={24} color={Colors.accent} style={{ marginBottom: 4 }} />
                <View style={[styles.podiumAvatar, styles.podiumAvatar1]}>
                  <Text style={styles.podiumInitialGold}>
                    {topThree[0].displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.podiumNameGold} numberOfLines={1}>
                  {topThree[0].displayName}
                </Text>
                <View style={[styles.podiumBar, styles.podiumBar1]}>
                  <Text style={styles.podiumRankGold}>1</Text>
                </View>
              </View>

              <View style={styles.podiumItem}>
                <View style={[styles.podiumAvatar, styles.podiumAvatar3]}>
                  <Text style={styles.podiumInitial}>
                    {topThree[2].displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.podiumName} numberOfLines={1}>
                  {topThree[2].displayName}
                </Text>
                <View style={[styles.podiumBar, styles.podiumBar3]}>
                  <Text style={styles.podiumRank}>3</Text>
                </View>
              </View>
            </View>
          ) : null}

          {rest.length > 0 && (
            <View style={styles.listSection}>
              {rest.map((entry, idx) => {
                const rank = idx + 4;
                const isMe = entry.userId === userData?.uid;
                return (
                  <View
                    key={entry.userId}
                    style={[styles.rankRow, isMe && styles.rankRowMe]}
                  >
                    <Text style={[styles.rankNum, isMe && styles.rankNumMe]}>{rank}</Text>
                    <View style={styles.rankAvatar}>
                      <Text style={styles.rankAvatarText}>
                        {entry.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.rankInfo}>
                      <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
                        {entry.displayName}{isMe ? ' (Anda)' : ''}
                      </Text>
                      {entry.parishName ? (
                        <Text style={styles.rankParish} numberOfLines={1}>
                          {entry.parishName}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.rankScore}>
                      <Text style={[styles.rankScoreVal, isMe && styles.rankScoreValMe]}>
                        {entry.totalXP.toLocaleString()}
                      </Text>
                      <Text style={styles.rankScoreSub}>XP</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {entries.length === 0 && hasLoaded && (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {scope === 'paroki' && !userData?.parishId
                  ? 'Tetapkan paroki anda untuk lihat papan paroki'
                  : scope === 'paroki'
                    ? 'Tiada peserta dalam paroki anda lagi'
                    : 'Belum Ada Peserta'}
              </Text>
              <Text style={styles.emptyHint}>
                Jadilah yang pertama berkongsi kemajuan anda!
              </Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: {
    fontSize: FontSize.sm, fontWeight: '800',
    fontFamily: FontFamily.display, color: Colors.text,
  },
  brand: { fontSize: FontSize.lg, fontWeight: '800', fontFamily: FontFamily.display, color: Colors.text },
  tokenPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.background, borderRadius: BorderRadius.round,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  tokenIcon: { width: 16, height: 16 },
  tokenCount: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: FontFamily.display, color: Colors.text },

  scopeRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  scopePill: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.round, borderWidth: 1,
    borderColor: Colors.border, padding: 4,
  },
  scopeTab: { flex: 1, paddingVertical: 10, borderRadius: BorderRadius.round, alignItems: 'center' },
  scopeTabActive: { backgroundColor: Colors.text },
  scopeText: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.display, color: Colors.textMuted },
  scopeTextActive: { color: Colors.white },

  scrollContent: { paddingHorizontal: Spacing.lg },

  podium: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'flex-end', marginBottom: Spacing.xl, paddingTop: Spacing.lg,
  },
  podiumItem: { alignItems: 'center', flex: 1, marginHorizontal: 4 },
  podiumAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.background, borderWidth: 1,
    borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  podiumAvatar1: {
    width: 64, height: 64, borderRadius: 32,
    borderColor: Colors.accent, backgroundColor: Colors.background, marginBottom: 8,
  },
  podiumAvatar2: { width: 52, height: 52, borderRadius: 26 },
  podiumAvatar3: { width: 52, height: 52, borderRadius: 26 },
  podiumInitial: { fontSize: FontSize.md, fontWeight: '800', fontFamily: FontFamily.display, color: Colors.text },
  podiumInitialGold: { fontSize: FontSize.lg, fontWeight: '800', fontFamily: FontFamily.display, color: Colors.accent },
  podiumName: { fontSize: FontSize.xs, fontFamily: FontFamily.body, fontWeight: '600', color: Colors.textMuted, marginBottom: 6, textAlign: 'center' },
  podiumNameGold: { fontSize: FontSize.sm, fontFamily: FontFamily.display, fontWeight: '700', color: Colors.text, marginBottom: 6, textAlign: 'center' },
  podiumBar: {
    width: '100%', maxWidth: 90,
    borderTopLeftRadius: BorderRadius.md, borderTopRightRadius: BorderRadius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  podiumBar1: { backgroundColor: Colors.accent, height: 120 },
  podiumBar2: { backgroundColor: Colors.textMuted, height: 90 },
  podiumBar3: { backgroundColor: Colors.border, height: 70 },
  podiumRank: { fontSize: FontSize.xl, fontWeight: '800', fontFamily: FontFamily.display, color: Colors.white },
  podiumRankGold: { fontSize: FontSize.xxl, fontWeight: '800', fontFamily: FontFamily.display, color: Colors.white },

  listSection: { gap: 8 },
  rankRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
  },
  rankRowMe: { borderColor: Colors.accent, borderWidth: 2 },
  rankNum: { width: 36, fontSize: FontSize.md, fontWeight: '800', fontFamily: FontFamily.display, color: Colors.textMuted },
  rankNumMe: { color: Colors.accent },
  rankAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.background, borderWidth: 1,
    borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  rankAvatarText: { fontSize: FontSize.sm, fontWeight: '800', fontFamily: FontFamily.display, color: Colors.text },
  rankInfo: { flex: 1 },
  rankName: { fontSize: FontSize.md, fontWeight: '700', fontFamily: FontFamily.display, color: Colors.text },
  rankNameMe: { color: Colors.accent },
  rankParish: { fontSize: FontSize.xs, fontFamily: FontFamily.body, color: Colors.textMuted, marginTop: 2 },
  rankScore: { alignItems: 'flex-end' },
  rankScoreVal: { fontSize: FontSize.lg, fontWeight: '800', fontFamily: FontFamily.display, color: Colors.text },
  rankScoreValMe: { color: Colors.accent },
  rankScoreSub: { fontSize: 9, fontFamily: FontFamily.body, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.8 },

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: 12 },
  emptyText: { fontSize: FontSize.lg, fontWeight: '700', fontFamily: FontFamily.display, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.lg },
  emptyHint: { fontSize: FontSize.sm, fontFamily: FontFamily.body, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.lg, opacity: 0.7 },
});
