/**
 * Rewarded-ad service — STUB.
 *
 * Wires the *interface* for showing a rewarded ad that the lives
 * system expects (`adsService.showRewardedAd()`), but the actual SDK
 * call is a no-op until a real ad provider is integrated (e.g.
 * `react-native-google-mobile-ads` AdMob, `expo-ads-admob`, or the
 * Expo Ads SDK once it lands).
 *
 * The current stub resolves `false` so the lives modal's "Tonton
 * Iklan" button can render without crashing — but every tap will
 * surface the "Iklan belum tersedia" message instead of playing an
 * ad. This is intentional: we'd rather ship a labeled no-op than
 * fake a reward and inflate lives for free.
 *
 * When a real provider is wired:
 *   1. Replace `showRewardedAd` with a `Promise<boolean>` that calls
 *      the provider's rewarded-ad API. Resolve `true` only after the
 *      ad finishes (skipped ads count as aborted — `false`).
 *   2. Add provider config (App IDs, ad unit IDs) under
 *      `app.json` / `eas.json` env vars — do NOT hardcode them.
 *   3. Update `src/app.json` plugins entry for the ad provider's
 *      Expo config plugin so the native build picks up the IDs.
 *   4. Test the ad-refill flow with the provider's test ad unit first;
 *      real ads require a real app review + payment setup.
 */

export interface RewardedAdResult {
  /** True only if the user watched the ad to completion. */
  completed: boolean;
  /**
   * Provider-specific reason when `completed` is false. Useful for
   * showing "Iklan gagal dimuatkan, cuba lagi" vs "Iklan dibatalkan"
   * without exposing internal codes to the UI.
   */
  reason?: 'not_loaded' | 'cancelled' | 'failed' | 'stub_mode';
}

/**
 * Show a rewarded ad. Resolves with `completed: true` only after the
 * user finishes watching the entire ad. Cancellation / failure /
 * load-error all resolve with `completed: false` and a `reason`.
 *
 * In stub mode, resolves immediately with `completed: false,
 * reason: 'stub_mode'` so the UI can show a "Coming soon" message.
 */
export async function showRewardedAd(): Promise<RewardedAdResult> {
  // TODO: replace with real provider call once ad SDK is integrated.
  // Example shape (AdMob, NOT IMPLEMENTED):
  //   const ad = await RewardedAd.createForAdRequest(adUnitId, {
  //     serverSideVerificationOptions: { userId, customData: 'lives_refill' },
  //   });
  //   return new Promise((resolve) => {
  //     ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
  //       resolve({ completed: true });
  //     });
  //     ad.addAdEventListener(RewardedAdEventType.AD_CLOSED, () => {
  //       // If EARNED_REWARD didn't fire, the user skipped.
  //       resolve({ completed: false, reason: 'cancelled' });
  //     });
  //     ad.load().then(() => ad.show()).catch(() => {
  //       resolve({ completed: false, reason: 'failed' });
  //     });
  //   });
  return { completed: false, reason: 'stub_mode' };
}

/**
 * Pre-warm the rewarded-ad cache. Optional — calling this on app
 * start (after auth) cuts the load delay when the user actually
 * taps the "Tonton Iklan" button. Stub returns silently.
 */
export async function preloadRewardedAd(): Promise<void> {
  // TODO: when real provider lands, call the SDK's preload here.
}