import { StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '@/constants/theme';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mainCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  mainCardLabel: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  mainAmount: {
    ...typography.display,
    marginBottom: spacing.sm,
  },
  mainAmountPositive: {
    color: colors.primary,
  },
  mainAmountNegative: {
    color: colors.danger,
  },
  mainCardSub: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  subCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  subRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subRowEmoji: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  subRowLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  subRowValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subRowValueGreen: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  monthLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.lg,
    marginTop: spacing.md,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 32,
    right: spacing.lg,
    alignItems: 'flex-end',
    gap: 12,
  },
  fabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fabLabel: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fabLabelText: {
    color: colors.surface,
    fontSize: 13,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabPrimary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabMain: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
});
