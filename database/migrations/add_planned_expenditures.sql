-- =============================================================
-- 予定された支出（planned_expenditures）テーブルの追加
-- =============================================================

CREATE TABLE IF NOT EXISTS public.planned_expenditures (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  entry_type           TEXT NOT NULL CHECK (entry_type IN ('subscription', 'calendar')),

  -- 共通フィールド
  amount               INTEGER NOT NULL,
  category             TEXT NOT NULL CHECK (category IN (
                         '食費', '交通費', '娯楽', '衣類', '医療',
                         '教育・書籍', 'カフェ・飲み物', '家賃・光熱費', '日用品', 'その他'
                       )),
  payment_method       TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'qr')),
  memo                 TEXT,

  -- サブスク用フィールド（entry_type = 'subscription'）
  service_name         TEXT,
  billing_cycle        TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
  billing_day          INTEGER CHECK (billing_day BETWEEN 1 AND 31),
  billing_month        INTEGER CHECK (billing_month BETWEEN 1 AND 12),
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,

  -- カレンダー連動用フィールド（entry_type = 'calendar'）
  calendar_event_id    TEXT,
  calendar_event_title TEXT,
  event_date           DATE,

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_planned_expenditures_user_id
  ON public.planned_expenditures(user_id);

CREATE INDEX IF NOT EXISTS idx_planned_expenditures_user_active
  ON public.planned_expenditures(user_id, entry_type, is_active);

-- updated_at 自動更新トリガー
CREATE TRIGGER trg_planned_expenditures_updated_at
  BEFORE UPDATE ON public.planned_expenditures
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security
ALTER TABLE public.planned_expenditures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planned_expenditures: 自分のレコードのみ参照可" ON public.planned_expenditures
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "planned_expenditures: 自分のレコードのみ作成可" ON public.planned_expenditures
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "planned_expenditures: 自分のレコードのみ更新可" ON public.planned_expenditures
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "planned_expenditures: 自分のレコードのみ削除可" ON public.planned_expenditures
  FOR DELETE USING (auth.uid() = user_id);
