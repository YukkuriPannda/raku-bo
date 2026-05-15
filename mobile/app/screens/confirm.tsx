import { useState, useEffect } from 'react';
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
import { receiptApi } from '@/lib/api';
import { CATEGORY_EMOJI, ALL_CATEGORIES } from '@/types';
import type { Category, PaymentMethod, OcrResult } from '@/types';
import { styles } from '@/styles/confirm.styles';
import { colors } from '@/constants/theme';

const PAYMENT_OPTIONS: { label: string; value: PaymentMethod }[] = [
  { label: '💵 現金', value: 'cash' },
  { label: '💳 カード', value: 'card' },
  { label: '📱 QR', value: 'qr' },
];

export default function ConfirmScreen() {
  const router = useRouter();
  const {
    ocrResult,
    pendingImageBase64,
    setOcrResult,
    clearOcrResult,
    clearPendingImage,
    addTransaction,
  } = useAppStore();

  // フォームの状態（OCR完了後に更新される）
  const [storeName, setStoreName] = useState(ocrResult?.store_name ?? '');
  const [amount, setAmount] = useState(String(ocrResult?.total_amount ?? 0));
  const [category, setCategory] = useState<Category>(ocrResult?.category ?? 'その他');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(ocrResult?.payment_method ?? 'cash');
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(!!pendingImageBase64);

  // 撮影画像がある場合、マウント時にアップロード開始
  useEffect(() => {
    if (!pendingImageBase64) return;

    let cancelled = false;

    receiptApi.upload(pendingImageBase64)
      .then((res) => {
        if (cancelled) return;
        const result: OcrResult = res.data.ocr_result;
        setOcrResult(result);
        clearPendingImage();
        // OCR結果でフォームを更新
        setStoreName(result.store_name ?? '');
        setAmount(String(result.total_amount ?? 0));
        setCategory(result.category ?? 'その他');
        setPaymentMethod(result.payment_method ?? 'cash');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[Confirm] アップロードエラー:', err);
        clearPendingImage();
        // フォールバック: 空のデータで継続
        const fallback: OcrResult = {
          store_name: '',
          date: new Date().toISOString().split('T')[0],
          items: [],
          total_amount: 0,
          category: 'その他',
          payment_method: 'cash',
          points_earned: null,
        };
        setOcrResult(fallback);
      })
      .finally(() => {
        if (!cancelled) setIsAnalyzing(false);
      });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 解析中のローディング画面
  if (isAnalyzing) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.emptyText, { marginTop: 16 }]}>レシートを解析中...</Text>
      </View>
    );
  }

  // データなし（通常は発生しない）
  if (!ocrResult) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>データがありません</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.emptyBackButton}>
          <Text style={styles.emptyBackButtonText}>戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const topCategories: Category[] = [
    ocrResult.category,
    ...ALL_CATEGORIES.filter((c) => c !== ocrResult.category),
  ].slice(0, 4);

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
      clearOcrResult();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[Confirm] 保存エラー:', error);
      Alert.alert('エラー', '保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 店名・金額 */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>店名</Text>
          <TextInput
            value={storeName}
            onChangeText={setStoreName}
            style={styles.fieldInput}
            placeholder="店名を入力"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.fieldLabel}>金額</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>¥</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* カテゴリ選択 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>カテゴリ</Text>

          <View style={styles.categoryGrid}>
            {topCategories.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                activeOpacity={0.7}
                style={[styles.categoryBtn, category === cat && styles.categoryBtnActive]}
              >
                <Text style={styles.categoryEmoji}>{CATEGORY_EMOJI[cat]}</Text>
                <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.otherLabel}>その他</Text>
          <View style={styles.chipRow}>
            {ALL_CATEGORIES.filter((c) => !topCategories.includes(c)).map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                activeOpacity={0.7}
                style={[styles.chip, category === cat && styles.chipActive]}
              >
                <Text style={styles.chipEmoji}>{CATEGORY_EMOJI[cat]}</Text>
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 支払い方法 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>支払い方法</Text>
          <View style={styles.paymentRow}>
            {PAYMENT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setPaymentMethod(opt.value)}
                activeOpacity={0.7}
                style={[styles.paymentBtn, paymentMethod === opt.value && styles.paymentBtnActive]}
              >
                <Text style={[styles.paymentText, paymentMethod === opt.value && styles.paymentTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ポイント情報 */}
        {ocrResult.points_earned !== null && (
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsEmoji}>💎</Text>
            <Text style={styles.pointsText}>
              {ocrResult.points_earned.toLocaleString()} ポイント獲得予定
            </Text>
          </View>
        )}

        {/* 記録ボタン */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>記録する</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { clearOcrResult(); router.replace('/(tabs)'); }}
          activeOpacity={0.7}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>キャンセル</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
