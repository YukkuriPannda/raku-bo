import { StyleSheet } from 'react-native';
import { colors, spacing, radius } from '@/constants/theme';

const SELECTED_BG = '#E8F5EF';

export const styles = StyleSheet.create({
  container: {
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
    marginTop: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  fieldInput: {
    fontSize: 16,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
    marginBottom: spacing.md,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  currency: {
    fontSize: 18,
    color: colors.textSecondary,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryBtn: {
    flex: 1,
    minWidth: '44%',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  categoryBtnActive: {
    borderColor: colors.primary,
    backgroundColor: SELECTED_BG,
  },
  categoryEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: colors.primary,
  },
  otherLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: SELECTED_BG,
  },
  chipEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  paymentBtnActive: {
    borderColor: colors.primary,
    backgroundColor: SELECTED_BG,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  paymentTextActive: {
    color: colors.primary,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  pointsEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  pointsText: {
    fontSize: 14,
    color: '#1D4ED8',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  cancelText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  emptyBackButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  emptyBackButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
