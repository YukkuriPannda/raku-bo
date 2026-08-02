import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
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
import { CATEGORY_EMOJI } from '@/types';
import { colors } from '@/constants/theme';
import { styles } from '@/styles/history.styles';
import { useSwipeTabNavigation } from '@/hooks/useSwipeTabNavigation';
import { useRefreshOnForeground } from '@/hooks/useRefreshOnForeground';
import type { Transaction } from '@/types';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

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
      `この履歴を削除しますか？\n${item.store_name ?? item.category} ¥${item.amount.toLocaleString('ja-JP')}`,
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
            ¥{item.amount.toLocaleString('ja-JP')}
          </Text>
        </View>
        {expanded && (
          <View style={styles.expandedSection}>
            {hasItems ? (
              item.items!.map((it) => (
                <View key={it.id} style={styles.expandedItemRow}>
                  <Text style={styles.expandedItemName} numberOfLines={1}>{it.name}</Text>
                  <Text style={styles.expandedItemPrice}>¥{it.price.toLocaleString('ja-JP')}</Text>
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

export default function HistoryScreen() {
  const { transactions, balance, transactionsLoading, fetchTransactions, deleteTransaction, settleAdvance } = useAppStore();
  const router = useRouter();
  const month = getCurrentMonth();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const swipeGesture = useSwipeTabNavigation();

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
          <Text style={styles.monthBarText}>
            {month.replace('-', '年')}月 （{transactions.length} 件）
          </Text>
        </View>
      </GestureDetector>

      <FlatList
        data={transactions}
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
          balance.advance_unsettled_total > 0 ? (
            <View style={styles.unsettledBar}>
              <Text style={styles.unsettledLabel}>🤝 未回収の建て替え</Text>
              <Text style={styles.unsettledAmount}>
                ¥{balance.advance_unsettled_total.toLocaleString('ja-JP')}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>今月の支出記録はまだありません</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={transactionsLoading}
            onRefresh={() => fetchTransactions(month, { force: true })}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={transactions.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
      />

      {/* 記録追加のボタンはタブバー中央に移した（app/(tabs)/_layout.tsx） */}
    </View>
  );
}
