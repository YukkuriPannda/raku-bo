- コードを修正した後は必ず再起動をclaudeが実行してください。
- easビルドは指示があった場合のみ実行してください

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
- JDKとAndroid SDKはスクリプトが自動で探す（PATHのjavaが古くても可）。Android Studio が必要
- リリースビルドは接続先を本番Workerに固定する（`.env` の開発機URLは使わない）
- `eas build --local` はWindows非対応のため、`expo prebuild` + Gradle を直接実行している
- EASビルドとは署名鍵が異なるため、入れ替える際は一度アンインストールが必要
