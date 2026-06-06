import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { createSupabaseClient } from '../lib/supabase';

const profile = new Hono<{ Bindings: Env; Variables: Variables }>();

const DEFAULT_KEYWORDS = ['バイト', 'シフト', '出勤', '勤務'];

/**
 * GET /profile
 * ユーザーのプロフィール（時給・シフトキーワード）を返す。
 */
profile.get('/', async (c) => {
  const userId = c.get('userId');
  const supabase = createSupabaseClient(c.env);

  const { data, error } = await supabase
    .from('profiles')
    .select('hourly_wage, shift_keywords')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('プロフィール取得エラー:', error);
    return c.json({ error: 'プロフィールの取得に失敗しました' }, 500);
  }

  return c.json({
    hourly_wage: data.hourly_wage ?? 0,
    shift_keywords: (data.shift_keywords && data.shift_keywords.length > 0)
      ? data.shift_keywords
      : DEFAULT_KEYWORDS,
  });
});

/**
 * PATCH /profile
 * Body: { hourly_wage?: number, shift_keywords?: string[] }
 * 指定されたフィールドのみ更新する。
 */
profile.patch('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ hourly_wage?: number; shift_keywords?: string[] }>();

  const updates: Record<string, unknown> = {};
  if (body.hourly_wage !== undefined) updates.hourly_wage = body.hourly_wage;
  if (body.shift_keywords !== undefined) updates.shift_keywords = body.shift_keywords;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: '更新するフィールドがありません' }, 400);
  }

  const supabase = createSupabaseClient(c.env);

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('プロフィール更新エラー:', error);
    return c.json({ error: 'プロフィールの更新に失敗しました' }, 500);
  }

  return c.json({ ok: true });
});

export default profile;
