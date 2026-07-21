import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { createSupabaseClient } from '../lib/supabase';

const balance = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /balance?month=2026-04
 *
 * 計算式:
 *   月収見込み（このエンドポイントでは0、フロントでシフト計算と合算）
 *   - 今月支出合計（transactions テーブルから）
 *
 * month 省略時は今月。
 */
balance.get('/', async (c) => {
  const userId = c.get('userId');
  const monthParam = c.req.query('month');

  // month パラメータのパース（YYYY-MM 形式）
  let year: number;
  let month: number;

  if (monthParam) {
    const parts = monthParam.split('-');
    if (parts.length !== 2) {
      return c.json({ error: 'month パラメータは YYYY-MM 形式で指定してください' }, 400);
    }
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else {
    const now = new Date();
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1;
  }

  // 月初・月末
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  try {
    const supabase = createSupabaseClient(c.env);

    // 今月の支出合計（type='cash' のみ集計）
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'cash')
      .gte('transacted_at', startDate)
      .lt('transacted_at', endDate);

    if (txError) {
      console.error('支出取得エラー:', txError);
      return c.json({ error: '支出データの取得に失敗しました' }, 500);
    }

    const totalExpense = (txData ?? []).reduce((sum, tx) => sum + (tx.amount ?? 0), 0);

    // 月収見込みはフロントでシフト計算と合算するため0
    const incomeForecast = 0;

    const availableBalance = incomeForecast - totalExpense;

    return c.json({
      month: `${year}-${String(month).padStart(2, '0')}`,
      income_forecast: incomeForecast,
      total_expense: totalExpense,
      available_balance: availableBalance,
    });
  } catch (error) {
    console.error('残高計算エラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

export default balance;
