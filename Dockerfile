# syntax=docker/dockerfile:1

# ── 1) フロント（Vite）ビルド ───────────────────────────────
FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ── 2) Go ビルド ───────────────────────────────────────────
FROM golang:1.25-alpine AS api
WORKDIR /src/api
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server \
 && CGO_ENABLED=0 GOOS=linux go build -o /out/migrate ./cmd/migrate \
 && CGO_ENABLED=0 GOOS=linux go build -o /out/seed   ./cmd/seed

# ── 3) 実行イメージ ─────────────────────────────────────────
FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
# バイナリ（server / migrate / seed）
COPY --from=api /out/ /app/
# migrate/seed が相対パスで参照する（workdir=/app）
COPY api/migrations/ /app/migrations/
COPY api/seed/       /app/seed/
# ビルド済みフロント（同一オリジンで配信）
COPY --from=web /web/dist/ /app/web/
# 起動時に migrate → seed → server を実行
COPY infra/docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV STATIC_DIR=/app/web
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
