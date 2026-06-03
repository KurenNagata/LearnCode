# learning_language

プログラミング言語を「自分で書いて・実行して・テストに通して」学べる学習用 Web アプリ。
問題を解きながらコードを書いて実行 → 隠しテストケースに全て通れば次へ進める、という演習中心の学習ループを提供します。

## 特徴
- 問題を見ながらブラウザ上のエディタ（Monaco）でコードを書く
- サーバーでコードを実行し、隠しテストケースで自動判定
- 通らなければ何度でも再挑戦、詰まったら解説・解答例を確認
- 言語ごとにコースを用意（v1 は Python から）

## 技術スタック
- フロントエンド: React + Monaco Editor（`web/`）
- バックエンド: Go（`api/`）
- API 設計: API ファースト（TypeSpec → OpenAPI 3.0 → Go / oapi-codegen）（`typespec/`）
- データベース: PostgreSQL（ドライバ pgx）
- コード実行: Piston（Docker・自己ホスト）
- ツール管理: mise ／ コマンド実行: go-task

## ディレクトリ構成
```
learning_language/
├── api/          # Go バックエンド（層構造: handler / service / repository ...）
├── typespec/     # TypeSpec による API 定義（OpenAPI を生成）
├── web/          # React + Monaco のフロント（開発予定）
├── docs/         # ドキュメント（仕様書 docs/spec.md）
├── infra/        # docker-compose（PostgreSQL + Piston）
├── CLAUDE.md     # Claude Code 用のプロジェクト文脈・ルール
└── Taskfile.yml  # 開発コマンド集
```

## 必要なもの
- [mise](https://mise.jdx.dev/)（go / node / task のバージョン管理）
- Docker（PostgreSQL と Piston をローカルで起動）

## セットアップ
```bash
mise install      # ツールを揃える
task infra:up     # PostgreSQL + Piston を起動
task gen          # TypeSpec → OpenAPI → Go コード生成
task migrate      # DB スキーマ作成
task seed         # サンプル問題を投入
task run          # バックエンドを起動
```

動作確認:
```bash
task check        # 提出 API のスモークテスト
```

## 開発の進め方
- API を変えるときは Go を直接書かず、`typespec/main.tsp` を編集して `task gen` で再生成します（生成コードは手編集しない）。
- バックエンドは層構造（handler → service → repository、境界は interface）で、依存は外→内の一方向です。
- 詳しい仕様は [docs/spec.md](docs/spec.md)、開発ルールは [CLAUDE.md](CLAUDE.md) を参照してください。

## ステータス / ロードマップ
現在はローカルで動くバックエンドの縦スライス（コード提出 → Piston 実行 → 隠しテスト判定）を構築中です。

- [ ] バックエンドの縦スライス（Python の1問が通る）
- [ ] 問題を増やしてコース化（初級 → 応用）
- [ ] React + Monaco のフロント
- [ ] 言語追加（JavaScript / TypeScript → C++ → C# …）
- [ ] 公開（認証・進捗のクラウド保存・デプロイ）
