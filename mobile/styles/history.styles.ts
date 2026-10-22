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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthBarText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  // 前月／翌月の送りボタン。タブ切替スワイプと同じ帯に載るため、
  // 指が触れる範囲は hitSlop で補う
  monthNavButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  monthNavLabel: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.primary,
  },
  monthNavLabelDisabled: {
    color: colors.border,
  },
  historySummary: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historySummaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  historySummaryTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 2,
  },
  historySummaryEmpty: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  historySummaryCategories: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  historySummaryStackedBar: {
    flexDirection: 'row',
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  historySummarySegment: {
    height: '100%',
  },
  historySummaryLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  historySummaryCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  historySummaryCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historySummaryCategoryEmoji: {
    fontSize: 16,
    lineHeight: 20,
  },
  filterBar: {
    flexGrow: 0,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterContent: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  filterChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filterChipText: {
    flexShrink: 0,
    fontSize: 13,
    color: colors.textPrimary,
  },
  filterChipTextSelected: {
    color: colors.surface,
    fontWeight: '600',
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
