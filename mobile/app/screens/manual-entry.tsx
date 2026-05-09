// ============================================================
// app/screens/manual-entry.tsx
// 手動入力画面
// - 金額・カテゴリ・支払方法・日付・メモを手入力
// - 「記録する」ボタンで DB 保存 → ホームに戻る
// ============================================================

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useAppStore } from '@/store';
import { CATEGORY_EMOJI, ALL_CATEGORIES } from '@/types';
import type { Category, PaymentMethod } from '@/types';

// ============================================================
// 支払い方法ラベル
// ============================================================
const PAYMENT_OPTIONS: { label: string; value: PaymentMethod }[] = [
  { label: '💵 現金', value: 'cash' },
  { label: '💳 カード', value: 'card' },
  { label: '📱 QR', value: 'qr' },
];

const TOP_CATEGORIES: Category[] = ALL_CATEGORIES.slice(0, 4);
const OTHER_CATEGORIES: Category[] = ALL_CATEGORIES.slice(4);

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================
// 手動入力画面コンポーネント
// ============================================================
export default function ManualEntryScreen() {
  const router = useRouter();
  const { addTransaction } = useAppStore();

  const [storeName, setStoreName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('食費');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState(todayString);
  const [isSaving, setIsSaving] = useState(false);

  // ============================================================
  // 記録ボタン処理
  // ============================================================
  const handleSave = async () => {
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('入力エラー', '金額を正しく入力してください');
      return;
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      Alert.alert('入力エラー', '日付を YYYY-MM-DD 形式で入力してください');
      return;
    }

    setIsSaving(true);
    try {
      await addTransaction({
        type: 'cash',
        amount: parsedAmount,
        category,
        payment_method: paymentMethod,
        store_name: storeName.trim() || undefined,
        transacted_at: dateObj.toISOString(),
      });

      router.replace('/(tabs)');
    } catch (error) {
      console.error('[ManualEntry] 保存エラー:', error);
      Alert.alert('エラー', '保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ヘッダー */}
      <View className="flex-row items-center px-4 pt-12 pb-4 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center rounded-full bg-gray-100 mr-3 active:opacity-70"
        >
          <Text className="text-gray-600 text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">手動入力</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ============================================================
            金額・店名・日付
            ============================================================ */}
        <View className="mx-4 mt-4 bg-white rounded-2xl shadow-sm p-5">
          {/* 金額 */}
          <Text className="text-xs text-gray-400 mb-1">
            金額 <Text className="text-red-400">*</Text>
          </Text>
          <View className="flex-row items-center border-b border-gray-200 pb-2 mb-4">
            <Text className="text-lg text-gray-600 mr-1">¥</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              className="text-2xl font-bold text-gray-800 flex-1"
              placeholder="0"
              autoFocus
            />
          </View>

          {/* 店名・メモ */}
          <Text className="text-xs text-gray-400 mb-1">店舗名・メモ</Text>
          <TextInput
            value={storeName}
            onChangeText={setStoreName}
            className="text-base text-gray-800 border-b border-gray-200 pb-2 mb-4"
            placeholder="店舗名またはメモ（任意）"
          />

          {/* 日付 */}
          <Text className="text-xs text-gray-400 mb-1">日付</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            className="text-base text-gray-800 border-b border-gray-200 pb-2"
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
          />
        </View>

        {/* ============================================================
            カテゴリ選択
            ============================================================ */}
        <View className="mx-4 mt-4 bg-white rounded-2xl shadow-sm p-4">
          <Text className="text-sm font-semibold text-gray-700 mb-3">カテゴリ</Text>

          {/* 上位 4 カテゴリ（大きいボタン） */}
          <View className="flex-row flex-wrap gap-2 mb-3">
            {TOP_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                style={{ minHeight: 64 }}
                className={`flex-1 min-w-[44%] items-center justify-center rounded-xl border-2 py-3 px-2 active:opacity-70 ${
                  category === cat
                    ? 'border-primary bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <Text className="text-2xl mb-1">{CATEGORY_EMOJI[cat]}</Text>
                <Text
                  className={`text-xs font-semibold ${
                    category === cat ? 'text-green-700' : 'text-gray-600'
                  }`}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* その他のカテゴリ（コンパクトリスト） */}
          <Text className="text-xs text-gray-400 mb-2">その他</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {OTHER_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                className={`flex-row items-center px-3 py-1.5 rounded-full border active:opacity-70 ${
                  category === cat
                    ? 'border-primary bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <Text className="text-sm mr-1">{CATEGORY_EMOJI[cat]}</Text>
                <Text
                  className={`text-xs ${
                    category === cat ? 'text-green-700 font-semibold' : 'text-gray-600'
                  }`}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ============================================================
            支払い方法
            ============================================================ */}
        <View className="mx-4 mt-4 bg-white rounded-2xl shadow-sm p-4">
          <Text className="text-sm font-semibold text-gray-700 mb-3">支払い方法</Text>

          <View className="flex-row gap-2">
            {PAYMENT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setPaymentMethod(opt.value)}
                className={`flex-1 items-center py-3 rounded-xl border-2 active:opacity-70 ${
                  paymentMethod === opt.value
                    ? 'border-primary bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    paymentMethod === opt.value ? 'text-green-700' : 'text-gray-600'
                  }`}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ============================================================
            記録ボタン
            ============================================================ */}
        <View className="mx-4 mt-6">
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className="bg-primary rounded-2xl py-4 items-center shadow-sm active:opacity-80"
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-base font-bold">記録する</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-3 py-3 items-center active:opacity-70"
          >
            <Text className="text-gray-400 text-sm">キャンセル</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
