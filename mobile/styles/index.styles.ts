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
