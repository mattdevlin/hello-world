// Shared design tokens for consistent styling across components
export const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export const BRAND = {
  primary: '#2C5F8A',
  success: '#27ae60',
  warning: '#e67e22',
  danger: '#e74c3c',
  floor: '#5D4037',
  h1: '#2E7D32',
  roof: '#8D6E63',
};

export const NEUTRAL = {
  text: '#1a1a1a',
  textSecondary: '#555',
  textMuted: '#636363',    // 5.92:1 contrast ratio (WCAG AA)
  textFaint: '#737373',    // 4.65:1 contrast ratio (WCAG AA)
  border: '#e0e0e0',
  borderLight: '#eee',
  background: '#f0f2f5',
  surface: '#fff',
  inputBorder: '#ccc',
};

export const RADIUS = {
  sm: 4,
  md: 6,
  lg: 8,
};

export const SHADOW = {
  sm: '0 1px 3px rgba(0,0,0,0.08)',
  md: '0 2px 8px rgba(0,0,0,0.12)',
  lg: '0 4px 16px rgba(0,0,0,0.16)',
};
