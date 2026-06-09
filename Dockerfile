# syntax=docker/dockerfile:1
# Cloud Run 用イメージ（Go API のみ）。フロントは Cloudflare Workers が配信するため
# このイメージに web/dist は含めない（静的配信なし → STATIC_DIR も設定しない）。

# ── 1) Go ビルド ───────────────────────────────────────────
FROM golang:1.25-alpine AS api
WORKDIR /src/api
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server \
 && CGO_ENABLED=0 GOOS=linux go build -o /out/migrate ./cmd/migrate \
 && CGO_ENABLED=0 GOOS=linux go build -o /out/seed   ./cmd/seed

# ── 2) 実行イメージ ─────────────────────────────────────────
FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
# バイナリ（server / migrate / seed）
COPY --from=api /out/ /app/
# migrate/seed が相対パスで参照する（workdir=/app）
COPY api/migrations/ /app/migrations/
COPY api/seed/       /app/seed/
# 起動時に migrate → seed → server を実行
COPY infra/docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Cloud Run は $PORT を注入する（config.go が PORT を読む。既定 8080）。
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
