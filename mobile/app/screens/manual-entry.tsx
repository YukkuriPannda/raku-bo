import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

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
  const { addTransaction, updateTransaction, transactions, pendingImageBase64, clearPendingImage } = useAppStore();
  const { transactionId } = useLocalSearchParams<{ transactionId?: string }>();
  const isEditing = !!transactionId;

  const [storeName, setStoreName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('食費');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryText, setNewCategoryText] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isAdvance, setIsAdvance] = useState(false);
  const [date, setDate] = useState(todayString);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(!!pendingImageBase64);
  const [items, setItems] = useState<{ name: string; price: string }[]>([]);
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: isScrolled ? 1 : 0,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  }, [isScrolled, fabAnim]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // 編集モード時: store のデータでフォームを初期化
  useEffect(() => {
    if (!isEditing) return;
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) return;
    setStoreName(tx.store_name ?? '');
    setAmount(String(tx.amount));
    setCategory(tx.category);
    setPaymentMethod(tx.payment_method);
    setIsAdvance(tx.is_advance);
    setDate(tx.transacted_at.split('T')[0]);
    if (tx.items && tx.items.length > 0) {
      setItems(tx.items.map((it) => ({ name: it.name, price: String(it.price) })));
      setIsAmountManuallyEdited(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // items の合計を金額欄に自動反映（手動編集後は同期しない）
  useEffect(() => {
    if (isAmountManuallyEdited || items.length === 0) return;
    const total = items.reduce((sum, it) => {
      const p = parseInt(it.price, 10);
      return sum + (isNaN(p) ? 0 : p);
    }, 0);
    setAmount(String(total));
  }, [items, isAmountManuallyEdited]);

  // レシート撮影からの場合、マウント時に OCR アップロードを開始
  useEffect(() => {
    if (!pendingImageBase64 || isEditing) return;

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
        if (Array.isArray(result.items)) {
          setItems(result.items.map((it: { name: string; price: number }) => ({
            name: it.name ?? '',
            price: String(it.price ?? ''),
          })));
        }
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

  const handleAddCategory = () => {
    const name = newCategoryText.trim();
    if (!name || customCategories.includes(name) || ALL_CATEGORIES.includes(name as Category)) return;
    setCustomCategories(prev => [...prev, name]);
    setCategory(name);
    setNewCategoryText('');
  };

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
      const validCategory = ALL_CATEGORIES.includes(category as Category)
        ? category as Category
        : 'その他' as Category;
      const validItems = items
        .map(it => ({ name: it.name.trim(), price: parseInt(it.price, 10) }))
        .filter(it => it.name && !isNaN(it.price) && it.price > 0);

      if (isEditing) {
        await updateTransaction(transactionId!, {
          amount: parsedAmount,
          category: validCategory,
          payment_method: paymentMethod,
          store_name: storeName.trim() || undefined,
          transacted_at: dateObj.toISOString(),
          is_advance: isAdvance,
          items: validItems.length > 0 ? validItems : undefined,
        });
        router.back();
      } else {
        await addTransaction({
          type: 'cash',
          amount: parsedAmount,
          category: validCategory,
          payment_method: paymentMethod,
          store_name: storeName.trim() || undefined,
          transacted_at: dateObj.toISOString(),
          is_advance: isAdvance,
          items: validItems.length > 0 ? validItems : undefined,
        });
        router.replace('/(tabs)');
      }
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
        <Text style={styles.headerTitle}>{isEditing ? '支出を編集' : '支出を記録'}</Text>
        {!isScrolled && !isAnalyzing && (
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
            style={[styles.headerSaveBtn, isSaving && styles.saveButtonDisabled]}
          >
            {isSaving
              ? <ActivityIndicator color="#ffffff" size="small" />
              : <Text style={styles.headerSaveBtnText}>{isEditing ? '保存' : '記録する'}</Text>
            }
          </TouchableOpacity>
        )}
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
        <>
        <ScrollView
          contentContainerStyle={{ paddingBottom: (isScrolled ? 100 : 32) + keyboardHeight }}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => setIsScrolled(e.nativeEvent.contentOffset.y > 30)}
          scrollEventThrottle={32}
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
                onChangeText={(v) => { setIsAmountManuallyEdited(true); setAmount(v); }}
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
              {customCategories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.7}
                  style={[styles.chip, category === cat && styles.chipActive]}
                >
                  <Text style={styles.chipEmoji}>🏷️</Text>
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.addCategoryRow}>
              <TextInput
                value={newCategoryText}
                onChangeText={setNewCategoryText}
                placeholder="カテゴリを追加"
                placeholderTextColor="#9CA3AF"
                style={styles.addCategoryInput}
                onSubmitEditing={handleAddCategory}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={handleAddCategory}
                activeOpacity={0.8}
                style={styles.addCategoryBtn}
              >
                <Text style={styles.addCategoryBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 商品 */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>商品（任意）</Text>
            {items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <TextInput
                  value={item.name}
                  onChangeText={(v) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, name: v } : it))}
                  placeholder="商品名"
                  placeholderTextColor="#9CA3AF"
                  style={styles.itemNameInput}
                />
                <TextInput
                  value={item.price}
                  onChangeText={(v) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, price: v } : it))}
                  placeholder="価格"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  style={styles.itemPriceInput}
                />
                <TouchableOpacity
                  onPress={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                  activeOpacity={0.7}
                  style={styles.itemDeleteBtn}
                >
                  <Text style={styles.itemDeleteBtnText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => setItems(prev => [...prev, { name: '', price: '' }])}
              activeOpacity={0.8}
              style={styles.addItemBtn}
            >
              <Text style={styles.addItemBtnText}>+ 商品を追加</Text>
            </TouchableOpacity>
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

          {/* 建て替え（他人の分を立て替えた支出） */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>区分</Text>
            <TouchableOpacity
              onPress={() => setIsAdvance((v) => !v)}
              activeOpacity={0.7}
              style={[styles.advanceBtn, isAdvance && styles.advanceBtnActive]}
            >
              <Text style={[styles.advanceText, isAdvance && styles.advanceTextActive]}>
                {isAdvance ? '🤝 建て替え' : '建て替えにする'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.advanceHint}>
              {isAdvance
                ? '自分の支出には含めません。履歴から「返済済み」にできます。'
                : '他の人の分を立て替えたときにON。今月の支出と残額から除外されます。'}
            </Text>
          </View>

        </ScrollView>

        <Animated.View
          pointerEvents={isScrolled ? 'auto' : 'none'}
          style={[
            styles.fab,
            {
              opacity: fabAnim,
              transform: [
                { scale: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
            style={[styles.fabBtn, isSaving && styles.saveButtonDisabled]}
          >
            {isSaving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.fabBtnText}>{isEditing ? '保存' : '記録する'}</Text>
            }
          </TouchableOpacity>
        </Animated.View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
