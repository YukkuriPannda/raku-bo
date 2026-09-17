---
name: raku-bo-eas-build
description: raku-bo の EAS クラウドビルドを依頼されたときに、ビルド対象とアップロード範囲を確認し、完了した APK またはアプリのリンクを渡す。
---

# raku-bo の EAS ビルド

このスキルはユーザーが EAS ビルドを指示したときに使う。プロファイルとプラットフォームは依頼と直近の文脈で決める。Android 実機確認なら通常は `preview` / `android`（APK）。判断できない場合はビルド開始前に確認する。ローカル Gradle ビルドや GitHub Releases への公開は別作業。

## 開始前

- リポジトリルートで `git status --short --untracked-files=all` と HEAD を確認する。EAS はローカルの作業内容をアップロードするため、未コミット・未追跡ファイルがあれば送信対象を確認する。秘密情報や依頼外のファイルを含めない。
- `mobile/eas.json`、`mobile/app.json`、`mobile/.easignore` と `AGENTS.md` の現行ルールを読む。`.easignore` は EAS アーカイブの除外指定で、`.env`、署名鍵、ローカルの `android/`・`build/` を含めない。preview の API 接続先は `eas.json` で指定されている。
- `cd mobile` で `eas whoami` を実行し、ログインとプロジェクトの一致を確認する。アカウントのメールアドレスや環境変数の値は報告に載せない。

## 実行と完了判定

- Android preview の実行例: `cd mobile && eas build --profile preview --platform android --non-interactive`。グローバル CLI がなければ `npx eas` を使う。EAS の既存キーストアを利用し、署名設定を勝手に作り直さない。
- Windows の制限付きシェルで `uv_os_get_passwd returned ENOMEM` が出た場合は、CLI を権限のあるネットワーク実行環境で再実行する。同じ条件で繰り返さない。
- 出力されたビルド ID と Expo のビルドページを控える。CLI の待機表示が静かでも、必要に応じて `eas build:view <id> --json` で状態を確認する。`IN_PROGRESS` は完了扱いにしない。
- `FINISHED` と `artifacts.buildUrl` を確認してから成功を報告する。失敗時はビルドログの該当箇所を確認して原因を伝える。preview 環境の変数名が読み込まれたかは確認してよいが、値や署名情報を露出させない。
- 結果にはプロファイル、プラットフォーム、ビルド ID、安定した Expo ビルドページ、実機検証の残りを含める。EAS preview ビルドだけでは GitHub Release は作らない。push、公開、`main` へのマージはそれぞれの指示とプロジェクトの検証ルールに従う。

## 実機に入れる依頼もある場合

APK のパッケージ名と署名を確認し、ADB で認証済み端末を特定してから `adb install -r` でデータを保持して更新する。署名不一致で拒否された場合、既存アプリを自動でアンインストールしない。EAS・ローカルデバッグ・ローカルリリースの署名は異なり得る。端末が未接続なら Expo ビルドページからのインストール先を案内し、実機への導入は未完了と明示する。
