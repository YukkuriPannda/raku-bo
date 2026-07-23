// ============================================================
// lib/heatmap.ts
// 支出の「草グラフ」（GitHub風ヒートマップ）を組み立てる共通ロジック
// ホーム画面 (React Native View) と Android ウィジェット (FlexWidget) の
// 両方から使われるため、UIに依存しない純粋な計算だけをここに置く
// ============================================================

import type { DailySpend } from './widget-bridge';

// 色スケール（out-of-range → level0（¥0） → level4（最大）の順で濃くなる）
export const OUT_OF_RANGE_COLOR = '#F3F4F6';
export const LEVEL_COLORS = ['#EBEDF0', '#C6E8D1', '#7CC79A', '#3B9E63', '#1B7F4F'] as const;

export type HeatmapCell = { level: number } | null; // null = 範囲外（データ開始日より前 or 未来）

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
export function buildRollingCells(days: DailySpend[]): HeatmapCell[] {
  if (days.length === 0) return [];

  const totalByDate = new Map(days.map((d) => [d.date, d.total]));
  const max = Math.max(0, ...days.map((d) => d.total));

  const startDate = parseDateKey(days[0].date);
  const endDate = parseDateKey(days[days.length - 1].date);

  const gridStart = new Date(startDate);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay()); // 直前の日曜まで遡る
  const gridEnd = new Date(endDate);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay())); // 直後の土曜まで進める

  const cells: HeatmapCell[] = [];
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

/** セル配列を1列 = 1週間（7日）単位に分割する */
export function chunkIntoWeeks(cells: HeatmapCell[]): HeatmapCell[][] {
  const out: HeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
  return out;
}
