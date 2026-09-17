import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path, Circle } from 'react-native-svg';

import { useAppStore } from '@/store';
import { ALL_CATEGORIES } from '@/types';
import { colors } from '@/constants/theme';
import { styles } from '@/styles/index.styles';
import { buildRollingCells, buildMonthLabels, chunkIntoWeeks, LEVEL_COLORS, OUT_OF_RANGE_COLOR } from '@/lib/heatmap';
import { useSwipeTabNavigation } from '@/hooks/useSwipeTabNavigation';
import { useRefreshOnForeground } from '@/hooks/useRefreshOnForeground';
import type { DailySpend } from '@/lib/widget-bridge';
import type { Transaction } from '@/types';

// 建て替え（未回収）を表す色。記録画面・履歴・ウィジェットと共通
const ADVANCE_COLOR = '#E65100';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatCurrency(amount: number): string {
  return `¥${Math.abs(amount).toLocaleString('ja-JP')}`;
}

// 曜日ラベル（日曜始まり）。GitHubの草グラフに倣い月・水・金だけ表示する
const DAY_LABELS = ['', '月', '', '水', '', '金', ''];

// 支出の草グラフ（GitHubの草グラフ風ヒートマップ）
function SpendingHeatmap({ days }: { days: DailySpend[] }) {
  const router = useRouter();
  const columns = chunkIntoWeeks(buildRollingCells(days));
  const monthLabels = buildMonthLabels(days, columns.length);

  return (
    <TouchableOpacity
      style={styles.heatmapCard}
      onPress={() => router.push('/history')}
      activeOpacity={0.7}
    >
      <View style={styles.heatmapHeader}>
        <Text style={styles.heatmapTitle}>🌱 支出の記録</Text>
        <Text style={styles.heatmapChevron}>›</Text>
      </View>
      <View style={styles.heatmapBody}>
        {/* 曜日ラベル */}
        <View style={styles.heatmapDayLabels}>
          {DAY_LABELS.map((label, i) => (
            <Text key={i} style={styles.heatmapDayLabel}>{label}</Text>
          ))}
        </View>

        <View style={{ flex: 1 }}>
          {/* 月ラベル（列の開始位置に絶対配置） */}
          <View style={styles.heatmapMonthLabels}>
            {monthLabels.map((label, ci) =>
              label ? (
                <Text key={ci} style={[styles.heatmapMonthLabel, { left: ci * 15 }]}>
                  {label}
                </Text>
              ) : null
            )}
          </View>

          <View style={styles.heatmapGrid}>
            {columns.map((column, ci) => (
              <View key={ci} style={styles.heatmapColumn}>
                {column.map((cell, ri) => (
                  <View
                    key={ri}
                    style={[
                      styles.heatmapCell,
                      { backgroundColor: cell === null ? OUT_OF_RANGE_COLOR : LEVEL_COLORS[cell.level] },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.heatmapLegend}>
        <Text style={styles.heatmapLegendLabel}>少ない</Text>
        {LEVEL_COLORS.map((color) => (
          <View key={color} style={[styles.heatmapLegendSwatch, { backgroundColor: color }]} />
        ))}
        <Text style={styles.heatmapLegendLabel}>多い</Text>
      </View>
    </TouchableOpacity>
  );
}

// カテゴリの色を安定させるための固定パレット。カテゴリの並び順や
// 種類数に関わらず、同じカテゴリ文字列には常に同じ色を割り当てる
const CATEGORY_CHART_PALETTE = [
  '#1B7F4F', '#2F80ED', '#F2994A', '#9B51E0', '#EB5757',
  '#219653', '#F2C94C', '#56CCF2', '#BB6BD9', '#6FCF97',
];

function categoryChartColor(category: string): string {
  const standardIndex = ALL_CATEGORIES.findIndex((name) => name === category);
  if (standardIndex >= 0) return CATEGORY_CHART_PALETTE[standardIndex];

  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) | 0;
  }
  return CATEGORY_CHART_PALETTE[(hash >>> 0) % CATEGORY_CHART_PALETTE.length];
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// 中心(cx, cy)から半径rの円周上を startAngle→endAngle（時計回り、0°=12時）
// でつなぐ扇形パス
function describePieSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

interface CategoryTotal {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

const CATEGORY_CHART_SIZE = 140;
const CATEGORY_CHART_RADIUS = CATEGORY_CHART_SIZE / 2;

// 今月のカテゴリ別支出の円グラフ
function CategorySpendingChart({ transactions }: { transactions: Transaction[] }) {
  const categoryTotals = useMemo<CategoryTotal[]>(() => {
    const totalsByCategory = new Map<string, number>();

    for (const t of transactions) {
      if (t.type !== 'cash' || t.is_advance) continue;
      if (!Number.isFinite(t.amount) || t.amount <= 0) continue;
      // カスタムカテゴリの表記ゆれを正規化せず、入力された文字列のまま集計する
      const category = t.category as string;
      totalsByCategory.set(category, (totalsByCategory.get(category) ?? 0) + t.amount);
    }

    const total = Array.from(totalsByCategory.values()).reduce((sum, v) => sum + v, 0);
    if (total <= 0) return [];

    return Array.from(totalsByCategory.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: (amount / total) * 100,
        color: categoryChartColor(category),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const total = categoryTotals.reduce((sum, c) => sum + c.amount, 0);

  let startAngle = 0;

  return (
    <View style={styles.categoryCard}>
      <Text style={styles.categoryTitle}>📊 カテゴリ別支出</Text>

      {categoryTotals.length === 0 ? (
        <Text style={styles.categoryEmptyText}>この月の支出データはまだありません</Text>
      ) : (
        <View style={styles.categoryBody}>
          <Svg width={CATEGORY_CHART_SIZE} height={CATEGORY_CHART_SIZE} style={styles.categoryChart}>
            {categoryTotals.length === 1 ? (
              // 単一カテゴリの場合、始角=終角の扇形パスは描画されないため円で代用する
              <Circle
                cx={CATEGORY_CHART_RADIUS}
                cy={CATEGORY_CHART_RADIUS}
                r={CATEGORY_CHART_RADIUS}
                fill={categoryTotals[0].color}
              />
            ) : (
              categoryTotals.map((c) => {
                const sweep = (c.amount / total) * 360;
                const endAngle = Math.min(startAngle + sweep, 360);
                const path = describePieSlice(
                  CATEGORY_CHART_RADIUS,
                  CATEGORY_CHART_RADIUS,
                  CATEGORY_CHART_RADIUS,
                  startAngle,
                  endAngle
                );
                startAngle = endAngle;
                return <Path key={c.category} d={path} fill={c.color} />;
              })
            )}
          </Svg>

          <View style={styles.categoryLegend}>
            {categoryTotals.map((c) => (
              <View key={c.category} style={styles.categoryLegendRow}>
                <View style={[styles.categoryLegendSwatch, { backgroundColor: c.color }]} />
                <Text style={styles.categoryLegendLabel} numberOfLines={1}>
                  {c.category}
                </Text>
                <Text style={styles.categoryLegendValue}>
                  {formatCurrency(c.amount)}（{c.percentage.toFixed(1)}%）
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const {
    balance,
    transactions,
    transactionsLoading,
    shiftsLoading,
    plannedExpendituresLoading,
    transactionsLoaded,
    shiftsLoaded,
    plannedExpendituresLoaded,
    fetchTransactions,
    fetchShifts,
    fetchPlannedExpenditures,
    heatmapDays,
  } = useAppStore();
  const month = getCurrentMonth();
  const swipeGesture = useSwipeTabNavigation();

  const loadData = useCallback(async (opts?: { force?: boolean }) => {
    await Promise.all([
      fetchTransactions(month, opts),
      fetchShifts(month, opts),
      fetchPlannedExpenditures(month, opts),
    ]);
  }, [month, fetchTransactions, fetchShifts, fetchPlannedExpenditures]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  useRefreshOnForeground(loadData);

  // RefreshControl は3ドメインどれかが取得中なら回しておく
  const isRefreshing = transactionsLoading || shiftsLoading || plannedExpendituresLoading;
  // 3つとも一度でも取得済みなら「初回」ではない。以後はスピナーに
  // 置き換えず、前回の残高を表示したまま裏で更新する（stale-while-revalidate）
  const hasLoadedOnce = transactionsLoaded && shiftsLoaded && plannedExpendituresLoaded;
  const isInitialLoading = isRefreshing && !hasLoadedOnce;

  const isPositive = balance.remaining >= 0;

  return (
    <GestureDetector gesture={swipeGesture}>
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadData({ force: true })}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* メインカード - 残り使える額 */}
        <View style={styles.mainCard}>
          <Text style={styles.mainCardLabel}>今月あと</Text>

          {isInitialLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 16 }} />
          ) : (
            <Text style={[styles.mainAmount, isPositive ? styles.mainAmountPositive : styles.mainAmountNegative]}>
              {isPositive ? '' : '-'}{formatCurrency(balance.remaining)}
            </Text>
          )}

          <Text style={styles.mainCardSub}>使える</Text>
        </View>

        {/* サブ情報カード */}
        <View style={styles.subCard}>
          <TouchableOpacity style={styles.subRow} onPress={() => router.push('/history')} activeOpacity={0.6}>
            <View style={styles.subRowLeft}>
              <Text style={styles.subRowEmoji}>💸</Text>
              <View>
                <Text style={styles.subRowLabel}>今月の支出</Text>
                {balance.advance_total > 0 && (
                  <Text style={styles.subRowNote}>
                    建て替え {formatCurrency(balance.advance_total)} を除く
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.subRowRight}>
              <Text style={styles.subRowValue}>{formatCurrency(balance.net_expense_total)}</Text>
              <Text style={styles.subRowChevron}>›</Text>
            </View>
          </TouchableOpacity>

          {balance.advance_unsettled_total > 0 && (
            <TouchableOpacity style={styles.subRow} onPress={() => router.push('/history')} activeOpacity={0.6}>
              <View style={styles.subRowLeft}>
                <Text style={styles.subRowEmoji}>🤝</Text>
                <Text style={styles.subRowLabel}>建て替え・未回収</Text>
              </View>
              <View style={styles.subRowRight}>
                <Text style={[styles.subRowValue, { color: ADVANCE_COLOR }]}>
                  {formatCurrency(balance.advance_unsettled_total)}
                </Text>
                <Text style={styles.subRowChevron}>›</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.subRow} onPress={() => router.push('/shifts')} activeOpacity={0.6}>
            <View style={styles.subRowLeft}>
              <Text style={styles.subRowEmoji}>💼</Text>
              <Text style={styles.subRowLabel}>月収見込み</Text>
            </View>
            <View style={styles.subRowRight}>
              <Text style={styles.subRowValueGreen}>{formatCurrency(balance.income_forecast)}</Text>
              <Text style={styles.subRowChevron}>›</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.subRowLast} onPress={() => router.push('/planned-expenditures')} activeOpacity={0.6}>
            <View style={styles.subRowLeft}>
              <Text style={styles.subRowEmoji}>📆</Text>
              <Text style={styles.subRowLabel}>予定支出</Text>
            </View>
            <View style={styles.subRowRight}>
              <Text style={[styles.subRowValue, { color: balance.planned_total > 0 ? '#E65100' : '#6B7280' }]}>
                -{formatCurrency(balance.planned_total)}
              </Text>
              <Text style={styles.subRowChevron}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* カテゴリ別支出の円グラフ */}
        <CategorySpendingChart transactions={transactions} />

        {/* 支出の草グラフ */}
        <SpendingHeatmap days={heatmapDays} />

        <Text style={styles.monthLabel}>{month.replace('-', '年')}月</Text>
      </ScrollView>

      {/* 記録追加のボタンはタブバー中央に移した（app/(tabs)/_layout.tsx） */}
    </View>
    </GestureDetector>
  );
}
