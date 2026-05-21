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
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { useAppStore } from '@/store';
import { CATEGORY_EMOJI } from '@/types';
import { colors } from '@/constants/theme';
import { styles } from '@/styles/history.styles';
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

function TransactionItem({
  item,
  expanded,
  onToggle,
  onLongPress,
  onDelete,
}: {
  item: Transaction;
  expanded: boolean;
  onToggle: () => void;
  onLongPress: () => void;
  onDelete: (id: string) => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const emoji = CATEGORY_EMOJI[item.category] ?? '💸';
  const hasItems = !!item.items && item.items.length > 0;

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
          </View>
          <Text style={styles.itemAmount}>
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
  const { transactions, isLoading, fetchTransactions, deleteTransaction } = useAppStore();
  const router = useRouter();
  const month = getCurrentMonth();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [fabOpen, setFabOpen] = useState(false);

  useFocusEffect(useCallback(() => { fetchTransactions(month); }, [month, fetchTransactions]));

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

  return (
    <View style={styles.screen}>
      <View style={styles.monthBar}>
        <Text style={styles.monthBarText}>
          {month.replace('-', '年')}月 （{transactions.length} 件）
        </Text>
      </View>

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
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>今月の支出記録はまだありません</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetchTransactions(month)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={transactions.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
      />

      {fabOpen && (
        <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} onPress={() => setFabOpen(false)} />
      )}

      <View style={styles.fabContainer}>
        {fabOpen && (
          <>
            <View style={styles.fabRow}>
              <View style={styles.fabLabel}>
                <Text style={styles.fabLabelText}>レシート撮影</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setFabOpen(false); router.push('/screens/camera'); }}
                style={styles.fabPrimary}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 20 }}>📷</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fabRow}>
              <View style={styles.fabLabel}>
                <Text style={styles.fabLabelText}>手動入力</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setFabOpen(false); router.push('/screens/manual-entry'); }}
                style={styles.fabSecondary}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 20 }}>✏️</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <TouchableOpacity
          onPress={() => setFabOpen((o) => !o)}
          style={styles.fabMain}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 24 }}>{fabOpen ? '✕' : '➕'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
