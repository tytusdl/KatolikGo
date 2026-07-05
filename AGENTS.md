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
scripts/                     # One-off admin / seed scripts
  admin.mjs                  # Firebase Admin SDK CLI — find-user, delete-user, dump-leaderboard
  lib/admin-firebase.mjs     # Shared admin SDK init (loads serviceAccountKey.json)
  seed-quizzes.ts            # Seeds Firestore quizzes (uses client SDK + anonymous sign-in)
  seedStandalone.js          # Seeds quizzes via REST API (no admin key needed)
  dump-leaderboard.mjs       # Read-only leaderboard dump via client SDK + anon sign-in (no key needed)
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
- AuthGate (`src/app/_layout.tsx`) is the canonical owner of auth-driven navigation. The registered sign-in flow (email/password / Google / Apple) lets AuthGate do the redirect: `handleSubmit` only awaits the auth function and lets the context propagate. The guest flow (`handleGuest` in `AuthScreen.tsx`) is the one targeted exception — AuthGate's `if (user.isAnonymous) return` branch intentionally keeps anon users on /login or /register so they can convert via GuestModeBanner, which means AuthGate does NOT auto-redirect after `signInAnonymously` resolves. `handleGuest` navigates explicitly via `router.replace('/(tabs)/index')` after the await. Do not delete that line as part of a generic "auth screens shouldn't navigate" refactor; guests will end up stranded on /login again.

**Persisted password storage was removed.** Earlier versions stored plaintext passwords in AsyncStorage (`saveCredentials` / `getSavedCredentials` / `autoLogin`). All deleted. Do not reintroduce.

## Username + Remember Me

Two features layered on top of the standard email/password flow:

- **Username login.** Registered accounts (`isGuest === false`) pick a unique username (3-20 chars, lowercase letters/numbers/dot/underscore, must start with a letter) at register. Original case is preserved in `users.username` for display; `users.username_lowercase` is the Firestore query key. `loginUser` in `src/services/authService.ts` accepts either an email or a username — `isEmailLike` is the heuristic — and resolves a username to its email via `findEmailByUsername` before calling `signInWithEmailAndPassword`. Validation: `validateUsername(input)`. Uniqueness: `isUsernameTaken(username)` queries the same `where('username_lowercase', '==', n) where('isGuest', '==', false)` path. Add a Firestore single-field index on `username_lowercase` (the default ascent on a new collection usually covers it; verify under Firestore → Indexes if `findEmailByUsername` ever logs a missing-index error).
- **Remember Me.** Login form checkbox (default `true`) on `AuthScreen`. After a successful email/password sign-in, `setRememberMe(rememberMe)` writes `'true'|'false'` to AsyncStorage under `katolikgo.remember_me`. AuthContext's `onAuthChange` callback reads that flag on cold start; if it's `false`, it signs the restored session out before `setUserData(...)` runs, so AuthGate sees `user === null` and routes to `/login`. Switching Firebase's persistence mode at runtime (`reactNativeLocalPersistence` ⇄ `inMemoryPersistence`) would also work but requires recreating the auth instance — this one-shot sign-out gets the same UX without that cost.

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

### Hardcoded secrets — migrated to `.env` (2026-07-03)

All config values previously hardcoded in source files are now read from environment variables via `process.env.EXPO_PUBLIC_*`. This makes rotation possible without a binary update and keeps secrets out of git history.

**Firebase config** (`src/config/firebase.ts`): `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`, `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`.

**Google OAuth** (`src/services/socialAuthService.ts`): `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (web), `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

**Facebook OAuth**: `EXPO_PUBLIC_FACEBOOK_APP_ID`.

All variables are defined in `.env` (gitignored) with placeholder template in `.env.example` (committed). Expo automatically injects `EXPO_PUBLIC_*` variables at build time — no extra config needed.

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

## Lives system (5 lives, time-based refill + token/ad escape hatches)

The player starts each account with 5 lives and loses one per wrong answer / timeout during a quiz. At 0 lives, new quiz starts are blocked; mid-quiz, the session ends immediately and routes to the result screen with `livesExhausted=true`. Three refill escape hatches surface in `src/app/quiz/lives-empty.tsx`:

1. **Watch rewarded ad** → +1 life. `LIVES_CONFIG.AD_COOLDOWN_MIN` (5 min) between consecutive ad refills. Ad playback lives in `src/services/adsService.ts` — currently a **stub** that resolves `{completed: false, reason: 'stub_mode'}` until a real rewarded-ad SDK (AdMob / Expo Ads) is wired in. The stub is intentionally a labeled no-op so we don't fake a reward and inflate lives for free.
2. **Spend tokens** → +1 life for `LIVES_CONFIG.REFILL_TOKEN_COST` (50 tokens). Throws `GUEST_REFILL_BLOCKED` for guest users — same pattern as `tokenService.spendToken` so the UI surfaces Daftar/Log Masuk instead of "Insufficient tokens".
3. **Time-based refill** → +1 life every `LIVES_CONFIG.REFILL_MINUTES` (20 min), computed from the server-side `livesLastLostAt` anchor. Returning after a day tops the bar fully (not just +1 per tick). The `livesLastLostAt` anchor only clears when lives hit MAX — partial-refill ticks keep the same anchor so a player who keeps running out doesn't get a fresh 20-min window every time.

**Guest users follow the same lives rules** as registered users — they can play, get blocked at 0, see the same refill options — but token-spend is still gated by `GUEST_REFILL_BLOCKED`. Guest lives data is throwaway along with the rest of the guest account.

**Atomicity is non-negotiable.** Every lives-changing write runs inside `runTransaction` (`livesService.consumeLifeOnWrongAnswer`, `refillWithTokens`, `refillWithAd`, `refillIfNeeded`) so concurrent quiz sessions (phone + tablet) can't double-decrement and the time-based refill tick can't over-credit. The same race gotcha that affects `tokenService.awardTokens` (read-then-write) **does NOT** apply here — `livesService` is the correct reference pattern for any new atomic-counter fields on `users/{uid}`.

