// ============================================================
// app/(tabs)/history.tsx
// 支出履歴画面 - FlatList でトランザクション一覧を表示
// ============================================================

import { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ListRenderItemInfo,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAppStore } from '@/store';
import { CATEGORY_EMOJI } from '@/types';
import type { Transaction } from '@/types';

// 今月の YYYY-MM 文字列を取得
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// 日付を表示用にフォーマット（MM/DD HH:mm）
function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

// 支払い方法の日本語表示
const PAYMENT_LABEL: Record<string, string> = {
  cash: '現金',
  card: 'カード',
  qr: 'QR',
};

// ============================================================
// トランザクションの行コンポーネント
// ============================================================
type TransactionItemProps = {
  item: Transaction;
};

function TransactionItem({ item }: TransactionItemProps) {
  const emoji = CATEGORY_EMOJI[item.category] ?? '💸';

  return (
    <View className="flex-row items-center bg-white px-4 py-3 border-b border-gray-100">
      {/* カテゴリ絵文字 */}
      <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
        <Text className="text-xl">{emoji}</Text>
      </View>

      {/* 店名・カテゴリ・日付 */}
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>
          {item.store_name ?? item.category}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {item.category} · {PAYMENT_LABEL[item.payment_method]} · {formatDate(item.transacted_at)}
        </Text>
      </View>

      {/* 金額 */}
      <Text className="text-base font-bold text-gray-800">
        ¥{item.amount.toLocaleString('ja-JP')}
      </Text>
    </View>
  );
}

// ============================================================
// 支出履歴画面コンポーネント
// ============================================================
export default function HistoryScreen() {
  const { transactions, isLoading, fetchTransactions } = useAppStore();
  const month = getCurrentMonth();

  // 画面フォーカス時にデータを再取得
  useFocusEffect(
    useCallback(() => {
      fetchTransactions(month);
    }, [month, fetchTransactions])
  );

  // 空状態の表示
  const renderEmpty = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Text className="text-4xl mb-4">📭</Text>
      <Text className="text-gray-400 text-base">今月の支出記録はまだありません</Text>
    </View>
  );

  // リスト区切り線
  const renderSeparator = () => (
    <View className="h-px bg-gray-100 mx-4" />
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* 月ラベル */}
      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <Text className="text-sm text-gray-500">
          {month.replace('-', '年')}月 （{transactions.length} 件）
        </Text>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: ListRenderItemInfo<Transaction>) => (
          <TransactionItem item={item} />
        )}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetchTransactions(month)}
            colors={['#22c55e']}
            tintColor="#22c55e"
          />
        }
        contentContainerStyle={
          transactions.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
        }
      />
    </View>
  );
}
