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
  subRowNote: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
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
  subRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subRowChevron: {
    fontSize: 18,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  monthLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.lg,
    marginTop: spacing.md,
  },

  // カテゴリ別支出の円グラフ（ホーム画面）
  categoryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  categoryTitle: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  categoryEmptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  categoryBody: {
    alignItems: 'center',
  },
  categoryChart: {
    marginBottom: spacing.md,
  },
  categoryLegend: {
    width: '100%',
  },
  categoryLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  categoryLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  categoryLegendLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  categoryLegendValue: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // 支出の草グラフ（ホーム画面）
  heatmapCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  heatmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  heatmapTitle: {
    ...typography.label,
    color: colors.textPrimary,
  },
  heatmapChevron: {
    fontSize: 18,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  heatmapBody: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  heatmapDayLabels: {
    marginRight: 4,
    marginTop: 14, // 月ラベル行ぶんだけ下げてグリッドと縦位置を合わせる
  },
  heatmapDayLabel: {
    height: 15,
    lineHeight: 15,
    fontSize: 9,
    color: colors.textSecondary,
  },
  heatmapMonthLabels: {
    height: 14,
  },
  heatmapMonthLabel: {
    position: 'absolute',
    top: 0,
    fontSize: 9,
    color: colors.textSecondary,
  },
  heatmapGrid: {
    flexDirection: 'row',
  },
  heatmapColumn: {
    flexDirection: 'column',
  },
  heatmapCell: {
    width: 12,
    height: 12,
    marginRight: 3,
    marginBottom: 3,
    borderRadius: 3,
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  heatmapLegendLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginHorizontal: 2,
  },
  heatmapLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
