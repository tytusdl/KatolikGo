/**
 * Admin unlock passphrase.
 *
 * Reads `EXPO_PUBLIC_ADMIN_PASSPHRASE` from the environment. When the
 * variable is empty / unset, the admin unlock feature is disabled —
 * every consumer (the `AuthScreen` button, `adminService` grant-
 * by-passphrase) should call `isAdminUnlockConfigured()` before
 * showing the entry point.
 *
 * Verification is constant-time (XOR-mismatch accumulator) so a
 * timing attack on the comparison can't easily brute-force short
 * passphrases one character at a time. Still a best-effort check —
 * see the security caveats below.
 *
 * Security caveats:
 *   - `EXPO_PUBLIC_*` env vars are bundled into the JS at build
 *     time. A determined attacker who can decode the bundle can
 *     read the passphrase directly. The constant-time check only
 *     slows down remote-attempt enumeration, not local extraction.
 *   - The proper production fix is a Cloud Function
 *     `verifyAdminPassphrase(input)` callable only from the dev's
 *     device (e.g. allowlisted email match in the function), which
 *     keeps the secret server-side. Firestore rules aren't deployed
 *     yet (per AGENTS.md §"Firestore rules design checklist"), so
 *     this client-side check is a reasonable placeholder for an
 *     early-stage single-dev build.
 *   - Anonymous ("Tetamu") accounts are blocked from the grant path
 *     by `grantAdminByPassphrase` — guest docs are device-bound and
 *     would be wiped on uninstall, defeating the purpose.
 */

const PASSPHRASE = (process.env.EXPO_PUBLIC_ADMIN_PASSPHRASE ?? '').trim();

/**
 * True when the admin unlock feature is enabled (env var is set to
 * a non-empty string AND we're in a development build). Use this as
 * the visibility flag for any "Admin Access" entry point — when
 * false, the button should hide entirely so normal users never see
 * a non-functional control.
 *
 * The `__DEV__` belt-and-suspenders is intentional: `EXPO_PUBLIC_*`
 * env vars are bundled into the JS at build time (see the security
 * caveats in the file header), so an attacker who decodes a
 * production APK can read the passphrase and disable-this-bypass it.
 * Forcing `__DEV__ === true` means even a leaked production env
 * var can't surface the unlock UI in shipped builds. Dev-only
 * features that read bundled secrets MUST use this gate.
 */
export function isAdminUnlockConfigured(): boolean {
  return PASSPHRASE.length > 0 && __DEV__ === true;
}

/**
 * Constant-time comparison. Both lengths must match exactly
 * (no truncation or padding) and we walk every character
 * unconditionally, accumulating XOR mismatches into a single
 * integer we check at the end. The actual check happens in
 * `O(n)` regardless of which character (if any) is wrong.
 *
 * Note: requires `input` to be the same length as the stored
 * passphrase. A short input is rejected before the loop runs
 * (which leaks the length, but that's fine — the only secret
 * is the content, not its length).
 *
 * Mirrors the `__DEV__` gate from `isAdminUnlockConfigured` —
 * a production build with the env var set will refuse every
 * passphrase (always returns false) so the comparison body is
 * dead code in shipped builds. `BAD_PASSPHRASE` still fires so
 * the screen surfaces the same Malay error.
 */
export function verifyAdminPassphrase(input: string): boolean {
  if (!__DEV__ || PASSPHRASE.length === 0) return false;
  if (input.length !== PASSPHRASE.length) return false;
  let mismatch = 0;
  for (let i = 0; i < PASSPHRASE.length; i++) {
    mismatch |= input.charCodeAt(i) ^ PASSPHRASE.charCodeAt(i);
  }
  return mismatch === 0;
}
