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
  Modal,
  ScrollView,
  ListRenderItemInfo,
  Alert,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';

import { useAppStore } from '@/store';
import { colors } from '@/constants/theme';
import { styles } from '@/styles/shifts.styles';
import { useSwipeTabNavigation } from '@/hooks/useSwipeTabNavigation';
import { useRefreshOnForeground } from '@/hooks/useRefreshOnForeground';
import type { ShiftEvent } from '@/types';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatShiftDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ShiftItem({ item }: { item: ShiftEvent }) {
  return (
    <View style={styles.shiftCard}>
      <Text style={styles.shiftTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.shiftTime}>
        📅 {formatShiftDate(item.start)} 〜 {formatShiftDate(item.end)}
      </Text>
      <View style={styles.shiftFooter}>
        <Text style={styles.shiftDuration}>⏱ {item.duration_hours.toFixed(1)} 時間</Text>
        <Text style={styles.shiftWage}>¥{item.estimated_wage.toLocaleString('ja-JP')}</Text>
      </View>
    </View>
  );
}

export default function ShiftsScreen() {
  const { shifts, balance, hourlyWage, shiftKeywords, shiftsLoading, calendarError, clearCalendarError, fetchShifts, setHourlyWage, setShiftKeywords, logout } = useAppStore();
  const month = getCurrentMonth();
  const [wageInput, setWageInput] = useState(String(hourlyWage));
  const [keywordsInput, setKeywordsInput] = useState(shiftKeywords.join('\n'));
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const swipeGesture = useSwipeTabNavigation();

  useFocusEffect(
    useCallback(() => {
      fetchShifts(month);
      setWageInput(String(hourlyWage));
      setKeywordsInput(shiftKeywords.join('\n'));
    }, [month, fetchShifts, hourlyWage, shiftKeywords])
  );
  useRefreshOnForeground(() => fetchShifts(month));

  const handleSaveWage = () => {
    const parsed = parseInt(wageInput, 10);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('入力エラー', '正しい時給を入力してください');
      return;
    }
    setHourlyWage(parsed);
    Alert.alert('保存しました', `時給を ¥${parsed.toLocaleString()} に設定しました`);
  };

  const handleSaveKeywords = async () => {
    const keywords = keywordsInput
      .split('\n')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    if (keywords.length === 0) {
      Alert.alert('入力エラー', 'キーワードを1つ以上入力してください');
      return;
    }
    await setShiftKeywords(keywords);
    Alert.alert('保存しました', 'シフト検出キーワードを更新しました');
  };

  const handleLogout = () => {
    Alert.alert('ログアウト', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'ログアウト', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const ListHeader = () => (
    <View>
      {calendarError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{calendarError}</Text>
          <TouchableOpacity onPress={clearCalendarError}>
            <Text style={styles.errorDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.forecastCard}>
        <Text style={styles.forecastLabel}>今月の月収見込み</Text>
        <Text style={styles.forecastAmount}>¥{balance.income_forecast.toLocaleString('ja-JP')}</Text>
        <Text style={styles.forecastSub}>
          シフト {shifts.length} 件 · 合計 {shifts.reduce((s, i) => s + i.duration_hours, 0).toFixed(1)} 時間
        </Text>
        <TouchableOpacity
          style={styles.settingsGearBtn}
          onPress={() => setSettingsModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.settingsGearIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>シフト一覧 ({shifts.length} 件)</Text>
    </View>
  );

  return (
    <GestureDetector gesture={swipeGesture}>
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={shifts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: ListRenderItemInfo<ShiftEvent>) => <ShiftItem item={item} />}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyText}>今月のシフトはありません</Text>
            <Text style={styles.emptySubText}>Google カレンダーのシフトを読み込みます</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={shiftsLoading}
            onRefresh={() => fetchShifts(month, { force: true })}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />

      {/* 設定モーダル（時給設定・シフト検出キーワード・ログアウト） */}
      <Modal
        visible={settingsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        {/* Modal内はウィンドウが別扱いになり、AndroidのadjustResizeが
            効かないため、ここだけは明示的にbehaviorを与える必要がある
            （Modal外のKeyboardAvoidingViewはadjustResizeで足りているので
            behaviorを足すと二重に動いてしまう。触らないこと）。 */}
        <KeyboardAvoidingView
          style={styles.settingsModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.settingsModalSheet}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>設定</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.settingsModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.wageCard}>
                <Text style={styles.wageTitle}>時給設定</Text>
                <View style={styles.wageRow}>
                  <Text style={styles.wageCurrency}>¥</Text>
                  <TextInput
                    value={wageInput}
                    onChangeText={setWageInput}
                    keyboardType="number-pad"
                    style={styles.wageInput}
                    placeholder="1000"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="done"
                    onSubmitEditing={handleSaveWage}
                  />
                  <TouchableOpacity onPress={handleSaveWage} style={styles.wageSaveBtn} activeOpacity={0.8}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>保存</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.keywordsCard}>
                <Text style={styles.keywordsLabel}>シフト検出キーワード</Text>
                <Text style={styles.keywordsHint}>1行に1つ入力してください</Text>
                <TextInput
                  value={keywordsInput}
                  onChangeText={setKeywordsInput}
                  multiline
                  style={styles.keywordsInput}
                  placeholder={'バイト\nシフト\n出勤\n勤務'}
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity onPress={handleSaveKeywords} style={styles.keywordsSaveBtn} activeOpacity={0.8}>
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>保存</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.logoutCard}>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.8}>
                  <Text style={styles.logoutText}>ログアウト</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
    </GestureDetector>
  );
}
