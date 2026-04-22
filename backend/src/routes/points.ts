import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { createSupabaseClient } from '../lib/supabase';

const points = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /points
 * ユーザーのポイント資産一覧を返す。
 */
points.get('/', async (c) => {
  const userId = c.get('userId');

  try {
    const supabase = createSupabaseClient(c.env);

    const { data, error } = await supabase
      .from('points')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('ポイント取得エラー:', error);
      return c.json({ error: 'データの取得に失敗しました' }, 500);
    }

    return c.json({ points: data });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

/**
 * POST /points
 * Body: { name: string, amount: number, rate: number }
 * 新しいポイント資産を追加する。
 */
points.post('/', async (c) => {
  const userId = c.get('userId');

  let body: { name?: unknown; amount?: unknown; rate?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディのJSONが不正です' }, 400);
  }

  const { name, amount, rate } = body;

  if (typeof name !== 'string' || !name.trim()) {
    return c.json({ error: 'name は必須の文字列です' }, 400);
  }
  if (typeof amount !== 'number' || amount < 0) {
    return c.json({ error: 'amount は0以上の数値です' }, 400);
  }
  if (typeof rate !== 'number' || rate <= 0) {
    return c.json({ error: 'rate は0より大きい数値です（1pt = ?円）' }, 400);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    const { data, error } = await supabase
      .from('points')
      .insert({ user_id: userId, name: name.trim(), amount, rate })
      .select()
      .single();

    if (error) {
      console.error('ポイント作成エラー:', error);
      return c.json({ error: 'ポイントの作成に失敗しました' }, 500);
    }

    return c.json({ point: data }, 201);
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

/**
 * PATCH /points/:id
 * Body: { amount: number }
 * ポイント残高を更新する。
 */
points.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  let body: { amount?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディのJSONが不正です' }, 400);
  }

  const { amount } = body;
  if (typeof amount !== 'number' || amount < 0) {
    return c.json({ error: 'amount は0以上の数値です' }, 400);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    const { data, error } = await supabase
      .from('points')
      .update({ amount, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId) // 自分のデータのみ更新可能
      .select()
      .single();

    if (error) {
      console.error('ポイント更新エラー:', error);
      return c.json({ error: 'ポイントの更新に失敗しました' }, 500);
    }

    if (!data) {
      return c.json({ error: '指定されたポイントが見つかりません' }, 404);
    }

    return c.json({ point: data });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

/**
 * DELETE /points/:id
 * ポイント資産を削除する。
 */
points.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  try {
    const supabase = createSupabaseClient(c.env);

    const { error } = await supabase
      .from('points')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // 自分のデータのみ削除可能

    if (error) {
      console.error('ポイント削除エラー:', error);
      return c.json({ error: 'ポイントの削除に失敗しました' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

export default points;
