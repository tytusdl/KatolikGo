/**
 * Centralised route strings — single source of truth so a typo or
 * a file rename gets caught at import time instead of silently
 * routing to "Unmatched Route".
 *
 * Convention (per AGENTS.md "Routing conventions"):
 *   - `Routes.*` constants keep the literal layout-group prefix
 *     (`/(tabs)`, `/(auth)`) because that's what `router.push` /
 *     `router.replace` consume.
 *   - `Routes.PATHNAMES.*` mirrors them with the parens stripped,
 *     matching what `usePathname()` returns (expo-router v6 strips
 *     the parens-prefixed names from the resolved pathname).
 *
 * Use `Routes.LOGIN` for `router.replace(Routes.LOGIN)` and
 * `Routes.PATHNAMES.LOGIN` for `pathname === Routes.PATHNAMES.LOGIN`.
 * Mixing the two is the most common routing bug in this codebase.
 */
export const Routes = {
  // Authenticated app screens (under the (tabs) layout group).
  HOME: '/(tabs)/index',
  PROFILE: '/(tabs)/profile',
  LEADERBOARD: '/(tabs)/leaderboard',
  QUIZ_PICKER: '/(tabs)/quiz',

  // Auth screens (under the (auth) layout group).
  LOGIN: '/(auth)/login',
  REGISTER: '/(auth)/register',

  // Stand-alone routes (no layout group).
  ONBOARDING: '/onboarding',
  ADMIN: '/admin',

  // Quiz play / result / lives-empty stack (under quiz/_layout.tsx).
  QUIZ_LEVEL: (level: number | string) => `/quiz/${level}`,
  QUIZ_RESULT: '/quiz/result',
  QUIZ_LIVES_EMPTY: '/quiz/lives-empty',
} as const;

/**
 * `usePathname()` returns paths with the layout-group parens
 * stripped (expo-router v6 quirk). Keep these in lockstep with
 * `Routes.*` so a rename in one propagates to the other.
 */
export const Pathnames = {
  HOME: '/',
  PROFILE: '/profile',
  LEADERBOARD: '/leaderboard',
  QUIZ_PICKER: '/quiz',
  LOGIN: '/login',
  REGISTER: '/register',
  ONBOARDING: '/onboarding',
  ADMIN: '/admin',
  QUIZ_LEVEL: (level: number | string) => `/quiz/${level}`,
  QUIZ_RESULT: '/quiz/result',
  QUIZ_LIVES_EMPTY: '/quiz/lives-empty',
} as const;
