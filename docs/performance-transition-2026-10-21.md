# Issue #6: 画面遷移の実測とボトルネック調査

2026-10-21、`686163b`（修正前）と `1948f60`（修正後）を同じAndroidエミュレーターで比較した。
**今回の修正による通常のタブ切替の短縮は確認できなかった。**
前回の模擬通信の約22ms短縮を、画面遷移の短縮時間として使ってはいけない。

## 測定値

タッチDOWNの直前から、遷移先の見出しが表示対象になった最初のネイティブOnDrawまで。
描画後に画面本体の画像も照合した。各経路・各版10回、合計80回の成功計測の中央値。
差は「修正後 − 修正前」。プラスは遅い値。

| 遷移 | 修正前 | 修正後 | 差 |
| --- | ---: | ---: | ---: |
| ホーム → 履歴 | 1.574秒 | 1.631秒 | +0.056秒 |
| 履歴 → シフト | 1.554秒 | 1.556秒 | +0.003秒 |
| シフト → 支出予定 | 1.088秒 | 1.106秒 | +0.018秒 |
| 支出予定 → ホーム | 1.175秒 | 1.217秒 | +0.042秒 |

これは見出しの描画を観測した時刻で、画面全体の表示完了や操作可能時刻ではない。
画面本体の変化を画像で確認できた時刻の中央値と、その観測幅も別に記録する。
画像の取得時間を含むので、確認時刻をそのまま純粋な描画時間と扱わない。

| 遷移 | 修正前の観測幅 | 修正後の観測幅 | 確認時刻の中央値の差 |
| --- | ---: | ---: | ---: |
| ホーム → 履歴 | 1.591〜1.790秒 | 1.640〜1.806秒 | +0.016秒 |
| 履歴 → シフト | 1.568〜1.768秒 | 1.573〜1.782秒 | +0.015秒 |
| シフト → 支出予定 | 1.107〜1.306秒 | 1.121〜1.303秒 | −0.003秒 |
| 支出予定 → ホーム | 1.185〜1.373秒 | 1.236〜1.483秒 | +0.111秒 |

この幅は各試行の観測下限・上限をそれぞれ中央値にしたもの。
統計的な信頼区間ではなく、全ピクセルや非同期処理の完了も保証しない。
見出しの描画時間の全範囲は、例えばホーム→履歴で修正前1.517〜3.198秒、
修正後1.570〜4.368秒と大きい。両版とも時々長く待つ試行があり、
少数回の比較から数十msの差を改善・悪化と断定できない。
**短縮した秒数として報告できる値は得られていない。**

全80件の匿名の時間記録、画像の一致率、取得時間、集計は
[transition-results.json](../validation/performance/transition-results.json) に保存した。

## 条件と手順

- 端末: `emulator-5554` / `Medium_Phone_API_36` / Android 16 / x86_64。
  1080×2400、density 420、4コア、RAM 4GB。実機ではない。
- アプリ: 既存の `com.rakubo.app.debug`、dev client + Metro、Hermes、`dev=true`。
  アプリのデータを消去せず、同じログイン状態・月・データを使った。
  取引や予定の登録・編集・削除はしていない。
- `dumpsys SurfaceFlinger` の実際のGLESは `Google SwiftShader 4.0.0.1`。
  AVD設定の `gpu.mode=host` だけを見てハードウェア描画とは判断しない。
- window / transition animation scale は1.0、animatorは既定。
  API・キャッシュの鮮度判定やアニメーションを無効にしていない。
- 各実行で4タブを一度開いて参照画像を取得し、初回マウントは除外した。
  ここでのwarmは「一度開いた経路」で、全通信がキャッシュヒットする意味ではない。
  通常の30秒の再取得判定が途中で働き得る。APIの応答時間は固定していない。
