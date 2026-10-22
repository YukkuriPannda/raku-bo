import type { Transaction } from '@/types';

export interface HistoryExpenseCategory {
  category: string;
  amount: number;
}

export interface HistoryExpenseSummary {
  total: number;
  categories: HistoryExpenseCategory[];
}

export function buildHistoryExpenseSummary(
  transactions: readonly Transaction[]
): HistoryExpenseSummary {
  let total = 0;
  const categoryTotals = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== 'cash') continue;

    total += transaction.amount;
    const category = transaction.category;
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + transaction.amount);
  }

  const categories = Array.from(categoryTotals, ([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return { total, categories };
}
