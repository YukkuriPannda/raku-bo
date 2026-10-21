# らく〜ぼ

かなりらくな家計簿アプリ

## 概要

レシートを撮るだけで支出を記録。Googleカレンダーのシフトから月収を自動計算し、「今月あと○○円使える」を一目で確認できるアルバイト向け家計簿アプリ。

## 技術スタック

| レイヤー          | 技術                                           |
| ----------------- | ---------------------------------------------- |
| モバイル          | React Native (Expo 54) + Expo Router + Zustand |
| Web               | React 19 + Vite + Zustand + Tailwind CSS       |
| バックエンド      | Hono on Cloudflare Workers + Wrangler          |
| DB                | Supabase (PostgreSQL)                          |
| 認証              | Supabase Auth + Google OAuth 2.0               |
| ストレージ        | Cloudflare R2（レシート画像）                  |
| AI/OCR            | Gemini (`gemini-flash-lite-latest`) / Groq（フォールバック） |
| Androidウィジット | react-native-android-widget                    |

## ドキュメント

| 知りたいこと | 読むもの |
| --- | --- |
| どのファイルが何をしているか | [.claude/FILEMAP.md](.claude/FILEMAP.md) |
| 各タブの仕様 | [docs/spec-common.md](docs/spec-common.md) と `docs/spec-*.md` |
| 画面遷移 | [docs/screen-transitions.md](docs/screen-transitions.md) |
| DBスキーマ | [docs/er-diagram.md](docs/er-diagram.md) |
| ブランチ運用 | [docs/git.md](docs/git.md) |
| ビルドとリリース | [docs/release.md](docs/release.md) |
| エージェントの役割分担 | [docs/subagents.md](docs/subagents.md) |

## セットアップ

必要なものは Docker / Docker Compose だけ。

### 環境変数

**`backend/.dev.vars`**

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...        # 省略可（Geminiのフォールバック用）
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
R2_BUCKET=...
```

**`mobile/.env`**

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_URL=http://localhost:8787
```

**`web/.env`**（web は Vite なので接頭辞が違う）

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=http://localhost:8787
```

署名鍵（`RAKUBO_*`）は `mobile/.env` に書かない。理由と置き場所は [docs/release.md](docs/release.md)。

### 起動と再起動

```bash
docker-compose up                # 全サービス
docker-compose up backend        # :8787
docker-compose up web            # :5173
docker-compose up mobile         # :8081

docker-compose restart backend   # コード変更後はそのサービスを再起動
```

### Cloudflare Workers にデプロイ

```bash
cd backend
npm run deploy
wrangler secret put SUPABASE_URL          # 以下、.dev.vars と同じキーを登録
```

## API エンドポイント

保護済みエンドポイントは `Authorization: Bearer <supabase_jwt>` が必要。
Googleカレンダー由来のもの（`/shifts`, `/calendar-events`）は追加で
`X-Google-Access-Token: <google_access_token>` も必要。

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | / | ヘルスチェック |
| GET | /auth/callback | OAuthコールバック |
| POST | /auth/refresh-google-token | Googleアクセストークンの再取得 |
| POST | /receipts | レシート画像をOCR解析してR2・DBに保存 |
| GET | /transactions?month=YYYY-MM | 月別取引一覧 |
| POST | /transactions | 取引を登録 |
| PATCH | /transactions/:id | 取引を更新（建て替えの返済もここ） |
| DELETE | /transactions/:id | 取引を削除 |
| GET | /balance?month=YYYY-MM | 支出合計（**クライアント未使用**。後述） |
| GET | /shifts?month=YYYY-MM | Googleカレンダーからシフト取得 |
| GET | /calendar-events?month=YYYY-MM | カレンダーのイベント一覧 |
| GET | /profile | 時給・シフト検出キーワード |
| PATCH | /profile | 同上の更新 |
| GET | /planned-expenditures?month=YYYY-MM | 支出予定一覧 |
| POST | /planned-expenditures | 支出予定を追加 |
| PATCH | /planned-expenditures/:id | 支出予定を更新 |
| POST | /planned-expenditures/:id/complete | 支出予定を実際の支出にする |
| DELETE | /planned-expenditures/:id | 支出予定を削除 |

## 残り使える額の計算式

```
残り使える額 = 月収見込み − (現金支出 − 建て替え) − 予定支出合計

月収見込み = Σ（時給 × 各シフト勤務時間）
```

建て替え（`is_advance`）は返済済みでも支出から常に除外する。

**この計算はクライアント側**（`mobile/store/index.ts` の `calcBalance`）で行う。
`GET /balance` は存在するが月収見込みを 0 で返すため、どのクライアントも使っていない。

カテゴリの一覧は `backend/src/types/index.ts` が正本。
