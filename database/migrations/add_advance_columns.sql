-- =============================================================
-- transactions に「建て替え」区分と返済完了フラグを追加する
--
-- is_advance : 立て替え払い（他人の分を自分が払った）かどうか。
--              自分の支出ではないため残額計算からは常に除外する。
-- settled_at : 返済された日時。NULL のあいだは未回収として扱う。
--
-- type は 'cash' のまま運用する（一覧取得・草グラフ・集計がすべて
-- type='cash' を前提にしているため、区分は独立したフラグで表現する）。
-- =============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_advance BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- 未回収の建て替えを引くためのインデックス（建て替えの行だけを対象にする）
CREATE INDEX IF NOT EXISTS idx_transactions_user_advance
  ON public.transactions(user_id, is_advance)
  WHERE is_advance;
