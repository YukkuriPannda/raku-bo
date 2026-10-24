import type { Transaction } from '@/types';

/**
 * 建て替え分の金額。
 *
 * レシート単位の `is_advance` が立っていれば全額、そうでなければ
 * 建て替えフラグの付いた明細（`items[].is_advance`）の合計。
 * 明細が無い／フラグが無い既存の記録は 0 になるため、従来の
 * 「`is_advance` なら全額」と同じ結果になる。
 *
 * 税・値引き・端数が明細に乗らないレシートでは明細合計が amount を
 * 超えることがあるので amount で丸める（自己支出を負にしない）。
 */
export function advanceAmount(transaction: Transaction): number {
  if (transaction.is_advance) return transaction.amount;
  const items = transaction.items;
  if (!items || items.length === 0) return 0;
  let total = 0;
  for (const item of items) {
    if (item.is_advance) total += item.price;
  }
  return Math.min(total, transaction.amount);
}

/** 自分の支出分の金額（支払総額 − 建て替え分） */
export function selfAmount(transaction: Transaction): number {
  return transaction.amount - advanceAmount(transaction);
}

/** 明細単位の建て替えだけがある（レシート全体の建て替えではない）状態 */
export function hasItemAdvance(transaction: Transaction): boolean {
  return !transaction.is_advance && advanceAmount(transaction) > 0;
}
