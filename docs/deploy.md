# デプロイ手順書

クラウドへ載せる手順。コード実行エンジンは当初 Oracle VM 上の Piston を予定していたが、
公開 Piston API が 2026-02-15 にホワイトリスト制となり、Oracle のサインアップも難航したため、
**コード実行を glot.io（無料・クレカ不要の Run API）に切り替えた**。
さらにフロントを **Cloudflare Workers**、バックエンドを **Google Cloud Run** に分離する構成に変更した。

```
[ブラウザ] ──HTTPS──▶ [Cloudflare Workers: React+Monaco 静的配信]
                          │ fetch (別オリジン → CORS)
                          ▼
                     [Cloud Run: Go API]
                          │ DATABASE_URL           │ GLOT_TOKEN
                          ▼                         ▼
                     [Neon: Postgres]         [glot.io Run API]
```

- **フロント = Cloudflare Workers**（静的アセット配信。`web/dist` を公開）
- **バックエンド = Cloud Run**（Docker。Go が `/api/*` を提供。フロントは別オリジンなので CORS 必要）
- **DB = Neon**（サーバーレス Postgres）
- **実行エンジン = glot.io**（外部 Run API。自前 VM 不要、API トークンのみ）

> 進め方の推奨順序: **① Neon → ② glot.io → ③ Cloud Run → ④ Cloudflare Workers**。
> ③ は ① と ② の値が必要。④ は ③ の URL（`VITE_API_BASE`）が必要なので最後。

---

## ① Neon（Postgres）

1. https://neon.tech にサインアップ（GitHub アカウントで可）。
2. New Project を作成（リージョンは `Asia Pacific (Singapore)` などが日本から近い）。
3. ダッシュボードの **Connection string** をコピー。形は：
   ```
   postgresql://<user>:<password>@<host>.neon.tech/<db>?sslmode=require
   ```
   - `sslmode=require` が付いていることを確認（pgx はこれで TLS 接続する）。
   - 「Pooled connection」と「Direct connection」があれば、**Pooled** を使う。
4. この接続文字列を後で Cloud Run の `DATABASE_URL` に設定する。

> マイグレーションと問題投入（migrate / seed）は **Cloud Run コンテナの起動時に自動実行**される
> （`infra/docker-entrypoint.sh`）。手動で流す必要はない。

### ローカルから Neon を直接初期化したい場合（任意）
`.env` の `DATABASE_URL` を Neon の接続文字列にして：
```
task migrate
task seed
```

---

## ② glot.io（コード実行 API のトークン取得）

自前 VM を立てず、glot.io の Run API でコードを実行する。クレカ不要・無料。

1. https://glot.io にアクセスし、**Sign in**（GitHub アカウントでログインできる）。
2. 右上のアカウントメニュー → **API token**（直リンク: https://glot.io/account/token）。
3. 表示された **トークン文字列**をコピー。これを ③ Cloud Run の `GLOT_TOKEN` に設定する。

> 実行は同期（1リクエストで結果が返る）。Go 側は `api/internal/glot/client.go` が
> `POST https://glot.io/api/run/{language}/latest` を叩き、stdout を採点に使う。
> 対応言語: python / javascript / java / c / cpp / csharp。
> Java はソースを `Main.java`（クラス名 `Main`）として送る実装になっている。

### ローカルで動作確認したい場合（任意）
`.env` に `GLOT_TOKEN=<トークン>` を入れ、`task dev`（または `task run`）で起動して `task check`。

---

## ③ Cloud Run（Go バックエンド）

ルートの `Dockerfile`（Go のみ。フロントは含めない）をビルドして Cloud Run にデプロイする。

### 3-1. 事前準備
1. Google Cloud にサインアップ（**クレジットカード登録が必要**。Cloud Run は無料枠が広い）。
2. プロジェクトを作成し、課金を有効化。
3. ローカルに `gcloud` CLI を入れて初期化：
   ```
   gcloud auth login
   gcloud config set project <PROJECT_ID>
   ```
   - 初回は Cloud Run / Cloud Build / Artifact Registry の API 有効化を促されるので許可。

