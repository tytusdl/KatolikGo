# Peta Path Screen — Replace Kuiz List with Path/Roadmap View

**Date:** 2026-07-10
**Status:** Draft
**Owner:** solo-dev

## Context

The current `src/app/(tabs)/quiz.tsx` shows a vertical list of level cards (white cards with category tag, difficulty pill, title, meta, footer text). User has requested a redesign modeled on a roadmap/path-style level picker (the "Duolingo path" pattern), drawn from a reference image showing a gold-medal ribbon path on a deep-navy background with biblical topic titles per node.

User has signed off on:
- Replace the Kuiz tab entirely with a new **Peta** tab.
- Use the reference image's navy + gold Catholic aesthetic — distinct from the v2 Brain Rush palette used elsewhere in the app.
- Each category has 20 levels: first 10 use hardcoded topic titles, levels 11–20 are plain numbered.
- Cross-category navigation via horizontal category chips at the top of the screen.

This is a **single-screen redesign + one tab-bar config swap**. No service-layer changes, no auth changes, no data model changes. The play screen (`quiz/[level].tsx`) and result screen (`quiz/result.tsx`) keep their existing routes — only the entry point that picks a level changes.

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Scope | Replace Kuiz tab with Peta tab (same screen slot in the bottom nav) |
| 2 | Visual style | Reference navy + gold Catholic palette (distinct from v2 Brain Rush) |
| 3 | Per-level titles | Top 10 named per category, levels 11–20 plain numbered |
| 4 | Cross-category nav | Horizontal category chip row above the path |
| 5 | Layout | Follow reference image verbatim — alternating left/right column, gold ribbon between nodes |
| 6 | Path ribbon implementation | Stacked rotated `<View>` strips (no new `react-native-svg` dependency) |

## File changes

### Rename (no content change beyond rename)

| Old path | New path | Reason |
|---|---|---|
| `src/app/(tabs)/quiz.tsx` | `src/app/(tabs)/peta.tsx` | New design doesn't share code with the old list view — clean rename |

### Modify

| Path | Change |
|---|---|
| `src/app/(tabs)/_layout.tsx` | `<Tabs.Screen name="quiz">` → `name="peta"`. Icon `school` → `map`, label `Kuiz` → `Peta`. No other layout changes. |
| `src/constants/theme.ts` | Add 6 new `Colors.*` entries reserved for the Peta screen: `goldGradient`, `pathRibbon`, `pathLocked`, `pathGlow`, `levelMedalCompleted`, `levelMedalLocked`. Each with docstring noting "reserved for Peta screen". |
| `src/constants/routes.ts` | Add `Routes.PETA = '/(tabs)/peta'`. Keep `Routes.QUIZ_LEVEL` unchanged. |

### Add

| Path | Purpose |
|---|---|
| `src/data/level-topics.ts` | Exports `LEVEL_TOPICS` (named topics for levels 1–10 of each category), `CATEGORY_LEVEL_RANGES` (`[number, number]` for each display category), `categoryForLevel`, `topicFor` helpers. |
| `src/components/peta/CategoryChips.tsx` | Horizontal scroll chip row. Props: `categories: DisplayCategory[]`, `active: DisplayCategory`, `unlockedRange: [number, number]`, `onChange: (cat) => void`. |
| `src/components/peta/LevelPath.tsx` | Vertical scroll container with `<PathRibbon>` + `<LevelNode>` stack. Props: `category: DisplayCategory`, `currentLevel: number`, `levelProgress: Record<string, LevelProgress>`, `onTapLevel: (n) => void`, `scrollRef?: React.Ref`. |
| `src/components/peta/PathRibbon.tsx` | Pure-`<View>` ribbon builder. Props: `nodePositions: Array<{ x: number, y: number }>`, `completedPairs: Set<string>` (key `"from-to"`). Returns stacked rotated View strips per node-to-node curve. |
| `src/components/peta/LevelNode.tsx` | One circular node. Props: `level`, `topic`, `state: 'completed' \| 'current' \| 'locked'`, `stars: 0 \| 1 \| 2 \| 3`, `bestScore?: number`. |

### No-touch (explicit invariants)

- `src/app/quiz/[level].tsx` — play screen stays as-is. Route unchanged.
- `src/app/quiz/result.tsx` — result screen stays. Tweak: post-`finishQuiz` redirect target stays at `/quiz/result`; back-from-result still resolves via back-stack to `/peta` (Expo Router handles this automatically because `routes.push(QUIZ_LEVEL(n))` retains the previous route on the stack).
- `src/services/*.ts` — no service-layer code changes.
- `src/types/index.ts` — no type changes.
- `src/contexts/AuthContext.tsx` — no context changes.
- `src/admin/*` — untouched.

## Component contracts

### `PetaScreen` (the `app/(tabs)/peta.tsx` entry)

