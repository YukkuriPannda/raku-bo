import { useState, useCallback } from 'react';
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
  ListRenderItemInfo,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAppStore } from '@/store';
import { pointApi } from '@/lib/api';
import { colors } from '@/constants/theme';
import { styles } from '@/styles/points.styles';
import type { Point } from '@/types';

function PointItem({
  item,
  onEdit,
  onDelete,
}: {
  item: Point;
  onEdit: (point: Point) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const yenValue = Math.floor(item.amount * item.rate);

  return (
    <View style={styles.pointCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pointName}>{item.name}</Text>
        <Text style={styles.pointSub}>
          {item.amount.toLocaleString()} pt · 1pt = ¥{item.rate}
        </Text>
      </View>
      <Text style={styles.pointValue}>≈ ¥{yenValue.toLocaleString('ja-JP')}</Text>
      <TouchableOpacity onPress={() => onEdit(item)} style={styles.editBtn} activeOpacity={0.7}>
        <Text style={styles.editBtnText}>編集</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onDelete(item.id, item.name)} style={styles.deleteBtn} activeOpacity={0.7}>
        <Text style={styles.deleteBtnText}>削除</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function PointsScreen() {
  const { points, isLoading, fetchPoints, calcBalance } = useAppStore();
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newRate, setNewRate] = useState('1');
  const [isAdding, setIsAdding] = useState(false);
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);
  const [editAmount, setEditAmount] = useState('');

  useFocusEffect(useCallback(() => { fetchPoints(); }, [fetchPoints]));

  const totalYen = points.reduce((sum, p) => sum + Math.floor(p.amount * p.rate), 0);

  const handleAdd = async () => {
    const name = newName.trim();
    const amount = parseInt(newAmount, 10);
    const rate = parseFloat(newRate);
    if (!name) { Alert.alert('入力エラー', 'ポイント名を入力してください'); return; }
    if (isNaN(amount) || amount < 0) { Alert.alert('入力エラー', '保有数を正しく入力してください'); return; }
    if (isNaN(rate) || rate <= 0) { Alert.alert('入力エラー', 'レートを正しく入力してください'); return; }

    setIsAdding(true);
    try {
      await pointApi.create({ name, amount, rate });
      await fetchPoints();
      calcBalance();
      setNewName(''); setNewAmount(''); setNewRate('1');
    } catch {
      Alert.alert('エラー', 'ポイントの追加に失敗しました');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPoint) return;
    const amount = parseInt(editAmount, 10);
    if (isNaN(amount) || amount < 0) { Alert.alert('入力エラー', '保有数を正しく入力してください'); return; }
    try {
      await pointApi.update(editingPoint.id, amount);
      await fetchPoints();
      calcBalance();
      setEditingPoint(null);
    } catch {
      Alert.alert('エラー', 'ポイントの更新に失敗しました');
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
            await pointApi.delete(id);
            await fetchPoints();
            calcBalance();
          } catch {
            Alert.alert('エラー', 'ポイントの削除に失敗しました');
          }
        },
      },
    ]);
  };

  const ListHeader = () => (
    <View>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>ポイント資産合計（円換算）</Text>
        <Text style={styles.totalAmount}>¥{totalYen.toLocaleString('ja-JP')}</Text>
        <Text style={styles.totalSub}>{points.length} 種類のポイント</Text>
      </View>

      <View style={styles.addCard}>
        <Text style={styles.addTitle}>ポイントを追加</Text>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="ポイント名（例: Tポイント）"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <View style={styles.inputRow}>
          <TextInput
            value={newAmount}
            onChangeText={setNewAmount}
            placeholder="保有数"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            style={styles.inputHalf}
          />
          <TextInput
            value={newRate}
            onChangeText={setNewRate}
            placeholder="レート"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            style={styles.inputHalf}
          />
        </View>
        <TouchableOpacity onPress={handleAdd} disabled={isAdding} style={styles.addBtn} activeOpacity={0.8}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
            {isAdding ? '追加中...' : '+ 追加する'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>ポイント一覧</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={points}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: ListRenderItemInfo<Point>) => (
          <PointItem
            item={item}
            onEdit={(p) => { setEditingPoint(p); setEditAmount(String(p.amount)); }}
            onDelete={handleDelete}
          />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💎</Text>
            <Text style={styles.emptyText}>ポイントを追加しましょう</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchPoints}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />

      <Modal
        visible={!!editingPoint}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingPoint(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingPoint?.name}</Text>
            <Text style={styles.modalSub}>保有ポイント数を変更する</Text>
            <TextInput
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="number-pad"
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setEditingPoint(null)} style={styles.modalCancel} activeOpacity={0.7}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveEdit} style={styles.modalSave} activeOpacity={0.8}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
