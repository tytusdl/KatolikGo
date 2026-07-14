# KatolikGo — Project Structure

> Auto-generated full directory tree. Last updated: 2026-07-14.

---

## Root

```
KatolikGo/
├── .env                          # Firebase + OAuth secrets (gitignored)
├── .env.example                  # Template for .env
├── .gitignore
├── .npmrc                        # User-level npm config (postinstall restrictions)
├── AGENT_SYSTEM_PROMPT.md        # AI agent system prompt (standalone copy)
├── AGENTS.md                     # Master doc for AI coding agents (~2000+ lines)
├── App.js                        # iOS legacy entry shim → expo-router/entry
├── PROJECT_STRUCTURE.md          # ← This file
├── README.md                     # Project readme
├── app.json                      # Expo config (splash, plugins, orientation)
├── demo-landing.html             # Landing page demo
├── eslint.config.js              # ESLint config (expo preset)
├── expo-err.log                  # Expo error log
├── expo-out.log                  # Expo output log
├── firestore.rules               # Firestore rules (design-only, not deployed)
├── global.css                    # CSS variables (fonts)
├── index.js                      # Main entry → import 'expo-router/entry'
├── metro.log                     # Metro bundler log
├── package.json                  # Dependencies + scripts
├── package-lock.json
├── tsconfig.json                 # TypeScript strict mode, @/* alias → ./src/*
```

---

## `assets/`

```
assets/
├── images/                       # (empty — reserved for future images)
├── logo.png                      # App logo (RGBA, transparent bg, used by splash)
└── token.png                     # Custom gold medal token icon (PNG, transparent)
```

---

## `src/` — Application Source

