// ============================================================
// app/screens/confirm.tsx
// OCR 確認画面モーダル
// - OCR 結果の確認・修正 UI
// - カテゴリ選択（大きいボタン、上位 4 件表示）
// - 支払い方法切り替え（現金/カード/QR）
// - 店名・金額の確認表示
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

// ============================================================
// OCR 確認画面コンポーネント
// ============================================================
export default function ConfirmScreen() {
  const router = useRouter();
  const { ocrResult, addTransaction, clearOcrResult } = useAppStore();

  // OCR 結果がない場合（直接遷移されるケース）
  if (!ocrResult) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-400">データがありません</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-primary rounded-lg px-6 py-3"
        >
          <Text className="text-white font-semibold">戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ============================================================
  // 編集可能な状態（OCR 結果を初期値として使用）
  // ============================================================
  const [storeName, setStoreName] = useState(ocrResult.store_name);
  const [amount, setAmount] = useState(String(ocrResult.total_amount));
  const [category, setCategory] = useState<Category>(ocrResult.category);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    ocrResult.payment_method
  );
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

    setIsSaving(true);
    try {
      await addTransaction({
        type: 'cash',
        amount: parsedAmount,
        category,
        payment_method: paymentMethod,
        store_name: storeName || undefined,
        points_earned: ocrResult.points_earned ?? undefined,
        transacted_at: ocrResult.date || new Date().toISOString(),
      });

      // 中間状態をクリア
      clearOcrResult();

      // ホーム画面に戻る
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[Confirm] 保存エラー:', error);
      Alert.alert('エラー', '保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================
  // OCR で検出した上位 4 カテゴリ（元の category を先頭に）
  // ============================================================
  const topCategories: Category[] = [
    ocrResult.category,
    ...ALL_CATEGORIES.filter((c) => c !== ocrResult.category),
  ].slice(0, 4);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ============================================================
            店名・金額
            ============================================================ */}
        <View className="mx-4 mt-4 bg-white rounded-2xl shadow-sm p-5">
          <Text className="text-xs text-gray-400 mb-1">店名</Text>
          <TextInput
            value={storeName}
            onChangeText={setStoreName}
            className="text-base text-gray-800 border-b border-gray-200 pb-2 mb-4"
            placeholder="店名を入力"
          />

          <Text className="text-xs text-gray-400 mb-1">金額</Text>
          <View className="flex-row items-center border-b border-gray-200 pb-2">
            <Text className="text-lg text-gray-600 mr-1">¥</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              className="text-2xl font-bold text-gray-800 flex-1"
              placeholder="0"
            />
          </View>
        </View>

        {/* ============================================================
            カテゴリ選択（上位 4 件を大きいボタンで表示）
            ============================================================ */}
        <View className="mx-4 mt-4 bg-white rounded-2xl shadow-sm p-4">
          <Text className="text-sm font-semibold text-gray-700 mb-3">カテゴリ</Text>

          {/* 上位 4 カテゴリ（大きいボタン、64dp 以上） */}
          <View className="flex-row flex-wrap gap-2 mb-3">
            {topCategories.map((cat) => (
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
            {ALL_CATEGORIES.filter((c) => !topCategories.includes(c)).map((cat) => (
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
            支払い方法（3 ボタン）
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

        {/* ポイント情報（OCR で取得できた場合） */}
        {ocrResult.points_earned !== null && (
          <View className="mx-4 mt-4 bg-blue-50 rounded-2xl p-4 flex-row items-center">
            <Text className="text-lg mr-2">💎</Text>
            <Text className="text-sm text-blue-700">
              {ocrResult.points_earned.toLocaleString()} ポイント獲得予定
            </Text>
          </View>
        )}

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

          {/* キャンセル */}
          <TouchableOpacity
            onPress={() => {
              clearOcrResult();
              router.replace('/(tabs)');
            }}
            className="mt-3 py-3 items-center active:opacity-70"
          >
            <Text className="text-gray-400 text-sm">キャンセル</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
