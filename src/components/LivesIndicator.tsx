import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// Type-only import: `useRouter` is referenced in the helper
// signature below as `ReturnType<typeof useRouter>`. Using
// `import type` keeps this off the runtime bundle.
import type { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { LIVES_CONFIG } from '@/constants/xp.constants';
import { useAuth } from '@/contexts/AuthContext';
import {
  refillIfNeeded,
  type LivesState,
} from '@/services/livesService';

interface LivesIndicatorProps {
  /**
   * Three visual variants for different placements:
   *
   *   - 'pill' (default): the header-friendly compact element —
   *     small round heart icon + numeric "X / MAX" beside it.
   *     Tap opens the lives-exhausted modal (when not full). This
   *     is the variant used in the Home header next to the token
   *     badge and the Quiz header pill.
   *
   *   - 'card': full-width dark-blue card showing the same heart
   *     + number, but with label, countdown, and prominent
   *     "Tambah" CTA. Used standalone on Profile.
   *
   *   - 'inline': smaller surface for screens that need lives
   *     surfaced but not as a primary element.
   *
   *   - 'banner': large, prominent pill meant to sit above the
   *     question card on the Quiz play screen — sized so the
   *     player can't miss it during play. Includes a built-in
   *     pulse animation hook driven by `pulseToken` — bump the
   *     token from a caller to trigger a "life lost" feedback
   *     pulse without owning the Animated.Value yourself.
   */
  variant?: 'pill' | 'card' | 'inline' | 'banner';
  /**
   * Fires when the user taps the indicator. Caller decides whether
   * to open the refill modal (`openLivesExhaustedModal`) or some
   * other surface. Tap is enabled on every variant; the visual
   * style only differs in how prominent the CTA is.
   */
  onPress?: () => void;
  /**
   * Increment to trigger a pulse animation on the banner variant.
   * Default 0 — the banner sits still. Bumping this number (e.g.
   * on each wrong answer) fires a single quick "scale + flash"
   * pulse so the player gets visible feedback that they just
   * lost a life. Only meaningful for the 'banner' variant; the
   * other variants ignore it.
   */
  pulseToken?: number;
}

/**
 * Compact lives indicator. The primary form ('pill') is a small
 * rounded pill with a heart icon (filled when lives remain, outlined
 * when empty/dim) and a numeric `X / MAX` count beside it. Sized to
 * live next to the token badge in the Home header or as a corner
 * element in the Quiz header without crowding either surface.
 *
 * Why a heart *icon* + number instead of "X" alone or 5 separate
 * hearts:
 *   - The heart remains the universal "lives" glyph — players
 *     instantly recognize it even at this small size.
 *   - The number gives exact remaining count for the player who
 *     wants to know "how many wrong answers can I afford before
 *     forced refill?" without counting dots.
 *   - A single circle is much cheaper to render than five
 *     independent icon glyphs, and stays aligned with the
 *     brand's existing pill language (token badge, etc).
 *
 * Refresh strategies:
 *
 *   1. On mount, fire `refillIfNeeded` so any pending time-based
 *      refill tick is applied to Firestore and the local context.
 *   2. A 30-second `setInterval` re-renders any countdown label
 *      so "1j 24m lagi" ticks down without a screen refresh. The
 *      transaction itself is NOT re-run every 30s — that would be
 *      wasteful.
 *
 * The component reads `userData.lives` from the auth context, so
 * any write path that updates lives (quiz wrong answer, ad refill,
 * token refill) propagates here as long as the caller hits the
 * same `users/{uid}` doc — all `livesService` functions do.
 */
export function LivesIndicator({
  variant = 'pill',
  onPress,
  pulseToken = 0,
}: LivesIndicatorProps) {
  const { userData } = useAuth();
  const [msUntilNext, setMsUntilNext] = useState<number | null>(null);
  // Pulse animation for the banner variant. Driven externally via
  // `pulseToken` — the parent bumps that number when a life is
  // lost and we run a quick scale+flash here. Default 0 means no
  // pulse on first mount.
  const pulseAnim = useState(() => new Animated.Value(0))[0];
  const lastPulseTokenRef = useRef<number>(0);

  useEffect(() => {
    if (variant !== 'banner') return;
    if (pulseToken === 0 || pulseToken === lastPulseTokenRef.current) return;
    lastPulseTokenRef.current = pulseToken;
    pulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulseToken, variant, pulseAnim]);

  // Map the 0→1→0 pulse timeline into a visible scale + tilt so the
  // heart icon visibly "thumps" when a life is lost.
  const bannerPulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });
  const bannerPulseShake = pulseAnim.interpolate({
    inputRange: [0, 0.4, 0.7, 1],
    outputRange: [0, -3, 3, 0],
  });

  // Pull any pending refill into the doc on first mount. Idempotent —
  // safe to call from every screen that renders this indicator.
  useEffect(() => {
    if (!userData?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const next: LivesState = await refillIfNeeded(userData.uid);
        if (cancelled) return;
        setMsUntilNext(next.msUntilNextRefill);
      } catch {
        // Non-fatal — UI falls back to the cached value.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userData?.uid]);

  // Tick any countdown label every 30s. Lightweight — no Firestore
  // traffic, just a local state update. Only meaningful for the
  // 'card' / 'inline' variants that actually display a countdown.
  useEffect(() => {
    if (msUntilNext == null) return;
    const interval = setInterval(() => {
      setMsUntilNext((prev) => (prev == null ? null : Math.max(0, prev - 30_000)));
    }, 30_000);
    return () => clearInterval(interval);
  }, [msUntilNext]);

  // Treat missing/legacy `lives` as full health so the indicator
  // doesn't render a misleading "0/5" on the first session after
  // this feature ships. `Number.isFinite` is the explicit guard
  // against NaN slipping through — `typeof NaN === 'number'` so
  // a naive `typeof === 'number'` check would pass NaN through
  // and render "NaN/5". Hits in the wild if a writes service
  // does arithmetic that produces NaN (e.g. `undefined - 1`) and
  // then stores it; defensive normalization here means the UI
  // never shows the broken value to the player.
  const rawLives = userData?.lives;
  const currentLives =
    typeof rawLives === 'number' && Number.isFinite(rawLives)
      ? Math.max(0, Math.min(LIVES_CONFIG.MAX, Math.floor(rawLives)))
      : LIVES_CONFIG.MAX;

  const isFull = currentLives >= LIVES_CONFIG.MAX;
  // Countdown display — just the raw duration (e.g. "18 minit",
  // "1 jam 24 minit"). No "Refill:" prefix, no "Lives penuh"
  // subtitle — player asked for the time to be the only signal.
  // Returns null when lives are full so the UI can suppress the
  // countdown line entirely (no silent "Lives penuh" placeholder
  // — silence IS the full-lives state, the pill color already
  // signals that).
  const refillText =
    isFull || msUntilNext == null || !Number.isFinite(msUntilNext)
      ? null
      : formatCountdown(msUntilNext);

  if (variant === 'inline') {
    return (
      <View style={styles.inlineRow}>
        <View style={[styles.heartCircle, styles.heartCircleSm]}>
          <Ionicons
            name={isFull ? 'heart' : 'heart-outline'}
            size={14}
            color={isFull ? '#ffffff' : 'rgba(26,58,92,0.7)'}
          />
        </View>
        <Text style={styles.inlineCountText} numberOfLines={1}>
          {currentLives}/{LIVES_CONFIG.MAX}
        </Text>
        {!isFull && msUntilNext != null && (
          <Text style={styles.inlineCountdown} numberOfLines={1}>
            · {formatCountdown(msUntilNext)}
          </Text>
        )}
      </View>
    );
  }

  if (variant === 'card') {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={onPress ? 0.85 : 1}
        accessibilityRole="button"
        accessibilityLabel={`Nyawa ${currentLives} daripada ${LIVES_CONFIG.MAX}`}
      >
        <View style={[styles.heartCircle, styles.heartCircleLg]}>
          <Ionicons
            name={isFull ? 'heart' : 'heart-outline'}
            size={26}
            color="#ffffff"
          />
        </View>
        <View style={styles.cardRight}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>NYAWA ANDA</Text>
            <Text style={styles.cardCount} numberOfLines={1}>
              {currentLives}
              <Text style={styles.cardCountMax}> / {LIVES_CONFIG.MAX}</Text>
            </Text>
          </View>
          <Text style={styles.cardCountdown} numberOfLines={1}>
            {refillText}
          </Text>
          {!isFull && (
            <View style={styles.cardCta}>
              <Text style={styles.cardCtaText} numberOfLines={1}>
                Tambah nyawa →
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Default: 'pill' variant — small round heart + X/MAX number,
  // designed to sit next to the token badge in the Home header.
  // Tap enabled across the board; the parent decides whether to
  // route into the modal or another surface.
  if (variant === 'banner') {
    // Large, prominent pill designed to sit above the question
    // card on the Quiz play screen. Sized big enough that the
    // player can't miss it during play — the heart is 28px
    // (vs. 16px on the header pill) and the count beside it is
    // 22px (vs. 13px). Color shifts:
    //   - isFull → calm light-peach pill, red heart, dark count
    //   - low    → coral pill, white heart, white count
    //              (sub-conscious alert — same palette as the
    //               header `pillLow` so the visual language stays
    //               consistent).
    // Tap routes to the refill modal via the same `onPress` the
    // other variants use. The pulse animation (driven by
    // `pulseToken`) gives the player visible feedback when they
    // just lost a life — without it, the only feedback is the
    // quiet number change in the corner.
    //
    // Countdown lives *below* the pill (not inside) so the pill
    // stays compact and focused on the count. Player sees the
    // pill first ("how many lives"), then the countdown ("when
    // do I get more") as a second read. Only renders when not
    // full — there's no countdown when lives are topped up.
    return (
      <View style={styles.bannerWrap}>
        <TouchableOpacity
          style={[
            styles.banner,
            isFull ? styles.bannerFull : styles.bannerLow,
          ]}
          onPress={onPress}
          activeOpacity={onPress ? 0.85 : 1}
          accessibilityRole="button"
          accessibilityLabel={`Nyawa ${currentLives} daripada ${LIVES_CONFIG.MAX}`}
        >
          <Animated.View
            style={[
              styles.bannerHeartWrap,
              {
                transform: [
                  { scale: bannerPulseScale },
                  { translateX: bannerPulseShake },
                ],
              },
            ]}
          >
            <Ionicons
              name={currentLives > 0 ? 'heart' : 'heart-outline'}
              size={28}
              color={isFull ? '#c0392b' : '#ffffff'}
            />
          </Animated.View>
          <View style={styles.bannerCountWrap}>
            <Text
              style={[
                styles.bannerCount,
                isFull ? styles.bannerCountFull : styles.bannerCountLow,
              ]}
              numberOfLines={1}
            >
              {currentLives}
              <Text style={styles.bannerCountMax}> / {LIVES_CONFIG.MAX}</Text>
            </Text>
            <Text
              style={[
                styles.bannerLabel,
                isFull ? styles.bannerLabelFull : styles.bannerLabelLow,
              ]}
              numberOfLines={1}
            >
              NYAWA
            </Text>
          </View>
        </TouchableOpacity>
        {/* Refill countdown — pure duration, no "Refill:" prefix.
            Suppressed entirely when lives are full or while the
            first `refillIfNeeded` call is in flight (so we never
            flash "Memuat..." or "Lives penuh" at the player — just
            silence when there's nothing to show). */}
        {refillText !== null && (
          <Text style={styles.bannerCountdown} numberOfLines={1}>
            {refillText}
          </Text>
        )}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.pill, isFull ? styles.pillFull : styles.pillLow]}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      accessibilityRole="button"
      accessibilityLabel={`Nyawa ${currentLives} daripada ${LIVES_CONFIG.MAX}`}
    >
      <View style={styles.pillHeartWrap}>
        <Ionicons
          // Outline when empty, solid when there's at least one —
          // mirrors the standard "heart-outline" / "heart" pair
          // used elsewhere in the app for this same semantic.
          name={currentLives > 0 ? 'heart' : 'heart-outline'}
          size={16}
          color={isFull ? '#c0392b' : '#ffffff'}
        />
      </View>
      <View style={styles.pillRightCol}>
        <Text style={[styles.pillCount, isFull && styles.pillCountFull]} numberOfLines={1}>
          {currentLives}/{LIVES_CONFIG.MAX}
        </Text>
        {/* Countdown sub-line inside the pill. Suppressed when
            lives are full so the happy state stays compact (no
            "Lives penuh" text — the player can tell at a glance
            from the peach pill color). When not full, this is
            the player's main attention target ("how long until
            next life"). Font sized small (10px) to keep the
            pill height close to its previous single-row size —
            36 → 44px so the header alignment shifts only
            modestly. */}
        {/* Countdown — pure duration, no prefix. Suppressed when
            full or loading so the pill stays compact. Sized small
            (9px) so the pill grows modestly when rendered. */}
        {refillText !== null && (
          <Text style={styles.pillCountdown} numberOfLines={1}>
            {refillText}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Format a milliseconds duration as a short Malay-friendly string.
 * Examples: "45 minit", "1 jam 24 minit", "9 jam".
 */
function formatCountdown(ms: number): string {
  if (ms <= 0) return 'sebentar lagi';
  const totalMinutes = Math.ceil(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} minit`;
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (remainingMinutes === 0) return `${hours} jam`;
  return `${hours} jam ${remainingMinutes} minit`;
}

// Standalone lives-exhausted modal trigger — callers wire this to
// the onPress prop on `<LivesIndicator />`. Pulled out so the same
// handler can be shared by Home, Profile, and Quiz screens without
// each one re-defining the navigation logic.
export function openLivesExhaustedModal(
  router: ReturnType<typeof useRouter>
): void {
  router.push('/quiz/lives-empty');
}

// Re-export so screens that already import from this file don't
// need a second import line for the constant.
export { LIVES_CONFIG };

const styles = StyleSheet.create({
  // ---- Pill variant (default — header) ----
  // Outer pill sized to sit alongside the token badge (50–56px tall)
  // without competing with it. Color shifts based on fullness:
  //   - `pillFull` (lives = MAX): light grey-white pill with red
  //     text/heart — calm, "you're fine".
  //   - `pillLow` (lives < MAX): warm coral pill with white text —
  //     visibly different so the player notices pending refill.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
    paddingLeft: 6,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    gap: 6,
  },
  pillFull: {
    backgroundColor: '#FFE8D5',
  },
  pillLow: {
    backgroundColor: '#ff7b9c',
  },
  // Small light "halo" around the heart icon — gives the icon
  // breathing room inside the pill so the X/MAX number doesn't
  // crowd it. White-ish color matches the pillLow contrast; on
  // pillFull it's a peachy tone picked to harmonize.
  pillHeartWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillCount: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  pillCountFull: {
    color: '#c0392b',
  },
  // Right-side column that holds count + countdown. Pushed
  // beside the heart wrap with `flexDirection: row` on the
  // outer pill. Vertical centering keeps both lines aligned
  // to the heart icon's optical center.
  pillRightCol: {
    justifyContent: 'center',
  },
  // Countdown sub-line. Small enough to live under the count
  // without forcing the pill much taller — the pill grows
  // from 36px to ~44px when this is rendered, which the
  // header alignment accepts without needing a layout
  // reflow (Home header is `alignItems: 'center'`).
  pillCountdown: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
    marginTop: 1,
  },

  // ---- Card variant (Profile) ----
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    gap: Spacing.md,
  },
  cardRight: {
    flex: 1,
    minWidth: 0,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 10,
    color: Colors.accent,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  cardCount: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    lineHeight: 26,
  },
  cardCountMax: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  cardCountdown: {
    fontSize: FontSize.xs,
    color: Colors.white,
    opacity: 0.85,
    fontWeight: '500',
    marginBottom: 6,
  },
  cardCta: {
    alignSelf: 'flex-start',
  },
  cardCtaText: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ---- Shared heart-circle (card + inline) ----
  heartCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff5b7d',
  },
  heartCircleLg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  heartCircleSm: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },

  // ---- Inline variant ----
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  inlineCountText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.primary,
  },
  inlineCountdown: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },

  // ---- Banner variant (Quiz play screen) ----
  // Wrapper holds the pill + the optional countdown line that
  // sits below it. Aligned to center so the countdown hugs the
  // pill rather than stretching to full width.
  bannerWrap: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  // Big, self-contained pill that lives above the question card.
  // Color logic mirrors `pillLow`/`pillFull` for visual consistency.
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    height: 56,
    paddingLeft: 6,
    paddingRight: 16,
    borderRadius: 28,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  bannerFull: {
    backgroundColor: '#FFE8D5',
  },
  bannerLow: {
    backgroundColor: '#ff5b7d',
  },
  bannerHeartWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCountWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  bannerCount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.4,
    lineHeight: 26,
  },
  bannerCountMax: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  bannerCountFull: {
    color: '#1f2347',
  },
  bannerCountLow: {
    color: '#ffffff',
  },
  bannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  bannerLabelFull: {
    color: 'rgba(31,35,71,0.55)',
  },
  bannerLabelLow: {
    color: 'rgba(255,255,255,0.85)',
  },
  // Countdown line below the pill. White text on the lavender
  // gradient with subtle shadow for legibility. Wraps in a small
  // pill-shape background when the player is in the "low" state
  // — the slight container gives the countdown its own
  // visual weight separate from the main lives pill.
  bannerCountdown: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(31,35,71,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});