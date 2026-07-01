import '@/global.css';

export const Colors = {
  primary: '#1a3a5c',
  primaryLight: '#2a5a8c',
  primaryDark: '#0f2540',
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
