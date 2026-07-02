# AGENTS.md — KatolikGo

Single source of truth for AI coding agents working on this repo. Read this first before touching anything.

---

## What this project is

**KatolikGo** — gamified quiz app for Catholic catechism, Bible, and trivia. Bahasa Melayu UI, Expo / React Native, Firebase backend. Target: iOS + Android via Expo SDK 54.

User persona: solo developer building and shipping from a Windows laptop.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Expo SDK 54 (`expo` ~54.0.0) | React Native 0.81.5, React 19.1.0 |
| Routing | `expo-router` ~6.0.24 | File-based, layout groups `(auth)`, `(tabs)`, `onboarding.tsx` |
| Backend | Firebase 11 (`firebase` ^11.0.0) | Auth + Firestore. **No Realtime DB, no Storage.** |
| Persistence | `@react-native-async-storage/async-storage` 2.2.0 | Used for onboarding flag + Firebase Auth session |
| Icons | `@expo/vector-icons` ~15.x | See gotcha below |
| Auth session | `expo-auth-session` ~7.0.11 | Google + Facebook OAuth (Facebook disabled by default) |
| TypeScript | ~5.9.2, strict mode | `tsconfig.json` extends `expo/tsconfig.base` |

---

## Repository layout

```
src/
  app/                       # expo-router file-based routes
    _layout.tsx              # Root Stack + AuthGate
    onboarding.tsx           # 4-slide intro flow
    (auth)/
      _layout.tsx            # Auth group Stack
      login.tsx
      register.tsx
    (tabs)/
      _layout.tsx            # Bottom tabs
      index.tsx              # Home
      quiz.tsx               # Quiz level picker
      leaderboard.tsx
      profile.tsx
    quiz/
      [level].tsx            # Quiz play screen
      result.tsx
  components/                # ScreenContainer, Button, Card
  config/
    firebase.ts              # Firebase init + initializeAuth(AsyncStorage)
  constants/theme.ts         # Colors, Spacing, FontSize, BorderRadius
  contexts/
    AuthContext.tsx          # AuthProvider + useAuth
  services/
    authService.ts           # loginUser, registerUser, ensureUserDocument, friendlyAuthError
    socialAuthService.ts     # Google / Facebook OAuth
    tokenService.ts          # spendToken, awardTokens, unlockLevelWithToken
    levelService.ts
    quizService.ts
    leaderboardService.ts
    seedService.ts           # Seeds Firestore quizzes on first launch
  types/index.ts             # UserData, Quiz, LevelProgress, etc.
  utils/
    onboarding.ts            # markOnboarded(), hasOnboarded()
scripts/                     # One-off admin / seed scripts (uses firebase-admin)
```

---

## Commands

| Action | Command |
|---|---|
| Type-check | `npx tsc --noEmit` |
| Lint | `npx expo lint` (auto-installs `eslint` + `eslint-config-expo` on first run) |
| Dev server | `npx expo start` |
| iOS | `npx expo start --ios` |
| Clear Metro cache | `npx expo start --clear` |

CI gate for any PR: `tsc --noEmit` AND `expo lint` both exit 0.

---

## Critical: Auth flow

The auth state machine is non-obvious. Read `src/contexts/AuthContext.tsx` and `src/app/_layout.tsx` before touching it.

- `src/config/firebase.ts` calls `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` with a runtime cast — TS doesn't expose `getReactNativePersistence` in the public typings (firebase 11 + customConditions don't propagate through barrel re-exports). Do not "fix" the cast without verifying the runtime resolution still works.
- `AuthContext` subscribes to `onAuthStateChanged` once, synchronously, with proper cleanup. **Do not** wrap the subscribe in `async` — the cleanup is a `useEffect` return and Promises get ignored.
- `onAuthChange` callback awaits `getUserData` and `ensureUserDocument`. While that promise is pending, the context exposes `userDataLoading: true`. AuthGate waits on both `loading` and `userDataLoading` before redirecting — this prevents a race where a freshly-signed-in user lands on a tab with `userData: null`.
- Every successful authentication (fresh login, re-login, persisted session restore) calls `void markOnboarded()`. Idempotent. This guarantees `hasOnboarded()` returns `true` after the first login, so the onboarding flow never re-appears for an existing user.
- AuthGate (`src/app/_layout.tsx`) is the only place that calls `router.replace` for auth-driven navigation. Auth screens (`login.tsx`, `register.tsx`) must NOT call `router.replace` after sign-in — they will race with AuthGate. Sign-in handlers should only `await` the auth function and let the context propagate.

**Persisted password storage was removed.** Earlier versions stored plaintext passwords in AsyncStorage (`saveCredentials` / `getSavedCredentials` / `autoLogin`). All deleted. Do not reintroduce.

---

## Routing conventions

- File-based, default to Stack at root.
- Layout groups `(auth)`, `(tabs)`, `onboarding` are siblings in the Stack.
- **Do NOT register layout groups as `<Stack.Screen>` in the root `_layout.tsx`.** In expo-router v6, `(tabs)/index` normalizes to URL `/`, but a Stack.Screen named `"(tabs)"` is looked up by the literal parens-prefixed segment. The mismatch surfaces as "Unmatched Route — Page could not be found." when the user lands at `/` after login. Layout groups are auto-discovered from the file system; explicit Stack.Screen entries for them break the resolver. See `src/app/_layout.tsx` for the current (correct) pattern — only `onboarding`, `quiz/[level]`, `quiz/result` are registered; `(auth)` and `(tabs)` are NOT.
- When redirecting from AuthGate, use the explicit child path `router.replace('/(tabs)/index')`. Auth screens (`login.tsx`, `register.tsx`) must NOT call `router.replace` after sign-in — they will race with AuthGate.

