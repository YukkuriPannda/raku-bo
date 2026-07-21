import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { createSupabaseClient } from '../lib/supabase';

const plannedExpenditures = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /planned-expenditures?month=YYYY-MM
 *
 * 当月に有効な予定支出を返す。
 * - subscription + is_active=true:
 *   - monthly → 常に含める
 *   - yearly  → billing_month が当月と一致する場合のみ
 * - calendar: event_date が当月範囲内
 */
plannedExpenditures.get('/', async (c) => {
  const userId = c.get('userId');
  const monthParam = c.req.query('month');

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

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  try {
    const supabase = createSupabaseClient(c.env);

    const { data, error } = await supabase
      .from('planned_expenditures')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('予定支出取得エラー:', error);
      return c.json({ error: 'データの取得に失敗しました' }, 500);
    }

    // フィルタリング
    const filtered = (data ?? []).filter((item) => {
      if (item.entry_type === 'subscription') {
        if (!item.is_active) return false;
        if (item.billing_cycle === 'yearly') {
          return item.billing_month === month;
        }
        // monthly は常に含める
        return true;
      }
      if (item.entry_type === 'calendar') {
        if (!item.event_date) return false;
        return item.event_date >= startDate && item.event_date < endDate;
      }
      return false;
    });

    return c.json(filtered);
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

/**
 * POST /planned-expenditures
 * 予定支出を新規登録する。
 */
plannedExpenditures.post('/', async (c) => {
  const userId = c.get('userId');
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディの解析に失敗しました' }, 400);
  }

  const { entry_type, amount, category, payment_method, memo } = body;

  if (!entry_type || !amount || !category || !payment_method) {
    return c.json({ error: 'entry_type, amount, category, payment_method は必須です' }, 400);
  }

  // entry_type 別バリデーション
  if (entry_type === 'subscription') {
    const { service_name, billing_cycle, billing_day } = body;
    if (!service_name || !billing_cycle || !billing_day) {
      return c.json({ error: 'subscription には service_name, billing_cycle, billing_day が必須です' }, 400);
    }
    if (billing_cycle === 'yearly' && !body.billing_month) {
      return c.json({ error: 'yearly サブスクには billing_month が必須です' }, 400);
    }
  } else if (entry_type === 'calendar') {
    const { calendar_event_id, calendar_event_title, event_date } = body;
    if (!calendar_event_id || !calendar_event_title || !event_date) {
      return c.json({ error: 'calendar には calendar_event_id, calendar_event_title, event_date が必須です' }, 400);
    }
  } else {
    return c.json({ error: 'entry_type は subscription または calendar である必要があります' }, 400);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    const insertData: Record<string, unknown> = {
      user_id: userId,
      entry_type,
      amount,
      category,
      payment_method,
      memo: memo ?? null,
    };

    if (entry_type === 'subscription') {
      insertData.service_name = body.service_name;
      insertData.billing_cycle = body.billing_cycle;
      insertData.billing_day = body.billing_day;
      insertData.billing_month = body.billing_month ?? null;
      insertData.is_active = true;
    } else {
      insertData.calendar_event_id = body.calendar_event_id;
      insertData.calendar_event_title = body.calendar_event_title;
      insertData.event_date = body.event_date;
    }

    const { data, error } = await supabase
      .from('planned_expenditures')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('予定支出作成エラー:', error);
      return c.json({ error: '保存に失敗しました' }, 500);
    }

    return c.json(data, 201);
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

/**
 * PATCH /planned-expenditures/:id
 * 予定支出を更新する（主にサブスクの金額・停止・再開）。
 */
plannedExpenditures.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディの解析に失敗しました' }, 400);
  }

  const allowedFields = [
    'amount', 'category', 'payment_method', 'memo',
    'service_name', 'billing_cycle', 'billing_day', 'billing_month', 'is_active',
  ];
  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updateData[field] = body[field];
  }

  if (Object.keys(updateData).length === 0) {
    return c.json({ error: '更新フィールドがありません' }, 400);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    const { data, error } = await supabase
      .from('planned_expenditures')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('予定支出更新エラー:', error);
      return c.json({ error: '更新に失敗しました' }, 500);
    }

    return c.json(data);
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

/**
 * POST /planned-expenditures/:id/complete
 *
 * カレンダー連動型（entry_type='calendar'）の予定支出を「完了」させる。
 * transactions に実績として1件insertし、planned_expenditures から削除する。
 * サブスク型は繰り返し予定のため対象外（400）。
 */
plannedExpenditures.post('/:id/complete', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  try {
    const supabase = createSupabaseClient(c.env);

    const { data: planned, error: fetchError } = await supabase
      .from('planned_expenditures')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !planned) {
      return c.json({ error: '予定支出が見つかりません' }, 404);
    }

    if (planned.entry_type !== 'calendar') {
      return c.json({ error: 'カレンダー連動型の予定支出のみ完了できます' }, 400);
    }

    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'cash',
        amount: planned.amount,
        category: planned.category,
        payment_method: planned.payment_method,
        store_name: planned.calendar_event_title,
        points_earned: 0,
        transacted_at: `${planned.event_date}T00:00:00Z`,
      })
      .select()
      .single();

    if (insertError) {
      console.error('完了時のトランザクション作成エラー:', insertError);
      return c.json({ error: '支出履歴への登録に失敗しました' }, 500);
    }

    const { error: deleteError } = await supabase
      .from('planned_expenditures')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('完了時の予定支出削除エラー:', deleteError);
      // 補償削除: 作成済みのtransactionをロールバックする
      await supabase.from('transactions').delete().eq('id', transaction.id);
      return c.json({ error: '予定支出の完了処理に失敗しました' }, 500);
    }

    return c.json(transaction, 201);
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

/**
 * DELETE /planned-expenditures/:id
 */
plannedExpenditures.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  try {
    const supabase = createSupabaseClient(c.env);

    const { error } = await supabase
      .from('planned_expenditures')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('予定支出削除エラー:', error);
      return c.json({ error: '削除に失敗しました' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

export default plannedExpenditures;
