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
で、`add` は含まない（タブ数と件数が一致しないのは意図的）。成立判定は
距離が画面幅の25%以上、または速度500以上のどちらかを満たすこと。

スワイプ中は画面全体が指に追従して横に動く（フックが返す `animatedStyle` を
画面を包む `Animated.View` に当てる）。タブナビゲーターは一度に1画面しか描かない
ため、遷移先は「指を離した位置の続き」から0へ滑り込ませて見た目をつないでいる。
成立しなかった場合は0へ戻す。端のタブでは行き先が無い方向には動かさない。

履歴タブだけは行のスワイプ操作と衝突するため、ジェスチャーは月バー部分のみで
受ける（動くのは画面全体）。

## データ取得の共通規則

実装: `mobile/store/index.ts`（`@/store`。`useAppStore.ts` というファイルは無い）

- 鮮度判定は **30秒**。`fetchXxx(month, { force: true })` で無視できる。プルリフレッシュは常に force
- 同一キーの同時取得は重複排除される
- 一度取得済みのドメインは、更新中もスピナーに置き換えず前の値を出す（stale-while-revalidate）
- フォアグラウンド復帰時の再取得は表示中のタブのみ（`hooks/useRefreshOnForeground.ts`）
- ログアウトで全状態を初期化
- 各画面・フォームは使用する状態と action だけを購読する。複数フィールドを選ぶ場合は
  `useShallow` を使い、無関係なストア更新で画面を再描画しない
- Android / iOSでは `freezeOnBlur` で非表示タブの再描画を停止する。タブへ戻ると
  現在のストア値を反映し、履歴の表示月・カテゴリなどの画面内の状態は保持する。
  初回の遅延描画と、フォーカス時・フォアグラウンド復帰時の取得規則は変えない
- 明示的な `ja-JP` の数値表示は `lib/number-format.ts` の `formatNumberJa` を使い、
  `Intl.NumberFormat` を再利用する。円記号・符号・絶対値の扱いは各表示の従来どおり
- 起動時の `prefetchInitialData` と `fetchProfile` は `app/_layout.tsx` が呼ぶ。各タブは呼ばない

## 残額の計算

`calcBalance()` が**クライアント側で**計算する。バックエンドの `GET /balance` は
存在するがモバイルからは呼んでいない（`balanceApi.get` は未使用）。

```
残り使える額 = 月収見込み − (現金支出 − 建て替え) − 予定支出合計
```

建て替えは返済済みでも支出から常に除外する。レシート全体の建て替え
（`transactions.is_advance`）と、明細ごとの建て替え（`transaction_items.is_advance`）の
両方を差し引く。差し引く額は `mobile/lib/advance.ts` の `advanceAmount()` が決める。

- レシート全体の建て替えなら全額。明細のフラグは見ない（二重管理にしない）
- そうでなければ建て替えフラグの付いた明細の合計。支払総額を超えないよう丸める
  （税・値引きが明細に乗らないレシートで自己支出が負にならないようにする）
- 明細もフラグも無い既存の記録は 0。従来と同じ金額になる

残額・草グラフ・ホームの円グラフは、この建て替え分を引いた**自分の支出**
（`selfAmount()`）で集計する。履歴タブの月支出サマリーだけは支払総額の
内訳を見るものなので、建て替えを含めた総額のまま（[spec-history.md](spec-history.md)）。
「今月」は端末ローカル時刻の `YYYY-MM`。

## API 呼び出し

`mobile/lib/api.ts`（axios）。リクエストごとに Supabase の access_token を
`Authorization: Bearer` で付ける。Google カレンダー由来の API は
`X-Google-Access-Token` も必要で、期限切れ時は1回だけ取り直す。

baseURL は `mobile/constants/api.ts`。配布ビルドは本番Workerに固定される。