```
src/
├── global.css                    # CSS variables (@font-face for Plus Jakarta Sans, Inter)
│
├── app/                          # expo-router file-based routes
│   ├── _layout.tsx               # Root: SafeAreaProvider + AuthProvider + <Slot/> + AuthOverlay splash
│   ├── onboarding.tsx            # 4-slide intro flow
│   ├── +not-found.tsx            # Auto-replace back to / after 800ms
│   │
│   ├── (auth)/                   # Auth layout group
│   │   ├── _layout.tsx           # Auth group Stack (headerShown: false)
│   │   ├── login.tsx             # Login screen (uses AuthScreen component)
│   │   └── register.tsx          # Register screen (uses AuthScreen component)
│   │
│   ├── (tabs)/                   # Main tab layout group
│   │   ├── _layout.tsx           # Bottom tabs: Utama, Peta, Papan, Profil (floating pill)
│   │   ├── index.tsx             # HOME — hero greeting, stats, categories, daily verse, leaderboard teaser
│   │   ├── peta.tsx              # PETA — Duolingo-style path/roadmap level picker
│   │   ├── leaderboard.tsx       # LEADERBOARD — podium + ranked list (Divine Elegance glass)
│   │   └── profile.tsx           # PROFILE — avatar, stats grid, menu, admin unlock gesture
│   │
│   ├── quiz/                     # Quiz play stack
│   │   ├── _layout.tsx           # Quiz Stack layout
│   │   ├── [level].tsx           # Quiz play screen (dynamic [level] route)
│   │   ├── result.tsx            # Quiz result screen (score, XP, tokens, next level)
│   │   └── lives-empty.tsx       # Lives-exhausted refill modal (token/ad/time)
│   │
│   └── admin/
│       └── index.tsx             # In-app admin panel (token/XP/lives/level/premium controls)
│
├── components/                   # Shared reusable UI components
│   ├── AuthScreen.tsx            # Shared dark-themed login/register form (glass, gold, social auth)
│   ├── Button.tsx                # Reusable button (primary/secondary/outline, loading, disabled)
│   ├── Card.tsx                  # Reusable card (title/subtitle/children)
│   ├── GuestModeBanner.tsx       # Guest mode nudge banner (full + compact variants)
│   ├── LivesIndicator.tsx        # Lives display (pill/card/inline/banner variants, countdown)
│   ├── ScreenContainer.tsx       # SafeArea-aware screen wrapper (optional ScrollView)
│   └── peta/                     # Peta (path/roadmap) screen components
│       ├── CategoryChips.tsx     # Horizontal scrollable category filter chips
│       ├── LevelNode.tsx         # Circular level node (completed/current/locked states)
│       └── LevelPath.tsx         # Vertical zigzag path with 20 nodes per category
│
├── admin/                        # Admin-specific logic
│   ├── adminService.ts           # Admin-only Firestore operations (all transactional)
│   └── AdminUnlockModal.tsx      # Passphrase modal for admin self-promotion
│
├── config/                       # Configuration
│   ├── firebase.ts               # Firebase init (platform-gated persistence, env validation)
│   └── adminUnlock.ts            # Env-based admin passphrase verification (constant-time compare)
│
├── constants/                    # App-wide constants
│   ├── theme.ts                  # Colors (40+ tokens), Spacing, FontSize, BorderRadius, FontFamily
│   ├── routes.ts                 # Centralised Routes (router.push) + Pathnames (usePathname)
│   └── xp.constants.ts           # XP/token/lives economy math, level curves, rewards config
│
├── contexts/                     # React Context providers
│   └── AuthContext.tsx           # AuthProvider + useAuth (single onSnapshot, lives notification)
│
├── data/                         # Static data
│   ├── all_questions.json        # 537 Bible questions (100% OT + NT, Catholic canon)
│   └── level-topics.ts           # 100 level topic names, category ranges, helpers
│
├── hooks/                        # Custom React hooks
│   ├── useGuestGuard.ts          # Guest-mode guard with Alert prompts (Daftar/Log Masuk)
│   └── useLivesNotification.ts   # Lives-full transition detector (prev-tracker state machine)
│
├── services/                     # Firebase / business logic (no UI)
│   ├── adsService.ts             # Rewarded ad stub (returns stub_mode until real SDK wired)
│   ├── authService.ts            # Login, register, guest, username validation, signOut
│   ├── leaderboardService.ts     # Global + parish leaderboard Firestore queries
│   ├── levelService.ts           # submitLevelCompletion (XP math, transactional for high score)
│   ├── livesService.ts           # Lives system (all writes transactional)
│   ├── notificationService.ts    # Local notifications (lives full, lazy-loaded)
│   ├── quizService.ts            # Quiz data from Firestore + local JSON fallback
│   ├── seedService.ts            # Auto-seed quizzes on first launch (writeBatch, single-shot)
│   ├── socialAuthService.ts      # Google + Apple OAuth
│   └── tokenService.ts           # Token spend/award/unlock (spend is transactional)
│
├── types/
│   └── index.ts                  # TypeScript types: UserData, Quiz, LevelProgress, LeaderboardEntry, etc.
│
└── utils/                        # Pure utility functions
    ├── anti-cheat.utils.ts       # Per-answer + per-session response-time validation
    ├── misc.utils.ts             # shuffleArray (Fisher-Yates), randomItems, clamp
    ├── onboarding.ts             # AsyncStorage onboarding flag (markOnboarded, hasOnboarded)
    └── rememberMe.ts             # AsyncStorage remember-me flag
```

---

## `scripts/` — CLI & Admin Tools

```
scripts/
├── admin.mjs                     # Firebase Admin SDK CLI (find-user, delete-user, dump-leaderboard, grant-admin)
├── build_bible_replacements.js   # Idempotent script to replace non-Bible questions
├── dump-leaderboard.mjs          # Read-only leaderboard dump (client SDK + anon sign-in, no admin key)
├── seed-quizzes.ts               # Seeds Firestore quizzes (client SDK + anonymous sign-in)
├── seedStandalone.js             # Seeds quizzes via REST API (no admin key needed)
└── lib/
    └── admin-firebase.mjs        # Shared admin SDK init (service account JSON + gcloud ADC auto-detect)
```

---

## `stitch_community_feed/` — Design Reference Library

> **Status:** Reference library only — NOT an active design direction. The app currently uses the **"Divine Elegance"** design system (dark navy `#0e2a4d` + gold `#c9a227` + glassmorphism), which matches `katolikgo_divine_elegance/DESIGN.md`. Browsing these sub-folders for inspiration when iterating UI.

### Active Design System

```
stitch_community_feed/
├── katolikgo_divine_elegance/          # ★ ACTIVE — source of the Divine Elegance palette
│   └── DESIGN.md                       #   Dark navy + gold, glassmorphism, hex-clipped, halo glows
│                                       #   Matches Colors.primary + Colors.accent in theme.ts
├── luminous_grace/                     # Sibling system — cream + soft navy + pop gold, neomorphism-lite
│   └── DESIGN.md                       #   Closer to v3 "Orange Pill Nav" but not adopted
├── agent_system_prompt.md              # §4–§13 system prompt spec (canonical for design conversations)
├── katolikgo_catholic_education_app/
│   └── code.html                       # Single-file full-app HTML
```

