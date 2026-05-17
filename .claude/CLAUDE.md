- コードを修正した後は必ず再起動をclaudeが実行してください。

## 再起動コマンド（Docker）

サービス構成: backend (port 8787) / web (port 5173) / mobile (port 8081)

- モバイル修正後: `docker-compose restart mobile`
- バックエンド修正後: `docker-compose restart backend`
- Web修正後: `docker-compose restart web`
- 全サービス: `docker-compose restart`
