import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { LIVES_CONFIG } from '@/constants/xp.constants';
import { useAuth } from '@/contexts/AuthContext';
import {
  refillIfNeeded,
  refillWithTokens,
  refillWithAd,
  GUEST_REFILL_BLOCKED,
} from '@/services/livesService';
import { showRewardedAd } from '@/services/adsService';

/**
 * Modal-style route shown when the player has 0 lives. Three escape
 * hatches are surfaced, matching the design decision in AGENTS.md:
 *
 *   1. Watch rewarded ad → +1 life (5-min cooldown between ads).
 *   2. Spend tokens → +1 life (50 tokens).
 *   3. Wait for time-based refill → shown as live countdown.
 *
 * Each path calls a single `livesService` function so the UI is a
 * thin orchestration layer. Errors are caught and surfaced in Malay
 * via `Alert.alert`. Guest users hit the same UI but the token path
 * bounces through the guest-gate error (`GUEST_REFILL_BLOCKED`) and
 * prompts Daftar / Log Masuk — guest lives are still tracked but
 * token-spend is blocked (the account is throwaway anyway).
 */
export default function LivesEmptyModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userData } = useAuth();

  const [adRefilling, setAdRefilling] = useState(false);
  const [tokenRefilling, setTokenRefilling] = useState(false);
  const [countdownMs, setCountdownMs] = useState<number | null>(null);

  // Pull any pending refill and start the countdown ticker.
  useEffect(() => {
    if (!userData?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const next = await refillIfNeeded(userData.uid);
        if (cancelled) return;
        setCountdownMs(next.msUntilNextRefill);
      } catch {
        // Non-fatal — countdown stays null and the "Tunggu refill"
        // line hides itself.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userData?.uid]);

  // Local ticker so the "Tunggu refill — 1 jam 24 minit lagi"
  // label updates without re-running the transaction.
  useEffect(() => {
    if (countdownMs == null) return;
    const id = setInterval(() => {
      setCountdownMs((prev) => (prev == null ? null : Math.max(0, prev - 30_000)));
    }, 30_000);
    return () => clearInterval(id);
  }, [countdownMs]);

  const handleWatchAd = async () => {
    if (!userData?.uid || adRefilling) return;
    setAdRefilling(true);
    try {
      const adResult = await showRewardedAd();
      if (!adResult.completed) {
        // Stub mode or load failure — translate to a friendly
        // message instead of letting the catch block swallow it.
        const reasonText =
          adResult.reason === 'stub_mode'
            ? 'Tonton video iklan belum tersedia. Cuba lagi nanti.'
            : adResult.reason === 'cancelled'
              ? 'Tontonan iklan dibatalkan.'
              : 'Iklan gagal dimuatkan. Cuba lagi sebentar.';
        Alert.alert('Iklan', reasonText);
        return;
      }
      const refill = await refillWithAd(userData.uid, true);
      if (refill.ok) {
        router.back();
        return;
      }
      if (refill.reason === 'cooldown') {
        const minutes = Math.ceil((refill.msUntilNextAd ?? 0) / 60_000);
        Alert.alert(
          'Sila tunggu',
          `Anda boleh tonton iklan lagi dalam ${minutes} minit.`
        );
      } else if (refill.reason === 'full') {
        Alert.alert('Lives sudah penuh', 'Terima kasih kerana menonton!');
        router.back();
      }
    } catch (err) {
      Alert.alert('Ralat', err instanceof Error ? err.message : 'Tidak dapat memproses.');
    } finally {
      setAdRefilling(false);
    }
  };

  const handleSpendTokens = async () => {
    if (!userData?.uid || tokenRefilling) return;
    setTokenRefilling(true);
    try {
      const result = await refillWithTokens(userData.uid);
      // Lives bumped — auth context listener will refresh `userData`
      // on the next render, so we just close the modal.
      void result;
      router.back();
    } catch (err: any) {
      if (err?.code === GUEST_REFILL_BLOCKED) {
        Alert.alert(
          'Daftar diperlukan',
          'Pengguna tetamu tidak boleh menggunakan token. Sila daftar atau log masuk untuk refill dengan token.',
          [
            { text: 'Batal', style: 'cancel' },
            { text: 'Daftar', onPress: () => router.replace(Routes.REGISTER) },
            { text: 'Log Masuk', onPress: () => router.replace(Routes.LOGIN) },
          ]
        );
        return;
      }
      Alert.alert('Ralat', err?.message ?? 'Tidak dapat memproses.');
    } finally {
      setTokenRefilling(false);
    }
  };

  const handleClose = async () => {
    // If the user has been waiting on the modal long enough for a
    // refill tick to land, snap that to the server before closing so
    // they don't have to reopen the modal to pick it up.
    if (userData?.uid) {
      try {
        await refillIfNeeded(userData.uid);
      } catch {
        // ignore — UI state stays whatever it was
      }
    }
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <LinearGradient
        colors={['#5b3a8a', '#3a2266', '#1f0f3d']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.blobTop} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + Spacing.sm }]}
        onPress={handleClose}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Tutup"
      >
        <Ionicons name="close" size={22} color="#fff" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="heart-dislike" size={56} color="#ff7b9c" />
        </View>

        <Text style={styles.title}>Nyawa Anda Sudah Habis</Text>
        <Text style={styles.subtitle}>
          Anda boleh terus bermain dengan salah satu cara di bawah.
        </Text>

        <View style={styles.optionCard}>
          <View style={styles.optionHeader}>
            <View style={[styles.optionIconWrap, { backgroundColor: 'rgba(255,140,90,0.22)' }]}>
              <Ionicons name="play-circle" size={22} color="#ff8c5a" />
            </View>
            <View style={styles.optionHeaderText}>
              <Text style={styles.optionTitle}>Tonton Video Iklan</Text>
              <Text style={styles.optionSubtitle}>+1 nyawa percuma</Text>
            </View>
          </View>
          <Text style={styles.optionDescription}>
            Tonton video pendek untuk tambah 1 nyawa. Ada cooldown 5 minit antara tontonan.
          </Text>
          <TouchableOpacity
            style={[styles.ctaButton, styles.ctaPrimary]}
            onPress={handleWatchAd}
            disabled={adRefilling}
            activeOpacity={0.85}
          >
            {adRefilling ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaPrimaryText}>Tonton Iklan</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.optionCard}>
          <View style={styles.optionHeader}>
            <View style={[styles.optionIconWrap, { backgroundColor: 'rgba(201,162,39,0.22)' }]}>
              <Ionicons name="wallet" size={22} color="#c9a227" />
            </View>
            <View style={styles.optionHeaderText}>
              <Text style={styles.optionTitle}>Guna Token</Text>
              <Text style={styles.optionSubtitle}>
                {LIVES_CONFIG.REFILL_TOKEN_COST} token = +1 nyawa
              </Text>
            </View>
          </View>
          <Text style={styles.optionDescription}>
            Anda ada {userData?.tokens ?? 0} token sekarang. Tukar untuk tambah nyawa.
          </Text>
          <TouchableOpacity
            style={[
              styles.ctaButton,
              styles.ctaGold,
              ((userData?.tokens ?? 0) < LIVES_CONFIG.REFILL_TOKEN_COST || tokenRefilling) && styles.ctaDisabled,
            ]}
            onPress={handleSpendTokens}
            disabled={
              tokenRefilling || (userData?.tokens ?? 0) < LIVES_CONFIG.REFILL_TOKEN_COST
            }
            activeOpacity={0.85}
          >
            {tokenRefilling ? (
              <ActivityIndicator size="small" color="#3a2266" />
            ) : (
              <Text style={styles.ctaGoldText}>
                {(userData?.tokens ?? 0) < LIVES_CONFIG.REFILL_TOKEN_COST
                  ? 'Token tidak cukup'
                  : `Beli 1 Nyawa (${LIVES_CONFIG.REFILL_TOKEN_COST} token)`}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.optionCard}>
          <View style={styles.optionHeader}>
            <View style={[styles.optionIconWrap, { backgroundColor: 'rgba(123,226,201,0.22)' }]}>
              <Ionicons name="time" size={22} color="#7be2c9" />
            </View>
            <View style={styles.optionHeaderText}>
              <Text style={styles.optionTitle}>Tunggu Refill Percuma</Text>
              <Text style={styles.optionSubtitle}>+1 nyawa setiap {LIVES_CONFIG.REFILL_MINUTES} minit</Text>
            </View>
          </View>
          {countdownMs == null ? (
            <Text style={styles.optionDescription}>
              Refill seterusnya akan dipaparkan tidak lama lagi.
            </Text>
          ) : countdownMs <= 0 ? (
            <Text style={styles.optionDescription}>
              Nyawa anda sudah sedia untuk diisi semula — buka semula skrin ini.
            </Text>
          ) : (
            <Text style={styles.optionDescription}>
              Refill seterusnya dalam{' '}
              <Text style={styles.optionDescriptionBold}>
                {formatCountdown(countdownMs)}
              </Text>
              . Anda boleh teruskan kuiz selepas itu.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'sebentar lagi';
  const totalMinutes = Math.ceil(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} minit`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} jam` : `${hours} jam ${minutes} minit`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f0f3d',
  },
  blobTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(201,162,39,0.18)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: -160,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(124,95,216,0.35)',
  },
  closeButton: {
    position: 'absolute',
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,123,156,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 4,
    borderColor: 'rgba(255,123,156,0.4)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  optionCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  optionHeaderText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
  optionSubtitle: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  optionDescription: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.82)',
    marginBottom: Spacing.sm,
    lineHeight: 19,
  },
  optionDescriptionBold: {
    fontWeight: '700',
    color: Colors.accent,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
  },
  ctaPrimary: {
    backgroundColor: '#ff8c5a',
  },
  ctaPrimaryText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  ctaGold: {
    backgroundColor: Colors.accent,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaGoldText: {
    color: '#3a2266',
    fontWeight: '800',
    fontSize: FontSize.md,
  },
});