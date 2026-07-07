// NOTE: the global CSS import (`@/global.css`) was removed from
// this file in the 2026-07-06 audit. It's a SIDE-EFFECT IMPORT and
// doesn't belong in a constants file alongside pure data exports.
// The CSS bundle is now loaded once from `src/app/_layout.tsx` (see
// its `'../global.css'` import at the top) so all the global CSS
// variables are still available app-wide without surprising the
// bundler / future readers with side-effect imports in a "constants"
// module.

export const Colors = {
  /**
   * v2 "Brain Rush" saturated blue — the dominant surface color
   * across the (tabs) group (Home / Kuiz / Papan / Profil). Replaces
   * the older navy `#1a3a5c` palette as part of the 2026-07-07
   * design migration to mockup v2. The previous navy still appears
   * in `Colors.navy` below for text + dense UI surfaces where the
   * saturated blue would feel "too loud" as a fill.
   */
  primary: '#1c5fe0',
  primaryLight: '#4d8bff',
  primaryDark: '#1249b6',
  /**
   * Pale blue tint used by v2 for the secondary surface (Home body
   * under the gradient header, Quiz list background). Distinct from
   * `primaryLight` which is a saturated tint — `primaryPale` is a
   * wash (≈10% saturation) suitable as a full-screen background.
   */
  primaryPale: '#e8f0ff',
  /**
   * Legacy navy — kept for text and dense UI where saturated blue
   * reads as too aggressive as a fill. Also matches the v2 mockup's
   * `--navy` text color (`#1a3a5c`) so headings + dense surfaces stay
   * legible against the brighter primary surfaces.
   */
  navy: '#1a3a5c',
  /**
   * Darker navy used by the branded splash screen and the auth
   * screen gradient. Was previously a magic string (`'#0e2a4d'`)
   * duplicated across `_layout.tsx` and `AuthScreen.tsx` — promoted
   * here so renaming the splash palette is one edit. The shadow
   * `Colors.primaryDark` and this `Colors.navyDark` are intentionally
   * distinct: `primaryDark` tints `primary` for hover/pressed
   * states on light backgrounds, while `navyDark` is the
   * near-black-blue behind full-screen dark surfaces.
   */
  navyDark: '#0e2a4d',
  /**
   * Catholic gold — preserved across the v2 redesign. Used for
   * Latin crosses, token medals, podium crowns, and other
   * brand-faithful accents. Distinct from `Colors.cta` (yellow) —
   * gold here is the Catholic brand color; the yellow CTA is the
   * saturated Brain-Rush-style action button color.
   */
  accent: '#c9a227',
  accentLight: '#e0bd4d',
  /**
   * v2 "Brain Rush" CTA yellow — the saturated, attention-grabbing
   * yellow used on the primary action button across the (tabs)
   * group. Distinct from `Colors.accent` (Catholic gold): the CTA
   * here is intentionally brighter and warmer so it pops against
   * the blue primary surface. Used together with `ctaDark` for
   * pressed/hover states.
   */
  cta: '#ffcc1f',
  ctaDark: '#f5b800',
  /**
   * CTA maroon — the desaturated red used for the primary submit
   * button on the auth screen ("Log Masuk" / "Daftar"). Was a
   * magic string `'#b9444a'` literal hardcoded in
   * `components/AuthScreen.tsx` — promoted here so a future tweak
   * to the login CTA palette is one edit. Distinct from
   * `Colors.error` (`#c62828`) which is reserved for inline alerts
   * and badge backgrounds; the maroon here is intentionally darker
   * and more muted so it doesn't read as an error state.
   */
  maroon: '#b9444a',
  success: '#2e7d32',
  error: '#c62828',
  warning: '#f57c00',
  /**
   * v2 category chip icon tints. Each category in the Home
   * category chip row + quiz list gets a unique pastel gradient on
   * its icon background (see v2 mockup). Centralized here so
   * renaming any category's tint is one edit and the colors stay
   * consistent across Home + Quiz screens.
   */
  categoryAlkitab: '#ff9ec4',
  categorySakramen: '#93c5fd',
  categoryLiturgi: '#e0bd4d',
  categoryKatekismus: '#6ee7b7',
  categorySanto: '#fdba74',
  white: '#ffffff',
  black: '#000000',

  light: {
    text: '#1a1a1a',
    textSecondary: '#60646c',
    background: '#f5f5f5',
    surface: '#ffffff',
    surfaceAlt: '#e8e8ec',
    border: '#d0d0d4',
  },
  dark: {
    text: '#ffffff',
    textSecondary: '#b0b4ba',
    background: '#0f1115',
    surface: '#1a1d23',
    surfaceAlt: '#252830',
    border: '#353840',
  },
} as const;

// Runtime guard — `Colors` is `as const` so the type system enforces
// shape, but we want a *runtime* signal too in case some
// future bundler hot-reload replaces one half of the object without
// the other, or a typo in a constants file leaves `Colors.light`
// as `undefined`. Calling `Colors.light.textSecondary` then throws
// "Cannot read properties of undefined" on every affected screen;
// the guard turns that into a clear, single-point-of-failure
// startup error.
//
// Also satisfies strict-mode `exhaustive-deps` lint check when a
// downstream test wants to assert the full shape is present.
function assertColorsShape(
  obj: typeof Colors
): asserts obj is typeof Colors & { light: NonNullable<typeof Colors.light> } {
  const required: (keyof typeof Colors.light & string)[] = [
    'text',
    'textSecondary',
    'background',
    'surface',
    'surfaceAlt',
    'border',
  ];
  if (!obj.light || typeof obj.light !== 'object') {
    throw new Error(
      '[theme] Colors.light is missing or malformed at module load. ' +
        '`src/constants/theme.ts` is corrupt — check the file and ' +
        'reload.'
    );
  }
  for (const key of required) {
    if (typeof obj.light[key] !== 'string') {
      throw new Error(
        `[theme] Colors.light.${key} is missing or not a string at ` +
          `module load. Expected a colour literal.`
      );
    }
  }
  if (!obj.dark || typeof obj.dark !== 'object') {
    throw new Error('[theme] Colors.dark is missing or malformed.');
  }
}
assertColorsShape(Colors);

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export function useThemeColor(color: ThemeColor) {
  // Simplified - returns light mode color by default
  // Can be extended with useColorScheme for dark mode
  return Colors.light[color];
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  title: 40,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  /**
   * v2 Brain Rush card radius — the canonical 16px used on the
   * Home Kuiz Terkini list cards, quiz level cards, profile stat
   * grid. Centralized so a future bump to "puffy" (20px) is one
   * edit instead of grep-and-replace across the (tabs) group.
   */
  card: 16,
  /**
   * v2 Brain Rush inner radius — 14px for the smaller inner
   * surfaces (category chip icon backgrounds, stat pill icons).
   * Slightly smaller than the outer card so the nested element
   * reads as visually "inside" without competing.
   */
  inner: 14,
  lg: 16,
  xl: 24,
  round: 999,
} as const;