**Touch points when extending:**
- `src/constants/xp.constants.ts → LIVES_CONFIG` is the single source of truth for max/refillHours/cost/cooldown. Tuning any of those values is one edit.
- `src/services/livesService.ts` is the only place that writes `users.lives`. Screens never call `setDoc(users/{uid}, {lives: ...})` directly — keep the service as the gate so the atomicity contract holds.
- `src/components/LivesIndicator.tsx` renders the heart row + countdown on Home (compact+add button) and Profile (compact+`Tambah` button). Both call `refillIfNeeded` on mount so any pending tick is flushed to Firestore before display.
- `src/app/quiz/[level].tsx` calls `getEffectiveLives` before letting a quiz start (bounces to `/quiz/lives-empty` if 0), and calls `consumeLifeOnWrongAnswer` from both `handleAnswerSelect` (wrong) and `handleTimeUp` (timeout). Setting `livesExhausted=true` ends the session early on the next `handleNext`.
- `src/app/quiz/result.tsx` reads the `livesExhausted` URL param and renders a red "Nyawa Anda Sudah Habis" panel + "Isi Semula Nyawa" CTA. Hides the "Tahap Seterusnya" button in that state — the player can't start the next quiz anyway.

**Legacy user docs** (created before this feature shipped) won't have a `lives` field. `livesService` treats missing `lives` as full health (`LIVES_CONFIG.LEGACY_DEFAULT = 5`) so returning players don't lose progress on the first session after this ships. `authService.buildDefaultUserData` now writes `lives: MAX, livesLastLostAt: null, lastAdRefillAt: null` on every new account, keeping the data shape consistent going forward.

## In-app admin panel (`/admin`)

Solo-developer convenience screen that lets you control your own account from inside the app — add tokens, refill lives, bump XP, set level, toggle premium, refresh from server, etc. Lives at `/admin` (file-based route at `src/app/admin/index.tsx`).

**Promotion:** the developer's own account has `users/{uid}.isAdmin === true`. Flip it via the CLI:
```
node scripts/admin.mjs grant-admin <your-uid>         # enable
node scripts/admin.mjs grant-admin <your-uid> --revoke # disable
```
Use `node scripts/admin.mjs find-user <partial-name-or-uid>` to look up your own uid. The promotion is intentionally CLI-only (Admin SDK) so admin status doesn't need to be hardcoded in source and the wrong person can't accidentally bump themselves to admin by reading the app bundle.

**Surface:** `Profile` tab gets a new "🛠️ Panel Pentadbir" menu item that renders only when `userData.isAdmin === true`. Tapping pushes `/admin`. The screen itself also has a render-time `assertAdmin` gate — non-admins land on a friendly 🚫 screen rather than seeing empty panels.

**Service layer** (`src/admin/adminService.ts`):
- `assertAdmin(caller)` — single guard; `NOT_ADMIN`-coded error if caller isn't admin. Every admin function calls this first.
- `grantTokens / setTokens` — runs in `runTransaction` (atomic balance read-modify-write, mirrors `tokenService.spendToken`). Negative deltas allowed but clamped so balance can't go below 0.
- `grantXp / setXp` — three counters (total / weekly / monthly), all transactional.
- `setCurrentLevel` — clamped to [1, 100]. Doesn't touch XP math; if you want XP-based level to match, also call `setXp`.
- `refillLives / setLives / clearLivesCooldowns` — mirrors `livesService` semantics so the time-based refill tick behaves identically to in-game refills.
- `setPremium / setOwnAdmin / fetchSnapshot` — convenience toggles + on-demand server refresh.

**Security caveat (same as elsewhere):** client-side enforcement only. Firestore rules aren't deployed (AGENTS.md "Firestore rules design checklist"). A motivated attacker with dev tools could flip `isAdmin: true` on their own doc. Treat as a developer convenience, NOT a security boundary. When Cloud Functions land, the gate moves to a callable Function callable only by the developer UID.

**Adding a new admin action:**
1. Add a new exported function to `src/admin/adminService.ts` that calls `assertAdmin(caller)` first and wraps in `runTransaction` for any counter mutation.
2. Drop a button into the relevant section in `src/app/admin/index.tsx`. Hook into the `run()` wrapper for consistent busy/alert/refresh UX.
3. (Optional) Add a "custom amount" path by extending the existing shared modal — set `modal` state with `title` / `label` / `placeholder` / `submitLabel` / `onSubmit`, then call `showCustomModal(cfg)`.

**Why not promote anyone from inside the app?** The CLI gate means promoting a second account requires the developer physically running the CLI on their machine — a non-zero friction that matches the threat model (this is a single-dev build, not multi-tenant SaaS).

## Admin unlock passphrase (in-app backdoor)

Solo-developer alternative to the CLI: two entry surfaces share one modal — one visible (auth screen), one hidden (long-press on the version text at the bottom of Profile).

**Surfaces:**
- **Auth screen** (`src/components/AuthScreen.tsx`) — small "🔐 Admin Access" text-link at the very bottom of the form, below the Guest button. Visible only when no user is signed in (or for guest users on the conversion path). The **only visible entry** for non-admin users.
- **Profile tab** (`src/app/(tabs)/profile.tsx`) — **hidden long-press gesture on the version text "KatolikGo v1.0.0"** at the very bottom of the scroll (below the Sign Out button). No menu item, no text hint — the version text is a `Pressable` that starts a 5-second timer on press-in. Hold for the full 5 seconds; release early and the timer clears. The text shifts to a subtle gold color while held so the developer knows the gesture registered. Only fires when `isAdminUnlockConfigured()` is true AND the user isn't already admin — otherwise the gesture is a silent no-op (so users without `.env` configured don't see a visible-but-broken feature).

Both surfaces → same `src/admin/AdminUnlockModal.tsx` modal asks for the env-configured admin passphrase → on success, sets `users/{uid}.isAdmin = true` → refreshes userData → offers to jump straight to `/admin`.

**Setup (one-time, developer only):**
1. Add a passphrase to `.env` (already has a placeholder line):
   ```
   EXPO_PUBLIC_ADMIN_PASSPHRASE=my-secret-phrase
   ```
   Empty/unset = the entire feature hides itself. The auth-screen text-link is gated on `isAdminUnlockConfigured()`; the version-text hold gesture's `startVersionHold` short-circuits without feedback; and `grantAdminByPassphrase` throws `BAD_PASSPHRASE` rather than revealing whether the env var is set. Three independent layers all hide the same thing.
2. Restart `npx expo start` (with `--clear` if `EXPO_PUBLIC_*` envs were just added — Expo caches them at startup).

**When to use which (CLI vs in-app):**
- **CLI** (`node scripts/admin.mjs grant-admin <uid>`): use when you have your UID handy, e.g. scripting from another shell, or automating for QA accounts.
- **Auth screen passphrase**: use when you've never set up the dev account before, or want to flip admin on before a deep-link login. The **visible** in-app entry — small single text-link at the bottom of `/login` and `/register`.
- **Profile version-text hold (5 s)**: use when already signed in as a non-admin (e.g. testing a regular user flow) and want to flip admin on without a logout roundtrip. The **hidden** entry — no UI hint, just press & hold the version text at the bottom of Profile. Tip: if you forget the gesture, sign out and use the auth-screen text-link instead.