- 実行順は修正前7周 → 修正後7周 → 修正後3周 → 修正前3周。
  各周はホーム → 履歴 → シフト → 支出予定 → ホーム、各遷移後500ms待機。
  変更対象6ファイルを対応するgitリビジョンへ切り替え、各実行でアプリプロセスを再起動した。
  比較終了後は全6ファイルを `1948f60` へ戻した。
- カレンダーAPIの401と開発版のエラー表示が発生する環境だった。
  両版とも同じ認証を維持し、通信とエラー表示の変動を隠す調整はしていない。
  認証正常時の本番相当比較ではない。

計測器は [transition-probe](../validation/performance/transition-probe/README.md)。
Android SDKの既存ツールだけで構築するAndroid Instrumentation APKで、新しい依存はない。
観測済みの正確なタブラベルから座標を求め、20ms保持のタッチを端末内で注入する。
ホスト側のADBコマンド実行時間やUIAutomatorのポーリング間隔はタイマーに含めない。
タイマー開始から見出しのOnDrawまでスクリーンショットを撮らない。

画像照合は、遷移前後で異なる画面領域を8px間隔で抽出し、RGB各32以内で97%以上一致を要求する。
ステータスバーと下部のタブバーを除く。少なくとも128点の識別点を要求する。
見出しのOnDraw後に1枚取得し、未一致なら100ms後に再取得する。
見出しのOnDraw、最後に未一致だった画像の取得開始、最初に一致した画像の取得終了を記録する。
今回の画像取得枚数は各版の各経路とも中央値2枚だった。

```powershell
pwsh -NoProfile -File validation/performance/transition-probe/build.ps1
adb -s emulator-5554 install -r validation/performance/transition-probe/build/transition-probe.apk
adb -s emulator-5554 reverse tcp:8081 tcp:8081
adb -s emulator-5554 shell am instrument -w -r -e repeats 7 -e settleMs 500 com.rakubo.probe/.TransitionProbe
```

保存した実行ログのうち `TRANSITION_PROBE_SUMMARY` が `status: "ok"` の4本だけを集計した。
Androidのinstrumentation失敗時でもADBの終了コードは0になり得るため、コードだけでは採用しない。
ソース画像の一致率が0.966となった別の実行は失敗とし、途中の成功行も含めて全て除外した。
成功した実行から遅い試行を選んで捨てる処理はない。

```powershell
node validation/performance/transition-probe/summarize.cjs --self-check
node validation/performance/transition-probe/summarize.cjs --before before-2-complete.txt --after after-2-actual.txt --after after-3.txt --before before-3.txt
```

初期の診断では連続スクリーンショット方式を試したが、Perfettoで45秒中422回のreadbackと、
合計約9.8秒のreadback sliceを認めた。観測負荷が大きいため、その時間比較は採用していない。
ここで報告する80回は全て修正後のOnDraw待ち方式である。
この方式にも参照画像・タッチ注入・描画リスナー・描画後の画像照合の負荷は残る。

## ボトルネックの証拠

修正後で、計測用Instrumentationを付けない通常のタブ操作を別途記録した。
スクリーンショットは連続取得していない。遷移時間の80回とは別の診断実行であり、
以下のCPU時間を1回の遷移時間から直接引いて短縮見込みにしない。
匿名の集計は [transition-profile-results.json](../validation/performance/transition-profile-results.json)。

### JavaScriptのReact描画処理

Perfettoの45秒記録でアプリのJSスレッド `mqt_v_js` は20.429 CPU秒を使い、
アプリ内で最も大きかった。別のHermes sampling profileは16,825サンプル、合計31.954秒。

| Hermesの関数 | サンプル時間 | 全サンプルに対する割合 | 読み方 |
| --- | ---: | ---: | --- |
| `renderRootSync` | 15.505秒 | 48.52% | 子呼び出しを含む同期描画 |
| `renderWithHooks` | 5.964秒 | 18.66% | 子呼び出しを含む。上の値と重なる |
| `unstable_now` | 8.796秒 | 27.53% | 全呼び出し位置の自己時間の合計 |
| `numberPrototypeToLocaleString` | 1.522秒 | 4.76% | 全呼び出し位置の自己時間の合計 |
| idle | 12.732秒 | 39.85% | 待機。CPU処理時間と足し合わせない |

