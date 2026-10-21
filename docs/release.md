# ビルドとリリース

正式配布先は GitHub Releases だけ。`YukkuriPannda/raku-bo` は public なので、
publish 後はスマホのブラウザから認証なしで APK を直接ダウンロードできる。

**リリースは draft（下書き）として作られる。** 本人が説明文を確認してから
publish するまで、外部には見えない。

ブランチ運用は [git.md](git.md) を参照。EASビルド・正式リリースビルドは `main` 限定。
PR検証用のローカルAPKは、次節の手順でPRの作業ブランチから作る。

## PR作成時の検証用APK

アプリの変更を含むPRは、**draft PR作成・更新 → ビルド → Taildrop送信 → 本人の実機検証待ち**まで行う。
文書だけの変更は対象外。EAS、バージョン変更、タグ、GitHub Release作成・公開、マージはこの手順に含めない。

1. 実装と必要なチェックを終え、コミット・プッシュしてdraft PRを作成・更新する。
2. PRのブランチ・HEAD・未コミット差分を確認し、アプリのソースがPRのHEADと一致する状態にする。
3. `mobile` で `npm run build:android -- --no-upload` を実行する。
   既存の専用署名鍵を使う、Metro不要のAPKになる。接続先は本番Workerなので、試すときの保存操作は本番データへ反映される。
4. 成功したAPKを `mobile/build/rakubo-pr-<PR番号>-<HEAD先頭7桁>.apk` へコピーする。
   ファイルの更新時刻・サイズ・SHA-256、ビルド元HEADを記録し、署名検証の成功を確認する。
5. 送り先は今回の明示指定、`RAKUBO_TAILDROP_TARGET`、同じ依頼で確認済みの本人の端末の順で決める。
   `tailscale status` で現在の接続を確認する。送り先が不明・複数で特定できない場合は本人に確認する。
6. `send-taildrop.bat "<今回作ったAPKの絶対パス>" <端末名>` を実行する。
   引数なしで「最新APK」を選ばせず、今回ビルドしたファイルを指定する。
7. Taildropの終了コードと結果を確認してから送信成功とし、PR本文にHEAD・APK名・送信先・ビルド/送信結果を追記する。
   失敗・オフラインなら未完了と報告する。送信成功と端末での受信確認・インストール・動作確認は分けて報告する。
8. 「実機で検証してください」と伝えて止まる。本人の確認前にマージしない。

PR作成後にアプリのソースを変更したら、新しいHEADで同じビルド・送信をやり直す。
文書だけの追記では、先に送ったAPKのビルド元HEADを保持して記録する。

## 手順

1. `mobile/app.json` の `expo.version` を上げる（例 `1.0.0` → `1.0.1`）
2. コミットして `git push`
3. `release.bat` を実行（中身は `cd mobile && npm run build:android`）
4. `gh release create` の出力に出る URL を開き、**自動生成された説明文に目を通す**
   （`--generate-notes` なので内容が実態と合っているか確認する）
5. GitHub 上で **publish**（忘れると誰にも配布されない）
6. スマホからは https://github.com/YukkuriPannda/raku-bo/releases の Assets から入れる

タグは `v<expo.version>`。リリースノートは前回タグからのコミットで自動生成される。
ビルド後は `gh release list`（draft も表示される）で作成を確認すること。

`-- --no-upload` はPR検証用か指示があった場合に使う。正式配布では使わない。

## ビルド前に止まる条件

APK のビルドは10〜20分かかるので、前提は**gradle を動かす前**に確認する
（`preflightRelease()`）。満たさないときは20分待たされてから失敗するのではなく、
その場で止まる。

| 状況 | 挙動 |
| --- | --- |
| `expo.version` の上げ忘れ（タグが既出） | 停止。**黙って上書きも改名もしない**（意図した仕様） |
| `expo.version` の上げ忘れ（publish し忘れの draft が残っている） | 停止。draft は publish するまで git タグを作らないため、タグの有無では検出できない。`gh release view <tag>` で確認する（`gh` が使えるときのみ） |
| HEAD が未プッシュ | 停止。リモートのコミットにタグを打つため、未 push だと「APKの中身」と「リリースが指すコード」がズレる |
| `gh` が無い / 未認証 | **止めない。** ビルドは通し、完了後に手動実行用のコマンドを表示する。ただし draft の重複は検出できない |
| `-- --debug` | リリース処理に一切入らない（デバッグAPKは配布物ではない） |

