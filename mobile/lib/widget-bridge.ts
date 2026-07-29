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
  /** 未回収の建て替え合計。アップデート前に書かれたキャッシュには存在しない */
  unsettledAdvance?: number;
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
    unsettledAdvance: balance.advance_unsettled_total,
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
            unsettledAdvance: cache.unsettledAdvance,
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

/**
 * SecureStore の1件あたりの上限。
 * expo-secure-store はこれを超えると
 * 「larger than 2048 bytes and it may not be stored successfully.
 *  In a future SDK version, this call may throw an error.」
 * と警告するだけで続行するため、保存が壊れても気付けない
 * （lib/auth.ts がセッション保存で踏んだのと同じ罠）。
 */
const SECURE_STORE_BYTES_LIMIT = 2048;

/**
 * ヒートマップの保存形式（v2）。
 *
 * `[{date:"2026-07-05", total:1234}, ...]` をそのまま JSON にすると
 * 105日分で約3,800バイトになり上限を超える。日付は連続した範囲なので、
 * 基準日と「基準日からの日数」に置き換えて圧縮する。
 * 展開後は元の DailySpend[] と完全に一致する（ウィジェット側は無変更）。
 */
interface WidgetHeatmapCacheV2 {
  v: 2;
  base: string;                  // 基準日 "YYYY-MM-DD"
  entries: [number, number][];   // [基準日からの日数, 合計]
  updatedAt: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toUtcDay = (date: string): number => Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY;
const fromUtcDay = (day: number): string => new Date(day * MS_PER_DAY).toISOString().slice(0, 10);

function compactHeatmap(days: DailySpend[], updatedAt: string): WidgetHeatmapCacheV2 {
  const base = days.length > 0 ? days[0].date : fromUtcDay(Math.floor(Date.now() / MS_PER_DAY));
  const baseDay = toUtcDay(base);

  return {
    v: 2,
    base,
    entries: days.map((d) => [toUtcDay(d.date) - baseDay, d.total]),
    updatedAt,
  };
}

function expandHeatmap(cache: WidgetHeatmapCacheV2): WidgetHeatmapCache {
  const baseDay = toUtcDay(cache.base);
  return {
    days: cache.entries.map(([offset, total]) => ({ date: fromUtcDay(baseDay + offset), total })),
    updatedAt: cache.updatedAt,
  };
}

/** 日別支出（草グラフ用）を SecureStore に保存し、ウィジェットを即時更新する（fire-and-forget） */
export function saveWidgetHeatmap(days: DailySpend[]): void {
  const updatedAt = new Date().toISOString();

  // 上限に収まるまで古い日から落とす。
  // 表示は新しい日ほど重要なので、古い側を切る。
  let payload = days;
  let serialized = JSON.stringify(compactHeatmap(payload, updatedAt));
  while (serialized.length > SECURE_STORE_BYTES_LIMIT && payload.length > 0) {
    payload = payload.slice(1);
    serialized = JSON.stringify(compactHeatmap(payload, updatedAt));
  }
  if (payload.length !== days.length) {
    console.warn(
      `[saveWidgetHeatmap] SecureStore の上限に収めるため ${days.length - payload.length} 日分を古い側から省きました`,
    );
  }

  SecureStore.setItemAsync(HEATMAP_CACHE_KEY, serialized)
    .then(() =>
      requestWidgetUpdate({
        widgetName: HEATMAP_WIDGET_NAME,
        renderWidget: () => SpendingHeatmapWidget({ days: payload }),
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

    const parsed = JSON.parse(raw) as WidgetHeatmapCacheV2 | WidgetHeatmapCache;

    // アップデート前に書かれた旧形式（days をそのまま持つ）も読めるようにする
    if ('v' in parsed && parsed.v === 2) return expandHeatmap(parsed);
    return parsed as WidgetHeatmapCache;
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