---

## Data model

`users/{uid}` document fields (`src/types/index.ts → UserData`):

```ts
{
  uid, email, displayName,
  parishId: string | null, parishName: string | null,
  tokens: number, isPremium: boolean,
  currentLevel: number,
  totalXP, weeklyXP, monthlyXP,
  levelProgress: Record<number, { completed, bestScore, attempts }>,
  streakDays: number,
  levelsCompleted: number[],   // derived; kept in sync with levelProgress by service layer
  friendsCount: number,
  accuracy: number,            // 0-100 percentage
  quizzesThisMonth: number,
  createdAt, updatedAt,        // serverTimestamp on write, ms epoch on read — type is a lie but tolerated
}
```

Streak / accuracy / friendsCount / quizzesThisMonth / levelsCompleted are surfaced in the UI but currently zeroed by default — they are placeholders for future engagement features. If you add UI logic that computes them, do it server-side (Cloud Function or transactional Firestore write) and update via `updateUserData`.

---

## `@expo/vector-icons` gotcha

`@expo/vector-icons` v15+ ships font files in `build/vendor/react-native-vector-icons/Fonts/`. Metro resolves `./vendor/.../Foundation.ttf` relative to each `build/Foundation.js`. If the fonts appear missing after install, the npm `prepare` script (which copies them) was blocked. Symptoms: `Unable to resolve module ./vendor/react-native-vector-icons/Fonts/Foundation.ttf`.

Recovery (without `--ignore-scripts`):
1. `Remove-Item node_modules/@expo/vector-icons -Recurse -Force`
2. `npm install @expo/vector-icons` (no flags — `prepare` runs on this machine unless `.npmrc` blocks it)
3. `npx expo start --clear`

Default Expo Metro config (no `metro.config.js`) handles `.ttf` as an asset. Do not add `metro.config.js` unless you need custom transforms.

---

## Environment / tooling notes

- Windows shell is PowerShell. Use `;` not `&&`, `Get-ChildItem` not `ls`, `Select-String` not `grep`. No `head` / `tail` / `wc`.
- User-level `.npmrc` restricts postinstall scripts (`allow-scripts=opencode-ai`). This means `npx expo install` may fail with `EALLOWSCRIPTS`. Workaround: use plain `npm install <pkg> --save[-dev]` (no `--ignore-scripts`). The `@expo/vector-icons` `prepare` script does run for top-level `npm install` calls; only `npx expo install`'s wrapper triggers the policy block.
- Repo path has a space (`KatolikGo Project\KatolikGo`). Most tooling handles this but if you see weird path errors, quote or escape.

---

## Recent architectural changes (so you don't re-fix these)

| Date | Change | Why |
|---|---|---|
| 2026-07-02 | Removed plaintext password AsyncStorage caching | Security hole; Firebase Auth + AsyncStorage persistence handles rehydration natively now |
| 2026-07-02 | Refactored `AuthContext` listener (sync subscribe, proper cleanup) | Prior async-wrapped init leaked the unsubscribe |
| 2026-07-02 | Added `userDataLoading` to context | Prevented UI race where `(tabs)` mounted with `userData: null` |
| 2026-07-02 | Added onboarding flag in `utils/onboarding.ts` + auto-mark on every auth | Returning users were seeing onboarding on every cold start |
| 2026-07-02 | All `router.replace('/')` calls removed from auth screens | Was racing with AuthGate redirect |
| 2026-07-02 | Navigation paths explicit (`/(tabs)/index` not `/(tabs)`) | expo-router v6 ambiguity |
| 2026-07-02 | ESLint + `eslint-config-expo` auto-installed and wired | First-run command will install; subsequent runs are fast |

---

## Out of scope (don't accidentally fix)

- The placeholders `streakDays`, `levelsCompleted`, `friendsCount`, `accuracy`, `quizzesThisMonth` are zeroed. Wiring real values is a feature, not a bug fix.
- Facebook login is **intentionally disabled**. `FACEBOOK_APP_ID` is read from `EXPO_PUBLIC_FACEBOOK_APP_ID` env var; if empty, the Facebook button is disabled at runtime. Do not "fix" the placeholder strings.
- Firestore security rules are not in this repo. Assume they need review but do not change app code based on guesses about them.
- `seed-quizzes.ts` script under `scripts/` uses `firebase-admin` — runs outside the app. Do not auto-run during normal dev.

---

## When you make changes

1. Run `npx tsc --noEmit` and `npx expo lint` before claiming done.
2. If you touch `src/config/firebase.ts` or `src/contexts/AuthContext.tsx`, re-read the "Critical: Auth flow" section above.
3. If you add a new screen to `(auth)` or `(tabs)`, the parent `_layout.tsx` does not need editing — expo-router auto-discovers routes under layout groups. The Stack.Screen entries in `src/app/_layout.tsx` are only needed for explicit options; layout-group names are valid there.
4. Update this file if you add a new directory, new service, new env requirement, or new gotcha. Keep it as the only entry point for the next agent.