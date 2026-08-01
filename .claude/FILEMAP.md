# ファイルマップ

「どこを触ればいいか」を引くための地図。ディレクトリの役割と、
パスからは読み取れない前提（設計上の決まりごと、間違えやすい点）をまとめる。

構成は3つのアプリと1つのDBスキーマ。

| | 中身 | 開発時のポート |
|---|---|---|
| `mobile/` | Expo SDK 54 / React Native。**本体** | 8081（Metro） |
| `backend/` | Cloudflare Workers + Hono。APIサーバー | 8787 |
| `web/` | Vite + React。OAuthの中継と一部画面 | 5173 |
| `database/` | Supabase(PostgreSQL) のスキーマ | — |

---

## mobile/ — アプリ本体

### 画面（expo-router のファイルベースルーティング）

`app/` 配下のファイル構成がそのまま画面遷移になる。

| パス | 役割 |
|---|---|
| `app/_layout.tsx` | ルートレイアウト。**認証ガード・ディープリンク処理・サインアウト時の後片付け**。ここが全体の入口 |
| `app/index.tsx` | エントリ。ローディング表示のみ。実際の振り分けは `_layout.tsx` が行う |
| `app/(auth)/login.tsx` | Googleログイン。`openAuthSessionAsync` でブラウザを開く |
| `app/auth/callback.tsx` | OAuthコールバック画面 |
| `app/(tabs)/_layout.tsx` | タブ構成と**中央の追加ボタン（FAB）**。FABと展開UIはここに集約されている |
| `app/(tabs)/index.tsx` | ホーム。残り使える額・今月サマリー・支出の草グラフ |
| `app/(tabs)/history.tsx` | 支出履歴。長押しで編集、スワイプで削除／返済切替 |
| `app/(tabs)/shifts.tsx` | シフト・収入見込み・時給設定 |
| `app/(tabs)/planned-expenditures.tsx` | 支出予定・サブスク管理 |
| `app/(tabs)/add.tsx` | **画面ではない。** タブバー中央にスロットを確保するためのプレースホルダ |
| `app/screens/camera.tsx` | レシート撮影（モーダル） |
| `app/screens/manual-entry.tsx` | 手動入力・既存レコードの編集（モーダル） |

### 基盤ロジック

| パス | 役割 |
|---|---|
| `lib/auth.ts` | Supabase認証。PKCE、`LargeSecureStore`、**`handleOAuthCallback()`**。設計理由がコメントに詳しい |
| `lib/auth-errors.ts` | 認証エラーの正規化。`backend/src/types/error-codes.ts` と同期させること |
| `lib/api.ts` | axios クライアント。JWTの付与 |
| `lib/db.ts` | expo-sqlite のローカルキャッシュ |
| `lib/heatmap.ts` | 草グラフの計算と配色。ホーム画面とウィジェットの**両方**から使うのでUI非依存 |
| `lib/notifications.ts` | 常駐通知（レシート撮影への導線） |
| `lib/widget-bridge.ts` | ホーム画面ウィジェットへのデータ受け渡し |
| `store/index.ts` | Zustand。状態と各API呼び出しが集約されている。**一番大きいファイル** |
| `constants/api.ts` | 接続先の解決。配布ビルドでは許可リスト外を弾いて本番Workerに固定する |
| `constants/theme.ts` | `colors` / `spacing` / `radius` / `typography`。**デザイントークンの出どころ** |
| `hooks/useSwipeTabNavigation.ts` | タブ間の左右スワイプ |
| `hooks/useRefreshOnForeground.ts` | バックグラウンド復帰時の再取得 |
| `types/index.ts` | アプリ全体の型 |

### スタイル

画面ごとに `styles/<名前>.styles.ts` を持つ。値は `constants/theme.ts` から取る。

`styles/tabs.styles.ts` だけは画面ではなくタブバー中央のFAB用。
寸法の定数（`FAB_SIZE` `FAB_LIFT` `FAB_SINK` など）をエクスポートしており、
`app/(tabs)/_layout.tsx` がこれを使って位置を決める。

### ウィジェット・ビルド

| パス | 役割 |
|---|---|
| `index.js` | カスタムエントリ。expo-router に加えてウィジェットの headless task を登録する |
| `widgets/RemainingBudgetWidget.tsx` | 残額ウィジェット |
| `widgets/SpendingHeatmapWidget.tsx` | 草グラフウィジェット |
| `widgets/widget-task-handler.tsx` | ウィジェット更新の headless task |
| `scripts/build-android.mjs` | EASを使わないローカルAPKビルド。署名鍵の扱いもここ |
| `app.json` | Expo設定。パーミッション、プラグイン、ウィジェット定義 |

