import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { createSupabaseClient } from '../lib/supabase';

const transactions = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /transactions?month=2026-04
 * 当該月のトランザクション一覧を返す（type='cash'）。
 * month パラメータ省略時は今月。
 */
transactions.get('/', async (c) => {
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
    // 省略時は今月
    const now = new Date();
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1;
  }

  // 月初・月末の日付を生成
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  try {
    const supabase = createSupabaseClient(c.env);

    let { data, error } = await supabase
      .from('transactions')
      .select('*, items:transaction_items(*)')
      .eq('user_id', userId)
      .eq('type', 'cash')
      .gte('transacted_at', startDate)
      .lt('transacted_at', endDate)
      .order('transacted_at', { ascending: false });

    // transaction_items テーブルが未作成の場合は items なしで再取得
    if (error?.code === 'PGRST200') {
      ({ data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'cash')
        .gte('transacted_at', startDate)
        .lt('transacted_at', endDate)
        .order('transacted_at', { ascending: false }));
    }

    if (error) {
      console.error('トランザクション取得エラー:', error);
      return c.json({ error: 'データの取得に失敗しました' }, 500);
    }

    return c.json(data);
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

/**
 * POST /transactions
 * 確認画面からトランザクションを手動登録する。
 * Body: { type, amount, category, payment_method, store_name?, receipt_id?, receipt_url?, transacted_at }
 */
transactions.post('/', async (c) => {
  const userId = c.get('userId');
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディの解析に失敗しました' }, 400);
  }

  const { type, amount, category, payment_method, store_name, receipt_id, receipt_url, transacted_at, items } = body;

  // バリデーション
  if (!type || !amount || !category || !transacted_at) {
    return c.json({ error: 'type, amount, category, transacted_at は必須です' }, 400);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type,
        amount,
        category,
        payment_method: payment_method ?? 'cash',
        store_name: store_name ?? null,
        receipt_id: receipt_id ?? null,
        receipt_url: receipt_url ?? null,
        transacted_at,
      })
      .select()
      .single();

    if (error) {
      console.error('トランザクション作成エラー:', error);
      return c.json({ error: 'トランザクションの保存に失敗しました' }, 500);
    }

    // items が指定されていれば transaction_items に一括 insert
    let savedItems: unknown[] = [];
    if (Array.isArray(items) && items.length > 0) {
      const rows = items
        .filter((it): it is { name: string; price: number } =>
          typeof it === 'object' && it !== null &&
          typeof (it as { name?: unknown }).name === 'string' &&
          typeof (it as { price?: unknown }).price === 'number'
        )
        .map((it) => ({
          transaction_id: data.id,
          name: it.name,
          price: it.price,
        }));

      if (rows.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('transaction_items')
          .insert(rows)
          .select();

        if (itemsError) {
          console.error('商品アイテム保存エラー:', itemsError);
          // transaction を rollback（compensating delete）
          await supabase.from('transactions').delete().eq('id', data.id);
          return c.json({ error: '商品アイテムの保存に失敗しました' }, 500);
        }
        savedItems = itemsData ?? [];
      }
    }

    return c.json({ ...data, items: savedItems }, 201);
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

/**
 * PATCH /transactions/:id
 * 指定IDのトランザクションを更新する。items は全削除→再 insert で置き換える。
 */
transactions.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディの解析に失敗しました' }, 400);
  }

  const { amount, category, payment_method, store_name, transacted_at, items } = body;

  try {
    const supabase = createSupabaseClient(c.env);

    const { data, error } = await supabase
      .from('transactions')
      .update({ amount, category, payment_method, store_name: store_name ?? null, transacted_at })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('トランザクション更新エラー:', error);
      return c.json({ error: '更新に失敗しました' }, 500);
    }

    // items を全削除→再 insert（置き換え）
    await supabase.from('transaction_items').delete().eq('transaction_id', id);

    let savedItems: unknown[] = [];
    if (Array.isArray(items) && items.length > 0) {
      const rows = items
        .filter((it): it is { name: string; price: number } =>
          typeof it === 'object' && it !== null &&
          typeof (it as { name?: unknown }).name === 'string' &&
          typeof (it as { price?: unknown }).price === 'number'
        )
        .map((it) => ({ transaction_id: id, name: it.name, price: it.price }));
      if (rows.length > 0) {
        const { data: itemsData } = await supabase
          .from('transaction_items')
          .insert(rows)
          .select();
        savedItems = itemsData ?? [];
      }
    }

    return c.json({ ...data, items: savedItems });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

/**
 * DELETE /transactions/:id
 * 指定IDのトランザクションを削除する。
 */
transactions.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  try {
    const supabase = createSupabaseClient(c.env);

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('トランザクション削除エラー:', error);
      return c.json({ error: '削除に失敗しました' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

export default transactions;
