/**
 * Level topic data for the Peta (path) screen.
 *
 * Each display category has 20 levels (1..20 within the category range).
 * Levels 1..10 carry a named topic arc (Catholic / Bible milestones); levels
 * 11..20 are plain numbered. Topic data lives here rather than in the
 * Firestore quiz doc so the path stays readable even for users who haven't
 * reached a given level yet.
 *
 * Mapping note: the underlying `Quiz.category` enum stays
 * `old_testament` / `new_testament` / `sacraments` / `liturgy` / `ccc` —
 * the "Santo" bucket reuses `ccc` for Firestore storage. Display-only
 * mapping handled by `categoryForLevel` below; no Firestore write needed.
 *
 * User can rename any of these — one string per entry, no UI churn.
 */
export const LEVEL_TOPICS: Record<DisplayCategory, readonly string[]> = {
  alkitab: [
    'Penciptaan',         // L1  — Kej 1-2
    'Nuh',                // L2  — Kej 6-9
    'Abraham',            // L3  — Kej 12-25
    'Musa',               // L4  — Kel 1-20 (10 Perintah)
    'Daud',               // L5  — 1 Sam 16-31 + 2 Sam
    'Salomo',             // L6  — 1 Raj 1-11 + Ams + Pkh
    'Nabi-Nabi',          // L7  — Yesaya, Yeremia, Daniel
    'Yesus',              // L8  — Mateus-John narrative
    'Para Rasul',         // L9  — Kis + Pauline epistles
    'Wahyu',              // L10 — Kitab Wahyu
  ],
  sakramen: [
    'Baptisan',                // L21
    'Krisma',                  // L22
    'Ekaristi',                // L23
    'Rekonsiliasi',            // L24
    'Pengurapan',              // L25 — Pengurapan Orang Sakit
    'Imamat',                  // L26
    'Perkawinan',              // L27
    'Tanda Suci',              // L28 — sacramentality overview
    'Sumber Grace',            // L29 — Ekaristi sebagai sumber
    'Liturgi Suci',            // L30
  ],
  liturgi: [
    'Misa Kudus',              // L41
    'Liturgi Sabda',           // L42
    'Liturgi Ekaristi',        // L43
    'Sakramen Tata',           // L44
    'Tahun Liturgi',           // L45
    'Warna Liturgi',           // L46
    'Doa & Himne',             // L47
    'Ritus Pembuka',           // L48
    'Ritus Penutup',           // L49
    'Ibadat Sabda',            // L50
  ],
  katekismus: [
    'Profesi Iman',            // L61
    'Sakramen',                // L62
    'Dosa',                    // L63 — Dosa & Kebajikan
    'Bapa Kami',               // L64 — Doa Bapa Kami
    '10 Perintah',             // L65
    '2 Kasih',                 // L66 — 2 Perintah Kasih
    '7 Bahagia',               // L67 — 7 Sabda Bahagia
    '3 Teologal',              // L68 — 3 Kebajikan Teologal
    '4 Kardinal',              // L69 — 4 Kebajikan Kardinal
    '7 Roh Kudus',             // L70 — 7 Buah Roh Kudus
  ],
  santo: [
    'Santa Maria',             // L81
    'Santo Yusuf',             // L82
    'Santo Petrus',            // L83
    'Santo Paulus',            // L84
    'Santo Yohanes',           // L85
    'Martir',                  // L86 — Para Martir
    'Pelindung',               // L87 — Santo Pelindung
    'Orang Suci',              // L88
    'Doa Santo',               // L89
    'Ziarah',                  // L90 — Relik & Ziarah
  ],
};

/**
 * Each display category owns a contiguous range of 20 levels. The range is
 * [start, end] inclusive. Use these to filter levelProgress keys + to
 * compute the active level within the category for scroll targeting.
 */
export const CATEGORY_LEVEL_RANGES: Record<DisplayCategory, readonly [number, number]> = {
  alkitab: [1, 20],
  sakramen: [21, 40],
  liturgi: [41, 60],
  katekismus: [61, 80],
  santo: [81, 100],
};

/** Display order (used by `CategoryChips` and the `_layout` flow). */
export const CATEGORIES: readonly DisplayCategory[] = [
  'alkitab',
  'sakramen',
  'liturgi',
  'katekismus',
  'santo',
] as const;

/** Malay label per display category — used for the chip text + header title. */
export const CATEGORY_LABELS: Record<DisplayCategory, string> = {
  alkitab: 'Alkitab',
  sakramen: 'Sakramen',
  liturgi: 'Liturgi',
  katekismus: 'Katekismus',
  santo: 'Santo',
};

/** Short emoji used in the chip + category-aware tint. */
export const CATEGORY_EMOJI: Record<DisplayCategory, string> = {
  alkitab: '📖',
  sakramen: '⛪',
  liturgi: '✨',
  katekismus: '✝️',
  santo: '🕊️',
};

/** Display-level type — only used by the Peta screen, not stored on Quiz. */
export type DisplayCategory =
  | 'alkitab'
  | 'sakramen'
  | 'liturgi'
  | 'katekismus'
  | 'santo';

/** Resolve a level number (1..100) to its display category. */
export function categoryForLevel(level: number): DisplayCategory {
  for (const cat of CATEGORIES) {
    const [start, end] = CATEGORY_LEVEL_RANGES[cat];
    if (level >= start && level <= end) {
      return cat;
    }
  }
  // Fallback — out-of-range levels are surfaced as alkitab for safety.
  return 'alkitab';
}

/**
 * Per-level topic title. Returns `null` for levels 11..20 (plain numbered
 * mode per the design decision). Returns the named topic for 1..10 within
 * the resolved category.
 */
export function topicFor(level: number): string | null {
  const cat = categoryForLevel(level);
  const [, end] = CATEGORY_LEVEL_RANGES[cat];
  const offset = level - (end - 19); // index 0..19 within category
  if (offset >= 10) return null;
  return LEVEL_TOPICS[cat][offset] ?? null;
}

/** Position of a level within its category (1..20). */
export function indexInCategory(level: number): number {
  const [, end] = CATEGORY_LEVEL_RANGES[categoryForLevel(level)];
  return level - (end - 19);
}

/**
 * Total count of levels for a given category. Currently always 20 but
 * centralised here so a future expansion (split Alkitab → OT + NT) is
 * one constant change.
 */
export function levelsInCategory(cat: DisplayCategory): number {
  const [start, end] = CATEGORY_LEVEL_RANGES[cat];
  return end - start + 1;
}
