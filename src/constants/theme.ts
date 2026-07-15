// Minimal theme — black, white, and one blue accent.
// Placeholder palette for the new design direction. The previous
// "Divine Elegance" glassmorphism tokens (navy + gold + glass surfaces)
// have been removed pending a fresh design pass. Add new tokens here
// when the new direction is decided.

export const Colors = {
  // === Core ===
  background: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#000000',
  textMuted: '#666666',
  border: '#E5E5E5',
  accent: '#2563EB',  // single blue accent — buttons, links, focus
  error: '#DC2626',
  warning: '#F59E0B',
  success: '#10B981',
  white: '#FFFFFF',
  black: '#000000',
} as const;

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
  round: 9999,
  full: 9999,
} as const;

export const FontFamily = {
  display: 'system-ui, -apple-system, Roboto, sans-serif',
  displayBold: 'system-ui, -apple-system, Roboto, sans-serif',
  body: 'system-ui, -apple-system, Roboto, sans-serif',
  bodyMedium: 'system-ui, -apple-system, Roboto, sans-serif',
  bodySemiBold: 'system-ui, -apple-system, Roboto, sans-serif',
} as const;
