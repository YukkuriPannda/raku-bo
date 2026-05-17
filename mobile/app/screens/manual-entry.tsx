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
import type { Category, PaymentMethod } from '@/types';
import { styles } from '@/styles/manual-entry.styles';
import { colors } from '@/constants/theme';

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

export default function ManualEntryScreen() {
  const router = useRouter();
  const { addTransaction, pendingImageBase64, clearPendingImage } = useAppStore();

  const [storeName, setStoreName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('食費');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState(todayString);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(!!pendingImageBase64);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  // レシート撮影からの場合、マウント時に OCR アップロードを開始
  useEffect(() => {
    if (!pendingImageBase64) return;

    let cancelled = false;

    receiptApi.upload(pendingImageBase64)
      .then((res) => {
        if (cancelled) return;
        const result = res.data.ocr_result;
        clearPendingImage();
        setStoreName(result.store_name ?? '');
        setAmount(String(result.total_amount ?? 0));
        setCategory(result.category ?? '食費');
        setPaymentMethod(result.payment_method ?? 'cash');
        if (result.date) setDate(result.date);
        setPointsEarned(result.points_earned ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[ManualEntry] OCRエラー:', err);
        clearPendingImage();
      })
      .finally(() => {
        if (!cancelled) setIsAnalyzing(false);
      });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        points_earned: pointsEarned ?? undefined,
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>支出を記録</Text>
      </View>

      {/* 解析中のローディング */}
      {isAnalyzing ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, fontSize: 14, color: colors.textSecondary }}>
            レシートを解析中...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 金額・店名・日付 */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>
              金額 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.amountRow}>
              <Text style={styles.currency}>¥</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                autoFocus={!pendingImageBase64}
              />
            </View>

            <Text style={styles.fieldLabel}>店舗名・メモ</Text>
            <TextInput
              value={storeName}
              onChangeText={setStoreName}
              style={styles.fieldInput}
              placeholder="店舗名またはメモ（任意）"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.fieldLabel}>日付</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              style={[styles.fieldInput, { marginBottom: 0 }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              keyboardType="numbers-and-punctuation"
            />
          </View>

          {/* カテゴリ選択 */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>カテゴリ</Text>

            <View style={styles.categoryGrid}>
              {TOP_CATEGORIES.map((cat) => (
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
              {OTHER_CATEGORIES.map((cat) => (
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

          {/* ポイント情報（OCR で取得できた場合のみ） */}
          {pointsEarned !== null && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#EFF6FF',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#BFDBFE',
              padding: 12,
              marginHorizontal: 16,
              marginTop: 12,
            }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>💎</Text>
              <Text style={{ fontSize: 14, color: '#1D4ED8' }}>
                {pointsEarned.toLocaleString()} ポイント獲得予定
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
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>キャンセル</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
