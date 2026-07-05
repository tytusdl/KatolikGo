// NOTE: the global CSS import (`@/global.css`) was removed from
// this file in the 2026-07-06 audit. It's a SIDE-EFFECT IMPORT and
// doesn't belong in a constants file alongside pure data exports.
// The CSS bundle is now loaded once from `src/app/_layout.tsx` (see
// its `'../global.css'` import at the top) so all the global CSS
// variables are still available app-wide without surprising the
// bundler / future readers with side-effect imports in a "constants"
// module.

export const Colors = {
  primary: '#1a3a5c',
  primaryLight: '#2a5a8c',
  primaryDark: '#0f2540',
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
  accent: '#c9a227',
  accentLight: '#e0bd4d',
  success: '#2e7d32',
  error: '#c62828',
  warning: '#f57c00',
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
  lg: 16,
  xl: 24,
  round: 999,
} as const;