**All three paths write the same `users/{uid}.isAdmin = true` doc field**, so they're interchangeable once granted. The panel reads the same flag regardless of which path set it.

**Security caveats (from `src/config/adminUnlock.ts`):**
- `EXPO_PUBLIC_*` env vars are bundled into the JS. A determined attacker who decodes the bundle can read the passphrase directly. The constant-time compare (`XOR mismatch accumulator`) only slows down remote timing-attack enumeration, not local extraction.
- Proper production fix is a Cloud Function callable only by the dev's account (allowlist in the function body). Until rules deploy, this client-side check is the best-effort placeholder.
- "BAD_PASSPHRASE" is returned both for "wrong passphrase" AND "env not configured" — a probe can't enumerate which state the build is in.
- The version-text hold gesture is **obscurity, not security** — anyone who decodes the bundle can find the trigger. It's there to keep the admin path out of regular users' casual discovery, not to resist a determined attacker. Cloud Functions remain the real fix.

**Touch points:**
- `src/config/adminUnlock.ts` — env read + constant-time compare.
- `src/admin/adminService.ts → grantAdminByPassphrase` — the grant. Atomic transaction so concurrent attempts can't race.
- `src/admin/AdminUnlockModal.tsx` — shared modal (props: `visible`, `onClose`, `user`, optional `onSuccess`).
- `src/components/AuthScreen.tsx` — visible auth-screen trigger (`isAdminUnlockConfigured()` gate).
- `src/app/(tabs)/profile.tsx → VERSION_HOLD_DURATION_MS` + `startVersionHold` / `releaseVersionHold` — hidden 5 s version-text hold gesture. Auto-fires at the 5 s mark — modal opens while the user is still holding, no need to release. Strict-hold via press-out cancellation: `releaseVersionHold` calls `clearTimeout` on the pending timer; if the user releases before 5 s the timer is cancelled and the modal never opens. Defensive `clearTimeout` at the start of every `startVersionHold` prevents leaked timers from finger-drift press-in/press-out cycles. `versionHeld` boolean drives the subtle gold text-color shift while held. Gated on env configured AND `!userData.isAdmin`. Sits at the very bottom of the scroll (below Sign Out), outside any touch-heavy wrapper so the Pressable reliably receives onPressIn/onPressOut.

**Re-locking admin:** the same in-app modal can re-grant after a manual `grant-admin --revoke`. The CLI tool also works. Both write to the same boolean — there isn't a separate "lock out" code path beyond revoking.

**Tuning the gesture:** change `VERSION_HOLD_DURATION_MS` at the top of `profile.tsx` to make the hold shorter / longer.

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

## Admin tooling (`scripts/admin.mjs`)

For one-off operations the app can't do via Firestore rules — `delete-user`, `find-user` by partial name, raw `dump-leaderboard` with admin stats — there's a Firebase Admin SDK CLI at `scripts/admin.mjs`. **Bypasses rules** (uses admin credentials) so destructive ops work.

**Setup (one-time) — pick a path:**

> **PATH A — service account JSON** (if your Org Policy allows it)
> 1. Firebase Console → Project Settings → **Service Accounts** → "Generate new private key".
> 2. Save the downloaded JSON as `serviceAccountKey.json` at the project root. Already in `.gitignore` (along with `*firebase-adminsdk*.json`).
> 3. (Optional) override path via `FIREBASE_ADMIN_KEY_PATH=<path>` or `GOOGLE_APPLICATION_CREDENTIALS=<path>`.

> **PATH B — gcloud ADC** (works under any Org Policy, including ones that block service-account key creation)
> 1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install-windows
> 2. `gcloud init` — login dengan Google account, pilih project `katolikgo-mobile`.
> 3. `gcloud auth application-default login` — OAuth browser login untuk ADC file.
> 4. Run any subcommand. Script auto-detects the ADC file at `%APPDATA%\gcloud\application_default_credentials.json`.

`scripts/lib/admin-firebase.mjs` searches in this order:
1. `FIREBASE_ADMIN_KEY_PATH` env var → service account JSON.
2. `./serviceAccountKey.json` (project root) → service account JSON.
3. `GOOGLE_APPLICATION_CREDENTIALS` env var → any credential JSON (service_account OR gcloud authorized_user).
4. `%APPDATA%\gcloud\application_default_credentials.json` → gcloud ADC file.

If none of those exist, the script throws a friendly error listing all four paths.

**Subcommands:**
| Command | What it does |
|---|---|
| `node scripts/admin.mjs find-user <query>` | Searches `users` by uid / email / displayName / username (case-insensitive substring). Direct uid lookup if the query looks like one (≥20 alnum chars). |
| `node scripts/admin.mjs delete-user <uid> [--yes] [--dry-run]` | Deletes the Firestore doc **and** the Firebase Auth account. Refuses without `--yes`. Use `--dry-run` to preview. |
| `node scripts/admin.mjs dump-leaderboard [--limit N]` | Top N by `totalXP` (default 50). Mirrors `filterAndRank` from `leaderboardService.ts` — registered users ranked, guest rows shown separately for awareness. |
| `node scripts/admin.mjs grant-admin <uid> [--revoke]` | Toggles the `isAdmin` flag on `users/{uid}` — unlocks the in-app `/admin` panel for that account. Default is GRANT (true). Pass `--revoke` to flip back off. |

**Why firebase-admin and not the client SDK?** The Firestore rules in this repo only allow `read / create / update` on `users/{uid}` for the document owner — there's **no `delete` rule**, so even the user themselves can't remove their own doc via the app. The Console uses admin SDK under the hood, which is what we're replicating here.

**Org Policy trap ("Key creation is not allowed on this service account").** Some Google Workspace / Org-managed accounts disable service-account key creation via the `iam.disableServiceAccountKeyCreation` constraint. If the Console's "Generate new private key" button fails with that error, switch to PATH B (gcloud ADC) — it uses your own user OAuth identity, no service-account key involved.

