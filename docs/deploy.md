# デプロイ手順書（分離構成B）

spec.md「7. システム構成」で確定した構成を実際にクラウドへ載せる手順。

```
[ブラウザ] ──HTTPS──▶ [Render: Go が API + フロントを同一オリジン配信]
                          │ DATABASE_URL            │ PISTON_URL（内部用）
                          ▼                          ▼
                     [Neon: Postgres]        [Oracle Cloud VM: Piston(Docker)]
                                              FW で Render からのみ許可
```

- **DB = Neon**（サーバーレス Postgres）
- **バックエンド = Render**（Docker。Go が `/api/*` と React 静的ファイルを同一オリジンで配信 → CORS 不要）
- **実行エンジン = Oracle Cloud Always Free VM** 上の Piston

> 進め方の推奨順序: **① Neon（DB）→ ② Oracle VM（Piston）→ ③ Render（バックエンド）**。
> ③ は ① と ② の URL が必要なので最後。

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
4. この接続文字列を後で Render の `DATABASE_URL` に設定する。

> マイグレーションと問題投入（migrate / seed）は **Render コンテナの起動時に自動実行**される
> （`infra/docker-entrypoint.sh`）。手動で流す必要はない。

### ローカルから Neon を直接初期化したい場合（任意）
`.env` の `DATABASE_URL` を Neon の接続文字列にして：
```
task migrate
task seed
```

---

## ② Oracle Cloud VM（Piston）

### 2-1. VM 作成
1. Oracle Cloud にサインアップ（本人確認・クレカ登録が必要。Always Free 枠は課金されない）。
2. **Compute → Instances → Create Instance**。
   - Image: **Canonical Ubuntu 22.04**
   - Shape: **VM.Standard.A1.Flex（Ampere ARM）**, 例: 2 OCPU / 12GB（Always Free 範囲内）
   - SSH キー: 手元の公開鍵を登録（無ければ生成。Windows は `ssh-keygen -t ed25519`）。
3. 作成後、**Public IP** を控える。

### 2-2. SSH 接続 & Docker 導入
```bash
ssh ubuntu@<VM_PUBLIC_IP>

# Docker インストール
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
# 一度ログアウト→再ログインして反映
exit
ssh ubuntu@<VM_PUBLIC_IP>
```

### 2-3. Piston 起動
このリポジトリの `infra/piston/docker-compose.yml` を VM に置いて起動する。
```bash
mkdir -p ~/piston && cd ~/piston
# 下の compose をコピペで作成
cat > docker-compose.yml <<'EOF'
services:
  piston:
    image: ghcr.io/engineer-man/piston
    restart: unless-stopped
    ports:
      - "2000:2000"
    volumes:
      - piston_packages:/piston/packages
    tmpfs:
      - /piston/jobs
    privileged: true
volumes:
  piston_packages:
EOF

docker compose up -d
```

### 2-4. 言語ランタイムの導入（1回だけ）
ローカルの Taskfile と同じ内容を VM 上で実行（Python / Java / C・C++ / Node / C#）：
```bash
P=http://localhost:2000/api/v2/packages
curl -s -X POST $P -H "Content-Type:application/json" -d '{"language":"python","version":"3.10.0"}'
curl -s -X POST $P -H "Content-Type:application/json" -d '{"language":"java","version":"15.0.2"}'
curl -s -X POST $P -H "Content-Type:application/json" -d '{"language":"gcc","version":"10.2.0"}'
curl -s -X POST $P -H "Content-Type:application/json" -d '{"language":"node","version":"20.11.1"}'
curl -s -X POST $P -H "Content-Type:application/json" -d '{"language":"mono","version":"6.12.0"}'

# 動作確認
curl -s http://localhost:2000/api/v2/runtimes
```

### 2-5. ファイアウォール（重要・spec.md 8章）
Piston を一般公開しない。ポート 2000 は **Render のアウトバウンド IP からのみ**許可する。

1. **Render のアウトバウンド IP** を確認：Render ダッシュボード → 対象サービス → **Connect → Outbound**（数個の固定 IP が表示される）。
2. **Oracle 側セキュリティリスト**：VCN → Security Lists → Ingress Rules に、
   - Source = Render の各アウトバウンド IP（`/32`）
   - Protocol = TCP, Dest Port = `2000`
   を追加。**それ以外からの 2000 番は拒否**のまま。
3. **VM の OS ファイアウォール**（Ubuntu の iptables/ufw）も同様に 2000 を絞る：
   ```bash
   # 例: Render IP のみ許可（<RENDER_IP> は実 IP に置換、複数なら繰り返す）
   sudo iptables -I INPUT -p tcp --dport 2000 -s <RENDER_IP> -j ACCEPT
   sudo iptables -A INPUT -p tcp --dport 2000 -j DROP
   sudo netfilter-persistent save   # 無ければ: sudo apt-get install -y iptables-persistent
   ```
   > Oracle の Ubuntu イメージはデフォルトで iptables が効いていることが多い。SSH(22) を閉じないよう注意。

→ Render に設定する `PISTON_URL` は `http://<VM_PUBLIC_IP>:2000`。

---

## ③ Render（バックエンド + フロント配信）

### 3-1. リポジトリ連携
1. https://render.com にサインアップ（GitHub 連携）。
2. リポジトリ `KurenNagata/LearnCode` へのアクセスを許可。

### 3-2. Blueprint で作成
リポジトリ直下の `render.yaml` を使う（推奨）。
1. Render ダッシュボード → **New → Blueprint** → リポジトリを選択。
2. `render.yaml` が検出され、`learncode`（Docker, free）が作成される。
3. **環境変数を入力**（`sync:false` の項目）：
   - `DATABASE_URL` = ①の Neon 接続文字列
   - `PISTON_URL` = `http://<VM_PUBLIC_IP>:2000`
   - （`JWT_SECRET` は自動生成、`APP_ENV=production`・`STATIC_DIR=/app/web` は yaml 済み）
4. Apply。初回ビルド（Docker）が走る。
   - 起動時に migrate → seed → server が自動実行される。
   - ログに `server listening` と `serving frontend from /app/web` が出れば成功。

> Blueprint を使わず手動で作る場合: New → Web Service → Docker → 同じ環境変数を設定。

### 3-3. 動作確認
- 発行された URL（例 `https://learncode.onrender.com`）をブラウザで開く → フロントが表示される。
- 問題を1問解いて提出 → `passed:true/false` が返れば、Render→Piston→Neon の経路が通っている。
- 留意: Render 無料枠はアイドルでスリープし、初回アクセスに数十秒かかる（自分用なら許容）。

---

## トラブルシュート
| 症状 | 見るところ |
|------|-----------|
| 起動時に DB エラー | `DATABASE_URL` の値 / `sslmode=require` の有無 / Neon が起動中か |
| 提出が常に失敗・タイムアウト | `PISTON_URL` / Oracle FW で Render IP が許可されているか / VM の Piston 稼働 |
| ランタイム無しエラー | 2-4 のランタイム導入を実行したか（`/api/v2/runtimes` で確認） |
| 本番起動拒否 | `APP_ENV=production` なのに `JWT_SECRET` 未設定（generateValue で自動のはず） |
| フロントが出ない | `STATIC_DIR=/app/web` / Docker ビルドで web/dist が生成されたか |

## 再デプロイ
`main` に push すると Render が自動で再ビルド・再デプロイ（`autoDeploy: true`）。
migrate / seed は冪等なので毎回流れても安全。
