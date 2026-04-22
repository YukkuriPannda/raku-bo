import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../types';

/**
 * リクエストごとにSupabaseクライアントを生成する。
 * Cloudflare Workersはグローバル変数を使いまわせないため、
 * 毎回 createClient を呼ぶ設計にしている。
 */
export function createSupabaseClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      // Service Role Key を使うので自動セッション管理は不要
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