`unstable_now` の重いスタックは、React開発版の `startProfilerTimer`、
`stopProfilerTimerIfRunningAndRecordDuration` などを通っていた。
これらの4つの呼び出し位置だけで自己時間の約7.600秒を占める。
インストール済みの `ReactFabric-dev.js` でもこれらが `Scheduler.unstable_now` を呼ぶことを確認した。
**この環境ではReactの同期描画と開発版の計測処理が大きい**。
リリース版にそのまま同じ割合が存在するとは言えない。
金額のロケール書式化も候補だが、単独原因と断定したり、表示仕様を変える修正はしていない。

### ネイティブ描画とエミュレーター

同じ45秒のPerfetto記録で `RenderThread` は8.739 CPU秒、メインスレッドは4.678 CPU秒。
Reactの `IntBufferBatchMountItem::mountViews` は20回、平均29.05ms、最大98.77msだった。
描画待ちの `postAndWait` は596回、平均14.96ms、最大78.80ms。
GCは13回、平均95.39ms、最大159.58msのsliceがあった。
GCのslice全体がUI停止時間という意味ではない。

実際のレンダラーは [SwiftShader](https://github.com/google/swiftshader) で、CPUによる描画が加わる。
**このエミュレーターでの1〜2秒を実機の速度として報告できない**。
FrameTimelineにも遅延フレームがあるが、今回の通常操作トレースは修正後のみなので、
フレーム性能の修正前後の改善率は出さない。

Perfetto集計は `sched` を `thread` / `process` に結合した実行時間の和と、
アプリのthread trackのsliceで確認した。CPU時間は複数スレッドで並列に使われるため、
単純に足して壁時計の時間と比較しない。Hermesのinclusive時間も親子で重なる。
Hermesの全ProfileChunkを集計するコマンドは次のとおり。URLやアプリの記録は出力しない。

```powershell
node validation/performance/transition-probe/summarize-profile.cjs mobile/build/transition-measurements/after-js-profile.json
```

### 通信削減との関係

今回の修正は過去月の重複要求と無関係なストア更新の購読を減らした。
通常のタブ切替に必要なReactの描画・マウント・アニメーションは残る。
今回のCPU調査と短縮を確認できなかった比較結果は、描画側の負荷が残っていることと整合する。
ただしAPI要求ごとの開始・終了を画面のタイムラインに結び付けてはいないため、
通信が遅い試行へ寄与していない、とまでは言えない。

## 検証と次の判断

- 計測器を統合側でも再ビルドし、APK署名検証が成功した。
- 画像の誤一致を拒否する合成チェック、時間の上下限のチェック、
  全80行の成功状態・重複・件数・時間順序・一致率のassertを通した。
  失敗した部分実行の集計拒否と、Hermes集計の既知の時間・再帰スタックの二重計上防止も確認した。
- 比較のための一時的なアプリ変更は戻し、今回の追加は検証コード・匿名の計測値・文書だけ。
  アプリの新たな性能変更やマージはしていない。
- 次に秒単位の改善を判断するには、実機のリリース版で同じ経路を比較する必要がある。
  開発版の計測コストとSwiftShaderの影響を外した上で、Reactの画面別描画とマウントを切り分ける。
  本番API/DBの個別レイテンシ、初回起動、実機、リリース版の短縮時間は未確認。

実データを含み得る画像、Hermesの生スタック、Perfettoの生トレースはコミットせず、
ローカルの無視対象 `mobile/build/transition-measurements/` に保持した。
本人の実機検証待ち。PR #7はdraftのままにする。
