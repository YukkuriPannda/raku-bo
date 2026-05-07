// ============================================================
// app/(tabs)/index.tsx
// ホーム画面 - 「残り使える額」をメインに表示
// ============================================================

import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { useAppStore } from '@/store';

// 今月の YYYY-MM 文字列を取得
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// 金額を 3 桁カンマ区切りでフォーマット
function formatCurrency(amount: number): string {
  return `¥${Math.abs(amount).toLocaleString('ja-JP')}`;
}

// ============================================================
// ホーム画面コンポーネント
// ============================================================
export default function HomeScreen() {
  const router = useRouter();
  const {
    balance,
    isLoading,
    fetchTransactions,
    fetchPoints,
    fetchShifts,
  } = useAppStore();

  const month = getCurrentMonth();

  // データ取得（3 つを並列実行）
  const loadData = useCallback(async () => {
    await Promise.all([
      fetchTransactions(month),
      fetchPoints(),
      fetchShifts(month),
    ]);
  }, [month, fetchTransactions, fetchPoints, fetchShifts]);

  // 画面フォーカス時にデータを再取得
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const isPositive = balance.remaining >= 0;

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadData}
            colors={['#22c55e']}
            tintColor="#22c55e"
          />
        }
      >
        {/* ============================================
            メインカード - 残り使える額
            ============================================ */}
        <View className="mx-4 mt-6 bg-white rounded-2xl shadow-sm p-6 items-center">
          <Text className="text-base text-gray-500 mb-1">今月あと</Text>

          {isLoading ? (
            <ActivityIndicator size="large" color="#22c55e" className="my-4" />
          ) : (
            <Text
              className={`text-5xl font-bold mb-2 ${
                isPositive ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {isPositive ? '' : '-'}{formatCurrency(balance.remaining)}
            </Text>
          )}

          <Text className="text-base text-gray-400">使える</Text>
        </View>

        {/* ============================================
            サブ情報カード
            ============================================ */}
        <View className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* 今月支出合計 */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <Text className="text-lg mr-2">💸</Text>
              <Text className="text-base text-gray-600">今月の支出</Text>
            </View>
            <Text className="text-base font-semibold text-gray-800">
              {formatCurrency(balance.expense_total)}
            </Text>
          </View>

          {/* 月収見込み */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <Text className="text-lg mr-2">💼</Text>
              <Text className="text-base text-gray-600">月収見込み</Text>
            </View>
            <Text className="text-base font-semibold text-green-600">
              {formatCurrency(balance.income_forecast)}
            </Text>
          </View>

          {/* ポイント資産 */}
          <View className="flex-row items-center justify-between px-5 py-4">
            <View className="flex-row items-center">
              <Text className="text-lg mr-2">💎</Text>
              <Text className="text-base text-gray-600">ポイント資産</Text>
            </View>
            <Text className="text-base font-semibold text-blue-600">
              {formatCurrency(balance.points_total_yen)}
            </Text>
          </View>
        </View>

        {/* ============================================
            今月の統計
            ============================================ */}
        <View className="mx-4 mt-4">
          <Text className="text-sm text-gray-400 mb-2 px-1">
            {month.replace('-', '年')}月
          </Text>
        </View>
      </ScrollView>

      {/* ============================================
          FAB - レシート撮影ボタン（右下固定）
          ============================================ */}
      <TouchableOpacity
        onPress={() => router.push('/screens/camera')}
        className="absolute bottom-8 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-lg active:opacity-80"
        style={{
          shadowColor: '#22c55e',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Text className="text-2xl">📷</Text>
      </TouchableOpacity>
    </View>
  );
}
