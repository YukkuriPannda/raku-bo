import { StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '@/constants/theme';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // サマリーカード
  totalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  totalLabel: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: spacing.xs,
  },
  totalSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // タイプセレクタ（サブスク / カレンダー連動）
  typeSelector: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  typeSelectorItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  typeSelectorActive: {
    backgroundColor: '#E65100',
  },
  typeSelectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeSelectorTextActive: {
    color: '#fff',
  },

  // 追加フォームカード
  addCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  addTitle: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  inputHalf: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },

  // カテゴリ・支払い方法セレクタ
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  selectorChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectorChipActive: {
    backgroundColor: '#E65100',
    borderColor: '#E65100',
  },
  selectorChipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  selectorChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // 請求サイクルトグル
  cycleToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  cycleToggleItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cycleToggleActive: {
    backgroundColor: '#E65100',
  },
  cycleToggleText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cycleToggleTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // 追加ボタン
  addBtn: {
    backgroundColor: '#E65100',
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: spacing.xs,
  },

  // セクションラベル
  sectionLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.lg,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },

  // 予定支出アイテムカード
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  itemCardInactive: {
    opacity: 0.5,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  itemIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  plannedBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  plannedBadgeText: {
    fontSize: 10,
    color: '#E65100',
    fontWeight: '600',
  },
  itemSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65100',
  },
  itemButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toggleBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  toggleBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deleteBtnText: {
    fontSize: 12,
    color: colors.danger,
  },
  completeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  completeBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },

  // 月ナビゲーター
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  monthNavBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  monthNavBtnDisabled: {
    opacity: 0.3,
  },
  monthNavArrow: {
    fontSize: 22,
    color: '#E65100',
    fontWeight: '600',
  },
  monthNavLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // カレンダーイベントピッカー
  eventPickerLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  eventList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  eventItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eventItemSelected: {
    backgroundColor: '#FFF3E0',
  },
  eventItemTitle: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  eventItemDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  eventNone: {
    padding: spacing.md,
    alignItems: 'center',
  },
  eventNoneText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // 空状態
  empty: {
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
  },

  // 編集モーダル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '85%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalSave: {
    flex: 1,
    backgroundColor: '#E65100',
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
});
