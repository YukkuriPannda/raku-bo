- コードを修正した後は必ず再起動をclaudeが実行してください。
- easビルドは指示があった場合のみ実行してください
- APKをビルドしたら必ずGoogleドライブへ配置してください。スマホへの配布経路がこれだけのため、
  `-- --no-upload` は指示があった場合を除いて使わないこと。ビルド後に
  `G:\マイドライブ\raku-bo\apk\` にファイルが増えたことを確認してください

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

## ローカルビルド（EASを使わない）

`cd mobile && npm run build:android`（リリースAPK。`-- --debug` でデバッグ、`-- --clean` で android/ を作り直し）

- 成果物は `mobile/build/rakubo-release-YYYYMMDD.apk`。`adb install -r <path>` で導入
- ビルド後に `G:\マイドライブ\raku-bo\apk\` へ自動コピーされ、Googleドライブが同期する
  （スマホから直接ダウンロード可能。保存先は `RAKUBO_DRIVE_DIR`、無効化は `-- --no-upload`）
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
