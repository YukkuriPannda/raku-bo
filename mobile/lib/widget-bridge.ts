// ============================================================
// lib/widget-bridge.ts
// アプリ本体 ⇔ Android ホーム画面ウィジェットの橋渡し
//
// ウィジェットは headless task（別JSコンテキスト）で動くため、
// Zustand ストアや認証セッションに直接アクセスできない。
// そのためアプリ側が calcBalance() のたびに「残り使える額」を
// SecureStore に書き込み、ウィジェット側はそれを読むだけにする
// （ネットワーク・認証を一切必要としない設計）。
// ============================================================

import * as SecureStore from 'expo-secure-store';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { RemainingBudgetWidget } from '@/widgets/RemainingBudgetWidget';
import { SpendingHeatmapWidget } from '@/widgets/SpendingHeatmapWidget';
import type { BalanceData } from '@/types';

const WIDGET_CACHE_KEY = 'widget_remaining_budget';
const WIDGET_NAME = 'RemainingBudget';

const HEATMAP_CACHE_KEY = 'widget_spending_heatmap';
const HEATMAP_WIDGET_NAME = 'SpendingHeatmap';

/** ウィジェットに表示する支出1件分の要約 */
export interface RecentTransactionSummary {
  label: string;
  amount: number;
}

interface WidgetBudgetCache {
  remaining: number;
  month: string;
  updatedAt: string;
  recentTransactions: RecentTransactionSummary[];
  upcomingPlanned: RecentTransactionSummary[];
}

/** 残高を SecureStore に保存し、ホーム画面上のウィジェットを即時更新する（fire-and-forget） */
export function saveWidgetBudget(
  balance: BalanceData,
  month: string,
  recentTransactions: RecentTransactionSummary[],
  upcomingPlanned: RecentTransactionSummary[]
): void {
  const cache: WidgetBudgetCache = {
    remaining: balance.remaining,
    month,
    updatedAt: new Date().toISOString(),
    recentTransactions,
    upcomingPlanned,
  };

  SecureStore.setItemAsync(WIDGET_CACHE_KEY, JSON.stringify(cache))
    .then(() =>
      requestWidgetUpdate({
        widgetName: WIDGET_NAME,
        renderWidget: () =>
          RemainingBudgetWidget({
            budget: cache.remaining,
            recentTransactions: cache.recentTransactions,
            upcomingPlanned: cache.upcomingPlanned,
          }),
        widgetNotFound: () => {},
      })
    )
    .catch((error) => console.error('[saveWidgetBudget] エラー:', error));
}

/** キャッシュされた残高を取得する（ウィジェットの headless task から呼ばれる） */
export async function getWidgetBudget(): Promise<WidgetBudgetCache | null> {
  try {
    const raw = await SecureStore.getItemAsync(WIDGET_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WidgetBudgetCache;
  } catch (error) {
    console.error('[getWidgetBudget] エラー:', error);
    return null;
  }
}

/** ログアウト時にキャッシュを削除し、ウィジェットをプレースホルダー表示に戻す */
export function clearWidgetBudget(): void {
  SecureStore.deleteItemAsync(WIDGET_CACHE_KEY)
    .then(() =>
      requestWidgetUpdate({
        widgetName: WIDGET_NAME,
        renderWidget: () => RemainingBudgetWidget({ budget: null, recentTransactions: [], upcomingPlanned: [] }),
        widgetNotFound: () => {},
      })
    )
    .catch((error) => console.error('[clearWidgetBudget] エラー:', error));
}

/** 日別支出1件分 */
export interface DailySpend {
  date: string; // "YYYY-MM-DD"
  total: number;
}

interface WidgetHeatmapCache {
  days: DailySpend[];
  updatedAt: string;
}

/** 日別支出（草グラフ用）を SecureStore に保存し、ウィジェットを即時更新する（fire-and-forget） */
export function saveWidgetHeatmap(days: DailySpend[]): void {
  const cache: WidgetHeatmapCache = {
    days,
    updatedAt: new Date().toISOString(),
  };

  SecureStore.setItemAsync(HEATMAP_CACHE_KEY, JSON.stringify(cache))
    .then(() =>
      requestWidgetUpdate({
        widgetName: HEATMAP_WIDGET_NAME,
        renderWidget: () => SpendingHeatmapWidget({ days: cache.days }),
        widgetNotFound: () => {},
      })
    )
    .catch((error) => console.error('[saveWidgetHeatmap] エラー:', error));
}

/** キャッシュされた日別支出を取得する（ウィジェットの headless task から呼ばれる） */
export async function getWidgetHeatmap(): Promise<WidgetHeatmapCache | null> {
  try {
    const raw = await SecureStore.getItemAsync(HEATMAP_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WidgetHeatmapCache;
  } catch (error) {
    console.error('[getWidgetHeatmap] エラー:', error);
    return null;
  }
}

/** ログアウト時にキャッシュを削除し、ウィジェットを空表示に戻す */
export function clearWidgetHeatmap(): void {
  SecureStore.deleteItemAsync(HEATMAP_CACHE_KEY)
    .then(() =>
      requestWidgetUpdate({
        widgetName: HEATMAP_WIDGET_NAME,
        renderWidget: () => SpendingHeatmapWidget({ days: [] }),
        widgetNotFound: () => {},
      })
    )
    .catch((error) => console.error('[clearWidgetHeatmap] エラー:', error));
}
