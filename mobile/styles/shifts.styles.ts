import { StyleSheet } from 'react-native';
import { colors, spacing, radius } from '@/constants/theme';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  forecastCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  forecastLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  forecastAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: colors.primary,
  },
  forecastSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  wageCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  wageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  wageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wageCurrency: {
    fontSize: 16,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  wageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
  },
  wageSaveBtn: {
    marginLeft: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 48,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  shiftCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  shiftTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  shiftTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  shiftFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftDuration: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  shiftWage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  sectionLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.lg,
    marginBottom: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 1.5,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  emptySubText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
