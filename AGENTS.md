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
  constants/
    theme.ts                 # Colors, Spacing, FontSize, BorderRadius
    xp.constants.ts          # XP / level curve + token rewards (see §XP math below)
  contexts/
    AuthContext.tsx          # AuthProvider + useAuth
  services/
    authService.ts           # loginUser, registerUser, ensureUserDocument, friendlyAuthError
    socialAuthService.ts     # Google / Facebook OAuth
    tokenService.ts          # spendToken, awardTokens, unlockLevelWithToken
    levelService.ts          # submitLevelCompletion (XP math + level unlock), see §XP math
    quizService.ts
    leaderboardService.ts
    seedService.ts           # Seeds Firestore quizzes on first launch
  types/index.ts             # UserData, Quiz, LevelProgress, etc.
  utils/
    onboarding.ts            # markOnboarded(), hasOnboarded()
    misc.utils.ts            # shuffleArray (Fisher-Yates), randomItems, clamp
    anti-cheat.utils.ts      # validateResponseTime / validateSessionTimings, see §Anti-cheat
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
- `onboarded` state lives in `AuthContext` (not `_layout.tsx`). The context exposes a `markOnboarded()` action that writes to AsyncStorage AND updates the in-memory state synchronously. AuthGate and `onboarding.tsx` both call this — that's what stops hot logout from looping the user back into the intro slides.
- Every successful authentication (fresh login, re-login, persisted session restore) calls the context `markOnboarded` action. Idempotent. Combined with the AsyncStorage read on cold start (`onboarded` is read once when AuthContext mounts), this means `hasOnboarded` is `true` for any user who has either finished/skip'd onboarding OR has ever logged in.
- AuthGate (`src/app/_layout.tsx`) is the only place that calls `router.replace` for auth-driven navigation. Auth screens (`login.tsx`, `register.tsx`) must NOT call `router.replace` after sign-in — they will race with AuthGate. Sign-in handlers should only `await` the auth function and let the context propagate.

**Persisted password storage was removed.** Earlier versions stored plaintext passwords in AsyncStorage (`saveCredentials` / `getSavedCredentials` / `autoLogin`). All deleted. Do not reintroduce.

---

## Routing conventions

