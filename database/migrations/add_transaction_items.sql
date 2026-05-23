-- =============================================================
-- マイグレーション: transaction_items テーブル追加
-- Supabase Dashboard > SQL Editor で実行してください
-- =============================================================

CREATE TABLE IF NOT EXISTS public.transaction_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id  UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  price           INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id
  ON public.transaction_items(transaction_id);

ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_items: 自分のレコードのみ参照可" ON public.transaction_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
  );

CREATE POLICY "transaction_items: 自分のレコードのみ作成可" ON public.transaction_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
  );

CREATE POLICY "transaction_items: 自分のレコードのみ削除可" ON public.transaction_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
  );
