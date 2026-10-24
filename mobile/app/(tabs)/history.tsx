import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Alert,
  ListRenderItemInfo,
} from 'react-native';
import { GestureDetector, Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { useAppStore } from '@/store';
import { formatNumberJa } from '@/lib/number-format';
import { buildHistoryExpenseSummary } from '@/lib/history-summary';
import { ALL_CATEGORIES, CATEGORY_EMOJI } from '@/types';
import { colors } from '@/constants/theme';
import { styles } from '@/styles/history.styles';
import { useSwipeTabNavigation } from '@/hooks/useSwipeTabNavigation';
import { useRefreshOnForeground } from '@/hooks/useRefreshOnForeground';
import type { Transaction } from '@/types';
import { useShallow } from 'zustand/react/shallow';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** "YYYY-MM" を delta ヶ月ずらす。Date 経由なので年またぎも越える */
function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-09" → "2026年9月" */
function formatMonthLabel(month: string): string {
  const [year, mon] = month.split('-');
  return `${year}年${Number(mon)}月`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// 未取得の月に毎レンダー新しい配列を渡すと useMemo が毎回やり直しになるため、
// 空配列は固定のものを使い回す
const NO_TRANSACTIONS: Transaction[] = [];

const PAYMENT_LABEL: Record<string, string> = {
  cash: '現金',
  card: 'カード',
  qr: 'QR',
};

function DeleteAction({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.deleteAction}
    >
      <Text style={styles.deleteActionText}>削除</Text>
    </TouchableOpacity>
  );
}

/** 建て替えの行だけに出る、返済済み／未返済を切り替えるスワイプアクション */
function SettleAction({ settled, onPress }: { settled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.settleAction, settled && styles.settleActionUndo]}
    >
      <Text style={styles.settleActionText}>{settled ? '未返済に\n戻す' : '返済\n済み'}</Text>
    </TouchableOpacity>
  );
}