Owns: `activeCategory` (local state, `useState<DisplayCategory>('alkitab')`). On mount, if `userData.currentLevel > 20` and `activeCategory === 'alkitab'`, auto-switch to the category that contains the current level. Passes everything down to `<CategoryChips>` and `<LevelPath>`. Renders `<ScreenHeader>` with back-disabled (we're at the tab root) and "Pilih Tahap" + `{totalXP} XP` badge.

### `<CategoryChips>`

- 5 chips, horizontal scroll, snap to closest.
- Active chip: filled gold (`Colors.levelMedalCompleted`), white text.
- Unlocked category (has at least one reachable level ≤ currentLevel): outlined gold, navy text.
- Locked category (all 20 levels > currentLevel): outlined gray (`Colors.pathLocked`), gray text, 🔒 icon.
- `onChange` callback gets the new category — parent updates `activeCategory`, scrolls the path into view.

### `<LevelPath>`

- `ScrollView` with `ref` exposed so the parent can call `scrollTo({ y, animated })` on category switch.
- `onLayout` per `<LevelNode>` records `nodeYPositions[level] = yOffset` for scroll targeting.
- Children:
  - 20 `<LevelNode>` children at vertical positions spaced ~120px apart, alternating left (margin `0` right-of-screen-padding) / right (margin `0` left-of-screen-padding) column to create the zigzag.
  - 19 `<PathRibbon>` segments between consecutive nodes. Each ribbon segment is a fixed-position `<View>` container at `(midX, midY)` between the two nodes' bounding rects, containing 3 stacked rotated `<View>` strips angled to suggest the curve.

### `<LevelNode>`

State cases:

```
state: 'completed' | 'current' | 'locked'

case 'completed':
  Circle: 64px diameter, Colors.levelMedalCompleted fill, 3-star row below.
  ★★★ if bestScore>=90, ★★✩ if bestScore>=80, ★✩✩ else.
  Subtitle: topic name OR "" if topic is null.
  Number badge top-right (small, navy on gold).

case 'current':
  Circle: 80px diameter, gold fill, animated scale loop 1.0 ↔ 1.05 every 2s.
  Outer glow ring (12px wide, Colors.pathGlow, 0.4 opacity).
  Center: large level number in white.
  Black ▶ play CTA button below (44px, rounded).
  Subtitle: "Tahap N: {topic}" in gold ribbon.

case 'locked':
  Circle: 64px diameter, Colors.levelMedalLocked fill, 🔒 icon centered.
  Level number below in light gray.
  No topic subtitle.
```

All 3 cases have `accessibilityRole="button"` + a descriptive `accessibilityLabel` ("Tahap 5: Nabi-Nabi, Selesai", "Tahap 4: Musa, Sedang Dimainkan", "Tahap 7, Terkunci — Selesaikan Tahap 6 untuk buka").

## Data flow

```
useEffect(() => {
  if (activeCategory) {
    const targetLevel = Math.min(currentLevel, rangeEnd);
    pathScrollRef.scrollTo({ y: nodeYPositions[targetLevel] ?? 0, animated: true });
  }
}, [activeCategory]);
```

| Source | Type | Usage |
|---|---|---|
| `userData.currentLevel` | `number` | Determines unlocked frontier per category. |
| `userData.levelProgress` | `Record<string, LevelProgress>` | Per-node completed/bestScore/stars. |
| `userData.totalXP` | `number` | Header XP badge. |
| `userData.isGuest` | `boolean` | Toggles guest-mode tap handler. |
| `LEVEL_TOPICS[cat]` | `string[]` | Per-node subtitle (levels 1–10 only; `null` for 11+). |
| `CATEGORY_LEVEL_RANGES[cat]` | `[number, number]` | Computes node count + scroll target. |

## Topic naming proposals

`src/data/level-topics.ts` — `LEVEL_TOPICS` hardcoded values:

```typescript
// Alkitab — verbatim from reference image + Indonesia/Alkitab chronology.
// Levels 1-10 narrative arc from Penciptaan through Wahyu.
alkitab: [
  'Penciptaan',         // L1 — Kej 1-2
  'Nuh',                // L2 — Kej 6-9
  'Abraham',            // L3 — Kej 12-25
  'Musa',               // L4 — Kel 1-20 (10 Perintah = reference focus)
  'Daud',               // L5 — 1 Sam 16-31 + 2 Sam
  'Salomo',             // L6 — 1 Raj 1-11 + Ams + Pengkh
  'Nabi-Nabi',          // L7 — Yesaya, Yeremia, Daniel, etc.
  'Yesus',              // L8 — Mateus-John narrative
  'Para Rasul',         // L9 — Kisah Para Rasul + Pauline epistles
  'Wahyu',              // L10 — Kitab Wahyu
],

// Sakramen — 7 Sakramen + persiapan/akibat.
// Levels 11-20 plain numbered.
sakramen: [
  'Baptisan',                // L21
  'Krisma',                  // L22
  'Ekaristi',                // L23
  'Rekonsiliasi',            // L24
  'Pengurapan Orang Sakit',  // L25
  'Imamat',                  // L26
  'Perkawinan',              // L27
  'Tanda & Simbol',          // L28 — sacramentality overview
  'Sumber & Puncak',         // L29 — Ekaristi sebagai sumbergrace
  'Liturgi Suci',            // L30 — sacrament context
],

// Liturgi — Misa Kudus, Bahagian Liturgi, dll.
liturgi: [
  'Misa Kudus - Intro',      // L41
  'Liturgi Sabda',           // L42
  'Liturgi Ekaristi',        // L43
  'Sakramen Tata Cara',      // L44
  'Tahun Liturgi',           // L45
  'Warna Liturgi',           // L46
  'Doa & Himne',             // L47
  'Ritus Pembuka',           // L48
  'Ritus Penutup',           // L49
  'Ibadat Sabda',            // L50
],

// Katekismus — CCC structure pillars.
katekismus: [
  'Profesi Iman',            // L61
  'Sakramen',                // L62
  'Dosa & Kebajikan',        // L63
  'Doa Bapa Kami',          // L64
  '10 Perintah',            // L65
  '2 Perintah Kasih',       // L66
  '7 Sabda Bahagia',        // L67
  '3 Kebajikan Teologal',   // L68
  '4 Kebajikan Kardinal',   // L69
  '7 Buah Roh Kudus',      // L70
],

// Santo — Catholic saints + devotion themes.
santo: [
  'Santa Perawan Maria',    // L81
  'Santo Yusuf',            // L82
  'Santo Petrus',           // L83
  'Santo Paulus',           // L84
  'Santo Yohanes',          // L85
  'Para Martir',            // L86
  'Santo Pelindung',        // L87
  'Orang Suci',             // L88
  'Doa Kepada Santo',       // L89
  'Relik & Ziarah',         // L90
],
```

User can edit these later — one string per entry. No UI churn.

## Category → level range

```
DisplayCategory     levels   internal category (Quiz.category enum)
─────────────────────────────────────────────────────────────────────
alkitab             1-20     old_testament + new_testament (mixed)
sakramen            21-40    sacraments
liturgi             41-60    liturgy
katekismus          61-80    ccc
santo               81-100   ccc (second sweep)
```

Display-only mapping. Underlying `Quiz.category` for `level=37` stays `sacraments` — no Firestore write needed.

## Tap interactions

```
handleTapLevel(level: number):
  if isGuest:
    if level > currentLevel → useGuestGuard.showUnlockPrompt()
    else → routes.push(QUIZ_LEVEL(level)) and lets guest play

  if level <= currentLevel:
    → routes.push(Routes.QUIZ_LEVEL(level))

  if level > currentLevel:
    Alert.alert('Tahap Terkunci', ..., [
      Tutup,
      { Buka dengan 30 token → tokenService.unlockLevelWithToken() }
    ])
```

- `tokenService.unlockLevelWithToken` exists and works. No service change.
- `useGuestGuard` exists and is reused. No new hook.

## Edge cases

| Case | Handling |
|---|---|
| Fresh user (`currentLevel = 1`) | First category opens with level 1 as current node. Auto-scroll to top. |
| Loading (`!userData && loading`) | `<ActivityIndicator>` splash (mirror `quiz.tsx:149-155`). |
| Category fully complete | All 20 nodes gold-completed. Path ribbon stays gold entire way. Next category becomes next "current". |
| Category fully locked | All 20 nodes gray. Tap any → Alert "Tahap Terkunci". |
| Guest user tapping locked | `useGuestGuard` + Daftar/Log Masuk flow. |
| Race between userData refresh + active level | `currentLevel` read inside `useEffect` on userData change triggers redraw + re-scroll. |

## Out of scope

- New service code (read paths already exist).
- New types (existing `LevelProgress`, `UserData.currentLevel` suffice).
- New auth / token / XP math.
- Animations beyond the current-node glow (no entrance animations, no scroll-driven effects).
- A custom `react-native-svg` integration (chose no-dep approach instead).
- Per-node detail page (tap → goes straight to play screen, no intermediate).
- A "Papan Pendahulu" leaderboard overhaul.
- Mockup HTML files in `mockups/` — this design replaces the Kuiz list but no `mockup-v6` snapshot is generated unless user asks.

## Verification

1. `npx tsc --noEmit` exits 0.
2. `npx expo lint` exits 0.
3. `npx expo start` + visual smoke on:
   - Tab rename visible: bottom nav says "Peta" in the 2nd slot.
   - Default category (Alkitab) loads with first 3 nodes gold-completed for a returning user, level 4 glowing current.
   - Category chip tap → path re-renders + auto-scrolls to current.
   - Tap completed level → play screen opens, after finish returns back to Peta tab (not to a stale Kuiz path).
   - Tap locked level → Alert with "Buka dengan 30 token" appears.
   - Cross-watermark visible in path background.
4. Re-run `iOS index.bundle` + `Web index.bundle` to confirm no Metro regression.
