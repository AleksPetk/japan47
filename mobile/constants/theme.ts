import { Platform } from 'react-native';

export const colors = {
  ink: '#20251F',
  muted: '#687067',
  paper: '#FBFAF5',
  surface: '#FFFFFF',
  red: '#B43832',
  redDark: '#862721',
  redSoft: '#F5E3DF',
  sage: '#DBE3D4',
  forest: '#263B30',
  line: '#D9D8CF',
  gold: '#BD8C37',
  success: '#527256',
  warning: '#9A641F',
  danger: '#862721',
  blue: '#2779A7',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
};

export const shadow = Platform.select({
  ios: {
    shadowColor: '#1F2A1F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
  },
  android: { elevation: 3 },
  default: {},
});

export const typography = {
  title: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
};
