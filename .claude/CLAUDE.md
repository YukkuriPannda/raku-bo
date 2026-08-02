## ファイルマップ

どこに何があるか分からないとき、または触るファイルの見当をつけたいときは
**`.claude/FILEMAP.md`** を参照すること。ディレクトリごとの役割に加えて、
コードを読むだけでは気づきにくい前提（シフトはDBに無くGoogle Calendar由来、
`lib/db.ts` は書き込みキューではなく読み取りキャッシュ、認証コールバックには
3箇所が反応する、など実際に事故につながった点）をまとめてある。

構造を変える変更（ファイルの追加・削除・移動、責務の移動）を入れたときは
FILEMAP.md も更新すること。

---

## マージの前に必ず本人の検証を通すこと

**claudeが勝手にマージしないこと。** ブランチを `main` へマージする前に、
必ず本人（開発者）が実機で動作を確認する。claudeは実装・検証・コミット・
プッシュまで進めたら、**そこで止めて「検証してください」と伝える**。
「マージしますか」と聞くのではなく、検証待ちであることを明示する。

- 基本は本人が **Expo Go で確認**してからマージする（確認できる場合のみ）
- **ウィジット系の変更は Expo Go では確認できない**ので、
  一度お試しでリリースビルドを作って実機で確かめてからマージする
- 本人から「マージして」と明示的に指示があった場合はその指示に従う

> 補足（claude向け）: このプロジェクトは `react-native-android-widget` /
> `expo-quick-actions` / `expo-haptics` といった独自のネイティブモジュールを
> 使っているため、**素の Expo Go では起動できない**。実際に確認する手段は
> 「デバッグAPK（dev client）+ Metro」か「リリースAPK」になる。
> 本人が Expo Go と言った場合は前者を指していることが多い。
> デバッグAPKで足りるか、リリースビルドが要るかは変更内容から判断し、
> 迷ったら聞くこと。

---

- コードを修正した後は必ず再起動をclaudeが実行してください。
- easビルドは指示があった場合のみ実行してください
- APKの配布先は GitHub Releases。手順は下の「リリース手順」を参照。
  `-- --no-upload` は指示があった場合を除いて使わないこと（配布経路がこれだけのため）。
  ビルド後は `gh release list` でリリースが作成されたことを確認すること

## 再起動コマンド（Docker）

サービス構成: backend (port 8787) / web (port 5173) / mobile (port 8081)

- モバイル修正後: `docker-compose restart mobile`
- バックエンド修正後: `docker-compose restart backend`
- Web修正後: `docker-compose restart web`
- 全サービス: `docker-compose restart`

## EAS ビルド（モバイル本番配布）

- Android preview (APK):
  `cd mobile && npx eas build --profile preview --platform android`
- Android production:
  `cd mobile && npx eas build --profile production --platform android`
- iOS production:
  `cd mobile && npx eas build --profile production --platform ios`
- ビルド後はQRコードまたはリンクからインストール可能

## リリース手順

配布先は GitHub Releases。`YukkuriPannda/raku-bo` は public なので、
スマホのブラウザから認証なしでAPKを直接ダウンロードできる。

1. **`mobile/app.json` の `expo.version` を上げる**（例 `1.0.0` → `1.0.1`）
2. コミットして `git push`
3. `release.bat` を実行（または `cd mobile && npm run build:android`）
4. `gh release list` か、表示されたURLでリリースを確認
5. スマホからは https://github.com/YukkuriPannda/raku-bo/releases の Assets から入れる

タグは `v<expo.version>`（例 `v1.0.1`）で、リリースノートは前回タグからの
コミットで自動生成される（`--generate-notes`）。

### ビルド前に止まる条件

APKのビルドは10〜20分かかるので、リリースの前提は**gradleを動かす前**に確認する
（`preflightRelease()`）。前提を満たさないときは20分待たされてから失敗するのではなく、
その場で止まる。

| 状況 | 挙動 |
|---|---|
| `expo.version` の上げ忘れ | タグ衝突で停止。**黙って上書きも改名もしない**（意図した仕様であり不具合ではない） |
| HEAD が未プッシュ | 停止。リリースはリモートのコミットにタグを打つため、未pushだと「APKの中身」と「リリースが指すコード」がズレる |
| `gh` が無い / 未認証 | **止めない。** ビルドは通し、完了後に手動実行用のコマンドを表示する |
| `-- --debug` | リリース処理に一切入らない（デバッグAPKは配布物ではない） |

## ローカルビルド（EASを使わない）

`cd mobile && npm run build:android`（リリースAPK。`-- --debug` でデバッグ、`-- --clean` で android/ を作り直し）

- 成果物は `mobile/build/rakubo-release-YYYYMMDD.apk`。`adb install -r <path>` で導入
- ビルド後、GitHub Release として自動公開される（無効化は `-- --no-upload`）。
  手順と前提は上の「リリース手順」を参照
- JDKとAndroid SDKはスクリプトが自動で探す（PATHのjavaが古くても可）。Android Studio が必要
- リリースビルドは接続先を本番Workerに固定する（`.env` の開発機URLは使わない）
- `eas build --local` はWindows非対応のため、`expo prebuild` + Gradle を直接実行している

### リリースビルドには署名鍵が必須

リリースは以下の4つの環境変数が揃わないと**意図的に失敗する**（未設定なら手順が表示される）。

```
RAKUBO_KEYSTORE_PATH      C:\Users\Pannda\.rakubo\rakubo-release.jks
RAKUBO_KEYSTORE_PASSWORD  （パスワードマネージャを参照）
RAKUBO_KEY_ALIAS          rakubo
RAKUBO_KEY_PASSWORD       （ストアパスワードと同一）
```

毎回シェルで設定しなくてよいように、`~/.rakubo/signing.env`（`RAKUBO_SIGNING_ENV`
で変更可）に `KEY=VALUE` 形式で置いておけばビルドスクリプトが読む。
読むのは `RAKUBO_` で始まるキーだけで、シェルで既に設定済みの値は上書きしない。

**`mobile/.env` には書かないこと。** あちらは docker-compose の `env_file` で
コンテナへ丸ごと渡るため、署名パスワードがコンテナ環境（`docker inspect` や
中の全プロセス）から見える状態になる。加えて `.env` はリポジトリ内にあり、
gitignore していても `git add -f` や同期ツール経由で外に出る余地が残る。
キーストア本体をリポジトリ外に置いているのと同じ理由で、パスワードも外に置く。

- 止めているのは、`expo prebuild` が生成する `build.gradle` が既定で
  **RNテンプレート同梱の公開デバッグ鍵**でリリースを署名するため。その秘密鍵は
  誰でも入手できるので、第三者が同じ鍵で署名した偽アプリを「更新」として
  インストールでき、SecureStore の中身まで引き継がれてしまう
- `prebuild` は `build.gradle` を作り直すため、スクリプトが毎回署名設定を注入し直す
- ビルド後に `apksigner` で署名者を検証し、デバッグ鍵だったら失敗させる
- **キーストアを失うとアプリを更新できなくなる。** リポジトリ外に置き必ずバックアップする
- デバッグビルド（`-- --debug`）にはこの制限はかからない

### 署名が3種類あるので入れ替え時は要注意

EASビルド / 旧ローカルビルド（デバッグ鍵）/ 現在のローカルビルド（上記の専用鍵）で
署名が異なる。**種類をまたいで入れ替える場合は一度アンインストールが必要。**
