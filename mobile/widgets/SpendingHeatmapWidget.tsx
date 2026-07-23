// ============================================================
// widgets/SpendingHeatmapWidget.tsx
// Android ホーム画面ウィジェット
// GitHub の草グラフ風に、直近約2ヶ月分の支出額を日ごとの色の濃さで表示する
// ============================================================

import { FlexWidget } from 'react-native-android-widget';
import type { DailySpend } from '@/lib/widget-bridge';
import { buildFixedCells, chunkIntoWeeks, LEVEL_COLORS, OUT_OF_RANGE_COLOR, type HeatmapCell } from '@/lib/heatmap';

// ============================================================
// Props 定義
// ============================================================
interface SpendingHeatmapWidgetProps {
  days: DailySpend[]; // 直近WEEKS*7日分（日付昇順）の日別支出合計
}

// 常に7行×15列に固定する（ウィジェットサイズに関わらずはみ出さないよう、
// マス目は固定pxではなく flex の比率でウィジェット幅・高さいっぱいに配分する）
const WEEKS = 15;
const CELL_GAP = 1;

function DaySquare({ cell, isLastRow }: { cell: HeatmapCell; isLastRow: boolean }) {
  return (
    <FlexWidget
      style={{
        flex: 1,
        width: 'match_parent',
        marginBottom: isLastRow ? 0 : CELL_GAP,
        borderRadius: 2,
        backgroundColor: cell === null ? OUT_OF_RANGE_COLOR : LEVEL_COLORS[cell.level],
      }}
    />
  );
}

// ============================================================
// ウィジェットコンポーネント
// ============================================================
export function SpendingHeatmapWidget({ days }: SpendingHeatmapWidgetProps) {
  const cells = buildFixedCells(days, WEEKS);
  const columns = chunkIntoWeeks(cells); // 1列 = 1週間（7日）、常にWEEKS列

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'rakubo://history' }}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        padding: 4,
      }}
    >
      {/* 週×曜日のグリッド。列・行とも flex:1 でウィジェット領域に比例配分するため、
          サイズに関わらず常に7行×WEEKS列の枠内に収まる */}
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', height: 'match_parent' }}>
        {columns.map((column, ci) => (
          <FlexWidget
            key={ci}
            style={{
              flex: 1,
              flexDirection: 'column',
              height: 'match_parent',
              marginRight: ci === columns.length - 1 ? 0 : CELL_GAP,
            }}
          >
            {column.map((cell, ri) => (
              <DaySquare key={ri} cell={cell} isLastRow={ri === column.length - 1} />
            ))}
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
