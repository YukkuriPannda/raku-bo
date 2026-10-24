-- ---------------------------------------------------------------
-- マイグレーション: transaction_items に建て替えフラグを追加
--
-- レシート1枚のなかに自分の購入品と他人のための立替が混在する場合に、
-- 明細行ごとに建て替えかどうかを持たせる。
-- 既存行は FALSE になるため、従来どおりトランザクションの
-- is_advance だけで判定した結果と一致する（後方互換）。
-- ---------------------------------------------------------------

ALTER TABLE public.transaction_items
  ADD COLUMN IF NOT EXISTS is_advance BOOLEAN NOT NULL DEFAULT FALSE;
