# エージェント向け運用ルール

このファイルが正本。`.claude/CLAUDE.md` はここを読み込むだけ。
Codex / Claude / その他のエージェントで扱いは同じ。

## まず読むもの

| 知りたいこと | 読むもの |
| --- | --- |
| どのファイルが何をしているか、事故につながった前提 | [.claude/FILEMAP.md](.claude/FILEMAP.md) |
| 各タブの仕様 | [docs/spec-common.md](docs/spec-common.md) と `docs/spec-*.md` |
| 各ウィジェットの仕様 | [docs/spec-widget-common.md](docs/spec-widget-common.md) と `docs/spec-widget-*.md` |
| ブランチ運用・コミット | [docs/git.md](docs/git.md) |
| ビルド・リリース・署名鍵 | [docs/release.md](docs/release.md) |
| 役割分担（誰が決め、誰が実装するか） | [docs/subagents.md](docs/subagents.md) |
| 画面遷移 / DBスキーマ | [docs/screen-transitions.md](docs/screen-transitions.md) / [docs/er-diagram.md](docs/er-diagram.md) |

構造を変える変更（ファイルの追加・削除・移動、責務の移動）を入れたら FILEMAP.md を更新する。
タブやウィジェットの挙動を変えたら対応する `docs/spec-*.md` を更新する。

## 作業の流れ

1. **読む** — FILEMAP.md で触る場所の見当をつけ、タブの変更なら該当の `docs/spec-*.md` を読む。
   既にある仕組み（ストアのaction、`constants/theme.ts` のトークン、既存のhook）を先に探す
2. **ブランチを切る** — `develop` から `feature/*` ／ `fix/*`（[docs/git.md](docs/git.md)）。
   `main` と `develop` では直接作業しない
3. **分ける** — 独立した実装が複数あるなら [docs/subagents.md](docs/subagents.md) の分担で回す。
   契約（型・APIのパス・DBのカラム）を先に固めてから投げる。分割の手間が変更より
   大きいなら自分でやる
4. **実装する** — 変更が届く先（呼び出し元・型・ウィジェット・web側）まで含めて終わらせる。
   仕様を変えたらドキュメントも同じコミットで直す
5. **動かす** — 触ったサービスを再起動し、型チェックを通す

   ```bash
   docker-compose restart mobile          # backend / web も同様
   cd mobile && npm run type-check        # backend も同じ。web は npm run build
   ```

   自動テストは無い。動作確認はエミュレーターで行い、ログインが必要な場面だけ本人を呼ぶ
6. **コミットしてプッシュ** — 区切りごとに確認を取らずコミットし、プッシュまで進める。
   メッセージは日本語の命令形・一行
7. **PRを作り、ビルドして送る** — アプリの変更は draft PR を作成・更新したら、PRのHEADから
   検証用APKをビルドし、Taildropで本人の端末へ送る。既存APKの使い回しや、PR作成だけで完了にしない。
   手順・送信先・完了判定は [docs/release.md](docs/release.md#pr作成時の検証用apk) に従う。
   文書だけの変更はAPKを作り直す必要はない。
8. **止まる** — ビルドと送信の結果を伝え、**マージはしない。**「実機で検証してください」と伝える（次節）

途中で詰まったら、原因を仕様不備／探索不足／タスク過大に分類してから作り直す。
同じ条件で同じやり直しをしない。

## マージの前に必ず本人の検証を通すこと

**エージェントが勝手にマージしない。** `main` へマージする前に、必ず本人（開発者）が
実機で動作を確認する。実装・検証・コミット・プッシュ・PR作成・検証用APKのビルドとTaildrop送信まで進めたら、**そこで止めて
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

## ビルドと配布

サービスのポートは backend 8787 / web 5173 / mobile 8081（再起動は「作業の流れ」5)。

- EASビルドと正式リリースビルドは**指示があった場合のみ**、かつ `main` ブランチでのみ実行する。
  PR検証用のローカルAPKは例外としてPRの作業ブランチで `-- --no-upload` を付けて作る。
  実行前に現在のブランチとHEADを確認する
- 正式APKの配布先は GitHub Releases だけ。`-- --no-upload` はPR検証用か指示があった場合に使う。
  正式リリースは draft で作られ、公開には本人の publish が必要。正式ビルド後は
  `gh release list` で作成を確認する
- 手元の端末で試すだけなら Taildrop で送れる（`send-taildrop.bat`）

手順の詳細と止まる条件は [docs/release.md](docs/release.md)。