### 3-2. デプロイ
リポジトリ直下でソースから直接デプロイ（`Dockerfile` が使われる）：
```
gcloud run deploy learncode-api \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars APP_ENV=production \
  --set-env-vars "DATABASE_URL=<①の Neon 接続文字列>" \
  --set-env-vars GLOT_TOKEN=<②のトークン> \
  --set-env-vars JWT_SECRET=<強いランダム文字列> \
  --set-env-vars "ALLOWED_ORIGINS=<④で決まる Workers のURL>"
```
- `task deploy:api` でも最小構成のデプロイができる（環境変数は別途設定）。
- `ALLOWED_ORIGINS` は ④ の URL が確定してから設定/更新でよい（初回は仮で可、後から
  `gcloud run services update learncode-api --update-env-vars ALLOWED_ORIGINS=...`）。
- `PORT` は Cloud Run が自動注入し、`config.go` がそれを読む（明示設定は不要）。
- 起動時に migrate → seed → server が自動実行され、ログに `server listening` が出れば成功。

### 3-3. 動作確認
発行された **サービスURL**（例 `https://learncode-api-xxxx-an.a.run.app`）を控える。
```
curl https://<サービスURL>/api/problems?language=python
```
問題一覧の JSON が返れば API は生きている。このURLが ④ の `VITE_API_BASE`。

---

## ④ Cloudflare Workers（フロント配信）

`web/wrangler.toml` で静的アセット（`web/dist`）を配信する。

### 4-1. 事前準備
1. Cloudflare アカウントを作成（無料）。
2. `web/.env.production.example` を `web/.env.production` にコピーし、
   `VITE_API_BASE=<③のサービスURL>` を設定（末尾スラッシュなし）。

### 4-2. ビルド & デプロイ
```
task web:deploy        # 内部で npm run build → npx wrangler deploy
```
- 初回は `npx wrangler login`（ブラウザ認証）を求められる。
- デプロイ後に `https://learncode.<subdomain>.workers.dev` が発行される。

### 4-3. CORS の確定
④ の URL を ③ の `ALLOWED_ORIGINS` に設定（未設定だと既定 `*` で全許可・動くが絞るのが安全）：
```
gcloud run services update learncode-api --region asia-northeast1 \
  --update-env-vars "ALLOWED_ORIGINS=https://learncode.<subdomain>.workers.dev"
```

### 4-4. 動作確認
- 発行された Workers URL をブラウザで開く → フロントが表示される。
- ログイン → 問題を1問解いて提出 → `passed:true/false` が返れば、
  Workers → Cloud Run → glot.io / Neon の経路が通っている。

---

## トラブルシュート
| 症状 | 見るところ |
|------|-----------|
| 起動時に DB エラー | `DATABASE_URL` の値 / `sslmode=require` の有無 / Neon が起動中か |
| 提出が常に失敗 | `GLOT_TOKEN` が正しいか（glot 401/`message`）/ glot.io 稼働状況 |
| ブラウザで CORS エラー | `ALLOWED_ORIGINS` に Workers の正確なURL（スキーム込み）が入っているか |
| フロントが API を叩けない | ビルド時の `VITE_API_BASE` が ③ のURLと一致しているか（再ビルド要） |
| 本番起動拒否（GLOT） | `APP_ENV=production` なのに `GLOT_TOKEN` 未設定（config.go が起動を止める） |
| 本番起動拒否（JWT） | `APP_ENV=production` なのに `JWT_SECRET` 未設定 |

## 再デプロイ
- API: 再度 `gcloud run deploy ...`（または `task deploy:api`）。migrate / seed は冪等。
- フロント: `task web:deploy`。`VITE_API_BASE` を変えたら必ず再ビルドが必要。
