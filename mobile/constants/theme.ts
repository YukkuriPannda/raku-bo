import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#1B7F4F',
  danger: '#D01E1E',
  background: '#F8F8F8',
  surface: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const typography = {
  display: { fontSize: 48, fontWeight: 'bold' as const },
  headline: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16 },
  label: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 12 },
} as const;

// 共通スタイル
export const common = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.lg,
    marginBottom: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 48,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 48,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
