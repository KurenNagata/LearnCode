# CLAUDE.md

このファイルは Claude Code 用のプロジェクト文脈です。作業の前に必ず目を通し、ここに書かれた構成とルールを守ってください。

## プロジェクト
プログラミング学習 Web アプリ。問題を提示し、ユーザーがコードを書いて実行 → 隠しテストケース全通過で正解判定 → 次に進める、という学習ループが中心。
詳細仕様は **docs/spec.md** を参照（docs/spec.md が唯一の正）。

## 技術スタック
- フロント: React + Monaco Editor（`web/`）
- バックエンド: Go（`api/`）
- API 設計: API ファースト（TypeSpec → OpenAPI 3.0 → Go コード生成 / oapi-codegen）
- DB: PostgreSQL（ドライバ pgx、ローカルは Docker）
- コード実行: Piston（Docker・ローカル自己ホスト）
- ツール管理: mise（go / node / task）／ コマンド実行: go-task

## トップレベルの分類（役割ベース）
- `api/`      … Go バックエンド（API サーバー）
- `web/`      … React + Monaco のフロント
- `typespec/` … TypeSpec による API 定義（仕様の入力源）
- `docs/`     … ドキュメント置き場（仕様書 `docs/spec.md` はここ）
- `infra/`    … インフラ設定置き場（`docker-compose.yml` などローカル環境）

## 必ず守るルール
1. **API ファースト**: API を変えるときは Go を手で直さず、`typespec/main.tsp` を編集して再生成する。生成物（`api/internal/openapi/openapi.gen.go`、`typespec/tsp-output/`）は手編集しない。
2. **層構造と依存方向**: 依存は外→内の一方向（handler → service → repository）。層の境界は interface で切る（`api/internal/service/ports.go` に repository / piston の interface を定義し、具体実装がそれを満たす）。service は HTTP・SQL・Piston の詳細を直接知らない。配線は `api/cmd/server/main.go` が担当する。
3. **ツール運用**: バージョンは mise、コマンドは go-task（`task run` など）。mise 内蔵のタスクランナーは使わない。実行系は生のコマンドで案内せず Taskfile に定義する。
4. **セキュリティ**: Piston はインターネットに公開しない（compose ネットワーク内で Go からのみアクセス）。実行に時間・メモリ・出力サイズの制限を設ける。隠しテストの中身は API レスポンスに含めない。
5. **スコープ**: 仕様書の範囲を超える機能は足さない。迷ったら手を止めて確認する。各フェーズ完了時に一言報告する。

## ディレクトリ構成（この通りに作る／保つ）
```
lerning_langeage/
├── mise.toml                      # ツールのバージョン固定（go / node / task）
├── Taskfile.yml                   # コマンド集（task run / gen / infra:up など）
├── CLAUDE.md                      # このファイル
├── README.md
├── .gitignore
├── .env.example                   # 設定例（DB接続・Piston URL・ポート）
├── .env                           # (gitignore) 実際の設定
├── docs/
│   └── spec.md                    # 仕様書（ドキュメント・唯一の正）
├── infra/
│   └── docker-compose.yml         # PostgreSQL ＋ Piston（インフラ）
├── typespec/                      # API 仕様（TypeSpec）
│   ├── main.tsp                   # API 定義（問題取得・コード提出 など）
│   ├── tspconfig.yaml             # OpenAPI(3.0) 出力設定
│   ├── package.json
│   ├── node_modules/              # (生成・gitignore)
│   └── tsp-output/                # (生成) OpenAPI 出力先
│       └── @typespec/openapi3/openapi.yaml   # Go 生成の入力
├── api/                           # Go バックエンド（層構造）
│   ├── go.mod
│   ├── go.sum
│   ├── cmd/
│   │   ├── server/main.go         # 起動・配線（composition root）= server層
│   │   └── seed/main.go           # seed/ の問題JSONをDBへ投入（task seed）
│   ├── internal/
│   │   ├── config/config.go       # 環境変数の読み込み
│   │   ├── domain/
│   │   │   ├── problem.go          # 型: Problem, TestCase
│   │   │   └── progress.go         # 型: Progress
│   │   ├── openapi/                # (生成) OpenAPIから生成するコード
│   │   │   ├── oapi-codegen.yaml   # oapi-codegen 設定
│   │   │   ├── generate.go         # //go:generate（再生成用）
│   │   │   └── openapi.gen.go      # (生成) Handlerのinterface・モデル
│   │   ├── handler/handler.go     # Handler層: 生成interfaceを実装
│   │   ├── service/
│   │   │   ├── ports.go            # repository / piston の interface 定義
│   │   │   ├── problem.go          # 問題取得ロジック
│   │   │   └── judge.go            # 採点ロジック（Piston実行＋出力比較）
│   │   ├── repository/
│   │   │   ├── postgres.go         # 接続（pgx）
│   │   │   ├── problem_repo.go     # problems / test_cases アクセス
│   │   │   └── progress_repo.go    # progress アクセス
│   │   └── piston/client.go       # Piston実行クライアント
│   ├── migrations/
│   │   └── 0001_init.sql          # テーブル作成（problems / test_cases / progress）
│   └── seed/
│       └── python/0001_print_hello.json   # 問題＋隠しテストケース（1問）
└── web/                           # フロント（React+Monaco）= 次のセッションで作成
    └── .gitkeep
```

## よく使うコマンド
- `mise install` … ツールを揃える
- `task infra:up` / `task infra:down` … Postgres ＋ Piston の起動 / 停止
- `task gen` … TypeSpec → OpenAPI → Go 生成
- `task migrate` / `task seed` … スキーマ作成 / 問題投入
- `task run` … バックエンド起動
- `task check` … 提出APIのスモークテスト

## 現在のフェーズ
ローカルのバックエンド縦スライス（コード提出 → Piston 実行 → 隠しテスト判定）まで。
React+Monaco フロント（`web/`）と、Render / Oracle へのデプロイは未着手（将来）。
