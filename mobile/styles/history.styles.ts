import { StyleSheet } from 'react-native';
import { colors, spacing } from '@/constants/theme';

// 建て替え（未回収）を表す色。記録画面・ホーム・ウィジェットと共通
const ADVANCE_COLOR = '#E65100';
const ADVANCE_BG = '#FFF3E0';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  monthBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthBarText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    height: 72,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemEmoji: {
    fontSize: 20,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  itemSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  deleteAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  settleAction: {
    backgroundColor: ADVANCE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  settleActionUndo: {
    backgroundColor: colors.textSecondary,
  },
  settleActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  advanceBadge: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: ADVANCE_COLOR,
  },
  advanceBadgeSettled: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  itemAmountAdvance: {
    color: ADVANCE_COLOR,
  },
  unsettledBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ADVANCE_BG,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unsettledLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: ADVANCE_COLOR,
  },
  unsettledAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: ADVANCE_COLOR,
  },
  deleteActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  expandedSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md + 52,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  expandedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  expandedItemName: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    marginRight: 12,
  },
  expandedItemPrice: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  expandedEmpty: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
});
