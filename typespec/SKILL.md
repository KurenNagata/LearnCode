---
name: go-layered-backend
description: Go バックエンド(api/)に機能やデータの流れを追加・変更するときに使う。handler/service/repository の層構造、依存の向き、interface での境界の切り方を扱う。
---

# Go バックエンドの層構造で機能を追加する

依存の向きは外→内の一方向（handler → service → repository）。層の境界は interface で切る。service は HTTP・SQL・Piston の詳細を直接知らない。

## 手順
1. `api/internal/domain/` に型・エンティティを追加/拡張する。
2. service が必要とする操作を `api/internal/service/ports.go` に interface として宣言する（例: repository のメソッド、コード実行の CodeRunner）。
3. その interface を具体実装する。DB なら `api/internal/repository/`（pgx）、コード実行なら `api/internal/piston/`。
4. 業務ロジックを `api/internal/service/` に書く。
5. 生成された handler interface を `api/internal/handler/` で実装する（リクエスト解析 → service 呼び出し → レスポンス変換。ロジックは持たない）。
6. 具体実装を service・handler に組み立てる配線を `api/cmd/server/main.go` に書く。

## 原則
- service は `ports.go` の interface だけに依存し、Postgres や Piston の具体型・HTTP を import しない。
- 新しい外部依存が増えたら、まず interface を `ports.go` に足してから実装する。
