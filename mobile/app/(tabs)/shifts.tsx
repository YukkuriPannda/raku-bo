// ============================================================
// app/(tabs)/shifts.tsx
// シフト・収入見込み画面
// - 月収見込み額の表示
// - シフト一覧（日付・時間・見込み給料）
// - 時給設定入力フィールド
// ============================================================

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ListRenderItemInfo,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAppStore } from '@/store';
import type { ShiftEvent } from '@/types';

// 今月の YYYY-MM 文字列を取得
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// 日時を表示用にフォーマット
function formatShiftDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

// ============================================================
// シフト行コンポーネント
// ============================================================
type ShiftItemProps = {
  item: ShiftEvent;
};

function ShiftItem({ item }: ShiftItemProps) {
  return (
    <View className="bg-white mx-4 mb-2 rounded-xl px-4 py-3 shadow-sm">
      {/* シフトタイトル */}
      <Text className="text-sm font-semibold text-gray-800 mb-1" numberOfLines={1}>
        {item.title}
      </Text>

      {/* 時間帯 */}
      <View className="flex-row items-center mb-1">
        <Text className="text-xs text-gray-400">
          📅 {formatShiftDate(item.start)} 〜 {formatShiftDate(item.end)}
        </Text>
      </View>

      {/* 勤務時間・見込み給料 */}
      <View className="flex-row justify-between items-center">
        <Text className="text-xs text-gray-500">
          ⏱ {item.duration_hours.toFixed(1)} 時間
        </Text>
        <Text className="text-base font-bold text-green-600">
          ¥{item.estimated_wage.toLocaleString('ja-JP')}
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// シフト画面コンポーネント
// ============================================================
export default function ShiftsScreen() {
  const { shifts, balance, hourlyWage, isLoading, fetchShifts, setHourlyWage } =
    useAppStore();
  const month = getCurrentMonth();

  // 時給入力の一時状態
  const [wageInput, setWageInput] = useState(String(hourlyWage));

  // 画面フォーカス時にデータを再取得
  useFocusEffect(
    useCallback(() => {
      fetchShifts(month);
      setWageInput(String(hourlyWage));
    }, [month, fetchShifts, hourlyWage])
  );

  // 時給を保存
  const handleSaveWage = () => {
    const parsed = parseInt(wageInput, 10);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('入力エラー', '正しい時給を入力してください');
      return;
    }
    setHourlyWage(parsed);
    Alert.alert('保存しました', `時給を ¥${parsed.toLocaleString()} に設定しました`);
  };

  // ヘッダーコンポーネント
  const ListHeader = () => (
    <View>
      {/* 月収見込みカード */}
      <View className="mx-4 mt-4 mb-4 bg-white rounded-2xl shadow-sm p-5 items-center">
        <Text className="text-sm text-gray-500 mb-1">今月の月収見込み</Text>
        <Text className="text-4xl font-bold text-green-500">
          ¥{balance.income_forecast.toLocaleString('ja-JP')}
        </Text>
        <Text className="text-xs text-gray-400 mt-2">
          シフト {shifts.length} 件 · 合計 {shifts.reduce((s, i) => s + i.duration_hours, 0).toFixed(1)} 時間
        </Text>
      </View>

      {/* 時給設定 */}
      <View className="mx-4 mb-4 bg-white rounded-2xl shadow-sm p-4">
        <Text className="text-sm font-semibold text-gray-700 mb-3">時給設定</Text>
        <View className="flex-row items-center">
          <Text className="text-base text-gray-600 mr-2">¥</Text>
          <TextInput
            value={wageInput}
            onChangeText={setWageInput}
            keyboardType="number-pad"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-base text-gray-800"
            placeholder="1000"
            returnKeyType="done"
            onSubmitEditing={handleSaveWage}
          />
          <TouchableOpacity
            onPress={handleSaveWage}
            className="ml-3 bg-primary px-4 py-2 rounded-lg active:opacity-70"
          >
            <Text className="text-white font-semibold text-sm">保存</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* セクションラベル */}
      <Text className="text-sm text-gray-400 mx-5 mb-2">
        シフト一覧 ({shifts.length} 件)
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={shifts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: ListRenderItemInfo<ShiftEvent>) => (
          <ShiftItem item={item} />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-4xl mb-3">📅</Text>
            <Text className="text-gray-400">今月のシフトはありません</Text>
            <Text className="text-xs text-gray-300 mt-1">
              Google カレンダーのシフトを読み込みます
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetchShifts(month)}
            colors={['#22c55e']}
            tintColor="#22c55e"
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </KeyboardAvoidingView>
  );
}
