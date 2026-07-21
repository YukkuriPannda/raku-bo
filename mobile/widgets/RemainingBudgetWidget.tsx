// ============================================================
// widgets/RemainingBudgetWidget.tsx
// Android ホーム画面ウィジェット
// react-native-android-widget を使用して今月の残り使える額を表示
// ============================================================

import { FlexWidget, TextWidget } from 'react-native-android-widget';

// ============================================================
// Props 定義
// ============================================================
interface RemainingBudgetWidgetProps {
  budget: number | null; // 残り使える額（円）。未ログイン/未取得時は null
}

// ============================================================
// ウィジェットコンポーネント
// ============================================================
export function RemainingBudgetWidget({ budget }: RemainingBudgetWidgetProps) {
  // 残額に応じて色を変更（正: 緑、負: 赤、未取得: グレー）
  const color = budget === null ? '#9ca3af' : budget >= 0 ? '#22c55e' : '#ef4444';

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
      }}
    >
      {/* 上部ラベル */}
      <TextWidget
        text="今月あと"
        style={{ fontSize: 14, color: '#6b7280' }}
      />

      {/* 残額（メイン表示） */}
      <TextWidget
        text={budget === null ? '¥ ---' : `¥${budget.toLocaleString('ja-JP')}`}
        style={{ fontSize: 32, fontWeight: 'bold', color }}
      />

      {/* 下部ラベル */}
      <TextWidget
        text={budget === null ? 'ひらいて更新' : '使える'}
        style={{ fontSize: 14, color: '#6b7280' }}
      />
    </FlexWidget>
  );
}
