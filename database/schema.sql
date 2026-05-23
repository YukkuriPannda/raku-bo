-- =============================================================
-- らく〜ぼ（家計簿アプリ）Supabase (PostgreSQL) スキーマ定義
-- =============================================================

-- ---------------------------------------------------------------
-- 拡張機能
-- ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------
-- profiles（ユーザープロフィール）
-- auth.users と 1:1 対応。ユーザー登録時にトリガーで自動作成。
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id                     UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  hourly_wage            INTEGER DEFAULT 0,   -- 時給（円）
  google_calendar_token  TEXT,                -- Google Calendar OAuth Token（暗号化推奨）
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- receipts（レシート画像・OCR結果）
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  image_url       TEXT NOT NULL,  -- Cloudflare R2 のオブジェクトキー
  raw_ocr_result  JSONB,          -- Gemini の生レスポンス
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- transactions（支出・ポイント・収入見込みを統一管理）
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('cash', 'point', 'income_forecast')),
  amount          INTEGER NOT NULL,  -- 金額（円）
  category        TEXT NOT NULL CHECK (category IN (
                    '食費', '交通費', '娯楽', '衣類', '医療',
                    '教育・書籍', 'カフェ・飲み物', '家賃・光熱費', '日用品', 'その他'
                  )),
  payment_method  TEXT CHECK (payment_method IN ('cash', 'card', 'qr')),
  store_name      TEXT,
  receipt_id      UUID REFERENCES public.receipts(id) ON DELETE SET NULL,
  receipt_url     TEXT,                -- R2 の URL キャッシュ
  points_earned   INTEGER DEFAULT 0,  -- 獲得ポイント数
  transacted_at   TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- transaction_items（トランザクションに紐づく商品明細）
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transaction_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id  UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  price           INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- points（ポイント資産）
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,                        -- ポイント名（楽天、PayPay など）
  amount      INTEGER NOT NULL DEFAULT 0,           -- 保有ポイント数
  rate        NUMERIC(10,4) NOT NULL DEFAULT 1.0,  -- 円換算レート（1pt = ?円）
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- インデックス
-- =============================================================

-- transactions: user_id 絞り込み
CREATE INDEX IF NOT EXISTS idx_transactions_user_id
  ON public.transactions(user_id);

-- transactions: 月絞り込み用
CREATE INDEX IF NOT EXISTS idx_transactions_transacted_at
  ON public.transactions(transacted_at);

-- transaction_items: transaction_id 絞り込み
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id
  ON public.transaction_items(transaction_id);

-- points: user_id 絞り込み
CREATE INDEX IF NOT EXISTS idx_points_user_id
  ON public.points(user_id);

-- receipts: user_id 絞り込み
CREATE INDEX IF NOT EXISTS idx_receipts_user_id
  ON public.receipts(user_id);

-- =============================================================
-- updated_at 自動更新トリガー関数
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_points_updated_at
  BEFORE UPDATE ON public.points
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================
-- profiles 自動作成トリガー
-- auth.users にユーザーが登録されたとき、profiles レコードを自動生成する
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- Row Level Security (RLS)
-- =============================================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: 自分のレコードのみ参照可" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles: 自分のレコードのみ更新可" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- INSERT はトリガーが SECURITY DEFINER で行うため、
-- 通常ユーザーによる直接 INSERT は許可しない。
-- 必要であれば以下のポリシーを追加してください:
-- CREATE POLICY "profiles: 自分のレコードのみ作成可" ON public.profiles
--   FOR INSERT WITH CHECK (auth.uid() = id);

-- receipts
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts: 自分のレコードのみ参照可" ON public.receipts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "receipts: 自分のレコードのみ作成可" ON public.receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "receipts: 自分のレコードのみ更新可" ON public.receipts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "receipts: 自分のレコードのみ削除可" ON public.receipts
  FOR DELETE USING (auth.uid() = user_id);

-- transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions: 自分のレコードのみ参照可" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "transactions: 自分のレコードのみ作成可" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions: 自分のレコードのみ更新可" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "transactions: 自分のレコードのみ削除可" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- transaction_items（バックエンドは Service Role Key 経由なので RLS はバイパスされるが念のため設定）
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

-- points
ALTER TABLE public.points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "points: 自分のレコードのみ参照可" ON public.points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "points: 自分のレコードのみ作成可" ON public.points
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "points: 自分のレコードのみ更新可" ON public.points
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "points: 自分のレコードのみ削除可" ON public.points
  FOR DELETE USING (auth.uid() = user_id);
