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