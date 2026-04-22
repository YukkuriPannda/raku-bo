// ============================================================
// app/(tabs)/points.tsx
// ポイント管理画面
// - ポイント一覧（名前・保有数・円換算）
// - 新規追加フォーム（名前・保有数・レート）
// - 保有数のインライン編集
// ============================================================

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
import type { Point } from '@/types';

// ============================================================
// ポイント行コンポーネント
// ============================================================
type PointItemProps = {
  item: Point;
  onEdit: (point: Point) => void;
  onDelete: (id: string, name: string) => void;
};

function PointItem({ item, onEdit, onDelete }: PointItemProps) {
  const yenValue = Math.floor(item.amount * item.rate);

  return (
    <View className="bg-white mx-4 mb-2 rounded-xl px-4 py-3 shadow-sm flex-row items-center">
      {/* ポイント情報 */}
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-800">{item.name}</Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {item.amount.toLocaleString()} pt · 1pt = ¥{item.rate}
        </Text>
      </View>

      {/* 円換算 */}
      <Text className="text-base font-bold text-blue-600 mr-3">
        ≈ ¥{yenValue.toLocaleString('ja-JP')}
      </Text>

      {/* 編集ボタン */}
      <TouchableOpacity
        onPress={() => onEdit(item)}
        className="bg-gray-100 rounded-lg px-3 py-1.5 mr-2 active:opacity-70"
      >
        <Text className="text-xs text-gray-600">編集</Text>
      </TouchableOpacity>

      {/* 削除ボタン */}
      <TouchableOpacity
        onPress={() => onDelete(item.id, item.name)}
        className="bg-red-50 rounded-lg px-3 py-1.5 active:opacity-70"
      >
        <Text className="text-xs text-red-500">削除</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// ポイント管理画面コンポーネント
// ============================================================
export default function PointsScreen() {
  const { points, isLoading, fetchPoints, calcBalance } = useAppStore();

  // 新規追加フォームの状態
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newRate, setNewRate] = useState('1');
  const [isAdding, setIsAdding] = useState(false);

  // 編集モーダルの状態
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);
  const [editAmount, setEditAmount] = useState('');

  // 画面フォーカス時にデータを再取得
  useFocusEffect(
    useCallback(() => {
      fetchPoints();
    }, [fetchPoints])
  );

  // ポイント合計（円換算）
  const totalYen = points.reduce((sum, p) => sum + Math.floor(p.amount * p.rate), 0);

  // ============================================================
  // ポイント追加
  // ============================================================
  const handleAdd = async () => {
    const name = newName.trim();
    const amount = parseInt(newAmount, 10);
    const rate = parseFloat(newRate);

    if (!name) {
      Alert.alert('入力エラー', 'ポイント名を入力してください');
      return;
    }
    if (isNaN(amount) || amount < 0) {
      Alert.alert('入力エラー', '保有数を正しく入力してください');
      return;
    }
    if (isNaN(rate) || rate <= 0) {
      Alert.alert('入力エラー', 'レートを正しく入力してください');
      return;
    }

    setIsAdding(true);
    try {
      await pointApi.create({ name, amount, rate });
      await fetchPoints();
      calcBalance();
      // フォームをリセット
      setNewName('');
      setNewAmount('');
      setNewRate('1');
    } catch {
      Alert.alert('エラー', 'ポイントの追加に失敗しました');
    } finally {
      setIsAdding(false);
    }
  };

  // ============================================================
  // ポイント保有数の更新
  // ============================================================
  const handleSaveEdit = async () => {
    if (!editingPoint) return;
    const amount = parseInt(editAmount, 10);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('入力エラー', '保有数を正しく入力してください');
      return;
    }

    try {
      await pointApi.update(editingPoint.id, amount);
      await fetchPoints();
      calcBalance();
      setEditingPoint(null);
    } catch {
      Alert.alert('エラー', 'ポイントの更新に失敗しました');
    }
  };

  // ============================================================
  // ポイント削除
  // ============================================================
  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      '削除確認',
      `「${name}」を削除しますか？`,
      [
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
      ]
    );
  };

  // ============================================================
  // ヘッダー（合計＋追加フォーム）
  // ============================================================
  const ListHeader = () => (
    <View>
      {/* 合計カード */}
      <View className="mx-4 mt-4 mb-4 bg-white rounded-2xl shadow-sm p-5 items-center">
        <Text className="text-sm text-gray-500 mb-1">ポイント資産合計（円換算）</Text>
        <Text className="text-4xl font-bold text-blue-500">
          ¥{totalYen.toLocaleString('ja-JP')}
        </Text>
        <Text className="text-xs text-gray-400 mt-2">{points.length} 種類のポイント</Text>
      </View>

      {/* 新規追加フォーム */}
      <View className="mx-4 mb-4 bg-white rounded-2xl shadow-sm p-4">
        <Text className="text-sm font-semibold text-gray-700 mb-3">ポイントを追加</Text>

        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="ポイント名（例: Tポイント）"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 mb-2"
        />

        <View className="flex-row gap-2 mb-3">
          <TextInput
            value={newAmount}
            onChangeText={setNewAmount}
            placeholder="保有数"
            keyboardType="number-pad"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800"
          />
          <TextInput
            value={newRate}
            onChangeText={setNewRate}
            placeholder="レート（例: 0.5）"
            keyboardType="decimal-pad"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800"
          />
        </View>

        <TouchableOpacity
          onPress={handleAdd}
          disabled={isAdding}
          className="bg-primary rounded-lg py-3 items-center active:opacity-70"
        >
          <Text className="text-white font-semibold text-sm">
            {isAdding ? '追加中...' : '+ 追加する'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* リストラベル */}
      <Text className="text-sm text-gray-400 mx-5 mb-2">ポイント一覧</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={points}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: ListRenderItemInfo<Point>) => (
          <PointItem
            item={item}
            onEdit={(p) => {
              setEditingPoint(p);
              setEditAmount(String(p.amount));
            }}
            onDelete={handleDelete}
          />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View className="items-center py-8">
            <Text className="text-3xl mb-2">💎</Text>
            <Text className="text-gray-400 text-sm">ポイントを追加しましょう</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchPoints}
            colors={['#22c55e']}
            tintColor="#22c55e"
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />

      {/* ============================================================
          編集モーダル
          ============================================================ */}
      <Modal
        visible={!!editingPoint}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingPoint(null)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center px-8">
          <View className="bg-white rounded-2xl p-6 w-full">
            <Text className="text-base font-bold text-gray-800 mb-1">
              {editingPoint?.name}
            </Text>
            <Text className="text-xs text-gray-400 mb-4">
              保有ポイント数を変更する
            </Text>

            <TextInput
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="number-pad"
              className="border border-gray-300 rounded-lg px-3 py-2 text-base text-gray-800 mb-4"
              autoFocus
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setEditingPoint(null)}
                className="flex-1 border border-gray-300 rounded-lg py-3 items-center active:opacity-70"
              >
                <Text className="text-gray-600 font-semibold">キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                className="flex-1 bg-primary rounded-lg py-3 items-center active:opacity-70"
              >
                <Text className="text-white font-semibold">保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
