// Divine Elegance — dark navy + gold glassmorphism.
// Design system from `stitch_community_feed/katolikgo_divine_elegance/DESIGN.md`.

export const Colors = {
  // Core palette
  primary: '#abc9f2',
  primaryLight: '#d2e4ff',
  primaryDark: '#436084',
  primaryContainer: '#1a3a5c',
  onPrimary: '#103253',
  onPrimaryContainer: '#87a4cc',

  secondary: '#ecc246',
  secondaryLight: '#ffe08e',
  secondaryDark: '#b18c09',
  secondaryContainer: '#b18c09',
  onSecondary: '#3d2e00',
  onSecondaryContainer: '#352800',

  tertiary: '#ffb3b2',
  tertiaryContainer: '#730e1c',
  onTertiary: '#670315',
  onTertiaryContainer: '#ff787c',

  background: '#121411',
  surface: '#121411',
  surfaceLow: '#1a1c19',
  surfaceContainer: '#1e201d',
  surfaceContainerLow: '#171a1f',
  surfaceContainerHigh: '#292a27',
  surfaceContainerHighest: '#333532',
  surfaceDim: '#121411',
  surfaceBright: '#383a36',
  surfaceVariant: '#333532',

  onBackground: '#e3e3de',
  onSurface: '#e3e3de',
  onSurfaceVariant: '#c3c6cf',
  outline: '#8d9199',
  outlineVariant: '#43474e',

  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',

  statusError: '#c62828',
  success: '#10B981',
  warning: '#f59e0b',

  navyDark: '#0e2a4d',
  creamSoft: '#fdfaf0',
  haloGlow: 'rgba(201, 162, 39, 0.3)',

  inverseSurface: '#e3e3de',
  inverseOnSurface: '#2f312e',
  inversePrimary: '#436084',
  surfaceTint: '#abc9f2',

  // Legacy aliases so existing code doesn't blow up
  accent: '#ecc246',
  accentLight: '#ffe08e',
  accentDark: '#b18c09',
  maroon: '#b9444a',
  white: '#ffffff',
  black: '#000000',
  navy: '#1a3a5c',

  light: {
    text: '#e3e3de',
    textSecondary: '#c3c6cf',
    background: '#121411',
    surface: '#1a1c19',
    surfaceAlt: '#292a27',
    border: '#43474e',
  },
  dark: {
    text: '#e3e3de',
    textSecondary: '#c3c6cf',
    background: '#121411',
    surface: '#1a1c19',
    surfaceAlt: '#292a27',
    border: '#43474e',
  },
};

function assertColorsShape(obj: typeof Colors): asserts obj is typeof Colors {
  if (!obj.light || typeof obj.light !== 'object') {
    throw new Error('[theme] Colors.light missing');
  }
  if (!obj.dark || typeof obj.dark !== 'object') {
    throw new Error('[theme] Colors.dark missing');
  }
}

export const Spacing = {
  xs: 4,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  title: 36,
} as const;

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  inner: 10,
  card: 12,
  round: 9999,
  full: 9999,
} as const;

export const FontFamily = {
  display: '"Plus Jakarta Sans", system-ui, -apple-system, Roboto, sans-serif',
  displayBold: '"Plus Jakarta Sans", system-ui, -apple-system, Roboto, sans-serif',
  body: 'Inter, system-ui, -apple-system, Roboto, sans-serif',
  bodyMedium: 'Inter, system-ui, -apple-system, Roboto, sans-serif',
  bodySemiBold: 'Inter, system-ui, -apple-system, Roboto, sans-serif',
} as const;