- File-based. **Root `_layout.tsx` uses `<Slot />`, not `<Stack />`.** This is the official expo-router v6 auth-flow pattern (see https://docs.expo.dev/router/advanced/authentication-rewrites/). `<Slot />` has no navigator of its own; it renders the current route and lets the layout-group navigators (`(auth)/_layout.tsx`'s `<Stack>`, `(tabs)/_layout.tsx`'s `<Tabs>`, `quiz/_layout.tsx`'s `<Stack>`) own their own screens and `screenOptions`.
- **Do NOT register ANY `<Stack.Screen>` at the root.** Doing so (including `name="(tabs)"`, but also `name="onboarding"`, `name="quiz/[level]"`, etc.) binds a sibling screen and shadows the auto-resolved URL `/` → `(tabs)/index.tsx`. Symptom: **"Unmatched Route — Page could not be found."** after login. Reference: GH issue #40589, Stack Overflow.
  - If a screen needs `headerShown: false` and isn't inside a layout group with its own Stack, set it inline: `useNavigation().setOptions({ headerShown: false })` in a `useLayoutEffect`. See `onboarding.tsx`.
- Layout groups `(auth)`, `(tabs)` are auto-discovered by expo-router from the file system. Do not register them via `<Stack.Screen name="(auth)" />` — the literal parens-prefixed name still gets matched and breaks the resolver.
- When redirecting from AuthGate, use the explicit child path `router.replace('/(tabs)/index')`. Auth screens (`login.tsx`, `register.tsx`) use a defensive `useEffect([user])` → `router.replace('/(tabs)/index')` as a fallback (same target as AuthGate, so no real race) in case the auth-state listener misses the post-login flip.
- Layout-group identifiers `(auth)` / `(tabs)` do **not** appear in `pathname` (expo-router v6 strips them). `useSegments()` is unreliable for this — use `usePathname()` and match on normalised paths like `/login`, `/register`, `/onboarding`.
- **Splash / loading:** `_layout.tsx` directly contains the branded loading JSX while `loading || userDataLoading || !onboardingChecked`. Native splash plugin sets `backgroundColor: '#0e2a4d'` (dark blue from logo ring) + `image: './assets/logo.png'` so the launch screen matches the branded JS splash. JS side renders `<Image source={require('../assets/logo.png')} />` with `onError` fallback to a JS-drawn cross + wordmark + tagline + gold spinner. Loading screen is inlined in `_layout.tsx` on purpose — DO NOT extract it to `src/components/SplashScreen.tsx`; that file pattern was observed to white-screen on first cold start with this routing setup.
- **Status bar (icon visibility):** the root `_layout.tsx` `<StatusBar>` is `barStyle="dark-content" backgroundColor="#ffffff"` so the time/battery icons stay legible on the **light** backgrounds used by `(tabs)`, `(auth)`, `onboarding`, and `quiz/result.tsx`. The splash block inside `AuthGate` overrides this with `<StatusBar barStyle="light-content" backgroundColor="#0e2a4d" />` for the dark-blue launch screen. RN's "last mounted StatusBar wins" rule applies — keep the override inside the same component that owns the screen, not in a layout file. **Don't** flip the root back to `light-content` without auditing every screen's top strip; the older global `light-content` setup rendered white icons on white backgrounds, which made the time + battery invisible on iOS.
- **`+not-found.tsx`:** the root `Unmatched` screen is dev-only. Our custom `+not-found.tsx` flashes a spinner for ~800ms then auto-replaces back to `/`, so users who hit a broken deep link or a transient route race don't end up staring at the debug UI.

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
  createdAt, updatedAt,        // serverTimestamp on write, Firestore Timestamp on read (NOT ms epoch) — see "Service layer & Firestore gotchas" below
}
```

Streak / accuracy / friendsCount / quizzesThisMonth / levelsCompleted are surfaced in the UI but currently zeroed by default — they are placeholders for future engagement features. If you add UI logic that computes them, do it server-side (Cloud Function or transactional Firestore write) and update via `updateUserData`.

---

## Service layer & Firestore gotchas

The services in `src/services/` look straightforward but have a few non-obvious behaviours. Read this before adding new flows.

### Error handling — canonical UX pattern

For any **auth** failure surfaced to a user, use `Alert.alert('Ralat', friendlyAuthError(err))`. `friendlyAuthError` is defined in `src/services/authService.ts` and re-exported from `src/services/socialAuthService.ts` — import from whichever is closer. It maps Firebase error codes to Malay strings; falls back to `err.message` for unknowns. **Do not** call `Alert.alert(err.message)` directly — you'll leak English Firebase internals.

For **non-auth** failures thrown by `services/`, the service currently throws raw English (`tokenService.spendToken` throws `new Error('Insufficient tokens')`). Catch in the screen and localize before surfacing. `friendlyAuthError` only knows auth codes — don't try to feed `spendToken` errors through it.

### Token / XP — non-transactional races

`tokenService.awardTokens` and `levelService.submitLevelCompletion` use a read-then-write pattern (`getDoc` → compute → `setDoc(..., { merge: true })`). Two near-simultaneous calls — e.g. user completes level 5 on phone A while phone B is submitting level 4 — can clobber each other's token/XP deltas. Only `tokenService.spendToken` uses `runTransaction` (because it explicitly checks balance).

If you add any new token-earning or XP-earning flow, wrap it in a Firestore transaction that reads-modifies-writes inside the callback. Same for any flow that updates `currentLevel` — losing a concurrent level-up write is user-visible.

### Leaderboard gotchas

`subscribeToGlobalLeaderboard` / `getGlobalLeaderboard` query the entire `users` collection ordered by `totalXP desc`, limited to 50. `getParishLeaderboard` has two known traps:

1. **`rank` is global, not parish.** It queries the same global top-50, filters by `parishId` in JS, but keeps the **pre-filter** index as `rank`. A parish user sees their global XP position, not their position within their parish. If the UI labels it "Kedudukan Parish" that's misleading. Fix would need a re-rank after the `.filter()` (or a separate composite query).
2. **No `where('parishId', '==', parishId)` clause.** It filters in JS after fetching the top 50 globally. If your parish's top user is globally rank #100, they won't appear at all. Will also stop scaling past a few hundred users — switch to a `where + orderBy` composite query (and add the matching Firestore index).

If the parish feature is going to be more than decorative, address both before launch.

### Quiz data source — partial-data fallback inconsistency

`quizService.getQuizByLevel` and `getQuizByLevel` try Firestore first, then fall back to bundled `src/data/all_questions.json`. If Firestore has only levels 1-50 seeded and a user asks for level 60, they silently get the **local JSON** version (if present) instead of an empty-state. If you want strict Firestore-only or strict local-only, gate it explicitly — e.g. an env flag or a separate `forceSource: 'firestore' | 'local'` parameter. As-is it's "Firestore when present, local when not", which is convenient but surprising.

### Seed service quirks

`src/services/seedService.ts` (`seedQuizzesIfEmpty`) auto-fires from `_layout.tsx`. A few non-obvious points:

- **Single-shot per `quizzes` collection lifetime.** A module-level `seedingPromise` guards re-entry inside one process; on error it resets to `null` to allow retry on next mount. But once any document exists in `quizzes`, `seedQuizzesIfEmpty` never runs again, ever. If you change `src/data/all_questions.json` and want re-seeded data in Firestore, you'll need a versioning field, a manual cleanup, or a one-off migration script — the auto-seed won't notice.
- **Dynamic import of `writeBatch`.** The static imports above only pull `collection, getDocs, doc, setDoc`. `writeBatch` is loaded via `await import('firebase/firestore')` only when seeding actually runs — saves a few KB from initial bundle. Don't "fix" this to a top-level import.
- **First install writes ~100 documents.** Each device that cold-starts against an empty collection eats those writes. Fine on Blaze; on Spark (20K writes/day) it's ~0.5% per device install — not a problem unless you have a launch spike. Worth knowing for emulator / load testing.

### `createdAt` / `updatedAt` — Timestamp vs ms number

The `UserData.createdAt: number` type is a lie. Actually:

- **Write path**: every write passes `serverTimestamp()`. Firestore stores a server-side timestamp.
- **Read path** (via `getDoc` / `getDocs`): the field comes back as a Firestore `Timestamp` object, **not** a JS `number`. `Date.now() - userData.createdAt` would yield `NaN`.
- **Workaround used in this codebase**: `ensureUserDocument` returns `createdAt: Date.now()` for the locally-created path so the in-memory value is a number right after creation. The next Firestore fetch will overwrite it with a Timestamp.

If you add age-based logic (e.g. "user is 7 days old"), convert explicitly: `userData.createdAt?.toMillis?.() ?? Date.now()`. Same for `updatedAt`. The `Transaction` type in `types/index.ts` says `createdAt: number` but the actual value is a Timestamp — same caveat.

### Hardcoded secrets

`src/services/socialAuthService.ts` line ~21 has the Google **web** client ID hardcoded:

```ts
const GOOGLE_WEB_CLIENT_ID =
  '615054372997-mrprnf461bkdfbq2guh5lb8ossas1972.apps.googleusercontent.com';
