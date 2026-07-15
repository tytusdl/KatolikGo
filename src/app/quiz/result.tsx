import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';
import { Routes } from '@/constants/routes';

export default function ResultScreen() {
  const params = useLocalSearchParams<{
    level: string;
    score: string;
    correct: string;
    total: string;
    xp: string;
    tokens: string;
    passed: string;
  }>();
  const router = useRouter();

  const scoreNum = Number(params.score) || 0;
  const correctNum = Number(params.correct) || 0;
  const totalNum = Number(params.total) || 0;
  const xpNum = Number(params.xp) || 0;
  const tokensNum = Number(params.tokens) || 0;
  const passed = params.passed === '1';

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Saya baru sahaja menyelesaikan Kuiz Tahap ${params.level} di KatolikGo dengan skor ${scoreNum}%! Bergabung dan uji iman anda juga.`,
      });
    } catch (err) {
      if (__DEV__) {
        console.warn('Share failed:', err);
      }
    }
  };

  const handleReplay = () => {
    if (params.level) {
      router.replace(Routes.QUIZ_LEVEL(params.level));
    } else {
      router.replace(Routes.PETA);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {'S'}
            </Text>
          </View>
          <View>
            <Text style={styles.headerBrand}>KatolikGo</Text>
            <Text style={styles.headerXP}>XP: {(xpNum * 10).toLocaleString()}</Text>
          </View>
        </View>
        <View style={styles.medalBadge}>
          <Ionicons name="medal" size={18} color={Colors.accent} />
        </View>
      </View>

      <Text style={styles.title}>{passed ? 'Tahap Selesai!' : 'Cuba Lagi'}</Text>
      <Text style={styles.subtitle}>
        {passed
          ? 'Syabas! Anda telah melengkapkan kuiz ini.'
          : 'Jangan putus asa, cuba lagi untuk lebih baik.'}
      </Text>

      <View style={styles.scoreWrap}>
        <View style={[styles.scoreRing, passed ? styles.scoreRingPass : styles.scoreRingFail]}>
          <Text style={styles.scoreText}>{scoreNum}%</Text>
          <Text style={styles.scoreSub}>SKOR</Text>
        </View>
      </View>

      <View style={styles.bentoCard}>
        <Text style={styles.bentoTitle}>Hasil Usaha Anda</Text>
        <View style={styles.bentoRow}>
          <View style={styles.bentoCell}>
            <View style={[styles.bentoIcon, { backgroundColor: Colors.background }]}>
              <Ionicons name="checkmark" size={20} color={Colors.accent} />
            </View>
            <Text style={styles.bentoLabel}>TEPAT</Text>
            <Text style={styles.bentoVal}>
              {correctNum} / {totalNum}
            </Text>
          </View>
          <View style={styles.bentoDivider} />
          <View style={styles.bentoCell}>
            <View style={[styles.bentoIcon, { backgroundColor: Colors.background }]}>
              <Ionicons name="trophy" size={20} color={Colors.accent} />
            </View>
            <Text style={styles.bentoLabel}>GANJARAN</Text>
            <Text style={styles.bentoVal}>+{xpNum} XP</Text>
          </View>
        </View>
        {tokensNum > 0 && (
          <View style={styles.tokenPill}>
            <Ionicons name="ribbon" size={16} color={Colors.accent} />
            <Text style={styles.tokenPillText}>+{tokensNum} Token</Text>
          </View>
        )}
      </View>

      <View style={styles.verseBlock}>
        <View style={styles.verseDivider} />
        <Text style={styles.verseText}>
          {'\u201C'}Segala perkara dapat kulakukan melalui Dia yang memberi kekuatan kepadaku.{'\u201D'}
        </Text>
        <Text style={styles.verseRef}>— Filipi 4:13</Text>
      </View>

      <TouchableOpacity
        style={styles.ctaBtn}
        onPress={() => router.replace(Routes.PETA)}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaText}>Seterusnya</Text>
        <Ionicons name="arrow-forward" size={20} color={Colors.white} />
      </TouchableOpacity>

      <View style={styles.secondaryRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleShare} activeOpacity={0.7}>
          <Ionicons name="share-social-outline" size={18} color={Colors.text} />
          <Text style={styles.secondaryText}>Kongsi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleReplay} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={18} color={Colors.text} />
          <Text style={styles.secondaryText}>Main Lagi</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 50,
    paddingBottom: 30,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  headerBrand: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
    lineHeight: 18,
  },
  headerXP: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  medalBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },

  scoreWrap: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  scoreRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreRingPass: {
    borderColor: Colors.accent,
    backgroundColor: Colors.background,
  },
  scoreRingFail: {
    borderColor: Colors.error,
    backgroundColor: Colors.background,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
    lineHeight: 52,
  },
  scoreSub: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginTop: 2,
  },

  bentoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  bentoTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.body,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  bentoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bentoCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bentoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  bentoLabel: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  bentoVal: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.text,
  },
  bentoDivider: {
    width: 1,
    height: 60,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.accent,
    marginTop: Spacing.md,
  },
  tokenPillText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.accent,
  },

  verseBlock: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  verseDivider: {
    width: 40,
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  verseText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    fontStyle: 'italic',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  verseRef: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    color: Colors.textMuted,
  },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.text,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    marginBottom: 10,
  },
  ctaText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontFamily: FontFamily.display,
    color: Colors.white,
  },

  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
});
