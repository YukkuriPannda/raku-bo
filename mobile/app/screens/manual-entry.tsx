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
import { styles } from '@/styles/manual-entry.styles';

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
  const { addTransaction } = useAppStore();

  const [storeName, setStoreName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('食費');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState(todayString);
  const [isSaving, setIsSaving] = useState(false);

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
        <Text style={styles.headerTitle}>手動入力</Text>
      </View>

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
              autoFocus
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
    </KeyboardAvoidingView>
  );
}
