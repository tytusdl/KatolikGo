import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistent auth flag.
 *
 * Firebase Auth in this project is set up with `getReactNativePersistence`
 * (AsyncStorage-backed) at app init time, so by default a session
 * survives across cold app restarts. The `rememberMe` flag lets the
 * user opt OUT of that behavior — checking the login screen's
 * "Remember Me" box keeps the current behavior, leaving it unchecked
 * makes `AuthContext` sign out any restored session on next cold
 * start so the user lands back on /login.
 *
 * Note: this is a deliberate, narrow UX gate. Switching Firebase
 * persistence modes at runtime (`reactNativeLocalPersistence` ⇄
 * `inMemoryPersistence`) requires recreating the auth instance which
 * is invasive and would briefly sign the user out anyway — we get the
 * same user-facing effect by simply signing out at boot if the flag
 * was off last time.
 *
 * Default: `true` (current persistent behavior). Once a user has been
 * onboarded, their first login writes the choice; subsequent logins
 * overwrite it.
 */

const STORAGE_KEY = 'katolikgo.remember_me';

/**
 * Read the persisted preference. Defaults to `true` when unset so we
 * never regress the existing behavior for users who've never touched
 * the new checkbox.
 */
export async function getRememberMe(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    // Storage failure shouldn't break the boot — fail safe to the
    // existing "remember" default.
    return true;
  }
}

/**
 * Persist the preference after a successful sign-in. Capture the
 * user's choice right when they sign in so cold-start logic always
 * reflects the most recent intent, not some stale setting.
 */
export async function setRememberMe(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // Non-fatal: the worst case is the next cold start uses the prior
    // preference. Don't surface this to the user — login still works.
  }
}