**Order of operations for `delete-user`:** Firestore doc first (so the next session-read doesn't see a half-deleted user), then Firebase Auth. If Auth delete fails, Firestore is already gone — orphan Auth users are inert and can be retried later.

**`find-user` is a top-200 XP scan**, not an indexed query. Fine while the user base is small; switch to composite queries (`where` + `orderBy`) when this scales past a few hundred users.

**Adding a new admin subcommand:** add a new `case` in `scripts/admin.mjs`'s `switch` and a helper alongside `findUser` / `deleteUser` / `dumpLeaderboard`. Reuse `db`, `auth`, `projectId` from `lib/admin-firebase.mjs` — they handle init / credential loading for you.

`dump-leaderboard.mjs` (the original, no admin access) still exists for quick read-only checks that don't require admin auth — uses client SDK + anonymous sign-in. Keep both.

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
| 2026-07-03 | Added admin tooling (`scripts/admin.mjs` + `lib/admin-firebase.mjs`) — Firebase Admin SDK CLI with `find-user`, `delete-user`, `dump-leaderboard` subcommands; service account key gitignored (`serviceAccountKey.json`, `*firebase-adminsdk*.json`); documented in AGENTS.md | Firestore rules don't allow `delete` on `users/{uid}`, so the app can't remove accounts — needed admin SDK path for ops like cleaning up test accounts. `dump-leaderboard.mjs` (client SDK + anon sign-in) kept as the no-key-needed read-only alternative |
| 2026-07-03 | `lib/admin-firebase.mjs` now supports both service-account JSON AND gcloud Application Default Credentials (auto-detected). Four-path search: `FIREBASE_ADMIN_KEY_PATH` → `./serviceAccountKey.json` → `GOOGLE_APPLICATION_CREDENTIALS` → `%APPDATA%\gcloud\application_default_credentials.json`. Friendly "tiada credentials" error when none of the four exist | Org Policy `iam.disableServiceAccountKeyCreation` blocks service-account key generation on Workspace-managed accounts. ADC via gcloud bypasses it — uses the user's own OAuth identity instead of a downloaded key. Org Policy trap documented in AGENTS.md "Admin tooling" section |
| 2026-07-03 | Added Lives system (`livesService.ts`, `LivesIndicator.tsx`, `quiz/lives-empty.tsx`, `adsService.ts` stub) — 5 lives per account, -1 per wrong answer / timeout, time-based refill (1 life / 2h), token-spend refill (50 tokens), rewarded-ad refill (5-min cooldown). Pre-quiz gate + mid-quiz early-end at lives=0. All writes transactional. Lives docs AGENTS.md section | Adds enough friction to discourage brute-force guessing without permanently locking players out. Atomic writes are required because the same phone+tablet race that bit `tokenService.awardTokens` would silently double-decrement lives without a transaction. Stub `adsService` returns `stub_mode` until a real ad SDK is wired in — no fake rewards |
| 2026-07-03 | Added in-app Admin panel (`src/admin/adminService.ts`, `src/app/admin/index.tsx`) + `users.{isAdmin}` flag + `node scripts/admin.mjs grant-admin <uid>` CLI subcommand — developer-only controls for token / XP / level / lives / premium / refresh; all mutations guarded by `assertAdmin(caller)` and wrapped in `runTransaction`. Profile tab gets a "Panel Pentadbir" entry point that only renders when `isAdmin === true`. Documented in AGENTS.md "In-app admin panel" section | Solo-dev convenience — control the running app from inside without touching Firebase Console. CLI gate on promotion keeps admin status out of the bundle and prevents accidental self-promotion. Client-side enforcement only — proper server-side gating belongs in Cloud Functions once those land |
| 2026-07-03 | Added admin unlock passphrase backdoor — `EXPO_PUBLIC_ADMIN_PASSPHRASE` env var + `src/config/adminUnlock.ts` (constant-time compare) + `grantAdminByPassphrase` service + "🔐 Admin Access" link + modal in `AuthScreen`. Empty env = feature hides entirely. Both CLI and in-app path flip the same `users/{uid}.isAdmin` boolean | Lets the dev self-promote without opening a terminal — same flip as `grant-admin`, just from inside the app. Client-side only — passphrase is bundled into the JS so it's discoverable by anyone who decodes the bundle. Proper fix is Cloud Functions + server-side check; this is a best-effort placeholder until then |
| 2026-07-04 | Hid Profile-tab "🔐 Aktifkan Mod Pentadbir" menu item in favour of a hidden 5 s long-press gesture on the avatar — `ADMIN_HOLD_DURATION_MS` constant + `Animated.Value` driven progress bar that fades in below the avatar mid-hold + Pressable on the avatar itself. Gated on `isAdminUnlockConfigured()` AND `!userData.isAdmin`; otherwise the gesture is a silent no-op so users without `.env` configured don't see a visible-but-broken feature | Visible menu items leak the admin path to regular users. Long-press is obscurity not security (anyone who decodes the bundle can find the trigger), but it keeps casual discovery out and the Auth-screen text-link remains as the visible fallback. AGENTS.md "Admin unlock passphrase" section updated to call out the new hidden trigger |
| 2026-07-04 | Relocated hidden admin-unlock gesture from the avatar to the version text "KatolikGo v1.0.0" at the very bottom of Profile (after Sign Out) — Pressable inside ScrollView on avatar was unreliable due to ScrollView touch-capture on even slight finger drift. Version-text Pressable sits in a "quiet zone" outside any gesture-eating wrapper so onPressIn/onPressOut fires reliably. `VERSION_HOLD_DURATION_MS = 5000`, visual feedback reduced to a subtle gold text-color shift on hold. AGENTS.md "Admin unlock passphrase" section + changelog updated to reflect new location | Avatar Pressable failed repeatedly (ScrollView capture), tested 5-tap & 3-tap variants as fallbacks and they worked on version text only. Moved back to long-press per user request, kept version text location — same Pressable but with hold semantics, no progress bar needed at that location because context is already obvious. |
| 2026-07-04 | Replaced token `🪙` emoji with custom PNG icon — `assets/token.png` (2048×2048, RGBA, transparent bg). Gold medal with embossed dark blue Latin cross, matching `#c9a227` accent + `#1a3a5c` primary palette. Used as `<Image>` in Home header token badge (`src/app/(tabs)/index.tsx`) and Result screen reward pill (`src/app/quiz/result.tsx`); `coin: '🪙'` removed from local ICONS constant. **Gotcha:** `matrix_generate_image` returns JPEG bytes with `.png` filename — JPEG doesn't support alpha. To get true PNG transparency, post-process via `jimp` (npm install jimp --no-save) and zero out RGB ≥ threshold (235) for the alpha channel, then re-save as PNG | Generic coin emoji clashed with Catholic brand. Custom gold medal with cross is on-theme and reads well at small (20px header) and large (24px reward) sizes. Transparent bg is mandatory — the badge sits on `#c9a227` gold pill in Home and `#FFF8EC` cream in Result; a white square around the medal would look like a halo of white pixels. |
| 2026-07-04 | Same transparency fix applied to `assets/logo.png` — was RGB (no alpha), now RGBA via BFS flood-fill from 4 corners with tolerance 12 (RGB ≥ 243 = near-white background → transparent). 56.8% of pixels transparent (corners + edges outside circular emblem + below tagline), 43.2% opaque (logo content). White elements *inside* the logo (cross highlight, "KatolikGo" wordmark) kept opaque because they're surrounded by non-white pixels — flood-fill can't reach them from corners. Used by `expo-splash-screen` plugin (background `#0e2a4d`) and JS splash fallback in `src/app/_layout.tsx`. Verified via alpha histogram: all 4 corners = 0, center = 255, 0% partial-alpha pixels (clean cut) | Logo was sitting on dark blue splash with a visible white rectangle around the circular emblem. Same family of bug as token — assets from external sources often ship as RGB-only PNG/JPEG. Future image assets added to `assets/` should be checked with the same magic-byte + color-type verifier before use; if RGB only, run jimp flood-fill (corners-only variant for content-with-white-bg, or full-pixel-threshold variant for solid-bg-only). Pattern is in the verify-logo.js output, not committed — re-derive from this changelog row if needed. |
| 2026-07-04 | Wired up the Home hero "TAHAP ANDA" progress card to actual `userData.totalXP` — the card was rendering hardcoded `450 / 1000 XP` text + 45% bar fill, completely disconnected from the XP math in `levelService` / `xp.constants`. Now derives `current` / `required` / `percentage` via `getXpProgress(userData.totalXP)` and binds them to the progress bar fill (clamped to [0,100]) and the XP text. TypeScript template-literal type `as \`${number}%\`` keeps `width` strict-mode happy | User reported "XP stuck at 450" — but the underlying `users/{uid}.totalXP` field was actually updating fine; only the *display* was frozen because nobody had hooked the hero card up to `getXpProgress`. `levelService.submitLevelCompletion` has always been writing correct totals. Lesson: any card displaying live counters must derive from `userData.*` via the canonical helpers — never ship a hardcoded placeholder past the prototype stage. `grep -nE "['\`]\\d+\\s*(XP\|coin\|nyawa\|token\|lives)" src/app/**/*.tsx` is a quick audit pass for any other placeholders left in. |
| 2026-07-05 | UI mockup exploration — created `mockups/` directory with HTML prototypes. **Convention:** working file is `home-leaderboard-quiz.html` (overwritten each iteration). **Versioned snapshots** follow the `mockup-v{n}.html` pattern (current: `mockup-v1.html`, snapshot of "v10 final" — the user-approved direction: 1-view Home, dual-state Quiz Play with minimal lives mini in header, Profile tab, Leaderboard with 3-tier podium). Snapshot files are NOT overwritten on subsequent iterations — they're immutable history for comparison when iterating. Reference style: pastel blue hero, soft 3D subject cards, puffy white quiz tiles, orange podium leaderboard, floating pill tab bar. Tokens from `theme.ts` (navy `#1a3a5c` + gold `#c9a227`) on primary surfaces | Solo-dev UI iteration loop. Static HTML mockups iterate faster than Expo rebuilds for visual exploration. The snapshot convention lets the user compare new mockup iterations against the approved direction without losing history. Future agents: if user asks "compare with previous mockup" or "kasi lama punya" — they mean the latest `mockup-v{n}.html`, not the working file. Bump version when user explicitly approves a direction as "v{n+1}". |
| 2026-07-05 | Mockup v2 direction shipped ("Brain Rush" style) — `mockup-v2.html` frozen snapshot. **Style:** saturated bright blue `#1c5fe0` background, big yellow CTA `#ffcc1f`, cute SVG cartoon avatars (round faces with hair + cheeks), confetti win screen with gold trophy + cross, 3-tier gold/silver/bronze podium, horizontal scrolling category chips, pink/lavender subject cards, top-3 podium + rank list with up/down trend pills, Top Up gold card with cross medal. **Catholic DNA preserved:** gold `#c9a227` halo + cross on mascot, gold medal token icon on Profile, Latin cross on trophy + token, Malay categories (Alkitab/Sakramen/Liturgi/Katekismus/Santo), real Catholic content (Musa + 10 Perintah, Penciptaan). Type: Fredoka (display) + Nunito (body). AGENTS.md "Mockups" table extended with v2 row + design direction history block | User explicitly asked for "cute dan menarik" Brain-Rush-style direction. Snapshot v2 added so iteration can keep going without losing v1 history. Future agents: when iterating v2, overwrite `mockups/home-leaderboard-quiz.html` only — keep v1 + v2 snapshots frozen. |
| 2026-07-05 | Mockup v3 direction shipped ("Orange Pill Nav") — `mockup-v3.html` frozen snapshot. **Style:** cream `#fff6e5` background, saturated orange `#ff6b35` primary, black floating pill tab bar (4 icons; active widens with label), cute Bible-book SVG mascot with gold cross on cover + green sunglasses + arm/leg + sneakers, slide-to-start onboarding, 3-tier orange podium (taller 1st center), 2x2 stat grid on Profile, circular progress ring (37/50). **Catholic DNA:** gold cross on book cover, gold token icon, Malay strings (Pilih Topik / Main / Seterusnya / Papan Pendahulu). Nunito type. AGENTS.md "Mockups" table extended with v3 row | User asked "nanti ada sudah mock v3, jangan lupa kasi masuk" — wanted v3 added to the master comparison immediately after creating it. |
| 2026-07-06 | **Critical-fix pass** — 6 fixes from user audit. (1) Removed `firebase-admin` from `package.json` devDependencies. (2) `app/_layout.tsx` — wrapped `seedQuizzesIfEmpty()` in try/catch + `.catch()` so a Firestore/network blip during first-launch seed can't red-screen the app; **splash 8s safety-net** added (`authTimedOut` state flipped by a single mounted `setTimeout`) — if Firebase Auth/AsyncStorage hangs the user is dropped into /login instead of being trapped on the splash forever; routing logic and splash render both honour the bypass so a late Firebase resolution still redirects properly via the `justGotUser`/`firstRun` guards. (3) `config/firebase.ts` — fail-fast env validation; required vars read as direct `process.env.X` (literal key — Expo's `no-dynamic-env-var` rule requires static access for bundle-time env extraction); throws consolidated error listing every missing key; `console.warn` added to auth-init fallback. (4) `authService.registerUser` — post-`createUser` race re-check of `isUsernameTaken` (deletes the auth account if taken); `ensureUserDocument` wrapped in try/catch (deletes the orphan auth account on Firestore write failure). (5) `tabs/index.tsx` — all 4 category `TouchableOpacity` now have `onPress={() => router.push('/quiz/1')}`; category grid `width: '48%'` → `flex: 1` + `minWidth: '45%'` so two columns survive on iPhone-SE. (6) **Timestamp policy committed** — every writer (`authService`, `tokenService`, `livesService`, `levelService`, `adminService`, `quizService`, `seedService`) now stamps `createdAt` / `updatedAt` / `livesLastLostAt` / `lastAdRefillAt` with `Date.now()` (number ms epoch); `serverTimestamp()` removed from every import; type docstrings in `types/index.ts` rewritten to document the policy. `livesService.ts`'s `tsToMillis` helper still defensively accepts legacy Firestore `Timestamp` so old reads don't break. **Trade-off:** client clock can be skewed — until Firestore rules / Cloud Functions land, the worst case is a tampered clock spoofing the time-based lives refill, which is already best-effort. **Touched files:** `package.json`, `src/app/_layout.tsx`, `src/config/firebase.ts`, `src/services/authService.ts`, `src/services/tokenService.ts`, `src/services/livesService.ts`, `src/services/levelService.ts`, `src/services/quizService.ts`, `src/services/seedService.ts`, `src/admin/adminService.ts`, `src/types/index.ts`, `src/app/(tabs)/index.tsx`. **Lint + typecheck both clean.** | User shipped a 6-item kritikal bug list; "FIX SEKARANG" tone meant do all of them, no back-and-forth. |
| 2026-07-06 | **Data/UX polish pass** — 7 fixes from second user audit. (1) `AuthContext.tsx` — **single Firestore subscription** per auth session: the previous split of `getUserData(uid)` one-shot fetch + a separate `useEffect`-driven `onSnapshot` for lives notifications is now one `onSnapshot(userDocRef, cb)`. Each emission updates `userData` in context AND drives the lives-notify transition detector (`prevLivesRef` reset on every auth identity change so sign-out → sign-in-as-other doesn't leak the prior account's lives state). Saves one Firestore active listener per session. Doc-missing fallback (cold-start race, deleted doc) recreates via `ensureUserDocument` then continues subscribing. (2) `AuthContext.tsx` — `refreshUserData` deduplicated: it's now a no-op wrapper since onSnapshot is the source-of-truth (call-sites in `admin/index.tsx` + `profile.tsx` keep working unchanged). (3) `AuthContext.tsx` — `.catch(console.warn)` pinned on `void markOnboardedAction()` and `void requestNotificationPermission()` so a failed AsyncStorage write or permission-prompt rejection doesn't surface as an unhandled rejection. (4) `authService.friendlyAuthError` — added cases for `auth/operation-not-allowed` (sign-in method disabled in Firebase Console) and `USERNAME_TAKEN` (custom code from `UsernameTakenError` — message propagated as-is). (5) `tabs/index.tsx` — **daily quote rotator:** 12-verse config array + DST-safe `dayOfYearIndex()` helper that picks `DAILY_VERSES[dayOfYearIndex() % length]`; previously a single hardcoded Mark 16:15. (6) `tabs/index.tsx` — **category config array:** `QUIZ_CATEGORIES` config (`emoji`/`title`/`desc`/`backgroundColor`/`route`) replaces 4 inline `TouchableOpacity` blocks; rendering becomes `QUIZ_CATEGORIES.map(...)`. Adding a category is one array entry. (7) `types/index.ts` — `levelProgress: Record<number, LevelProgress>` → `Record<string, LevelProgress>` because Firestore coerces every numeric key to a string on round-trip (the type was lying). Docstring documents the choice. All read sites (`levelService.submitLevelCompletion`, `levelService.getUserLevelProgress`, `quiz.tsx` — both) and write sites (`levelService`, `tokenService.unlockLevelWithToken`) coerced to `String(level)` on access and computed-key assignment. Plus two cosmetic fixes: `Katekisus` → `Katekismus` (typo fix), `hard: 'Keras'` → `hard: 'Sukar'` (translation fix). **Lint + typecheck both clean.** | User shipped second batch; "FIX SEGERA" tone repeated. The single-subscription refactor on AuthContext was the riskiest item — kept all existing semantics (remember-me gate, lives-transition detect registered-only, guest silently skipped for notif) and just collapsed two listeners into one. |
| 2026-07-06 | **Polish pass** — 7 fixes from third user audit. (1) **Routes centralized** — new `src/constants/routes.ts` exports `Routes` (literal layout-group prefix for `router.push/replace`) and `Pathnames` (parens-stripped variant for `usePathname()` comparisons); docstring spells out the convention so a future agent doesn't mix them. All 11+ call sites updated: `_layout.tsx`, `AuthScreen.tsx`, `onboarding.tsx`, `GuestModeBanner.tsx`, `useGuestGuard.ts`, `LivesIndicator.tsx`, `quiz/lives-empty.tsx`, `quiz/result.tsx`, `quiz/[level].tsx`, `admin/index.tsx`, `profile.tsx`, `AdminUnlockModal.tsx`, `+not-found.tsx`, `(tabs)/quiz.tsx`, `(tabs)/index.tsx` (incl. the `QUIZ_CATEGORIES` config array). (2) **Magic navy color moved to theme** — `Colors.navyDark = '#0e2a4d'` added to `src/constants/theme.ts` with a docstring explaining why it's distinct from `Colors.primaryDark` (one tints buttons on light surfaces, the other is the dark-blue base of full-screen dark surfaces like splash + auth). All 7 occurrences across `_layout.tsx` + `AuthScreen.tsx` replaced. (3) `AuthContext.tsx` split into 5 phase helpers — `tearDownSubscription`, `applyNoUser`, `applyRememberMeFailure`, `markOnboardingComplete`, `subscribeToUserDoc`. The big `useEffect` now reads as a 5-step pipeline (clear prior → set user → null-branch OR remember-gate OR subscribe). Each helper stays short enough to grok in isolation. (4) **Lives notification extracted to custom hook** — new `src/hooks/useLivesNotification.ts` exports `{ reset, checkTransition }`; `AuthContext` delegates the prev-tracker state machine to it. The hook seeds the prev-tracker for guest accounts too (suppressing the notif) so a future `linkWithCredential` upgrade starts from a known baseline. (5) `tabs/index.tsx` token badge — `<TouchableOpacity>` without `onPress` is a dead button for screen readers; switched to `<View>` with `accessibilityRole="text"` + label `"Baki token: <count>"` so VoiceOver / TalkBack announce as a display counter, not a tap target. (6) `tabs/index.tsx` accessibility — every meaningful tappable / readable element now has `accessibilityLabel` + `accessibilityRole`: avatar (`image`, "Avatar Saudara" / displayName), greeting (`text`), daily-quote card (`text`, includes ref + verse), every category card (`button`, "Topik Perjanjian Lama, 12 Tahap" + accessibilityHint describing action). (7) `tabs/index.tsx` magic-number spacer — `<View style={{ height: 100 }} />` replaced with a computed `bottomSpacerHeight` that mirrors `(tabs)/_layout.tsx`'s tab-bar math (88/72 + safe-area-bottom + 4%-of-screen-height minimum), so the last scroll item clears the tab bar on iPhone-SE / Dynamic Island / Android three-button without leaving huge gaps on tall phones. **Lint + typecheck both clean.** | Third batch focused on "Polish / Best Practice". Centralizing routes + splitting AuthContext phase helpers + extracting lives-notify hook were the riskier items — kept existing semantics invariant. |
| 2026-07-06 | **Hot-path audit pass** — 5 fixes from fourth user audit on the XP / Lives / Quiz pipeline. **(Q-2)** `quiz/[level].tsx → consumeLifeAfterWrongAnswer` added an **optimistic `livesExhausted` flip**: reads `userData.lives` from auth context BEFORE the Firestore write — if it's already `≤ 1`, flips the flag immediately so a Firestore blip can no longer trap the player in a quiz they've already lost. Docstring explains the failure mode the guard prevents. **(Q-5)** Same file, `levelNum` URL param — added `Number.isFinite()` guard + clamp to `[1, TOTAL_LEVELS]` so a hand-crafted `/quiz/0` / `/quiz/99999` / `/quiz/foo` doesn't pass `NaN` to Firestore (would have created an orphan `level_NaN` doc, matching the seedService NaN bug fixed earlier). **(Q-7)** Same file, `proceedToNext` now passes the live `livesExhausted` state to `finishQuiz` as the `livesFlippedToZero` flag — previously defaulted to `false` regardless of state, which silently dropped the "Nyawa Anda Sudah Habis" panel from the result screen if the player free-passed past the last question after lives hit 0. **(L-1)** `services/levelService.ts → submitLevelCompletion` wrapped in `runTransaction` for `score ≥ TX_THRESHOLD_SCORE (50)` — fixes the documented read-then-write race AGENTS.md §"Firestore-rules design checklist" called out as "phone + tablet for the same account". Inside the transaction the fresh snapshot is re-read and deltas are rebuilt relative to it (not the `userData` the caller passed in), so two concurrent completions can't clobber each other's XP delta. Below the threshold the previous optimistic-merge path is preserved (player is just practising, race loss is barely visible). Docstring explains why 50 is the cutoff. **(N-1)** `services/notificationService.ts → requestNotificationPermission` permission-resolution now consults FOUR sources of truth via new `isGranted(s)` helper: top-level `.granted`, top-level `.status === 'granted'`, and the platform-specific `ios.status` / `android.status`. The previous code only checked `.granted` — a SDK rename (e.g. → `authorized`) or a runtime type-strip would have silently disabled all notifications. Docstring warns about the silent-break failure mode. **Lint + typecheck both clean.** | User-flagged hot-path concerns on XP / Lives / Quiz. `L-1` was the largest change — re-architected writes into a transactional path with a score-threshold gate. Kept the optimistic merge as the below-threshold fallback. |



