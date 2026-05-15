import { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ListRenderItemInfo,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

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

function TransactionItem({ item }: { item: Transaction }) {
  const emoji = CATEGORY_EMOJI[item.category] ?? '💸';

  return (
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
        </Text>
      </View>
      <Text style={styles.itemAmount}>
        ¥{item.amount.toLocaleString('ja-JP')}
      </Text>
    </View>
  );
}

export default function HistoryScreen() {
  const { transactions, isLoading, fetchTransactions } = useAppStore();
  const month = getCurrentMonth();

  useFocusEffect(useCallback(() => { fetchTransactions(month); }, [month, fetchTransactions]));

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
        renderItem={({ item }: ListRenderItemInfo<Transaction>) => <TransactionItem item={item} />}
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
        contentContainerStyle={transactions.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
      />
    </View>
  );
}
