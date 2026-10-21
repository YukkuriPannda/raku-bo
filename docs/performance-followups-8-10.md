# Issue #8–#10: 描画負荷の対策と再計測

2026-10-22 JST。Issue #6のCPU調査を受け、次の3件を実装した。

| Issue | 変更 | コミット |
| --- | --- | --- |
| [#8](https://github.com/YukkuriPannda/raku-bo/issues/8) | ホームの図表をmemo化し、シフト一覧のヘッダーを安定したコンポーネントにする | `d2bea5c` |
| [#9](https://github.com/YukkuriPannda/raku-bo/issues/9) | 明示的なja-JP表示でIntl.NumberFormatを1個再利用する | `7194b7e` |
| [#10](https://github.com/YukkuriPannda/raku-bo/issues/10) | freezeOnBlurで非表示タブの描画を停止する | `41ec551` |

API・DB・認証・取得の鮮度規則は変更していない。既定ロケールを使う設定保存後の通知は従来どおり。

## 画面遷移の実測

`54ab245`（3対策前）と`41ec551`（3対策後）を比較した。
同じdev client、emulator-5554（Android 16 / API 36、1080×2400、SwiftShader）、
ホストMetroのlocalhost:8081接続、ADB reverse 8081/8787を使用。
計測順は後→前→後→前。各ブロックはウォームアップ後の4経路×3周、待機500ms。
4ブロックとも成功サマリーを確認し、各版24回、合計48回を採用した。

| 遷移 | 対策前の中央値 | 対策後の中央値 | 短縮 |
| --- | ---: | ---: | ---: |
| ホーム→履歴 | 1.469秒 | 1.201秒 | 0.268秒 |
| 履歴→シフト | 1.411秒 | 1.053秒 | 0.358秒 |
| シフト→支出予定 | 0.953秒 | 0.310秒 | 0.643秒 |
| 支出予定→ホーム | 0.960秒 | 0.357秒 | 0.602秒 |

各セルは6回の中央値。タッチDOWNから遷移先見出しの最初のネイティブOnDrawまでを測り、
描画後に画面本体の画像を照合した。全画面の表示完了・入力可能時刻・通信完了ではない。
匿名の全48試行、ばらつき、画像確認の観測幅は
[`followup-transition-results.json`](../validation/performance/followup-transition-results.json)に保存した。
集計には`transition-probe/summarize.cjs`を使用した。

開発時の既知のGoogle Calendar APIエラー表示を、両版とも実行時だけ同じ方法で抑えた。
APIリクエストや失敗結果は変更していない。生ログ・画面画像・アカウント情報はGitへ入れない。
前回報告の80回とは開発サーバーなどの条件が違うため混ぜない。
少数回の開発版エミュレーター比較であり、3対策それぞれの寄与や実機・リリース版の短縮量は未確定。

## 機能確認

- `mobile`の`npm run type-check`: 成功。
- `node validation/performance/number-format.perf.cjs`: 1,019値で従来表示と一致、formatter生成1回、残額ウィジェット4フィクスチャも一致。
- `node validation/performance/render-memo.perf.cjs`: 無関係なloading更新のスキップ、支出・63日窓の更新、安定したヘッダー型、収入・エラー更新、設定を開くコールバックを確認。これは最小hook/memoハーネスで、React Nativeの実マウントではない。
- `node validation/performance/selectors.perf.cjs`: 7購読箇所、無関係な100更新で変更0、関連43フィールドを確認。
- Maestro 2.11.0 / emulator-5554: `.maestro/performance-smoke.yaml`で4タブ3周成功。
- 同じ端末で`.maestro/tab-state-smoke.yaml`: 履歴の前月・食費選択を他タブ往復後も保持し、最後に当月・すべてへ戻す操作に成功。
- 集計スクリプト2本のself-check、`git diff --check`: 成功。

非表示タブ更新は、全タブを一度開いてホームへ戻り、保存actionを呼ばずRAMだけで
時給を7654321に変更して検証した。シフトへ戻って設定を開くと同値が表示され、保存せず閉じる操作に成功した。

この追加試行の初期失敗は検証用ラッパーの問題だった。開発用Runtime.evaluateで
ループ内constをクロージャーが共有し、シフト取得がカレンダー取得へ混線した。
独立した3関数の自己検証で期待値a/b/cに対しc/c/cを観測し、関数呼び出しでスコープを分けるとa/b/cになることを確認した。
アプリを再起動し、修正したラッパーで上記の状態更新確認に成功した。失敗試行は採用していない。
48回の時間計測にはこのラッパーを使っていない。Google Calendarの認証エラー自体は未解決。

フォアグラウンド復帰も同じemulator-5554で確認した。全タブを訪問後にシフトを表示し、
APIのlistへ独立した計数ラッパーを設定。カウンターをゼロにして30秒以上バックグラウンドへ移し、
同じActivityを前面へ戻すと、shiftApiが1回、transactionApi・plannedExpenditureApi・calendarEventApiは各0回だった。
シフトの勤務時間が数値であることも確認し、一時的な時給と全ラッパーを復元した。

Luna maxによる別担当の確認と、Claude Code Opus Highの読み取り専用レビューを実施した。
後者は完了JSONと`modelUsage: claude-opus-5-5`を確認。最後の差分・型・機能確認・計測の受け入れはSolが行った。
物理端末、リリースAPK、実ウィジェットは未確認。
本人の実機確認までPRはdraftのまま、マージ・Issue closeはしない。