function TransactionItem({
  item,
  expanded,
  onToggle,
  onLongPress,
  onDelete,
  onSettle,
}: {
  item: Transaction;
  expanded: boolean;
  onToggle: () => void;
  onLongPress: () => void;
  onDelete: (id: string) => void;
  onSettle: (item: Transaction) => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const emoji = CATEGORY_EMOJI[item.category] ?? '💸';
  const hasItems = !!item.items && item.items.length > 0;
  const isSettled = !!item.settled_at;

  const handleSettle = () => {
    swipeableRef.current?.close();
    onSettle(item);
  };

  const handleDelete = () => {
    swipeableRef.current?.close();
    Alert.alert(
      '削除の確認',
      `この履歴を削除しますか？\n${item.store_name ?? item.category} ¥${formatNumberJa(item.amount)}`,
      [
        { text: 'キャンセル', style: 'cancel', onPress: () => swipeableRef.current?.close() },
        { text: '削除', style: 'destructive', onPress: () => onDelete(item.id) },
      ]
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={() => <DeleteAction onPress={handleDelete} />}
      renderLeftActions={
        item.is_advance ? () => <SettleAction settled={isSettled} onPress={handleSettle} /> : undefined
      }
      leftThreshold={40}
      overshootLeft={false}
      rightThreshold={40}
      overshootRight={false}
    >
      <Pressable onPress={onToggle} onLongPress={onLongPress} delayLongPress={400} android_ripple={{ color: '#00000010' }}>
        <View style={styles.item}>
          <View style={styles.itemIcon}>
            <Text style={styles.itemEmoji}>{emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.store_name ?? item.category}
            </Text>
            <Text style={styles.itemSub}>
              {item.category} · {PAYMENT_LABEL[item.payment_method]} · {formatDate(item.transacted_at)}
              {hasItems ? `  · 🧾${item.items!.length}` : ''}
            </Text>
            {item.is_advance && (
              <Text style={[styles.advanceBadge, isSettled && styles.advanceBadgeSettled]}>
                {isSettled ? '🤝 建て替え・返済済み' : '🤝 建て替え・未返済'}
              </Text>
            )}
          </View>
          <Text style={[styles.itemAmount, item.is_advance && !isSettled && styles.itemAmountAdvance]}>
            ¥{formatNumberJa(item.amount)}
          </Text>
        </View>
        {expanded && (
          <View style={styles.expandedSection}>
            {hasItems ? (
              item.items!.map((it) => (
                <View key={it.id} style={styles.expandedItemRow}>
                  <Text style={styles.expandedItemName} numberOfLines={1}>{it.name}</Text>
                  <Text style={styles.expandedItemPrice}>¥{formatNumberJa(it.price)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.expandedEmpty}>商品情報なし</Text>
            )}
          </View>
        )}
      </Pressable>
    </Swipeable>
  );
}

const HISTORY_CATEGORY_PALETTE = [
  '#1B7F4F', '#2F80ED', '#F2994A', '#9B51E0', '#EB5757',
  '#219653', '#F2C94C', '#56CCF2', '#BB6BD9', '#6FCF97',
];

const HistoryExpenseSummary = memo(function HistoryExpenseSummary({
  transactions,
}: {
  transactions: Transaction[] | undefined;
}) {
  const summary = useMemo(
    () => transactions === undefined ? null : buildHistoryExpenseSummary(transactions),
    [transactions]
  );

  if (summary === null) return null;

  const categories = summary.total > 0 ? summary.categories.map(({ category, amount }) => {
    const standardIndex = ALL_CATEGORIES.findIndex((name) => name === category);
    let hash = 0;
    if (standardIndex < 0) {
      for (let i = 0; i < category.length; i++) {
        hash = (hash * 31 + category.charCodeAt(i)) | 0;
      }
    }
    return {
      category,
      amount,
      percentage: (amount / summary.total) * 100,
      color: standardIndex >= 0
        ? HISTORY_CATEGORY_PALETTE[standardIndex]
        : HISTORY_CATEGORY_PALETTE[(hash >>> 0) % HISTORY_CATEGORY_PALETTE.length],
    };
  }) : [];

  return (
    <View style={styles.historySummary}>
      <Text style={styles.historySummaryTitle}>📊 月の支出合計</Text>
      <Text testID="history-summary-total" style={styles.historySummaryTotal}>¥{formatNumberJa(summary.total)}</Text>
      {categories.length === 0 ? (
        <Text style={styles.historySummaryEmpty}>カテゴリ別の支出はありません</Text>
      ) : (
        <View style={styles.historySummaryCategories}>
          <View
            style={styles.historySummaryStackedBar}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {categories.map(({ category, percentage, color }) => (
              <View
                key={category}
                style={[styles.historySummarySegment, { width: `${percentage}%`, backgroundColor: color }]}
              />
            ))}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.historySummaryLegendScroll}
            contentContainerStyle={styles.historySummaryLegend}
          >
            {categories.map(({ category, amount, percentage, color }) => (
              <View
                key={category}
                style={styles.historySummaryCategory}
                accessible
                accessibilityLabel={`${category}、${formatNumberJa(amount)}円、${percentage.toFixed(1)}パーセント`}
              >
                <View style={[styles.historySummaryCategoryDot, { backgroundColor: color }]} />
                <Text style={styles.historySummaryCategoryEmoji}>
                  {CATEGORY_EMOJI[category as keyof typeof CATEGORY_EMOJI] ?? '🏷️'}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
});

export default function HistoryScreen() {
  const { transactionsByMonth, transactionsLoading, fetchTransactions, deleteTransaction, settleAdvance } = useAppStore(
    useShallow((s) => ({
      transactionsByMonth: s.transactionsByMonth,
      transactionsLoading: s.transactionsLoading,
      fetchTransactions: s.fetchTransactions,
      deleteTransaction: s.deleteTransaction,
      settleAdvance: s.settleAdvance,
    }))
  );
  const router = useRouter();
  const currentMonth = getCurrentMonth();
  const [month, setMonth] = useState(currentMonth);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const swipeGesture = useSwipeTabNavigation();

  // 未来の月は記録が入り得ないので「次の月」は今月で止める
  const atCurrentMonth = month === currentMonth;
  // 未取得の月は undefined。取得済みで0件の場合と区別はしないが、
  // 読み込み中は空表示を出さないことで「一瞬0件」を避ける
  const monthTransactions = transactionsByMonth[month] ?? NO_TRANSACTIONS;

  const categories = useMemo(() => [
    ...ALL_CATEGORIES,
    ...Array.from(new Set(monthTransactions.map((item) => item.category)))
      .filter((category) => !ALL_CATEGORIES.includes(category)),
  ], [monthTransactions]);
  const filteredTransactions = useMemo(
    () => selectedCategory === null
      ? monthTransactions
      : monthTransactions.filter((item) => item.category === selectedCategory),
    [monthTransactions, selectedCategory]
  );
  // 表示中の月・カテゴリの未回収分を出す。store の balance は今月分
  // 固定のため、過去月を見ているときに使うと数字が合わない
  const unsettledTotal = filteredTransactions.reduce(
    (total, item) => total + (item.is_advance && !item.settled_at ? item.amount : 0),
    0
  );

  useFocusEffect(useCallback(() => { fetchTransactions(month); }, [month, fetchTransactions]));
  useRefreshOnForeground(() => fetchTransactions(month));

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
    } catch {
      Alert.alert('エラー', '削除に失敗しました。もう一度お試しください。');
    }
  };

  const handleSettle = async (item: Transaction) => {
    try {
      await settleAdvance(item.id, !item.settled_at);
    } catch {
      Alert.alert('エラー', '返済状態の更新に失敗しました。もう一度お試しください。');
    }
  };

  return (
    <View style={styles.screen}>
      {/* 行ごとの削除スワイプと競合しないよう、タブ切替スワイプはヘッダー部分のみで受け付ける */}
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.monthBar}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="前の月"
            onPress={() => setMonth((prev) => shiftMonth(prev, -1))}
            hitSlop={8}
            style={styles.monthNavButton}
          >
            <Text style={styles.monthNavLabel}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthBarText}>
            {formatMonthLabel(month)} （{filteredTransactions.length} 件）
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="次の月"
            accessibilityState={{ disabled: atCurrentMonth }}
            disabled={atCurrentMonth}
            onPress={() => setMonth((prev) => shiftMonth(prev, 1))}
            hitSlop={8}
            style={styles.monthNavButton}
          >
            <Text style={[styles.monthNavLabel, atCurrentMonth && styles.monthNavLabelDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
      </GestureDetector>

      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: ListRenderItemInfo<Transaction>) => (
          <TransactionItem
            item={item}
            expanded={expandedIds.has(item.id)}
            onToggle={() => toggleExpand(item.id)}
            onLongPress={() => router.push({ pathname: '/screens/manual-entry', params: { transactionId: item.id } })}
            onDelete={handleDelete}
            onSettle={handleSettle}
          />
        )}
        ListHeaderComponent={
          <View>
            <HistoryExpenseSummary transactions={transactionsByMonth[month]} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterBar}
              contentContainerStyle={styles.filterContent}
            >
              {[null, ...categories].map((category) => {
                const selected = selectedCategory === category;
                return (
                  <TouchableOpacity
                    key={category ?? 'all'}
                    testID={`history-category-${category ?? 'all'}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedCategory(category)}
                    style={[styles.filterChip, selected && styles.filterChipSelected]}
                  >
                    <Text numberOfLines={1} style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                      {category === null ? 'すべて' : `${CATEGORY_EMOJI[category] ?? '🏷️'} ${category}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {unsettledTotal > 0 && (
              <View style={styles.unsettledBar}>
                <Text style={styles.unsettledLabel}>🤝 未回収の建て替え</Text>
                <Text style={styles.unsettledAmount}>
                  ¥{formatNumberJa(unsettledTotal)}
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          transactionsLoading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>
                {selectedCategory === null
                  ? `${formatMonthLabel(month)}の支出記録はありません`
                  : `${formatMonthLabel(month)}の「${selectedCategory}」の記録はありません`}
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={transactionsLoading}
            onRefresh={() => fetchTransactions(month, { force: true })}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={filteredTransactions.length === 0 ? { flexGrow: 1 } : { paddingBottom: 100 }}
      />

      {/* 記録追加のボタンはタブバー中央に移した（app/(tabs)/_layout.tsx） */}
    </View>
  );
}
