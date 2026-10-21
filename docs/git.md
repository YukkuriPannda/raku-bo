# ブランチ運用（git-flow）

git-flow に準拠する。常設ブランチは 2 本、作業ブランチは 4 種類。

| ブランチ | 役割 | 分岐元 | マージ先 |
| --- | --- | --- | --- |
| `main` | リリース済みのコードだけ。タグが付くのはここ | — | — |
| `develop` | 次のリリースの統合先。既定の作業起点 | `main` | — |
| `feature/*` | 機能追加 | `develop` | `develop` |
| `fix/*` | 未リリースの不具合修正 | `develop` | `develop` |
| `release/v*` | リリース準備（版上げ・最終確認） | `develop` | `main` と `develop` |
| `hotfix/v*` | 配布済みAPKの緊急修正 | `main` | `main` と `develop` |

`chore/*`（設定・依存・CI）と `docs/*`（ドキュメントのみ）は feature と同じ扱い。

> `develop` がまだ無い場合は一度だけ `git switch -c develop main && git push -u origin develop` で作る。
> これ以前のブランチは `main` から直接切られているので、履歴の形は揃っていない。

## 日々の流れ

```bash
git switch develop && git pull
git switch -c feature/category-filter
# 実装 → 区切りごとにコミット＆プッシュ
git push -u origin feature/category-filter
```

マージは PR 経由。**本人の実機確認を通すまでマージしない**（理由と確認手段は
[../AGENTS.md](../AGENTS.md) の「マージの前に必ず本人の検証を通すこと」）。
マージ後は作業ブランチを削除する。

コミットメッセージは日本語の命令形・一行で、何をしたかだけ書く
（例: `履歴画面に月の切り替えとカテゴリ絞り込みを追加`）。

## リリース

版上げとタグ打ちは `release/*` の中で完結させる。手順と前提条件の詳細は
[release.md](release.md) にある。

```bash
git switch -c release/v1.0.1 develop
# mobile/app.json の expo.version を上げてコミット
git switch main && git merge --no-ff release/v1.0.1
git push                      # タグは push 済みコミットに付く必要がある
# main で release.bat → draft を確認して publish
git switch develop && git merge --no-ff release/v1.0.1
git branch -d release/v1.0.1
```

EASビルドとリリースビルドは `main` でしか許可されない。タグは `v<expo.version>`。

## hotfix

配布済みAPKに問題が出たときだけ使う。`main` から切り、`main` と `develop` の
両方へ戻す（戻し忘れると次のリリースで修正が消える）。

```bash
git switch -c hotfix/v1.0.2 main
# 修正 → expo.version を上げる
git switch main && git merge --no-ff hotfix/v1.0.2
git switch develop && git merge --no-ff hotfix/v1.0.2
```

## やらないこと

- `main` / `develop` への直接コミット
- 共有済みブランチの `push --force`
- 本人の確認前のマージ
- `main` 以外でのEASビルド・リリースビルド
