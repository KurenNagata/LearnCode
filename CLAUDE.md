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
バックエンド縦スライス＋React+Monaco フロントまで完成。コード実行は **glot.io**（外部 Run API）に変更済み（旧 Piston コードは差し戻し用に残置）。
デプロイ構成は **フロント=Cloudflare Workers / API=Cloud Run / DB=Neon / 実行=glot.io** の分離構成（別オリジン＝CORS あり）。手順は `docs/deploy.md`。
進捗: ① Neon 完了 → ② glot.io トークン取得 → ③ Cloud Run → ④ Cloudflare Workers（②以降を進行中）。














<!-- cloude-code-toolbox:mcp-skills-awareness-begin -->

### MCP & Skills awareness (Cloude Code ToolBox)

_Last synced: 2026-06-17T06:31:43.612Z._

- **Full report:** `.claude/cloude-code-toolbox-mcp-skills-awareness.md` in this workspace (auto-overwritten on each scan). Use it as ground truth for configured servers and skill folders.
- **MCP:** For **live tools** in Claude Code, enable the matching server via `/mcp`. Servers are configured in `~/.claude.json` (user) and `.mcp.json` (project).
- **When the user’s task matches a server** (e.g. Confluence work and a **Confluence** / **Atlassian** MCP is listed), **prefer that server id** and plan on tool use—not only file search.
- **Skills:** Folders below contain `SKILL.md`; attach or cite paths in chat when relevant.

#### Workspace MCP

- `c:\Users\xxxxx\LearnCode\.mcp.json` _(workspace: LearnCode)_ — _file missing_

_No active workspace servers in mcp.json._

#### User MCP

- `C:\Users\xxxxx\.claude.json` — _no servers defined_

_No active user-scoped servers in mcp.json._

#### Project skills

_None found (or no workspace open)._

#### User skills

- **agents-sdk** — `C:\Users\xxxxx\.copilot\skills\agents-sdk` — Build AI agents on Cloudflare Workers using the Agents SDK. Load when creating stateful agents, durable workflows, real-time WebSocket apps, scheduled tasks, MCP servers, chat applications, voice agents, or browser autom

- **cloudflare** — `C:\Users\xxxxx\.copilot\skills\cloudflare` — Comprehensive Cloudflare platform skill covering Workers, Pages, storage (KV, D1, R2), AI (Workers AI, Vectorize, Agents SDK), feature flags (Flagship), networking (Tunnel, Spectrum), security (WAF, DDoS), and infrastruc

- **cloudflare-email-service** — `C:\Users\xxxxx\.copilot\skills\cloudflare-email-service` — Send and receive transactional emails with Cloudflare Email Service (Email Sending + Email Routing). Use when building email sending (Workers binding or REST API), email routing, Agents SDK email handling, or integrating

- **durable-objects** — `C:\Users\xxxxx\.copilot\skills\durable-objects` — Create and review Cloudflare Durable Objects. Use when building stateful coordination (chat rooms, multiplayer games, booking systems), implementing RPC methods, SQLite storage, alarms, WebSockets, or reviewing DO code f

- **sandbox-sdk** — `C:\Users\xxxxx\.copilot\skills\sandbox-sdk` — Build sandboxed applications for secure code execution. Load when building AI code execution, code interpreters, CI/CD systems, interactive dev environments, or executing untrusted code. Covers Sandbox SDK lifecycle, com

- **turnstile-spin** — `C:\Users\xxxxx\.copilot\skills\turnstile-spin` — Set up Cloudflare Turnstile end-to-end in a project — scan the codebase, create the widget via the Cloudflare API, deploy the managed siteverify Worker, write the frontend snippets, validate, and persist the skill. Load 

- **web-perf** — `C:\Users\xxxxx\.copilot\skills\web-perf` — Analyzes web performance using Chrome DevTools MCP. Measures Core Web Vitals (LCP, INP, CLS) and supplementary metrics (FCP, TBT, Speed Index), identifies render-blocking resources, network dependency chains, layout shif

