import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  ListRenderItemInfo,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';

import { useAppStore } from '@/store';
import { colors } from '@/constants/theme';
import { styles } from '@/styles/planned-expenditures.styles';
import { useSwipeTabNavigation } from '@/hooks/useSwipeTabNavigation';
import { ALL_CATEGORIES, CATEGORY_EMOJI } from '@/types';
import type { PlannedExpenditure, Category, PaymentMethod, BillingCycle, CalendarEvent } from '@/types';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: '現金',
  card: 'カード',
  qr: 'QR',
};

function PlannedItem({
  item,
  onEdit,
  onToggle,
  onDelete,
  onComplete,
}: {
  item: PlannedExpenditure;
  onEdit: (item: PlannedExpenditure) => void;
  onToggle: (item: PlannedExpenditure) => void;
  onDelete: (id: string, name: string) => void;
  onComplete: (item: PlannedExpenditure) => void;
}) {
  const isSubscription = item.entry_type === 'subscription';
  const icon = isSubscription ? '🔄' : '📅';
  const name = isSubscription ? item.service_name : item.calendar_event_title;
  const sub = isSubscription
    ? item.billing_cycle === 'monthly'
      ? `毎月 ${item.billing_day} 日`
      : `毎年 ${item.billing_month} 月 ${item.billing_day} 日`
    : item.event_date
      ? `${item.event_date.slice(5).replace('-', '/')}`
      : '';

  return (
    <View style={[styles.itemCard, !item.is_active && styles.itemCardInactive]}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemIcon}>{icon}</Text>
        <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
        <View style={styles.plannedBadge}>
          <Text style={styles.plannedBadgeText}>予定</Text>
        </View>
      </View>
      <Text style={styles.itemSub}>
        {CATEGORY_EMOJI[item.category]} {item.category} · {PAYMENT_LABELS[item.payment_method]} · {sub}
      </Text>
      {item.memo ? <Text style={styles.itemSub}>{item.memo}</Text> : null}
      <View style={styles.itemFooter}>
        <Text style={styles.itemAmount}>¥{item.amount.toLocaleString('ja-JP')}</Text>
        <View style={styles.itemButtons}>
          {isSubscription && (
            <>
              <TouchableOpacity onPress={() => onToggle(item)} style={styles.toggleBtn} activeOpacity={0.7}>
                <Text style={styles.toggleBtnText}>{item.is_active ? '停止' : '再開'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onEdit(item)} style={styles.editBtn} activeOpacity={0.7}>
                <Text style={styles.editBtnText}>編集</Text>
              </TouchableOpacity>
            </>
          )}
          {!isSubscription && (
            <TouchableOpacity onPress={() => onComplete(item)} style={styles.completeBtn} activeOpacity={0.7}>
              <Text style={styles.completeBtnText}>完了</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onDelete(item.id, name ?? '')} style={styles.deleteBtn} activeOpacity={0.7}>
            <Text style={styles.deleteBtnText}>削除</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function CategorySelector({
  value,
  onChange,
}: {
  value: Category;
  onChange: (v: Category) => void;
}) {
  return (
    <View style={styles.selectorRow}>
      {ALL_CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat}
          style={[styles.selectorChip, value === cat && styles.selectorChipActive]}
          onPress={() => onChange(cat)}
          activeOpacity={0.7}
        >
          <Text style={[styles.selectorChipText, value === cat && styles.selectorChipTextActive]}>
            {CATEGORY_EMOJI[cat]} {cat}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PaymentSelector({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
}) {
  const methods: { key: PaymentMethod; label: string }[] = [
    { key: 'cash', label: '💴 現金' },
    { key: 'card', label: '💳 カード' },
    { key: 'qr', label: '📱 QR' },
  ];
  return (
    <View style={styles.selectorRow}>
      {methods.map((m) => (
        <TouchableOpacity
          key={m.key}
          style={[styles.selectorChip, value === m.key && styles.selectorChipActive]}
          onPress={() => onChange(m.key)}
          activeOpacity={0.7}
        >
          <Text style={[styles.selectorChipText, value === m.key && styles.selectorChipTextActive]}>
            {m.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// サブスク追加フォーム
function SubscriptionForm({ onAdd }: { onAdd: () => void }) {
  const { addPlannedExpenditure } = useAppStore();
  const [serviceName, setServiceName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('その他');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [billingDay, setBillingDay] = useState('');
  const [billingMonth, setBillingMonth] = useState('');
  const [memo, setMemo] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const name = serviceName.trim();
    const amt = parseInt(amount, 10);
    const day = parseInt(billingDay, 10);

    if (!name) { Alert.alert('入力エラー', 'サービス名を入力してください'); return; }
    if (isNaN(amt) || amt <= 0) { Alert.alert('入力エラー', '金額を正しく入力してください'); return; }
    if (isNaN(day) || day < 1 || day > 31) { Alert.alert('入力エラー', '課金日は1〜31で入力してください'); return; }
    if (billingCycle === 'yearly') {
      const mo = parseInt(billingMonth, 10);
      if (isNaN(mo) || mo < 1 || mo > 12) { Alert.alert('入力エラー', '課金月は1〜12で入力してください'); return; }
    }

    setIsAdding(true);
    try {
      await addPlannedExpenditure({
        entry_type: 'subscription',
        service_name: name,
        amount: amt,
        category,
        payment_method: paymentMethod,
        billing_cycle: billingCycle,
        billing_day: day,
        billing_month: billingCycle === 'yearly' ? parseInt(billingMonth, 10) : undefined,
        memo: memo.trim() || undefined,
      });
      setServiceName(''); setAmount(''); setBillingDay(''); setBillingMonth(''); setMemo('');
      onAdd();
    } catch {
      Alert.alert('エラー', 'サブスクの追加に失敗しました');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <View style={styles.addCard}>
      <Text style={styles.addTitle}>🔄 サブスク（定期）を追加</Text>
      <TextInput
        value={serviceName}
        onChangeText={setServiceName}
        placeholder="サービス名（例: Netflix）"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="金額"
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        style={styles.input}
      />
      <Text style={styles.eventPickerLabel}>カテゴリ</Text>
      <CategorySelector value={category} onChange={setCategory} />
      <Text style={styles.eventPickerLabel}>支払い方法</Text>
      <PaymentSelector value={paymentMethod} onChange={setPaymentMethod} />
      <Text style={styles.eventPickerLabel}>請求サイクル</Text>
      <View style={styles.cycleToggle}>
        {(['monthly', 'yearly'] as BillingCycle[]).map((cycle) => (
          <TouchableOpacity
            key={cycle}
            style={[styles.cycleToggleItem, billingCycle === cycle && styles.cycleToggleActive]}
            onPress={() => setBillingCycle(cycle)}
            activeOpacity={0.7}
          >
            <Text style={[styles.cycleToggleText, billingCycle === cycle && styles.cycleToggleTextActive]}>
              {cycle === 'monthly' ? '毎月' : '毎年'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.inputRow}>
        {billingCycle === 'yearly' && (
          <TextInput
            value={billingMonth}
            onChangeText={setBillingMonth}
            placeholder="課金月 (1-12)"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            style={styles.inputHalf}
          />
        )}
        <TextInput
          value={billingDay}
          onChangeText={setBillingDay}
          placeholder="課金日 (1-31)"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          style={billingCycle === 'yearly' ? styles.inputHalf : styles.input}
        />
      </View>
      <TextInput
        value={memo}
        onChangeText={setMemo}
        placeholder="メモ（任意）"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />
      <TouchableOpacity onPress={handleAdd} disabled={isAdding} style={styles.addBtn} activeOpacity={0.8}>
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
          {isAdding ? '追加中...' : '+ 追加する'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function addMonths(base: string, delta: number): string {
  const [y, m] = base.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${parseInt(m, 10)}月`;
}

// カレンダー連動追加フォーム
function CalendarForm({ month, onAdd }: { month: string; onAdd: () => void }) {
  const { addPlannedExpenditure, fetchCalendarEvents, calendarEvents } = useAppStore();
  const today = new Date().toISOString().slice(0, 10);
  const futureEvents = calendarEvents.filter((ev) => ev.date >= today);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('その他');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [memo, setMemo] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  const loadEvents = useCallback(async () => {
    setEventsLoaded(false);
    await fetchCalendarEvents(month);
    setEventsLoaded(true);
  }, [fetchCalendarEvents, month]);

  useFocusEffect(useCallback(() => { loadEvents(); }, [loadEvents]));

  useEffect(() => { setSelectedEvent(null); }, [month]);

  const handleAdd = async () => {
    if (!selectedEvent) { Alert.alert('選択エラー', 'カレンダーイベントを選択してください'); return; }
    const amt = parseInt(amount, 10);
    if (isNaN(amt) || amt <= 0) { Alert.alert('入力エラー', '金額を正しく入力してください'); return; }

    setIsAdding(true);
    try {
      await addPlannedExpenditure({
        entry_type: 'calendar',
        calendar_event_id: selectedEvent.id,
        calendar_event_title: selectedEvent.title,
        event_date: selectedEvent.date,
        amount: amt,
        category,
        payment_method: paymentMethod,
        memo: memo.trim() || undefined,
      });
      setSelectedEvent(null); setAmount(''); setMemo('');
      onAdd();
    } catch {
      Alert.alert('エラー', 'カレンダー連動の追加に失敗しました');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <View style={styles.addCard}>
      <Text style={styles.addTitle}>📅 カレンダー連動（単発）を追加</Text>
      <Text style={styles.eventPickerLabel}>イベントを選択（{formatMonthLabel(month)}）</Text>
      {eventsLoaded && futureEvents.length === 0 ? (
        <View style={styles.eventNone}>
          <Text style={styles.eventNoneText}>{formatMonthLabel(month)}の今後のイベントがありません</Text>
        </View>
      ) : (
        <ScrollView style={styles.eventList} nestedScrollEnabled>
          {futureEvents.map((ev) => (
            <TouchableOpacity
              key={ev.id}
              style={[styles.eventItem, selectedEvent?.id === ev.id && styles.eventItemSelected]}
              onPress={() => setSelectedEvent(selectedEvent?.id === ev.id ? null : ev)}
              activeOpacity={0.7}
            >
              <Text style={styles.eventItemTitle} numberOfLines={1}>{ev.title || '（タイトルなし）'}</Text>
              <Text style={styles.eventItemDate}>{ev.date}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {selectedEvent && (
        <Text style={[styles.itemSub, { marginBottom: 8 }]}>
          選択中: {selectedEvent.title} ({selectedEvent.date})
        </Text>
      )}
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="金額"
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        style={styles.input}
      />
      <Text style={styles.eventPickerLabel}>カテゴリ</Text>
      <CategorySelector value={category} onChange={setCategory} />
      <Text style={styles.eventPickerLabel}>支払い方法</Text>
      <PaymentSelector value={paymentMethod} onChange={setPaymentMethod} />
      <TextInput
        value={memo}
        onChangeText={setMemo}
        placeholder="メモ（任意）"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />
      <TouchableOpacity onPress={handleAdd} disabled={isAdding} style={styles.addBtn} activeOpacity={0.8}>
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
          {isAdding ? '追加中...' : '+ 追加する'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function PlannedExpendituresScreen() {
  const { plannedExpenditures, isLoading, fetchPlannedExpenditures, updatePlannedExpenditure, deletePlannedExpenditure, completePlannedExpenditure } = useAppStore();
  const currentMonth = getCurrentMonth();
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [activeTab, setActiveTab] = useState<'subscription' | 'calendar'>('subscription');
  const [editingItem, setEditingItem] = useState<PlannedExpenditure | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editBillingDay, setEditBillingDay] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const swipeGesture = useSwipeTabNavigation();

  useFocusEffect(useCallback(() => { fetchPlannedExpenditures(viewMonth); }, [fetchPlannedExpenditures, viewMonth]));

  const handlePrevViewMonth = () => setViewMonth((m) => addMonths(m, -1));
  const handleNextViewMonth = () => setViewMonth((m) => addMonths(m, 1));

  const total = plannedExpenditures.filter((p) => p.is_active).reduce((sum, p) => sum + p.amount, 0);
  const subscriptionCount = plannedExpenditures.filter((p) => p.entry_type === 'subscription').length;
  const calendarCount = plannedExpenditures.filter((p) => p.entry_type === 'calendar').length;

  const handleToggle = async (item: PlannedExpenditure) => {
    try {
      await updatePlannedExpenditure(item.id, { is_active: !item.is_active });
    } catch {
      Alert.alert('エラー', '更新に失敗しました');
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('削除確認', `「${name}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePlannedExpenditure(id);
          } catch {
            Alert.alert('エラー', '削除に失敗しました');
          }
        },
      },
    ]);
  };

  const handleComplete = (item: PlannedExpenditure) => {
    const name = item.calendar_event_title ?? '';
    Alert.alert('完了確認', `「${name}」を完了して支出履歴に移動しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '完了',
        onPress: async () => {
          try {
            await completePlannedExpenditure(item.id);
          } catch {
            Alert.alert('エラー', '完了処理に失敗しました');
          }
        },
      },
    ]);
  };

  const handleEdit = (item: PlannedExpenditure) => {
    setEditingItem(item);
    setEditAmount(String(item.amount));
    setEditBillingDay(String(item.billing_day ?? ''));
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    const amt = parseInt(editAmount, 10);
    const day = parseInt(editBillingDay, 10);
    if (isNaN(amt) || amt <= 0) { Alert.alert('入力エラー', '金額を正しく入力してください'); return; }
    if (isNaN(day) || day < 1 || day > 31) { Alert.alert('入力エラー', '課金日は1〜31で入力してください'); return; }
    try {
      await updatePlannedExpenditure(editingItem.id, { amount: amt, billing_day: day });
      setEditingItem(null);
    } catch {
      Alert.alert('エラー', '更新に失敗しました');
    }
  };

  return (
    <GestureDetector gesture={swipeGesture}>
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={plannedExpenditures}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: ListRenderItemInfo<PlannedExpenditure>) => (
          <PlannedItem
            item={item}
            onEdit={handleEdit}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onComplete={handleComplete}
          />
        )}
        ListHeaderComponent={
          <View>
            {/* 月ナビゲーター */}
            <View style={styles.pageMonthNav}>
              <TouchableOpacity onPress={handlePrevViewMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
                <Text style={styles.monthNavArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthNavLabel}>{formatMonthLabel(viewMonth)}</Text>
              <TouchableOpacity onPress={handleNextViewMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
                <Text style={styles.monthNavArrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* サマリーカード */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>{formatMonthLabel(viewMonth)}の予定支出合計</Text>
              <Text style={styles.totalAmount}>¥{total.toLocaleString('ja-JP')}</Text>
              <Text style={styles.totalSub}>
                🔄 サブスク {subscriptionCount} 件 · 📅 カレンダー {calendarCount} 件
              </Text>
            </View>

            {/* 追加モーダルを開くボタン */}
            <TouchableOpacity
              style={styles.openAddBtn}
              onPress={() => setAddModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.openAddBtnText}>＋ 予定支出を追加</Text>
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>登録済み一覧</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📆</Text>
            <Text style={styles.emptyText}>予定された支出を追加しましょう</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetchPlannedExpenditures(viewMonth)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />

      {/* サブスク編集モーダル */}
      <Modal
        visible={!!editingItem}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingItem?.service_name}</Text>
            <Text style={styles.modalSub}>金額と課金日を変更する</Text>
            <TextInput
              value={editAmount}
              onChangeText={setEditAmount}
              placeholder="金額"
              keyboardType="number-pad"
              style={styles.modalInput}
              autoFocus
            />
            <TextInput
              value={editBillingDay}
              onChangeText={setEditBillingDay}
              placeholder="課金日 (1-31)"
              keyboardType="number-pad"
              style={styles.modalInput}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setEditingItem(null)} style={styles.modalCancel} activeOpacity={0.7}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveEdit} style={styles.modalSave} activeOpacity={0.8}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 予定支出追加モーダル */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.addModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.addModalSheet}>
            <View style={styles.addModalHeader}>
              <Text style={styles.addModalTitle}>予定支出を追加</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.addModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* タイプセレクタ */}
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeSelectorItem, activeTab === 'subscription' && styles.typeSelectorActive]}
                onPress={() => setActiveTab('subscription')}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeSelectorText, activeTab === 'subscription' && styles.typeSelectorTextActive]}>
                  🔄 サブスク
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeSelectorItem, activeTab === 'calendar' && styles.typeSelectorActive]}
                onPress={() => setActiveTab('calendar')}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeSelectorText, activeTab === 'calendar' && styles.typeSelectorTextActive]}>
                  📅 カレンダー連動
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {addModalVisible && (
                activeTab === 'subscription' ? (
                  <SubscriptionForm
                    onAdd={() => {
                      fetchPlannedExpenditures(viewMonth);
                      setAddModalVisible(false);
                    }}
                  />
                ) : (
                  <CalendarForm
                    month={viewMonth}
                    onAdd={() => {
                      fetchPlannedExpenditures(viewMonth);
                      setAddModalVisible(false);
                    }}
                  />
                )
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
    </GestureDetector>
  );
}