### Per-Screen Mockups (Reference)

Each sub-folder contains a PNG screenshot + stitch-generated `code.html`.

```
stitch_community_feed/
│
│  ── Home ──
├── home_elegant/                       # Home (elegant variant)
├── home_gamified/                      # Home (gamified variant)
├── home_modern/                        # Home (modern variant)
│
│  ── Auth ──
├── login_elegant/                      # Login (elegant)
├── login_elegant_html/                 # Login (elegant HTML)
├── log_masuk_cute_minimal/             # Login (cute minimal)
├── sign_up_detailed/                   # Sign up (detailed)
├── sign_up_elegant_html/               # Sign up (elegant HTML)
│
│  ── Onboarding ──
├── onboarding_elegant_gold_1/          # Onboarding v1
├── onboarding_elegant_gold_2/          # Onboarding v2
├── daily_quiz_launch_elegant_1/        # Daily quiz launch v1
├── daily_quiz_launch_elegant_2/        # Daily quiz launch v2
│
│  ── Quiz ──
├── quiz_elegant/                       # Quiz (elegant)
├── quiz_gamified/                      # Quiz (gamified)
├── quiz_modern/                        # Quiz (modern)
├── quiz_play_elegant_gold/             # Quiz play (elegant gold)
├── quiz_play_with_in_place_feedback/   # Quiz play with in-place feedback
├── quiz_play_with_timer_power_ups/     # Quiz play with timer + power-ups
├── quiz_level_picker_1/                # Quiz level picker v1
├── quiz_level_picker_2/                # Quiz level picker v2
├── quiz_level_picker_3/                # Quiz level picker v3
├── quiz_level_picker_4/                # Quiz level picker v4
│
│  ── Result ──
├── keputusan_tahap_elegant/            # Result screen (elegant)
├── keputusan_tahap_divine_elegance_refined/  # Result screen (divine refined)
├── keputusan_tahap_divine_summary/     # Result screen (divine summary)
├── jawapan_betul_elegant_1/            # Correct answer feedback v1
├── jawapan_betul_elegant_2/            # Correct answer feedback v2
├── jawapan_salah_elegant_1/            # Wrong answer feedback v1
├── jawapan_salah_elegant_2/            # Wrong answer feedback v2
│
│  ── Leaderboard ──
├── leaderboard_elegant/                # Leaderboard (elegant variant)
│
│  ── Profile ──
├── profile_elegant/                    # Profile (elegant)
│
│  ── Social / Community ──
├── community_feed/                     # Community feed
├── cabaran_rakan_elegant/              # Friend challenge
├── admin_access_elegant/               # Admin panel
│
│  ── Rewards / Achievements ──
├── rewards_store_1/                    # Rewards store v1
├── rewards_store_2/                    # Rewards store v2
├── pencapaian_elegant_1/               # Achievements v1
├── pencapaian_elegant_2/               # Achievements v2
│
│  ── Customization ──
└── mascot_customization/               # Mascot customization ("Bilik Almari")
```

---

## `docs/` — Specifications

```
docs/
└── superpowers/
    └── specs/
        └── 2026-07-10--peta-path-screen.md   # Peta path screen design spec + decision log
```

---

## `.learnings/`

```
.learnings/
└── LEARNINGS.md                  # Development learnings log
```

---

## `dist/` — Build Output

```
dist/                             # Expo build output (gitignored in production)
```

---

## Summary by Numbers

| Category | Count |
|---|---|
| **Route screens** (`src/app/`) | 11 files |
| **Shared components** (`src/components/`) | 7 files (+ 3 peta) |
| **Services** (`src/services/`) | 10 files |
| **Custom hooks** (`src/hooks/`) | 2 files |
| **Utilities** (`src/utils/`) | 4 files |
| **Constants** (`src/constants/`) | 3 files |
| **Admin** (`src/admin/`) | 2 files |
| **Config** (`src/config/`) | 2 files |
| **Data** (`src/data/`) | 2 files |
| **Scripts** (`scripts/`) | 6 files |
| **Stitch designs** (`stitch_community_feed/`) | 42 sub-folders |
| **Total source files** (`src/`) | ~50 files |