```

Android/iOS client IDs are correctly read from env vars (`EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`). For consistency — and so rotating it doesn't require a binary update — move the web client ID to `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and read via `process.env`. Not a credential leak (OAuth client IDs are public identifiers), but a code-hygiene smell. Worth fixing the next time you touch the social auth flow.

### Things services should NOT do

- **No direct `setDoc(db, 'users', uid)` from screens.** All user-doc writes go through `authService` / `tokenService` / `levelService` so the field set, `updatedAt` stamp, and any cross-field invariants stay consistent.
- **No `Alert.alert` in `services/`.** Services throw; UI catches and surfaces. Keeps services UI-agnostic and testable.
- **No `router.replace` in `services/`.** Same reason — services stay navigation-agnostic.

---

## XP math & level unlock

`src/constants/xp.constants.ts` is the single source of truth for XP / level / token economy — backported from the `katolikgo-server` design doc. `levelService.submitLevelCompletion` is the only consumer.

- **XP formula** (`computeXpEarned`): `correctCount × 20 + wrongCount × 5 + (maxCombo ≥ 2 ? maxCombo × 2 : 0) + (perfect ? 100 : 0)`. The previous flat `Math.round(score × 10)` over-rewarded low-% passes and ignored combo / perfect bonuses — that's gone.
- **Level curve** (`xpRequiredForLevel`): cumulative threshold is `100, 250, 450, 700, 1000, 1350, ...` for levels 2-8. `getLevelFromXp(totalXP)` derives the XP-implied level.
- **Level unlock** (`levelService.submitLevelCompletion`): when a level passes, `currentLevel` becomes `max(prior currentLevel, max(level + 1, getLevelFromXp(totalXP)))`. The `Math.max` floor preserves the existing explicit-unlock semantics — backporting the formula must never *decrease* a user's unlock state.
- **Token formula** (`computeTokensEarned`): `correctCount × 5 - hintsUsed × 10 - skipsUsed × 20` (clamped ≥ 0), plus `+50` perfect bonus and `+25` first-clear bonus. First-clear bonus keeps the existing "first-time pass reward" UX.
- **Quiz UI passes per-question analytics** to `submitLevelCompletion` via the optional `details` arg: `{ questionCount, correctCount, maxCombo, hintsUsed, skipsUsed }`. The functions fall back to `(score / 100) × questionCount` inference when not supplied — so the old `submitLevelCompletion(userData.uid, level, score, userData)` call still works.

