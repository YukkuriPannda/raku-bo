// ============================================================
// widgets/SpendingHeatmapWidget.tsx
// Android ホーム画面ウィジェット
// GitHub の草グラフ風に、直近約2ヶ月分の支出額を日ごとの色の濃さで表示する
// ============================================================

import { FlexWidget } from 'react-native-android-widget';
import type { DailySpend } from '@/lib/widget-bridge';

// ============================================================
// Props 定義
// ============================================================
interface SpendingHeatmapWidgetProps {
  days: DailySpend[]; // 直近約63日分（日付昇順）の日別支出合計
}

// ============================================================
// 色スケール（out-of-range → level0（¥0） → level4（最大）の順で濃くなる）
// ============================================================
const OUT_OF_RANGE_COLOR = '#F3F4F6';
const LEVEL_COLORS = ['#EBEDF0', '#C6E8D1', '#7CC79A', '#3B9E63', '#1B7F4F'] as const;

type Cell = { level: number } | null; // null = 範囲外（データ開始日より前 or 未来）

function levelFor(total: number, max: number): number {
  if (total === 0 || max === 0) return 0;
  const r = total / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 実際の日付範囲（daysの先頭〜末尾）を、週境界（日曜始まり）に揃えたセル配列にする */
function buildRollingCells(days: DailySpend[]): Cell[] {
  if (days.length === 0) return [];

  const totalByDate = new Map(days.map((d) => [d.date, d.total]));
  const max = Math.max(0, ...days.map((d) => d.total));

  const startDate = parseDateKey(days[0].date);
  const endDate = parseDateKey(days[days.length - 1].date);

  const gridStart = new Date(startDate);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay()); // 直前の日曜まで遡る
  const gridEnd = new Date(endDate);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay())); // 直後の土曜まで進める

  const cells: Cell[] = [];
  for (const d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    const total = totalByDate.get(toDateKey(d));
    if (d < startDate || d > endDate || total === undefined) {
      cells.push(null);
    } else {
      cells.push({ level: levelFor(total, max) });
    }
  }
  return cells;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 90dp四方（2x1セル）に7行 × 9〜10週を収めるため小さめのマスにする
const CELL_SIZE = 9;
const CELL_GAP = 2;

function DaySquare({ cell }: { cell: Cell }) {
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
  const columns = chunk(cells, 7); // 1列 = 1週間（7日）

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
