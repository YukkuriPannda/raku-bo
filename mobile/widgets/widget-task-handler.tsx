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
import { getWidgetBudget } from '@/lib/widget-bridge';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const cached = await getWidgetBudget();
      props.renderWidget(<RemainingBudgetWidget budget={cached?.remaining ?? null} />);
      break;
    }
    case 'WIDGET_DELETED':
    case 'WIDGET_CLICK':
      // WIDGET_DELETED: クリーンアップ対象のバックグラウンドタスクなし
      // WIDGET_CLICK: clickAction="OPEN_APP" はネイティブ側で処理されるためここには来ない
      break;
    default:
      break;
  }
}
