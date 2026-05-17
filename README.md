# らく〜ぼ

かなりらくな家計簿アプリ

## 概要

レシートを撮るだけで支出を記録。Googleカレンダーのシフトから月収を自動計算し、「今月あと○○円使える」を一目で確認できるアルバイト向け家計簿アプリ。

## 技術スタック

| レイヤー          | 技術                                           |
| ----------------- | ---------------------------------------------- |
| モバイル          | React Native (Expo 54) + Expo Router + Zustand |
| Web               | React 18 + Vite + Zustand + Tailwind CSS       |
| バックエンド      | Hono on Cloudflare Workers + Wrangler          |
| DB                | Supabase (PostgreSQL)                          |
| 認証              | Supabase Auth + Google OAuth 2.0               |
| ストレージ        | Cloudflare R2（レシート画像）                  |
| AI/OCR            | Gemini 2.0 Flash / Groq（フォールバック）      |
| Androidウィジット | react-native-android-widget                    |

## ディレクトリ構成

```
raku-bo/
├── backend/          # Hono on Cloudflare Workers
│   └── src/
│       ├── index.ts              # エントリーポイント・ルート登録
│       ├── middleware/auth.ts    # JWT認証ミドルウェア
│       ├── routes/
│       │   ├── receipts.ts       # POST /receipts（OCR・保存）
│       │   ├── transactions.ts   # GET・POST・PATCH・DELETE /transactions
│       │   ├── balance.ts        # GET /balance（残高集計）
│       │   ├── shifts.ts         # GET /shifts（Googleカレンダー連携）
│       │   └── points.ts         # CRUD /points
│       ├── lib/
│       │   ├── gemini.ts         # Gemini OCR
│       │   ├── groq.ts           # Groq OCR（フォールバック）
│       │   ├── supabase.ts       # Supabaseクライアント
│       │   └── r2.ts             # Cloudflare R2アップロード
│       └── types/index.ts        # 共通型定義
├── mobile/           # Expo (React Native)
│   ├── app/
│   │   ├── (auth)/login.tsx
│   │   ├── (tabs)/               # ホーム・履歴・シフト・ポイント
│   │   └── screens/              # カメラ・手動入力
│   ├── store/                    # Zustand グローバルストア
│   ├── lib/                      # api, auth
│   ├── types/
│   └── widgets/                  # Android ホーム画面ウィジット
└── web/              # React + Vite
    └── src/
        └── pages/                # Home, History, Camera, ManualEntry, Shifts, Points
```

## セットアップ

### 必要な環境

- Docker / Docker Compose

### 環境変数

**`backend/.dev.vars`**

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
GEMINI_API_KEY=...
GROQ_API_KEY=...        # 省略可（Geminiのフォールバック用）
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

**`mobile/.env`** / **`web/.env`**

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_URL=http://localhost:8787
```

### 起動

```bash
# 全サービス起動
docker-compose up

# 個別起動
docker-compose up backend   # :8787
docker-compose up web       # :5173
docker-compose up mobile    # :8081
```

### 再起動（コード変更後）

```bash
docker-compose restart backend   # バックエンド変更後
docker-compose restart web       # Web変更後
docker-compose restart mobile    # モバイル変更後
```

### Cloudflare Workers にデプロイ

```bash
cd backend
npm run deploy
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put GEMINI_API_KEY
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

## API エンドポイント

すべての保護済みエンドポイントは `Authorization: Bearer <supabase_jwt>`
が必要です。\
シフト取得には追加で `X-Google-Access-Token: <google_access_token>` も必要です。

| メソッド | パス                        | 説明                                   |
| -------- | --------------------------- | -------------------------------------- |
| GET      | /                           | ヘルスチェック                         |
| POST     | /receipts                   | レシート画像をOCR解析してR2・DBに保存  |
| GET      | /transactions?month=YYYY-MM | 月別取引一覧                           |
| POST     | /transactions               | 取引を登録                             |
| PATCH    | /transactions/:id           | 取引を更新                             |
| DELETE   | /transactions/:id           | 取引を削除                             |
| GET      | /balance?month=YYYY-MM      | 残高集計（支出・月収見込み・ポイント） |
| GET      | /shifts?month=YYYY-MM       | Googleカレンダーからシフト取得         |
| GET      | /points                     | ポイント資産一覧                       |
| POST     | /points                     | ポイント資産を追加                     |
| PATCH    | /points/:id                 | ポイント残高を更新                     |
| DELETE   | /points/:id                 | ポイント資産を削除                     |

## 残り使える額の計算式

```
残り使える額 = 月収見込み + ポイント資産（円換算）- 今月支出合計

月収見込み    = Σ（時給 × 各シフト勤務時間）
ポイント資産  = Σ（保有ポイント数 × 円換算レート）
```

## カテゴリ

`食費` / `交通費` / `娯楽` / `衣類` / `医療` / `教育・書籍` / `カフェ・飲み物` /
`家賃・光熱費` / `日用品` / `その他`
