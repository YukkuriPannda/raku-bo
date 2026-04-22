# らく〜ぼ 💰

かなりらくな家計簿アプリ

## 概要

レシートを撮るだけで支出を記録。Googleカレンダーのシフトから月収を自動計算し、「今月あと○○円使える」を一目で確認できる家計簿アプリ。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React Native + Expo SDK 52 |
| スタイリング | NativeWind v4 (Tailwind CSS) |
| 状態管理 | Zustand |
| ルーティング | Expo Router v4 |
| バックエンド | Hono on Cloudflare Workers |
| DB | Supabase (PostgreSQL) |
| 認証 | Supabase Auth + Google OAuth 2.0 |
| ストレージ | Cloudflare R2 |
| AI/OCR | Gemini 2.5 Flash |
| オフラインDB | expo-sqlite |
| ウィジット | react-native-android-widget |

## ディレクトリ構成

```
raku-bo/
├── backend/          # Hono on Cloudflare Workers
│   └── src/
│       ├── index.ts
│       ├── middleware/auth.ts
│       ├── routes/          # receipts, transactions, balance, shifts, points
│       ├── lib/             # supabase, gemini, r2
│       └── types/
├── mobile/           # Expo React Native アプリ
│   ├── app/
│   │   ├── (auth)/login.tsx
│   │   ├── (tabs)/          # ホーム・履歴・シフト・ポイント
│   │   └── screens/         # カメラ・OCR確認
│   ├── store/               # Zustand グローバルストア
│   ├── lib/                 # api, auth, db (expo-sqlite)
│   ├── types/
│   └── widgets/             # Android ホーム画面ウィジット
├── database/
│   ├── schema.sql   # Supabase テーブル定義・RLS・トリガー
│   └── seed.sql     # 開発用サンプルデータ
├── validation/
│   └── gemini-ocr/  # Gemini OCR 動作検証スクリプト
└── .env.example
```

## セットアップ

### 1. 環境変数の設定

`.env.example` をコピーして各値を設定：
```bash
cp .env.example backend/.dev.vars      # Cloudflare Workers 用
cp .env.example mobile/.env            # Expo 用
```

### 2. Supabase DB セットアップ

Supabase の SQL Editor で `database/schema.sql` を実行。

### 3. バックエンド

```bash
cd backend
npm install
npm run dev       # ローカル開発 (http://localhost:8787)
npm run deploy    # Cloudflare Workers にデプロイ
```

wrangler secrets の設定：
```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put GEMINI_API_KEY
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

### 4. モバイルアプリ

```bash
cd mobile
npm install --legacy-peer-deps
npm run android   # Android で起動
npm run ios       # iOS で起動
```

### 5. Gemini OCR 検証（任意）

```bash
cd validation
npm install
# validation/gemini-ocr/ にレシート画像を sample.jpg として配置
GEMINI_API_KEY=xxx npm run ocr
```

## API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| POST | /receipts | レシート画像をOCR解析してR2・DBに保存 |
| GET | /transactions | 今月の取引履歴を取得 |
| POST | /transactions | 取引を手動登録（確認画面から呼び出し） |
| GET | /balance | 残り使える額を計算して返す |
| GET | /shifts | Google Calendar からシフトを取得 |
| GET | /points | ポイント資産一覧 |
| POST | /points | ポイントを追加 |
| PATCH | /points/:id | ポイント保有数を更新 |
| DELETE | /points/:id | ポイントを削除 |

## 残り使える額の計算式

```
残り使える額 = 月収見込み + ポイント資産（円換算）- 今月支出合計

月収見込み = Σ（時給 × 各シフト勤務時間）
ポイント資産 = Σ（保有ポイント数 × 円換算レート）
```