- **workers-best-practices** — `C:\Users\xxxxx\.copilot\skills\workers-best-practices` — Reviews and authors Cloudflare Workers code against production best practices. Load when writing new Workers, reviewing Worker code, configuring wrangler.jsonc, or checking for common Workers anti-patterns (streaming, fl

- **wrangler** — `C:\Users\xxxxx\.copilot\skills\wrangler` — Cloudflare Workers CLI for deploying, developing, and managing Workers, KV, R2, D1, Vectorize, Hyperdrive, Workers AI, Containers, Queues, Workflows, Pipelines, and Secrets Store. Load before running wrangler commands to

- **agents-sdk** — `C:\Users\xxxxx\.claude\skills\agents-sdk` — Build AI agents on Cloudflare Workers using the Agents SDK. Load when creating stateful agents, durable workflows, real-time WebSocket apps, scheduled tasks, MCP servers, chat applications, voice agents, or browser autom

- **cloudflare** — `C:\Users\xxxxx\.claude\skills\cloudflare` — Comprehensive Cloudflare platform skill covering Workers, Pages, storage (KV, D1, R2), AI (Workers AI, Vectorize, Agents SDK), feature flags (Flagship), networking (Tunnel, Spectrum), security (WAF, DDoS), and infrastruc

- **cloudflare-email-service** — `C:\Users\xxxxx\.claude\skills\cloudflare-email-service` — Send and receive transactional emails with Cloudflare Email Service (Email Sending + Email Routing). Use when building email sending (Workers binding or REST API), email routing, Agents SDK email handling, or integrating

- **durable-objects** — `C:\Users\xxxxx\.claude\skills\durable-objects` — Create and review Cloudflare Durable Objects. Use when building stateful coordination (chat rooms, multiplayer games, booking systems), implementing RPC methods, SQLite storage, alarms, WebSockets, or reviewing DO code f

- **sandbox-sdk** — `C:\Users\xxxxx\.claude\skills\sandbox-sdk` — Build sandboxed applications for secure code execution. Load when building AI code execution, code interpreters, CI/CD systems, interactive dev environments, or executing untrusted code. Covers Sandbox SDK lifecycle, com

- **turnstile-spin** — `C:\Users\xxxxx\.claude\skills\turnstile-spin` — Set up Cloudflare Turnstile end-to-end in a project — scan the codebase, create the widget via the Cloudflare API, deploy the managed siteverify Worker, write the frontend snippets, validate, and persist the skill. Load 

- **web-perf** — `C:\Users\xxxxx\.claude\skills\web-perf` — Analyzes web performance using Chrome DevTools MCP. Measures Core Web Vitals (LCP, INP, CLS) and supplementary metrics (FCP, TBT, Speed Index), identifies render-blocking resources, network dependency chains, layout shif

- **workers-best-practices** — `C:\Users\xxxxx\.claude\skills\workers-best-practices` — Reviews and authors Cloudflare Workers code against production best practices. Load when writing new Workers, reviewing Worker code, configuring wrangler.jsonc, or checking for common Workers anti-patterns (streaming, fl

- **wrangler** — `C:\Users\xxxxx\.claude\skills\wrangler` — Cloudflare Workers CLI for deploying, developing, and managing Workers, KV, R2, D1, Vectorize, Hyperdrive, Workers AI, Containers, Queues, Workflows, Pipelines, and Secrets Store. Load before running wrangler commands to

- **agents-sdk** — `C:\Users\xxxxx\.cursor\skills\agents-sdk` — Build AI agents on Cloudflare Workers using the Agents SDK. Load when creating stateful agents, durable workflows, real-time WebSocket apps, scheduled tasks, MCP servers, chat applications, voice agents, or browser autom

- **cloudflare** — `C:\Users\xxxxx\.cursor\skills\cloudflare` — Comprehensive Cloudflare platform skill covering Workers, Pages, storage (KV, D1, R2), AI (Workers AI, Vectorize, Agents SDK), feature flags (Flagship), networking (Tunnel, Spectrum), security (WAF, DDoS), and infrastruc

- **cloudflare-email-service** — `C:\Users\xxxxx\.cursor\skills\cloudflare-email-service` — Send and receive transactional emails with Cloudflare Email Service (Email Sending + Email Routing). Use when building email sending (Workers binding or REST API), email routing, Agents SDK email handling, or integrating

- **durable-objects** — `C:\Users\xxxxx\.cursor\skills\durable-objects` — Create and review Cloudflare Durable Objects. Use when building stateful coordination (chat rooms, multiplayer games, booking systems), implementing RPC methods, SQLite storage, alarms, WebSockets, or reviewing DO code f

- **sandbox-sdk** — `C:\Users\xxxxx\.cursor\skills\sandbox-sdk` — Build sandboxed applications for secure code execution. Load when building AI code execution, code interpreters, CI/CD systems, interactive dev environments, or executing untrusted code. Covers Sandbox SDK lifecycle, com

- **turnstile-spin** — `C:\Users\xxxxx\.cursor\skills\turnstile-spin` — Set up Cloudflare Turnstile end-to-end in a project — scan the codebase, create the widget via the Cloudflare API, deploy the managed siteverify Worker, write the frontend snippets, validate, and persist the skill. Load 

- **web-perf** — `C:\Users\xxxxx\.cursor\skills\web-perf` — Analyzes web performance using Chrome DevTools MCP. Measures Core Web Vitals (LCP, INP, CLS) and supplementary metrics (FCP, TBT, Speed Index), identifies render-blocking resources, network dependency chains, layout shif

- **workers-best-practices** — `C:\Users\xxxxx\.cursor\skills\workers-best-practices` — Reviews and authors Cloudflare Workers code against production best practices. Load when writing new Workers, reviewing Worker code, configuring wrangler.jsonc, or checking for common Workers anti-patterns (streaming, fl

- **wrangler** — `C:\Users\xxxxx\.cursor\skills\wrangler` — Cloudflare Workers CLI for deploying, developing, and managing Workers, KV, R2, D1, Vectorize, Hyperdrive, Workers AI, Containers, Queues, Workflows, Pipelines, and Secrets Store. Load before running wrangler commands to

<!-- cloude-code-toolbox:mcp-skills-awareness-end -->