---

## backend/ — Cloudflare Workers

`src/index.ts` が Hono アプリの本体。認証ミドルウェアを適用してから各ルートをマウントする。

| パス | 役割 |
|---|---|
| `src/index.ts` | エントリ。CORS、認証ミドルウェアの適用範囲、ルート登録 |
| `src/middleware/auth.ts` | Supabase JWT の検証 |
| `src/routes/transactions.ts` | 支出のCRUD（最大級） |
| `src/routes/planned-expenditures.ts` | 支出予定・サブスク（最大級） |
| `src/routes/shifts.ts` | シフト。**Google Calendar API から都度取得**する |
| `src/routes/calendar-events.ts` | カレンダー予定 |
| `src/routes/receipts.ts` | レシートOCR。Gemini → Groq → ダミーの3段フォールバック |
| `src/routes/balance.ts` | 残高計算 |
| `src/routes/profile.ts` | 時給・シフトキーワード |
| `src/routes/auth.ts` | Googleアクセストークンの再取得 |
| `src/lib/supabase.ts` | Supabaseクライアント |
| `src/lib/gemini.ts` / `groq.ts` | OCRの実装 |
| `src/lib/r2.ts` | R2（レシート画像の保存） |
| `src/types/error-codes.ts` | エラーコード。**`mobile/lib/auth-errors.ts` と同期させること** |
| `wrangler.toml` | Workers の設定 |

---

## web/ — Vite + React

主な役割は **OAuthの中継**。Supabaseは登録済みの http:// URLにしかリダイレクトしないため、
`src/pages/AuthCallback.tsx` が `app_redirect` パラメータを見てアプリのスキームへ転送する。

`src/pages/` には Home / History / Shifts / Camera / Confirm / ManualEntry / Login も存在するが、
モバイル側とは別実装。触る前に、その画面が実際に使われているか確認すること。

---

## database/ — Supabase

| パス | 中身 |
|---|---|
| `schema.sql` | テーブル定義とRLS |
| `migrations/*.sql` | 手書きの追加SQL（Supabase CLI管理下ではない） |
| `seed.sql` | 初期データ |

テーブルは `profiles` / `transactions` / `transaction_items` / `receipts` /
`points` / `planned_expenditures` の6つ。

---

## validation/

`gemini-ocr/` にOCR精度の検証コードがある。本番の動作には関与しない。

---

## ルート直下

| パス | 役割 |
|---|---|
| `docker-compose.yml` | 開発環境（backend / web / mobile の3サービス） |
| `.claude/CLAUDE.md` | 作業時の決まりごと。**ビルド・配布・署名鍵の方針はここが正** |
| `.claude/FILEMAP.md` | このファイル |

---

## 間違えやすい前提

コードを読むだけでは気づきにくく、実際に事故につながった点。

**シフトはDBに無い。** `shifts` テーブルは存在せず、Google Calendar API から
都度取得している。ER図を書くときに間違えやすい。

**`lib/db.ts` は読み取り用キャッシュ。** オフラインで作った記録を後で送るキューでは**ない**。
書き込みは常にAPI経由で、成功した結果をキャッシュに保存している。
同時実行に耐えるよう `withExclusiveTransactionAsync` を使う（通常の
`withTransactionAsync` だと同時呼び出しで `cannot start a transaction within a transaction` になる）。

**認証コールバックには3箇所が反応する。** 1つのコールバックURLに対して
`app/(auth)/login.tsx` / `app/_layout.tsx` のディープリンクハンドラ /
`app/auth/callback.tsx` が同時に反応する。PKCEのcodeは使い捨てなので、
判定と交換は `lib/auth.ts` の `handleOAuthCallback()` に集約してある。
**ここを迂回して個別に処理を書くとログインループが再発する。**

**Androidでは `openAuthSessionAsync` が `success` を返さない。** ディープリンクが
アプリを前面に戻すためカスタムタブが閉じられ、正常時でも `dismiss` になる。
`dismiss` を単純にキャンセル扱いしてはいけない。

**中央のFABはタブバーの中に描いていない。** Androidでは tabBar の overflow が
クリップされて円が切れるため、絶対配置のオーバーレイとして重ねている。
タブバー側にあるのは押せない空きスロット（`app/(tabs)/add.tsx`）だけ。

**FABの縦位置にセーフエリアの下インセットを足さない。** `tabBarStyle.height` を
明示すると React Navigation がその内側でインセットを吸収するため、
足すと二重に持ち上がる。

**ポイント機能は削除済み。** 2026-07-21 のコミットで全プラットフォームから
外された。DBの `points` テーブルとRLSだけが残っている。
