# 仕様: タブ共通

各タブの仕様書（`spec-*.md`）で共通する部分だけをここに置く。
個別の仕様は [spec-home.md](spec-home.md) / [spec-history.md](spec-history.md) /
[spec-shifts.md](spec-shifts.md) / [spec-planned-expenditures.md](spec-planned-expenditures.md)。

実装: `mobile/app/(tabs)/_layout.tsx`

## タブ構成

| 順 | ルート | タブ名 | ヘッダ | 仕様書 |
| --- | --- | --- | --- | --- |
| 1 | `/` | ホーム 🏠 | らく〜ぼ | [spec-home.md](spec-home.md) |
| 2 | `/history` | 履歴 📋 | 支出履歴 | [spec-history.md](spec-history.md) |
| – | `add` | （空きスロット） | — | 中央FABの置き場所。画面ではない |
| 3 | `/shifts` | シフト 📅 | シフト・収入見込み | [spec-shifts.md](spec-shifts.md) |
| 4 | `/planned-expenditures` | 支出予定 📆 | 支出予定 | [spec-planned-expenditures.md](spec-planned-expenditures.md) |

`add` はタブバー上の押せない空きスロット（`tabPress` を `preventDefault`）。
`app/(tabs)/add.tsx` は `/(tabs)` へリダイレクトするだけ。

## 中央の追加ボタン（全タブ共通オーバーレイ）

- タップで開閉。展開時に 📷 レシート撮影（左）/ ✏️ 手動入力（右）。遷移先は
  `/screens/camera` と `/screens/manual-entry`
- 長押し 350ms 後はドラッグになり、離した指のX座標がFAB中心より左なら撮影、
  右なら手動入力。FAB上でほぼ動かさず離したときは閉じるだけ
- 背景タップで閉じる

## タブ間スワイプ

`hooks/useSwipeTabNavigation.ts`。行き先は `['/', '/history', '/shifts', '/planned-expenditures']`
で、`add` は含まない（タブ数と件数が一致しないのは意図的）。閾値は距離60px・速度200。

履歴タブだけは行のスワイプ操作と衝突するため、月バー部分のみで受ける。

## データ取得の共通規則

実装: `mobile/store/index.ts`（`@/store`。`useAppStore.ts` というファイルは無い）

- 鮮度判定は **30秒**。`fetchXxx(month, { force: true })` で無視できる。プルリフレッシュは常に force
- 同一キーの同時取得は重複排除される
- 一度取得済みのドメインは、更新中もスピナーに置き換えず前の値を出す（stale-while-revalidate）
- フォアグラウンド復帰時の再取得は表示中のタブのみ（`hooks/useRefreshOnForeground.ts`）
- ログアウトで全状態を初期化
- 起動時の `prefetchInitialData` と `fetchProfile` は `app/_layout.tsx` が呼ぶ。各タブは呼ばない

## 残額の計算

`calcBalance()` が**クライアント側で**計算する。バックエンドの `GET /balance` は
存在するがモバイルからは呼んでいない（`balanceApi.get` は未使用）。

```
残り使える額 = 月収見込み − (現金支出 − 建て替え) − 予定支出合計
```

建て替え（`is_advance`）は返済済みでも支出から常に除外する。
「今月」は端末ローカル時刻の `YYYY-MM`。

## API 呼び出し

`mobile/lib/api.ts`（axios）。リクエストごとに Supabase の access_token を
`Authorization: Bearer` で付ける。Google カレンダー由来の API は
`X-Google-Access-Token` も必要で、期限切れ時は1回だけ取り直す。

baseURL は `mobile/constants/api.ts`。配布ビルドは本番Workerに固定される。
