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

/** daysの先頭日を含む週の開始日（直前の日曜）を返す */
function computeGridStart(days: DailySpend[]): Date {
  const startDate = parseDateKey(days[0].date);
  const gridStart = new Date(startDate);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  return gridStart;
}

/** 実際の日付範囲（daysの先頭〜末尾）を、週境界（日曜始まり）に揃えたセル配列にする */
export function buildRollingCells(days: DailySpend[]): HeatmapCell[] {
  if (days.length === 0) return [];

  const totalByDate = new Map(days.map((d) => [d.date, d.total]));
  const max = Math.max(0, ...days.map((d) => d.total));

  const startDate = parseDateKey(days[0].date);
  const endDate = parseDateKey(days[days.length - 1].date);

  const gridStart = computeGridStart(days);
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

/**
 * buildRollingCells が作る列（週）ごとに月ラベルを割り当てる。
 * GitHubの草グラフと同じく、月が変わる列にだけラベルを立てる（それ以外はnull）。
 */
export function buildMonthLabels(days: DailySpend[], columnCount: number): (string | null)[] {
  if (days.length === 0) return Array(columnCount).fill(null);

  const gridStart = computeGridStart(days);
  const labels: (string | null)[] = [];
  let prevMonth = -1;
  for (let i = 0; i < columnCount; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i * 7);
    const month = d.getMonth();
    labels.push(month !== prevMonth ? `${month + 1}月` : null);
    prevMonth = month;
  }
  return labels;
}

/**
 * 暦週（日曜始まり）に揃えず、直近 weeks*7 日を固定サイズのセル配列にする。
 * buildRollingCells は開始日の曜日次第で列数が9〜10列とぶれるため、
 * 列数を固定したいウィジェット表示ではこちらを使う（データ不足分は先頭を範囲外セルで埋める）。
 */
export function buildFixedCells(days: DailySpend[], weeks: number): HeatmapCell[] {
  const totalDays = weeks * 7;
  const max = Math.max(0, ...days.map((d) => d.total));
  const recent = days.slice(-totalDays);
  const padCount = totalDays - recent.length;

  return [
    ...Array.from({ length: padCount }, (): HeatmapCell => null),
    ...recent.map((d): HeatmapCell => ({ level: levelFor(d.total, max) })),
  ];
}
