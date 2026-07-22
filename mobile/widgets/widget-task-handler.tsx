// ============================================================
// widgets/widget-task-handler.tsx
// react-native-android-widget の headless task ハンドラー
//
// アプリ本体とは別の JS コンテキストで動くため、ネットワークや
// 認証には触れず、widget-bridge が書き込んだキャッシュ値を
// 読んで描画するだけにする。
// ============================================================

import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { RemainingBudgetWidget } from './RemainingBudgetWidget';
import { SpendingHeatmapWidget } from './SpendingHeatmapWidget';
import { getWidgetBudget, getWidgetHeatmap } from '@/lib/widget-bridge';

async function renderRemainingBudget(props: WidgetTaskHandlerProps) {
  const cached = await getWidgetBudget();
  props.renderWidget(
    <RemainingBudgetWidget
      budget={cached?.remaining ?? null}
      recentTransactions={cached?.recentTransactions ?? []}
      upcomingPlanned={cached?.upcomingPlanned ?? []}
    />
  );
}

async function renderSpendingHeatmap(props: WidgetTaskHandlerProps) {
  const cached = await getWidgetHeatmap();
  props.renderWidget(<SpendingHeatmapWidget days={cached?.days ?? []} />);
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      if (props.widgetInfo.widgetName === 'SpendingHeatmap') {
        await renderSpendingHeatmap(props);
      } else {
        await renderRemainingBudget(props);
      }
      break;
    }
    case 'WIDGET_DELETED':
    case 'WIDGET_CLICK':
      // WIDGET_DELETED: クリーンアップ対象のバックグラウンドタスクなし
      // WIDGET_CLICK: OPEN_APP/OPEN_URI はネイティブ側で処理されるためここには来ない
      break;
    default:
      break;
  }
}
