// ============================================================
// widgets/RemainingBudgetWidget.tsx
// Android ホーム画面ウィジェット
// react-native-android-widget を使用して今月の残り使える額を表示
// ============================================================

import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { RecentTransactionSummary } from '@/lib/widget-bridge';

// ============================================================
// Props 定義
// ============================================================
interface RemainingBudgetWidgetProps {
  budget: number | null; // 残り使える額（円）。未ログイン/未取得時は null
  recentTransactions?: RecentTransactionSummary[]; // 直近の支出（最大2件）
}

// ============================================================
// ウィジェットコンポーネント
// ============================================================
export function RemainingBudgetWidget({ budget, recentTransactions = [] }: RemainingBudgetWidgetProps) {
  // 残額に応じて色を変更（正: 緑、負: 赤、未取得: グレー）
  const color = budget === null ? '#9ca3af' : budget >= 0 ? '#22c55e' : '#ef4444';

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
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

      {/* 直近の支出（最大2件） */}
      {recentTransactions.length > 0 && (
        <FlexWidget style={{ width: 'match_parent', marginTop: 8 }}>
          {recentTransactions.slice(0, 2).map((tx, i) => (
            <FlexWidget
              key={i}
              style={{
                width: 'match_parent',
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 14,
              }}
            >
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text={tx.label}
                  truncate="END"
                  maxLines={1}
                  style={{ fontSize: 11, color: '#9ca3af' }}
                />
              </FlexWidget>
              <TextWidget
                text={`¥${tx.amount.toLocaleString('ja-JP')}`}
                style={{ fontSize: 11, color: '#6b7280' }}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      )}

      {/* レシート撮影ボタン */}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'rakubo://screens/camera' }}
        style={{
          width: 'match_parent',
          marginTop: 10,
          marginHorizontal: 14,
          paddingVertical: 8,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#1B7F4F',
          borderRadius: 10,
        }}
      >
        <TextWidget
          text="📷 レシートを撮影"
          style={{ fontSize: 12, fontWeight: '600', color: '#ffffff' }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
