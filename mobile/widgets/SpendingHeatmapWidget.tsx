// ============================================================
// widgets/SpendingHeatmapWidget.tsx
// Android ホーム画面ウィジェット
// GitHub の草グラフ風に、直近約2ヶ月分の支出額を日ごとの色の濃さで表示する
// ============================================================

import { FlexWidget } from 'react-native-android-widget';
import type { DailySpend } from '@/lib/widget-bridge';
import { buildRollingCells, chunkIntoWeeks, LEVEL_COLORS, OUT_OF_RANGE_COLOR, type HeatmapCell } from '@/lib/heatmap';

// ============================================================
// Props 定義
// ============================================================
interface SpendingHeatmapWidgetProps {
  days: DailySpend[]; // 直近約63日分（日付昇順）の日別支出合計
}

// 90dp四方（2x1セル）に7行 × 9〜10週を収めるため小さめのマスにする
const CELL_SIZE = 9;
const CELL_GAP = 2;

function DaySquare({ cell }: { cell: HeatmapCell }) {
  return (
    <FlexWidget
      style={{
        width: CELL_SIZE,
        height: CELL_SIZE,
        marginRight: CELL_GAP,
        marginBottom: CELL_GAP,
        borderRadius: 3,
        backgroundColor: cell === null ? OUT_OF_RANGE_COLOR : LEVEL_COLORS[cell.level],
      }}
    />
  );
}

// ============================================================
// ウィジェットコンポーネント
// ============================================================
export function SpendingHeatmapWidget({ days }: SpendingHeatmapWidgetProps) {
  const cells = buildRollingCells(days);
  const columns = chunkIntoWeeks(cells); // 1列 = 1週間（7日）

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'rakubo://history' }}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* 週×曜日のグリッド（GitHubの草グラフと同じく、マス目だけのシンプルな構成） */}
      <FlexWidget style={{ flexDirection: 'row' }}>
        {columns.map((column, ci) => (
          <FlexWidget key={ci} style={{ flexDirection: 'column' }}>
            {column.map((cell, ri) => (
              <DaySquare key={ri} cell={cell} />
            ))}
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