## ローカルビルド（EASを使わない）

```bash
cd mobile && npm run build:android     # リリースAPK
#   -- --debug   デバッグAPK（リリース処理に入らない）
#   -- --clean   android/ を作り直す
```

- 成果物は `mobile/build/rakubo-release-YYYYMMDD.apk`。`adb install -r <path>` で導入
- ビルド後に GitHub Release が draft として自動作成される（無効化は `-- --no-upload`）
- JDK と Android SDK はスクリプトが自動で探す（PATH の java が古くても可）。Android Studio が必要
- リリースビルドは接続先を本番 Worker に固定する（`.env` の開発機URLは使わない）
- `eas build --local` は Windows 非対応のため、`expo prebuild` + Gradle を直接実行している

### 署名鍵が無いとリリースビルドは失敗する

次の4つが揃わないと**意図的に失敗する**（未設定なら手順が表示される）。

```
RAKUBO_KEYSTORE_PATH      C:\Users\Pannda\.rakubo\rakubo-release.jks
RAKUBO_KEYSTORE_PASSWORD  （パスワードマネージャを参照）
RAKUBO_KEY_ALIAS          rakubo
RAKUBO_KEY_PASSWORD       （ストアパスワードと同一）
```

毎回シェルで設定しなくてよいように、`~/.rakubo/signing.env`（`RAKUBO_SIGNING_ENV`
で変更可）に `KEY=VALUE` 形式で置いておけばビルドスクリプトが読む。読むのは
`RAKUBO_` で始まるキーだけで、シェルで既に設定済みの値は上書きしない。

**`mobile/.env` には書かないこと。** あちらは docker-compose の `env_file` で
コンテナへ丸ごと渡るため、署名パスワードがコンテナ環境（`docker inspect` や中の
全プロセス）から見える。加えて `.env` はリポジトリ内にあり、gitignore していても
`git add -f` や同期ツール経由で外に出る余地が残る。キーストア本体をリポジトリ外に
置いているのと同じ理由で、パスワードも外に置く。

止めている理由と仕組み:

- `expo prebuild` が生成する `build.gradle` は既定で **RNテンプレート同梱の公開
  デバッグ鍵**でリリースを署名する。その秘密鍵は誰でも入手できるので、第三者が
  同じ鍵で署名した偽アプリを「更新」としてインストールでき、SecureStore の中身まで
  引き継がれてしまう
- `prebuild` は `build.gradle` を作り直すため、スクリプトが毎回署名設定を注入し直す
- ビルド後に `apksigner` で署名者を検証し、デバッグ鍵だったら失敗させる
- **キーストアを失うとアプリを更新できなくなる。** リポジトリ外に置き必ずバックアップする
- デバッグビルド（`-- --debug`）にはこの制限はかからない

### 署名が3種類あるので入れ替え時は注意

EASビルド / 旧ローカルビルド（デバッグ鍵）/ 現在のローカルビルド（専用鍵）で
署名が異なる。**種類をまたいで入れ替える場合は一度アンインストールが必要**で、
アプリのデータとログイン状態が消える。

## EAS ビルド

指示があった場合のみ実行する。`main` ブランチ限定。

```bash
cd mobile
npx eas build --profile preview --platform android      # APK
npx eas build --profile production --platform android
npx eas build --profile production --platform ios
```

ビルド後は QR コードまたはリンクからインストールできる。

## 手元の端末に送る（Taildrop）

GitHub Release を経由せず、ビルドした APK をそのまま自分のスマホへ送る。
publish 前の動作確認用で、配布経路ではない。

```bash
send-taildrop.bat                         # 最新のリリースAPKを送る
send-taildrop.bat <ファイル> <端末名>      # 任意のファイル・送り先
```

送り先は引数、無ければ環境変数 `RAKUBO_TAILDROP_TARGET`。どちらも無いときは
`tailscale status` の一覧を出して止まる（勝手に送らない）。
