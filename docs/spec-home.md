# 仕様: ホームタブ

実装: `mobile/app/(tabs)/index.tsx` ／ 共通規則は [spec-common.md](spec-common.md)

今月あと使える額を一目で見せる画面。記録の追加はここではなく共通FABから行う。

## 画面要素（上から）

| 要素 | 内容 | タップ時 |
| --- | --- | --- |
| メインカード | 「今月あと」`remaining`「使える」。マイナスは先頭に `-` | — |
| 💸 今月の支出 | `net_expense_total`。建て替えがあると「建て替え ¥x を除く」注記 | `/history` |
| 🤝 建て替え・未回収 | `advance_unsettled_total`。0 のときは行ごと非表示 | `/history` |
| 💼 月収見込み | `income_forecast`（緑） | `/shifts` |
| 📆 予定支出 | `-` + `planned_total`（>0 でオレンジ） | `/planned-expenditures` |
| カテゴリ別円グラフ | 今月の `type==='cash' && !is_advance` かつ金額>0 を金額降順で集計。凡例に金額と割合 | なし（読み取り専用） |
| 支出の草グラフ | 直近63日 | `/history` |
| 月ラベル | `YYYY年M月` | — |

初回取得中のみメインカードがスピナーになる。2回目以降は前の値を出したまま更新する。

空状態は円グラフの「この月の支出データはまだありません」だけ。
残高系のAPIエラーは画面に出ない（コンソールのみ。取得失敗時はキャッシュを使う）。

## 操作

- フォーカス時に `fetchTransactions` / `fetchShifts` / `fetchPlannedExpenditures` を並列実行
- プルリフレッシュで同じ3つを force 取得

## 使う API

| API | 用途 |
| --- | --- |
| `GET /transactions?month=今月` | 支出・円グラフ |
| `GET /shifts?month=今月` | 月収見込み |
| `GET /planned-expenditures?month=今月` | 予定支出 |
| `GET /transactions?month=過去月` | 草グラフ（直近105日分をウィジット更新時に取得） |

## 前提・既知の挙動

- 残額の式と建て替えの扱いは [spec-common.md](spec-common.md#残額の計算) 参照。草グラフ・円グラフ・残額のいずれも建て替えを除外する
- **`planned_total` は `is_active` を見ず支出予定を全件合計する**（`store/index.ts:558`）。
  支出予定タブ側の合計は `is_active` で絞るため、停止したサブスクがあると
  ホームの「予定支出」とタブの合計が一致しない
- 支出予定は月ごとに保持されず単一配列を上書きするため、支出予定タブで別の月を
  見た直後にホームへ戻ると、30秒の鮮度判定で再取得が省略され別月の合計が出ることがある
  （コードから読み取れる挙動。実機未確認）
