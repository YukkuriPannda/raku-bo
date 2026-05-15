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
import { colors } from '@/constants/theme';
import { styles } from '@/styles/shifts.styles';
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
  const { shifts, balance, hourlyWage, isLoading, fetchShifts, setHourlyWage } = useAppStore();
  const month = getCurrentMonth();
  const [wageInput, setWageInput] = useState(String(hourlyWage));

  useFocusEffect(
    useCallback(() => {
      fetchShifts(month);
      setWageInput(String(hourlyWage));
    }, [month, fetchShifts, hourlyWage])
  );

  const handleSaveWage = () => {
    const parsed = parseInt(wageInput, 10);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('入力エラー', '正しい時給を入力してください');
      return;
    }
    setHourlyWage(parsed);
    Alert.alert('保存しました', `時給を ¥${parsed.toLocaleString()} に設定しました`);
  };

  const ListHeader = () => (
    <View>
      <View style={styles.forecastCard}>
        <Text style={styles.forecastLabel}>今月の月収見込み</Text>
        <Text style={styles.forecastAmount}>¥{balance.income_forecast.toLocaleString('ja-JP')}</Text>
        <Text style={styles.forecastSub}>
          シフト {shifts.length} 件 · 合計 {shifts.reduce((s, i) => s + i.duration_hours, 0).toFixed(1)} 時間
        </Text>
      </View>

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

      <Text style={styles.sectionLabel}>シフト一覧 ({shifts.length} 件)</Text>
    </View>
  );

  return (
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
            refreshing={isLoading}
            onRefresh={() => fetchShifts(month)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </KeyboardAvoidingView>
  );
}
