# エージェント向け運用ルール

このファイルが正本。`.claude/CLAUDE.md` はここを読み込むだけ。
Codex / Claude / その他のエージェントで扱いは同じ。

## まず読むもの

| 知りたいこと | 読むもの |
| --- | --- |
| どのファイルが何をしているか、事故につながった前提 | [.claude/FILEMAP.md](.claude/FILEMAP.md) |
| 各タブの仕様 | [docs/spec-common.md](docs/spec-common.md) と `docs/spec-*.md` |
| ブランチ運用・コミット | [docs/git.md](docs/git.md) |
| ビルド・リリース・署名鍵 | [docs/release.md](docs/release.md) |
| 役割分担（誰が決め、誰が実装するか） | [docs/subagents.md](docs/subagents.md) |
| 画面遷移 / DBスキーマ | [docs/screen-transitions.md](docs/screen-transitions.md) / [docs/er-diagram.md](docs/er-diagram.md) |

構造を変える変更（ファイルの追加・削除・移動、責務の移動）を入れたら FILEMAP.md を更新する。
タブの挙動を変えたら対応する `docs/spec-*.md` を更新する。

## マージの前に必ず本人の検証を通すこと

**エージェントが勝手にマージしない。** `main` へマージする前に、必ず本人（開発者）が
実機で動作を確認する。実装・検証・コミット・プッシュまで進めたら、**そこで止めて
「検証してください」と伝える**。「マージしますか」と聞くのではなく、検証待ちで
あることを明示する。

- 基本は本人が **Expo Go で確認**してからマージする
- **ウィジット系の変更は Expo Go では確認できない**ので、お試しのリリースビルドを
  作って実機で確かめてからマージする
- 本人から「マージして」と明示的に指示があった場合はその指示に従う

> このプロジェクトは `react-native-android-widget` / `expo-quick-actions` /
> `expo-haptics` といった独自のネイティブモジュールを使うため、**素の Expo Go では
> 起動できない**。実際の確認手段は「デバッグAPK（dev client）+ Metro」か
> 「リリースAPK」。本人が Expo Go と言った場合は前者を指していることが多い。
> どちらが必要かは変更内容から判断し、迷ったら聞く。

## 作業中の決まり

- コードを修正したら、エージェントが該当サービスを再起動する
  （`docker-compose restart backend` / `web` / `mobile`。ポートは 8787 / 5173 / 8081）
- EASビルドとリリースビルドは**指示があった場合のみ**、かつ `main` ブランチでのみ実行する。
  実行前に現在のブランチを確認する
- APKの配布先は GitHub Releases だけ。`-- --no-upload` は指示があった場合を除いて
  使わない。リリースは draft で作られ、公開には本人の publish が必要。ビルド後は
  `gh release list` で作成を確認する
- 手元の端末で試すだけなら Taildrop で送れる（`send-taildrop.bat`）

手順の詳細と止まる条件は [docs/release.md](docs/release.md)。
