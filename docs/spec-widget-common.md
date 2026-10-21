# 仕様: ウィジェット共通

Androidホーム画面ウィジェットの共通部分。個別の仕様は
[spec-widget-remaining-budget.md](spec-widget-remaining-budget.md) と
[spec-widget-heatmap.md](spec-widget-heatmap.md)。

実装: `mobile/widgets/widget-task-handler.tsx` / `mobile/lib/widget-bridge.ts`
登録: `mobile/index.js`（`expo-router/entry` の後に `registerWidgetTaskHandler`）
設定: `mobile/app.json` の `react-native-android-widget` プラグイン

| | 残額 | 草グラフ |
| --- | --- | --- |
| 登録名 | `RemainingBudget` | `SpendingHeatmap` |
| ピッカー表示 | 今月あと○○円 | 今月の支出カレンダー |
| サイズ（min / max） | 120dp×120dp（同値＝実質固定） | 120dp×60dp（同値） |
| セル | 2×2 | 2×1 |
| リサイズ | horizontal\|vertical（ただし max=min） | none |
| プレビュー画像 | `assets/widget-preview.png`（単色の緑。描画見本ではない） | なし |
| 更新間隔 | 1800000ms（30分） | 1800000ms（30分） |

`widget-task-handler.tsx` は `widgetName === 'SpendingHeatmap'` のときだけ草グラフを描き、
**それ以外（未知の名前を含む）はすべて残額ウィジェットとして描く**。

## データの供給経路

ウィジェットは**自分では計算も通信もしない。**SecureStore に保存された値を読んで描くだけ。

| キー | 書く人 | 読む人 |
| --- | --- | --- |
| `widget_remaining_budget` | `saveWidgetBudget()`（`store` の `calcBalance` から） | 残額ウィジェット |
| `widget_spending_heatmap` | `saveWidgetHeatmap()`（`refreshHeatmapWidget` から） | 草グラフウィジェット |

SQLite / AsyncStorage は使わない。`widget-bridge.ts` が value として import するのは
expo-secure-store・react-native-android-widget・ウィジェット本体だけで、
認証や通信のモジュールには触らない（**描画に認証もネットワークも不要**）。

SecureStore は 2048 バイトを超えると保存に失敗しうる。草グラフ側だけこれを見ていて、
超えたら古い日から削る。**残額側に上限チェックは無い**（店名が長いと超える可能性。実測なし）。

## 更新の契機

| 経路 | 何が起きるか |
| --- | --- |
| 配置時・サイズ変更・システムの定期更新 | ネイティブ → headless task（`WIDGET_ADDED` / `WIDGET_UPDATE` / `WIDGET_RESIZED`）→ キャッシュを読んで再描画 |
| アプリ内のデータ変更 | `calcBalance` → `saveWidgetBudget` → `requestWidgetUpdate`（headless を経由せずその場で描画） |
| ログアウト・セッション失効 | `clearWidgetBudget` / `clearWidgetHeatmap` → キーを削除して空の状態で再描画 |
| タップ | `clickAction` があるものはネイティブで完結。**JS は動かない** |

`calcBalance` は取引・シフト・支出予定・時給のどの変更でも呼ばれる（起動時の
`prefetchInitialData` を含む）。`WIDGET_DELETED` と `WIDGET_CLICK` では何もしない。

**定期更新は前回の保存値を再描画するだけ**で、新しい値は取りに行かない。
値が変わるのはアプリを開いたときだけ。

## 制約

- headless task はアプリ本体とは別の JS コンテキストで動く。ワーカーのタイムアウトは30秒
- 読み込み中の表示は無い。キャッシュを読んだ後に1回だけ描く（読み込み前は空のレイアウト）
- エラー専用の表示も無い。読み出しの例外と JSON の破損はどちらも「データなし」と同じ見た目になる
- ダークモード用の描画は無い（`app.json` の `userInterfaceStyle` は `light`、色は hex 直書き）
- **ウィジットの変更は Expo Go では確認できない。**デバッグAPKかリリースAPKで実機確認する
  （[../AGENTS.md](../AGENTS.md)）

未確認: アプリのプロセス終了後に headless task が動くか、Android が実際に30分で
更新をかけるか、端末ロック中に SecureStore が読めるか、120dp に収まるか。