If you add a new XP / token reward source, route it through `computeXpEarned` / `computeTokensEarned` so the curve stays consistent. Don't reinvent the math in the screen.

---

## Guest mode (Firebase Anonymous Auth) restrictions

Firebase anonymous ("Tetamu") users are device-bound — uninstall the app and the whole account disappears. Because of that, anything that persists across sessions or feeds public rankings needs to be gated, otherwise we'd pollute the data with throwaway ghost accounts.

The gate is a single boolean: `UserData.isGuest`. It's auto-derived from `firebaseUser.isAnonymous` in `ensureUserDocument`, so callers don't need to remember to set it. Anywhere in the code that needs to branch on guest status, use `userData?.isGuest === true` (or `user?.isAnonymous` if `userData` isn't loaded yet).

**What guests can do:**
- Sign in / out, browse Home / Profile / Leaderboard tabs.
- Play any unlocked quiz level for the trial experience — they see the score and pass/fail as usual.
- Read the daily verse, view categories, see their (empty) stats.

**What guests CAN'T do — gated at the service layer:**
- **Earn XP or tokens from level completion.** `levelService.submitLevelCompletion` short-circuits with `{ tokensEarned: 0, xpEarned: 0, nextLevelUnlocked: false }` when `userData.isGuest`. No Firestore write happens.
- **Spend tokens on powerups (50/50, Hint, etc.).** `tokenService.spendToken` throws `GUEST_SPEND_BLOCKED` inside the transaction so a guest who slips past the pre-check (e.g. mid-play session flip) still can't drain phantom tokens. `tokenService.unlockLevelWithToken` returns `{ success: false }` early.
- **Appear on the leaderboard.** `leaderboardService.{subscribeToGlobalLeaderboard, getGlobalLeaderboard, getParishLeaderboard}` all pipe through `filterAndRank` which strips `data.isGuest` rows and recomputes `rank` post-filter so registered players aren't pushed down by ghost accounts.
- **Level progress persists.** Even if they pass a level, `levelProgress`, `currentLevel`, and `levelsCompleted` aren't written. Their wins exist only in the result screen.

**UX nudges for guest users:**
- `components/GuestModeBanner` renders on Home (full variant) and Profile (compact variant) with "Daftar" and "Log Masuk" buttons.
- `quiz/result.tsx` shows a "Skor ini tidak disimpan kerana anda log masuk sebagai Tetamu" panel with Daftar / Log Masuk buttons right under the score, so the missing reward pill isn't a mystery.
- `hooks/useGuestGuard` exposes `isGuest` + `guard(action, label)` for any new gated handler. Wraps `Alert.alert('Daftar diperlukan', ..., [Batal, Daftar → /register, Log Masuk → /login])` so the conversion flow is one tap away.
- `quiz/[level].tsx` pre-checks `isGuest` before calling `spendToken` for 50/50 and Hint. If the guest slips past (race), the `GUEST_SPEND_BLOCKED` catch translates to the same friendly modal.

**Converting a guest to a registered account** is currently a manual flow — the user signs out and signs back in with email/password (or Google / Apple). Their old anonymous UID is orphaned; Firestore doesn't auto-merge. If we want guest → registered migration without losing progress, that's `linkWithCredential` on the existing anonymous user — out of scope until the conversion flow is built. Until then, the banner's purpose is to nudge conversion before they accumulate throwaway data.

**Adding a new gated action:** wrap the handler with `guard(() => { /* real action */ }, 'Nama aksi')` from `useGuestGuard`. The label appears in the Alert title. For deeper server-side gates (e.g. parish change that writes to Firestore), mirror the pattern in the service: read the user doc, throw `GUEST_<ACTION>_BLOCKED` with a known error code, catch in the screen and translate via the same Alert.

---

## Anti-cheat (client-side, best-effort)

`src/utils/anti-cheat.utils.ts` runs per-answer and per-session response-time checks. `quiz/[level].tsx` invokes it via `validateResponseTime` (each answer, including timeout) and `validateSessionTimings` (end of session). Both `console.warn` on miss — they do **not** block the user.

- **Per-answer bounds:** 200ms ≤ responseTimeMs ≤ 120s.
- **Pattern heuristic:** `stdDev < 50ms && avg < 1000ms` across ≥4 answers → flagged as uniformly fast (bot signature).

**This is best-effort telemetry, not enforcement.** A motivated attacker patches the JS bundle. Real anti-cheat belongs in Firestore rules / Cloud Functions, which this project doesn't have deployed. Capturing the `console.warn` signal in dev / staging builds is a useful UX regression detector; do not surface the `reason` to the player in production.

When a Cloud Functions backend lands, move the same validators server-side and keep the client check as a UX hint (`answers feeling too easy? → flag the session`).

---

## Firestore-rules design checklist (mirrors in `firestore.rules`)

The repo does not deploy `firestore.rules` (AGENTS.md "Out of scope"), but the upstream `katolikgo-server` doc has rule patterns that should be mirrored as **client-side invariants** until rules land. Touch these when extending `levelService` / `tokenService`:

- **`users/{uid}` update invariant:** `xp >= old.xp`, `level >= old.level`, `tokenBalance + 50 ≥ old.tokenBalance` (max 50-token decrease per write), `updatedAt == request.time`.
- **`users/{uid}` create invariant:** `xp == 0, tokenBalance == 0, level == 1, premium == false, createdAt == now, lastLogin == now`. Currently `authService.ensureUserDocument` writes a 10-token starter — that's the one place where this rule pattern would reject a write; flag for review before rules ever ship.
- **Race surface to fix before rules:** `levelService.submitLevelCompletion` and `tokenService.awardTokens` are still read-then-write (per Service-layer gotchas §Token/XP races). Adding a `runTransaction` wrapper that closes the read-compute-write loop would let a future `firestore.rules` deploy with the invariants above without flapping on legitimate plays.

When (or if) `firestore.rules` lands in this repo, lift these from "design checklist" into actual rule files. Until then, client-side guards belong in the corresponding service.

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
| 2026-07-02 | Documented service-layer / Firestore gotchas (error UX, token/XP races, leaderboard traps, seed quirks, Timestamp type lie) in AGENTS.md | Each new agent was independently rediscovering the same non-obvious behaviours — capture once |
| 2026-07-02 | Backported XP / level / token math (`constants/xp.constants.ts`) from server-spec doc; rewired `levelService.submitLevelCompletion` and `quiz/[level].tsx` to capture per-question analytics | Flat `Math.round(score × 10)` formula over-rewarded low-% passes and ignored combo / perfect bonuses |
| 2026-07-02 | Added client-side anti-cheat (per-answer + per-session response-time validators in `utils/anti-cheat.utils.ts`); quiz screen records per-question timings + maxCombo + correctCount | No telemetry on suspicious play patterns — bot scripting was invisible |
| 2026-07-02 | Replaced `array.sort(() => Math.random() - 0.5)` in 50/50 with proper Fisher-Yates (`utils/misc.utils.ts → shuffleArray`) | Bad shuffle biased short-array distributions; 50/50 powerup could repeat the same wrong answer twice |
| 2026-07-02 | Flipped root `<StatusBar>` from `light-content` to `dark-content`; added splash-only `light-content` override | White status bar text/icons on light/pastel backgrounds (Home, Tabs, Login, etc.) made the time + battery invisible on iOS |
| 2026-07-02 | Extracted `components/AuthScreen.tsx` — shared dark-themed login/register UI with pill tab switcher, gradient background, gold cross, maroon CTA, Google + Apple + Guest sign-in | Old login.tsx/register.tsx were duplicated, light-themed, and used placeholder text-icons. New shared component matches the branded splash + onboarding dark palette and centralises the form state |
| 2026-07-02 | Added `authService.loginAsGuest()` (Firebase Anonymous Auth) + `socialAuthService.signInWithApple()` (iOS-only via `expo-apple-authentication`) | Unlocks the "Terus sebagai Tetamu" flow and Apple Sign-In button on the new auth screen. Apple module is lazy-loaded so Android bundles don't pull in the iOS-only native code |
| 2026-07-02 | Removed Facebook from `(auth)` UI entirely | User-facing decision: only Google + Apple + Guest + email/password. `socialAuthService.useFacebookAuthRequest` / `signInWithFacebook` are still in the service so the integration can be re-enabled later without re-deriving the flow |
| 2026-07-02 | Guest mode restrictions + UX nudge — `UserData.isGuest` (auto-derived from `firebaseUser.isAnonymous`); `submitLevelCompletion` returns 0 XP/tokens; `spendToken` throws `GUEST_SPEND_BLOCKED`; leaderboard queries strip guest rows via `filterAndRank`; `GuestModeBanner` renders on Home (full) + Profile (compact); `useGuestGuard` hook + friendly Alert with Daftar / Log Masuk / Batal wraps gated actions in `quiz/[level].tsx`; result screen shows a "Skor ini tidak disimpan" nudge for guest finishes | Firebase anonymous accounts are device-bound and wiped on uninstall, so XP/tokens/leaderboard would otherwise be polluted with throwaway data. The banner + modal nudge pushes guest users toward converting to a real account instead of silently losing progress |

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
3. If you touch any file under `src/services/`, re-read "Service layer & Firestore gotchas" — the non-transactional races, leaderboard traps, and Timestamp type lie all bite silently.
4. If you add a new screen to `(auth)` or `(tabs)`, the parent `_layout.tsx` does not need editing — expo-router auto-discovers routes under layout groups. The Stack.Screen entries in `src/app/_layout.tsx` are only needed for explicit options; layout-group names are valid there.
5. Update this file if you add a new directory, new service, new env requirement, or new gotcha. Keep it as the only entry point for the next agent.