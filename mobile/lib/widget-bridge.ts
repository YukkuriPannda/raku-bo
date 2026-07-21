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
import type { BalanceData } from '@/types';

const WIDGET_CACHE_KEY = 'widget_remaining_budget';
const WIDGET_NAME = 'RemainingBudget';

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
}

/** 残高を SecureStore に保存し、ホーム画面上のウィジェットを即時更新する（fire-and-forget） */
export function saveWidgetBudget(
  balance: BalanceData,
  month: string,
  recentTransactions: RecentTransactionSummary[]
): void {
  const cache: WidgetBudgetCache = {
    remaining: balance.remaining,
    month,
    updatedAt: new Date().toISOString(),
    recentTransactions,
  };

  SecureStore.setItemAsync(WIDGET_CACHE_KEY, JSON.stringify(cache))
    .then(() =>
      requestWidgetUpdate({
        widgetName: WIDGET_NAME,
        renderWidget: () =>
          RemainingBudgetWidget({ budget: cache.remaining, recentTransactions: cache.recentTransactions }),
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
        renderWidget: () => RemainingBudgetWidget({ budget: null, recentTransactions: [] }),
        widgetNotFound: () => {},
      })
    )
    .catch((error) => console.error('[clearWidgetBudget] エラー:', error));
}
