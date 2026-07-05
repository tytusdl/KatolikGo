import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage keys follow the `katolikgo.<dotted.namespace>` convention
 * (see `utils/rememberMe.ts`). The legacy key `@katolikgo_onboarded`
 * (snake_case + `@` prefix from the RN-AsyncStorage convention) is
 * still READ on cold start so devices with an older build keep their
 * previous state through the upgrade. Once the rollout is settled we
 * can drop the legacy fallback — kept here as a one-release safety
 * net because uninstall/reinstall is the only way a user would lose
 * this flag and we'd rather not force them through onboarding again.
 */
export const ONBOARDED_KEY = 'katolikgo.onboarded';
const LEGACY_ONBOARDED_KEY = '@katolikgo_onboarded';

/**
 * Persist that the user has finished the onboarding flow so they
 * never see it again. Tolerant of storage failures — onboarding is
 * a UX nicety, never a hard gate.
 *
 * Also opportunistically clears the legacy `@katolikgo_onboarded`
 * key on a successful write so the next cold start doesn't have to
 * keep reading two keys. Idempotent — clearing a missing key is a
 * no-op.
 */
export async function markOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
    await AsyncStorage.removeItem(LEGACY_ONBOARDED_KEY).catch(() => {
      /* non-fatal — legacy key might not exist or storage might be
         in read-only mode on a sandboxed device; doesn't matter */
    });
  } catch (err) {
    console.warn('[onboarding] failed to set onboarded flag', err);
  }
}

export async function hasOnboarded(): Promise<boolean> {
  try {
    let flag = await AsyncStorage.getItem(ONBOARDED_KEY);
    // Back-compat read for users on the legacy key. Prefer the new
    // namespace; fall back to the old one only if missing.
    if (flag === null) {
      flag = await AsyncStorage.getItem(LEGACY_ONBOARDED_KEY);
    }
    return flag === 'true';
  } catch {
    return false;
  }
}