| 2026-07-05 | Wired v3 into `mymock.html` as a third interactive 4-tab phone (not iframe) — after first attempt with iframe-collage failed (UTF-8 BOM / Latin-1 corruption from `Set-Content -Encoding UTF8`, scroll-into-view anchors wouldn't fire reliably, scaled iframes looked tiny and broken), user explicitly asked "v3 kasi jadi lah macam v1 dan v2". Now v3 inline as `.phone-half.v3` next to v1 + v2, with full Home/Kuiz/Profil/Papan screens matching mockup-v3.html's "Orange Pill Nav" direction: orange CTA card with slide-to-start pill, topic grid (Alkitab/Katekismus/Sakramen/Santo), Bible-book SVG avatar, black pill nav that widens + shows label when active, gold-trophy result modal. Level cards on Home open same Result modal flow as v1/v2. **Lesson learned:** **never** modify UTF-8 HTML files via PowerShell `Set-Content -Encoding UTF8` — it adds BOM + sometimes mangles multi-byte sequences into Latin-1 garbage (`—` → `aE"`, `📚` → `dY"-`). Always use the Edit tool or a Python script (`encoding='utf-8'`). Also: iframes with `scrollIntoView` from parent postMessage are flaky across browsers — interactive inline is more reliable for comparison mocks | Avoid relying on PowerShell byte-level file ops when other tools (Edit, Write, Python) preserve encoding cleanly. |

---

## Mockups (UI prototypes)

| File | Status | Purpose |
|---|---|---|
| `mockups/home-leaderboard-quiz.html` | **Working file** — overwritten each iteration | Current development scratchpad. Open this for the latest in-progress mockup. |
| `mockups/mockup-v1.html` | **Frozen snapshot** (v1, user-approved) | First approved direction — pastel blue hero + soft 3D subject cards + puffy white quiz tiles + orange podium. Do NOT overwrite. |
| `mockups/mockup-v2.html` | **Frozen snapshot** (v2, "Brain Rush" style) | Second approved direction — saturated `#1c5fe0` blue + huge `#ffcc1f` yellow CTA + cute SVG saint/avatar cartoons + confetti win + 3-tier podium. Gold accent + Catholic DNA preserved via `#c9a227` halo/cross/medal. See snapshot for full design. Do NOT overwrite. Bump to `mockup-v3.html` if a third major direction lands. |
| `mockups/mockup-v3.html` | **Frozen snapshot** (v3, "Orange Pill Nav" direction) | Third approved direction — cream bg + saturated orange `#ff6b35` primary + black floating pill nav (4 icons, active widens with label) + Bible-book SVG mascot with cross + green sunglasses + shoes + slide-to-start onboarding + 3-tier orange podium. Direct lift from "Brain Rush / pick-a-topic" reference design. Malay UI throughout (Pilih Topik / Seterusnya / Papan Pendahulu). Catholic DNA via gold cross on mascot + gold token icon. Do NOT overwrite. |
| `mockups/v1-tabs.html` | **Interactive single- HTML prototype** (v1 direction, tabs) | Same v1 pastel direction as `mockup-v1.html`, but as ONE phone with functional tab switching + a quiz play modal that flows into a Result modal. Useful for live demo of the v1 user-flow (Home → Kuiz → Quiz play → Result → Home). NOT a snapshot — iteration-friendly. CSS-only animation, minimal JS for tab + timer + modal state. |
| `mockups/mymock.html` | **User's master trio-comparison HTML** (v1 + v2 + v3 side-by-side, all 3 interactive) | Three phones in a row, each with its own 4-tab navigation + Result modal. v1 = pastel blue (icon-only tabs, lavender cards), v2 = Brain Rush saturated blue (icon+label tabs, big yellow CTA), v3 = Orange Pill Nav cream bg (black floating pill nav that widens + shows label when active, orange gradient CTA, Bible-book mascot SVG). Click any level/topic card on any phone → opens that phone's "Menang" result modal. Tab JS is generic — any `.phone-half` with `.tab-item[data-version=…]` + matching `.tab-screen[data-version=…]` works without further wiring. **Adding a new version:** define CSS tokens + tab-item rules + screens in `.phone-screen.v{n}` style block, then drop a `.phone-half.v{n}` block in `mymock.html` with `data-version="v{n}"` tab-items + screens + tab-bar (no per-version JS needed). **Don't** rebuild v3 as an iframe collage — proved to be flaky (UTF-8 corruption from PowerShell Set-Content, scrollIntoView race conditions across browsers, scaled iframes look broken). **Always** keep `mockups/mockup-v{n}.html` as the spec-of-truth for each design direction; `mymock.html` is the interactive comparison view that derives from it. Original filename was `v1-vs-v2.html` (renamed). |

**Design directions — history:**

- **v1** (mockup-v1.html) — pastel blue hero + soft 3D subject cards + puffy white quiz tiles + orange podium leaderboard + floating pill tab bar. Pastel + airy.
- **v2** (mockup-v2.html) — "Brain Rush" inspired: saturated bright blue (`#1c5fe0`) background, big yellow CTA button (`#ffcc1f`), cute SVG cartoon avatars (round faces with hair styles + cheeks), confetti win screen with gold trophy + cross, 3-tier gold/silver/bronze podium, horizontal scrolling category chips, pink/lavender subject cards. **Catholic DNA preserved**: gold halo + cross on mascot, gold medal token icon, Malay categories (Alkitab/Sakramen/Liturgi/Katekismus/Santo), Latin cross on trophy + token, real Catholic content (Musa + 10 Perintah, Penciptaan). Fredoka (display) + Nunito (body) type.
- **v3** (mockup-v3.html) — "Orange Pill Nav" direction: cream `#fff6e5` background, saturated orange `#ff6b35` as primary, black floating pill tab bar (4 icons; active widens with label), cute Bible-book SVG mascot with gold cross on cover + green sunglasses + arm/leg + sneakers, slide-to-start onboarding pill, 3-tier orange podium (taller 1st center), 2x2 stat grid on Profile, circular progress ring (37/50). Catholic DNA: gold cross on book cover, gold token icon, Malay strings (Pilih Topik / Main / Seterusnya / Papan Pendahulu). Nunito type.
- **Home** — 1-view, pastel-blue hero + greeting, 2 subject cards (Alkitab/Katekismus) overlapping hero bottom, unified resource card (XP/Level bar + 5 hearts with auto-refill countdown + Token/Streak), 2 recent quiz items.
- **Quiz Play** — dual state side-by-side (correct vs wrong). Header: chevron-back + "Soalan X/Y" + small `❤ 5` lives mini. Body: category line, question card, orange→red timer bar (15s), 4 letter-prefixed answer buttons (correct=green ✓, wrong=red ✗, faded=5050 used, plain=other). Bottom sheet: explanation → 2 slim powerup pills (5050 purple, Hint gold) → Seterusnya button. **No tab nav** in Quiz Play.
- **Profile** — pastel blue hero with avatar ring + name + handle + level chip, 2x2 stats grid (Streak/Tahap Selesai/Rakan/Ketepatan), monthly progress card, menu items (Pencapaian/Parish/Premium gradient gold), settings sub-menu, Log Keluar, version text (hidden admin unlock trigger).
- **Leaderboard** — 3-tier podium (orange 1st center tallest, blue 2nd/3rd sides) with avatar + name + points, rank list below with trend pills (▲ green / ▼ red).

**Powerups in Quiz Play:** 5050 (`FIFTY_FIFTY_COST = 2`) + Hint (`HINT_COST = 1`). Skip + Free Pass dibuang dari UI (though `skipUsed` state + `handleFreePass` still exist in code, unused).

**Token cost label:** Removed from powerup cards in UI — enforced at code level only. User doesn't see numbers on the powerup itself.

---

## Out of scope (don't accidentally fix)

- The placeholders `streakDays`, `levelsCompleted`, `friendsCount`, `accuracy`, `quizzesThisMonth` are zeroed. Wiring real values is a feature, not a bug fix.
- Facebook login is **intentionally disabled**. `FACEBOOK_APP_ID` is read from `EXPO_PUBLIC_FACEBOOK_APP_ID` env var; if empty, the Facebook button is disabled at runtime. Do not "fix" the placeholder strings.
- Firestore security rules are not in this repo. Assume they need review but do not change app code based on guesses about them.
- `seed-quizzes.ts` script under `scripts/` writes directly to Firestore using the client SDK + anonymous sign-in — runs outside the app. Do not auto-run during normal dev.

---

## When you make changes

1. Run `npx tsc --noEmit` and `npx expo lint` before claiming done.
2. If you touch `src/config/firebase.ts` or `src/contexts/AuthContext.tsx`, re-read the "Critical: Auth flow" section above.
3. If you touch any file under `src/services/`, re-read "Service layer & Firestore gotchas" — the non-transactional races, leaderboard traps, and Timestamp type lie all bite silently.
4. If you add a new screen to `(auth)` or `(tabs)`, the parent `_layout.tsx` does not need editing — expo-router auto-discovers routes under layout groups. The Stack.Screen entries in `src/app/_layout.tsx` are only needed for explicit options; layout-group names are valid there.
5. Update this file if you add a new directory, new service, new env requirement, or new gotcha. Keep it as the only entry point for the next agent.