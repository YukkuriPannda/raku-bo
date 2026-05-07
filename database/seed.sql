-- =============================================================
-- らく〜ぼ 開発用サンプルデータ（seed）
-- 本番環境では実行しないこと。
-- 実行する場合は各ブロックのコメントアウトを外してください。
-- =============================================================

-- ---------------------------------------------------------------
-- 注意:
--   - auth.users への直接 INSERT は Supabase ダッシュボードの
--     「Authentication > Users」から行うか、
--     supabase CLI の `supabase auth create-user` を使用してください。
--   - 下記の UUID は仮の値です。実際のユーザー UUID に置き換えてください。
-- ---------------------------------------------------------------

/*

-- サンプルユーザーの UUID（auth.users で作成した UUID に合わせる）
DO $$
DECLARE
  v_user_id UUID := 'aaaaaaaa-0000-0000-0000-000000000001';
BEGIN

  -- profiles（トリガーで自動作成されるが、hourly_wage だけ更新）
  UPDATE public.profiles
  SET hourly_wage = 1200
  WHERE id = v_user_id;

  -- receipts
  INSERT INTO public.receipts (id, user_id, image_url, raw_ocr_result)
  VALUES (
    'bbbbbbbb-0000-0000-0000-000000000001',
    v_user_id,
    'receipts/sample-receipt-001.jpg',
    '{
      "store_name": "セブンイレブン 渋谷店",
      "date": "2026-04-20",
      "items": [
        {"name": "おにぎり 鮭", "price": 150},
        {"name": "お茶 500ml", "price": 120}
      ],
      "total_amount": 270,
      "category": "食費",
      "payment_method": "qr",
      "points_earned": 3
    }'::JSONB
  ) ON CONFLICT DO NOTHING;

  -- transactions
  INSERT INTO public.transactions
    (user_id, type, amount, category, payment_method, store_name, receipt_id, points_earned, transacted_at)
  VALUES
    -- コンビニ購入
    (v_user_id, 'cash', 270, '食費', 'qr', 'セブンイレブン 渋谷店',
     'bbbbbbbb-0000-0000-0000-000000000001', 3, '2026-04-20 12:30:00+09'),
    -- カフェ
    (v_user_id, 'cash', 550, 'カフェ・飲み物', 'card', 'スターバックス 新宿店',
     NULL, 6, '2026-04-21 09:15:00+09'),
    -- 交通費
    (v_user_id, 'cash', 200, '交通費', 'card', 'JR東日本',
     NULL, 0, '2026-04-21 08:00:00+09'),
    -- ポイント利用
    (v_user_id, 'point', 500, '食費', NULL, 'Rakuten Market',
     NULL, 0, '2026-04-19 20:00:00+09'),
    -- 収入見込み（給与）
    (v_user_id, 'income_forecast', 250000, 'その他', NULL, NULL,
     NULL, 0, '2026-04-25 00:00:00+09')
  ON CONFLICT DO NOTHING;

  -- points
  INSERT INTO public.points (user_id, name, amount, rate)
  VALUES
    (v_user_id, '楽天ポイント', 3200, 1.0),
    (v_user_id, 'PayPayポイント', 800, 1.0),
    (v_user_id, 'Tポイント', 1500, 1.0),
    (v_user_id, 'Pontaポイント', 600, 1.0)
  ON CONFLICT DO NOTHING;

END $$;

*/
